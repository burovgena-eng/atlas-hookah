'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications, NotificationsProvider } from '@/hooks/use-notifications';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Flame,
  LayoutDashboard,
  User,
  Beaker,
  Globe,
  Users,
  BookOpen,
  ChefHat,
  Settings,
  LogOut,
  Bell,
  Shield,
  Star,
  Menu,
  X,
  ChevronRight,
  Package,
} from 'lucide-react';
import { DashboardSection } from './sections/dashboard-section';
import { ProfileSection } from './sections/profile-section';
import { MyMixesSection } from './sections/my-mixes-section';
import { PublicMixesSection } from './sections/public-mixes-section';
import { ClientsSection } from './sections/clients-section';
import { KnowledgeSection } from './sections/knowledge-section';
import { RecipesSection } from './sections/recipes-section';
import { ManageUsersSection } from './sections/manage-users-section';
import { NotificationsSection } from './sections/notifications-section';
import { SecuritySection } from './sections/security-section';
import { InventorySection } from './sections/inventory-section';
import { AppSection } from '@/types';
import { ErrorBoundary } from './error-boundary';
import { UserCog } from 'lucide-react';

// Меню для кальянного мастера
const masterMenuItems: { id: AppSection; label: string; icon: React.ComponentType<{ className?: string }>; mobile?: boolean }[] = [
  { id: 'dashboard', label: 'Главная', icon: LayoutDashboard, mobile: true },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'profile', label: 'Профиль', icon: User, mobile: true },
  { id: 'my-mixes', label: 'Мои миксы', icon: Beaker },
  { id: 'public-mixes', label: 'Публичные миксы', icon: Globe, mobile: true },
  { id: 'clients', label: 'Постоянники', icon: Users },
  { id: 'inventory', label: 'Инвентаризация', icon: Package },
  { id: 'knowledge', label: 'База знаний', icon: BookOpen, mobile: true },
  { id: 'recipes', label: 'Рецептуры', icon: ChefHat },
];

// Меню для старшего кальянного мастера
const seniorMasterMenuItems: { id: AppSection; label: string; icon: React.ComponentType<{ className?: string }>; mobile?: boolean }[] = [
  { id: 'dashboard', label: 'Главная', icon: LayoutDashboard, mobile: true },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'profile', label: 'Профиль', icon: User, mobile: true },
  { id: 'my-mixes', label: 'Мои миксы', icon: Beaker },
  { id: 'public-mixes', label: 'Публичные миксы', icon: Globe, mobile: true },
  { id: 'clients', label: 'Постоянники', icon: Users },
  { id: 'inventory', label: 'Инвентаризация', icon: Package },
  { id: 'knowledge', label: 'База знаний', icon: BookOpen, mobile: true },
  { id: 'recipes', label: 'Рецептуры', icon: ChefHat },
];

// Меню для администратора (без миксов и инвентаризации)
const adminMenuItems: { id: AppSection; label: string; icon: React.ComponentType<{ className?: string }>; mobile?: boolean }[] = [
  { id: 'dashboard', label: 'Главная', icon: LayoutDashboard, mobile: true },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'profile', label: 'Профиль', icon: User, mobile: true },
  { id: 'clients', label: 'Постоянники', icon: Users },
  { id: 'knowledge', label: 'База знаний', icon: BookOpen, mobile: true },
];

// Меню для руководителя (без инвентаризации - руководителю не нужен калькулятор)
const managerMenuItems: { id: AppSection; label: string; icon: React.ComponentType<{ className?: string }>; mobile?: boolean }[] = [
  { id: 'dashboard', label: 'Главная', icon: LayoutDashboard, mobile: true },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'profile', label: 'Профиль', icon: User, mobile: true },
  { id: 'public-mixes', label: 'Миксы сотрудников', icon: Globe, mobile: true },
  { id: 'clients', label: 'Постоянники', icon: Users },
  { id: 'knowledge', label: 'База знаний', icon: BookOpen, mobile: true },
  { id: 'recipes', label: 'Рецептуры', icon: ChefHat },
  { id: 'manage-users', label: 'Управление', icon: Settings },
  { id: 'security', label: 'Безопасность', icon: Shield },
];

