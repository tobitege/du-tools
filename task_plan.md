# Task Plan: Split 030 Theme Module By Concern

## Goal
Split the legacy combined theme/editor module into new `023-*` and higher concern-based modules using copy-first, removal-only edits, then retire the old module path once the replacements are complete.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define target module boundaries
- [x] Confirm whether `030-*` contains any industry theming
- [x] Document migration order and manifest implications
- **Status:** complete

### Phase 3: Copy-First Implementation
- [x] Create literal copies of `030-*` into new `023-*` and higher files
- [x] Remove unrelated functions from each copied file
- [x] Keep `030-*` intact until the new files are complete
- **Status:** complete

### Phase 4: Final Extraction
- [x] Remove migrated functions from `030-*`
- [x] Update `manifest.txt` load order
- [x] Rebuild the lua probe bundle
- **Status:** complete

### Phase 5: Verification & Delivery
- [x] Verify call order assumptions
- [x] Check final git diff and generated outputs
- [ ] Deliver summary to user
- **Status:** in_progress

## Key Questions
1. Which functions belong in theme core vs theme UI vs editor vs inventory?
2. Does `030-*` contain any industry-theming code that should be split now?
3. What manifest order keeps all cross-file dependencies valid after the split?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use copy-first file creation from `030-*` | User explicitly wants literal copies before any pruning |
| Use removal-only edits on copied files | Reduces risk of accidental behavioral drift during extraction |
| Skip industry split unless code is present in `030-*` | Current discovery found no industry-specific theming functions in this file |
| Keep `030-*` as a comment-only placeholder for now | Avoids an empty module file while preserving a stable legacy path during the split |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| PowerShell `$Matches` variable collision during dependency generation | 1 | Regenerated the catalogue using `$fnMatches` instead |

## Notes
- Do not remove functions from `030-*` until the new split files are complete.
- Prefer exact copied text over inferred rewrites during extraction.
