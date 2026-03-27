# Progress

- Analyse gestartet: `live_board`, `DuMcpBridge`, `ModUiExtractor` und `D:\github\yfs-tools\lua`
- Persistenzkette identifiziert: Restore wirkt korrekt, verdächtig ist der Laufzeitpfad `setOutput` -> `getScriptOutput` -> Validierung -> `databank`
- Chat-basierte Diagnostik in `live_board/unit-onStart.lua` und `live_board/unit-onTimer-UPD.lua` eingebaut, um Send/Receive/Persist/Restore im Lua-Chat sichtbar zu machen
- Eingebetteten `SCREEN_LAYOUT_EDITOR_SOURCE` wieder unter die 50000-Zeichen-Grenze gebracht (`49742` Zeichen) durch Kürzen der Diagnostik und Entfernen redundanter `movable/resizable = true`-Flags im Default-Dokument
