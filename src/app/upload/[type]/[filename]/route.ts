import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Разрешённые подпапки uploads
const ALLOWED_TYPES = ['avatar', 'recipe', 'knowledge', 'general'];

// Получить загруженный файл
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; filename: string }> }
) {
  try {
    const { type, filename } = await params;

    // Проверяем тип (защита от traversal по папке)
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Недопустимый тип' }, { status: 400 });
    }

    // Защита от path traversal в имени файла:
    // только безопасные символы, без разделителей путей и ".."
    if (
      !filename ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('..') ||
      !/^[a-zA-Z0-9._-]+$/.test(filename)
    ) {
      return NextResponse.json({ error: 'Недопустимое имя файла' }, { status: 400 });
    }

    // Формируем путь к файлу и убеждаемся, что он остаётся внутри upload/
    const uploadRoot = path.join(process.cwd(), 'upload');
    const filePath = path.join(uploadRoot, type, filename);

    if (!filePath.startsWith(uploadRoot + path.sep)) {
      return NextResponse.json({ error: 'Недопустимый путь' }, { status: 400 });
    }

    // Проверяем существование файла
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 404 });
    }

    // Получаем информацию о файле
    const fileStat = await stat(filePath);

    // Определяем content-type по расширению
    const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
    const contentTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    const contentType = contentTypes[ext];

    // Отдаём только известные типы изображений (никаких octet-stream)
    if (!contentType) {
      return NextResponse.json({ error: 'Недопустимый тип файла' }, { status: 400 });
    }

    // Читаем файл
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json({ error: 'Ошибка при чтении файла' }, { status: 500 });
  }
}
