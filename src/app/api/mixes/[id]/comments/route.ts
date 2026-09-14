import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Получить комментарии к миксу
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const comments = await db.mixComment.findMany({
      where: { mixId: id },
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
    const { id } = await params;
    const body = await request.json();
    const { userId, content } = body;

    if (!userId || !content) {
      return NextResponse.json({ error: 'Требуется авторизация и текст комментария' }, { status: 400 });
    }

    const comment = await db.mixComment.create({
      data: {
        mixId: id,
        userId,
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
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');
    const userId = searchParams.get('userId');

    if (!commentId || !userId) {
      return NextResponse.json({ error: 'ID комментария и пользователь обязательны' }, { status: 400 });
    }

    // Проверяем права
    const comment = await db.mixComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Комментарий не найден' }, { status: 404 });
    }

    if (comment.userId !== userId) {
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
