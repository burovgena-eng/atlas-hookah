'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ClientNote, ClientMasterNote } from '@/types';
import { Plus, Pencil, Trash2, Users, Phone, Heart, Clock, Lock, Globe, Eye, EyeOff, Search, StickyNote, MapPin, Filter, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Города и филиалы
const BRANCHES_BY_CITY: Record<string, string[]> = {
  'Новосибирск': ['Нарымская', 'Немировича'],
  'Красноярск': ['Ломако', 'Карамзина', 'Алексеева', 'Капитанская', 'Молокова'],
};

export function ClientsSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientNote | null>(null);
  const [noteClient, setNoteClient] = useState<ClientNote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPersonalNotes, setShowPersonalNotes] = useState<Record<string, boolean>>({});
  const [showMyNote, setShowMyNote] = useState<Record<string, boolean>>({});
  // Фильтры - используем '__all__' как значение для "показать все"
  const [cityFilter, setCityFilter] = useState<string>('__all__');
  const [branchFilter, setBranchFilter] = useState<string>('__all__');
  const [myNoteText, setMyNoteText] = useState('');
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    preferences: '',
    personalNotes: '',
    publicNotes: '',
    favoriteMix: '',
    firstVisitCity: '',
    firstVisitBranch: '',
    isPublic: true,
  });

  const fetchClients = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/clients?type=all');
      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const resetForm = () => {
    setFormData({
      clientName: '',
      clientPhone: '',
      preferences: '',
      personalNotes: '',
      publicNotes: '',
      favoriteMix: '',
      firstVisitCity: '',
      firstVisitBranch: '',
      isPublic: true,
    });
    setEditingClient(null);
  };

  const openEditDialog = (client: ClientNote) => {
    if (client.masterId !== user?.id) {
      toast({
        title: 'Ошибка',
        description: 'Можно редактировать только своих клиентов',
        variant: 'destructive',
      });
      return;
    }
    setEditingClient(client);
    setFormData({
      clientName: client.clientName,
      clientPhone: client.clientPhone || '',
      preferences: client.preferences || '',
      personalNotes: client.personalNotes || '',
      publicNotes: client.publicNotes,
      favoriteMix: client.favoriteMix || '',
      firstVisitCity: client.firstVisitCity || '',
      firstVisitBranch: client.firstVisitBranch || '',
      isPublic: client.isPublic,
    });
    setIsDialogOpen(true);
  };

  const openNoteDialog = (client: ClientNote) => {
    setNoteClient(client);
    setMyNoteText(client.myNote?.notes || '');
    setIsNoteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const url = '/api/clients';
      const method = editingClient ? 'PUT' : 'POST';
      const body = editingClient
        ? { ...formData, id: editingClient.id, masterId: user.id }
        : { ...formData, masterId: user.id };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: editingClient ? 'Заметка обновлена' : 'Клиент добавлен',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchClients();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при сохранении',
        variant: 'destructive',
      });
    }
  };

  const handleSaveMyNote = async () => {
    if (!user || !noteClient) return;

    try {
      const response = await fetch('/api/clients/master-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientNoteId: noteClient.id,
          masterId: user.id,
          notes: myNoteText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast({
        title: 'Заметка сохранена',
      });

      setIsNoteDialogOpen(false);
      setNoteClient(null);
      setMyNoteText('');
      fetchClients();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при сохранении',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Удалить заметку об этом клиенте?')) return;

    try {
      const response = await fetch(`/api/clients?id=${id}&masterId=${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast({
        title: 'Удалено',
        description: 'Заметка о клиенте удалена',
      });
      fetchClients();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при удалении',
        variant: 'destructive',
      });
    }
  };

  const incrementVisit = async (client: ClientNote) => {
    if (!user || client.masterId !== user.id) return;

    try {
      const response = await fetch('/api/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: client.id,
          masterId: user.id,
          clientName: client.clientName,
          clientPhone: client.clientPhone,
          preferences: client.preferences,
          personalNotes: client.personalNotes,
          publicNotes: client.publicNotes,
          favoriteMix: client.favoriteMix,
          firstVisitCity: client.firstVisitCity,
          firstVisitBranch: client.firstVisitBranch,
          isPublic: client.isPublic,
          visitCount: client.visitCount + 1,
          lastVisit: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        fetchClients();
        toast({
          title: 'Посещение зафиксировано',
        });
      }
    } catch (error) {
      console.error('Error incrementing visit:', error);
    }
  };

  const togglePersonalNotes = (clientId: string) => {
    setShowPersonalNotes(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  const toggleMyNote = (clientId: string) => {
    setShowMyNote(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  // Получить уникальные города из клиентов
  const availableCities = Array.from(new Set(
    clients
      .filter(c => c.firstVisitCity)
      .map(c => c.firstVisitCity)
  )).sort();

  // Получить уникальные филиалы из клиентов (с учётом выбранного города)
  const availableBranches = Array.from(new Set(
    clients
      .filter(c => c.firstVisitBranch && (cityFilter === '__all__' || c.firstVisitCity === cityFilter))
      .map(c => c.firstVisitBranch)
  )).sort();

  const filteredClients = clients.filter((client) => {
    // Поиск по тексту
    const matchesSearch = 
      client.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.clientPhone?.includes(searchQuery) ||
      client.publicNotes.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Фильтр по городу
    const matchesCity = cityFilter === '__all__' || client.firstVisitCity === cityFilter;
    
    // Фильтр по филиалу
    const matchesBranch = branchFilter === '__all__' || client.firstVisitBranch === branchFilter;
    
    return matchesSearch && matchesCity && matchesBranch;
  });

  // Сбросить филиал при смене города
  const handleCityChange = (value: string) => {
    setCityFilter(value);
    setBranchFilter('__all__'); // Сбрасываем филиал при смене города
  };

  // Очистить все фильтры
  const clearFilters = () => {
    setCityFilter('__all__');
    setBranchFilter('__all__');
    setSearchQuery('');
  };

  const hasActiveFilters = cityFilter !== '__all__' || branchFilter !== '__all__' || searchQuery;

  const isMyClient = (client: ClientNote) => client.masterId === user?.id;

  // Получить имя мастера (или "[Удалён]" если мастер удалён)
  const getMasterName = (client: ClientNote) => {
    return client.master?.name || '[Удалён]';
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
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Постоянники</h3>
          <p className="text-slate-400 text-sm hidden sm:block">
            Общая база клиентов сети Atlas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white touch-manipulation w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить клиента
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {editingClient ? 'Редактировать' : 'Добавить клиента'}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm">
                Запишите предпочтения клиента
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Имя клиента *</Label>
                <Input
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  placeholder="Как называть клиента"
                  className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Телефон</Label>
                  <Input
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    placeholder="+7 (999)..."
                    className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Любимый микс</Label>
                  <Input
                    value={formData.favoriteMix}
                    onChange={(e) => setFormData({ ...formData, favoriteMix: e.target.value })}
                    placeholder="Название"
                    className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Город первого посещения</Label>
                  <Select
                    value={formData.firstVisitCity}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      firstVisitCity: value,
                      firstVisitBranch: '' // Сбрасываем филиал при смене города
                    })}
                  >
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 w-full">
                      <SelectValue placeholder="Выберите город" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {Object.keys(BRANCHES_BY_CITY).map((city) => (
                        <SelectItem 
                          key={city} 
                          value={city}
                          className="text-white hover:bg-slate-700 focus:bg-slate-700"
                        >
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Филиал первого посещения</Label>
                  <Select
                    value={formData.firstVisitBranch}
                    onValueChange={(value) => setFormData({ ...formData, firstVisitBranch: value })}
                    disabled={!formData.firstVisitCity}
                  >
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 w-full">
                      <SelectValue placeholder="Выберите филиал" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {formData.firstVisitCity && BRANCHES_BY_CITY[formData.firstVisitCity]?.map((branch) => (
                        <SelectItem 
                          key={branch} 
                          value={branch}
                          className="text-white hover:bg-slate-700 focus:bg-slate-700"
                        >
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Предпочтения</Label>
                <Textarea
                  value={formData.preferences}
                  onChange={(e) => setFormData({ ...formData, preferences: e.target.value })}
                  placeholder="Вкусы, крепость, чаша..."
                  className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 min-h-[60px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  Общие заметки * (видны всем)
                </Label>
                <Textarea
                  value={formData.publicNotes}
                  onChange={(e) => setFormData({ ...formData, publicNotes: e.target.value })}
                  placeholder="Информация для всех мастеров"
                  className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 min-h-[60px]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Личные заметки (только для вас)
                </Label>
                <Textarea
                  value={formData.personalNotes}
                  onChange={(e) => setFormData({ ...formData, personalNotes: e.target.value })}
                  placeholder="Ваши личные наблюдения..."
                  className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 min-h-[60px]"
                />
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-900/50 text-emerald-500 focus:ring-emerald-500 touch-manipulation"
                />
                <Label htmlFor="isPublic" className="text-slate-300 cursor-pointer text-sm flex items-center gap-2">
                  {formData.isPublic ? (
                    <Globe className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                  Показывать другим
                </Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsDialogOpen(false); resetForm(); }}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 touch-manipulation"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white touch-manipulation"
                >
                  {editingClient ? 'Сохранить' : 'Добавить'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters - Mobile Optimized */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени, телефону..."
            className="bg-slate-800/50 border-slate-700 text-white focus:border-emerald-500 pl-10 pr-10"
          />
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Filter className="w-4 h-4" />
            <span>Фильтры:</span>
          </div>
          
          {/* Город */}
          <Select value={cityFilter} onValueChange={handleCityChange}>
            <SelectTrigger className="w-[160px] h-8 bg-slate-800/50 border-slate-700 text-white text-sm">
              <SelectValue placeholder="Все города" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="__all__" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                Все города
              </SelectItem>
              {availableCities.map((city) => (
                <SelectItem 
                  key={city} 
                  value={city as string}
                  className="text-white hover:bg-slate-700 focus:bg-slate-700"
                >
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Филиал */}
          <Select value={branchFilter} onValueChange={setBranchFilter} disabled={cityFilter === '__all__' && availableBranches.length === 0}>
            <SelectTrigger className="w-[160px] h-8 bg-slate-800/50 border-slate-700 text-white text-sm">
              <SelectValue placeholder="Все филиалы" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="__all__" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                Все филиалы
              </SelectItem>
              {availableBranches.map((branch) => (
                <SelectItem 
                  key={branch} 
                  value={branch as string}
                  className="text-white hover:bg-slate-700 focus:bg-slate-700"
                >
                  {branch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Активные фильтры */}
          {hasActiveFilters && (
            <Badge 
              variant="outline" 
              className="h-8 px-2 border-emerald-500/50 text-emerald-400 cursor-pointer hover:bg-emerald-500/10"
              onClick={clearFilters}
            >
              Сбросить всё
              <X className="w-3 h-3 ml-1" />
            </Badge>
          )}
        </div>
      </div>

      {/* Clients grid - Mobile Optimized */}
      {filteredClients.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6 lg:p-8 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {searchQuery ? 'Клиенты не найдены' : 'Пока нет записей о клиентах'}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              Добавьте первого постоянного клиента
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className={`bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-colors ${
                !isMyClient(client) ? 'border-emerald-500/30' : ''
              }`}
            >
              <CardHeader className="pb-2 p-3 lg:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-white text-base lg:text-lg flex items-center gap-2 truncate">
                      {client.clientName}
                      {!client.isPublic && isMyClient(client) && (
                        <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      )}
                      {!isMyClient(client) && (
                        <Globe className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        {client.visitCount} посещений
                      </Badge>
                      {!isMyClient(client) && client.masterId && (
                        <span className="text-[10px] sm:text-xs text-slate-500">
                          от {getMasterName(client)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isMyClient(client) && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(client)}
                        className="text-slate-400 hover:text-emerald-500 h-8 w-8 p-0 touch-manipulation"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(client.id)}
                        className="text-slate-400 hover:text-red-400 h-8 w-8 p-0 touch-manipulation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-3 lg:p-4 pt-0">
                {client.clientPhone && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{client.clientPhone}</span>
                  </div>
                )}

                {client.favoriteMix && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Heart className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    <span className="text-white truncate">{client.favoriteMix}</span>
                  </div>
                )}

                {(client.firstVisitCity || client.firstVisitBranch) && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">
                      {[client.firstVisitCity, client.firstVisitBranch].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}

                {client.preferences && (
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5">Предпочтения:</p>
                    <p className="text-xs sm:text-sm text-slate-300 line-clamp-2">{client.preferences}</p>
                  </div>
                )}

                <div>
                  <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-emerald-400" />
                    Общие заметки:
                  </p>
                  <p className="text-xs sm:text-sm text-slate-300 line-clamp-2">{client.publicNotes}</p>
                </div>

                {/* Личные заметки автора (только для автора) */}
                {isMyClient(client) && client.personalNotes && (
                  <div>
                    <button
                      onClick={() => togglePersonalNotes(client.id)}
                      className="text-[10px] sm:text-xs text-emerald-400 flex items-center gap-1 hover:text-sky-300 touch-manipulation"
                    >
                      <Lock className="w-3 h-3" />
                      Ваши личные заметки
                      {showPersonalNotes[client.id] ? (
                        <EyeOff className="w-3 h-3 ml-1" />
                      ) : (
                        <Eye className="w-3 h-3 ml-1" />
                      )}
                    </button>
                    {showPersonalNotes[client.id] && (
                      <p className="text-xs text-sky-300/80 bg-emerald-500/10 p-2 rounded mt-1">
                        {client.personalNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Мои личные заметки о клиенте (для чужих клиентов) */}
                {!isMyClient(client) && (
                  <div className="space-y-1.5">
                    {client.myNote ? (
                      <div>
                        <button
                          onClick={() => toggleMyNote(client.id)}
                          className="text-[10px] sm:text-xs text-purple-400 flex items-center gap-1 hover:text-purple-300 touch-manipulation"
                        >
                          <StickyNote className="w-3 h-3" />
                          Ваши заметки об этом клиенте
                          {showMyNote[client.id] ? (
                            <EyeOff className="w-3 h-3 ml-1" />
                          ) : (
                            <Eye className="w-3 h-3 ml-1" />
                          )}
                        </button>
                        {showMyNote[client.id] && (
                          <div className="flex items-start justify-between gap-2 mt-1">
                            <p className="text-xs text-purple-300/80 bg-purple-500/10 p-2 rounded flex-1">
                              {client.myNote.notes}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openNoteDialog(client)}
                              className="text-purple-400 hover:text-purple-300 h-6 w-6 p-0 touch-manipulation flex-shrink-0"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openNoteDialog(client)}
                        className="text-[10px] sm:text-xs border-purple-500/50 text-purple-400 hover:bg-purple-500/10 h-7 w-full touch-manipulation"
                      >
                        <StickyNote className="w-3 h-3 mr-1" />
                        Добавить свои заметки
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-400">
                    {client.lastVisit && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(client.lastVisit).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                  </div>
                  {isMyClient(client) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => incrementVisit(client)}
                      className="text-[10px] sm:text-xs border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 h-7 touch-manipulation"
                    >
                      + Посещение
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog for my note */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-purple-400" />
              Ваши заметки о клиенте
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              {noteClient?.clientName} — эти заметки видны только вам
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Textarea
              value={myNoteText}
              onChange={(e) => setMyNoteText(e.target.value)}
              placeholder="Ваши личные наблюдения о клиенте..."
              className="bg-slate-900/50 border-slate-600 text-white focus:border-purple-500 min-h-[120px]"
            />
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsNoteDialogOpen(false); setNoteClient(null); }}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 touch-manipulation"
              >
                Отмена
              </Button>
              <Button
                onClick={handleSaveMyNote}
                className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white touch-manipulation"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile FAB */}
      <div className="fixed bottom-20 right-4 lg:hidden z-30">
        <Button
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/30 touch-manipulation active:scale-95"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
