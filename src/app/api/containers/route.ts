// API для управления типами контейнеров
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Получить все типы контейнеров
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const containerId = searchParams.get('id');

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

// Создать новый тип контейнера
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, weight, description } = body;

    // Валидация
    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Название должно содержать минимум 2 символа' },
        { status: 400 }
      );
    }

    if (!weight || weight <= 0) {
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
        name: name.trim(),
        weight: parseFloat(weight),
        description: description?.trim() || null,
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

// Обновить тип контейнера
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, weight, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID контейнера обязателен' },
        { status: 400 }
      );
    }

    // Проверяем существование
    const existing = await db.containerType.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Контейнер не найден' },
        { status: 404 }
      );
    }

    // Валидация
    if (name && name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Название должно содержать минимум 2 символа' },
        { status: 400 }
      );
    }

    if (weight !== undefined && weight <= 0) {
      return NextResponse.json(
        { error: 'Вес должен быть больше 0' },
        { status: 400 }
      );
    }

    // Проверяем уникальность названия (если меняем)
    if (name && name.trim() !== existing.name) {
      const duplicate = await db.containerType.findFirst({
        where: { 
          name: name.trim(),
          id: { not: id },
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
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        weight: weight !== undefined ? parseFloat(weight) : existing.weight,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
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

// Удалить тип контейнера
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID контейнера обязателен' },
        { status: 400 }
      );
    }

    // Удаляем контейнер (связи в inventoryContainerItem станут null благодаря SetNull)
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
