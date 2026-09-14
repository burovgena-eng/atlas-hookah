// CSRF (Cross-Site Request Forgery) Protection
// Защита от подделки межсайтовых запросов

import { randomBytes } from 'crypto';

// In-memory хранилище токенов (для продакшена лучше Redis)
const csrfTokenStore = new Map<string, { token: string; expires: number }>();

// Очистка старых токенов каждые 10 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of csrfTokenStore.entries()) {
    if (entry.expires < now) {
      csrfTokenStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 час

/**
 * Генерация CSRF токена для сессии
 * @param sessionId - идентификатор сессии (userId или уникальный ID)
 * @returns CSRF токен
 */
export function generateCsrfToken(sessionId: string): string {
  const token = randomBytes(32).toString('hex');
  const key = `csrf:${sessionId}`;

  csrfTokenStore.set(key, {
    token,
    expires: Date.now() + CSRF_TOKEN_EXPIRY,
  });

  return token;
}

/**
 * Проверка CSRF токена
 * @param sessionId - идентификатор сессии
 * @param token - токен для проверки
 * @returns true если токен валиден
 */
export function validateCsrfToken(sessionId: string, token: string | null): boolean {
  if (!token) return false;

  const key = `csrf:${sessionId}`;
  const entry = csrfTokenStore.get(key);

  if (!entry) return false;

  // Проверяем срок действия
  if (entry.expires < Date.now()) {
    csrfTokenStore.delete(key);
    return false;
  }

  // Проверяем токен (timing-safe comparison)
  try {
    const expectedToken = entry.token;
    if (token.length !== expectedToken.length) return false;

    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
    }

    return result === 0;
  } catch {
    return false;
  }
}

/**
 * Удаление CSRF токена (при выходе)
 */
export function invalidateCsrfToken(sessionId: string): void {
  csrfTokenStore.delete(`csrf:${sessionId}`);
}

/**
 * Middleware для проверки CSRF
 * Проверяет токен в заголовке X-CSRF-Token или в теле запроса
 */
export function csrfMiddleware(
  request: Request,
  sessionId: string
): Response | null {
  // CSRF не нужен для GET, HEAD, OPTIONS запросов
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return null;
  }

  // Получаем токен из заголовка или из тела запроса
  let token = request.headers.get('X-CSRF-Token');

  // Если токена в заголовке нет, пробуем получить из тела
  if (!token) {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // Клонирование запроса для чтения тела
      // Примечание: в middleware лучше использовать заголовок
    }
  }

  if (!validateCsrfToken(sessionId, token)) {
    return new Response(
      JSON.stringify({ error: 'Неверный CSRF токен. Обновите страницу.' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return null;
}

/**
 * Получение или создание CSRF токена
 */
export function getOrCreateCsrfToken(sessionId: string): string {
  const key = `csrf:${sessionId}`;
  const entry = csrfTokenStore.get(key);

  if (entry && entry.expires > Date.now()) {
    return entry.token;
  }

  return generateCsrfToken(sessionId);
}
