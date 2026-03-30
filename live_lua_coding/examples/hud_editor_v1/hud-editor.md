# HUD Editor Plan: Paint-with-Lua

## IMPORTANT: Self-Contained Project

**This project is COMPLETELY SELF-CONTAINED and independent from ModUiExtractor core.**

- All JS sources live in `live_lua_coding\examples\hud_editor_v1\js\`
- Project has its own build scripts in `scripts\`
- Build produces a SINGLE payload file: `build\hud-editor-probe.js`
- Publish copies to runtime `payload-overrides/` (optional step)
- No sources intermingled with `ModUiExtractor\payload\`

---

## Goal

Build a **JavaScript-driven HUD overlay** that provides a rich, visually interactive editor experience for designing screen layouts with Lua-drawn elements ("Paint-with-Lua"). The HTML-based HUD interface bypasses the 50,000 character screen-code limit by delegating rendering logic to external files accessed through the DuMcpBridge.

---

## Core UX Principle: Mode Toggle with LCTRL

**Critical requirement**: The mouse cursor must be captured for editing. Since the HUD is overlaid on the game view where mouse controls camera movement, **LCTRL acts as a toggle** to switch between:

| Mode | LCTRL State | Mouse Behavior |
|------|-------------|----------------|
| **Camera Mode** | LCTRL released | Normal game camera control |
| **Edit Mode** | LCTRL held | Full mouse cursor capture for editor |

```
┌─────────────────────────────────────────────────────────────┐
│                      MODE TOGGLE                             │
│                                                             │
│   [LCTRL released] ──► CAMERA MODE                         │
│         ▲                      │                            │
│         │                      │ Release LCTRL             │
│         │                      ▼                            │
│         │               ┌──────────────┐                   │
│         │               │  EDIT MODE   │                   │
│         │               │  LCTRL held  │                   │
│         │               │              │                   │
│         │               │ Mouse cursor │                   │
│         │               │ captured for │                   │
│         │               │ WYSIWYG editor│                   │
│         │               └──────────────┘                   │
│         │                      │                            │
│         │                      │ Hold LCTRL                 │
│         └──────────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### LCTRL Implementation

```javascript
// In 000-core.js
let editModeActive = false;
let lctrlPressed = false;

document.addEventListener('keydown', (e) => {
  if (e.key === 'ControlLeft' || e.key === 'Left Ctrl') {
    if (!lctrlPressed) {
      lctrlPressed = true;
      enterEditMode();
    }
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ControlLeft' || e.key === 'Left Ctrl') {
    lctrlPressed = false;
    exitEditMode();
  }
});

function enterEditMode() {
  if (editModeActive) return;
  editModeActive = true;
  showEditorUI();
  captureMouseCursor();
}

function exitEditMode() {
  if (!editModeActive) return;
  editModeActive = false;
  hideEditorUI();
  releaseMouseCursor();
}
```

---

## Application Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION FLOW                              │
└─────────────────────────────────────────────────────────────────┘

[Game Start]
      │
      ▼
┌─────────────────┐
│   START SCREEN  │  ◄── LCTRL to enter edit mode
│                 │
│  ┌───────────┐  │
│  │ New Script │  │──► Creates blank layout
│  └───────────┘  │
│                 │
│  ┌───────────┐  │
│  │   Load    │  │──► Lists scripts from databank
│  └───────────┘  │
│                 │
│  ┌───────────┐  │
│  │ Save As   │  │──► Saves current to databank + file
│  └───────────┘  │
└─────────────────┘
      │
      ▼ (select New or Load)
┌─────────────────┐
│   WYSIWYG      │
│   EDITOR       │
│                 │
│ ┌─────────────┐ │
│ │   TOOLBAR   │ │  Shapes | Text | Colors | Size
│ └─────────────┘ │
│                 │
│ ┌─────────────┐ │
│ │   CANVAS    │ │  WYSIWYG drag/resize/preview
│ │   PREVIEW   │ │
│ └─────────────┘ │
│                 │
│ ┌─────────────┐ │
│ │ PROPERTIES  │ │  Element props when selected
│ └─────────────┘ │
│                 │
│ [Save] [Save+X] │  [X] with confirm
└─────────────────┘
```

---

## Screen 1: Start Screen

The start screen appears when entering edit mode (LCTRL held). It provides a clean menu with no canvas visible underneath.

### Start Screen Layout

```html
<div id="hud-editor-start" class="screen active">
  <div class="start-container">
    <div class="start-header">
      <h1>🎨 Paint-with-Lua</h1>
      <p class="subtitle">HUD Layout Editor</p>
    </div>

    <div class="start-menu">
      <button class="menu-btn primary" data-action="new">
        <span class="icon">📄</span>
        <span class="label">New Script</span>
        <span class="desc">Start a fresh layout</span>
      </button>

      <button class="menu-btn" data-action="load">
        <span class="icon">📂</span>
        <span class="label">Load</span>
        <span class="desc">Open from databank</span>
      </button>

      <button class="menu-btn" data-action="saveas">
        <span class="icon">💾</span>
        <span class="label">Save As</span>
        <span class="desc">Save current layout as...</span>
      </button>
    </div>

    <div class="start-footer">
      <span class="hint">Release LCTRL to exit edit mode</span>
    </div>
  </div>
