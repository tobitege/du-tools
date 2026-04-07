const logNode = document.getElementById("harness-log")
const stateNode = document.getElementById("harness-state")

const cleanupFns = []
const packetLog = []

function log(line) {
  const stamp = new Date().toISOString().replace("T", " ").replace("Z", " UTC")
  packetLog.push(`[${stamp}] ${line}`)
  logNode.textContent = packetLog.join("\n")
  logNode.scrollTop = logNode.scrollHeight
}

function makeRuntimeCtx() {
  return {
    sendPacket(type, data) {
      log(`packet ${type}: ${JSON.stringify(data || {})}`)
      window.__HUD_HARNESS_LAST_PACKET__ = { type, data: data || null }
      window.__HUD_HARNESS_PACKETS__ = packetLog.slice()
    },
    cleanup(fn) {
      if (typeof fn === "function") {
        cleanupFns.push(fn)
      }
      return fn
    },
    getState(key, fallbackValue) {
      const state = window.__HUD_HARNESS_MODULE_STATE__ || {}
      if (typeof key === "undefined" || key === null || key === "") {
        return structuredClone(state)
      }
      return Object.prototype.hasOwnProperty.call(state, key) ? structuredClone(state[key]) : fallbackValue
    },
    setState(key, value) {
      if (!key) return false
      if (!window.__HUD_HARNESS_MODULE_STATE__) {
        window.__HUD_HARNESS_MODULE_STATE__ = {}
      }
      window.__HUD_HARNESS_MODULE_STATE__[key] = structuredClone(value)
      log(`state ${key}=${JSON.stringify(value)}`)
      return true
    },
    replaceState(nextState) {
      window.__HUD_HARNESS_MODULE_STATE__ = nextState && typeof nextState === "object" ? structuredClone(nextState) : {}
      log(`state replaced`)
      return true
    }
  }
}

window.__HUD_EDITOR_RUNTIME_CTX__ = makeRuntimeCtx()
window.__HUD_HARNESS_MODULE_STATE__ = {}

function updateState() {
  const app = window.HudEditor
  if (!app || !app.state) {
    stateNode.textContent = "HudEditor not loaded"
    return
  }
  const doc = app.state.document
  stateNode.textContent = JSON.stringify({
    editModeActive: app.state.editModeActive,
    currentScreen: app.state.currentScreen,
    currentTool: app.state.currentTool,
    selectedElementId: app.state.selectedElementId,
    dirty: app.state.isDirty,
    document: doc ? {
      id: doc.id || null,
      name: doc.name || null,
      screenWidth: doc.screenWidth,
      screenHeight: doc.screenHeight,
      elements: Array.isArray(doc.elements) ? doc.elements.length : 0
    } : null,
    lastPacket: window.__HUD_HARNESS_LAST_PACKET__ || null
  }, null, 2)
}

function loadPayload() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "/build/lua-painter-probe.js?t=" + Date.now()
    script.onload = () => resolve()
    script.onerror = (event) => reject(new Error(`Failed to load payload: ${event?.message || "unknown error"}`))
    document.head.appendChild(script)
  })
}

function app() {
  return window.HudEditor || null
}

function ensureOpen() {
  const instance = app()
  if (!instance) return
  instance.enterEditMode()
  if (typeof instance.updateToggleButton === "function") {
    instance.updateToggleButton()
  }
  updateState()
}

function ensureClosed() {
  const instance = app()
  if (!instance) return
  instance.exitEditMode()
  if (typeof instance.updateToggleButton === "function") {
    instance.updateToggleButton()
  }
  updateState()
}

function clickNewScript() {
  const button = document.querySelector('#lua-painter-root [data-screen="start"] [data-action="new"]')
  if (button) {
    button.click()
  }
  updateState()
}

async function loadFixture(name = 'layout-all-shapes.json') {
  const response = await fetch(`/web/fixtures/${name}`)
  if (!response.ok) {
    throw new Error(`Failed to load fixture ${name}: ${response.status}`)
  }
  const jsonText = await response.text()
  const instance = app()
  if (!instance || !instance.fileSync || typeof instance.fileSync.importJson !== 'function') {
    throw new Error('HudEditor fileSync.importJson unavailable')
  }
  const result = instance.fileSync.importJson(jsonText)
  if (!result || result.error) {
    throw new Error(result && result.error ? result.error : 'Fixture import failed')
  }
  if (typeof instance.goToEditor === 'function') {
    instance.goToEditor()
  }
  if (typeof instance.enterEditMode === 'function') {
    instance.enterEditMode()
  }
  if (typeof instance.emit === 'function') {
    instance.emit('resize')
  }
  if (instance.canvas && typeof instance.canvas.render === 'function') {
    await new Promise(resolve => setTimeout(resolve, 0))
    instance.canvas.render()
  }
  log(`fixture loaded: ${name}`)
  updateState()
}

async function loadSnippet(id) {
  const instance = app()
  if (!instance || !instance.shapeSnippets || typeof instance.shapeSnippets.loadDocument !== 'function') {
    throw new Error('HudEditor shapeSnippets.loadDocument unavailable')
  }
  const doc = instance.shapeSnippets.loadDocument(id)
  if (!doc) {
    throw new Error(`Unknown snippet: ${id}`)
  }
  if (typeof instance.enterEditMode === 'function') {
    instance.enterEditMode()
  }
  if (typeof instance.emit === 'function') {
    instance.emit('resize')
  }
  if (instance.canvas && typeof instance.canvas.render === 'function') {
    await new Promise(resolve => setTimeout(resolve, 0))
    instance.canvas.render()
  }
  log(`snippet loaded: ${id}`)
  updateState()
}

function resetStorage() {
  localStorage.removeItem("hud_editor_layouts")
  localStorage.removeItem("hud_editor_current")
  window.__HUD_HARNESS_MODULE_STATE__ = {}
  window.__HUD_HARNESS_LAST_PACKET__ = null
  packetLog.length = 0
  logNode.textContent = ""
  log("storage reset")
  updateState()
}

document.getElementById("btn-open").addEventListener("click", ensureOpen)
document.getElementById("btn-close").addEventListener("click", ensureClosed)
document.getElementById("btn-new").addEventListener("click", clickNewScript)
document.getElementById("btn-load-fixture").addEventListener("click", async () => {
  try {
    await loadFixture()
  } catch (error) {
    log(String(error && error.message ? error.message : error))
    updateState()
  }
})
document.getElementById("btn-reset-storage").addEventListener("click", resetStorage)
document.getElementById("btn-dump-state").addEventListener("click", updateState)
document.getElementById("btn-clear-log").addEventListener("click", () => {
  packetLog.length = 0
  logNode.textContent = ""
  updateState()
})

try {
  await loadPayload()
  log("payload loaded")
  ensureOpen()
  updateState()
} catch (error) {
  log(String(error && error.message ? error.message : error))
  stateNode.textContent = String(error && error.message ? error.message : error)
}

window.hudHarness = {
  app,
  ensureOpen,
  ensureClosed,
  clickNewScript,
  loadFixture,
  loadSnippet,
  resetStorage,
  updateState,
  packetLog
}
