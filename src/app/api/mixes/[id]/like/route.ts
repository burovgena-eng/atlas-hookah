import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Поставить/убрать лайк
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем, есть ли уже лайк
    const existingLike = await db.mixLike.findUnique({
      where: {
        mixId_userId: {
          mixId: id,
          userId,
        },
      },
    });

    if (existingLike) {
      // Убираем лайк
      await db.mixLike.delete({
        where: { id: existingLike.id },
      });
      return NextResponse.json({ liked: false });
    } else {
      // Ставим лайк
      await db.mixLike.create({
        data: {
          mixId: id,
          userId,
        },
      });
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    return NextResponse.json({ error: 'Ошибка при обработке лайка' }, { status: 500 });
  }
}
