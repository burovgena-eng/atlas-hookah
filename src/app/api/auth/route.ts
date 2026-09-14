// API авторизации: регистрация (POST), вход (PUT), выход (DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as crypto from 'crypto';
import {
  validateEmail,
  validatePassword,
  validateRequiredString,
  validatePhone,
  validateRole,
  MAX_LENGTHS,
  isObject,
} from '@/lib/validation';
import { createSession, deleteSession, SAFE_USER_SELECT } from '@/lib/auth';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import { logSecurityEvent } from '@/lib/security-logger';

// Количество итераций PBKDF2
const HASH_ITERATIONS = 10000;

// Формат: iterations:salt:hash
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, HASH_ITERATIONS, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${HASH_ITERATIONS}:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

// Поддерживает старый формат (salt:hash, 1000 итераций) и новый (iterations:salt:hash)
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = hashedPassword.split(':');

    let iterations: number;
    let salt: string;
    let hash: string;

    if (parts.length === 2) {
      iterations = 1000;
      [salt, hash] = parts;
    } else if (parts.length === 3) {
      iterations = parseInt(parts[0], 10);
      if (!Number.isFinite(iterations) || iterations <= 0) return resolve(false);
      [salt, hash] = [parts[1], parts[2]];
    } else {
      return resolve(false);
    }

    crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
      if (err) return resolve(false);
      // Timing-safe сравнение хешей
      const a = Buffer.from(hash, 'hex');
      const b = derivedKey;
      resolve(a.length === b.length && crypto.timingSafeEqual(a, b));
    });
  });
}

// Регистрация
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  const limited = rateLimitMiddleware(request, 'register', ip);
  if (limited) return limited;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Некорректный формат запроса' },
        { status: 400 }
      );
    }

    // Проверяем, что body это объект
    if (!isObject(body)) {
      return NextResponse.json(
        { error: 'Некорректный формат данных' },
        { status: 400 }
      );
    }

    const { email, password, name, phone, role } = body;

    // Валидация email
    const validatedEmail = validateEmail(email);
    if (!validatedEmail) {
      return NextResponse.json(
        { error: 'Некорректный формат email' },
        { status: 400 }
      );
    }

    // Валидация пароля
    const validatedPassword = validatePassword(password);
    if (!validatedPassword) {
      return NextResponse.json(
        { error: 'Пароль должен содержать от 6 до 128 символов' },
        { status: 400 }
      );
    }

    // Валидация имени
    const validatedName = validateRequiredString(name, MAX_LENGTHS.name);
    if (!validatedName) {
      return NextResponse.json(
        { error: 'Имя должно содержать от 2 до 100 символов' },
        { status: 400 }
      );
    }

    // Валидация телефона (если указан)
    const validatedPhone = validatePhone(phone);

    // Валидация роли
    const validatedRole = validateRole(role);

    // Проверяем, существует ли пользователь
    const existingUser = await db.user.findUnique({
      where: { email: validatedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 400 }
      );
    }

    // Хешируем пароль
    const hashedPassword = await hashPassword(validatedPassword);

    // Проверяем, есть ли уже утверждённый руководитель в системе
    const existingManager = await db.user.findFirst({
      where: {
        role: 'MANAGER',
        isApproved: true,
        deletedAt: null,
      },
    });

    // Определяем роль и статус подтверждения
    let userRole: 'HOOKAH_MASTER' | 'SENIOR_MASTER' | 'ADMIN' | 'MANAGER' = 'HOOKAH_MASTER';
    let isApproved = false;
    let isFirstManager = false;

    if (validatedRole === 'MANAGER') {
      userRole = 'MANAGER';
      // Если это первый руководитель - автоматически подтверждён
      if (!existingManager) {
        isApproved = true;
        isFirstManager = true;
      }
    } else if (validatedRole === 'ADMIN') {
      userRole = 'ADMIN';
    } else if (validatedRole === 'SENIOR_MASTER') {
      userRole = 'SENIOR_MASTER';
    }

    // Создаем пользователя
    const user = await db.user.create({
      data: {
        email: validatedEmail,
        password: hashedPassword,
        name: validatedName,
        phone: validatedPhone,
        role: userRole,
        isApproved,
      },
    });

    await logSecurityEvent('REGISTER', { userId: user.id, ip, details: { role: userRole } });

    // Первый руководитель сразу получает сессию (клиент его автоматически логинит)
    let token: string | undefined;
    if (isFirstManager) {
      token = (await createSession(user.id)).token;
    }

    // Возвращаем пользователя без пароля
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({
      user: userWithoutPassword,
      token,
      isFirstManager,
      needsApproval: !isApproved,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Ошибка при регистрации' },
      { status: 500 }
    );
  }
}

// Вход
export async function PUT(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  const limited = rateLimitMiddleware(request, 'auth', ip);
  if (limited) {
    await logSecurityEvent('LOGIN_BLOCKED', { ip, details: { reason: 'rate_limit' } });
    return limited;
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Некорректный формат запроса' },
        { status: 400 }
      );
    }

    // Проверяем, что body это объект
    if (!isObject(body)) {
      return NextResponse.json(
        { error: 'Некорректный формат данных' },
        { status: 400 }
      );
    }

    const { email, password } = body;

    // Валидация email
    const validatedEmail = validateEmail(email);
    if (!validatedEmail) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Валидация пароля (базовая проверка)
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Ищем пользователя
    const user = await db.user.findUnique({
      where: { email: validatedEmail },
    });

    // Единое сообщение об ошибке — не раскрываем, что именно неверно
    if (!user || user.deletedAt) {
      await logSecurityEvent('LOGIN_FAILED', { ip, details: { email: validatedEmail, reason: 'no_user' } });
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Проверяем пароль
    const passwordMatch = await verifyPassword(password, user.password);

    if (!passwordMatch) {
      await logSecurityEvent('LOGIN_FAILED', { userId: user.id, ip, details: { reason: 'bad_password' } });
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Проверяем подтверждение аккаунта
    if (!user.isApproved) {
      return NextResponse.json(
        { error: 'Ваш аккаунт ожидает подтверждения руководителя' },
        { status: 403 }
      );
    }

    // Создаём серверную сессию
    const { token } = await createSession(user.id);

    await logSecurityEvent('LOGIN_SUCCESS', { userId: user.id, ip });

    // Возвращаем пользователя без пароля + токен сессии
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Ошибка при входе' },
      { status: 500 }
    );
  }
}

// Выход (инвалидация серверной сессии)
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('X-Session-Token');
    await deleteSession(token);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Ошибка при выходе' }, { status: 500 });
  }
}
