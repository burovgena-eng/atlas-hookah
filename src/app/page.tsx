// Atlas Hookah App - v2
'use client';

import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { LoginPage } from '@/components/auth/login-page';
import { MainApp } from '@/components/main-app';

function AppContent() {
  const { user, isLoading } = useAuth();

  // Показываем состояние загрузки
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-500 text-lg font-medium">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Если нет пользователя - показываем логин
  if (!user) {
    return <LoginPage />;
  }

  // Пользователь авторизован - показываем приложение
  return <MainApp />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
