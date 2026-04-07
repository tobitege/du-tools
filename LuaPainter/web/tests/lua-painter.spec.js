import { test, expect } from '@playwright/test'

async function ensureHarnessExpanded(page) {
  const body = page.locator('#harness-body')
  if (!(await body.isVisible())) {
    await page.locator('#harness-rollup-btn').click()
    await expect(body).toBeVisible()
  }
}

async function collapseHarness(page) {
  const body = page.locator('#harness-body')
  if (await body.isVisible()) {
    await page.locator('#harness-rollup-btn').click()
    await expect(body).toBeHidden()
  }
}

async function openShapeMenu(page) {
  await page.locator('#shape-tool-dropdown .toolbar-dropdown-trigger').click()
  await expect(page.locator('#shape-tool-dropdown')).toHaveClass(/open/)
}

async function chooseShapeTool(page, tool) {
  await openShapeMenu(page)
  await page.locator(`#shape-tool-dropdown .dropdown-tool-btn[data-tool="${tool}"]`).click()
}

test('loads Lua Painter harness and opens editor', async ({ page }) => {
  await page.goto('/web/index.html')

  await expect(page.locator('#harness-panel')).toBeVisible()
  await expect(page.locator('#lua-painter-toggle')).toBeVisible()
  await expect(page.locator('#lua-painter-root')).toBeVisible()
  await expect(page.locator('#lua-painter-root [data-screen="start"] h1')).toHaveText('Lua Painter')

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
      commandDoc: window.HudEditor.ideExport.buildScreenCommandDocument(doc),
      screenCode: window.HudEditor.ideExport.buildScreenCode(doc),
      screenCodeCompact: window.HudEditor.ideExport.buildScreenCodeCompact(doc),
    }
  })

  expect(generated.id).toMatch(/^ly_/)
  expect(generated.name).toBe('Layout')
  expect(generated.revision).toBe(1)
  expect(generated.code).toContain('revision=1')
  expect(generated.code).toContain(`id="${generated.id}"`)
  expect(generated.commandDoc.c).toHaveLength(2)
  expect(generated.commandDoc.c[0].o).toBe('shape')
  expect(generated.commandDoc.c[1].o).toBe('text')
  expect(generated.commandDoc.c[1].tf).toBe('Play')
  expect(generated.screenCode).toContain('-- Screen export mode: default')
  expect(generated.screenCode).toContain('local P = require("lib.painterlib")')
  expect(generated.screenCode).toContain('P.bg(0, 0, 0)')
  expect(generated.screenCode).toContain('local layer = P.ly()')
  expect(generated.screenCode).toContain('P.br(layer,')
  expect(generated.screenCode).toContain('tf="Play"')
  expect(generated.screenCode).not.toContain('function onDraw')
  expect(generated.screenCodeCompact).toContain('-- Screen export mode: compact')
  expect(generated.screenCodeCompact).toContain('local P=require("lib.painterlib")')
  expect(generated.screenCodeCompact).toContain('P.br(L,')
  expect(generated.screenCodeCompact).toContain('P.tx(L,')
})

test('preview image root resolves DU resource paths for HUD preview only', async ({ page }) => {
  await page.goto('/web/index.html')

  const previewRoot = 'D:\\MyDualUniverse\\Game\\data\\resources_generated'
  const resolvedPreviewPath = 'file:///D:/MyDualUniverse/Game/data/resources_generated/env/voxel/ore/aluminium-ore/icons/env_aluminium-ore_icon.png'
  const ingamePath = 'resources_generated/env/voxel/ore/aluminium-ore/icons/env_aluminium-ore_icon.png'

  const input = page.locator('#start-preview-image-root')
  await expect(input).toBeVisible()
  await input.fill(previewRoot)
  await input.dispatchEvent('change')

  await expect(page.locator('#start-preview-image-example')).toContainText(resolvedPreviewPath)

  await page.evaluate(() => window.hudHarness.loadSnippet('demo_shapes_lua_full'))
  await expect(page.locator('#canvas-preview canvas[aria-label="preview-image"]').first()).toHaveAttribute('data-preview-src', resolvedPreviewPath)

  const exported = await page.evaluate(() => {
    const doc = window.HudEditor.state.document
    const commands = window.HudEditor.ideExport.buildScreenCommandDocument(doc)
    const imageCommand = commands.c.find(cmd => cmd.o === 'image')
    return imageCommand ? imageCommand.src : null
  })

  expect(exported).toBe(ingamePath)
})

