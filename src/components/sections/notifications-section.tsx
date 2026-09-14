'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Notification } from '@/types';
import { Bell, Check, BellOff, MessageCircle, ChefHat, Megaphone, Clock, User, Shield } from 'lucide-react';

export function NotificationsSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { unreadCount, setUnreadCount, decrementUnreadCount, refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    
    const fetchNotifications = async () => {
      if (!user) return;

      try {
        const response = await fetch(`/api/notifications?userId=${user.id}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!controller.signal.aborted) {
          setNotifications(data.notifications || []);
          // Используем refreshUnreadCount из контекста для синхронизации
          refreshUnreadCount();
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching notifications:', error);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchNotifications();
    // Обновляем каждые 30 секунд
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [user, refreshUnreadCount]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, userId: user.id }),
      });

      setNotifications(notifications.map((n) =>
        n.id === notificationId ? { ...n, isReadForUser: true } : n
      ));
      // Используем decrementUnreadCount из контекста
      decrementUnreadCount();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      setNotifications(notifications.map((n) => ({ ...n, isReadForUser: true })));
      // Используем setUnreadCount из контекста
      setUnreadCount(0);
      toast({
        title: 'Все уведомления прочитаны',
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'RECIPE_ADDED':
        return <ChefHat className="w-5 h-5 text-emerald-400" />;
      case 'RECIPE_UPDATED':
        return <ChefHat className="w-5 h-5 text-sky-400" />;
      case 'RECIPE_DELETED':
        return <ChefHat className="w-5 h-5 text-red-400" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-5 h-5 text-indigo-400" />;
      case 'MESSAGE':
        return <MessageCircle className="w-5 h-5 text-emerald-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'RECIPE_ADDED':
        return 'border-emerald-500/30 bg-emerald-500/10';
      case 'RECIPE_UPDATED':
        return 'border-sky-500/30 bg-sky-500/10';
      case 'RECIPE_DELETED':
        return 'border-red-500/30 bg-red-500/10';
      case 'ANNOUNCEMENT':
        return 'border-indigo-500/30 bg-indigo-500/10';
      case 'MESSAGE':
        return 'border-emerald-500/30 bg-emerald-500/10';
      default:
        return 'border-slate-500/30 bg-slate-500/10';
    }
  };

  const formatTime = (date: string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diff = now.getTime() - notificationDate.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;
    return notificationDate.toLocaleDateString('ru-RU');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-500" />
            Уведомления
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white ml-2">
                {unreadCount}
              </Badge>
            )}
          </h3>
          <p className="text-slate-400 text-sm">
            Системные сообщения и обновления
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Прочитать все
          </Button>
        )}
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 text-center">
            <BellOff className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Нет уведомлений</p>
            <p className="text-slate-500 text-sm mt-1">
              Здесь будут появляться сообщения от руководства
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)] pr-4">
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`bg-slate-800/50 border-slate-700 hover:border-emerald-500/30 transition-all cursor-pointer ${
                  !notification.isReadForUser ? 'ring-1 ring-cyan-500/30' : ''
                } ${getNotificationColor(notification.type)}`}
                onClick={() => {
                  if (!notification.isReadForUser) {
                    markAsRead(notification.id);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      notification.type === 'ANNOUNCEMENT' ? 'bg-indigo-500/20' :
                      notification.type === 'MESSAGE' ? 'bg-emerald-500/20' :
                      notification.type?.includes('RECIPE') ? 'bg-emerald-500/20' :
                      'bg-slate-500/20'
                    }`}>
                        {getNotificationIcon(notification.type)}
                      </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-white flex items-center gap-2">
                            {notification.title}
                            {!notification.isReadForUser && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            )}
                          </h4>
                          {notification.recipientId === null ? (
                            <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 mt-1">
                              Всем
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400 mt-1">
                              Лично
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>

                      <p className="text-slate-300 text-sm mt-2 whitespace-pre-wrap">
                        {notification.content}
                      </p>

                      {/* Author */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700">
                        <Avatar className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-violet-600">
                          <AvatarFallback className="text-xs text-white">
                            {notification.author ? getInitials(notification.author.name) : 'С'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          {notification.author?.role === 'MANAGER' ? (
                            <>
                              <Shield className="w-3 h-3 text-indigo-400" />
                              {notification.author?.name || 'Система'}
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3" />
                              {notification.author?.name || 'Система'}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
