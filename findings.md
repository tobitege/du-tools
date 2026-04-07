# Findings & Decisions

## Requirements
- Split the legacy theme/editor module into concern-based `023-*` and higher modules.
- Start from physical copies of the original `030-*` content.
- Prune copied files by removal only.
- Only after the new files are complete, remove migrated functions from `030-*`.
- Preserve runtime behavior by maintaining valid manifest load order.

## Research Findings
- `manifest.txt` defines lua probe module load order.
- `030-deps.md` now provides a 90-function same-file dependency catalogue for `030-*`.
- `030-*` contains clear theme core, theme UI, editor, and inventory clusters.
- No industry-specific theming code was found in `030-*` during keyword and function review.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Plan files are kept in repo root for this refactor | Matches the `planning-with-files` workflow |
| Use `Copy-Item` for initial duplication | Satisfies the requested physical copy step without retyping content |
| Group screen editor facelift with editor concern unless a cleaner split emerges | It depends on editor-specific functions and state despite being UI-heavy |
| Split output files are `023-theme-core.js`, `024-theme-ui.js`, `025-editor-enhancements.js`, and `026-inventory-theme.js` | These buckets cover all 90 functions found in `030-*` without introducing inferred helper rewrites |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Initial automated dependency extraction only captured three functions | Fixed the script by avoiding PowerShell’s automatic `$Matches` variable |

## Resources
- `ModUiToolbox/payload/lua-editor-probe.modules/023-theme-core.js`
- `ModUiToolbox/payload/lua-editor-probe.modules/024-theme-ui.js`
- `ModUiToolbox/payload/lua-editor-probe.modules/025-editor-enhancements.js`
- `ModUiToolbox/payload/lua-editor-probe.modules/026-inventory-theme.js`
- `ModUiToolbox/payload/lua-editor-probe.modules/manifest.txt`
- `030-deps.md`

## Visual/Browser Findings
- None
