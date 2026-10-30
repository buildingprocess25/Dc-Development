import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion?: number
}

// Schema version 2: session_absen and contractor tracking columns
const CURRENT_SCHEMA_VERSION = 2

if (process.env.NODE_ENV !== 'production' && globalForPrisma.prismaSchemaVersion !== CURRENT_SCHEMA_VERSION) {
  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {})
  }
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaSchemaVersion = CURRENT_SCHEMA_VERSION
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaSchemaVersion = CURRENT_SCHEMA_VERSION
}


