import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Health-check: статус приложения и доступность базы данных
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: 'degraded', database: 'down', timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
