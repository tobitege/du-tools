# Lua Painter Web Harness

This folder contains the browser harness for `live_lua_coding/examples/hud_editor_v1`.

It exists to make HUD editor iteration fast outside Dual Universe:

- the editor UI is mostly browser code
- this harness loads the built payload in a normal browser so layout, selection, grouping, persistence, and general UI behavior can be debugged locally

## What Is In This Folder

- `index.html`
  - browser page for the harness and its floating control panel
- `harness.js`
  - bootstraps the built HUD payload, provides a fake runtime-module context, and exposes helper controls
- `server.mjs`
  - tiny static file server for local testing
- `playwright.config.mjs`
  - Playwright configuration for this harness
- `tests/`
  - browser regression tests
- `fixtures/`
  - reusable test layouts, including `layout-all-shapes.json`

## Install

Use `pnpm` in this folder and ignore parent workspaces.

```powershell
cd .\live_lua_coding\examples\hud_editor_v1\web
pnpm install --ignore-workspace
```

Why `--ignore-workspace`:

- this machine has unrelated pnpm workspace metadata above this repo
- without it, `pnpm` may try to treat this folder as part of a larger external workspace

## Build The Payload

Before using the harness, rebuild the HUD payload:

```powershell
cd .
pwsh -File .\live_lua_coding\examples\hud_editor_v1\scripts\build.ps1
```

The harness loads:

- `..\build\hud-editor-probe.js`

## Run The Harness Manually

```powershell
cd .\live_lua_coding\examples\hud_editor_v1\web
pnpm run serve
```

Then open:

```text
http://127.0.0.1:4173/web/index.html
```

## Run Browser Tests

```powershell
cd .\live_lua_coding\examples\hud_editor_v1\web
pnpm test
```

Run headed:

```powershell
pnpm run test:headed
```

## Main Feature Set

- Browser-based WYSIWYG HUD layout editing
- Screen-space editing using a `1920x1080` coordinate system
- Live preview rendering with automatic scale conversion
- Shape creation tools for:
  - Box
  - Rounded box
  - Circle
  - Line
  - Text
- Single selection, multi-selection, and persistent grouping
- Aggregate resize handles for multi-selections and groups
- Group actions for dragging, resizing, deleting, and cloning
- Clone by fixed offset with immediate selection of the new copy or copies
- Alignment tools for both single elements and multi-element selections
- A Layers panel with:
  - Visibility toggles
  - Z-order controls
  - Orange group highlighting for grouped items
  - Collapse persistence
  - Optional hover-open behavior when collapsed
- A Properties panel with:
  - Position and size editing
  - Fill and stroke color editing
  - Stroke width controls
  - Radius controls when applicable
  - Text editing
  - Bulk fill, stroke, and stroke width updates for multi-selection
  - Collapse persistence
  - Optional hover-open behavior when collapsed
- Snapshot-based undo and redo
- Browser local storage save and load
- Save, load, and unsaved-changes dialogs
- Toast notifications with duplicate messages merged instead of stacked

## Buttons And Actions

### Harness Panel

The floating `Lua Painter Harness` panel lives outside the HUD editor UI and controls the web test environment.

- `Open HUD`
  - enters edit mode
- `Close HUD`
  - exits edit mode
- `New Script`
  - clicks the editor start-screen `New Script` action
- `Load Fixture`
  - imports `fixtures/layout-all-shapes.json` into the editor
- `Reset Storage`
  - clears browser-stored layouts and harness module state
- `Dump State`
  - refreshes the state dump panel
- `Clear Log`
  - clears the harness packet log
- harness rollup button in the panel header
  - collapses or expands the harness panel body

### HUD Toggle Button

The browser page also has a fixed `HUD Editor: ON/OFF` button.

- click when off
  - opens the editor
- click when on
  - closes the editor

### Start Screen

Visible when the editor is open and on the start screen.

- `New Script`
  - creates a new default layout with a full-screen rounded main panel and enters the editor screen
- `Load`
  - opens the `Load Script` dialog
- `Save As`
  - opens the `Save As` dialog

### Editor Toolbar

#### Tool Buttons

- `Select (V)`
  - standard selection, move, resize, grouping, and general editing tool
- `Shapes`
  - auto-closing toolbar dropdown that keeps the primitive creation tools together
  - the trigger shows the last active shape tool and stays highlighted while a shape tool is active
  - includes `Box (B)`, `Rounded Box (R)`, `Circle (C)`, `Line (L)`, and `Text (T)`

#### Color Controls

- `Fill`
  - toolbar color input that updates selected element fill
- `Stroke`
  - toolbar color input that updates selected element stroke

#### Grouping / Clone

- `Group (Ctrl+G)`
  - converts the current loose multi-selection into a persistent group
- `Ungroup (Ctrl+Shift+G)`
  - removes the persistent group and restores loose multi-selection of its members
- `Clone (Ctrl+D)`
  - duplicates the current selected element or selected aggregate/group, offsets the duplicate(s) by `24,24`, and selects the new clone(s)

#### Alignment

- `Align left`
  - aligns selected elements to the left edge of the aggregate bounds, or a single selected element to the canvas left edge
- `Align center horizontal`
  - horizontally centers selected elements within aggregate bounds, or a single selected element on the canvas
- `Align right`
  - aligns selected elements to the right edge of the aggregate bounds, or a single selected element to the canvas right edge
- `Align top`
  - aligns selected elements to the top edge of the aggregate bounds, or a single selected element to the canvas top edge
- `Align center vertical`
  - vertically centers selected elements within aggregate bounds, or a single selected element on the canvas
