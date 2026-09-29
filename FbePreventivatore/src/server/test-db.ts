import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PGlite } from '@electric-sql/pglite'
import { PrismaPGlite } from 'pglite-prisma-adapter'

const CARTELLA_MIGRAZIONI = path.join(process.cwd(), 'prisma', 'migrations')

function sqlDiTutteLeMigrazioni(): string[] {
  const voci = fs.readdirSync(CARTELLA_MIGRAZIONI, { withFileTypes: true })
  return voci
    .filter((voce) => voce.isDirectory())
    .map((voce) => voce.name)
    .sort()
    .map((cartella) => fs.readFileSync(path.join(CARTELLA_MIGRAZIONI, cartella, 'migration.sql'), 'utf-8'))
}

// Postgres vero in memoria (PGlite, WASM): stesso dialetto della produzione, niente server.
export function creaClientDiTest(): PrismaClient {
  const adapter = new PrismaPGlite(new PGlite())
  return new PrismaClient({ adapter })
}

export async function applicaMigrazioni(client: PrismaClient): Promise<void> {
  for (const sql of sqlDiTutteLeMigrazioni()) {
    for (const istruzione of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await client.$executeRawUnsafe(istruzione)
    }
  }
}