</div>
```

### Start Screen Styles

```css
#hud-editor-start {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  font-family: 'Rajdhani', 'Segoe UI', sans-serif;
}

#hud-editor-start.active {
  display: flex;
}

.start-container {
  text-align: center;
  max-width: 480px;
  padding: 48px;
}

.start-header h1 {
  font-size: 48px;
  color: #fff;
  margin: 0 0 8px 0;
  text-shadow: 0 0 20px rgba(14, 233, 231, 0.5);
}

.subtitle {
  color: #888;
  font-size: 18px;
  margin: 0 0 48px 0;
}

.menu-btn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 20px 24px;
  margin: 12px 0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.menu-btn:hover {
  background: rgba(14, 233, 231, 0.1);
  border-color: rgba(14, 233, 231, 0.3);
  transform: translateX(8px);
}

.menu-btn.primary {
  background: rgba(14, 233, 231, 0.15);
  border-color: rgba(14, 233, 231, 0.4);
}

.menu-btn .icon {
  font-size: 28px;
  margin-right: 16px;
}

.menu-btn .label {
  display: block;
  color: #fff;
  font-size: 20px;
  font-weight: 600;
}

.menu-btn .desc {
  display: block;
  color: #666;
  font-size: 13px;
  margin-top: 4px;
}

.start-footer {
  margin-top: 48px;
}

.hint {
  color: #444;
  font-size: 14px;
}
```

### Load Dialog

When "Load" is clicked, a modal shows saved scripts from databank:

```html
<div id="load-dialog" class="dialog">
  <div class="dialog-header">
    <h2>Load Script</h2>
    <button class="close-btn" data-action="close-dialog">×</button>
  </div>
  <div class="dialog-content">
    <div class="script-list">
      <!-- Populated dynamically from databank -->
    </div>
  </div>
  <div class="dialog-footer">
    <button class="btn" data-action="close-dialog">Cancel</button>
  </div>
</div>
```

### Save As Dialog

```html
<div id="saveas-dialog" class="dialog">
  <div class="dialog-header">
    <h2>Save As</h2>
    <button class="close-btn" data-action="close-dialog">×</button>
  </div>
  <div class="dialog-content">
    <label>Script Name</label>
    <input type="text" id="saveas-name" placeholder="my-layout" />
    <p class="save-note">Saves to linked databank</p>
  </div>
  <div class="dialog-footer">
    <button class="btn secondary" data-action="close-dialog">Cancel</button>
    <button class="btn primary" data-action="confirm-saveas">Save</button>
  </div>
</div>
```

---

## Screen 2: WYSIWYG Editor

The main editor canvas with toolbar, preview, and properties panel.

### Editor Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOOLBAR                                                                │
│ [Select][Box][Rounded][Circle][Line][Text] │ [Fill][Stroke][Size]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                    CANVAS PREVIEW AREA                                 │
│                                                                       │
│    ┌─────────────────────────────────────────────────────────┐       │
│    │                                                          │       │
│    │     WYSIWYG preview of screen output                   │       │
│    │     Click to select elements                            │       │
│    │     Drag handles to move/resize                         │       │
│    │                                                          │       │
│    │     ┌──────────────┐                                    │       │
│    │     │ Selected     │ ◄── Selection handles               │       │
│    │     │ Element      │                                    │       │
│    │     └──────────────┘                                    │       │
│    │                                                          │       │
│    └─────────────────────────────────────────────────────────┘       │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│ PROPERTIES PANEL (shown when element selected)                         │
│ Position: [X: 100] [Y: 200]   Size: [W: 150] [H: 80]                │
│ Fill: [■ #FF5500]  Stroke: [■ #FFFFFF]  Radius: [12]                │
│ Text: [___________]                                                    │
├──────────────────────────────────────────────────────────────────────┤
│ STATUS BAR                                                             │
│ [Save] [Save+Exit]                              Selected: button_1   │
└──────────────────────────────────────────────────────────────────────┘
```