test('image preview applies fill tint to the rendered canvas', async ({ page }) => {
  await page.goto('/web/index.html')

  const tintedPixels = await page.evaluate(async () => {
    const svg = [
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'>",
      "<rect width='4' height='8' fill='rgb(64,64,64)'/>",
      "<rect x='4' width='4' height='8' fill='rgb(224,224,224)'/>",
      "</svg>",
    ].join('')
    const imageSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await window.hudHarness.loadSnippet('demo_shapes_lua_full')
    const doc = window.HudEditor.state.document
    const imageElements = doc && doc.elements ? doc.elements.filter(el => el.type === 'image') : []
    if (!imageElements.length) {
      throw new Error('image elements not found')
    }

    imageElements.forEach(imageElement => {
      imageElement.imageSrc = imageSrc
      imageElement.fill = [1, 0, 0, 1]
      imageElement.stroke = [0, 0, 0, 0]
      imageElement.strokeWidth = 0
      imageElement.shadowBlur = 32
      imageElement.shadowColor = [0, 1, 0, 1]
    })

    window.HudEditor.emit('document-loaded', doc)

    function waitForTintedCanvas(resolve, reject, startedAt) {
      const canvas = document.querySelector('#canvas-preview canvas[aria-label="preview-image"]')
      let leftPixel
      let rightPixel
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        leftPixel = Array.from(canvas.getContext('2d').getImageData(Math.max(1, Math.floor(canvas.width * 0.25)), Math.floor(canvas.height / 2), 1, 1).data)
        rightPixel = Array.from(canvas.getContext('2d').getImageData(Math.max(1, Math.floor(canvas.width * 0.75)), Math.floor(canvas.height / 2), 1, 1).data)
        if (leftPixel[0] > 0 && rightPixel[0] > leftPixel[0] && leftPixel[1] < 10 && rightPixel[1] < 10 && leftPixel[2] < 10 && rightPixel[2] < 10) {
          resolve({
            leftPixel,
            rightPixel,
            filter: canvas.style.filter || ''
          })
          return
        }
      }
      if (Date.now() - startedAt > 3000) {
        reject(new Error('Timed out waiting for tinted image canvas'))
        return
      }
      requestAnimationFrame(function () {
        waitForTintedCanvas(resolve, reject, startedAt)
      })
    }

    return new Promise((resolve, reject) => {
      waitForTintedCanvas(resolve, reject, Date.now())
    })
  })

  expect(tintedPixels.leftPixel[0]).toBeGreaterThan(0)
  expect(tintedPixels.rightPixel[0]).toBeGreaterThan(tintedPixels.leftPixel[0])
  expect(tintedPixels.leftPixel[1]).toBeLessThan(10)
  expect(tintedPixels.rightPixel[1]).toBeLessThan(10)
  expect(tintedPixels.leftPixel[2]).toBeLessThan(10)
  expect(tintedPixels.rightPixel[2]).toBeLessThan(10)
  expect(tintedPixels.filter).toBe('')
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

test('shape dropdown auto-closes after selecting a tool', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'New Script' }).first().click()
  await expect(page.locator('#canvas-preview')).toBeVisible()
  await collapseHarness(page)

  await openShapeMenu(page)
  await page.locator('#shape-tool-dropdown .dropdown-tool-btn[data-tool="line"]').click()

  await expect(page.locator('#shape-tool-dropdown')).not.toHaveClass(/open/)
  await expect(page.locator('#shape-tool-dropdown .toolbar-dropdown-trigger')).toHaveClass(/active/)

  const activeTool = await page.evaluate(() => window.HudEditor.state.currentTool)
  expect(activeTool).toBe('line')
})

test('status bar help button opens the bottom bar guide', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'New Script' }).first().click()
  await expect(page.locator('#canvas-preview')).toBeVisible()
  await collapseHarness(page)

  await page.getByRole('button', { name: 'Bottom bar help' }).click()

  const helpDialog = page.locator('#dialog-help')
  await expect(helpDialog).toBeVisible()
  await expect(helpDialog).toContainText('Bottom Bar Help')
  await expect(helpDialog).toContainText('Apply + Close HUD')
  await expect(helpDialog).toContainText('Export Board')
  await expect(helpDialog).toContainText('Export Screen')
  await expect(helpDialog).toContainText('Close')
})

test('shape dropdown lists the extended DU shape tool set', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'New Script' }).first().click()
  await expect(page.locator('#canvas-preview')).toBeVisible()
  await collapseHarness(page)

  await openShapeMenu(page)

  const tools = await page.locator('#shape-tool-dropdown .dropdown-tool-btn').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-tool'))
  )

  expect(tools).toEqual([
    'box',
    'rounded',
    'circle',
    'bezierArc',
    'triangle',
    'quad',
    'image',
    'line',
    'text',
  ])
})

