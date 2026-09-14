// API авторизации
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

// Константа для количества итераций
const HASH_ITERATIONS = 10000;

// Функция для хеширования пароля
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

// Функция для проверки пароля
// Поддерживает старый формат (salt:hash) и новый (iterations:salt:hash)
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = hashedPassword.split(':');
    
    let iterations: number;
    let salt: string;
    let hash: string;
    
    if (parts.length === 2) {
      // Старый формат: salt:hash (1000 итераций)
      iterations = 1000;
      [salt, hash] = parts;
    } else if (parts.length === 3) {
      // Новый формат: iterations:salt:hash
      iterations = parseInt(parts[0], 10);
      [salt, hash] = [parts[1], parts[2]];
    } else {
      return resolve(false);
    }
    
    crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(hash === derivedKey.toString('hex'));
    });
  });
}

// Регистрация
export async function POST(request: NextRequest) {
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
      } else {
        // Все последующие руководители требуют подтверждения
        isApproved = false;
      }
    } else if (validatedRole === 'ADMIN') {
      userRole = 'ADMIN';
      isApproved = false;
    } else if (validatedRole === 'SENIOR_MASTER') {
      userRole = 'SENIOR_MASTER';
      isApproved = false;
    } else {
      userRole = 'HOOKAH_MASTER';
      isApproved = false;
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

    // Возвращаем пользователя без пароля
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({ 
      user: userWithoutPassword,
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

    if (!user) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Проверяем, не был ли пользователь удалён (soft delete)
    if (user.deletedAt) {
      return NextResponse.json(
        { error: 'Этот аккаунт был удалён' },
        { status: 403 }
      );
    }

    // Проверяем пароль
    const passwordMatch = await verifyPassword(password, user.password);

    if (!passwordMatch) {
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

    // Возвращаем пользователя без пароля
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Ошибка при входе' },
      { status: 500 }
    );
  }
}