### Toolbar

```html
<div id="editor-toolbar">
  <div class="toolbar-section tools">
    <button class="tool-btn active" data-tool="select" title="Select (V)">
      <span>⬚</span>
    </button>
    <button class="tool-btn" data-tool="box" title="Box (B)">
      <span>▢</span>
    </button>
    <button class="tool-btn" data-tool="rounded" title="Rounded Box (R)">
      <span>⬜</span>
    </button>
    <button class="tool-btn" data-tool="circle" title="Circle (C)">
      <span>○</span>
    </button>
    <button class="tool-btn" data-tool="line" title="Line (L)">
      <span>╱</span>
    </button>
    <button class="tool-btn" data-tool="text" title="Text (T)">
      <span>T</span>
    </button>
  </div>

  <div class="toolbar-divider"></div>

  <div class="toolbar-section colors">
    <label>Fill</label>
    <input type="color" class="color-picker" data-prop="fill" value="#3366FF" />
    <label>Stroke</label>
    <input type="color" class="color-picker" data-prop="stroke" value="#FFFFFF" />
  </div>

  <div class="toolbar-divider"></div>

  <div class="toolbar-section size">
    <label>Stroke</label>
    <input type="number" class="size-input" data-prop="strokeWidth" value="2" min="0" max="20" />
    <label>Radius</label>
    <input type="number" class="size-input" data-prop="radius" value="12" min="0" max="200" />
  </div>

  <div class="toolbar-spacer"></div>

  <div class="toolbar-section actions">
    <button class="action-btn" data-action="undo" title="Undo (Ctrl+Z)">↩</button>
    <button class="action-btn" data-action="redo" title="Redo (Ctrl+Y)">↪</button>
  </div>
</div>
```

### Canvas Preview

```html
<div id="canvas-container">
  <div id="canvas-preview">
    <!-- Scaled preview of the screen output -->
    <!-- Elements rendered as positioned divs with CSS -->
    <!-- Selection handles overlaid when element selected -->
  </div>
</div>
```

### Properties Panel

```html
<div id="properties-panel" class="docked-panel">
  <div class="panel-header">
    <span>Properties</span>
  </div>
  <div class="panel-content">
    <div class="prop-row">
      <label>X</label>
      <input type="number" data-prop="x" class="prop-input" />
      <label>Y</label>
      <input type="number" data-prop="y" class="prop-input" />
    </div>
    <div class="prop-row">
      <label>W</label>
      <input type="number" data-prop="w" class="prop-input" />
      <label>H</label>
      <input type="number" data-prop="h" class="prop-input" />
    </div>
    <div class="prop-row">
      <label>Fill</label>
      <input type="color" data-prop="fill" class="prop-color" />
    </div>
    <div class="prop-row">
      <label>Stroke</label>
      <input type="color" data-prop="stroke" class="prop-color" />
    </div>
    <div class="prop-row">
      <label>Width</label>
      <input type="number" data-prop="strokeWidth" class="prop-input" />
    </div>
    <div class="prop-row">
      <label>Radius</label>
      <input type="number" data-prop="radius" class="prop-input" />
    </div>
    <div class="prop-row vertical">
      <label>Text</label>
      <textarea data-prop="textLines" class="prop-textarea" rows="3"></textarea>
    </div>
    <div class="prop-row">
      <button class="prop-delete" data-action="delete-element">Delete Element</button>
    </div>
  </div>
</div>
```

### Status Bar / Action Bar

```html
<div id="editor-statusbar">
  <div class="statusbar-left">
    <button class="status-btn primary" data-action="save">
      💾 Save
    </button>
    <button class="status-btn" data-action="save-exit">
      💾 Save + Exit
    </button>
  </div>
  <div class="statusbar-center">
    <span class="status-mode">Editing</span>
    <span class="status-hint" data-hint="lctrl">Hold LCTRL to exit</span>
  </div>
  <div class="statusbar-right">
    <button class="status-btn danger" data-action="close">
      ✕ Close
    </button>
  </div>
</div>
```

### Close Confirmation Dialog

