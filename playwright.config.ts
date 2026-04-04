import { defineConfig, devices } from '@playwright/test'

const host = '127.0.0.1'
const port = Number(process.env.PLAYWRIGHT_TEST_PORT ?? 3000)
const origin = `http://${host}:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  use: {
    baseURL: origin,
    trace: 'on-first-retry',
  },

  projects: [
    // ── Desktop browsers ──────────────────────────────────────────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // ── Mobile browsers ───────────────────────────────────────────────────────
    // Emulates a Pixel 5 viewport + touch; validates inputMode keyboard hints
    // and touch-tap slot focus on a mobile Chromium engine.
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'node scripts/serve-static.mjs',
    url: `${origin}/_health`,
    reuseExistingServer: false,
  },
})
