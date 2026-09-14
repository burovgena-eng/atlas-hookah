import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { 
  validateId, 
  validateRequiredString, 
  validateString, 
  validateUrl,
  validateIngredients,
  MAX_LENGTHS,
  isObject,
} from '@/lib/validation';
import { rateLimitMiddleware } from '@/lib/rate-limit';

// Получить рецепты
export async function GET(request: NextRequest) {
  try {
    const recipes = await db.recipe.findMany({
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true },
        },
        ingredients: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ recipes });
  } catch (error) {
    console.error('Get recipes error:', error);
    return NextResponse.json({ error: 'Ошибка при получении рецептов' }, { status: 500 });
  }
}

// Создать рецепт (только для руководителей)
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
      name, 
      description, 
      instructions, 
      bowlType, 
      tips, 
      imageUrl,
      ingredients
    } = body;

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const limited = rateLimitMiddleware(request, 'notifications', actor.id);
    if (limited) return limited;

    const validatedName = validateRequiredString(name, MAX_LENGTHS.title);
    const validatedInstructions = validateRequiredString(instructions, MAX_LENGTHS.instructions);

    if (!validatedName || !validatedInstructions) {
      return NextResponse.json({ error: 'Название и инструкция обязательны' }, { status: 400 });
    }

    // Проверяем права - только MANAGER может создавать рецепты
    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководители могут создавать рецепты' }, { status: 403 });
    }

    // Валидируем ингредиенты
    const validatedIngredients = validateIngredients(ingredients);

    const recipe = await db.recipe.create({
      data: {
        name: validatedName,
        description: validateString(description, MAX_LENGTHS.description),
        instructions: validatedInstructions,
        bowlType: validateString(bowlType, MAX_LENGTHS.bowlType),
        tips: validateString(tips, MAX_LENGTHS.tips),
        imageUrl: validateUrl(imageUrl),
        authorId: actor.id,
        ingredients: validatedIngredients && validatedIngredients.length > 0 
          ? {
              create: validatedIngredients.map((ing) => ({
                tobacco: ing.tobacco,
                brand: ing.brand,
                amount: ing.amount,
                layer: ing.layer,
              }))
            }
          : undefined,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true },
        },
        ingredients: true,
      },
    });

    // Создаем уведомление о новом рецепте
    await db.notification.create({
      data: {
        type: 'RECIPE_ADDED',
        title: 'Новый рецепт добавлен',
        content: `Добавлен новый авторский рецепт: "${validatedName}"\n\n${validateString(description, MAX_LENGTHS.description) || 'Проверьте раздел "Рецептуры" для подробностей.'}`,
        authorId: actor.id,
        recipeId: recipe.id,
        recipeName: validatedName,
        recipientId: null, // Всем
      },
    });

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('Create recipe error:', error);
    return NextResponse.json({ error: 'Ошибка при создании рецепта' }, { status: 500 });
  }
}

// Обновить рецепт
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
    
    const { 
      id, 
      name, 
      description, 
      instructions, 
      bowlType, 
      tips,
      imageUrl,
      ingredients
    } = body;

    const validatedId = validateId(id);

    if (!validatedId) {
      return NextResponse.json({ error: 'ID рецепта обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права - только MANAGER может редактировать рецепты
    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководители могут редактировать рецепты' }, { status: 403 });
    }

    // Валидируем данные
    const validatedName = validateRequiredString(name, MAX_LENGTHS.title);
    const validatedInstructions = validateRequiredString(instructions, MAX_LENGTHS.instructions);
    const validatedIngredients = validateIngredients(ingredients);

    // Удаляем старые ингредиенты и создаем новые
    await db.recipeIngredient.deleteMany({
      where: { recipeId: validatedId },
    });

    const recipe = await db.recipe.update({
      where: { id: validatedId },
      data: {
        name: validatedName || '',
        description: validateString(description, MAX_LENGTHS.description),
        instructions: validatedInstructions || '',
        bowlType: validateString(bowlType, MAX_LENGTHS.bowlType),
        tips: validateString(tips, MAX_LENGTHS.tips),
        imageUrl: validateUrl(imageUrl),
        ingredients: validatedIngredients && validatedIngredients.length > 0 
          ? {
              create: validatedIngredients.map((ing) => ({
                tobacco: ing.tobacco,
                brand: ing.brand,
                amount: ing.amount,
                layer: ing.layer,
              }))
            }
          : undefined,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true },
        },
        ingredients: true,
      },
    });

    // Создаем уведомление об обновлении рецепта
    await db.notification.create({
      data: {
        type: 'RECIPE_UPDATED',
        title: 'Рецепт обновлен',
        content: `Рецепт "${validatedName || 'Рецепт'}" был обновлен.\n\nПроверьте раздел "Рецептуры" для просмотра изменений.`,
        authorId: actor.id,
        recipeId: recipe.id,
        recipeName: validatedName || '',
        recipientId: null, // Всем
      },
    });

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('Update recipe error:', error);
    return NextResponse.json({ error: 'Ошибка при обновлении рецепта' }, { status: 500 });
  }
}

// Удалить рецепт
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = validateId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'ID рецепта обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права - только MANAGER может удалять рецепты
    if (actor.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Только руководители могут удалять рецепты' }, { status: 403 });
    }

    // Получаем рецепт для уведомления
    const recipe = await db.recipe.findUnique({ where: { id } });

    await db.recipe.delete({
      where: { id },
    });

    // Создаем уведомление об удалении рецепта
    if (recipe) {
      await db.notification.create({
        data: {
          type: 'RECIPE_DELETED',
          title: 'Рецепт удален',
          content: `Рецепт "${recipe.name}" был удален из базы рецептур.`,
          authorId: actor.id,
          recipeId: null,
          recipeName: recipe.name,
          recipientId: null, // Всем
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete recipe error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении рецепта' }, { status: 500 });
  }
}