```html
<div id="close-confirm-dialog" class="dialog">
  <div class="dialog-content centered">
    <div class="confirm-icon">⚠️</div>
    <h3>Unsaved Changes</h3>
    <p>You have unsaved changes. What would you like to do?</p>
  </div>
  <div class="dialog-footer centered">
    <button class="btn secondary" data-action="close-dialog">Cancel</button>
    <button class="btn danger" data-action="discard-and-close">Discard</button>
    <button class="btn primary" data-action="save-and-close">Save & Close</button>
  </div>
</div>
```

---

## Edit Mode Architecture

### State Machine

```javascript
const EditorState = {
  // Screens
  SCREEN_START: 'start',
  SCREEN_EDITOR: 'editor',

  // Editor sub-modes
  MODE_SELECT: 'select',
  MODE_CREATE_BOX: 'create_box',
  MODE_CREATE_ROUNDED: 'create_rounded',
  MODE_CREATE_CIRCLE: 'create_circle',
  MODE_CREATE_LINE: 'create_line',
  MODE_CREATE_TEXT: 'create_text',

  // Current state
  currentScreen: 'start',
  currentTool: 'select',
  selectedElementId: null,
  isDirty: false,
  document: null,  // Layout document
};
```

### Mouse Capture in Edit Mode

```javascript
// In edit mode, intercept all mouse events on canvas
function captureCanvasMouseEvents() {
  const canvas = document.getElementById('canvas-preview');

  canvas.addEventListener('mousedown', onCanvasMouseDown);
  canvas.addEventListener('mousemove', onCanvasMouseMove);
  canvas.addEventListener('mouseup', onCanvasMouseUp);

  // Prevent events from propagating to game
  canvas.addEventListener('click', (e) => e.stopPropagation(), true);
  canvas.addEventListener('mousedown', (e) => e.stopPropagation(), true);
}

function releaseCanvasMouseEvents() {
  // Restore normal event flow
}
```

### Create Tool Behavior

```javascript
// When a create tool is active
function onCanvasMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (currentTool === 'select') {
    // Hit test for element selection
    const hit = hitTestElements(x, y);
    if (hit) {
      selectElement(hit.id);
    } else {
      deselectAll();
    }
  } else {
    // Create new element at click point
    startCreateElement(x, y);
  }
}

function onCanvasMouseMove(e) {
  if (!isDragging && !isCreating) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (isDragging) {
    updateDrag(x, y);
  } else if (isCreating) {
    updateCreate(x, y);
  }
}

function onCanvasMouseUp(e) {
  if (isCreating) {
    finishCreateElement();
  } else if (isDragging || isResizing) {
    finishManipulation();
  }
}
```

### Selection Handles

```javascript
// Render selection handles around selected element
function renderSelectionHandles(element) {
  const handles = [
    { id: 'nw', cursor: 'nw-resize', x: -4, y: -4 },
    { id: 'n',  cursor: 'n-resize',  x: -4, y: -4 },
    { id: 'ne', cursor: 'ne-resize', x: -4, y: -4 },
    { id: 'e',  cursor: 'e-resize',  x: -4, y: -4 },
    { id: 'se', cursor: 'se-resize', x: -4, y: -4 },
    { id: 's',  cursor: 's-resize',  x: -4, y: -4 },
    { id: 'sw', cursor: 'sw-resize', x: -4, y: -4 },
    { id: 'w',  cursor: 'w-resize',  x: -4, y: -4 },
  ];

  handles.forEach(h => {
    const handle = createHandle(h.id, h.cursor);
    positionHandle(handle, element, h.id);
    canvas.appendChild(handle);
  });
}
```

---

## Bridge Command Protocol

### Command Format

All commands from HUD to Board via `getInput()`:

```lua
HUD_CMD = {
    -- Navigation
    PING           = "ping",        -- ping|version
    SYNC_REQUEST   = "sync",       -- sync|request
    SYNC_RESPONSE  = "sync",       -- sync|response|<json>

    -- Document operations
    NEW_DOC        = "new",        -- new|<screenW>|<screenH>
    LOAD_DOC       = "load",       -- load|<scriptId>
    SAVE_DOC       = "save",       -- save|<scriptId>
    LIST_SCRIPTS   = "list",       -- list|request
    LIST_RESPONSE  = "list",       -- list|response|<json>

    -- Element operations
    ADD_ELEMENT    = "add",        -- add|<json>
    UPDATE_ELEMENT = "upd",        -- upd|<elementId>|<json>
    DELETE_ELEMENT = "del",        -- del|<elementId>
    SELECT_ELEMENT = "sel",        -- sel|<elementId>

    -- Real-time sync (sent during drag/resize)
    MOVE_START     = "movs",       -- movs|<elementId>|<x>|<y>
    MOVE_UPDATE   = "movu",       -- movu|<elementId>|<x>|<y>
    MOVE_END       = "move",       -- move|<elementId>|<x>|<y>
    RESIZE_START   = "ress",       -- ress|<elementId>|<handle>|<x>|<y>
    RESIZE_UPDATE  = "resu",       -- resu|<elementId>|<handle>|<x>|<y>
    RESIZE_END     = "rese",       -- rese|<elementId>|<handle>|<x>|<y>

    -- Render output
    RENDER_FRAME   = "rend",       -- rend|<revision>
}
```

