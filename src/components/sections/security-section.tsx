'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  RefreshCw,
  Trash2,
  Download,
  Lock,
  Activity,
} from 'lucide-react';

interface BackupInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  type: 'manual' | 'daily' | 'weekly';
}

interface SecurityStats {
  security: {
    totalEvents: number;
    failedLogins: number;
    blockedAttempts: number;
    criticalEvents: number;
  };
  backups: {
    count: number;
    totalSize: number;
    totalSizeFormatted: string;
    oldestDate: string | null;
    newestDate: string | null;
    byType: Record<string, number>;
  };
}

interface SecurityLog {
  timestamp: string;
  type: string;
  userId?: string;
  userEmail?: string;
  ip: string;
  details: Record<string, unknown>;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}

export function SecuritySection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'backups' | 'logs'>('overview');

  useEffect(() => {
    if (user?.role === 'MANAGER') {
      const controller = new AbortController();
      fetchStats(controller.signal);
      return () => controller.abort();
    }
  }, [user]);

  const fetchStats = async (signal?: AbortSignal) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/security?userId=${user.id}&action=stats`, { signal });
      const data = await response.json();
      if (!signal?.aborted) {
        setStats(data);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchBackups = async (signal?: AbortSignal) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/security?userId=${user.id}&action=backups`, { signal });
      const data = await response.json();
      if (!signal?.aborted) {
        setBackups(data.backups || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch backups:', error);
    }
  };

  const fetchLogs = async (signal?: AbortSignal) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/security?userId=${user.id}&action=logs`, { signal });
      const data = await response.json();
      if (!signal?.aborted) {
        setLogs(data.logs || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch logs:', error);
    }
  };

  const handleCreateBackup = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          action: 'backup',
          description: 'Ручное создание бэкапа',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Бэкап создан',
          description: data.message,
        });
        fetchBackups();
        fetchStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка создания бэкапа',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!user || !confirm(`Восстановить базу данных из ${filename}?`)) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          action: 'restore',
          filename,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Восстановлено',
          description: data.message,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка восстановления',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!user || !confirm(`Удалить бэкап ${filename}?`)) return;

    try {
      const response = await fetch(
        `/api/security?userId=${user.id}&filename=${filename}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Удалено',
          description: 'Бэкап удалён',
        });
        fetchBackups();
        fetchStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка удаления',
        variant: 'destructive',
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'ERROR':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'WARNING':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ru-RU');
  };

  if (user?.role !== 'MANAGER') {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <Lock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Доступ только для руководителей</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            Центр безопасности
          </h3>
          <p className="text-slate-400 text-sm">
            Управление бэкапами и мониторинг безопасности
          </p>
        </div>
        <Button
          onClick={() => {
            fetchStats();
            fetchBackups();
            fetchLogs();
          }}
          variant="outline"
          className="border-slate-600 text-slate-300"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Обновить
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'overview', label: 'Обзор', icon: Activity },
          { id: 'backups', label: 'Бэкапы', icon: Database },
          { id: 'logs', label: 'Логи', icon: FileText },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'outline'}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'backups') fetchBackups();
              if (tab.id === 'logs') fetchLogs();
            }}
            className={activeTab === tab.id
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'border-slate-600 text-slate-300'
            }
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                События за неделю
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{stats.security.totalEvents}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                Неудачные входы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-400">{stats.security.failedLogins}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-500" />
                Заблокированные попытки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-400">{stats.security.blockedAttempts}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                Бэкапы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{stats.backups.count}</p>
              <p className="text-xs text-slate-500">{stats.backups.totalSizeFormatted}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Backups Tab */}
      {activeTab === 'backups' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-white font-medium">Резервные копии</h4>
              <p className="text-sm text-slate-400">
                {backups.length} бэкапов • {stats?.backups.totalSizeFormatted}
              </p>
            </div>
            <Button
              onClick={handleCreateBackup}
              disabled={isLoading}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
            >
              <Database className="w-4 h-4 mr-2" />
              Создать бэкап
            </Button>
          </div>

          {backups.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-8 text-center">
                <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Нет резервных копий</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <Card key={backup.filename} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Database className="w-8 h-8 text-emerald-500" />
                      <div>
                        <p className="text-white font-medium">{backup.filename}</p>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(backup.createdAt)}
                          </span>
                          <span>{backup.sizeFormatted}</span>
                          <Badge variant="outline" className="text-xs">
                            {backup.type === 'manual' ? 'Ручной' :
                             backup.type === 'daily' ? 'Ежедневный' : 'Еженедельный'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreBackup(backup.filename)}
                        disabled={isLoading}
                        className="border-emerald-600 text-emerald-400 hover:bg-emerald-500/20"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBackup(backup.filename)}
                        className="border-red-600 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <h4 className="text-white font-medium">Журнал безопасности</h4>

          {logs.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Нет записей в журнале</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log, index) => (
                <Card key={index} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getSeverityColor(log.severity)}>
                          {log.severity}
                        </Badge>
                        <div>
                          <p className="text-white font-medium">{log.type}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>{formatDate(log.timestamp)}</span>
                            <span>IP: {log.ip}</span>
                            {log.userEmail && <span>{log.userEmail}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    {Object.keys(log.details).length > 0 && (
                      <pre className="mt-2 text-xs text-slate-500 bg-slate-900/50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
