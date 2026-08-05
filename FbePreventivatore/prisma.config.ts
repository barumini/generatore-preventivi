// Prisma 7 moved the SQLite connection URL for Migrate out of schema.prisma
// and into this config file (schema.prisma no longer accepts `url` inline —
// see https://pris.ly/d/config-datasource, https://pris.ly/d/prisma7-client-config).
// No secrets here: this is a local SQLite dev file, so the path is inlined
// rather than routed through a .env + dotenv dependency we don't otherwise need.
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: 'file:./dev.db',
  },
})
