import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as crypto from 'crypto';

// Функция для хеширования пароля
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, 1000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

// Seed - создание тестовых пользователей
export async function POST(request: NextRequest) {
  try {
    // Проверяем, есть ли уже пользователи
    const existingUsers = await db.user.findMany();
    
    if (existingUsers.length > 0) {
      return NextResponse.json({ 
        message: 'Пользователи уже существуют',
        count: existingUsers.length 
      });
    }

    const hashedPassword = await hashPassword('123456');

    // Создаем тестовых пользователей
    const manager = await db.user.create({
      data: {
        email: 'manager@atlas.com',
        password: hashedPassword,
        name: 'Руководитель Atlas',
        role: 'MANAGER',
        isApproved: true,
      },
    });

    const master = await db.user.create({
      data: {
        email: 'master@atlas.com',
        password: hashedPassword,
        name: 'Кальянный мастер',
        role: 'HOOKAH_MASTER',
        isApproved: true,
      },
    });

    return NextResponse.json({ 
      message: 'Тестовые пользователи созданы',
      users: [
        { email: 'manager@atlas.com', password: '123456', role: 'MANAGER' },
        { email: 'master@atlas.com', password: '123456', role: 'HOOKAH_MASTER' },
      ]
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Ошибка при создании пользователей' }, { status: 500 });
  }
}

// Получить всех пользователей (для диагностики)
export async function GET(request: NextRequest) {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Ошибка при получении пользователей' }, { status: 500 });
  }
}
