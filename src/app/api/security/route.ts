// API для управления безопасностью (только для руководителей)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  getBackupStats,
  formatFileSize,
} from '@/lib/backup';
import { getSecurityLogs, getSecurityStats } from '@/lib/security-logger';
import { getOrCreateCsrfToken } from '@/lib/csrf';

// Получение информации о безопасности
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action'); // 'logs', 'stats', 'backups', 'csrf'

    if (!userId) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    const user = await db.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user || user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    switch (action) {
      case 'logs': {
        const date = searchParams.get('date') || undefined;
        const type = searchParams.get('type') as string | undefined;
        const severity = searchParams.get('severity') as string | undefined;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;

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
        const token = getOrCreateCsrfToken(userId);
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
    const body = await request.json();
    const { userId, action, description } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    const user = await db.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user || user.role !== 'MANAGER') {
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
    const body = await request.json();
    const { userId, action, filename } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    const user = await db.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user || user.role !== 'MANAGER') {
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
    const userId = searchParams.get('userId');
    const filename = searchParams.get('filename');

    if (!userId) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    const user = await db.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user || user.role !== 'MANAGER') {
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