test('switching away from select tool clears selection', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'Load Fixture' }).click()
  await expect(page.locator('#canvas-preview .canvas-element')).toHaveCount(5)
  await collapseHarness(page)

  // Select a shape
  await page.locator('button[data-tool="select"]').click()
  await page.locator('.canvas-element[data-element-id="box_1"]').click()
  const afterSelect = await page.evaluate(() => window.HudEditor.state.selectedElementId)
  expect(afterSelect).toBe('box_1')

  // Switch to box tool through the shapes menu — selection-manager deselects on tool-changed
  await chooseShapeTool(page, 'box')
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
  await collapseHarness(page)

  await chooseShapeTool(page, 'line')
  await expect(page.locator('#shape-tool-dropdown .toolbar-dropdown-trigger')).toHaveClass(/active/)

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

test('adding a shape can be undone', async ({ page }) => {
  await page.goto('/web/index.html')

  await ensureHarnessExpanded(page)
  await page.getByRole('button', { name: 'New Script' }).first().click()
  await expect(page.locator('#canvas-preview')).toBeVisible()
  await page.evaluate(() => {
    window.HudEditor.state.currentTool = 'box'
    if (typeof window.HudEditor.updateToolButtons === 'function') {
      window.HudEditor.updateToolButtons('box')
    }
    window.HudEditor.emit('tool-changed', 'box')
  })

  const beforeCount = await page.evaluate(() => window.HudEditor.state.document.elements.length)
  expect(beforeCount).toBeGreaterThanOrEqual(1)

  const previewBox = await page.locator('#canvas-preview').boundingBox()
  expect(previewBox).not.toBeNull()

  const startX = previewBox.x + 420
  const startY = previewBox.y + 220
  const endX = previewBox.x + 560
  const endY = previewBox.y + 320

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(endX, endY)
  await page.mouse.up()

  await expect.poll(async () => page.evaluate(() => window.HudEditor.state.document.elements.length)).toBe(beforeCount + 1)
  await expect.poll(async () => page.evaluate(() => window.HudEditor.state.isDirty)).toBe(true)

  await page.evaluate(() => window.HudEditor.emit('undo'))

  await expect.poll(async () => page.evaluate(() => window.HudEditor.state.document.elements.length)).toBe(beforeCount)
  await expect.poll(async () => page.evaluate(() => window.HudEditor.state.isDirty)).toBe(false)
})

test('shape snippet catalog exposes the planned families and can build documents', async ({ page }) => {
  await page.goto('/web/index.html')

  const catalog = await page.evaluate(() => {
    const api = window.HudEditor && window.HudEditor.shapeSnippets
    if (!api) return null
    return {
      ids: api.ids.slice(),
      list: api.list(),
      rgbDoc: api.buildDocument('effect_text_rgb_split'),
      fullDemo: api.buildDocument('demo_shapes_lua_full'),
    }
  })

  expect(catalog).not.toBeNull()
  expect(catalog.ids).toContain('primitive_box_default')
  expect(catalog.ids).toContain('overlap_same_type_boxes')
  expect(catalog.ids).toContain('effect_text_rgb_split')
  expect(catalog.ids).toContain('demo_shapes_lua_full')
  expect(catalog.list.some(item => item.family === 'primitive/default')).toBeTruthy()
  expect(catalog.list.some(item => item.family === 'primitive/styled')).toBeTruthy()
  expect(catalog.list.some(item => item.family === 'overlap/same-type')).toBeTruthy()
  expect(catalog.list.some(item => item.family === 'overlap/mixed-type')).toBeTruthy()
  expect(catalog.list.some(item => item.family === 'effect/text-treatment')).toBeTruthy()
  expect(catalog.list.some(item => item.family === 'demo/render-script')).toBeTruthy()
  expect(catalog.rgbDoc.elements).toHaveLength(3)
  expect(catalog.rgbDoc.elements.every(el => el.type === 'text')).toBeTruthy()
  expect(catalog.fullDemo.elements.length).toBeGreaterThan(60)
  expect(catalog.fullDemo.elements.some(el => el.type === 'image')).toBeTruthy()
  expect(catalog.fullDemo.elements.some(el => el.type === 'bezierArc')).toBeTruthy()
  expect(catalog.fullDemo.elements.some(el => el.type === 'triangle')).toBeTruthy()
  expect(catalog.fullDemo.elements.some(el => el.type === 'quad')).toBeTruthy()
})

