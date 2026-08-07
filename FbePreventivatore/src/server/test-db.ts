import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const CARTELLA_MIGRAZIONI = path.join(process.cwd(), 'prisma', 'migrations')

function sqlDiTutteLeMigrazioni(): string[] {
  const voci = fs.readdirSync(CARTELLA_MIGRAZIONI, { withFileTypes: true })
  return voci
    .filter((voce) => voce.isDirectory())
    .map((voce) => voce.name)
    .sort()
    .map((cartella) => fs.readFileSync(path.join(CARTELLA_MIGRAZIONI, cartella, 'migration.sql'), 'utf-8'))
}

export function creaClientDiTest(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: ':memory:' })
  return new PrismaClient({ adapter })
}

export async function applicaMigrazioni(client: PrismaClient): Promise<void> {
  for (const sql of sqlDiTutteLeMigrazioni()) {
    for (const istruzione of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await client.$executeRawUnsafe(istruzione)
    }
  }
}
