import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Проверка валидности сессии пользователя
// Используется для:
// - Мгновенной деавторизации при удалении/блокировке
// - Обновления данных пользователя (роль, имя и т.д.) при изменении руководителем
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const currentRole = searchParams.get('role'); // Текущая роль в сессии
    const currentName = searchParams.get('name'); // Текущее имя в сессии

    if (!userId) {
      return NextResponse.json({ valid: false, reason: 'no_user_id' });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isApproved: true,
        bio: true,
        phone: true,
        city: true,
        branch: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Пользователь не существует
    if (!user) {
      return NextResponse.json({ valid: false, reason: 'user_not_found' });
    }

    // Пользователь был удалён (soft delete)
    if (user.deletedAt) {
      return NextResponse.json({ valid: false, reason: 'user_deleted' });
    }

    // Пользователь не подтверждён (заблокирован)
    if (!user.isApproved) {
      return NextResponse.json({ valid: false, reason: 'user_not_approved' });
    }

    // Проверяем, изменились ли данные пользователя
    const roleChanged = currentRole && currentRole !== user.role;
    const nameChanged = currentName && currentName !== user.name;

    // Если данные изменились, возвращаем обновлённого пользователя
    if (roleChanged || nameChanged) {
      return NextResponse.json({
        valid: true,
        userUpdated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          isApproved: user.isApproved,
          bio: user.bio,
          phone: user.phone,
          city: user.city,
          branch: user.branch,
          deletedAt: user.deletedAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        changes: {
          roleChanged,
          nameChanged,
        },
      });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Validate session error:', error);
    return NextResponse.json({ valid: false, reason: 'error' });
  }
}
