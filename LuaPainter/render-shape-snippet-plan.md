# HUD Editor Render Shape Snippet Plan

## Goal

Turn the `renderScript/shapes.lua` demo and the neon screenshot reference into a tracked snippet catalog that can drive:

- reproducible editor fixtures in the browser harness
- deterministic DOM-preview expectations in JS tests
- standalone RenderScript generation in `085-ide-export.js`
- the matching board-side Lua generation path in `HudEditorBoard.lua`

## Working Rule

Do not let the browser harness, the editor document model, and the RenderScript generator drift apart again.
New visual capabilities should be introduced as shared snippet recipes and shared draw-command intents first, then rendered through both adapters.

## Proposed Layers

1. `Snippet catalog`
   - tracked recipes with stable IDs, family names, required capabilities, and expected output notes
2. `Editor-document adapter`
   - expands a snippet recipe into HUD editor document elements when the recipe is representable in the current editor model
3. `Draw-command adapter`
   - expands the same recipe into a normalized list of draw commands for RenderScript-only features
4. `DOM-preview adapter`
   - renders the normalized commands in the web harness for parity checks
5. `Lua adapter`
   - serializes the normalized commands into Dual Universe RenderScript

## Demo Families

The upstream `shapes.lua` sample already gives us four clean reproducibility families:

1. `primitive/default`
   - one example of each primitive with minimal styling
2. `primitive/styled`
   - one example of each primitive with explicit fill, stroke, width, alpha, rotation, and shadow/glow-like emphasis
3. `overlap/same-type`
   - repeated instances of the same primitive layered with offsets and alpha
4. `overlap/mixed-type`
   - multiple primitive types stacked into a composite badge or banner

The screenshot adds a fifth family we should treat separately:

5. `effect/text-treatment`
   - RGB split text, neon outlines, concentric stroke halos, mirrored badge layouts

## Capability Tiers

### Tier 0: Current editor primitives

These already exist in the HUD editor and should become the first snippet set:

- `box`
- `boxRounded`
- `circle`
- `line`
- `text`

### Tier 1: Missing primitives from the DU demo

These need either new editor element types or RenderScript-only snippet support:

- `bezierArc`
- `triangle`
- `quad`
- `image`

### Tier 2: Style modifiers

These should be modeled as reusable modifiers instead of being hardcoded into individual snippets:

- `fill`
- `stroke`
- `strokeWidth`
- `alpha`
- `radius`
- `textSize`
- `textAlign`
- `rotation`
- `shadow` or `glow`
- `zOrder`

### Tier 3: Composition recipes

These are the demo-level snippets users actually care about:

- same-shape triple stack
- mixed-shape stack
- target rings
- crossed-line badge
- neon triangle badge
- diamond badge
- RGB split glyph text
- mirrored lower-row cluster

## Suggested Recipe Shape

Each tracked snippet should describe intent first, not just raw element arrays.

```json
{
  "id": "primitive_box_styled",
  "family": "primitive/styled",
  "requires": ["box", "fill", "stroke", "strokeWidth"],
  "editorRecipe": {
    "elements": []
  },
  "drawRecipe": {
    "commands": []
  },
  "expectations": {
    "domPreview": ["single centered box", "visible stroke halo"],
    "renderScript": ["createLayer", "setNextFillColor", "setNextStrokeColor", "addBox"]
  }
}
```

## First Catalog Pass

The first tracked snippet pass should be intentionally small and cover the categories that the current editor can already express:

1. `primitive_box_default`
2. `primitive_rounded_default`
3. `primitive_circle_default`
4. `primitive_line_default`
5. `primitive_text_default`
6. `primitive_box_styled`
7. `primitive_circle_styled`
8. `overlap_same_type_boxes`
9. `overlap_same_type_circles`
10. `overlap_mixed_shapes_basic`
11. `effect_text_rgb_split`

This gives us immediate parity work without waiting for bezier, triangle, quad, or image editing tools.

## Mapping To Real Files

### Browser/editor side

- `js/modules/020-editor-shell.js`
  - toolbar entry point for the new `Shapes` menu
- `js/modules/082-shape-snippets.js`
  - tracked snippet recipes and document builders
- `js/modules/083-screen-commands.js`
  - normalized screen draw-command adapter shared by export and runtime tests
- `js/modules/030-canvas-renderer.js`
  - DOM approximation path for normalized draw commands
- `js/modules/040-tool-handlers.js`
  - creation flow for any new primitive editor types
- `js/modules/085-ide-export.js`
  - RenderScript serializer for normalized draw commands

### Test side

- `web/fixtures/`
  - generated or checked-in snippet fixtures
- `web/tests/lua-painter.spec.js`
  - smoke tests for toolbar behavior and current primitive snippets
- `web/tests/lua-painter-snippets.spec.js`
  - visual and structural parity checks for the snippet catalog

### Lua side

- `board/HudEditorBoard.lua`
  - same draw-command serialization as the JS exporter
- `screen/HudEditorScreen.lua`
  - runtime parity reference for supported element fields

## Execution Order

1. keep the toolbar compact by moving primitive selection into an auto-closing `Shapes` menu
2. add a snippet catalog file for the existing five primitives and two overlap recipes
3. move JS export from direct element branching toward a normalized draw-command list
   - status: done via `083-screen-commands.js` and `085-ide-export.js`
4. teach the DOM preview to render from the same normalized commands for catalog tests
5. extend the editor schema for `triangle`, `quad`, `bezierArc`, and `image`
6. port the same command rules into `HudEditorBoard.lua`
   - status: done for the current shape/text/line command set
7. add live DU verification recipes only after the web harness and Lua output agree

## Guardrails

- Keep `web` parity tests structural first and visual second
- Treat glow, blur, and shadow as explicit modifiers, not as accidental CSS-only effects
- Do not add Dual Universe-only commands directly into random editor code paths; route them through the shared draw-command adapter
- When a snippet cannot yet be represented as an editor document, keep it cataloged anyway and mark it `renderOnly`