- `Align bottom`
  - aligns selected elements to the bottom edge of the aggregate bounds, or a single selected element to the canvas bottom edge

#### Panel Behavior

- `Auto Panels`
  - checkbox that enables temporary hover-open behavior for collapsed `Layers` and `Properties` panels
  - when enabled, collapsed panels expand on mouse hover and collapse again on mouse leave
  - persisted in local storage

#### History

- `Undo (Ctrl+Z)`
  - restores the previous document snapshot
- `Redo (Ctrl+Y)`
  - reapplies the next redo snapshot

### Layers Panel

The `Layers` panel is a floating panel on the right side of the editor.

- panel header collapse button
  - collapses or expands the panel
- panel body rows
  - click a row to select that element
  - `Shift` or `Ctrl` click to toggle it into loose multi-selection
- grouped rows
  - when a persistent group exists, grouped members are wrapped in one orange bordered container
  - clicking the orange container background selects the group
- visibility button on each row
  - hides or shows that element
- z-order up button on each row
  - moves that element forward in stacking order
- z-order down button on each row
  - moves that element backward in stacking order

### Properties Panel

The `Properties` panel is a floating panel on the left side of the editor.

- panel header collapse button
  - collapses or expands the panel
- `X`
  - sets element x-position
- `Y`
  - sets element y-position
- `W`
  - sets element width
- `H`
  - sets element height
- `Fill`
  - sets fill color
- `Stroke`
  - sets stroke color
- `Stroke W`
  - changes stroke width using the stepper presets
- `Radius`
  - changes radius using the stepper presets for `box` and `boxRounded`
  - hidden for `circle`, `line`, and `text`
- `Text`
  - edits `textLines` as a multiline textarea
- `Delete Element`
  - deletes the current active selection target

Notes:

- bulk property edits currently apply to all selected elements only for `fill`, `stroke`, and `strokeWidth`
- the properties panel follows the active element selection, not the persistent group container itself

### Status Bar

- `Save`
  - saves the current layout to browser storage using the current layout name or `Layout`
- `Export Board`
  - present in the UI, but in the web harness it only writes a simulated packet entry to the harness log
- `Export Screen`
  - present in the UI, but in the web harness it only writes a simulated packet entry to the harness log
- `Close`
  - closes the editor immediately if clean
  - opens the unsaved-changes dialog if dirty

### Dialog Buttons

#### Load Script Dialog

- `X`
  - closes the dialog
- `Cancel`
  - closes the dialog
- script list row
  - loads the selected saved layout

#### Save As Dialog

- `X`
  - closes the dialog
- `Cancel`
  - closes the dialog
- `Save`
  - saves the current layout under the entered script name

#### Unsaved Changes Dialog

- `Cancel`
  - returns to the editor without closing
- `Discard`
  - drops unsaved state and returns to the start screen
- `Save & Close`
  - saves, then returns to the start screen

## Interaction Model

### Selection

- single-click a shape to select it
- `Shift` or `Ctrl` click additional shapes to build loose multi-selection
- loose multi-selection shows one orange aggregate box with 8 handles
- clicking empty canvas clears loose selection

### Persistent Grouping

- `Group` turns a loose multi-selection into a persistent group
- persistent groups survive normal selection changes
- a group is only removed by explicit `Ungroup`
- groups render with an orange box on canvas and orange grouped container in `Layers`
- grouped members can still exist visually in the layer list as individual rows

### Drag And Resize

- selected single elements drag and resize normally
- loose multi-selection can drag and resize as an aggregate
- selected groups can drag and resize as an aggregate
- group and aggregate resize use 8 handles: 4 corners and 4 edge centers

### Alignment Rules

- for 2+ selected elements, alignment happens inside the aggregate bounds
- for one selected element, alignment happens relative to the full canvas

### Clone Rules

- clone duplicates current selection target(s)
- duplicate(s) are offset by `24,24`
- duplicate(s) become the new selection immediately

## Keyboard Shortcuts

- `V`
  - Select tool
- `B`
  - Box tool
- `R`
  - Rounded box tool
- `C`
  - Circle tool
- `L`
  - Line tool
- `T`
  - Text tool
- `Ctrl+Z`
  - Undo
- `Ctrl+Y`
  - Redo
- `Ctrl+S`
  - Save
- `Ctrl+G`
  - Group current loose multi-selection
- `Ctrl+Shift+G`
  - Ungroup current persistent group
- `Ctrl+D`
  - Clone current selection target
- `Delete`
  - Delete current active element selection
- `Escape`
  - on the start screen, closes the editor
  - otherwise clears active loose selection state

## Persistence

- local browser save/load uses local storage keys:
  - `hud_editor_layouts`
  - `hud_editor_current`
- panel collapse state is persisted for:
  - `Layers`
  - `Properties`
- auto-open panel behavior is persisted via:
  - `hud_auto_open_panels`

## What The Web Harness Gives You

- the HUD editor runs in a normal browser tab, so you can debug layout and interaction work locally
- the floating harness panel gives you quick controls for opening and closing the editor, creating a new script, loading the all-shapes fixture, resetting browser storage, inspecting state, and clearing the log
- save and load behavior can be exercised entirely in browser storage
- board and screen export buttons are still visible in the UI, but in this harness they only emit simulated log entries and do not talk to the game
- the harness panel starts collapsed by default to stay out of the way

## Current Workflow

1. edit HUD editor source in `..\js\modules\` or `..\js\assets\`
2. rebuild with `scripts\build.ps1`
3. use the web harness to debug behavior
4. validate in other environments only after the browser behavior is correct
