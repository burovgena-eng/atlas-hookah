'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Beaker, Users, BookOpen, ChefHat, TrendingUp, Clock, Heart, Flame, ChevronRight, Plus,
  Shield, Settings, UserCheck, UserCog
} from 'lucide-react';

interface DashboardStats {
  myMixesCount: number;
  publicMixesCount: number;
  clientsCount: number;
  recipesCount: number;
  recentMixes: Array<{
    id: string;
    name: string;
    createdAt: string;
    likes: number;
  }>;
  // Для руководителя
  mastersCount?: number;
  adminsCount?: number;
  pendingUsersCount?: number;
  // Для администратора
  knowledgeCount?: number;
}

export function DashboardSection() {
  const { user, setCurrentSection } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';
  const isSeniorMaster = user?.role === 'SENIOR_MASTER';

  useEffect(() => {
    const controller = new AbortController();
    
    const fetchStats = async () => {
      if (!user) return;

      try {
        if (isManager) {
          // Загрузка статистики для руководителя
          const [usersRes, clientsRes, recipesRes] = await Promise.all([
            fetch(`/api/users?userId=${user.id}`, { signal: controller.signal }),
            fetch(`/api/clients?masterId=${user.id}`, { signal: controller.signal }),
            fetch('/api/recipes', { signal: controller.signal }),
          ]);

          const usersData = await usersRes.json();
          const clientsData = await clientsRes.json();
          const recipesData = await recipesRes.json();
          
          if (controller.signal.aborted) return;

          // Подсчитываем мастеров (исключаем удалённых)
          const masters = (usersData.users || []).filter(
            (u: { role: string; deletedAt: string | null }) => 
              (u.role === 'HOOKAH_MASTER' || u.role === 'SENIOR_MASTER') && !u.deletedAt
          );
          const admins = (usersData.users || []).filter(
            (u: { role: string; deletedAt: string | null }) => 
              u.role === 'ADMIN' && !u.deletedAt
          );
          const pendingUsers = (usersData.users || []).filter(
            (u: { isApproved: boolean; deletedAt: string | null }) => !u.isApproved && !u.deletedAt
          );

          setStats({
            myMixesCount: 0,
            publicMixesCount: 0,
            clientsCount: clientsData.clients?.length || 0,
            recipesCount: recipesData.recipes?.length || 0,
            recentMixes: [],
            mastersCount: masters.length,
            adminsCount: admins.length,
            pendingUsersCount: pendingUsers.length,
          });
        } else if (isAdmin) {
          // Загрузка статистики для администратора
          const [clientsRes, knowledgeRes] = await Promise.all([
            fetch(`/api/clients?masterId=${user.id}`, { signal: controller.signal }),
            fetch(`/api/knowledge?userId=${user.id}`, { signal: controller.signal }),
          ]);

          const clientsData = await clientsRes.json();
          const knowledgeData = await knowledgeRes.json();
          
          if (controller.signal.aborted) return;

          setStats({
            myMixesCount: 0,
            publicMixesCount: 0,
            clientsCount: clientsData.clients?.length || 0,
            recipesCount: 0,
            recentMixes: [],
            knowledgeCount: knowledgeData.articles?.length || 0,
          });
        } else {
          // Загрузка статистики для мастера/старшего мастера
          const [mixesRes, publicMixesRes, clientsRes, recipesRes] = await Promise.all([
            fetch(`/api/mixes?userId=${user.id}&type=personal`, { signal: controller.signal }),
            fetch(`/api/mixes?userId=${user.id}&type=public`, { signal: controller.signal }),
            fetch(`/api/clients?masterId=${user.id}`, { signal: controller.signal }),
            fetch('/api/recipes', { signal: controller.signal }),
          ]);

          const mixesData = await mixesRes.json();
          const publicMixesData = await publicMixesRes.json();
          const clientsData = await clientsRes.json();
          const recipesData = await recipesRes.json();
          
          if (controller.signal.aborted) return;

          const recentMixes = (mixesData.mixes || []).slice(0, 3).map((m: { id: string; name: string; createdAt: string; _count?: { likes: number } }) => ({
            id: m.id,
            name: m.name,
            createdAt: m.createdAt,
            likes: m._count?.likes || 0,
          }));

          setStats({
            myMixesCount: mixesData.mixes?.length || 0,
            publicMixesCount: publicMixesData.mixes?.length || 0,
            clientsCount: clientsData.clients?.length || 0,
            recipesCount: recipesData.recipes?.length || 0,
            recentMixes,
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching stats:', error);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchStats();
    
    return () => {
      controller.abort();
    };
  }, [user, isManager, isAdmin]);

  // Быстрые действия для мастера
  const masterQuickActions = [
    { label: 'Создать микс', icon: Beaker, section: 'my-mixes' as const, color: 'from-emerald-500 to-green-600' },
    { label: 'Добавить клиента', icon: Users, section: 'clients' as const, color: 'from-sky-500 to-blue-600' },
    { label: 'База знаний', icon: BookOpen, section: 'knowledge' as const, color: 'from-violet-500 to-purple-600' },
    { label: 'Рецептуры', icon: ChefHat, section: 'recipes' as const, color: 'from-rose-500 to-pink-600' },
  ];

  // Быстрые действия для администратора
  const adminQuickActions = [
    { label: 'Добавить клиента', icon: Users, section: 'clients' as const, color: 'from-sky-500 to-blue-600' },
    { label: 'База знаний', icon: BookOpen, section: 'knowledge' as const, color: 'from-violet-500 to-purple-600' },
  ];

  // Быстрые действия для руководителя
  const managerQuickActions = [
    { label: 'Управление', icon: Settings, section: 'manage-users' as const, color: 'from-indigo-500 to-purple-600' },
    { label: 'База знаний', icon: BookOpen, section: 'knowledge' as const, color: 'from-violet-500 to-purple-600' },
    { label: 'Рецептуры', icon: ChefHat, section: 'recipes' as const, color: 'from-rose-500 to-pink-600' },
    { label: 'Постоянники', icon: Users, section: 'clients' as const, color: 'from-sky-500 to-blue-600' },
  ];

  const quickActions = isManager ? managerQuickActions : isAdmin ? adminQuickActions : masterQuickActions;

  // Приветствие
  const getGreeting = () => {
    if (isManager) return 'Управляйте командой и базой знаний';
    if (isAdmin) return 'Ведите базу постоянников и работайте с базой знаний';
    return 'Создавайте миксы и ведите базу постоянников';
  };

  // Иконка для приветствия
  const getWelcomeIcon = () => {
    if (isManager) return <Shield className="w-6 h-6 lg:w-8 lg:h-8 text-white" />;
    if (isAdmin) return <UserCog className="w-6 h-6 lg:w-8 lg:h-8 text-white" />;
    if (isSeniorMaster) return <Flame className="w-6 h-6 lg:w-8 lg:h-8 text-white" />;
    return <Flame className="w-6 h-6 lg:w-8 lg:h-8 text-white" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Welcome card - Mobile Optimized */}
      <Card className="bg-gradient-to-r from-emerald-500/20 to-green-600/20 border-emerald-500/30">
        <CardContent className="p-4 lg:p-6">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-xl lg:rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 flex-shrink-0">
              {getWelcomeIcon()}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl lg:text-2xl font-bold text-white truncate">
                Привет, {user?.name?.split(' ')[0]}!
              </h2>
              <p className="text-slate-400 text-sm lg:text-base mt-0.5 lg:mt-1 line-clamp-1">
                {getGreeting()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats - Разные для руководителя, администратора и мастера */}
      {isManager ? (
        // Статистика для руководителя
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer touch-manipulation"
            onClick={() => setCurrentSection('manage-users')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 lg:pb-2 p-3 lg:p-6">
              <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">
                Мастера
              </CardTitle>
              <Users className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-400" />
            </CardHeader>
            <CardContent className="pb-3 lg:pb-6 px-3 lg:px-6 pt-0">
              <p className="text-2xl lg:text-3xl font-bold text-white">{stats?.mastersCount || 0}</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 transition-colors cursor-pointer touch-manipulation"
            onClick={() => setCurrentSection('manage-users')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 lg:pb-2 p-3 lg:p-6">
              <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">
                Ожидают
              </CardTitle>
              <UserCheck className="w-4 h-4 lg:w-5 lg:h-5 text-amber-400" />
            </CardHeader>
            <CardContent className="pb-3 lg:pb-6 px-3 lg:px-6 pt-0">
              <p className="text-2xl lg:text-3xl font-bold text-white">{stats?.pendingUsersCount || 0}</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-sky-500/50 transition-colors cursor-pointer touch-manipulation"
            onClick={() => setCurrentSection('clients')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 lg:pb-2 p-3 lg:p-6">
              <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">
                Постоянники
              </CardTitle>
              <Users className="w-4 h-4 lg:w-5 lg:h-5 text-sky-400" />
            </CardHeader>
            <CardContent className="pb-3 lg:pb-6 px-3 lg:px-6 pt-0">
              <p className="text-2xl lg:text-3xl font-bold text-white">{stats?.clientsCount || 0}</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-indigo-500/50 transition-colors cursor-pointer touch-manipulation"
            onClick={() => setCurrentSection('recipes')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 lg:pb-2 p-3 lg:p-6">
              <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">
                Рецептуры
              </CardTitle>
              <ChefHat className="w-4 h-4 lg:w-5 lg:h-5 text-indigo-400" />
            </CardHeader>
            <CardContent className="pb-3 lg:pb-6 px-3 lg:px-6 pt-0">
              <p className="text-2xl lg:text-3xl font-bold text-white">{stats?.recipesCount || 0}</p>
            </CardContent>
          </Card>
        </div>
      ) : isAdmin ? (
        // Статистика для администратора
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 lg:gap-4">
          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-sky-500/50 transition-colors cursor-pointer touch-manipulation"
            onClick={() => setCurrentSection('clients')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 lg:pb-2 p-3 lg:p-6">
              <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">
                Постоянники
              </CardTitle>
              <Users className="w-4 h-4 lg:w-5 lg:h-5 text-sky-400" />
            </CardHeader>
            <CardContent className="pb-3 lg:pb-6 px-3 lg:px-6 pt-0">
              <p className="text-2xl lg:text-3xl font-bold text-white">{stats?.clientsCount || 0}</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-violet-500/50 transition-colors cursor-pointer touch-manipulation"
            onClick={() => setCurrentSection('knowledge')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 lg:pb-2 p-3 lg:p-6">
              <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">
                Статьи
              </CardTitle>
              <BookOpen className="w-4 h-4 lg:w-5 lg:h-5 text-violet-400" />
            </CardHeader>
            <CardContent className="pb-3 lg:pb-6 px-3 lg:px-6 pt-0">
              <p className="text-2xl lg:text-3xl font-bold text-white">{stats?.knowledgeCount || 0}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Статистика для мастера
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer touch-manipulation"
            onClick={() => setCurrentSection('my-mixes')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 lg:pb-2 p-3 lg:p-6">
              <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">
                Мои миксы
              </CardTitle>
              <Beaker className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-400" />
            </CardHeader>
            <CardContent className="pb-3 lg:pb-6 px-3 lg:px-6 pt-0">
              <p className="text-2xl lg:text-3xl font-bold text-white">{stats?.myMixesCount || 0}</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-sky-500/50 transition-colors cursor-pointer touch-manipulation"
            onClick={() => setCurrentSection('clients')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 lg:pb-2 p-3 lg:p-6">
              <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">
                Постоянники
              </CardTitle>
              <Users className="w-4 h-4 lg:w-5 lg:h-5 text-sky-400" />
            </CardHeader>
            <CardContent className="pb-3 lg:pb-6 px-3 lg:px-6 pt-0">
              <p className="text-2xl lg:text-3xl font-bold text-white">{stats?.clientsCount || 0}</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-sky-500/50 transition-colors cursor-pointer touch-manipulation"
            onClick={() => setCurrentSection('public-mixes')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 lg:pb-2 p-3 lg:p-6">
              <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">
                Публичные
              </CardTitle>
              <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-sky-400" />
            </CardHeader>
            <CardContent className="pb-3 lg:pb-6 px-3 lg:px-6 pt-0">
              <p className="text-2xl lg:text-3xl font-bold text-white">{stats?.publicMixesCount || 0}</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 hover:border-indigo-500/50 transition-colors cursor-pointer touch-manipulation"
            onClick={() => setCurrentSection('recipes')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 lg:pb-2 p-3 lg:p-6">
              <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">
                Рецептуры
              </CardTitle>
              <ChefHat className="w-4 h-4 lg:w-5 lg:h-5 text-indigo-400" />
            </CardHeader>
            <CardContent className="pb-3 lg:pb-6 px-3 lg:px-6 pt-0">
              <p className="text-2xl lg:text-3xl font-bold text-white">{stats?.recipesCount || 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick actions - Mobile Optimized */}
      <div>
        <h3 className="text-base lg:text-lg font-semibold text-white mb-3 lg:mb-4">Быстрые действия</h3>
        <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'} gap-3 lg:gap-4`}>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.section}
                onClick={() => setCurrentSection(action.section)}
                className={`h-auto py-3 lg:py-4 flex flex-col items-center gap-1.5 lg:gap-2 bg-gradient-to-r ${action.color} hover:opacity-90 text-white touch-manipulation active:scale-95 transition-transform`}
              >
                <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
                <span className="text-xs lg:text-sm">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Recent mixes - Только для мастеров */}
      {!isManager && !isAdmin && stats?.recentMixes && stats.recentMixes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-white">Последние миксы</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-slate-400 hover:text-white text-xs lg:text-sm touch-manipulation"
              onClick={() => setCurrentSection('my-mixes')}
            >
              Все <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {stats.recentMixes.map((mix) => (
              <Card
                key={mix.id}
                className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer touch-manipulation active:scale-[0.98]"
                onClick={() => setCurrentSection('my-mixes')}
              >
                <CardContent className="p-3 lg:p-4">
                  <h4 className="font-medium text-white text-sm lg:text-base truncate">{mix.name}</h4>
                  <div className="flex items-center gap-3 lg:gap-4 mt-2 text-xs lg:text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-rose-400" />
                      {mix.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                      {new Date(mix.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Mobile FAB - Только для мастеров */}
      {!isManager && !isAdmin && (
        <div className="fixed bottom-20 right-4 lg:hidden z-30">
          <Button
            onClick={() => setCurrentSection('my-mixes')}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/30 touch-manipulation active:scale-95"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
