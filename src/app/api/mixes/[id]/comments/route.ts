import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { validateId, validateRequiredString, MAX_LENGTHS } from '@/lib/validation';

// Получить комментарии к миксу
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mixId = validateId(id);

    if (!mixId) {
      return NextResponse.json({ error: 'Некорректный ID микса' }, { status: 400 });
    }

    const comments = await db.mixComment.findMany({
      where: { mixId },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json({ error: 'Ошибка при получении комментариев' }, { status: 500 });
  }
}

// Добавить комментарий
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { id } = await params;
    const mixId = validateId(id);

    if (!mixId) {
      return NextResponse.json({ error: 'Некорректный ID микса' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }

    const content = validateRequiredString(body?.content, 1000);
    if (!content) {
      return NextResponse.json({ error: 'Текст комментария обязателен' }, { status: 400 });
    }

    const comment = await db.mixComment.create({
      data: {
        mixId,
        userId: user.id,
        content,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, role: true },
        },
      },
    });

    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json({ error: 'Ошибка при создании комментария' }, { status: 500 });
  }
}

// Удалить комментарий
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const commentId = validateId(searchParams.get('commentId'));

    if (!commentId) {
      return NextResponse.json({ error: 'ID комментария обязателен' }, { status: 400 });
    }

    // Проверяем права
    const comment = await db.mixComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Комментарий не найден' }, { status: 404 });
    }

    if (comment.userId !== user.id) {
      return NextResponse.json({ error: 'Нет прав на удаление' }, { status: 403 });
    }

    await db.mixComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении комментария' }, { status: 500 });
  }
}
