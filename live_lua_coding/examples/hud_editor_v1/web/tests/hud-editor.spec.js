import { test, expect } from '@playwright/test'

async function ensureHarnessExpanded(page) {
  const body = page.locator('#harness-body')
  if (!(await body.isVisible())) {
    await page.locator('#harness-rollup-btn').click()
    await expect(body).toBeVisible()
  }
}

test('loads Lua Painter harness and opens editor', async ({ page }) => {
  await page.goto('/web/index.html')

  await expect(page.locator('#harness-panel')).toBeVisible()
  await expect(page.locator('#hud-editor-toggle')).toBeVisible()
  await expect(page.locator('#hud-editor-root')).toBeVisible()
  await expect(page.locator('#hud-editor-root [data-screen="start"] h1')).toHaveText('Lua Painter')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'New Script' }).first().click()

  await expect(page.locator('#canvas-preview')).toBeVisible()
  await expect(page.locator('#editor-toolbar')).toBeVisible()

  const generated = await page.evaluate(() => {
    const doc = window.HudEditor.state.document
    return {
      id: doc.id,
      name: doc.name,
      revision: doc.revision,
      code: window.HudEditor.ideExport.buildBoardOnStartCode(doc),
      screenCode: window.HudEditor.ideExport.buildScreenCode(doc),
    }
  })

  expect(generated.id).toMatch(/^ly_/)
  expect(generated.name).toBe('Layout')
  expect(generated.revision).toBe(1)
  expect(generated.code).toContain('revision=1')
  expect(generated.code).toContain(`id="${generated.id}"`)
  expect(generated.screenCode).toContain('local D=')
  expect(generated.screenCode).toContain('local l=createLayer()')
  expect(generated.screenCode).toContain('addBoxRounded')
  expect(generated.screenCode).not.toContain('function onDraw')
})

test('loads all-shapes fixture into the canvas', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'Load Fixture' }).click()

  await expect(page.locator('#canvas-preview .canvas-element')).toHaveCount(5)
  await expect(page.locator('#harness-state')).toContainText('All Shapes Fixture')
  await expect.poll(async () => page.evaluate(() => window.HudEditor.state.document.id)).toBe('fixture_all_shapes')
})

test('selects each shape from the all-shapes fixture by clicking', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'Load Fixture' }).click()
  await expect(page.locator('#canvas-preview .canvas-element')).toHaveCount(5)

  // Ensure the select tool is active
  await page.locator('button[data-tool="select"]').click()
  await expect(page.locator('button[data-tool="select"]')).toHaveClass(/active/)

  const shapes = ['box_1', 'rounded_1', 'circle_1', 'line_1', 'text_1']

  for (const id of shapes) {
    await page.locator(`.canvas-element[data-element-id="${id}"]`).click()

    // State must reflect the selection immediately (selectElement is synchronous)
    const selectedId = await page.evaluate(() => window.HudEditor.state.selectedElementId)
    expect(selectedId).toBe(id)

    // Selection overlay must appear after the next animation frame render
    await expect(page.locator('.selection-overlay')).toBeVisible()
  }

  // Click an empty area of the canvas to deselect
  // canvas-preview is ~697×393px; panel covers left ~0-100px; shapes are elsewhere
  // Use bottom-right quadrant, no shapes there
  await page.locator('#canvas-preview').click({ position: { x: 620, y: 360 } })
  const finalId = await page.evaluate(() => window.HudEditor.state.selectedElementId)
  expect(finalId).toBeNull()
})

