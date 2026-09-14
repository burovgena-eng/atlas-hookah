import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  validateId, 
  validateRequiredString, 
  validateString, 
  validateNotificationType,
  validateBoolean,
  validateLimit,
  MAX_LENGTHS,
  isObject,
} from '@/lib/validation';

// Получить уведомления для пользователя
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = validateId(searchParams.get('userId'));

    if (!userId) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Получаем данные пользователя для фильтрации по городу/филиалу
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { city: true, branch: true },
    });

    // Получаем уведомления:
    // 1. Адресованные конкретно этому пользователю
    // 2. Общие уведомления (recipientId = null) - без фильтра или совпадающие по городу/филиалу
    const notifications = await db.notification.findMany({
      where: {
        OR: [
          { recipientId: userId },
          {
            AND: [
              { recipientId: null },
              {
                OR: [
                  // Общие для всех (city = null)
                  { city: null },
                  // Для города пользователя
                  { city: user?.city },
                  // Для филиала пользователя
                  { branch: user?.branch },
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
          where: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: validateLimit(null, 50, 100),
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
    
    const { title, content, type, recipientId, authorId, city, branch } = body;

    const validatedAuthorId = validateId(authorId);
    const validatedTitle = validateRequiredString(title, MAX_LENGTHS.title);
    const validatedContent = validateRequiredString(content, MAX_LENGTHS.content);
    
    if (!validatedAuthorId) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    if (!validatedTitle || !validatedContent) {
      return NextResponse.json({ error: 'Заголовок и содержание обязательны' }, { status: 400 });
    }

    // Проверяем права
    const user = await db.user.findUnique({ where: { id: validatedAuthorId } });
    if (user?.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководитель может отправлять уведомления' }, { status: 403 });
    }

    // Валидируем тип уведомления
    const validatedType = validateNotificationType(type) || 'MESSAGE';
    
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
        authorId: validatedAuthorId,
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
    
    const { notificationId, userId } = body;

    const validatedNotificationId = validateId(notificationId);
    const validatedUserId = validateId(userId);
    
    if (!validatedNotificationId || !validatedUserId) {
      return NextResponse.json({ error: 'ID уведомления и пользователь обязательны' }, { status: 400 });
    }

    // Проверяем, не прочитано ли уже
    const existingRead = await db.notificationRead.findUnique({
      where: {
        notificationId_userId: {
          notificationId: validatedNotificationId,
          userId: validatedUserId,
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
        userId: validatedUserId,
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
    
    const { userId } = body;

    const validatedUserId = validateId(userId);
    
    if (!validatedUserId) {
      return NextResponse.json({ error: 'Пользователь обязателен' }, { status: 400 });
    }

    // Получаем все уведомления пользователя
    const notifications = await db.notification.findMany({
      where: {
        OR: [
          { recipientId: validatedUserId },
          { recipientId: null },
        ],
      },
      select: { id: true },
    });

    // Создаем записи о прочтении для всех
    const readData = notifications.map((n) => ({
      notificationId: n.id,
      userId: validatedUserId,
    }));

    if (readData.length > 0) {
      await db.notificationRead.createMany({
        data: readData,
        skipDuplicates: true,
      });
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
    const userId = validateId(searchParams.get('userId'));

    if (!id || !userId) {
      return NextResponse.json({ error: 'ID уведомления и пользователь обязательны' }, { status: 400 });
    }

    // Проверяем права
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'MANAGER') {
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