### Script List Format (from databank)

```json
{
  "scripts": [
    {
      "id": "script_001",
      "name": "Main HUD",
      "created": "2026-03-29T10:00:00Z",
      "modified": "2026-03-30T14:30:00Z",
      "size": 4096
    },
    {
      "id": "script_002",
      "name": "Status Panel",
      "created": "2026-03-28T08:00:00Z",
      "modified": "2026-03-29T22:00:00Z",
      "size": 2048
    }
  ]
}
```

---

## Board Lua State Machine

```lua
local HudEditorState = {
  mode = "start",        -- "start", "loaded", "editing"
  document = nil,
  selectedId = nil,
  isDirty = false,
  undoStack = {},
  redoStack = {},
}

local CMD = {
  PING = "ping",
  SYNC = "sync",
  NEW = "new",
  LOAD = "load",
  SAVE = "save",
  LIST = "list",
  ADD = "add",
  UPD = "upd",
  DEL = "del",
  SEL = "sel",
  MOVS = "movs",
  MOVU = "movu",
  MOVE = "move",
  RESS = "ress",
  RESU = "resu",
  RESE = "rese",
}

function onInputReceived(input)
  if not input or type(input) ~= "string" then
    return
  end

  local parts = {}
  for part in input:gmatch("[^|]+") do
    table.insert(parts, part)
  end

  local cmd = parts[1]

  if cmd == CMD.PING then
    return "pong|hud-editor-v1"

  elseif cmd == CMD.SYNC then
    return syncState()

  elseif cmd == CMD.NEW then
    return createNewDocument(tonumber(parts[2]), tonumber(parts[3]))

  elseif cmd == CMD.LOAD then
    return loadDocument(parts[2])

  elseif cmd == CMD.SAVE then
    return saveDocument(parts[2])

  elseif cmd == CMD.LIST then
    return listScripts()

  elseif cmd == CMD.ADD then
    return addElement(parts[2])

  elseif cmd == CMD.UPD then
    return updateElement(parts[2], parts[3])

  elseif cmd == CMD.DEL then
    return deleteElement(parts[2])

  elseif cmd == CMD.SEL then
    return selectElement(parts[2])

  elseif cmd == CMD.MOVS then
    return moveStart(parts[2], parts[3], parts[4])

  elseif cmd == CMD.MOVU then
    return moveUpdate(parts[2], parts[3], parts[4])

  elseif cmd == CMD.MOVE then
    return moveEnd(parts[2], parts[3], parts[4])

  elseif cmd == CMD.RESS then
    return resizeStart(parts[2], parts[3], parts[4], parts[5])

  elseif cmd == CMD.RESU then
    return resizeUpdate(parts[2], parts[3], parts[4], parts[5])

  elseif cmd == CMD.RESE then
    return resizeEnd(parts[2], parts[3], parts[4], parts[5])
  end
end
```

---

## Databank Schema

### Script Metadata Key

```lua
local DB_KEYS = {
  SCRIPT_INDEX = "hud_editor:index",      -- JSON array of script metadata
  SCRIPT_PREFIX = "hud_editor:script:",  -- Prefix for script data: hud_editor:script:<id>
}
```

### Script Index Format

```json
{
  "version": 1,
  "scripts": [
    {
      "id": "a1b2c3d4",
      "name": "My Layout",
      "created": 1743369600,
      "modified": 1743373200,
      "checksum": "abc123..."
    }
  ]
}
```

### Script Data Format

Stored as Lua table JSON:

```lua
{
  "id": "a1b2c3d4",
  "name": "My Layout",
  "screenWidth": 1920,
  "screenHeight": 1080,
  "elements": {
    {
      "id": "main_panel",
      "type": "boxRounded",
      "x": 100, "y": 100, "w": 500, "h": 300,
      "radius": 20,
      "fill": {0.1, 0.1, 0.1, 0.9},
      "stroke": {0.9, 0.9, 0.9, 1.0},
      "strokeWidth": 2,
      "textLines": {"Hello World"},
      "textColor": {1, 1, 1, 1},
      "textSize": 24,
      "textAlign": "center"
    }
  }
}
```

