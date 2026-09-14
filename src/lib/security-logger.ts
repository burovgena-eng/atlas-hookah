// Система логирования безопасности и suspicious-активности

import { writeFile, mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Типы событий
export type SecurityEventType =
  // Аутентификация
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_BLOCKED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'PASSWORD_CHANGE'
  // Подозрительная активность
  | 'RATE_LIMIT_EXCEEDED'
  | 'CSRF_FAILURE'
  | 'SUSPICIOUS_REQUEST'
  | 'UNAUTHORIZED_ACCESS'
  // Действия с данными
  | 'USER_CREATED'
  | 'USER_DELETED'
  | 'USER_APPROVED'
  | 'ROLE_CHANGED'
  | 'FILE_UPLOADED'
  // Изменения контента
  | 'MIX_CREATED'
  | 'MIX_DELETED'
  | 'RECIPE_CREATED'
  | 'RECIPE_DELETED'
  | 'NOTIFICATION_SENT'
  // Системные
  | 'ERROR'
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED';

export interface SecurityLogEntry {
  timestamp: string;
  type: SecurityEventType;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ip: string;
  userAgent?: string;
  details: Record<string, unknown>;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}

// Убедиться что директория существует
async function ensureLogDir() {
  const logDir = path.join(process.cwd(), 'logs');
  if (!existsSync(logDir)) {
    await mkdir(logDir, { recursive: true });
  }
  return logDir;
}

// Получить имя файла лога по дате
function getLogFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `security-${year}-${month}-${day}.log`;
}

/**
 * Запись события безопасности в лог
 */
export async function logSecurityEvent(
  type: SecurityEventType,
  options: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    ip: string;
    userAgent?: string;
    details?: Record<string, unknown>;
    severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  }
): Promise<void> {
  const entry: SecurityLogEntry = {
    timestamp: new Date().toISOString(),
    type,
    userId: options.userId,
    userEmail: options.userEmail,
    userRole: options.userRole,
    ip: options.ip,
    userAgent: options.userAgent,
    details: options.details || {},
    severity: options.severity || getDefaultSeverity(type),
  };

  // Определяем severity автоматически если не указан
  if (!options.severity) {
    entry.severity = getDefaultSeverity(type);
  }

  try {
    const logDir = await ensureLogDir();
    const logFile = path.join(logDir, getLogFileName());
    const logLine = JSON.stringify(entry) + '\n';

    await appendFile(logFile, logLine, 'utf-8');

    // Также выводим в консоль для критических событий
    if (entry.severity === 'CRITICAL' || entry.severity === 'ERROR') {
      console.error('[SECURITY]', entry);
    } else if (entry.severity === 'WARNING') {
      console.warn('[SECURITY]', entry);
    }
  } catch (error) {
    console.error('Failed to write security log:', error);
  }
}

/**
 * Определение severity по типу события
 */
function getDefaultSeverity(type: SecurityEventType): SecurityLogEntry['severity'] {
  const criticalEvents: SecurityEventType[] = [
    'CSRF_FAILURE',
    'UNAUTHORIZED_ACCESS',
    'USER_DELETED',
    'ROLE_CHANGED',
  ];

  const errorEvents: SecurityEventType[] = [
    'LOGIN_BLOCKED',
    'RATE_LIMIT_EXCEEDED',
    'SUSPICIOUS_REQUEST',
    'ERROR',
  ];

  const warningEvents: SecurityEventType[] = [
    'LOGIN_FAILED',
  ];

  if (criticalEvents.includes(type)) return 'CRITICAL';
  if (errorEvents.includes(type)) return 'ERROR';
  if (warningEvents.includes(type)) return 'WARNING';
  return 'INFO';
}

/**
 * Получение логов за период
 */
export async function getSecurityLogs(
  options: {
    date?: string; // YYYY-MM-DD
    type?: SecurityEventType;
    userId?: string;
    severity?: SecurityLogEntry['severity'];
    limit?: number;
  } = {}
): Promise<SecurityLogEntry[]> {
  try {
    const logDir = await ensureLogDir();
    const fileName = options.date
      ? `security-${options.date}.log`
      : getLogFileName();
    const logFile = path.join(logDir, fileName);

    if (!existsSync(logFile)) {
      return [];
    }

    const { readFile } = await import('fs/promises');
    const content = await readFile(logFile, 'utf-8');
    const lines = content.trim().split('\n');

    let entries = lines
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as SecurityLogEntry);

    // Фильтрация
    if (options.type) {
      entries = entries.filter(e => e.type === options.type);
    }
    if (options.userId) {
      entries = entries.filter(e => e.userId === options.userId);
    }
    if (options.severity) {
      entries = entries.filter(e => e.severity === options.severity);
    }

    // Сортировка по времени (новые первые)
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Ограничение количества
    if (options.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  } catch (error) {
    console.error('Failed to read security logs:', error);
    return [];
  }
}

/**
 * Получение статистики безопасности
 */
export async function getSecurityStats(
  days: number = 7
): Promise<{
  totalEvents: number;
  failedLogins: number;
  blockedAttempts: number;
  criticalEvents: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}> {
  const stats = {
    totalEvents: 0,
    failedLogins: 0,
    blockedAttempts: 0,
    criticalEvents: 0,
    bySeverity: {} as Record<string, number>,
    byType: {} as Record<string, number>,
  };

  try {
    const logDir = await ensureLogDir();

    // Читаем логи за последние N дней
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const fileName = `security-${date.toISOString().split('T')[0]}.log`;
      const logFile = path.join(logDir, fileName);

      if (!existsSync(logFile)) continue;

      const { readFile } = await import('fs/promises');
      const content = await readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines.filter(l => l.trim())) {
        try {
          const entry = JSON.parse(line) as SecurityLogEntry;
          stats.totalEvents++;

          if (entry.type === 'LOGIN_FAILED') stats.failedLogins++;
          if (entry.type === 'LOGIN_BLOCKED' || entry.type === 'RATE_LIMIT_EXCEEDED') {
            stats.blockedAttempts++;
          }
          if (entry.severity === 'CRITICAL') stats.criticalEvents++;

          stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] || 0) + 1;
          stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
        } catch {
          // Пропускаем битые строки
        }
      }
    }
  } catch (error) {
    console.error('Failed to get security stats:', error);
  }

  return stats;
}
