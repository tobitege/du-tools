# Playtime Notes

## Basics

- `Escape` toggles between player view and the game options page.
- The bottom HUD shows the currently configured tools for keys `1` through `9`.
- Player view has first-person camera control; the real interaction point is the screen center crosshair.
- `Tab` toggles UI mode. In UI mode the mouse is free for HUD pages and the center crosshair is not the active interaction cue.
- If the center crosshair and contextual interact text are missing, assume UI mode until a visual check proves otherwise.
- Build mode is the third main mode on constructs: gravity-less movement inside the build box with a different `1..9` tool set.
- Avatar movement uses `W`, `A`, `S`, `D`.
- The game options `Controls` page can customize keybinds by mode.
- Use DU MCP bridge tools first; custom AHK and screenshots are support tools when needed.
- The current live scene is a freshly deployed factory with many interactable devices; names and links mostly exist, but configurations were not restored.
- Be careful moving around: the factory floor uses different voxel materials and may contain gaps.

## Current Findings

- Initial live check showed first-person in-world state with a visible crosshair.

## Industry

- Industry elements can appear configured from a link/layout point of view after blueprint deployment, while still having no restored machine configuration. Do not assume recipes or production settings survived the deploy.
- From the player view, useful top-level industry states include `ERROR`, `STOPPED`, `missing input`, `output full`, and `RUNNING`.
- `ERROR` means a serious issue on the server side and should be treated separately from normal production blocking states.
- `STOPPED` means the machine is not actively producing. For freshly deployed or otherwise inactive machines, counters such as remaining time or batches remaining may be dummy values and should not be trusted automatically.
- `missing input` means the machine is configured but blocked because required materials are not available.
- `output full` means the machine is configured but blocked because its output cannot be moved into linked storage.
- `RUNNING` means the machine is actively producing and progress counters are the most likely to be meaningful.
- Player-visible production modes are `Run`, `Move`, and `Maintain`.
- `Run` means endless production: keep running and move whatever can be moved.
- `Move` means produce only a specific amount of batches, if available.
- `Maintain` means keep output at a target liters-volume or item-count threshold.