---

## File Operations via Bridge

### Layout Directory

```
D:\github\du-tobi\live_lua_coding\
├── layouts\
│   ├── index.json           -- Master layout index
│   ├── a1b2c3d4.json       -- Individual layout files
│   └── ...
├── renderers\
│   ├── boxRounded.lua
│   ├── box.lua
│   ├── circle.lua
│   ├── text.lua
│   └── ...
└── examples\
    └── hud_editor_v2\      -- Board/screen scripts
```

### Bridge File Protocol

```javascript
// Read layout from filesystem
async function readLayoutFile(layoutId) {
  const response = await bridge.sendCommand({
    action: "readFile",
    path: `D:\\github\\du-tobi\\live_lua_coding\\layouts\\${layoutId}.json`
  });
  return JSON.parse(response.content);
}

// Write layout to filesystem
async function writeLayoutFile(layoutId, data) {
  await bridge.sendCommand({
    action: "writeFile",
    path: `D:\\github\\du-tobi\\live_lua_coding\\layouts\\${layoutId}.json`,
    content: JSON.stringify(data, null, 2)
  });
}
```

---

## Implementation Phases

### Phase 1: Core Mode Toggle + Start Screen

**Goal**: LCTRL toggle enters edit mode, show start screen

1. Create `000-core.js` with:
   - LCTRL key detection
   - Mode state machine (camera/edit)
   - `enterEditMode()` / `exitEditMode()`
   - Start screen HTML/CSS

2. Implement start screen:
   - New Script button → creates empty document
   - Load button → shows load dialog
   - Save As button → shows save dialog
   - Release LCTRL → exit edit mode

3. Add `010-start-screen.js` module

### Phase 2: WYSIWYG Editor Shell

**Goal**: Basic editor UI without interactivity

1. Create editor HTML structure:
   - Toolbar
   - Canvas container
   - Properties panel (hidden until selection)
   - Status bar

2. Add `020-editor-shell.js` module

3. Implement screen navigation:
   - Start → Editor (on New/Load)
   - Editor → Start (on Save+Exit)

### Phase 3: Canvas Rendering

**Goal**: Render elements as positioned divs in canvas preview

1. Create `030-canvas-renderer.js` module
2. Implement element rendering as DOM elements
3. Add selection visualization
4. Add resize handles

### Phase 4: Element Creation Tools

**Goal**: Click-to-create new elements

1. Add tool buttons to toolbar
2. Implement create mode for each element type
3. Add element type specific properties

### Phase 5: Selection + Properties Panel

**Goal**: Select elements and edit properties

1. Hit testing on canvas
2. Properties panel population
3. Two-way binding (edit prop → update element)

### Phase 6: Drag to Move

**Goal**: Drag elements to reposition

1. Mousedown on element → start drag
2. Mousemove → update position (optimistic + send command)
3. Mouseup → finish drag (send final command to board)

### Phase 7: Resize Handles

**Goal**: Drag handles to resize elements

1. Render 8 resize handles on selected element
2. Drag each handle → appropriate resize operation
3. Send commands to board

### Phase 8: Board/Screen Integration

**Goal**: Commands flow to board, board renders to screen

1. Implement command serialization
2. Board Lua command handlers
3. Screen render loop
4. Bidirectional sync

### Phase 9: Databank Persistence

**Goal**: Save/load from databank

1. Script index management
2. Script data read/write
3. Load dialog population
4. Save/Save As flow

### Phase 10: File System + Bridge Sync

**Goal**: Sync layouts to local files

1. File read/write via bridge
2. Auto-save to file
3. Load from file option

### Phase 11: Undo/Redo

**Goal**: Full undo/redo stack

1. Command-based undo (not just state snapshots)
2. Ctrl+Z / Ctrl+Y bindings
3. UI buttons

### Phase 12: Polish + Edge Cases

**Goal**: Robust, user-friendly editor

1. Close confirmation dialog
2. Dirty state tracking
3. Error handling + toasts
4. Keyboard shortcuts
5. Multi-element selection

---

## Project Source Structure

**CRITICAL**: This project is **completely self-contained** and does NOT intermingle sources with ModUiExtractor core payloads. All JS sources live within this project folder.

