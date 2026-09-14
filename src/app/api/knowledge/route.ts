import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { CategoryVisibility } from '@prisma/client';
import { 
  validateId, 
  validateRequiredString, 
  validateString, 
  validateUrl,
  validateVisibility,
  validateBoolean,
  MAX_LENGTHS,
  isObject,
} from '@/lib/validation';

// Получить статьи базы знаний
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = validateId(searchParams.get('categoryId'));
    const search = validateString(searchParams.get('search'), MAX_LENGTHS.search);

    // Роль берём из серверной сессии; без сессии видны только общие статьи
    const user = await getAuthUser(request);

    const where: Record<string, unknown> = {};

    // Фильтр по категории
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Поиск по заголовку и содержанию (Prisma параметризует запросы - SQL injection не возможен).
    // Без mode: 'insensitive' — SQLite-коннектор его не поддерживает (LIKE в SQLite регистронезависим для ASCII).
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    // Фильтрация по видимости в зависимости от роли
    if (user?.role === 'MANAGER') {
      // Руководитель видит все статьи
    } else if (user?.role === 'ADMIN') {
      // Администратор видит статьи для администраторов и общие
      where.visibility = { in: ['ADMIN', 'COMMON'] };
    } else if (user?.role === 'HOOKAH_MASTER' || user?.role === 'SENIOR_MASTER') {
      // Мастера видят статьи для мастеров и общие
      where.visibility = { in: ['MASTER', 'COMMON'] };
    } else {
      // Неавторизованные или неизвестные роли - только общие
      where.visibility = 'COMMON';
    }

    const articles = await db.knowledge.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true },
        },
        category: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: [
        { isOfficial: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error('Get knowledge error:', error);
    return NextResponse.json({ error: 'Ошибка при получении статей' }, { status: 500 });
  }
}

// Создать статью (только для руководителей)
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
    
    const { 
      title, 
      content, 
      categoryId, 
      imageUrl, 
      visibility,
      sendNotification 
    } = body;

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const validatedTitle = validateRequiredString(title, MAX_LENGTHS.title);
    const validatedContent = validateRequiredString(content, MAX_LENGTHS.content);

    if (!validatedTitle || !validatedContent) {
      return NextResponse.json({ error: 'Заголовок и содержание обязательны' }, { status: 400 });
    }

    // Проверяем права - только руководитель может создавать статьи
    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководитель может создавать статьи' }, { status: 403 });
    }

    const article = await db.knowledge.create({
      data: {
        title: validatedTitle,
        content: validatedContent,
        categoryId: validateId(categoryId),
        imageUrl: validateUrl(imageUrl),
        authorId: actor.id,
        visibility: (validateVisibility(visibility) as CategoryVisibility) || 'COMMON',
        isOfficial: true, // Все статьи от руководителей официальные
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true },
        },
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    // Отправка уведомления если нужно
    if (sendNotification) {
      await db.notification.create({
        data: {
          type: 'KNOWLEDGE_ADDED',
          title: 'Новая статья в базе знаний',
          content: `Добавлена статья "${validatedTitle}"`,
          authorId: actor.id,
          recipientId: null, // Всем
          knowledgeId: article.id,
          knowledgeTitle: article.title,
          categoryId: article.categoryId,
          categoryName: article.category?.name || null,
        },
      });
    }

    return NextResponse.json({ article });
  } catch (error) {
    console.error('Create knowledge error:', error);
    return NextResponse.json({ error: 'Ошибка при создании статьи' }, { status: 500 });
  }
}

// Обновить статью
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
    
    const { id, title, content, categoryId, imageUrl, visibility, sendNotification } = body;

    const validatedId = validateId(id);

    if (!validatedId) {
      return NextResponse.json({ error: 'ID статьи обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем существование статьи
    const existingArticle = await db.knowledge.findUnique({
      where: { id: validatedId },
    });

    if (!existingArticle) {
      return NextResponse.json({ error: 'Статья не найдена' }, { status: 404 });
    }
    // Проверяем права на изменение
    const canEdit = user.role === 'MANAGER' || existingArticle.authorId === user.id;

    if (!canEdit) {
      return NextResponse.json({ error: 'Нет прав на редактирование' }, { status: 403 });
    }

    // Валидируем данные
    const validatedTitle = validateString(title, MAX_LENGTHS.title);
    const validatedContent = validateString(content, MAX_LENGTHS.content);

    const article = await db.knowledge.update({
      where: { id: validatedId },
      data: {
        title: validatedTitle ?? existingArticle.title,
        content: validatedContent ?? existingArticle.content,
        categoryId: categoryId !== undefined ? validateId(categoryId) : existingArticle.categoryId,
        imageUrl: imageUrl !== undefined ? validateUrl(imageUrl) : existingArticle.imageUrl,
        visibility: (validateVisibility(visibility) as CategoryVisibility) ?? existingArticle.visibility,
        isOfficial: user.role === 'MANAGER',
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true },
        },
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    // Отправка уведомления если нужно
    if (sendNotification && user.role === 'MANAGER') {
      await db.notification.create({
        data: {
          type: 'KNOWLEDGE_UPDATED',
          title: 'Статья обновлена',
          content: `Обновлена статья "${article.title}"`,
          authorId: user.id,
          recipientId: null, // Всем
          knowledgeId: article.id,
          knowledgeTitle: article.title,
          categoryId: article.categoryId,
          categoryName: article.category?.name || null,
        },
      });
    }

    return NextResponse.json({ article });
  } catch (error) {
    console.error('Update knowledge error:', error);
    return NextResponse.json({ error: 'Ошибка при обновлении статьи' }, { status: 500 });
  }
}

// Удалить статью
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = validateId(searchParams.get('id'));

    // Для уведомлений читаем тело запроса если есть
    let sendNotification = false;

    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 0) {
      try {
        const body = await request.json();
        if (isObject(body)) {
          sendNotification = validateBoolean(body.sendNotification);
        }
      } catch {
        // Игнорируем ошибки парсинга тела
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'ID статьи обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем существование
    const existingArticle = await db.knowledge.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    if (!existingArticle) {
      return NextResponse.json({ error: 'Статья не найдена' }, { status: 404 });
    }

    // Только автор или руководитель может удалить
    if (existingArticle.authorId !== user.id && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Нет прав на удаление' }, { status: 403 });
    }

    // Сохраняем информацию для уведомления до удаления
    const articleTitle = existingArticle.title;
    const categoryId = existingArticle.categoryId;
    const categoryName = existingArticle.category?.name;

    await db.knowledge.delete({
      where: { id },
    });

    // Отправка уведомления если нужно
    if (sendNotification && user.role === 'MANAGER') {
      await db.notification.create({
        data: {
          type: 'KNOWLEDGE_DELETED',
          title: 'Статья удалена',
          content: `Удалена статья "${articleTitle}"`,
          authorId: user.id,
          recipientId: null, // Всем
          categoryId: categoryId,
          categoryName: categoryName,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete knowledge error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении статьи' }, { status: 500 });
  }
}
