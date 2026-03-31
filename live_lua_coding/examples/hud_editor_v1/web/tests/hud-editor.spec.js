import { test, expect } from '@playwright/test'

test('loads Lua Painter harness and opens editor', async ({ page }) => {
  await page.goto('/web/index.html')

  await expect(page.locator('#harness-panel')).toBeVisible()
  await expect(page.locator('#hud-editor-toggle')).toBeVisible()
  await expect(page.locator('#hud-editor-root')).toBeVisible()
  await expect(page.locator('#hud-editor-root [data-screen="start"] h1')).toHaveText('Lua Painter')

  await page.getByRole('button', { name: 'New Script' }).first().click()

  await expect(page.locator('#canvas-preview')).toBeVisible()
  await expect(page.locator('#editor-toolbar')).toBeVisible()
})

test('loads all-shapes fixture into the canvas', async ({ page }) => {
  await page.goto('/web/index.html')

  await page.getByRole('button', { name: 'Load Fixture' }).click()

  await expect(page.locator('#canvas-preview .canvas-element')).toHaveCount(5)
  await expect(page.locator('#harness-state')).toContainText('All Shapes Fixture')
})
