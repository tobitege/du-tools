# Task Plan: Restore Lua Painter Floating Panel Position Persistence

## Goal
Make the Lua painter "Properties" and "Layers" floating panel positions persist reliably again by verifying the current analysis, tracing the real persistence path, and wiring the positions through the DU mod/probe bridge if that path is missing or broken.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Identify existing preference sync patterns in probe/mod
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Update HUD editor JS persistence path
- [x] Update probe/mod bridge if needed
- [x] Rebuild generated payload assets as required
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Verify panel position restore logic
- [x] Verify bridge sync path and payload build output
- [x] Document test results in progress.md
- **Status:** complete

### Phase 5: Delivery
- [x] Review modified files
- [x] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** in_progress

## Key Questions
1. Is the outside-the-browser persistence path for HUD editor panel positions actually implemented anywhere today?
2. If not, what existing probe/mod preference sync mechanism should these positions reuse?
3. Are there additional restore/save bugs in the panel JS that need to be fixed even after bridge sync is added?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use the existing repo persistence stack if available instead of inventing a new one | Keeps behavior aligned with the current mod/probe architecture |
| Store panel positions in runtime module state as normalized numeric `leftPx`/`topPx` values | Avoids the old `0px` falsy bug and routes persistence through the mod-owned JSON state |
| Keep localStorage as a compatibility fallback and migration source | Preserves web harness behavior and migrates existing saved panel positions into runtime state in-game |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- Existing worktree is already dirty; preserve unrelated user changes.
- Relevant areas so far: HUD editor JS bundle, Lua probe modules, ModUiExtractor C# bridge.
- Repo-side verification is complete; live in-game validation still needs an actual DU session.