test('screen command document expands snippets into normalized draw commands', async ({ page }) => {
  await page.goto('/web/index.html')

  const commandDocs = await page.evaluate(() => {
    return {
      overlap: window.HudEditor.ideExport.buildScreenCommandDocument(
        window.HudEditor.shapeSnippets.buildDocument('overlap_same_type_boxes')
      ),
      rgbText: window.HudEditor.ideExport.buildScreenCommandDocument(
        window.HudEditor.shapeSnippets.buildDocument('effect_text_rgb_split')
      ),
      fullDemo: window.HudEditor.ideExport.buildScreenCommandDocument(
        window.HudEditor.shapeSnippets.buildDocument('demo_shapes_lua_full')
      ),
      fullCode: window.HudEditor.ideExport.buildScreenCode(
        window.HudEditor.shapeSnippets.buildDocument('demo_shapes_lua_full')
      ),
      fullCodeCompact: window.HudEditor.ideExport.buildScreenCode(
        window.HudEditor.shapeSnippets.buildDocument('demo_shapes_lua_full'),
        { mode: 'compact' }
      ),
    }
  })

  expect(commandDocs.overlap.c).toHaveLength(3)
  expect(commandDocs.overlap.c.every(cmd => cmd.o === 'shape')).toBeTruthy()
  expect(commandDocs.overlap.c.every(cmd => cmd.k === 'box')).toBeTruthy()
  expect(commandDocs.rgbText.c).toHaveLength(3)
  expect(commandDocs.rgbText.c.every(cmd => cmd.o === 'text')).toBeTruthy()
  expect(commandDocs.fullDemo.c.some(cmd => cmd.o === 'image')).toBeTruthy()
  expect(commandDocs.fullDemo.c.some(cmd => cmd.o === 'bezier')).toBeTruthy()
  expect(commandDocs.fullDemo.c.some(cmd => cmd.o === 'shape' && cmd.k === 'triangle')).toBeTruthy()
  expect(commandDocs.fullDemo.c.some(cmd => cmd.o === 'shape' && cmd.k === 'quad')).toBeTruthy()
  expect(commandDocs.fullDemo.c.some(cmd => cmd.rot)).toBeTruthy()
  expect(commandDocs.fullDemo.c.some(cmd => cmd.sh)).toBeTruthy()
  expect(commandDocs.fullCode).toContain('-- Screen export mode: default')
  expect(commandDocs.fullCode).toContain('local P = require("lib.painterlib")')
  expect(commandDocs.fullCode).toContain('P.bz(layer')
  expect(commandDocs.fullCode).toContain('P.tr(layer')
  expect(commandDocs.fullCode).toContain('P.qd(layer')
  expect(commandDocs.fullCode).toContain('P.ig(layer')
  expect(commandDocs.fullCode).toContain('P.tx(layer')
  expect(commandDocs.fullCodeCompact).toContain('-- Screen export mode: compact')
  expect(commandDocs.fullCodeCompact).toContain('local P=require("lib.painterlib")')
  expect(commandDocs.fullCodeCompact).toContain('P.bz(L,')
  expect(commandDocs.fullCodeCompact).toContain('rot=')
  expect(commandDocs.fullCodeCompact).toContain('sh={')
})

test('shape snippets can be loaded into the editor canvas', async ({ page }) => {
  await page.goto('/web/index.html')

  await page.evaluate(() => window.hudHarness.loadSnippet('overlap_same_type_boxes'))
  await expect(page.locator('#canvas-preview .canvas-element')).toHaveCount(3)

  const state = await page.evaluate(() => {
    const doc = window.HudEditor.state.document
    return {
      currentScreen: window.HudEditor.state.currentScreen,
      id: doc && doc.id,
      count: doc && doc.elements ? doc.elements.length : 0,
    }
  })

  expect(state.currentScreen).toBe('editor')
  expect(state.id).toBe('overlap_same_type_boxes')
  expect(state.count).toBe(3)
})

test('full shapes.lua demo snippet loads into the editor canvas', async ({ page }) => {
  await page.goto('/web/index.html')

  await page.evaluate(() => window.hudHarness.loadSnippet('demo_shapes_lua_full'))
  await expect(page.locator('#canvas-preview .canvas-element')).toHaveCount(63)

  const summary = await page.evaluate(() => {
    const doc = window.HudEditor.state.document
    return {
      id: doc.id,
      types: Array.from(new Set(doc.elements.map(el => el.type))).sort(),
      glowCount: doc.elements.filter(el => Number(el.shadowBlur) > 0).length,
      rotatedCount: doc.elements.filter(el => Math.abs(Number(el.rotation) || 0) > 0.001).length,
    }
  })

  expect(summary.id).toBe('demo_shapes_lua_full')
  expect(summary.types).toEqual(['bezierArc', 'box', 'boxRounded', 'circle', 'image', 'line', 'quad', 'text', 'triangle'])
  expect(summary.glowCount).toBeGreaterThan(20)
  expect(summary.rotatedCount).toBeGreaterThan(20)
})
