# Progress

- Analyse gestartet: `live_board`, `DuMcpBridge`, `ModUiExtractor` und `D:\github\yfs-tools\lua`
- Persistenzkette identifiziert: Restore wirkt korrekt, verdächtig ist der Laufzeitpfad `setOutput` -> `getScriptOutput` -> Validierung -> `databank`
- Chat-basierte Diagnostik in `live_board/unit-onStart.lua` und `live_board/unit-onTimer-UPD.lua` eingebaut, um Send/Receive/Persist/Restore im Lua-Chat sichtbar zu machen
- Eingebetteten `SCREEN_LAYOUT_EDITOR_SOURCE` wieder unter die 50000-Zeichen-Grenze gebracht (`49742` Zeichen) durch Kürzen der Diagnostik und Entfernen redundanter `movable/resizable = true`-Flags im Default-Dokument
- Live-Vergleich gemacht: `unit-onTimer-UPD.lua` im Repo und die aktive IDE-Sync-`snippet.lua` unterschieden sich deutlich; der Live-Stand war älter als das Repo.
- Kompakte Serialisierung für Dokument und Output-Envelope in `ScreenLayoutEditor.lua` und im eingebetteten `SCREEN_LAYOUT_EDITOR_SOURCE` umgesetzt.
- Lokale Verifikation: Envelope von `4409` auf `3196` Bytes reduziert, Roundtrip mit Lua-5.1-`load`-Shim erfolgreich, `buildPersistenceRecordFromOutput(..., 50000)` liefert wieder `fits=true`.
- Live-Push für `unit/onTimer(UPD)` erfolgreich durchgeführt und per diff gegen `snippet.lua` bestätigt.
- Nach Nutzerrückmeldung "`editor sichtbar, nichts ausgewählt`" den sichtbaren `lua_editor` sauber auf `unit/onStart()` gesetzt, `live_board/unit-onStart.lua` gepusht und gespeichert.
- Nachkontrolle: `snippet.lua` entspricht jetzt `live_board/unit-onStart.lua`; `snippet.sync.json` ist dagegen noch ein altes Export-Metadatum und für diesen Push nicht aussagekräftig.
- Nach dem nächsten Live-Befund (`op` im HUD, Parse-Warnung `expected near ':'` im Chat) Ursache weiter präzisiert: `setOutput(...)` akzeptiert den großen Persistenz-Output offenbar nur als JSON-kompatiblen Payload.
- Daraufhin Screen-Envelope auf JSON umgestellt, JSON-Support für die Board-Seite außerhalb des eingebetteten Screen-Sources installiert und `unit/onTimer-UPD.lua` so angepasst, dass reine Probe-JSONs nicht mehr als Persistenzfehler gewarnt werden.
- JSON-Variante erneut live in `unit/onStart()` und `unit/onTimer(UPD)` gepusht und gespeichert.
