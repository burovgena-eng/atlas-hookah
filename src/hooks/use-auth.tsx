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

    const savedUser = safeLocalStorage.getItem('atlas_user');
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
        safeLocalStorage.removeItem('atlas_user');
      }
    }
    // Используем setTimeout чтобы избежать синхронный setState
    setTimeout(() => {
      setIsInitialized(true);
    }, 0);
  }, []);

  // Периодическая проверка валидности сессии
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const controller = new AbortController();

    const validateSession = async () => {
      try {
        // Отправляем текущую роль и имя для проверки изменений
        const params = new URLSearchParams({
          userId: user.id,
          role: user.role,
          name: user.name,
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
          safeLocalStorage.removeItem('atlas_user');
          setCurrentSection('dashboard');
          return;
        }

        // Если данные пользователя изменились (роль, имя и т.д.)
        if (data.userUpdated && data.user) {
          console.log('User data updated:', data.changes);
          // Обновляем пользователя в состоянии и localStorage
          setUser(data.user);
          safeLocalStorage.setItem('atlas_user', JSON.stringify(data.user));

          // Если изменилась роль, можно показать уведомление
          if (data.changes?.roleChanged) {
            console.log(`Role changed from ${user.role} to ${data.user.role}`);
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
  }, [user?.id, user?.role, user?.name]); // Зависимость от id, role и name

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
      safeLocalStorage.setItem('atlas_user', JSON.stringify(data.user));
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
        safeLocalStorage.setItem('atlas_user', JSON.stringify(data.user));
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
    setUser(null);
    safeLocalStorage.removeItem('atlas_user');
    setCurrentSection('dashboard');
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    safeLocalStorage.setItem('atlas_user', JSON.stringify(updatedUser));
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