function MainAppContent() {
  const { user, logout, currentSection, setCurrentSection } = useAuth();
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isManager = user?.role === 'MANAGER';
  const isSeniorMaster = user?.role === 'SENIOR_MASTER';
  const isAdmin = user?.role === 'ADMIN';
  const isPrivileged = isManager || isSeniorMaster || isAdmin;

  // Выбираем меню в зависимости от роли
  const allMenuItems = isManager 
    ? managerMenuItems 
    : isAdmin
      ? adminMenuItems
      : isSeniorMaster 
        ? seniorMasterMenuItems 
        : masterMenuItems;

  // Элементы для bottom navigation (mobile: true)
  const mobileNavItems = allMenuItems.filter(item => item.mobile);

  // Закрытие drawer при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Периодическое обновление непрочитанных уведомлений
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(refreshUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user, refreshUnreadCount]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getSectionTitle = () => {
    const item = allMenuItems.find((m) => m.id === currentSection);
    return item?.label || 'Главная';
  };

  const getRoleLabel = () => {
    if (isManager) return 'Руководитель';
    if (isAdmin) return 'Администратор';
    if (isSeniorMaster) return 'Старший мастер';
    return 'Кальянный мастер';
  };

  const getRoleIcon = () => {
    if (isManager) return <Shield className="w-3 h-3" />;
    if (isAdmin) return <UserCog className="w-3 h-3" />;
    if (isSeniorMaster) return <Star className="w-3 h-3" />;
    return null;
  };

  const handleSectionChange = (section: AppSection) => {
    setCurrentSection(section);
    setIsMobileMenuOpen(false);
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <DashboardSection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'profile':
        return <ProfileSection />;
      case 'my-mixes':
        return <MyMixesSection />;
      case 'public-mixes':
        return <PublicMixesSection />;
      case 'clients':
        return <ClientsSection />;
      case 'knowledge':
        return <KnowledgeSection />;
      case 'recipes':
        return <RecipesSection />;
      case 'manage-users':
        return <ManageUsersSection />;
      case 'security':
        return <SecuritySection />;
      case 'inventory':
        return <InventorySection />;
      default:
        return <DashboardSection />;
    }
  };

  const MenuItem = ({ item, isMobile = false }: { item: typeof allMenuItems[0]; isMobile?: boolean }) => {
    const Icon = item.icon;
    const isActive = currentSection === item.id;
    const isNotifications = item.id === 'notifications';

    return (
      <button
        onClick={() => handleSectionChange(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all relative ${
          isActive
            ? 'bg-emerald-500/20 text-emerald-400 font-medium'
            : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
        } ${isMobile ? 'active:scale-95' : ''}`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="flex-1">{item.label}</span>
        {isNotifications && unreadCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {isActive && !isNotifications && !isMobile && <ChevronRight className="w-4 h-4" />}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 h-14 border-b border-slate-700 bg-slate-800/95 backdrop-blur-sm flex items-center px-4">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 -ml-2 text-slate-400 hover:text-white touch-manipulation"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">{getSectionTitle()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPrivileged && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              isManager 
                ? 'bg-indigo-500/20 text-indigo-400' 
                : isAdmin 
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-purple-500/20 text-purple-400'
            }`}>
              {isManager ? <Shield className="w-3 h-3" /> : isAdmin ? <UserCog className="w-3 h-3" /> : <Star className="w-3 h-3" />}
            </div>
          )}
          <Avatar className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600">
            {user?.avatar ? (
              <AvatarImage src={user.avatar} alt={user.name} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white text-sm font-medium">
              {user ? getInitials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      )}

      {/* Mobile Drawer */}
      <div
        ref={drawerRef}
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-slate-800 border-r border-slate-700 transform transition-transform duration-300 ease-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">Atlas</h1>
              <p className="text-xs text-slate-400">Hookah Master</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 text-slate-400 hover:text-white touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info in Drawer */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600">
              {user?.avatar ? (
                <AvatarImage src={user.avatar} alt={user.name} />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white font-medium">
                {user ? getInitials(user.name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">{user?.name}</p>
              <p className="text-sm text-slate-400 flex items-center gap-1">
                {getRoleIcon()}
                {getRoleLabel()}
              </p>
            </div>
          </div>
        </div>

        {/* Drawer Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
          {allMenuItems.map((item) => (
            <MenuItem key={item.id} item={item} />
          ))}
        </nav>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-700">
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full text-slate-400 hover:text-white hover:bg-slate-700/50 touch-manipulation"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Выйти
          </Button>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="flex-1 flex hidden lg:flex">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-slate-800/50 border-r border-slate-700 flex flex-col flex-shrink-0">
          {/* Logo */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white">Atlas</h1>
                <p className="text-xs text-slate-400">Hookah Master</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {allMenuItems.map((item) => (
              <MenuItem key={item.id} item={item} />
            ))}
          </nav>

          {/* User info */}
          <div className="p-3 border-t border-slate-700">
            <div className="flex items-center gap-3 p-2">
              <Avatar className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600">
                {user?.avatar ? (
                  <AvatarImage src={user.avatar} alt={user.name} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white font-medium">
                  {user ? getInitials(user.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  {getRoleIcon()}
                  {getRoleLabel()}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full mt-2 text-slate-400 hover:text-white hover:bg-slate-700/50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </div>
        </aside>

        {/* Desktop Main Content */}
        <main className="flex-1 flex flex-col min-h-0">
          {/* Desktop Header */}
          <header className="h-16 border-b border-slate-700 bg-slate-800/30 flex items-center px-6 flex-shrink-0">
            <h2 className="text-xl font-semibold text-white">{getSectionTitle()}</h2>
            {isPrivileged && (
              <div className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                isManager 
                  ? 'bg-indigo-500/20 text-indigo-400' 
                  : isAdmin 
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-purple-500/20 text-purple-400'
              }`}>
                {isManager ? <Shield className="w-4 h-4" /> : isAdmin ? <UserCog className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                {isManager ? 'Режим руководителя' : isAdmin ? 'Администратор' : 'Старший мастер'}
              </div>
            )}
          </header>

          {/* Desktop Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <ErrorBoundary>
              {renderSection()}
            </ErrorBoundary>
          </div>

          {/* Desktop Footer */}
          <footer className="h-12 border-t border-slate-700 bg-slate-800/30 flex items-center justify-center px-6 flex-shrink-0">
            <p className="text-sm text-slate-500">
              © 2024 Atlas Hookah. Все права защищены.
            </p>
          </footer>
        </main>
      </div>

      {/* Mobile Content */}
      <main className="flex-1 flex flex-col lg:hidden pb-16">
        {/* Mobile Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          <ErrorBoundary>
            {renderSection()}
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-slate-800/95 backdrop-blur-sm border-t border-slate-700 safe-area-inset-bottom">
        <div className="h-full grid grid-cols-5 gap-1 px-2">
          {mobileNavItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg transition-all touch-manipulation ${
                  isActive
                    ? 'text-emerald-400'
                    : 'text-slate-400 active:bg-slate-700/50'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : ''}`} />
                  {item.id === 'notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-emerald-400' : ''}`}>
                  {item.label.length > 8 ? item.label.slice(0, 7) + '.' : item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <style jsx global>{`
        .safe-area-inset-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
      `}</style>
    </div>
  );
}

export function MainApp() {
  const { user } = useAuth();
  
  return (
    <NotificationsProvider userId={user?.id}>
      <MainAppContent />
    </NotificationsProvider>
  );
}
