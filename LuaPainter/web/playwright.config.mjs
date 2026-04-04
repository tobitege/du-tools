import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true
  },
  webServer: {
    command: 'node ./web/server.mjs',
    cwd: '..',
    url: 'http://127.0.0.1:4173/web/index.html',
    reuseExistingServer: true,
    timeout: 30000
  }
})
