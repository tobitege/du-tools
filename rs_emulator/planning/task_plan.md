# Task Plan: SVG Shape Planning

## Goal

Define the two missing end products for the SVG porting workflow in `rs_emulator`:

- an SVG fragment classification module
- a Lua shape library

The planning work should describe the target architecture, data model, phases, risks, and practical entry points for implementation.

## Current Phase

Planning is complete. Ongoing implementation follow-up is tracked in [progress.md](rs_emulator/planning/progress.md).

## Phases

### Phase 1: Requirements and Discovery

- [x] Capture the user goal for the two end products
- [x] Review the existing SVG work patches
- [x] Record the current technical limits in the parser and render library
- **Status:** complete

### Phase 2: Planning Workspace

- [x] Create the dedicated `rs_emulator/planning` directory
- [x] Add file-based planning documents in that directory
- [x] Link the baseline material and follow-up documents
- **Status:** complete

### Phase 3: Classifier Planning

- [x] Describe the target shape of a future `SvgShapeClassifier`
- [x] Define classification stages and output format
- [x] Record risks and an introduction strategy
- **Status:** complete

### Phase 4: Shape Library Planning

- [x] Describe the target shape of a Lua shape library
- [x] Define shape categories and candidate APIs
- [x] Outline a migration strategy away from ad-hoc patches
- **Status:** complete

### Phase 5: Delivery

- [x] Summarize the results in planning documents
- [x] Identify the next sensible implementation steps
- [x] Align with the user on which track to implement first
- **Status:** complete

## Key Questions

1. Which fragment types can be recognized robustly from geometry alone, without overpromising semantic understanding?
2. What should the shared shape data model look like so classifier output and Lua rendering use the same vocabulary?
3. Which existing workarounds can eventually be removed entirely once the classifier and shape library are in place?

## Open Implementation Items After The First Iteration

- [x] Implement `polygon_ring`
- [x] Implement `hex_ring`
- [x] Implement `frame_outline` as the first role hint
- [x] Implement `edge_decal` as the second role hint
- [x] Implement `frame_cap` as the third role hint
- [x] Apply review fixes for `frame_outline`, `frame_cap`, and role-aware `groupHints`
- [x] Implement `logo_segment` as another role hint
- [ ] Implement the remaining role hint `ornament`
- [x] Implement grouping for repeated fragments via `groupHints`
- [ ] Connect classifier output to the full render/porting path

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Planning files live in `rs_emulator/planning` instead of the repo root | This matches the user request and keeps the architecture work separate from general project material |
| The two topics are documented separately | The classifier and shape library are tightly related, but they are still distinct implementation tracks |
| `svg-work-patches.md` is the baseline source | That file already captures the real shape types and root causes discovered in practice |
| The first production track starts with `SvgShapeClassifier` | The user explicitly prioritized the geometry-first path for the first implementation round |

## Notes

- Primary baseline file: [svg-work-patches.md](rs_emulator/svg-work-patches.md)
- Planning papers: [svg-classifier-plan.md](rs_emulator/planning/svg-classifier-plan.md) and [svg-shape-library-plan.md](rs_emulator/planning/svg-shape-library-plan.md)
