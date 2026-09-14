import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Стандартный синглтон Prisma для Next.js:
// в dev-режиме клиент переиспользуется между hot-reload'ами (защита от утечки соединений),
// в production создаётся один экземпляр на процесс.
export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
