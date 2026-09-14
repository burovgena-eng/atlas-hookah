/**
 * Утилиты для валидации и санитизации входных данных API
 * Защита от: XSS, SQL Injection, невалидных типов, очень длинных строк
 */

// Максимальные длины для строковых полей
export const MAX_LENGTHS = {
  name: 100,
  email: 255,
  password: 128,
  phone: 20,
  bio: 500,
  title: 200,
  content: 50000,
  description: 2000,
  notes: 2000,
  url: 500,
  search: 100,
  clientName: 100,
  clientPhone: 20,
  preferences: 1000,
  tobacco: 100,
  brand: 50,
  instructions: 10000,
  tips: 1000,
  bowlType: 50,
  city: 50,
  branch: 50,
} as const;

// CUID формат (Prisma использует cuid2)
const CUID_REGEX = /^[a-z0-9]{20,30}$/;

// Разрешённые роли
export const VALID_ROLES = ['HOOKAH_MASTER', 'SENIOR_MASTER', 'ADMIN', 'MANAGER'] as const;
export type UserRole = typeof VALID_ROLES[number];

// Разрешённые типы уведомлений
export const VALID_NOTIFICATION_TYPES = ['MESSAGE', 'RECIPE_ADDED', 'RECIPE_UPDATED', 'RECIPE_DELETED', 'KNOWLEDGE_ADDED', 'KNOWLEDGE_UPDATED', 'KNOWLEDGE_DELETED'] as const;

// Разрешённые visibility значения
export const VALID_VISIBILITY = ['COMMON', 'MASTER', 'ADMIN'] as const;

/**
 * Проверяет, что значение является непустой строкой
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Проверяет, что значение является строкой (включая пустые)
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Проверяет, что значение является числом
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Проверяет, что значение является boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Проверяет, что значение является объектом (не null, не массив)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Проверяет, что значение является массивом
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Валидирует CUID формат ID
 */
export function isValidCuid(id: unknown): id is string {
  if (!isNonEmptyString(id)) return false;
  return CUID_REGEX.test(id);
}

/**
 * Валидирует ID, возвращая null если невалиден
 */
export function validateId(id: unknown): string | null {
  if (!isValidCuid(id)) return null;
  return id;
}

/**
 * Валидирует и ограничивает длину строки
 */
export function validateString(value: unknown, maxLength: number, required: boolean = false): string | null {
  if (value === null || value === undefined) {
    return required ? null : null;
  }
  
  if (!isString(value)) {
    return null;
  }
  
  const trimmed = value.trim();
  
  if (required && trimmed.length === 0) {
    return null;
  }
  
  if (trimmed.length > maxLength) {
    return trimmed.substring(0, maxLength);
  }
  
  return trimmed || null;
}

/**
 * Валидирует и ограничивает длину строки (требуется обязательное поле)
 */
export function validateRequiredString(value: unknown, maxLength: number): string | null {
  if (!isNonEmptyString(value)) return null;
  
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return trimmed.substring(0, maxLength);
  }
  return trimmed || null;
}

/**
 * Валидирует email
 */
export function validateEmail(email: unknown): string | null {
  if (!isNonEmptyString(email)) return null;
  
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length > MAX_LENGTHS.email) return null;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return null;
  
  return trimmed;
}

/**
 * Валидирует пароль
 */
export function validatePassword(password: unknown): string | null {
  if (!isString(password)) return null;
  
  // Защита от DoS через очень длинные пароли
  if (password.length < 6 || password.length > MAX_LENGTHS.password) return null;
  
  return password;
}

/**
 * Валидирует роль пользователя
 */
export function validateRole(role: unknown): UserRole | null {
  if (!isNonEmptyString(role)) return null;
  if (!VALID_ROLES.includes(role as UserRole)) return null;
  return role as UserRole;
}

/**
 * Валидирует тип уведомления
 */
export function validateNotificationType(type: unknown): string | null {
  if (!isNonEmptyString(type)) return null;
  if (!VALID_NOTIFICATION_TYPES.includes(type as any)) return null;
  return type;
}

/**
 * Валидирует visibility
 */
