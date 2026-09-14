import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Создать или обновить личную заметку мастера о клиенте
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientNoteId, masterId, notes } = body;

    if (!clientNoteId || !masterId) {
      return NextResponse.json({ error: 'Обязательные поля должны быть заполнены' }, { status: 400 });
    }

    // Проверяем, что клиент существует и доступен мастеру
    const clientNote = await db.clientNote.findUnique({
      where: { id: clientNoteId },
    });

    if (!clientNote) {
      return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 });
    }

    // Проверяем доступ: либо это свой клиент, либо публичный
    if (clientNote.masterId !== masterId && !clientNote.isPublic) {
      return NextResponse.json({ error: 'Нет доступа к этому клиенту' }, { status: 403 });
    }

    // Используем upsert для создания или обновления заметки
    const masterNote = await db.clientMasterNote.upsert({
      where: {
        clientNoteId_masterId: {
          clientNoteId,
          masterId,
        },
      },
      update: {
        notes: notes || '',
      },
      create: {
        clientNoteId,
        masterId,
        notes: notes || '',
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
    const { searchParams } = new URL(request.url);
    const clientNoteId = searchParams.get('clientNoteId');
    const masterId = searchParams.get('masterId');

    if (!clientNoteId || !masterId) {
      return NextResponse.json({ error: 'Обязательные параметры' }, { status: 400 });
    }

    await db.clientMasterNote.delete({
      where: {
        clientNoteId_masterId: {
          clientNoteId,
          masterId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete master note error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении заметки' }, { status: 500 });
  }
}
