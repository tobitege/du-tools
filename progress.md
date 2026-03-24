# Progress

- Started refactor for transparent Lua module search paths UI and resolver behavior.
- Identified current single-root implementation in `App.tsx`, `Sidebar.tsx`, `sidebarConfig.ts`, and `sessionStore.ts`.
- Confirmed server/plugin already parses multiple `.env.local` roots, but the UI does not expose them clearly yet.
- Replaced the single-folder settings UI with a modal editor for an ordered list of module search paths.
- Added persisted local-folder handles per search-path entry and one-time migration from the legacy single DU root handle.
- Updated resolver flow so project root, `.env.local` defaults, and local browser folders can be searched in explicit user-defined order.
- Verified with `npm test -- luaRuntime.test.ts vite.config.test.ts`, `npm run build`, and `lua module-require-smoke.lua`.