```
D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1\
├── js\                             # Project's own JS work folder
│   ├── modules\                    # Source JS modules
│   │   ├── 000-core.js            # Mode toggle, key detection, state
│   │   ├── 010-start-screen.js    # Start screen HTML + logic
│   │   ├── 020-editor-shell.js    # Editor HTML + navigation
│   │   ├── 030-canvas-renderer.js # DOM-based element rendering
│   │   ├── 040-tool-handlers.js   # Tool selection + create logic
│   │   ├── 050-selection-manager.js# Element selection + hit testing
│   │   ├── 060-drag-resize.js     # Drag and resize operations
│   │   ├── 070-properties-panel.js# Properties editing UI + binding
│   │   ├── 080-bridge-commands.js # Command serialization + IPC
│   │   ├── 090-databank-sync.js   # Databank save/load
│   │   ├── 100-file-sync.js       # Filesystem via bridge
│   │   ├── 110-undo-redo.js      # Undo/redo stack
│   │   └── 120-dialogs.js         # Dialogs (load, saveas, confirm)
│   ├── manifest.txt               # Module load order
│   └── assets\                    # CSS, images, fonts
│       └── hud-editor.css
├── build\                         # Build output (before packaging)
│   └── hud-editor-probe.js        # Concatenated+minified single file
├── scripts\                       # Project's own build scripts
│   ├── build.ps1                  # Concatenate modules → single file
│   └── publish.ps1                # Publish to runtime payload-overrides
├── layouts\                       # Layout JSON storage
├── renderers\                     # Lua renderer modules
├── board\                         # Board Lua scripts
└── screen\                        # Screen Lua scripts
```

### Build Output

The build process produces a **single payload file**:

```
build\hud-editor-probe.js    # One self-contained JS file
```

This file is then published to the runtime override folder:

```
D:\MyDUserver\tmp\ui-dumps\payload-overrides\
├── hud-editor-probe.js      # Copied here by publish.ps1
└── (other core payloads)
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| LCTRL (hold) | Enter edit mode |
| LCTRL (release) | Exit edit mode |
| V | Select tool |
| B | Box tool |
| R | Rounded box tool |
| C | Circle tool |
| L | Line tool |
| T | Text tool |
| Delete | Delete selected element |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save |
| Escape | Deselect / Cancel operation |

---

## Build and Publish

This project maintains its **own independent build pipeline**, but produces a **combined payload** that includes both the core ModUiExtractor (MCP bridge) and this project's HUD editor.

### Build Only (no publish)

```powershell
cd D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1

# Build only: concatenate modules into build\hud-editor-probe.js
.\scripts\build.ps1
```

### Combined Publish (core + HUD editor)

```powershell
# Build AND combine with core ModUiExtractor payload:
.\scripts\publish.ps1

# Output: payload-overrides\combined-probe.js
# Contains: lua-editor-probe.js + hud-editor-probe.js
# Size: ~453KB (core 355KB + HUD 98KB)
```

### Namespace Isolation (No Conflicts)

The combined payload is safe because namespaces are completely separate:

| Aspect | Core (lua-editor-probe) | HUD Editor |
|--------|------------------------|------------|
| Global objects | `window.__UI_EXTRACTOR_LUA_PROBE_*` | `window.HudEditor` |
| DOM roots | `#dpu_editor`, `#slots_container` | `#hud-editor-root` |
| localStorage | `ModUiExtractor.lua.*` | `hud_editor_*` |
| Event bus | Internal `sendPacket` | Own `emit()`/`on()` |

Both payloads use IIFEs with `"use strict"` - fully isolated scopes.

### In-Game Usage

```
1. Run .\scripts\publish.ps1 to build combined payload
2. Copy combined-probe.js to game's payload injection folder
   OR use the one already in payload-overrides/
3. Start game with ModUiExtractor loaded
4. Link board + screen + databank to an element
5. Inject the combined payload via ModUiExtractor UI
6. Hold LCTRL to enter edit mode
7. Start screen appears
8. Select New/Load to begin editing
```

---

## Key Files - Implementation Status

### JS Source Modules (in project's own js/ folder)

