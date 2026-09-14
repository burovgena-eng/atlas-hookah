// Система резервного копирования базы данных

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, readdir, stat, unlink, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Защита от path traversal: имя файла бэкапа — только безопасные символы
function isSafeBackupFilename(filename: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(filename) && !filename.includes('..');
}

// Настройки бэкапа
const BACKUP_CONFIG = {
  // Директория для бэкапов
  backupDir: path.join(process.cwd(), 'backups'),
  // Количество хранимых бэкапов
  maxBackups: 30,
  // Расписание (для cron-подобного использования)
  schedule: {
    daily: { hour: 3, minute: 0 },   // Ежедневно в 3:00
    weekly: { dayOfWeek: 0, hour: 2 }, // Воскресенье в 2:00
  },
};

// Убедиться что директория существует
async function ensureBackupDir() {
  if (!existsSync(BACKUP_CONFIG.backupDir)) {
    await mkdir(BACKUP_CONFIG.backupDir, { recursive: true });
  }
  return BACKUP_CONFIG.backupDir;
}

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
  type: 'manual' | 'daily' | 'weekly';
}

/**
 * Создание бэкапа базы данных
 */
export async function createBackup(
  type: 'manual' | 'daily' | 'weekly' = 'manual',
  description?: string
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    await ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${type}-${timestamp}.db`;
    const backupPath = path.join(BACKUP_CONFIG.backupDir, filename);

    // Путь к файлу БД (из .env или по умолчанию)
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

    if (!existsSync(dbPath)) {
      return { success: false, error: 'Файл базы данных не найден' };
    }

    // Копируем файл БД
    await copyFile(dbPath, backupPath);

    // Создаём метаданные бэкапа
    const metadataPath = backupPath + '.meta.json';
    await writeFile(
      metadataPath,
      JSON.stringify({
        type,
        description,
        createdAt: new Date().toISOString(),
        size: (await stat(backupPath)).size,
      }),
      'utf-8'
    );

    // Логируем создание бэкапа
    console.log(`[BACKUP] Created ${type} backup: ${filename}`);

    // Очищаем старые бэкапы
    await cleanOldBackups(type);

    return { success: true, filename };
  } catch (error) {
    console.error('[BACKUP] Failed to create backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Восстановление из бэкапа
 */
export async function restoreBackup(
  filename: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Защита от path traversal
    if (!isSafeBackupFilename(filename)) {
      return { success: false, error: 'Недопустимое имя файла бэкапа' };
    }

    const backupPath = path.join(BACKUP_CONFIG.backupDir, filename);

    if (!existsSync(backupPath)) {
      return { success: false, error: 'Файл бэкапа не найден' };
    }

    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

    // Создаём бэкап текущей БД перед восстановлением
    if (existsSync(dbPath)) {
      const preRestoreBackup = `pre-restore-${Date.now()}.db`;
      await copyFile(dbPath, path.join(BACKUP_CONFIG.backupDir, preRestoreBackup));
    }

    // Восстанавливаем
    await copyFile(backupPath, dbPath);

    console.log(`[BACKUP] Restored from: ${filename}`);

    return { success: true };
  } catch (error) {
    console.error('[BACKUP] Failed to restore backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Получение списка бэкапов
 */
export async function listBackups(): Promise<BackupInfo[]> {
  try {
    await ensureBackupDir();

    const files = await readdir(BACKUP_CONFIG.backupDir);
    const backupFiles = files.filter(f => f.endsWith('.db') && !f.includes('pre-restore'));

    const backups: BackupInfo[] = [];

    for (const filename of backupFiles) {
      const filePath = path.join(BACKUP_CONFIG.backupDir, filename);
      const fileStat = await stat(filePath);

      // Определяем тип из имени файла
      let type: 'manual' | 'daily' | 'weekly' = 'manual';
      if (filename.includes('daily')) type = 'daily';
      if (filename.includes('weekly')) type = 'weekly';

      backups.push({
        filename,
        path: filePath,
        size: fileStat.size,
        createdAt: fileStat.birthtime,
        type,
      });
    }

    // Сортируем по дате (новые первые)
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return backups;
  } catch (error) {
    console.error('[BACKUP] Failed to list backups:', error);
    return [];
  }
}

/**
 * Удаление старых бэкапов
 */
async function cleanOldBackups(type: 'manual' | 'daily' | 'weekly'): Promise<void> {
  try {
    const backups = await listBackups();
    const typeBackups = backups.filter(b => b.type === type);

    // Оставляем только последние N бэкапов каждого типа
    const maxBackups =
      type === 'daily' ? BACKUP_CONFIG.maxBackups :
      type === 'weekly' ? 8 : // 8 недельных бэкапов
      10; // 10 ручных бэкапов

    if (typeBackups.length > maxBackups) {
      const toDelete = typeBackups.slice(maxBackups);

      for (const backup of toDelete) {
        await unlink(backup.path);
        // Удаляем также мета-файл если есть
        const metaPath = backup.path + '.meta.json';
        if (existsSync(metaPath)) {
          await unlink(metaPath);
        }
        console.log(`[BACKUP] Deleted old backup: ${backup.filename}`);
      }
    }
  } catch (error) {
    console.error('[BACKUP] Failed to clean old backups:', error);
  }
}

/**
 * Удаление конкретного бэкапа
 */
export async function deleteBackup(
  filename: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Защита от path traversal
    if (!isSafeBackupFilename(filename)) {
      return { success: false, error: 'Недопустимое имя файла бэкапа' };
    }

    const backupPath = path.join(BACKUP_CONFIG.backupDir, filename);

    if (!existsSync(backupPath)) {
      return { success: false, error: 'Файл бэкапа не найден' };
    }

    await unlink(backupPath);

    // Удаляем также мета-файл если есть
    const metaPath = backupPath + '.meta.json';
    if (existsSync(metaPath)) {
      await unlink(metaPath);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Получение размера всех бэкапов
 */
export async function getBackupStats(): Promise<{
  totalSize: number;
  count: number;
  oldestDate: Date | null;
  newestDate: Date | null;
  byType: Record<string, number>;
}> {
  const backups = await listBackups();

  if (backups.length === 0) {
    return {
      totalSize: 0,
      count: 0,
      oldestDate: null,
      newestDate: null,
      byType: { manual: 0, daily: 0, weekly: 0 },
    };
  }

  return {
    totalSize: backups.reduce((sum, b) => sum + b.size, 0),
    count: backups.length,
    oldestDate: backups[backups.length - 1].createdAt,
    newestDate: backups[0].createdAt,
    byType: {
      manual: backups.filter(b => b.type === 'manual').length,
      daily: backups.filter(b => b.type === 'daily').length,
      weekly: backups.filter(b => b.type === 'weekly').length,
    },
  };
}

/**
 * Форматирование размера файла
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
