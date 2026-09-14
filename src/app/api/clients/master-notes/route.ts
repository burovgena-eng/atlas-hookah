import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { validateId, validateString, MAX_LENGTHS } from '@/lib/validation';

// Создать или обновить личную заметку мастера о клиенте
export async function POST(request: NextRequest) {
  try {
    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }

    const { clientNoteId, notes } = body;
    const validatedClientNoteId = validateId(clientNoteId);

    if (!validatedClientNoteId) {
      return NextResponse.json({ error: 'ID клиента обязателен' }, { status: 400 });
    }

    // Проверяем, что клиент существует и доступен мастеру
    const clientNote = await db.clientNote.findUnique({
      where: { id: validatedClientNoteId },
    });

    if (!clientNote) {
      return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 });
    }

    // Проверяем доступ: либо это свой клиент, либо публичный
    if (clientNote.masterId !== user.id && !clientNote.isPublic) {
      return NextResponse.json({ error: 'Нет доступа к этому клиенту' }, { status: 403 });
    }

    // Используем upsert для создания или обновления заметки
    const masterNote = await db.clientMasterNote.upsert({
      where: {
        clientNoteId_masterId: {
          clientNoteId: validatedClientNoteId,
          masterId: user.id,
        },
      },
      update: {
        notes: validateString(notes, MAX_LENGTHS.notes) || '',
      },
      create: {
        clientNoteId: validatedClientNoteId,
        masterId: user.id,
        notes: validateString(notes, MAX_LENGTHS.notes) || '',
      },
    });

    return NextResponse.json({ masterNote });
  } catch (error) {
    console.error('Create/update master note error:', error);
    return NextResponse.json({ error: 'Ошибка при сохранении заметки' }, { status: 500 });
  }
}

// Удалить личную заметку мастера о клиенте
export async function DELETE(request: NextRequest) {
  try {
    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientNoteId = validateId(searchParams.get('clientNoteId'));

    if (!clientNoteId) {
      return NextResponse.json({ error: 'ID клиента обязателен' }, { status: 400 });
    }

    await db.clientMasterNote.delete({
      where: {
        clientNoteId_masterId: {
          clientNoteId,
          masterId: user.id,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete master note error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении заметки' }, { status: 500 });
  }
}
