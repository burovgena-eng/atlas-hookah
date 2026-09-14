// Проверка валидности сессии пользователя (по серверному токену сессии)
// Используется для:
// - Мгновенной деавторизации при удалении/блокировке
// - Обновления данных пользователя (роль, имя, аватар) при изменении руководителем
// Внимание: персональные данные (email, телефон, bio) намеренно не возвращаются —
// маршрут доступен любому, у кого есть токен, и не должен использоваться для их получения.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    // Нет валидной сессии
    if (!user) {
      return NextResponse.json({ valid: false, reason: 'no_session' });
    }

    const { searchParams } = new URL(request.url);
    const currentRole = searchParams.get('role');
    const currentName = searchParams.get('name');
    const currentAvatar = searchParams.get('avatar');

    const roleChanged = currentRole !== null && currentRole !== user.role;
    const nameChanged = currentName !== null && currentName !== user.name;
    const avatarChanged = currentAvatar !== null && currentAvatar !== (user.avatar || '');

    // Если данные изменились, возвращаем обновлённые публичные поля
    // (email/телефон/bio не отдаваем — клиент хранит их в своей копии пользователя)
    if (roleChanged || nameChanged || avatarChanged) {
      return NextResponse.json({
        valid: true,
        userUpdated: true,
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          isApproved: user.isApproved,
          city: user.city,
          branch: user.branch,
        },
        changes: {
          roleChanged,
          nameChanged,
          avatarChanged,
        },
      });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Validate session error:', error);
    return NextResponse.json({ valid: false, reason: 'error' });
  }
}
