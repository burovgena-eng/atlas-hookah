// API для управления типами контейнеров
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { validateId, validateString, validateNumber, MAX_LENGTHS, isObject } from '@/lib/validation';

// Получить все типы контейнеров (требуется авторизация)
export async function GET(request: NextRequest) {
  try {
    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const containerId = validateId(searchParams.get('id'));

    if (containerId) {
      // Получить конкретный контейнер
      const container = await db.containerType.findUnique({
        where: { id: containerId },
      });
      
      if (!container) {
        return NextResponse.json(
          { error: 'Контейнер не найден' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ container });
    }

    // Получить все контейнеры
    const containers = await db.containerType.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ containers });
  } catch (error) {
    console.error('Error fetching containers:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении контейнеров' },
      { status: 500 }
    );
  }
}

// Создать новый тип контейнера (только руководитель/старший мастер)
export async function POST(request: NextRequest) {
  try {
    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    if (actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MASTER') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }

    if (!isObject(body)) {
      return NextResponse.json({ error: 'Некорректный формат данных' }, { status: 400 });
    }

    const name = validateRequiredStringName(body.name);
    const weight = validateNumber(body.weight, 0.1, 1000000);
    const description = validateString(body.description, MAX_LENGTHS.description);

    if (!name) {
      return NextResponse.json(
        { error: 'Название должно содержать минимум 2 символа' },
        { status: 400 }
      );
    }

    if (weight === null) {
      return NextResponse.json(
        { error: 'Вес должен быть больше 0' },
        { status: 400 }
      );
    }

    // Проверяем, существует ли контейнер с таким названием
    const existing = await db.containerType.findFirst({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Контейнер с таким названием уже существует' },
        { status: 400 }
      );
    }

    const container = await db.containerType.create({
      data: {
        name,
        weight,
        description: description || null,
      },
    });

    return NextResponse.json({ container });
  } catch (error) {
    console.error('Error creating container:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании контейнера' },
      { status: 500 }
    );
  }
}

// Обновить тип контейнера (только руководитель/старший мастер)
export async function PUT(request: NextRequest) {
  try {
    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    if (actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MASTER') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }

    if (!isObject(body)) {
      return NextResponse.json({ error: 'Некорректный формат данных' }, { status: 400 });
    }

    const { id, name, weight, description } = body;
    const validatedId = validateId(id);

    if (!validatedId) {
      return NextResponse.json(
        { error: 'ID контейнера обязателен' },
        { status: 400 }
      );
    }

    // Проверяем существование
    const existing = await db.containerType.findUnique({
      where: { id: validatedId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Контейнер не найден' },
        { status: 404 }
      );
    }

    // Валидация
    const validatedName = name !== undefined ? validateRequiredStringName(name) : null;
    if (name !== undefined && !validatedName) {
      return NextResponse.json(
        { error: 'Название должно содержать минимум 2 символа' },
        { status: 400 }
      );
    }

    const validatedWeight = weight !== undefined ? validateNumber(weight, 0.1, 1000000) : undefined;
    if (weight !== undefined && validatedWeight === null) {
      return NextResponse.json(
        { error: 'Вес должен быть больше 0' },
        { status: 400 }
      );
    }

    // Проверяем уникальность названия (если меняем)
    if (validatedName && validatedName !== existing.name) {
      const duplicate = await db.containerType.findFirst({
        where: { 
          name: validatedName,
          id: { not: validatedId },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Контейнер с таким названием уже существует' },
          { status: 400 }
        );
      }
    }

    const container = await db.containerType.update({
      where: { id: validatedId },
      data: {
        name: validatedName || existing.name,
        weight: validatedWeight ?? existing.weight,
        description: description !== undefined ? (validateString(description, MAX_LENGTHS.description) || null) : existing.description,
      },
    });

    return NextResponse.json({ container });
  } catch (error) {
    console.error('Error updating container:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении контейнера' },
      { status: 500 }
    );
  }
}

// Удалить тип контейнера (только руководитель/старший мастер)
export async function DELETE(request: NextRequest) {
  try {
    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    if (actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MASTER') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = validateId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json(
        { error: 'ID контейнера обязателен' },
        { status: 400 }
      );
    }

    // Удаляем контейнер (связи в инвентаризации получают SetNull)
    await db.containerType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting container:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении контейнера' },
      { status: 500 }
    );
  }
}

// Вспомогательная валидация названия контейнера
function validateRequiredStringName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return null;
  return trimmed;
}
