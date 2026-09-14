// Серверная аутентификация на основе сессий
// Токен сессии генерируется при входе, хранится на клиенте в localStorage
// и передаётся в заголовке X-Session-Token. В БД хранится только SHA-256 хеш.

import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';
import type { User } from '@prisma/client';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

// Поля пользователя, безопасные для отправки на клиент (без пароля)
export const SAFE_USER_SELECT = {
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
  birthDate: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Создать сессию для пользователя.
 * Возвращает сырой токен — он отправляется клиенту только один раз.
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    },
  });

  // Периодическая чистка просроченных сессий (лёгкая, на каждый логин)
  db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

  return { token, expiresAt };
}

/**
 * Резолв пользователя из запроса по заголовку X-Session-Token.
 * Возвращает активного (не удалённого, подтверждённого) пользователя или null.
 */
export async function getAuthUser(request: Request): Promise<User | null> {
  const token = request.headers.get('X-Session-Token');
  if (!token || token.length !== 64) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.deletedAt || !session.user.isApproved) return null;

  return session.user;
}

/**
 * Удалить сессию (выход).
 */
export async function deleteSession(token: string | null): Promise<void> {
  if (!token || token.length !== 64) return;
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