| File | Status | Purpose |
|------|--------|---------|
| `js/modules/000-core.js` | **DONE** | LCTRL toggle, mode state |
| `js/modules/010-start-screen.js` | **DONE** | Start screen UI + logic |
| `js/modules/020-editor-shell.js` | **DONE** | Editor HTML structure |
| `js/modules/030-canvas-renderer.js` | **DONE** | DOM element rendering |
| `js/modules/040-tool-handlers.js` | **DONE** | Tool mode handling |
| `js/modules/050-selection-manager.js` | **DONE** | Selection + hit testing |
| `js/modules/060-drag-resize.js` | DONE* | Drag/resize (via selection-manager) |
| `js/modules/070-properties-panel.js` | **DONE** | Properties editing UI + binding |
| `js/modules/080-bridge-commands.js` | **DONE** | Command serialization + IPC |
| `js/modules/090-databank-sync.js` | **DONE** | Databank save/load coordination |
| `js/modules/100-file-sync.js` | **DONE** | localStorage save/load, JSON export |
| `js/modules/110-undo-redo.js` | **DONE** | Undo/redo stack |
| `js/modules/120-dialogs.js` | **DONE** | Dialog components |
| `js/manifest.txt` | **DONE** | Module load order |
| `js/assets/hud-editor.css` | **DONE** | All CSS styles |

* Drag/resize implemented via selection-manager resize handles (M6-M7).

### Build Scripts (project's own scripts/ folder)

| File | Status | Purpose |
|------|--------|---------|
| `scripts/build.ps1` | **DONE** | Concatenate modules → `build/hud-editor-probe.js` |
| `scripts/publish.ps1` | **DONE** | Copy build output to runtime `payload-overrides/` |

### Lua Board/Screen Scripts

| File | Purpose |
|------|---------|
| `board/hud-editor-board.lua` | Board script with command handlers |
| `screen/hud-editor-screen.lua` | Screen script with render loop |
| `renderers/*.lua` | Element type renderers |

### Layout Storage

| File | Purpose |
|------|---------|
| `layouts/index.json` | Layout index |
| `layouts/*.json` | Individual layout files |

---

## Technical Considerations

### 1. LCTRL Capture Priority

The LCTRL key must be captured **before** it reaches the game's camera control:
- Use `keydown` with `event.stopPropagation()` to prevent game receipt
- Ensure no race condition between HUD and game handling

### 2. Canvas Coordinate Space

The WYSIWYG canvas preview uses CSS pixels scaled to match screen resolution:
- Calculate scale factor: `canvasWidth / screenWidth`
- Transform mouse events inversely
- Maintain aspect ratio for accurate preview

### 3. HUD DOM Overlay

The editor HTML must overlay cleanly on the HUD without breaking game UI:
- Use high z-index (10000+)
- `pointer-events: none` on container when not in edit mode
- When in edit mode, intercept mouse on canvas only
- Keep toolbar/statusbar interactions local

### 4. Command Batching for Drag/Resize

Drag operations generate many commands. Optimize by:
- Throttling `movu` updates to ~60fps max
- Sending only final `move` command for undo purposes
- Optimistic UI updates (apply immediately in HUD)

### 5. State Synchronization

Two-way sync between HUD and Board:
- Board is source of truth for element data
- HUD maintains local state for smooth editing
- On `movu`/`resu`, HUD updates optimistically
- On `hsync`, reconcile any divergence

### 6. Screen Rendering

The actual screen shows rendered Lua output, not the WYSIWYG preview:
- WYSIWYG preview is approximated using DOM/CSS
- Actual screen output comes from board Lua via normal rendering
- HUD preview and screen output may have minor visual differences

---

## Milestones

| # | Status | Description |
|---|--------|-------------|
| M1 | **DONE** | LCTRL toggle + start screen |
| M2 | **DONE** | Editor shell UI with toolbar + canvas |
| M3 | **DONE** | DOM rendering of elements in canvas |
| M4 | **DONE** | Element creation tools |
| M5 | **DONE** | Selection + properties panel |
| M6 | **DONE** | Drag to move (via selection) |
| M7 | **DONE** | Resize handles (via selection-manager) |
| M8 | **DONE** | Dialogs (load/saveas/close confirm) |
| M9 | **DONE** | Bridge commands + local state |
| M10 | **DONE** | Board Lua command handlers |
| M11 | **DONE** | Screen render loop skeleton |
| M12 | **DONE** | Undo/redo |
| M13 | **DONE** | File sync (localStorage + JSON export) |
| M14 | **DONE** | Databank sync coordination |
| M15 | TODO | Full end-to-end in-game testing |

**Current**: ALL JS modules done (12 modules, ~2800 lines). Board Lua + Screen Lua complete.

---

## References

- Existing Lua probe: `ModUiExtractor/payload/lua-editor-probe.modules/`
- ScreenLayoutEditor: `live_lua_coding/examples/hud_editor_v1/ScreenLayoutEditor.lua`
- Bridge protocol: `DuMcpBridge/README.md`
- rs_emulator (offline testing): `rs_emulator/src/`
