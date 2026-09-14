import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Получить загруженный файл
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; filename: string }> }
) {
  try {
    const { type, filename } = await params;
    
    // Проверяем тип (безопасность)
    const allowedTypes = ['avatar', 'recipe', 'knowledge', 'general'];
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: 'Недопустимый тип' }, { status: 400 });
    }

    // Формируем путь к файлу
    const filePath = path.join(process.cwd(), 'upload', type, filename);
    
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
    const contentType = contentTypes[ext] || 'application/octet-stream';

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
