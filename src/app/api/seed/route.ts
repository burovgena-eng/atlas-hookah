import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as crypto from 'crypto';

// Функция для хеширования пароля (тот же формат, что и в /api/auth)
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`10000:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

// Seed - создание демо-пользователей.
// Вызывается один раз на пустой базе для быстрого старта (см. README).
// Для продакшена: удалите этот маршрут или закройте его авторизацией.
export async function POST(request: NextRequest) {
  try {
    // Проверяем, есть ли уже пользователи
    const existingUsers = await db.user.count();

    if (existingUsers > 0) {
      return NextResponse.json({
        message: 'Пользователи уже существуют',
        count: existingUsers,
      });
    }

    const hashedPassword = await hashPassword('123456');

    // Создаем демо-пользователей
    await db.user.create({
      data: {
        email: 'manager@atlas.com',
        password: hashedPassword,
        name: 'Руководитель Atlas',
        role: 'MANAGER',
        isApproved: true,
      },
    });

    await db.user.create({
      data: {
        email: 'master@atlas.com',
        password: hashedPassword,
        name: 'Кальянный мастер',
        role: 'HOOKAH_MASTER',
        isApproved: true,
      },
    });

    return NextResponse.json({
      message: 'Демо-пользователи созданы',
      users: [
        { email: 'manager@atlas.com', password: '123456', role: 'MANAGER' },
        { email: 'master@atlas.com', password: '123456', role: 'HOOKAH_MASTER' },
      ],
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Ошибка при создании пользователей' }, { status: 500 });
  }
}
