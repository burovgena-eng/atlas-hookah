// API для инвентаризации табака
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { TobaccoCategory } from '@prisma/client';
import { 
  validateId, 
  validateString, 
  validateNumber,
  validateInteger,
  validateLimit,
  validateOffset,
  MAX_LENGTHS,
  isObject,
  isArray,
} from '@/lib/validation';

// Маппинг категорий для отображения
const CATEGORY_LABELS: Record<TobaccoCategory, string> = {
  CATEGORY_A: 'Категория A (Бестабачные)',
  CATEGORY_C: 'Категория C (Табачные)',
  CATEGORY_D: 'Категория D (Сигарный лист)',
};

// Допустимые категории для валидации пользовательского ввода
const VALID_CATEGORIES: string[] = Object.values(TobaccoCategory);

// Получить сессии инвентаризации
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = validateLimit(searchParams.get('limit'), 50, 100);
    const offset = validateOffset(searchParams.get('offset'));

    // Актор и роль только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Фильтры
    const where: Record<string, unknown> = {};

    // Роль определяет доступ
    if (actor.role === 'MANAGER' || actor.role === 'SENIOR_MASTER') {
      // Руководители и старшие мастера видят все записи
    } else {
      // Обычные мастера видят только свои записи
      where.masterId = actor.id;
    }

    // Получаем сессии с записями
    const sessions = await db.inventorySession.findMany({
      where,
      include: {
        records: {
          include: {
            containers: {
              include: {
                containerType: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Получаем автора для каждой сессии
    const sessionsWithAuthor = await Promise.all(
      sessions.map(async (session) => {
        const author = await db.user.findUnique({
          where: { id: session.masterId },
          select: { id: true, name: true, city: true, branch: true },
        });
        
        // Добавляем labels к категориям
        const recordsWithLabels = session.records.map(record => ({
          ...record,
          categoryLabel: CATEGORY_LABELS[record.category],
        }));
        
        return {
          ...session,
          records: recordsWithLabels,
          author,
          totalNetWeight: session.records.reduce((sum, r) => sum + r.netWeight, 0),
        };
      })
    );

    // Общее количество для пагинации
    const total = await db.inventorySession.count({ where });

    return NextResponse.json({ 
      sessions: sessionsWithAuthor, 
      total,
      categoryLabels: CATEGORY_LABELS,
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении записей инвентаризации' },
      { status: 500 }
    );
  }
}

// Создать сессию инвентаризации с записями
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Некорректный формат запроса' },
        { status: 400 }
      );
    }
    
    if (!isObject(body)) {
      return NextResponse.json(
        { error: 'Некорректный формат данных' },
        { status: 400 }
      );
    }
    
    const { 
      records, // Массив записей по категориям: [{ category, totalWeight, containers }, ...]
      notes,
    } = body;

    // Актор только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json(
        { error: 'Пользователь не авторизован' },
        { status: 401 }
      );
    }

    // Валидация
    if (!isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'Нет данных для сохранения' },
        { status: 400 }
      );
    }

    // Ограничение на количество записей
    if (records.length > 10) {
      return NextResponse.json(
        { error: 'Слишком много записей (максимум 10)' },
        { status: 400 }
      );
    }

    // Получаем пользователя
    const user = await db.user.findUnique({
      where: { id: actor.id },
      select: { id: true, city: true, branch: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    // Подготавливаем данные для записей
    const recordsData: Array<{
      category: TobaccoCategory;
      totalWeight: number;
      containersWeight: number;
      netWeight: number;
      containers: { create: { containerTypeId: string; quantity: number }[] };
    }> = [];
    
    for (const record of records) {
      if (!isObject(record)) continue;
      
      // Валидация категории
      if (!record.category || typeof record.category !== 'string' ||
          !VALID_CATEGORIES.includes(record.category)) {
        continue;
      }
      
      // Валидация веса
      const totalWeight = validateNumber(record.totalWeight, 0, 10000000); // Максимум 10 тонн
      if (totalWeight === null || totalWeight <= 0) {
        continue;
      }

      // Считаем вес контейнеров
      let containersWeight = 0;
      const containerItems: { containerTypeId: string; quantity: number }[] = [];

      if (isArray(record.containers) && record.containers.length > 0) {
        // Ограничение на количество контейнеров
        if (record.containers.length > 50) {
          return NextResponse.json(
            { error: 'Слишком много типов контейнеров' },
            { status: 400 }
          );
        }
        
        for (const item of record.containers) {
          if (!isObject(item)) continue;
          
          const containerTypeId = validateId(item.containerTypeId);
          const quantity = validateInteger(item.quantity, 1, 10000);
          
          if (!containerTypeId || quantity === null) {
            continue;
          }

          const containerType = await db.containerType.findUnique({
            where: { id: containerTypeId },
          });

          if (containerType) {
            containersWeight += containerType.weight * quantity;
            containerItems.push({
              containerTypeId,
              quantity,
            });
          }
        }
      }

      // Чистый вес табака
      const netWeight = totalWeight - containersWeight;

      if (netWeight < 0) {
        return NextResponse.json(
          { error: `Вес контейнеров превышает общий вес для ${CATEGORY_LABELS[record.category as TobaccoCategory]}` },
          { status: 400 }
        );
      }

      recordsData.push({
        category: record.category as TobaccoCategory,
        totalWeight,
        containersWeight,
        netWeight,
        containers: {
          create: containerItems,
        },
      });
    }

    if (recordsData.length === 0) {
      return NextResponse.json(
        { error: 'Нет корректных данных для сохранения' },
        { status: 400 }
      );
    }

    // Валидируем заметки
    const validatedNotes = validateString(notes, MAX_LENGTHS.notes);

    // Создаём сессию с записями
    const session = await db.inventorySession.create({
      data: {
        notes: validatedNotes,
        masterId: actor.id,
        city: user.city,
        branch: user.branch,
        records: {
          create: recordsData,
        },
      },
      include: {
        records: {
          include: {
            containers: {
              include: {
                containerType: true,
              },
            },
          },
        },
      },
    });

    // Добавляем labels
    const sessionWithLabels = {
      ...session,
      records: session.records.map(r => ({
        ...r,
        categoryLabel: CATEGORY_LABELS[r.category],
      })),
      totalNetWeight: session.records.reduce((sum, r) => sum + r.netWeight, 0),
    };

    return NextResponse.json({ session: sessionWithLabels });
  } catch (error) {
    console.error('Error creating inventory session:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании записи инвентаризации' },
      { status: 500 }
    );
  }
}

// Удалить сессию инвентаризации
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = validateId(searchParams.get('id')); // ID сессии

    if (!id) {
      return NextResponse.json(
        { error: 'ID записи обязателен' },
        { status: 400 }
      );
    }

    // Актор и роль только из серверной сессии
    const actor = await getAuthUser(request);
    if (!actor) {
      return NextResponse.json(
        { error: 'Пользователь не авторизован' },
        { status: 401 }
      );
    }

    // Находим сессию
    const session = await db.inventorySession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Запись не найдена' },
        { status: 404 }
      );
    }

    // Проверяем права: только автор или руководитель/старший мастер могут удалить
    if (session.masterId !== actor.id && actor.role !== 'MANAGER' && actor.role !== 'SENIOR_MASTER') {
      return NextResponse.json(
        { error: 'У вас нет прав для удаления этой записи' },
        { status: 403 }
      );
    }

    // Удаляем сессию (каскадно удалятся записи и контейнеры)
    await db.inventorySession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting inventory session:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении записи' },
      { status: 500 }
    );
  }
}
