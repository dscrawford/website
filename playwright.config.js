import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || 'chromium',
    },
  },
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 10000,
  },
})
