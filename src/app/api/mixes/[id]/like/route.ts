import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { validateId } from '@/lib/validation';

// Поставить/убрать лайк
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

    // Проверяем, есть ли уже лайк
    const existingLike = await db.mixLike.findUnique({
      where: {
        mixId_userId: {
          mixId,
          userId: user.id,
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
          mixId,
          userId: user.id,
        },
      });
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    return NextResponse.json({ error: 'Ошибка при обработке лайка' }, { status: 500 });
  }
}
