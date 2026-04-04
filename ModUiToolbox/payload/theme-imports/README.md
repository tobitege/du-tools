# Theme Imports

This folder contains imported theme source data used by the Lua probe.

- `flowery-daisy-palettes.compact.json` is a generated compact catalog of base palette values.
- It is input data, not the final Lua editor styling.
- The probe reads these palette values and derives editor-specific colors in JS, such as:
  - button gradients
  - border contrast
  - text contrast
  - hover and active states
  - readable accent variants

Why this exists:

- It keeps the raw palette catalog separate from probe-specific styling logic.
- Updating editor visuals usually happens in the probe modules, not in this JSON file.
- The JSON can be regenerated from the Flowery palette source without losing Lua editor tuning.

How the values are translated:

- The compact JSON provides base palette tokens such as:
  - `p` / `pf` / `pc` for primary colors
  - `nu` / `nc` for neutral colors
  - `b1` / `b2` / `b3` / `bc` for base surfaces and text
  - `i`, `w`, `e` for info, warning, and error accents
- In `..\lua-editor-probe.modules\030-caret-theme-ide-sync.js`, the probe turns those raw values into a richer editor theme object.
- That translation layer does things like:
  - detect whether the theme is effectively light or dark
  - mix and shade colors to build readable row backgrounds and elevated surfaces
  - choose readable foreground colors against accent and surface backgrounds
  - derive button gradients, hover colors, active colors, disabled colors, and border strengths
  - derive CodeMirror token colors and caret-line highlight colors
- The resulting derived values are then written into CSS custom properties such as:
  - `--lua-probe-surface-main`
  - `--lua-probe-surface-row`
  - `--lua-probe-border-strong`
  - `--lua-probe-btn-apply-bg`
  - `--lua-probe-btn-cancel-bg`
  - `--lua-probe-cm-keyword`
  - `--lua-probe-caret-line-bg`
- In `..\lua-editor-probe.modules\010-context-and-viewport.js`, those CSS variables are applied to the actual Lua editor and screen editor UI.

In short:

- JSON = source palette tokens
- `030-caret-theme-ide-sync.js` = translation/derivation layer
- `010-context-and-viewport.js` = concrete UI styling layer

Related files:

- `..\lua-editor-probe.modules\030-caret-theme-ide-sync.js`
- `..\lua-editor-probe.modules\010-context-and-viewport.js`
- `..\..\tools\extract-flowery-daisy-palettes.ps1`
