import { defineConfig, devices } from '@playwright/test'

/**
 * Suite E2E separata da Vitest (src/**\/*.test.ts): pilota il browser reale contro
 * il dev server Next.js, invece di chiamare le funzioni di dominio direttamente.
 * `reuseExistingServer` in locale evita di far ripartire `next dev` se è già in
 * esecuzione (es. lasciato aperto da `npm run dev` in un altro terminale).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // Per il deploy Vercel protetto da Basic Auth: E2E_BASE_URL + BASIC_AUTH_USER/PASSWORD.
    httpCredentials:
      process.env.E2E_BASE_URL && process.env.BASIC_AUTH_USER
        ? { username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASSWORD ?? '' }
        : undefined,
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
