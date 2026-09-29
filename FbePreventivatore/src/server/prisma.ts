import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globaleConPrisma = globalThis as unknown as { prisma?: PrismaClient }

function creaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL non impostata: serve la stringa di connessione Postgres')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

// Creato al primo uso, non all'import: `next build` importa le route senza avere il database.
// In sviluppo Next.js ricarica i moduli ad ogni modifica: senza cache su `globalThis`,
// ogni hot-reload aprirebbe un nuovo pool di connessioni.
export const prisma = new Proxy({} as PrismaClient, {
  get(_bersaglio, proprieta) {
    globaleConPrisma.prisma ??= creaClient()
    const valore = Reflect.get(globaleConPrisma.prisma, proprieta)
    return typeof valore === 'function' ? valore.bind(globaleConPrisma.prisma) : valore
  },
})
