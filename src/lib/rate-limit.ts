// Rate Limiting - ограничение количества запросов
// Использует in-memory хранилище (для продакшена лучше Redis)

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

interface RateLimitConfig {
  windowMs: number;      // Временное окно в миллисекундах
  maxRequests: number;   // Максимум запросов в окне
  blockDurationMs: number; // Длительность блокировки
}

// In-memory хранилище (для продакшена использовать Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Очистка старых записей каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Конфигурации для разных типов запросов
export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  // Авторизация - 5 попыток в минуту, блокировка на 15 минут
  auth: {
    windowMs: 60 * 1000,
    maxRequests: 5,
    blockDurationMs: 15 * 60 * 1000,
  },
  // Регистрация - 3 попытки в час, блокировка на 1 час
  register: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    blockDurationMs: 60 * 60 * 1000,
  },
  // Загрузка файлов - 20 файлов в минуту
  upload: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    blockDurationMs: 5 * 60 * 1000,
  },
  // API запросы - 100 запросов в минуту
  api: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    blockDurationMs: 60 * 1000,
  },
  // Отправка уведомлений - 10 в минуту (для руководителей)
  notifications: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    blockDurationMs: 5 * 60 * 1000,
  },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  blocked: boolean;
  retryAfter?: number;
}

/**
 * Проверка лимита запросов
 * @param type - тип ограничения (auth, register, upload, api, notifications)
 * @param identifier - уникальный идентификатор (IP адрес или userId)
 * @returns результат проверки
 */
export function checkRateLimit(
  type: string,
  identifier: string
): RateLimitResult {
  const config = rateLimitConfigs[type] || rateLimitConfigs.api;
  const key = `${type}:${identifier}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  // Если записи нет - создаём новую
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      blocked: false,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
      blocked: false,
    };
  }

  // Если заблокирован - возвращаем ошибку
  if (entry.blocked) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      blocked: true,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  // Увеличиваем счётчик
  entry.count++;

  // Проверяем превышение лимита
  if (entry.count > config.maxRequests) {
    entry.blocked = true;
    entry.resetTime = now + config.blockDurationMs;

    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      blocked: true,
      retryAfter: Math.ceil(config.blockDurationMs / 1000),
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
    blocked: false,
  };
}

/**
 * Получение IP адреса из запроса
 */
export function getClientIP(request: Request): string {
  // Проверяем заголовки прокси
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback - для локальной разработки
  return '127.0.0.1';
}

/**
 * Middleware для проверки rate limit
 * Возвращает null если всё ок, или Response с ошибкой
 */
export function rateLimitMiddleware(
  request: Request,
  type: string,
  identifier?: string
): Response | null {
  const ip = identifier || getClientIP(request);
  const result = checkRateLimit(type, ip);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: result.blocked
          ? 'Слишком много запросов. Попробуйте позже.'
          : 'Превышен лимит запросов',
        retryAfter: result.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfter || 60),
          'X-RateLimit-Limit': String(rateLimitConfigs[type]?.maxRequests || 100),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
        },
      }
    );
  }

  return null;
}
