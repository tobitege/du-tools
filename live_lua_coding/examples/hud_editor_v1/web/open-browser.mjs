/**
 * Persistent headed browser for interactive development.
 * Launches Chromium via Playwright, opens the harness, and stays open
 * until you close the browser window or press Ctrl+C.
 *
 * Usage: node ./web/open-browser.mjs
 */
import { chromium } from '@playwright/test'

const URL = 'http://127.0.0.1:4173/web/index.html'

const browser = await chromium.launch({
  headless: false,
  args: ['--start-maximized']
})

const context = await browser.newContext({ viewport: null })
const page = await context.newPage()

await page.goto(URL)
console.log(`Browser open → ${URL}`)
console.log('Press Ctrl+C or close the window to exit.')

// Stay alive until the browser is closed or process is killed
await new Promise((resolve) => {
  browser.on('disconnected', resolve)
  process.on('SIGINT', resolve)
  process.on('SIGTERM', resolve)
})

await browser.close().catch(() => {})
console.log('Browser closed.')