test('properties panel shows selected shape fill/stroke and steppers', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'Load Fixture' }).click()
  await expect(page.locator('#canvas-preview .canvas-element')).toHaveCount(5)

  // Collapse harness panel so it doesn't overlap the properties panel
  await page.locator('#harness-rollup-btn').click()
  await expect(page.locator('#harness-body')).toBeHidden()

  await page.locator('button[data-tool="select"]').click()

  // box_1: fill [0.15, 0.25, 0.45, 0.92] → #264073, strokeWidth 4, radius 0
  await page.locator('.canvas-element[data-element-id="box_1"]').click()
  await expect(page.locator('#properties-panel')).toBeVisible()

  const fillHex = await page.locator('#properties-panel [data-color-prop="fill"]').getAttribute('data-color-hex')
  expect(fillHex.toLowerCase()).toBe('#264073')

  const swVal = await page.locator('#properties-panel .stepper-select[data-prop="strokeWidth"]').inputValue()
  expect(Number(swVal)).toBe(4)

  const rVal = await page.locator('#properties-panel .stepper-select[data-prop="radius"]').inputValue()
  expect(Number(rVal)).toBe(0)

  // Click + on strokeWidth → moves from 4 to next preset (5), applies to element
  await page.locator('#properties-panel .stepper-inc[data-stepper-prop="strokeWidth"]').click()
  const newSw = await page.locator('#properties-panel .stepper-select[data-prop="strokeWidth"]').inputValue()
  expect(Number(newSw)).toBe(5)
  const elementSw = await page.evaluate(() => {
    var doc = window.HudEditor.state.document
    return doc.elements.find(function (e) { return e.id === 'box_1' }).strokeWidth
  })
  expect(elementSw).toBe(5)
})

test('toolbar fill/stroke pickers sync when shape selected', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'Load Fixture' }).click()
  await expect(page.locator('#canvas-preview .canvas-element')).toHaveCount(5)

  await page.locator('button[data-tool="select"]').click()
  await page.locator('.canvas-element[data-element-id="box_1"]').click()

  // Toolbar fill should now reflect box_1's fill (#264073)
  const toolbarFill = await page.locator('#editor-toolbar [data-color-prop="fill"]').getAttribute('data-color-hex')
  expect(toolbarFill.toLowerCase()).toBe('#264073')
})

test('switching away from select tool clears selection', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'Load Fixture' }).click()
  await expect(page.locator('#canvas-preview .canvas-element')).toHaveCount(5)

  // Select a shape
  await page.locator('button[data-tool="select"]').click()
  await page.locator('.canvas-element[data-element-id="box_1"]').click()
  const afterSelect = await page.evaluate(() => window.HudEditor.state.selectedElementId)
  expect(afterSelect).toBe('box_1')

  // Switch to box tool — selection-manager deselects on tool-changed
  await page.locator('button[data-tool="box"]').click()
  const afterToolSwitch = await page.evaluate(() => window.HudEditor.state.selectedElementId)
  expect(afterToolSwitch).toBeNull()

  // No selection overlay should remain
  await expect(page.locator('.selection-overlay')).toHaveCount(0)
})

test('line tool only creates a line after a drag, not a click', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'New Script' }).first().click()
  await expect(page.locator('#canvas-preview')).toBeVisible()

  await page.locator('button[data-tool="line"]').click()
  await expect(page.locator('button[data-tool="line"]')).toHaveClass(/active/)

  const beforeCount = await page.evaluate(() => window.HudEditor.state.document.elements.length)

  await page.locator('#canvas-preview').click({ position: { x: 360, y: 180 } })

  const afterClickCount = await page.evaluate(() => window.HudEditor.state.document.elements.length)
  expect(afterClickCount).toBe(beforeCount)

  const previewBox = await page.locator('#canvas-preview').boundingBox()
  expect(previewBox).not.toBeNull()

  const startX = previewBox.x + 420
  const startY = previewBox.y + 220
  const endX = previewBox.x + 560
  const endY = previewBox.y + 280

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(endX, endY)
  await page.mouse.up()

  const created = await page.evaluate(() => {
    const doc = window.HudEditor.state.document
    return doc.elements[doc.elements.length - 1]
  })

  expect(created.type).toBe('line')
  expect(created.w).toBeGreaterThan(0)
  expect(created.h).toBeGreaterThan(0)

  const afterDragCount = await page.evaluate(() => window.HudEditor.state.document.elements.length)
  expect(afterDragCount).toBe(beforeCount + 1)
})
