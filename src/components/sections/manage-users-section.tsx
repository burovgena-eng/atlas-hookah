'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/types';
import { Plus, Shield, Pencil, Trash2, Users, Beaker, Calendar, Clock, Check, X, Star, Search, Filter, MapPin, UserCog } from 'lucide-react';

// Branches by city
const BRANCHES_BY_CITY: Record<string, string[]> = {
  'Новосибирск': ['Нарымская', 'Немировича'],
  'Красноярск': ['Ломако', 'Карамзина', 'Алексеева', 'Капитанская', 'Молокова'],
};

type UserWithCount = User & { _count?: { personalMixes: number; clientNotes: number } };

export function ManageUsersSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'HOOKAH_MASTER',
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);
    return () => controller.abort();
  }, [user]);

  const fetchUsers = async (signal?: AbortSignal) => {
    if (!user) return;

    try {
      // Получаем всех пользователей
      const response = await fetch(`/api/users?userId=${user.id}`, { signal });
      const data = await response.json();
      if (!signal?.aborted) {
        setUsers(data.users || []);
      }
      
      // Получаем ожидающих подтверждения
      const pendingResponse = await fetch(`/api/users?userId=${user.id}&filter=pending`, { signal });
      const pendingData = await pendingResponse.json();
      if (!signal?.aborted) {
        setPendingUsers(pendingData.users || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching users:', error);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'HOOKAH_MASTER',
    });
    setEditingUser(null);
  };

  const openEditDialog = (targetUser: User) => {
    setEditingUser(targetUser);
    setFormData({
      name: targetUser.name,
      email: targetUser.email,
      password: '',
      phone: targetUser.phone || '',
      role: targetUser.role,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingUser) {
        // Update existing user
        const response = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingUser.id,
            userId: user.id,
            name: formData.name,
            phone: formData.phone,
            role: formData.role,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error);
        }

        toast({
          title: 'Пользователь обновлен',
        });
      } else {
        // Create new user
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            userId: user.id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error);
        }

        toast({
          title: 'Пользователь создан',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при сохранении',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (targetUser: User) => {
    if (!user) return;

    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetUser.id,
          userId: user.id,
          isApproved: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: 'Пользователь подтвержден',
        description: `${targetUser.name} теперь может войти в систему`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при подтверждении',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (targetUser: User) => {
    if (!user || !confirm(`Отклонить регистрацию ${targetUser.name}?`)) return;

    try {
      const response = await fetch(`/api/users?id=${targetUser.id}&userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast({
        title: 'Регистрация отклонена',
        description: `Аккаунт ${targetUser.name} удален`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при удалении',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Удалить этого пользователя?')) return;

    try {
      const response = await fetch(`/api/users?id=${id}&userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast({
        title: 'Удалено',
        description: 'Пользователь удален',
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при удалении',
        variant: 'destructive',
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'MANAGER':
        return (
          <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
            <Shield className="w-3 h-3 mr-1" />
            Руководитель
          </Badge>
        );
      case 'ADMIN':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            <UserCog className="w-3 h-3 mr-1" />
            Администратор
          </Badge>
        );
      case 'SENIOR_MASTER':
        return (
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            <Star className="w-3 h-3 mr-1" />
            Старший мастер
          </Badge>
        );
      default:
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Beaker className="w-3 h-3 mr-1" />
            Кальянный мастер
          </Badge>
        );
    }
  };

  // Calculate display users based on active tab
  const displayUsers = activeTab === 'pending' ? pendingUsers : users;

  // Apply filters
  const filteredUsers = useMemo(() => {
    return displayUsers.filter((u) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          (u.phone && u.phone.includes(query));
        if (!matchesSearch) return false;
      }

      // Role filter
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;

      // City filter
      if (cityFilter !== 'all' && u.city !== cityFilter) return false;

      // Branch filter
      if (branchFilter !== 'all' && u.branch !== branchFilter) return false;

      return true;
    });
  }, [displayUsers, searchQuery, roleFilter, cityFilter, branchFilter]);

  // Reset branch when city changes
  useEffect(() => {
    if (cityFilter === 'all') {
      setBranchFilter('all');
    } else if (branchFilter !== 'all' && !BRANCHES_BY_CITY[cityFilter]?.includes(branchFilter)) {
      setBranchFilter('all');
    }
  }, [cityFilter, branchFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const approvedCount = users.filter((u) => u.isApproved).length;
  const seniorCount = users.filter((u) => u.role === 'SENIOR_MASTER').length;
  const masterCount = users.filter((u) => u.role === 'HOOKAH_MASTER').length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const managerCount = users.filter((u) => u.role === 'MANAGER').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Управление пользователями</h3>
          <p className="text-slate-400 text-sm">
            Создавайте и редактируйте аккаунты сотрудников
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Новый сотрудник
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingUser
                  ? 'Измените данные сотрудника'
                  : 'Создайте новый аккаунт для сотрудника'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Имя *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Иван Иванов"
                  className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                  required
                  disabled={!!editingUser}
                />
                {editingUser && (
                  <p className="text-xs text-slate-500">Email нельзя изменить</p>
                )}
              </div>

              {!editingUser && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Пароль *</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
                    className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                    required={!editingUser}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-slate-300">Телефон</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+7 (999) 123-45-67"
                  className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Роль</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem
                      value="HOOKAH_MASTER"
                      className="text-white focus:bg-slate-700"
                    >
                      Кальянный мастер
                    </SelectItem>
                    <SelectItem
                      value="SENIOR_MASTER"
                      className="text-white focus:bg-slate-700"
                    >
                      Старший кальянный мастер
                    </SelectItem>
                    <SelectItem
                      value="ADMIN"
                      className="text-white focus:bg-slate-700"
                    >
                      Администратор
                    </SelectItem>
                    <SelectItem
                      value="MANAGER"
                      className="text-white focus:bg-slate-700"
                    >
                      Руководитель
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                >
                  {editingUser ? 'Сохранить' : 'Создать'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Всего сотрудников
            </CardTitle>
            <Users className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{users.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Кальянных мастеров
            </CardTitle>
            <Beaker className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{masterCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Старших мастеров
            </CardTitle>
            <Star className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{seniorCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Ожидают подтверждения
            </CardTitle>
            <Clock className="w-5 h-5 text-red-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{pendingUsers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'all' ? 'default' : 'outline'}
          onClick={() => setActiveTab('all')}
          className={`flex-1 min-w-0 ${activeTab === 'all' 
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
            : 'border-slate-600 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span className="hidden sm:inline">Все сотрудники ({users.length})</span>
          <span className="sm:hidden">Все ({users.length})</span>
        </Button>
        <Button
          variant={activeTab === 'pending' ? 'default' : 'outline'}
          onClick={() => setActiveTab('pending')}
          className={`flex-1 min-w-0 ${activeTab === 'pending' 
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
            : 'border-slate-600 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <span className="hidden sm:inline">Ожидают подтверждения ({pendingUsers.length})</span>
          <span className="sm:hidden">Ожидают ({pendingUsers.length})</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени, email или телефону..."
              className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            className={`${showFilters 
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
              : 'border-slate-600 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Filter className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Фильтры</span>
          </Button>
        </div>

        {/* Filter dropdowns */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            {/* Role filter */}
            <div className="space-y-2">
              <Label className="text-slate-400 text-xs">Роль</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Все роли" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-white focus:bg-slate-700">
                    Все роли
                  </SelectItem>
                  <SelectItem value="HOOKAH_MASTER" className="text-white focus:bg-slate-700">
                    Кальянный мастер
                  </SelectItem>
                  <SelectItem value="SENIOR_MASTER" className="text-white focus:bg-slate-700">
                    Старший мастер
                  </SelectItem>
                  <SelectItem value="ADMIN" className="text-white focus:bg-slate-700">
                    Администратор
                  </SelectItem>
                  <SelectItem value="MANAGER" className="text-white focus:bg-slate-700">
                    Руководитель
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* City filter */}
            <div className="space-y-2">
              <Label className="text-slate-400 text-xs">
                <MapPin className="w-3 h-3 inline mr-1" />
                Город
              </Label>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Все города" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-white focus:bg-slate-700">
                    Все города
                  </SelectItem>
                  {Object.keys(BRANCHES_BY_CITY).map((city) => (
                    <SelectItem key={city} value={city} className="text-white focus:bg-slate-700">
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Branch filter */}
            <div className="space-y-2">
              <Label className="text-slate-400 text-xs">Филиал</Label>
              <Select 
                value={branchFilter} 
                onValueChange={setBranchFilter}
                disabled={cityFilter === 'all'}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white disabled:opacity-50">
                  <SelectValue placeholder={cityFilter === 'all' ? 'Сначала выберите город' : 'Все филиалы'} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-white focus:bg-slate-700">
                    Все филиалы
                  </SelectItem>
                  {cityFilter !== 'all' && BRANCHES_BY_CITY[cityFilter]?.map((branch) => (
                    <SelectItem key={branch} value={branch} className="text-white focus:bg-slate-700">
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear filters button */}
            {(roleFilter !== 'all' || cityFilter !== 'all' || branchFilter !== 'all' || searchQuery) && (
              <div className="sm:col-span-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('all');
                    setCityFilter('all');
                    setBranchFilter('all');
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4 mr-1" />
                  Сбросить фильтры
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Active filters count */}
        {(roleFilter !== 'all' || cityFilter !== 'all' || branchFilter !== 'all' || searchQuery) && !showFilters && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
              {filteredUsers.length} из {displayUsers.length}
            </Badge>
            <span>результатов</span>
          </div>
        )}
      </div>

      {/* Users list */}
      {filteredUsers.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {displayUsers.length === 0
                ? (activeTab === 'pending' 
                  ? 'Нет пользователей, ожидающих подтверждения'
                  : 'Пользователи не найдены')
                : 'Нет результатов по заданным фильтрам'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((targetUser) => (
            <Card
              key={targetUser.id}
              className={`bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-colors ${
                !targetUser.isApproved ? 'border-red-500/50' : ''
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600">
                      {targetUser.avatar && (
                        <AvatarImage src={targetUser.avatar} alt={targetUser.name} />
                      )}
                      <AvatarFallback className="text-white text-sm">
                        {getInitials(targetUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-white text-base">
                        {targetUser.name}
                      </CardTitle>
                      <p className="text-slate-400 text-xs">{targetUser.email}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  {getRoleBadge(targetUser.role)}
                  {!targetUser.isApproved && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      <Clock className="w-3 h-3 mr-1" />
                      Ожидает
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 text-sm text-slate-400">
                  {targetUser.phone && <p>📞 {targetUser.phone}</p>}
                  {targetUser.city && (
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {targetUser.city}
                      {targetUser.branch && ` — ${targetUser.branch}`}
                    </p>
                  )}
                </div>

                <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(targetUser.createdAt).toLocaleDateString('ru-RU')}
                </p>

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                  {!targetUser.isApproved ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApprove(targetUser)}
                        className="flex-1 border-emerald-600 text-emerald-400 hover:bg-emerald-500/20"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Подтвердить
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(targetUser)}
                        className="border-red-600 text-red-400 hover:bg-red-500/20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(targetUser)}
                        className="text-slate-400 hover:text-emerald-500"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {targetUser.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(targetUser.id)}
                          className="text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
