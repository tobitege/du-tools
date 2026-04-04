# Findings & Decisions

## Requirements
- Review whether the prior analysis about localStorage-only panel persistence is accurate.
- Restore reliable persistence for the Lua painter floating panels "Properties" and "Layers".
- Prefer a solution where the positions are passed to the outside via the DU mod and probe rather than relying only on browser localStorage.

## Research Findings
- `LuaPainter/js/modules/060-shapes-panel.js` uses `hud_shapes_panel_pos`.
- `LuaPainter/js/modules/070-properties-panel.js` uses `hud_props_panel_pos`.
- Both panel modules currently save and restore through `localStorage`.
- `ModUiExtractor/payload/ModUiExtractor-payload.js` contains generic storage dump logic (`readStorage`) but that is inspection/debugging, not a dedicated persistence write-back path for these keys.
- Generated HUD editor runtime bundle copies the same panel persistence logic into `ModUiExtractor/payload/lua-editor-runtime-modules/hud-editor/hud-editor-probe.js`.
- The actual mod/probe persistence channel already exists for runtime modules through `ctx.getState(...)` / `ctx.setState(...)`, backed by `lua_runtime_module_state_set` packets and persisted JSON on the C# side.
- The earlier analysis was partly right about the panel code being localStorage-based, but incomplete about the overall architecture: the repo does have a proper outside-the-browser persistence path, the Lua Painter panels just were not using it.
- The old properties restore logic would reset valid `0px` positions because it used `parseFloat(...) || 12` / `|| 72`.
- Restore timing could also misbehave when editor layout metrics were still zero; a second restore pass on the next tick reduces that risk.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Verify the real probe/mod persistence mechanism before editing panel JS | The user wants the positions passed through the mod/probe, so we need to reuse the correct channel |
| Add shared persistence helpers to `000-core.js` | Lets HUD modules use runtime module state without duplicating bridge access details everywhere |
| Migrate old localStorage panel positions into runtime state on read | Preserves existing user positions after the fix lands |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Session catchup command returned no visible output | Proceeded with current repo state since no stale planning context was reported |
| Existing repo worktree already had many modified generated/docs files | Limited manual edits to source modules and synced generated HUD editor outputs after rebuilding |

## Resources
- `ModUiExtractor/payload/ModUiExtractor-payload.js`
- `ModUiExtractor/payload/lua-editor-probe.modules/`
- `ModUiExtractor/payload/lua-editor-probe.modules/070-runtime-module-manager.js`
- `ModUiExtractor/ModUIExtractor.cs`
- `LuaPainter/js/modules/060-shapes-panel.js`
- `LuaPainter/js/modules/070-properties-panel.js`
- `LuaPainter/js/modules/000-core.js`
- `ModUiExtractor/payload/lua-editor-runtime-modules/hud-editor/hud-editor-probe.js`

## Visual/Browser Findings
- No browser inspection yet.
- No live DU client validation yet; repo-side build/output verification only.

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
