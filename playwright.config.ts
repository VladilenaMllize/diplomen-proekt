import { defineConfig } from '@playwright/test'

const port = process.env.E2E_BACKEND_PORT ?? '3099'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`
  },
  webServer: {
    command: 'npm run start',
    cwd: './backend',
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: !process.env.CI,
    env: { ...process.env, PORT: port },
    timeout: 120_000
  }
})
