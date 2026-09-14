// API для управления безопасностью (только для руководителей)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  getBackupStats,
  formatFileSize,
} from '@/lib/backup';
import { getSecurityLogs, getSecurityStats, type SecurityEventType, type SecurityLogEntry } from '@/lib/security-logger';
import { getOrCreateCsrfToken } from '@/lib/csrf';
import { validateLimit } from '@/lib/validation';

// Получение информации о безопасности
export async function GET(request: NextRequest) {
  try {
    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'logs', 'stats', 'backups', 'csrf'

    switch (action) {
      case 'logs': {
        const date = searchParams.get('date') || undefined;
        const type = searchParams.get('type') as SecurityEventType | undefined;
        const severity = searchParams.get('severity') as SecurityLogEntry['severity'] | undefined;
        const limit = validateLimit(searchParams.get('limit'), 100, 500);

        const logs = await getSecurityLogs({ date, type, severity, limit });
        return NextResponse.json({ logs });
      }

      case 'stats': {
        const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : 7;
        const securityStats = await getSecurityStats(days);
        const backupStats = await getBackupStats();

        return NextResponse.json({
          security: securityStats,
          backups: {
            ...backupStats,
            totalSizeFormatted: formatFileSize(backupStats.totalSize),
          },
        });
      }

      case 'backups': {
        const backups = await listBackups();
        const stats = await getBackupStats();

        return NextResponse.json({
          backups: backups.map(b => ({
            ...b,
            sizeFormatted: formatFileSize(b.size),
          })),
          stats: {
            ...stats,
            totalSizeFormatted: formatFileSize(stats.totalSize),
          },
        });
      }

      case 'csrf': {
        const token = getOrCreateCsrfToken(actor.id);
        return NextResponse.json({ csrfToken: token });
      }

      default:
        return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
    }
  } catch (error) {
    console.error('Security API error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// Создание бэкапа
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }

    const { action, description } = body || {};

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    if (action === 'backup') {
      const result = await createBackup('manual', description);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: `Бэкап создан: ${result.filename}`,
          filename: result.filename,
        });
      }

      return NextResponse.json(
        { error: result.error || 'Ошибка создания бэкапа' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error) {
    console.error('Security API error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// Восстановление из бэкапа
export async function PUT(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }

    const { action, filename } = body || {};

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    if (action === 'restore') {
      if (!filename) {
        return NextResponse.json({ error: 'Укажите файл бэкапа' }, { status: 400 });
      }

      const result = await restoreBackup(filename);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: `База данных восстановлена из: ${filename}`,
        });
      }

      return NextResponse.json(
        { error: result.error || 'Ошибка восстановления' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error) {
    console.error('Security API error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// Удаление бэкапа
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    if (!filename) {
      return NextResponse.json({ error: 'Укажите файл бэкапа' }, { status: 400 });
    }

    const result = await deleteBackup(filename);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Бэкап удалён' });
    }

    return NextResponse.json(
      { error: result.error || 'Ошибка удаления' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Security API error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
