# Findings

- `rs_emulator` currently exposes only one browser-picked DU Lua folder in the UI.
- Server-side `.env.local` roots already support multiple semicolon-separated entries via `DU_LUA_ROOT`.
- Browser-side resolution currently uses one persisted `FileSystemDirectoryHandle` and one display name in settings.
- Project-root modules like `lib.*` are resolved through the server/plugin, not through a visible search-path list.
- A transparent solution works best when project root, `.env.local` defaults, and user-picked local folders are all represented as ordered entries in one visible list.
- The resolver had to gain explicit scoped lookups (`relative`, `project`, `du`) so the visible order and the actual resolution order stay aligned.
