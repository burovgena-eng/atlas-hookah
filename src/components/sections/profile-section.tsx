'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, Calendar, Shield, Save, Send, Users, UserPlus, Megaphone, MessageCircle, Star, ImagePlus, X, MapPin } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

const cityOptions = [
  { value: 'none', label: 'Не выбран' },
  { value: 'novosibirsk', label: 'Новосибирск' },
  { value: 'krasnoyarsk', label: 'Красноярск' },
];

// Филиалы по городам
const branchesByCity: Record<string, { value: string; label: string }[]> = {
  novosibirsk: [
    { value: 'narymskaya', label: 'Нарымская' },
    { value: 'nemirovicha', label: 'Немировича' },
  ],
  krasnoyarsk: [
    { value: 'lomako', label: 'Ломако' },
    { value: 'karamzina', label: 'Карамзина' },
    { value: 'alekseeva', label: 'Алексеева' },
    { value: 'kapitanskaya', label: 'Капитанская' },
    { value: 'molokova', label: 'Молокова' },
  ],
};

export function ProfileSection() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    city: user?.city || 'none',
    branch: user?.branch || 'none',
    avatar: user?.avatar || '',
    birthDate: user?.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '',
  });

  // Раздельные формы для объявления и личного сообщения
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
  });

  const [personalMessageForm, setPersonalMessageForm] = useState({
    title: '',
    content: '',
    recipientId: '',
  });

  // Форма для рассылки по городу/филиалу
  const [locationMessageForm, setLocationMessageForm] = useState({
    title: '',
    content: '',
    city: '',
    branch: '',
  });

  const isManager = user?.role === 'MANAGER';
  const isSeniorMaster = user?.role === 'SENIOR_MASTER';

  useEffect(() => {
    if (isManager) {
      const controller = new AbortController();
      fetchStaffMembers(controller.signal);
      return () => controller.abort();
    }
  }, [isManager, user?.id]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        bio: user.bio || '',
        city: user.city || 'none',
        branch: user.branch || 'none',
        avatar: user.avatar || '',
        birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '',
      });
    }
  }, [user]);

  const fetchStaffMembers = async (signal?: AbortSignal) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/users?userId=${user.id}`, { signal });
      const data = await response.json();
      if (!signal?.aborted) {
        setStaffMembers(data.users || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching staff:', error);
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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'MANAGER':
        return 'Руководитель';
      case 'SENIOR_MASTER':
        return 'Старший мастер';
      default:
        return 'Мастер';
    }
  };

  const getRoleIcon = () => {
    if (isManager) return <Shield className="w-4 h-4 text-indigo-400" />;
    if (isSeniorMaster) return <Star className="w-4 h-4 text-amber-400" />;
    return <User className="w-4 h-4" />;
  };

  const getRoleText = () => {
    if (isManager) return <span className="text-indigo-400">Руководитель</span>;
    if (isSeniorMaster) return <span className="text-amber-400">Старший кальянный мастер</span>;
    return <span>Кальянный мастер</span>;
  };

  // Загрузка аватара
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('type', 'avatar');
      uploadFormData.append('userId', user.id);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setFormData({ ...formData, avatar: data.url });
      toast({
        title: 'Аватар загружен',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при загрузке аватара',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          userId: user.id,
          name: formData.name,
          phone: formData.phone,
          bio: formData.bio,
          city: formData.city === 'none' ? '' : formData.city,
          branch: formData.branch === 'none' ? '' : formData.branch,
          avatar: formData.avatar,
          birthDate: formData.birthDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      updateUser(data.user);
      toast({
        title: 'Успешно',
        description: 'Профиль обновлен',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при обновлении профиля',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Отправка объявления всем (только для руководителя)
  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !announcementForm.title || !announcementForm.content) {
      toast({
        title: 'Ошибка',
        description: 'Заполните заголовок и сообщение',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: announcementForm.title,
          content: announcementForm.content,
          type: 'ANNOUNCEMENT',
          recipientId: null,
          authorId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: 'Успешно',
        description: 'Объявление отправлено всем сотрудникам',
      });

      setAnnouncementForm({ title: '', content: '' });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при отправке',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Отправка личного сообщения (только для руководителя)
  const handleSendPersonalMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !personalMessageForm.title || !personalMessageForm.content || !personalMessageForm.recipientId) {
      toast({
        title: 'Ошибка',
        description: 'Выберите получателя и заполните все поля',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: personalMessageForm.title,
          content: personalMessageForm.content,
          type: 'MESSAGE',
          recipientId: personalMessageForm.recipientId,
          authorId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: 'Успешно',
        description: 'Сообщение отправлено',
      });

      setPersonalMessageForm({ title: '', content: '', recipientId: '' });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при отправке',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Отправка сообщения по городу/филиалу (только для руководителя)
  const handleSendLocationMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !locationMessageForm.title || !locationMessageForm.content || !locationMessageForm.city) {
      toast({
        title: 'Ошибка',
        description: 'Выберите город и заполните все поля',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: locationMessageForm.title,
          content: locationMessageForm.content,
          type: 'ANNOUNCEMENT',
          city: locationMessageForm.city,
          branch: locationMessageForm.branch || null, // null = весь город
          authorId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      const cityName = cityOptions.find(c => c.value === locationMessageForm.city)?.label || locationMessageForm.city;
      const branchName = locationMessageForm.branch 
        ? branchesByCity[locationMessageForm.city]?.find(b => b.value === locationMessageForm.branch)?.label 
        : null;

      toast({
        title: 'Успешно',
        description: branchName 
          ? `Сообщение отправлено сотрудникам филиала ${branchName}`
          : `Сообщение отправлено сотрудникам города ${cityName}`,
      });

      setLocationMessageForm({ title: '', content: '', city: '', branch: '' });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при отправке',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile header */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600">
              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white text-2xl font-bold">
                {user ? getInitials(user.name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold text-white">{user?.name}</h2>
              <p className="text-slate-400 flex items-center gap-2 mt-1">
                {getRoleIcon()}
                {getRoleText()}
              </p>
              <p className="text-slate-500 text-sm mt-2 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Зарегистрирован: {user ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Manager */}
      {isManager ? (
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="bg-slate-800/50 border border-slate-700 w-full grid grid-cols-2">
            <TabsTrigger
              value="profile"
              className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-900"
            >
              <User className="w-4 h-4 mr-2" />
              Профиль
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-900"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Сообщения
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <ProfileForm
              user={user}
              formData={formData}
              setFormData={setFormData}
              isLoading={isLoading}
              handleSubmit={handleSubmit}
              handleAvatarUpload={handleAvatarUpload}
              isUploading={isUploading}
            />
          </TabsContent>

          <TabsContent value="messages" className="mt-6 space-y-6">
            {/* Отправить всем */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-indigo-400" />
                  Объявление для всех
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Отправьте сообщение всем сотрудникам одновременно
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendAnnouncement} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Заголовок</Label>
                    <Input
                      value={announcementForm.title}
                      onChange={(e) =>
                        setAnnouncementForm({ ...announcementForm, title: e.target.value })
                      }
                      placeholder="Заголовок объявления"
                      className="bg-slate-900/50 border-slate-600 text-white focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Сообщение</Label>
                    <Textarea
                      value={announcementForm.content}
                      onChange={(e) =>
                        setAnnouncementForm({ ...announcementForm, content: e.target.value })
                      }
                      placeholder="Текст объявления для всех сотрудников..."
                      className="bg-slate-900/50 border-slate-600 text-white focus:border-purple-500 min-h-[120px]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading || !announcementForm.title || !announcementForm.content}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Отправить всем
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Отправить лично */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                  Личное сообщение
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Отправьте сообщение конкретному сотруднику
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendPersonalMessage} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Выберите сотрудника</Label>
                    <Select
                      value={personalMessageForm.recipientId}
                      onValueChange={(value) =>
                        setPersonalMessageForm({ ...personalMessageForm, recipientId: value })
                      }
                    >
                      <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                        <SelectValue placeholder="Выберите получателя" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {staffMembers
                          .filter((s) => s.id !== user?.id)
                          .map((staff) => (
                            <SelectItem
                              key={staff.id}
                              value={staff.id}
                              className="text-white focus:bg-slate-700"
                            >
                              {staff.name} ({getRoleLabel(staff.role)})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Заголовок</Label>
                    <Input
                      value={personalMessageForm.title}
                      onChange={(e) =>
                        setPersonalMessageForm({ ...personalMessageForm, title: e.target.value })
                      }
                      placeholder="Заголовок сообщения"
                      className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Сообщение</Label>
                    <Textarea
                      value={personalMessageForm.content}
                      onChange={(e) =>
                        setPersonalMessageForm({ ...personalMessageForm, content: e.target.value })
                      }
                      placeholder="Текст личного сообщения..."
                      className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 min-h-[120px]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading || !personalMessageForm.recipientId || !personalMessageForm.title || !personalMessageForm.content}
                    className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Отправить
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Отправить по городу/филиалу */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-400" />
                  Сообщение по локации
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Отправьте сообщение сотрудникам города или конкретного филиала
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendLocationMessage} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Город *</Label>
                      <Select
                        value={locationMessageForm.city}
                        onValueChange={(value) => setLocationMessageForm({ ...locationMessageForm, city: value, branch: '' })}
                      >
                        <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                          <SelectValue placeholder="Выберите город" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {cityOptions.filter(c => c.value !== 'none').map((city) => (
                            <SelectItem
                              key={city.value}
                              value={city.value}
                              className="text-white focus:bg-slate-700"
                            >
                              {city.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Филиал (необязательно)</Label>
                      <Select
                        value={locationMessageForm.branch}
                        onValueChange={(value) => setLocationMessageForm({ ...locationMessageForm, branch: value })}
                        disabled={!locationMessageForm.city}
                      >
                        <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white disabled:opacity-50">
                          <SelectValue placeholder={locationMessageForm.city ? "Все филиалы города" : "Сначала выберите город"} />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {locationMessageForm.city && branchesByCity[locationMessageForm.city]?.map((branch) => (
                            <SelectItem
                              key={branch.value}
                              value={branch.value}
                              className="text-white focus:bg-slate-700"
                            >
                              {branch.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        {locationMessageForm.branch 
                          ? 'Отправится сотрудникам выбранного филиала' 
                          : locationMessageForm.city 
                            ? 'Оставьте пустым для отправки всем сотрудникам города' 
                            : ''}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Заголовок</Label>
                    <Input
                      value={locationMessageForm.title}
                      onChange={(e) => setLocationMessageForm({ ...locationMessageForm, title: e.target.value })}
                      placeholder="Заголовок сообщения"
                      className="bg-slate-900/50 border-slate-600 text-white focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Сообщение</Label>
                    <Textarea
                      value={locationMessageForm.content}
                      onChange={(e) => setLocationMessageForm({ ...locationMessageForm, content: e.target.value })}
                      placeholder="Текст сообщения..."
                      className="bg-slate-900/50 border-slate-600 text-white focus:border-amber-500 min-h-[120px]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading || !locationMessageForm.city || !locationMessageForm.title || !locationMessageForm.content}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    {locationMessageForm.branch ? 'Отправить по филиалу' : 'Отправить по городу'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <ProfileForm
          user={user}
          formData={formData}
          setFormData={setFormData}
          isLoading={isLoading}
          handleSubmit={handleSubmit}
          handleAvatarUpload={handleAvatarUpload}
          isUploading={isUploading}
        />
      )}
    </div>
  );
}

// Отдельный компонент для формы профиля
function ProfileForm({
  user,
  formData,
  setFormData,
  isLoading,
  handleSubmit,
  handleAvatarUpload,
  isUploading,
}: {
  user: any;
  formData: { name: string; phone: string; bio: string; city: string; branch: string; avatar: string; birthDate: string };
  setFormData: (data: any) => void;
  isLoading: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
}) {
  // Получаем филиалы для выбранного города
  const availableBranches = formData.city && formData.city !== 'none' 
    ? branchesByCity[formData.city] || [] 
    : [];

  // Сбрасываем филиал при смене города
  const handleCityChange = (value: string) => {
    setFormData({ 
      ...formData, 
      city: value, 
      branch: 'none' 
    });
  };
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Редактировать профиль</CardTitle>
        <CardDescription className="text-slate-400">
          Обновите информацию о себе
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Аватар */}
          <div className="space-y-2">
            <Label className="text-slate-300">Фото профиля</Label>
            <div className="flex items-center gap-4">
              {formData.avatar ? (
                <div className="relative">
                  <img
                    src={formData.avatar}
                    alt="Avatar"
                    className="w-24 h-24 object-cover rounded-full border-2 border-emerald-500 overflow-hidden"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, avatar: '' })}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-slate-600 rounded-full cursor-pointer hover:border-emerald-500 transition-colors">
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ImagePlus className="w-8 h-8 text-slate-400" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              )}
              <div className="text-sm text-slate-400">
                <p>Нажмите для загрузки фото</p>
                <p className="text-xs text-slate-500">JPG, PNG, GIF, WebP. Макс 5MB</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4" />
              Имя
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <Input
              id="email"
              value={user?.email || ''}
              disabled
              className="bg-slate-900/30 border-slate-700 text-slate-400"
            />
            <p className="text-xs text-slate-500">Email нельзя изменить</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Телефон
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+7 (999) 123-45-67"
                className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate" className="text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Дата рождения
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-slate-300 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Город
              </Label>
              <Select
                value={formData.city}
                onValueChange={handleCityChange}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Выберите город" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {cityOptions.map((city) => (
                    <SelectItem
                      key={city.value}
                      value={city.value}
                      className="text-white focus:bg-slate-700"
                    >
                      {city.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch" className="text-slate-300 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Филиал
              </Label>
              <Select
                value={formData.branch}
                onValueChange={(value) => setFormData({ ...formData, branch: value })}
                disabled={!formData.city || formData.city === 'none'}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white disabled:opacity-50">
                  <SelectValue placeholder={formData.city && formData.city !== 'none' ? "Выберите филиал" : "Сначала выберите город"} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem
                    value="none"
                    className="text-white focus:bg-slate-700"
                  >
                    Не выбран
                  </SelectItem>
                  {availableBranches.map((branch) => (
                    <SelectItem
                      key={branch.value}
                      value={branch.value}
                      className="text-white focus:bg-slate-700"
                    >
                      {branch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio" className="text-slate-300">
              О себе
            </Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Расскажите о себе, своем опыте работы..."
              className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 min-h-[100px]"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
