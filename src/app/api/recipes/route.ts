import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  validateId, 
  validateRequiredString, 
  validateString, 
  validateUrl,
  validateIngredients,
  MAX_LENGTHS,
  isObject,
} from '@/lib/validation';

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
      ingredients,
      authorId 
    } = body;

    const validatedAuthorId = validateId(authorId);
    const validatedName = validateRequiredString(name, MAX_LENGTHS.title);
    const validatedInstructions = validateRequiredString(instructions, MAX_LENGTHS.instructions);
    
    if (!validatedAuthorId) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    if (!validatedName || !validatedInstructions) {
      return NextResponse.json({ error: 'Название и инструкция обязательны' }, { status: 400 });
    }

    // Проверяем права - только MANAGER может создавать рецепты
    const user = await db.user.findUnique({ where: { id: validatedAuthorId } });
    if (user?.role !== 'MANAGER') {
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
        authorId: validatedAuthorId,
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
        authorId: validatedAuthorId,
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
      ingredients,
      userId 
    } = body;

    const validatedId = validateId(id);
    const validatedUserId = validateId(userId);
    
    if (!validatedId || !validatedUserId) {
      return NextResponse.json({ error: 'ID рецепта и пользователь обязательны' }, { status: 400 });
    }

    // Проверяем права - только MANAGER может редактировать рецепты
    const user = await db.user.findUnique({ where: { id: validatedUserId } });
    if (user?.role !== 'MANAGER') {
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
        authorId: validatedUserId,
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
    const userId = validateId(searchParams.get('userId'));

    if (!id || !userId) {
      return NextResponse.json({ error: 'ID рецепта и пользователь обязательны' }, { status: 400 });
    }

    // Проверяем права - только MANAGER может удалять рецепты
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'MANAGER') {
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
          authorId: userId,
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
