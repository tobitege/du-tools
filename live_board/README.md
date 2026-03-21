# live_board

Tracked snapshots of live board Lua code captured from the game.

This folder is the fixed tracked repository location for reusable board artifacts. Do not store those files in untracked or temporary locations.

Current files:

- `unit-onStart.lua`: exact live snapshot of the board `unit.onStart` script.
- `unit-onTimer-UPD.lua`: exact live snapshot of the board `unit.onTimer("UPD")` script.

If a newer live snapshot supersedes these files, replace the files in this folder so the reusable reference stays tracked in git.
