import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { 
  validateId, 
  validateRequiredString, 
  validateString, 
  validateNotificationType,
  validateLimit,
  MAX_LENGTHS,
  isObject,
} from '@/lib/validation';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import { NotificationType } from '@prisma/client';

// Получить уведомления для пользователя
export async function GET(request: NextRequest) {
  try {
    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const notifications = await db.notification.findMany({
      where: {
        OR: [
          { recipientId: user.id },
          {
            AND: [
              { recipientId: null },
              {
                OR: [
                  // Общие для всех (city = null)
                  { city: null },
                  // Для города пользователя
                  { city: user.city },
                  // Для филиала пользователя
                  { branch: user.branch },
                ],
              },
            ],
          },
        ],
      },
      include: {
        author: {
          select: { id: true, name: true, role: true },
        },
        reads: {
          where: { userId: user.id },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Добавляем поле isReadForUser
    const notificationsWithReadStatus = notifications.map((n) => ({
      ...n,
      isReadForUser: n.reads.length > 0,
    }));

    // Считаем непрочитанные
    const unreadCount = notificationsWithReadStatus.filter((n) => !n.isReadForUser).length;

    return NextResponse.json({ 
      notifications: notificationsWithReadStatus,
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'Ошибка при получении уведомлений' }, { status: 500 });
  }
}

// Создать уведомление (только для руководителей)
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
    
    const { title, content, type, recipientId, city, branch } = body;

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const limited = rateLimitMiddleware(request, 'notifications', actor.id);
    if (limited) return limited;

    const validatedTitle = validateRequiredString(title, MAX_LENGTHS.title);
    const validatedContent = validateRequiredString(content, MAX_LENGTHS.content);

    if (!validatedTitle || !validatedContent) {
      return NextResponse.json({ error: 'Заголовок и содержание обязательны' }, { status: 400 });
    }

    // Проверяем права
    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководитель может отправлять уведомления' }, { status: 403 });
    }

    // Валидируем тип уведомления
    const validatedType = (validateNotificationType(type) as NotificationType) || 'MESSAGE';
    
    // Валидируем получателя (если указан конкретный пользователь)
    const validatedRecipientId = validateId(recipientId);
    
    // Валидируем город и филиал
    const validatedCity = validateString(city, MAX_LENGTHS.city);
    const validatedBranch = validateString(branch, MAX_LENGTHS.branch);

    const notification = await db.notification.create({
      data: {
        type: validatedType,
        title: validatedTitle,
        content: validatedContent,
        authorId: actor.id,
        recipientId: validatedRecipientId, // null = всем
        city: validatedCity,               // null = всем городам
        branch: validatedBranch,           // null = всем филиалам
      },
      include: {
        author: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    return NextResponse.json({ notification });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json({ error: 'Ошибка при создании уведомления' }, { status: 500 });
  }
}

// Пометить как прочитанное
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
    
    const { notificationId } = body;

    const validatedNotificationId = validateId(notificationId);

    if (!validatedNotificationId) {
      return NextResponse.json({ error: 'ID уведомления обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем, не прочитано ли уже
    const existingRead = await db.notificationRead.findUnique({
      where: {
        notificationId_userId: {
          notificationId: validatedNotificationId,
          userId: user.id,
        },
      },
    });

    if (existingRead) {
      return NextResponse.json({ success: true, alreadyRead: true });
    }

    // Создаем запись о прочтении
    await db.notificationRead.create({
      data: {
        notificationId: validatedNotificationId,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Ошибка при отметке прочитанным' }, { status: 500 });
  }
}

// Пометить все как прочитанные
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
    
    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Получаем все уведомления пользователя
    const notifications = await db.notification.findMany({
      where: {
        OR: [
          { recipientId: user.id },
          { recipientId: null },
        ],
      },
      select: { id: true },
    });

    // Создаем записи о прочтении для всех
    const readData = notifications.map((n) => ({
      notificationId: n.id,
      userId: user.id,
    }));

    if (readData.length > 0) {
      // skipDuplicates не поддерживается SQLite-коннектором —
      // фильтруем уже прочитанные заранее
      const existingReads = await db.notificationRead.findMany({
        where: { userId: user.id, notificationId: { in: readData.map((r) => r.notificationId) } },
        select: { notificationId: true },
      });
      const alreadyRead = new Set(existingReads.map((r) => r.notificationId));
      const toCreate = readData.filter((r) => !alreadyRead.has(r.notificationId));

      if (toCreate.length > 0) {
        await db.notificationRead.createMany({ data: toCreate });
      }

      return NextResponse.json({ success: true, count: toCreate.length });
    }

    return NextResponse.json({ success: true, count: readData.length });
  } catch (error) {
    console.error('Mark all read error:', error);
    return NextResponse.json({ error: 'Ошибка при отметке всех прочитанными' }, { status: 500 });
  }
}

// Удалить уведомление (только для руководителей)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = validateId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'ID уведомления обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководитель может удалять уведомления' }, { status: 403 });
    }

    await db.notification.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении уведомления' }, { status: 500 });
  }
}
