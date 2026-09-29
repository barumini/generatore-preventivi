// Prisma 7 moved the connection URL for Migrate out of schema.prisma and into this
// config file (see https://pris.ly/d/config-datasource). Il database è Postgres (Neon,
// collegato al progetto Vercel): le migrazioni usano la connessione diretta
// `DATABASE_URL_UNPOOLED` quando c'è, perché il pooler di Neon non regge i lock di Migrate.
// Prisma 7 non carica più `.env` da solo: in locale esportare la variabile o usare
// `vercel env pull` + `node --env-file`. `generate` non ha bisogno dell'URL.
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
})
