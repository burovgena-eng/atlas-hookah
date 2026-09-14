import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { 
  validateId, 
  validateRequiredString, 
  validateString, 
  validatePhone, 
  validateBoolean,
  validateDate,
  MAX_LENGTHS,
  isObject,
} from '@/lib/validation';

// Получить заметки по клиентам (все публичные + свои личные)
export async function GET(request: NextRequest) {
  try {
    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = validateString(searchParams.get('type'), 20); // 'all', 'my', 'public'

    let clients;

    if (type === 'my') {
      // Только мои клиенты (личные и публичные)
      clients = await db.clientNote.findMany({
        where: { masterId: user.id },
        include: {
          master: {
            select: { id: true, name: true, email: true, role: true },
          },
          masterNotes: {
            where: { masterId: user.id },
            select: { id: true, notes: true, createdAt: true, updatedAt: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    } else if (type === 'public') {
      // Только публичные от других мастеров
      clients = await db.clientNote.findMany({
        where: {
          isPublic: true,
          NOT: { masterId: user.id }, // Исключаем свои
        },
        include: {
          master: {
            select: { id: true, name: true, email: true, role: true },
          },
          masterNotes: {
            where: { masterId: user.id },
            select: { id: true, notes: true, createdAt: true, updatedAt: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    } else {
      // Все: свои + публичные от других
      clients = await db.clientNote.findMany({
        where: {
          OR: [
            { masterId: user.id }, // Свои
            { isPublic: true }, // Публичные
          ],
        },
        include: {
          master: {
            select: { id: true, name: true, email: true, role: true },
          },
          masterNotes: {
            where: { masterId: user.id },
            select: { id: true, notes: true, createdAt: true, updatedAt: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    }

    // Преобразуем для удобства на фронтенде
    const clientsWithMyNote = clients.map(client => ({
      ...client,
      myNote: client.masterNotes?.[0] || null,
      masterNotes: undefined, // Не отправляем все заметки, только свою
    }));

    return NextResponse.json({ clients: clientsWithMyNote });
  } catch (error) {
    console.error('Get clients error:', error);
    return NextResponse.json({ error: 'Ошибка при получении клиентов' }, { status: 500 });
  }
}

// Создать заметку о клиенте
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }
    
    if (!isObject(body)) {
      return NextResponse.json({ error: 'Некорректный формат данных' }, { status: 400 });
    }
    
    const { 
      clientName, 
      clientPhone, 
      preferences, 
      personalNotes, 
      publicNotes, 
      favoriteMix,
      firstVisitCity,
      firstVisitBranch,
      isPublic 
    } = body;

    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const validatedClientName = validateRequiredString(clientName, MAX_LENGTHS.clientName);
    const validatedPublicNotes = validateRequiredString(publicNotes, MAX_LENGTHS.notes);
    
    if (!validatedClientName || !validatedPublicNotes) {
      return NextResponse.json({ error: 'Обязательные поля должны быть заполнены' }, { status: 400 });
    }

    const client = await db.clientNote.create({
      data: {
        masterId: user.id,
        clientName: validatedClientName,
        clientPhone: validatePhone(clientPhone),
        preferences: validateString(preferences, MAX_LENGTHS.preferences),
        personalNotes: validateString(personalNotes, MAX_LENGTHS.notes),
        publicNotes: validatedPublicNotes,
        favoriteMix: validateString(favoriteMix, MAX_LENGTHS.name),
        firstVisitCity: validateString(firstVisitCity, MAX_LENGTHS.city),
        firstVisitBranch: validateString(firstVisitBranch, MAX_LENGTHS.branch),
        isPublic: validateBoolean(isPublic),
      },
      include: {
        master: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json({ client });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json({ error: 'Ошибка при создании заметки' }, { status: 500 });
  }
}

// Обновить заметку о клиенте
export async function PUT(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 });
    }
    
    if (!isObject(body)) {
      return NextResponse.json({ error: 'Некорректный формат данных' }, { status: 400 });
    }
    
    const { 
      id, 
      clientName, 
      clientPhone, 
      preferences, 
      personalNotes, 
      publicNotes, 
      favoriteMix, 
      firstVisitCity,
      firstVisitBranch,
      isPublic,
      visitCount, 
      lastVisit 
    } = body;

    const validatedId = validateId(id);

    if (!validatedId) {
      return NextResponse.json({ error: 'ID заметки обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии - только автор может редактировать
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    const existingClient = await db.clientNote.findUnique({
      where: { id: validatedId },
    });

    if (!existingClient || existingClient.masterId !== user.id) {
      return NextResponse.json({ error: 'Заметка не найдена или нет прав на редактирование' }, { status: 403 });
    }

    // Валидируем числовые поля
    const validatedVisitCount = visitCount !== undefined ? 
      (typeof visitCount === 'number' && visitCount >= 0 ? visitCount : existingClient.visitCount) : 
      existingClient.visitCount;

    const client = await db.clientNote.update({
      where: { id: validatedId },
      data: {
        clientName: validateRequiredString(clientName, MAX_LENGTHS.clientName) || existingClient.clientName,
        clientPhone: clientPhone !== undefined ? validatePhone(clientPhone) : existingClient.clientPhone,
        preferences: preferences !== undefined ? validateString(preferences, MAX_LENGTHS.preferences) : existingClient.preferences,
        personalNotes: personalNotes !== undefined ? validateString(personalNotes, MAX_LENGTHS.notes) : existingClient.personalNotes,
        publicNotes: validateRequiredString(publicNotes, MAX_LENGTHS.notes) || existingClient.publicNotes,
        favoriteMix: favoriteMix !== undefined ? validateString(favoriteMix, MAX_LENGTHS.name) : existingClient.favoriteMix,
        firstVisitCity: firstVisitCity !== undefined ? validateString(firstVisitCity, MAX_LENGTHS.city) : existingClient.firstVisitCity,
        firstVisitBranch: firstVisitBranch !== undefined ? validateString(firstVisitBranch, MAX_LENGTHS.branch) : existingClient.firstVisitBranch,
        isPublic: isPublic !== undefined ? validateBoolean(isPublic) : existingClient.isPublic,
        visitCount: validatedVisitCount,
        lastVisit: lastVisit !== undefined && lastVisit !== null ? validateDate(lastVisit) : existingClient.lastVisit,
      },
      include: {
        master: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json({ client });
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json({ error: 'Ошибка при обновлении заметки' }, { status: 500 });
  }
}

// Удалить заметку о клиенте
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = validateId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'ID заметки обязателен' }, { status: 400 });
    }

    // Актор только из серверной сессии
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    // Проверяем права
    const existingClient = await db.clientNote.findUnique({
      where: { id },
    });

    if (!existingClient || existingClient.masterId !== user.id) {
      return NextResponse.json({ error: 'Заметка не найдена или нет прав на удаление' }, { status: 403 });
    }

    await db.clientNote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json({ error: 'Ошибка при удалении заметки' }, { status: 500 });
  }
}
