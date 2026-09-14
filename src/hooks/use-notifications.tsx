'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';

interface NotificationsContextType {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  decrementUnreadCount: () => void;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children, userId }: { children: ReactNode; userId?: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const isMounted = useRef(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/notifications?userId=${userId}`);
      const data = await response.json();
      if (isMounted.current) {
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [userId]);

  const decrementUnreadCount = useCallback(() => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Эффект для начальной загрузки при появлении userId
  useEffect(() => {
    isMounted.current = true;
    
    if (userId) {
      // Создаём локальную асинхронную функцию внутри эффекта
      let isActive = true;
      
      const fetchInitial = async () => {
        try {
          const response = await fetch(`/api/notifications?userId=${userId}`);
          const data = await response.json();
          if (isActive && isMounted.current) {
            setUnreadCount(data.unreadCount || 0);
          }
        } catch (error) {
          console.error('Failed to fetch unread count:', error);
        }
      };
      
      fetchInitial();
      
      return () => {
        isActive = false;
      };
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [userId]);

  return (
    <NotificationsContext.Provider value={{ 
      unreadCount, 
      setUnreadCount, 
      decrementUnreadCount,
      refreshUnreadCount 
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
