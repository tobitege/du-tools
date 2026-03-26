# Progress Log

## Sessions: 2026-03-24 to 2026-03-25

## Summary

The `SvgShapeClassifier` remained intentionally unchanged in the latest porter rounds. The shape-library / porter integration now covers:

- `hex_ring`
- `polygon_ring`
- four-point fill shapes
- `closed_polygon` fills
- selected `compound_path` stroke cases

Those families now run through shared classifier-to-library rules instead of local example-only tables.

## Phase Snapshot

### Phases 1-4: Planning

- Requirements, target architecture, risks, and rollout strategy for the classifier and shape library were documented.
- The planning workspace was created under `rs_emulator/planning`.

### Phase 5: First Classifier Implementation

- Basic SVG analysis was added: path flattening, subpaths, bounds, open vs. closed paths, and the first primitive detection rules.

### Phases 6-7: Ring Classification

- `polygon_ring` was implemented first, followed by `hex_ring`, both against real `SimpleSignS` cases.

### Phase 8: Group Hints

- Initial geometric clustering hints were added with `sameCluster`, `clusterSize`, and `neighbors`.

### Phases 9-11: First Role Hints

- `frame_outline`, `edge_decal`, and `frame_cap` were derived from real `SimpleSignS` geometry.

### Phase 12: Review Hardening

- Role and cluster logic was hardened against false positives.
- `frame_outline` now requires real or effectively closed contours.
- `frame_cap` now requires matching frame context.
- `groupHints` became role-aware.

### Phase 13: Logo Segment

- `logo_segment` was implemented for quadrant-mirrored `closed_polygon` families inside a shared `frame_outline`.
- Frame context was split into `findCenteredFrameOutline(...)` and `findEnclosingFrameOutline(...)`.
- Real `SimpleSignS` corner segments `SVG 1 #01`, `#02`, `#05`, and `#06` now carry `role=logo_segment`.

### Phase 14: First Shape-Library Handoff

- The first classifier-driven library adapter landed in `SilverZeroRsLib.lua`: `drawClassifiedShape(...)` and `drawClassifiedHexRing(...)`.
- `hex_ring` now maps classified geometry onto the existing `hexRing(...)` renderer.
- `SimpleSignS-svg.lua` uses that classifier-to-library path for the real logo ring instead of local ring constants and transform-only special handling.

### Phase 15: Four-Point Board Fills

- `SilverZeroRsLib.lua` now renders classified four-point shapes (`quad`, `trapezoid`, and suitable `outline_path` cases) through `drawClassifiedFourPointShape(...)`.
- `SimpleSignS-svg.lua` classifies the board SVG once and tries the shared classified-shape adapter first for filled items.
- The old `skipBoardPath` string list and handwritten board-quad tables were removed.

### Phase 16: Closed Polygon Fill Path

- `SilverZeroRsLib.lua` now triangulates classified `closed_polygon` and `triangle` shapes through `drawClassifiedClosedPolygon(...)`.
- The real `frame_cap` case in the `SimpleSignS` board now goes through classifier -> library -> triangle rendering instead of the old path fallback.
- The end-to-end render of `SimpleSignS-svg.lua` now includes `AddTriangle` commands from this porting path.

### Phase 17: Logo Segment Porting Cleanup

- `SimpleSignS-svg.lua` now uses the same fill-first rule in the logo as on the board: filled items try `drawClassifiedShape(...)` first, followed by path fallback.
- The local `logoSegmentQuads` table and its special-case handling were removed.
- Real `logo_segment` fragments now go through the same classifier-to-library path as `frame_cap` and the board four-point fills.

### Phase 18: Polygon Ring Path

- `SilverZeroRsLib.lua` now renders classified `polygon_ring` shapes through a general ring-segment adapter.
- The `master-artboard` branch in `SimpleSignS-svg.lua` was also classified once and initially attempted classified rendering for filled items.
- The real `SimpleSignS` marker rings were no longer limited to raw path contours, but rendered as explicit ring segments from the shape library.

### Phase 19: Compound Path Geometry Path

- `SilverZeroRsLib.lua` now renders selected `compound_path` shapes through their extracted subpaths as line segments.
- The real `SimpleSignS` board case `compound_path role=edge_decal` now goes through classifier -> library instead of the older `firstSubpathOnly(...)` fallback.
- The porter now passes the existing stroke context (`strokeWidth`) into the classifier-driven library path as well.

### Phase 20: SimpleSignS SVG Regression Guard

- After a visible regression in `SimpleSignS-svg.lua`, `master-artboard` and logo were temporarily kept on the known-good path instead of a wider classifier-first rollout.
- The production library adapters for `hex_ring`, `polygon_ring`, four-point fills, `closed_polygon`, and `compound_path` were kept; in end-to-end use, the board path remained the main production route.
- For the logo, the rule was narrowed: fill-capable classified shapes use `drawClassifiedShape(...)`, while outline-only cases stay on `drawPath(...)`.
- `luaRuntime.test.ts` was updated to lock the current add-op distribution for `SimpleSignS-svg.lua` and to anchor the logo layer against regressions.

