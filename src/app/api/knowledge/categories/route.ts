import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { validateId } from '@/lib/validation';
import { Prisma, CategoryVisibility } from '@prisma/client';

// Получить категории
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');

    // Роль берём из серверной сессии; без сессии видны только общие категории
    const user = await getAuthUser(request);

    // Базовый фильтр для видимости
    let visibilityFilter: CategoryVisibility[] = ['COMMON'];
    
    if (user?.role === 'MANAGER') {
      // Руководитель видит все категории
      visibilityFilter = ['ADMIN', 'MASTER', 'COMMON'];
    } else if (user?.role === 'ADMIN') {
      // Администратор видит категории для администраторов и общие
      visibilityFilter = ['ADMIN', 'COMMON'];
    } else if (user?.role === 'HOOKAH_MASTER' || user?.role === 'SENIOR_MASTER') {
      // Мастера видят категории для мастеров и общие
      visibilityFilter = ['MASTER', 'COMMON'];
    }

    // Фильтр по родительской категории
    const parentFilter = parentId === 'null' || parentId === null 
      ? { parentCategoryId: null }  // Корневые категории
      : { parentCategoryId: parentId }; // Подкатегории

    const categories = await db.knowledgeCategory.findMany({
      where: {
        ...parentFilter,
        visibility: { in: visibilityFilter },
      },
      include: {
        _count: {
          select: {
            articles: true,
            subcategories: true,
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json({ error: 'Ошибка при получении категорий' }, { status: 500 });
  }
}

// Создать категорию (только для руководителей)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      description, 
      color, 
      visibility, 
      parentCategoryId,
      sendNotification 
    } = body;

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    if (!name) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
    }

    // Проверяем права - только руководитель может создавать категории
    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководитель может создавать категории' }, { status: 403 });
    }

    // Проверка уникальности имени в рамках родительской категории
    const existingCategory = await db.knowledgeCategory.findFirst({
      where: {
        name,
        parentCategoryId: parentCategoryId || null,
      },
    });

    if (existingCategory) {
      return NextResponse.json({ 
        error: 'Категория с таким названием уже существует в этом разделе' 
      }, { status: 400 });
    }

    // Получаем максимальный sortOrder для родительской категории
    const maxSortOrder = await db.knowledgeCategory.findFirst({
      where: { parentCategoryId: parentCategoryId || null },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const category = await db.knowledgeCategory.create({
      data: {
        name,
        description: description || null,
        color: color || '#10b981',
        visibility: visibility || 'COMMON',
        parentCategoryId: parentCategoryId || null,
        sortOrder: (maxSortOrder?.sortOrder ?? -1) + 1,
      },
      include: {
        _count: {
          select: {
            articles: true,
            subcategories: true,
          },
        },
      },
    });

    // Отправка уведомления если нужно
    if (sendNotification) {
      // Определяем фильтры для получателей на основе visibility категории
      let recipientCity: string | null = null;
      let recipientBranch: string | null = null;

      await db.notification.create({
        data: {
          type: 'CATEGORY_ADDED',
          title: 'Добавлена новая категория',
          content: `Создана категория "${name}"${description ? `: ${description}` : ''}`,
          authorId: actor.id,
          recipientId: null, // Всем
          city: recipientCity,
          branch: recipientBranch,
          categoryId: category.id,
          categoryName: category.name,
        },
      });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json({ error: 'Ошибка при создании категории' }, { status: 500 });
  }
}

// Обновить категорию (только для руководителей)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, 
      name, 
      description, 
      color, 
      visibility, 
      sortOrder
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID категории обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководитель может редактировать категории' }, { status: 403 });
    }

    // Проверяем существование категории
    const existingCategory = await db.knowledgeCategory.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 });
    }

    // Если меняется имя, проверяем уникальность
    if (name && name !== existingCategory.name) {
      const duplicateName = await db.knowledgeCategory.findFirst({
        where: {
          name,
          parentCategoryId: existingCategory.parentCategoryId,
          id: { not: id },
        },
      });

      if (duplicateName) {
        return NextResponse.json({ 
          error: 'Категория с таким названием уже существует в этом разделе' 
        }, { status: 400 });
      }
    }

    const updateData: Prisma.KnowledgeCategoryUpdateInput = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (color !== undefined) updateData.color = color;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const category = await db.knowledgeCategory.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            articles: true,
            subcategories: true,
          },
        },
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json({ error: 'Ошибка при обновлении категории' }, { status: 500 });
  }
}

// Удалить категорию (только для руководителей)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = validateId(searchParams.get('id'));
    const forceDelete = searchParams.get('forceDelete') === 'true';
    
    // Для уведомлений читаем тело запроса если есть
    let sendNotification = false;
    
    // Пытаемся прочитать тело если передан content-length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 0) {
      try {
        const body = await request.json();
        sendNotification = body.sendNotification === true;
      } catch {
        // Игнорируем ошибки парсинга тела
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'ID категории обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководитель может удалять категории' }, { status: 403 });
    }

    // Проверяем существование категории
    const existingCategory = await db.knowledgeCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            articles: true,
            subcategories: true,
          },
        },
      },
    });

    if (!existingCategory) {
      return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 });
    }

    // Проверяем наличие контента если не forceDelete
    if (!forceDelete) {
      if (existingCategory._count.articles > 0 || existingCategory._count.subcategories > 0) {
        return NextResponse.json({ 
          error: 'Категория содержит статьи или подкатегории. Используйте forceDelete=true для принудительного удаления.',
          hasContent: true,
          articlesCount: existingCategory._count.articles,
          subcategoriesCount: existingCategory._count.subcategories,
        }, { status: 400 });
      }
    }

    // Сохраняем информацию для уведомления до удаления
    const categoryName = existingCategory.name;

    // Рекурсивное удаление подкатегорий и статей (при forceDelete)
    if (forceDelete) {
      await deleteCategoryRecursively(id);
    } else {
      await db.knowledgeCategory.delete({ where: { id } });
    }

    // Отправка уведомления если нужно
    if (sendNotification) {
      await db.notification.create({
        data: {
          type: 'CATEGORY_DELETED',
          title: 'Категория удалена',
          content: `Категория "${categoryName}" была удалена`,
          authorId: actor.id,
          recipientId: null, // Всем
          categoryName: categoryName,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении категории' }, { status: 500 });
  }
}

// Рекурсивная функция удаления категории со всем содержимым
async function deleteCategoryRecursively(categoryId: string) {
  // Получаем все подкатегории
  const subcategories = await db.knowledgeCategory.findMany({
    where: { parentCategoryId: categoryId },
    select: { id: true },
  });

  // Рекурсивно удаляем подкатегории
  for (const subcategory of subcategories) {
    await deleteCategoryRecursively(subcategory.id);
  }

  // Удаляем статьи в текущей категории
  await db.knowledge.deleteMany({
    where: { categoryId },
  });

  // Удаляем саму категорию
  await db.knowledgeCategory.delete({
    where: { id: categoryId },
  });
}
