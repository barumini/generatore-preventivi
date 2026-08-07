import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' })

const globaleConPrisma = globalThis as unknown as { prisma?: PrismaClient }

// In sviluppo Next.js ricarica i moduli ad ogni modifica: senza cache su `globalThis`,
// ogni hot-reload aprirebbe una nuova connessione SQLite.
export const prisma = globaleConPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globaleConPrisma.prisma = prisma
