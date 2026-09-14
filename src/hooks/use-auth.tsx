'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { User, AppSection } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string, phone?: string, role?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (user: User) => void;
  currentSection: AppSection;
  setCurrentSection: (section: AppSection) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Интервал проверки сессии (в мс)
const SESSION_CHECK_INTERVAL = 15000; // 15 секунд

const TOKEN_KEY = 'atlas_token';
const USER_KEY = 'atlas_user';

// Безопасная проверка доступности localStorage
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// Безопасные обёртки для localStorage
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined' || !isLocalStorageAvailable()) {
      return null;
    }
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined' || !isLocalStorageAvailable()) {
      return;
    }
    localStorage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined' || !isLocalStorageAvailable()) {
      return;
    }
    localStorage.removeItem(key);
  },
};

// Глобальный интерцептор fetch: добавляет X-Session-Token ко всем API-запросам.
// Устанавливается один раз, обрабатывает и строковые URL, и объекты Request.
function installFetchInterceptor() {
  const w = window as typeof window & { __atlasFetchPatched?: boolean };
  if (w.__atlasFetchPatched) return;
  w.__atlasFetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const isApiCall = url.startsWith('/api/') || url.includes(`${window.location.origin}/api/`);
      const token = safeLocalStorage.getItem(TOKEN_KEY);

      if (isApiCall && token) {
        const headers = new Headers(init?.headers || (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined));
        if (!headers.has('X-Session-Token')) {
          headers.set('X-Session-Token', token);
        }
        return originalFetch(input, { ...init, headers });
      }
    } catch {
      // Не прерываем выполнение запроса при ошибке интерцептора
    }
    return originalFetch(input, init);
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Начинаем с null и синхронизируем после монтирования
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentSection, setCurrentSection] = useState<AppSection>('dashboard');
  const initRef = useRef(false);

  // Синхронизируем с localStorage после монтирования
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    installFetchInterceptor();

    const savedUser = safeLocalStorage.getItem(USER_KEY);
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Используем setTimeout чтобы избежать синхронного setState
        setTimeout(() => {
          setUser(parsedUser);
          setIsInitialized(true);
        }, 0);
        return;
      } catch {
        safeLocalStorage.removeItem(USER_KEY);
      }
    }
    // Используем setTimeout чтобы избежать синхронный setState
    setTimeout(() => {
      setIsInitialized(true);
    }, 0);
  }, []);

  // Периодическая проверка валидности сессии (по серверному токену)
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const controller = new AbortController();

    const validateSession = async () => {
      try {
        // Отправляем текущие публичные данные для проверки изменений на сервере
        const params = new URLSearchParams({
          role: user.role,
          name: user.name,
          avatar: user.avatar || '',
        });

        const response = await fetch(`/api/auth/validate?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!isMounted || controller.signal.aborted) return;

        if (!data.valid) {
          console.log('Session invalidated:', data.reason);
          // Мгновенная деавторизация
          setUser(null);
          safeLocalStorage.removeItem(USER_KEY);
          safeLocalStorage.removeItem(TOKEN_KEY);
          setCurrentSection('dashboard');
          return;
        }

        // Если данные пользователя изменились (роль, имя, аватар) —
        // мерджим обновлённые поля в локальную копию (персональные данные
        // приходят только из login/profile, не из validate)
        if (data.userUpdated && data.user) {
          const updated: User = {
            ...user,
            name: data.user.name,
            avatar: data.user.avatar,
            role: data.user.role,
            isApproved: data.user.isApproved,
            city: data.user.city,
            branch: data.user.branch,
          };
          console.log('User data updated:', data.changes);
          setUser(updated);
          safeLocalStorage.setItem(USER_KEY, JSON.stringify(updated));

          if (data.changes?.roleChanged) {
            console.log(`Role changed to ${data.user.role}`);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Session validation error:', error);
      }
    };

    // Первая проверка сразу после загрузки
    validateSession();

    // Периодическая проверка
    const interval = setInterval(validateSession, SESSION_CHECK_INTERVAL);

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [user?.id, user?.role, user?.name, user?.avatar]); // Зависимости публичных полей

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error };
      }

      setUser(data.user);
      safeLocalStorage.setItem(USER_KEY, JSON.stringify(data.user));
      if (data.token) {
        safeLocalStorage.setItem(TOKEN_KEY, data.token);
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Ошибка при входе' };
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, phone?: string, role?: string) => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, phone, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error };
      }

      // Автоматически логиним только первого руководителя
      // Все остальные требуют подтверждения
      if (data.isFirstManager) {
        setUser(data.user);
        safeLocalStorage.setItem(USER_KEY, JSON.stringify(data.user));
        if (data.token) {
          safeLocalStorage.setItem(TOKEN_KEY, data.token);
        }
      }

      return {
        success: true,
        isFirstManager: data.isFirstManager,
        needsApproval: data.needsApproval,
      };
    } catch {
      return { success: false, error: 'Ошибка при регистрации' };
    }
  }, []);

  const logout = useCallback(() => {
    // Инвалидируем серверную сессию (токен добавит интерцептор)
    fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
    setUser(null);
    safeLocalStorage.removeItem(USER_KEY);
    safeLocalStorage.removeItem(TOKEN_KEY);
    setCurrentSection('dashboard');
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    safeLocalStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading: !isInitialized,
    login,
    register,
    logout,
    updateUser,
    currentSection,
    setCurrentSection,
  }), [user, isInitialized, login, register, logout, updateUser, currentSection]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