### Phase 21: Fill-Only Adapter Rule

- `SilverZeroRsLib.lua` now exposes `drawClassifiedFillShape(...)` as a reusable rule for classifier-driven fill families without implicitly pulling in outline or compound cases.
- `SimpleSignS-svg.lua` uses that shared rule in the logo instead of a local kind whitelist.
- New runtime tests directly cover the real logo behavior: `logo_segment` is rendered through the fill adapter, while `outline_path role=edge_decal` is intentionally skipped there.

### Phase 22: Free-Form Adapter Probe

- `examples/SilverZero/ShapeClassifierAdapterProbe.lua` was added as a free-form visual probe independent of the `SimpleSign*` examples.
- The probe shows labeled example cells for `hex_ring`, `polygon_ring`, `trapezoid`, `closed_polygon`, `compound_path`, and `outline_path`.
- `luaRuntime.test.ts` also executes the probe and verifies both the textual adapter summary and the presence of text, line, quad, and triangle render calls.

### Phase 23: Stroke Adapter Rule

- `SilverZeroRsLib.lua` now exposes `drawClassifiedStrokeShape(...)` as a reusable rule for stroke-oriented classifier families.
- The first intentionally small production scope is geometric: `outline_path` and `compound_path`.
- The free-form `ShapeClassifierAdapterProbe.lua` now uses this stroke rule directly for the two lower-right cells instead of relying on implicit fallback.
- New runtime tests cover the stroke adapter directly with synthetic `outline_path` and `compound_path` cases.

### Phase 24: Classified Path-Item Porter Helper

- `SilverZeroRsLib.lua` now exposes `drawClassifiedPathItem(...)` as a reusable porter helper that combines classifier-driven library adapters with the existing `drawPath(...)` fallback under one rule.
- `SimpleSignS-svg.lua` uses that helper for both the board branch (`classifiedMode = "shape"` with `fallbackFirstSubpathOnly`) and the logo branch (`classifiedMode = "fill"`).
- The real board rule stayed intact: `outline_path` decals can still go through the generic filled four-point adapter, while outline-only logo parts still fall back cleanly to the path renderer in fill mode.
- New runtime tests cover the porter helper directly for a real board decal and a real outline-only logo case.

### Phase 25: Master Artboard Polygon Ring Handoff

- `SilverZeroRsLib.lua` now lets classifier-driven porter paths be filtered via `classifiedKinds`, so individual real families can be enabled deliberately.
- `SimpleSignS-svg.lua` now classifies `master-artboard` once and routes only `polygon_ring` through the shared porter.
- The 23 real marker rings in `master-artboard` now go through the shape library again, while the rest of that branch stays on the known raw-path fallback.
- New runtime tests cover both the generic kind-filter fallback and the updated end-to-end `SimpleSignS-svg.lua` baseline.

### Phase 26: Master Artboard Four-Point Handoff

- The same `master-artboard` kind filter now also allows `quad` and `trapezoid` through the shared fill porter.
- That means the three real four-point cases in `master-artboard` (`1` `quad`, `2` `trapezoid`) now also use the shared library adapter instead of raw-path line rendering.
- New runtime tests cover a real `master-artboard` `trapezoid` directly through `drawClassifiedPathItem(...)`.
- The `SimpleSignS-svg` baseline shifted only slightly again: `4878` render calls total, with `4213` `AddLine`, `589` `AddQuad`, and still `74` `AddTriangle`.

### Phase 27: Workflow Documentation

- [shape-porter-workflow.md](/d:/github/du-tobi/rs_emulator/planning/shape-porter-workflow.md) now documents the workflow that was actually used.
- The file records what became reusable, what remained manual, why the process became so time-consuming, and which automation gap is now more important than continuing with more one-off family integrations.
- That means the repository now captures not just the code state, but also the process lesson learned from the last sessions.

## Files Touched In The Latest Iteration

- [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua)
- [SimpleSignS-svg.lua](/d:/github/du-tobi/rs_emulator/examples/SilverZero/SimpleSignS-svg.lua)
- [luaRuntime.test.ts](/d:/github/du-tobi/rs_emulator/test/luaRuntime.test.ts)
- [findings.md](/d:/github/du-tobi/rs_emulator/planning/findings.md)
- [progress.md](/d:/github/du-tobi/rs_emulator/planning/progress.md)
- [shape-porter-workflow.md](/d:/github/du-tobi/rs_emulator/planning/shape-porter-workflow.md)

## Current Verification

State after the latest code change:

| Check | Result |
|-------|--------|
| `npm test -- luaRuntime.test.ts` | 81/81 tests passed |
| `npm test` | 134/134 tests passed |
| `npm run build` | succeeded |

## Open Follow-Ups

- The role hint `ornament` is still open.
- In `master-artboard`, everything beyond the 23 `polygon_ring` markers and the three four-point cases still remains on raw-path fallback.
- Additional primitives and roles beyond `hex_ring`, `polygon_ring`, four-point fill shapes, `closed_polygon` fills, and the first `compound_path` line path are still not fully connected to the render/porting path.