export function validateVisibility(visibility: unknown): string | null {
  if (!isNonEmptyString(visibility)) return null;
  if (!VALID_VISIBILITY.includes(visibility as any)) return null;
  return visibility;
}

/**
 * Валидирует телефон (опционально)
 */
export function validatePhone(phone: unknown): string | null {
  if (phone === null || phone === undefined || phone === '') return null;
  if (!isString(phone)) return null;
  
  const trimmed = phone.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_LENGTHS.phone) return null;
  
  if (!/^[\d\s\-+()]+$/.test(trimmed)) return null;
  
  return trimmed;
}

/**
 * Валидирует URL (опционально)
 */
export function validateUrl(url: unknown): string | null {
  if (url === null || url === undefined || url === '') return null;
  if (!isString(url)) return null;
  
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_LENGTHS.url) return null;
  
  // Только относительные URL или https
  if (!trimmed.startsWith('/') && !trimmed.startsWith('https://')) {
    return null;
  }
  
  return trimmed;
}

/**
 * Валидирует число с ограничениями
 */
export function validateNumber(value: unknown, min?: number, max?: number): number | null {
  let num: number;
  
  if (isNumber(value)) {
    num = value;
  } else if (isString(value)) {
    // Пробуем парсить строку
    const parsed = parseFloat(value);
    if (isNaN(parsed) || !isFinite(parsed)) return null;
    num = parsed;
  } else {
    return null;
  }
  
  if (min !== undefined && num < min) return null;
  if (max !== undefined && num > max) return null;
  
  return num;
}

/**
 * Валидирует целое число
 */
export function validateInteger(value: unknown, min?: number, max?: number): number | null {
  const num = validateNumber(value, min, max);
  if (num === null) return null;
  if (!Number.isInteger(num)) return null;
  return num;
}

/**
 * Валидирует boolean
 */
export function validateBoolean(value: unknown): boolean {
  if (isBoolean(value)) return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return false;
}

/**
 * Валидирует дату
 */
export function validateDate(date: unknown): Date | null {
  if (date === null || date === undefined || date === '') return null;
  
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (!isString(date)) return null;
  
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return null;
  
  return parsed;
}

/**
 * Санитизирует строку от потенциально опасного HTML
 * (базовая защита от XSS для отображения в UI)
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Валидирует массив ингредиентов
 */
export function validateIngredients(ingredients: unknown): Array<{ tobacco: string; brand: string | null; amount: string | null; layer: string | null }> | null {
  if (!isArray(ingredients)) return null;
  if (ingredients.length === 0) return [];
  if (ingredients.length > 50) return null; // Максимум 50 ингредиентов
  
  const validIngredients: Array<{ tobacco: string; brand: string | null; amount: string | null; layer: string | null }> = [];
  
  for (const ing of ingredients) {
    if (!isObject(ing)) continue;
    
    const tobacco = validateRequiredString(ing.tobacco, MAX_LENGTHS.tobacco);
    if (!tobacco) continue; // Пропускаем невалидные ингредиенты
    
    validIngredients.push({
      tobacco,
      brand: validateString(ing.brand, MAX_LENGTHS.brand),
      amount: validateString(ing.amount, 20),
      layer: validateString(ing.layer, 20),
    });
  }
  
  return validIngredients.length > 0 ? validIngredients : null;
}

/**
 * Валидирует параметр limit для пагинации
 */
export function validateLimit(limit: unknown, defaultVal: number = 50, maxVal: number = 100): number {
  const num = validateInteger(limit, 1, maxVal);
  return num ?? defaultVal;
}

/**
 * Валидирует параметр offset для пагинации
 */
export function validateOffset(offset: unknown): number {
  const num = validateInteger(offset, 0, 1000000);
  return num ?? 0;
}

/**
 * Результат валидации
 */
export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  error: string;
}

export type ValidationResponse<T> = ValidationResult<T> | ValidationError;

/**
 * Создаёт ошибку валидации
 */
export function validationError(message: string): ValidationError {
  return { success: false, error: message };
}

/**
 * Создаёт успешный результат валидации
 */
export function validationSuccess<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}
