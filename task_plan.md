# Task Plan

## Goal
Implement a transparent, ordered list of Lua module search paths in `rs_emulator`, replacing the current single DU include folder UX.

## Phases
- [completed] Inspect current settings, storage, resolver, and sidebar wiring
- [completed] Introduce persistent search-path data model and handle storage
- [completed] Implement modal dialog UI with add/remove/reorder behavior
- [completed] Update resolver flow to honor the ordered list
- [completed] Update README and verify with tests

## Notes
- Keep existing module resolution working for project modules like `lib.*`
- Make `.env.local` defaults visible in the UI rather than implicit
