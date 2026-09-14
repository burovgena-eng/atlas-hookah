import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { 
  validateId, 
  validateRequiredString, 
  validateString, 
  validateBoolean,
  validateIngredients,
  MAX_LENGTHS,
  isObject,
} from '@/lib/validation';

// Получить все миксы (личные пользователя + публичные)
export async function GET(request: NextRequest) {
  try {
    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = validateString(searchParams.get('type'), 20); // 'personal', 'public', 'all'

    if (type === 'personal') {
      // Личные миксы пользователя
      const mixes = await db.mix.findMany({
        where: {
          authorId: user.id,
          isPublic: false,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true, role: true, avatar: true },
          },
          ingredients: true,
          likes: { select: { userId: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ mixes });
    }

    if (type === 'public') {
      // Публичные миксы всех пользователей
      const mixes = await db.mix.findMany({
        where: { isPublic: true },
        include: {
          author: {
            select: { id: true, name: true, email: true, role: true, avatar: true },
          },
          ingredients: true,
          likes: { select: { userId: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ mixes });
    }

    // Все миксы (личные + публичные)
    const mixes = await db.mix.findMany({
      where: {
        OR: [
          { authorId: user.id },
          { isPublic: true },
        ],
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        ingredients: true,
        likes: { select: { userId: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ mixes });
  } catch (error) {
    console.error('Get mixes error:', error);
    return NextResponse.json({ error: 'Ошибка при получении миксов' }, { status: 500 });
  }
}

// Создать новый микс
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
    
    const { name, description, isPublic, ingredients } = body;

    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const validatedName = validateRequiredString(name, MAX_LENGTHS.name);

    if (!validatedName) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
    }

    // Валидируем ингредиенты
    const validatedIngredients = validateIngredients(ingredients);

    const mix = await db.mix.create({
      data: {
        name: validatedName,
        description: validateString(description, MAX_LENGTHS.description),
        isPublic: validateBoolean(isPublic),
        authorId: user.id,
        ingredients: {
          create: validatedIngredients?.map((ing) => ({
            tobacco: ing.tobacco,
            brand: ing.brand,
            amount: ing.amount,
            layer: ing.layer,
          })) || [],
        },
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        ingredients: true,
      },
    });

    return NextResponse.json({ mix });
  } catch (error) {
    console.error('Create mix error:', error);
    return NextResponse.json({ error: 'Ошибка при создании микса' }, { status: 500 });
  }
}

// Обновить микс
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
    
    const { id, name, description, isPublic, ingredients } = body;

    const validatedId = validateId(id);

    if (!validatedId) {
      return NextResponse.json({ error: 'ID микса обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    const existingMix = await db.mix.findUnique({
      where: { id: validatedId },
    });

    if (!existingMix || existingMix.authorId !== user.id) {
      return NextResponse.json({ error: 'Микс не найден или нет прав на редактирование' }, { status: 403 });
    }

    // Валидируем данные
    const validatedName = validateRequiredString(name, MAX_LENGTHS.name);
    const validatedIngredients = validateIngredients(ingredients);

    // Удаляем старые ингредиенты и создаем новые
    await db.mixIngredient.deleteMany({
      where: { mixId: validatedId },
    });

    const mix = await db.mix.update({
      where: { id: validatedId },
      data: {
        name: validatedName || existingMix.name,
        description: description !== undefined ? validateString(description, MAX_LENGTHS.description) : existingMix.description,
        isPublic: isPublic !== undefined ? validateBoolean(isPublic) : existingMix.isPublic,
        ingredients: {
          create: validatedIngredients?.map((ing) => ({
            tobacco: ing.tobacco,
            brand: ing.brand,
            amount: ing.amount,
            layer: ing.layer,
          })) || [],
        },
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        ingredients: true,
      },
    });

    return NextResponse.json({ mix });
  } catch (error) {
    console.error('Update mix error:', error);
    return NextResponse.json({ error: 'Ошибка при обновлении микса' }, { status: 500 });
  }
}

// Удалить микс
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = validateId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'ID микса обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    const existingMix = await db.mix.findUnique({
      where: { id },
    });

    if (!existingMix || existingMix.authorId !== user.id) {
      return NextResponse.json({ error: 'Микс не найден или нет прав на удаление' }, { status: 403 });
    }

    await db.mix.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete mix error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении микса' }, { status: 500 });
  }
}
