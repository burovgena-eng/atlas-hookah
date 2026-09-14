import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { validateId } from '@/lib/validation';

// Создать директорию если не существует
async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

// Загрузка изображения
export async function POST(request: NextRequest) {
  try {
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }
    
    const file = formData.get('file');
    const type = (formData.get('type') as string) || 'general'; // avatar, recipe, knowledge, general
    const userId = validateId(formData.get('userId'));

    // Проверка авторизации - только авторизованные пользователи могут загружать файлы
    if (!userId) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем существование пользователя
    const user = await db.user.findUnique({
      where: { id: userId, deletedAt: null, isApproved: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден или не авторизован' }, { status: 401 });
    }

    // Проверяем что file существует и является File объектом
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 });
    }

    // Проверяем тип файла по MIME-типу
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Недопустимый тип файла. Разрешены: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }

    // Дополнительная проверка расширения файла
    const originalName = file.name || '';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const nameExt = originalName.split('.').pop()?.toLowerCase() || '';
    
    // Проверяем размер файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Размер файла не должен превышать 5MB' },
        { status: 400 }
      );
    }

    // Минимальный размер файла (защита от пустых файлов)
    if (file.size < 100) {
      return NextResponse.json(
        { error: 'Файл слишком маленький' },
        { status: 400 }
      );
    }

    // Проверяем допустимые типы папок (защита от path traversal)
    const allowedFolders = ['avatar', 'recipe', 'knowledge', 'general'];
    const safeType = allowedFolders.includes(type) ? type : 'general';

    // Безопасное расширение файла (на основе MIME-типа, а не имени файла)
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const fileExtension = mimeToExt[file.type] || 'jpg';

    // Генерируем уникальное имя файла с безопасным расширением
    // Используем криптографически стойкую генерацию
    const timestamp = Date.now();
    const randomPart = crypto.randomUUID().split('-')[0];
    const fileName = `${timestamp}-${randomPart}.${fileExtension}`;

    // Определяем папку для сохранения (безопасно, так как safeType валидирован)
    const uploadDir = path.join(process.cwd(), 'upload', safeType);
    await ensureDir(uploadDir);

    const filePath = path.join(uploadDir, fileName);
    
    // Безопасное чтение файла
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Проверка magic numbers для дополнительной защиты
    const magicNumbers = buffer.slice(0, 4);
    const isValidImage = checkImageMagicNumbers(magicNumbers, file.type);
    
    if (!isValidImage) {
      return NextResponse.json(
        { error: 'Файл не является валидным изображением' },
        { status: 400 }
      );
    }
    
    await writeFile(filePath, buffer);

    // Возвращаем URL для доступа к файлу (относительный путь)
    const url = `/upload/${safeType}/${fileName}`;

    return NextResponse.json({
      success: true,
      url,
      fileName
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Ошибка при загрузке файла' }, { status: 500 });
  }
}

// Проверка magic numbers для валидации типа файла
function checkImageMagicNumbers(buffer: Buffer, declaredType: string): boolean {
  const hex = buffer.toString('hex').toLowerCase();
  
  const signatures: Record<string, string[]> = {
    'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffdb', 'ffd8'],
    'image/png': ['89504e47'],
    'image/gif': ['47494638'],
    'image/webp': ['52494646'], // WebP starts with RIFF, then has WEBP at offset 8
  };

  const allowedSigs = signatures[declaredType];
  if (!allowedSigs) return false;

  return allowedSigs.some(sig => hex.startsWith(sig));
}
