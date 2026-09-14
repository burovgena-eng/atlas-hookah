// API для управления пользователями - v2
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as crypto from 'crypto';
import { 
  validateId, 
  validateEmail, 
  validatePassword, 
  validateRequiredString, 
  validatePhone, 
  validateRole,
  validateString,
  validateUrl,
  validateDate,
  validateBoolean,
  MAX_LENGTHS,
  isObject,
} from '@/lib/validation';

// Функция для хеширования пароля
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${10000}:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

// Получить всех пользователей
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = validateId(searchParams.get('userId'));
    const filter = validateString(searchParams.get('filter'), 20); // 'pending', 'approved', 'all', 'deleted'

    // Проверяем права
    const user = userId ? await db.user.findUnique({ where: { id: userId } }) : null;
    const isManager = user?.role === 'MANAGER';
    const isSeniorMaster = user?.role === 'SENIOR_MASTER';
    
    if (!isManager && !isSeniorMaster) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
    }

    let whereClause: Record<string, unknown> = {};

    if (filter === 'pending') {
      whereClause = { isApproved: false, deletedAt: null };
    } else if (filter === 'approved') {
      whereClause = { isApproved: true, deletedAt: null };
    } else if (filter === 'deleted') {
      whereClause = { deletedAt: { not: null } };
    } else {
      // По умолчанию показываем только подтверждённых сотрудников
      whereClause = { isApproved: true, deletedAt: null };
    }

    const users = await db.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isApproved: true,
        bio: true,
        phone: true,
        city: true,
        branch: true,
        birthDate: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            personalMixes: true,
            publicMixes: true,
            clientNotes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Ошибка при получении пользователей' }, { status: 500 });
  }
}

// Подтвердить пользователя (PATCH)
export async function PATCH(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }
    
    if (!isObject(body)) {
      return NextResponse.json({ error: 'Некорректный формат данных' }, { status: 400 });
    }
    
    const { id, isApproved, userId } = body;

    const validatedId = validateId(id);
    const validatedUserId = validateId(userId);
    
    if (!validatedId || !validatedUserId) {
      return NextResponse.json({ error: 'ID пользователя обязателен' }, { status: 400 });
    }

    // Проверяем права - только руководитель может подтверждать
    const currentUser = await db.user.findUnique({ where: { id: validatedUserId } });
    if (currentUser?.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководитель может подтверждать сотрудников' }, { status: 403 });
    }

    const user = await db.user.update({
      where: { id: validatedId },
      data: { isApproved: validateBoolean(isApproved) },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isApproved: true,
        bio: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Approve user error:', error);
    return NextResponse.json({ error: 'Ошибка при подтверждении пользователя' }, { status: 500 });
  }
}

// Обновить пользователя
export async function PUT(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }
    
    if (!isObject(body)) {
      return NextResponse.json({ error: 'Некорректный формат данных' }, { status: 400 });
    }
    
    const { id, name, bio, phone, avatar, city, branch, birthDate, role, userId } = body;

    const validatedId = validateId(id);
    const validatedUserId = validateId(userId);
    
    if (!validatedId || !validatedUserId) {
      return NextResponse.json({ error: 'ID пользователя обязателен' }, { status: 400 });
    }

    // Проверяем права - можно редактировать только свой профиль или быть руководителем
    const currentUser = await db.user.findUnique({ where: { id: validatedUserId } });
    const isManager = currentUser?.role === 'MANAGER';
    const isSelf = validatedId === validatedUserId;

    if (!isSelf && !isManager) {
      return NextResponse.json({ error: 'Нет прав на редактирование' }, { status: 403 });
    }

    // Если меняется роль, проверяем что это делает руководитель
    const validatedRole = validateRole(role);
    if (role && !isManager) {
      return NextResponse.json({ error: 'Только руководитель может менять роли' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    // Валидируем и добавляем только переданные поля
    if (name !== undefined) {
      const validatedName = validateRequiredString(name, MAX_LENGTHS.name);
      if (validatedName) {
        updateData.name = validatedName;
      }
    }

    if (bio !== undefined) {
      updateData.bio = validateString(bio, MAX_LENGTHS.bio);
    }

    if (phone !== undefined) {
      updateData.phone = validatePhone(phone);
    }

    if (avatar !== undefined) {
      updateData.avatar = validateUrl(avatar);
    }

    if (city !== undefined) {
      updateData.city = validateString(city, MAX_LENGTHS.city);
    }

    if (branch !== undefined) {
      updateData.branch = validateString(branch, MAX_LENGTHS.branch);
    }

    if (birthDate !== undefined) {
      updateData.birthDate = validateDate(birthDate);
    }

    if (validatedRole && isManager) {
      updateData.role = validatedRole;
    }

    const user = await db.user.update({
      where: { id: validatedId },
      data: updateData,
    });

    // Удаляем пароль из ответа
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Ошибка при обновлении профиля' }, { status: 500 });
  }
}

// Создать пользователя (руководителем)
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }
    
    if (!isObject(body)) {
      return NextResponse.json({ error: 'Некорректный формат данных' }, { status: 400 });
    }
    
    const { email, password, name, phone, role, userId } = body;

    const validatedUserId = validateId(userId);
    const validatedEmail = validateEmail(email);
    const validatedPassword = validatePassword(password);
    const validatedName = validateRequiredString(name, MAX_LENGTHS.name);
    
    if (!validatedUserId) {
      return NextResponse.json({ error: 'ID пользователя обязателен' }, { status: 400 });
    }

    if (!validatedEmail || !validatedPassword || !validatedName) {
      return NextResponse.json({ error: 'Обязательные поля должны быть заполнены' }, { status: 400 });
    }

    // Проверяем права
    const currentUser = await db.user.findUnique({ where: { id: validatedUserId } });
    if (currentUser?.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководитель может создавать пользователей' }, { status: 403 });
    }

    // Проверяем, существует ли пользователь
    const existingUser = await db.user.findUnique({
      where: { email: validatedEmail },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 400 });
    }

    // Хешируем пароль
    const hashedPassword = await hashPassword(validatedPassword);

    // Валидируем роль
    const validatedRole = validateRole(role);

    // Создаем пользователя (сразу подтвержденным, так как создан руководителем)
    const user = await db.user.create({
      data: {
        email: validatedEmail,
        password: hashedPassword,
        name: validatedName,
        phone: validatePhone(phone),
        role: validatedRole || 'HOOKAH_MASTER',
        isApproved: true, // Созданные руководителем сразу подтверждены
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isApproved: true,
        bio: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Ошибка при создании пользователя' }, { status: 500 });
  }
}

// Удалить пользователя (soft delete - данные сохраняются)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = validateId(searchParams.get('id'));
    const userId = validateId(searchParams.get('userId'));

    if (!id || !userId) {
      return NextResponse.json({ error: 'ID пользователя обязателен' }, { status: 400 });
    }

    // Проверяем права
    const currentUser = await db.user.findUnique({ where: { id: userId } });
    if (currentUser?.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководитель может удалять пользователей' }, { status: 403 });
    }

    // Нельзя удалить самого себя
    if (id === userId) {
      return NextResponse.json({ error: 'Нельзя удалить свой профиль' }, { status: 400 });
    }

    // Soft delete - помечаем пользователя как удалённого
    // Его данные (миксы, постоянники) остаются в базе
    await db.user.update({
      where: { id },
      data: { 
        deletedAt: new Date(),
        // Деактивируем аккаунт
        isApproved: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении пользователя' }, { status: 500 });
  }
}
