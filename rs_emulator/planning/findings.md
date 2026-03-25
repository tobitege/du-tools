# Findings and Decisions

## Requirements

- The two already-identified end products should be properly defined before further implementation work continues.
- The results should live in `rs_emulator/planning`.
- The material should support later architecture and implementation decisions.
- The planning should be grounded in the real SVG patch work from this repository, not in abstract assumptions.

## Research Findings

- [svg-work-patches.md](/d:/github/du-tobi/rs_emulator/svg-work-patches.md) already implies several recurring shape types:
  - logo outer segments as quads
  - right and left edge decals as quads
  - the lower middle frame segment as a quad
  - the inner logo hex ring as a dedicated render shape
- [SvgParser.lua](/d:/github/du-tobi/rs_emulator/lib/SvgParser.lua) currently provides mostly `d`, `fill`, `transform`, and some SVG context, but no richer shape semantics.
- [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua#L596) still renders SVG paths primarily as line segments via `addLine(...)`; generic path fills are not yet a first-class part of the transfer path.
- [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua#L990) to [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua#L1123) already contains several shape-oriented primitives such as `hexagon`, `hexRing`, `notchedHex`, and `circularSegments`.
- That means the library already has a first shape vocabulary, but it was not originally connected to an SVG classification or porting workflow.
- The first classifier iteration can derive stable geometric structure from `path d` data:
  - detect multiple subpaths
  - distinguish explicit and implicit closure
  - approximate transformed polygon point lists
  - determine bounds and the primary subpath
  - classify `outline_path`, `closed_polygon`, `triangle`, `quad`, `trapezoid`, and `compound_path`
- The board decal `m2330 1473 29 34v-38l-29-34v38` from `SimpleSignS_html.lua` is recognized as a `quad` with the expected four points after applying the SVG transform. That confirmed the analysis works on real inputs, not just synthetic tests.
- Many small SVG fill shapes rely on implicit closure without an explicit `z`. The classifier has to detect that, or real decals fall back incorrectly to `outline_path`.
- The exported `SimpleSignS` preview revealed a recurring real geometry class: two closed nested subpaths with a shared center.
  - in the small preview SVG, three former `compound_path` cases belong to this family
  - in `master-artboard`, 23 small marker rings with bounds `17.2 x 17.2` also belonged to it
- These shapes can be recognized purely from geometry through nesting, center alignment, and inner contour structure, without example-specific semantic logic.
- Within that ring family, `SimpleSignS` contains a real sub-group:
  - the three larger ring shapes in the upper SVG behave like nested hexagons and can be refined to `hex_ring`
  - the 23 small `master-artboard` markers remain intentionally generic `polygon_ring` because their approximated curves are round (`24+24` points), not hexagonal
- After grouping was introduced, the preview showed additional repeated families:
  - the 23 `master-artboard` marker rings form a shared `polygon_ring` cluster
  - the four open edge fragments in `SVG 3` form a shared `outline_path` cluster
  - the four small edge quads in `SVG 3` form a shared `quad` cluster
  - the upper and lower double-strip shapes in `SVG 3` appear as related `compound_path` pairs
- Two remaining large `compound_path` cases also behaved consistently:
  - `SVG 1 #10` covers almost the full small sign viewBox and consists of exactly two real or effectively closed contours
  - `SVG 3 #20` shows the same pattern for the large frame of the wide sign
- Those two real cases can be marked geometrically as `frame_outline` without adding semantic special cases in the example script.
- The review pass showed that “effectively closed” matters here:
  - real frame contours in `SimpleSignS` are not always formally closed with `z`
  - `frame_outline` can still be recognized if the start and end points are very close
  - large open line bundles must still be excluded
- The next large remainder consisted of many small highlight fragments near outer edges:
  - in `SVG 3`, this affected fragments `#02` through `#19` across several primitive classes (`trapezoid`, `compound_path`, `quad`, `outline_path`)
  - in `SVG 1`, fragment `#07` remained as a narrow edge-adjacent `outline_path`
- These shapes share the same robust geometry: narrow bounds, low area coverage, clear edge proximity, and highlight fill. That was enough for a first `edge_decal` role hint.
- After `frame_outline` and `edge_decal`, one large centered inner area remained in the wide sign without a role:
  - `SVG 3 #01` is a `closed_polygon` with 32 points and bounds `230.267 x 154.604` inside a `231 x 156` viewBox
  - it is larger than the edge decals, but not a double contour like `frame_outline`
- That geometry was a good first `frame_cap` case.
- The review pass tightened that rule:
  - `frame_cap` is no longer inferred from size and centering alone
  - the shape now also requires an enclosing `frame_outline` in the same SVG context
  - that avoids over-classifying generic backdrops or isolated large polygons as frame fills
- A second review finding affected `groupHints`:
  - pure geometry fingerprints are not always enough for later porting decisions
  - roles such as `frame_cap` and future roles also need to affect clustering
  - otherwise semantically different fragments can end up in the same cluster
- After `frame_outline`, `frame_cap`, and `edge_decal`, a clear remainder family was left in small `SVG 1`:
  - the four large corner polygons `#01`, `#02`, `#05`, and `#06`
  - all four live inside the same `frame_outline`
  - all four have very similar bounds
  - their centers mirror each other across both axes around the frame midpoint
- The important observation for that family:
  - fill is not the defining feature
  - the real `SimpleSignS` family mixes primary-color and highlight fills
  - a fill-based exclusion would lose valid logo segments
- That led to two separate frame-context helpers:
  - `findCenteredFrameOutline(...)` for centered inner areas such as `frame_cap`
  - `findEnclosingFrameOutline(...)` for enclosed but intentionally off-center fragments such as `logo_segment`
- From that came a durable new role hint:
  - `logo_segment` for `closed_polygon` fragments that form a complete four-quadrant mirrored family inside the same `frame_outline`
  - in the current `SimpleSignS`, this applies to the four corner fragments of the small logo
  - the central `hex_ring` forms and the side bar remain intentionally outside this role
- For the next production `master-artboard` step, a narrow porter filter was safer than another broad classifier-first rollout:
  - the 23 marker rings could be reconnected through `polygon_ring`
  - a generic kind filter in the porter was enough; classifier heuristics did not need to change
  - other `master-artboard` families can now be enabled later one by one without repeating the same large regression risk
- The next small `master-artboard` expansion could be done in the same way without touching the classifier:
  - besides `polygon_ring`, there are only three additional well-understood four-point cases there (`1` `quad`, `2` `trapezoid`)
  - those can be routed safely through the existing four-point adapter via the same kind filter
  - the large remaining `closed_polygon` block can therefore stay isolated instead of being enabled too early as one large batch

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Treat the classifier and shape library as separate but coupled architecture topics | The classifier produces shape knowledge; the library consumes it |
| Focus the first iteration on geometric classification | That is much more realistic and stable than trying to jump directly to full semantic automation |
| Treat the existing workarounds as evidence for needed shape classes | The current scripts already show which shape families matter in practice |
| Use `SilverZeroRsLib.lua` as the likely home for the first shape-level building blocks | The library already contains matching geometry helpers and layout conventions |
| Keep the first production API analytical (`analyzePath`, `classifyItem`, `classifyItems`, `classify`) | That creates reusable shape logic immediately without forcing new example-specific logic into the scripts |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `planning-with-files` is designed around root-level files by default | The planning files were intentionally kept under `rs_emulator/planning`, per the user request |
| The current codebase contained workarounds but no explicit shape system | The planning papers and subsequent implementation work address that gap directly |

## Resources

- [svg-work-patches.md](/d:/github/du-tobi/rs_emulator/svg-work-patches.md)
- [SimpleSignS-svg.lua](/d:/github/du-tobi/rs_emulator/examples/SilverZero/SimpleSignS-svg.lua)
- [SimpleSignS_html.lua](/d:/github/du-tobi/rs_emulator/examples/SilverZero/SimpleSignS_html.lua)
- [SvgParser.lua](/d:/github/du-tobi/rs_emulator/lib/SvgParser.lua)
- [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua)
- [convert-ideas.md](/d:/github/du-tobi/rs_emulator/examples/SilverZero/convert-ideas.md)

## Visual Findings

- The session repeatedly showed that small filled SVG shapes fail visually when transferred only as outline paths.
- Quads and dedicated shape helpers were stable and visually correct for the same regions.
- The inner hex ring was the first successful case where one visually coherent SVG form was deliberately converted into a dedicated geometry function.
- The updated shape preview made it obvious that several real `compound_path` cases were actually ring shapes and became much easier to read once shown as `polygon_ring`.
- After the second refinement, the preview clearly separated true `hex_ring` cases in the upper sign SVG from the round `polygon_ring` markers in the artboard.
- The summary now also shows `groupHints`, making repeated families visible without manual string searches.
- A later refinement made the large sign frames explicit as well: `SVG 1 #10` and `SVG 3 #20` now appear as `role=frame_outline`.
- The current preview also marks the edge-adjacent highlight fragments in the wide sign and the narrow side strip in `SVG 1` as `role=edge_decal`.
- The preview now separates three layers in the wide sign cleanly:
  - `frame_outline` for the outer frame
  - `frame_cap` for the large inner area
  - `edge_decal` for the smaller edge fragments
- After the review hardening, those layers are also safer internally: `frame_outline` requires real or effectively closed contours, `frame_cap` requires frame context, and `groupHints` respect the assigned role.
- The summary now also marks the four large corner fragments in `SVG 1` as `role=logo_segment`.
- That rule does not spill onto the central `hex_ring` shapes or the one-sided side bar, so the remainder is both smaller and more clearly bounded.
- The current `master-artboard` state now uses the same porter path as the board and logo, but only for selected families:
  - the 23 marker rings go through `drawClassifiedPathItem(...)` with a generic kind filter for `polygon_ring`
  - the remaining `master-artboard` paths initially stayed on the known raw-path fallback
- The next small `master-artboard` expansion used the same pattern:
  - besides `polygon_ring`, there are only three additional well-understood four-point cases there (`1` `quad`, `2` `trapezoid`)
  - those can be routed safely through the same kind filter into the existing four-point adapter
  - the large `closed_polygon` remainder therefore stays separate and does not need to be enabled prematurely as a full batch
