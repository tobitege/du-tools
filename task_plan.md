# Task Plan

## Goal

Den HUD Editor / Lua Painter so erweitern, dass das geladene Layout als echtes DU-RenderScript fuer verlinkte Screens erzeugt wird, lokal verifiziert wird und bei passender Live-Session ueber den dokumentierten Programming-Board-Workflow geprueft werden kann.

## Phases

- [completed] Pflichtdokumente und Live-Workflow fuer `live_lua_coding`, `DuMcpBridge`, `ModUiExtractor` und `Renderscript.md` lesen
- [completed] HUD-Editor-Dateien fuer Board, Screen, Export und Load/Save-Fluss inspizieren
- [completed] Gemeinsame RenderScript-Erzeugung fuer geladene Layouts in den getrackten HUD-Editor-Quellen umsetzen
- [completed] Web-Build und Browser-Verifikation fuer den Exportpfad ausfuehren
- [completed] Live-Session, Watcher- und UI-Zustand per dokumentiertem MCP-Workflow pruefen
- [in_progress] Live-Board-/Screen-Verhalten weiter eingrenzen; Quellcode ist live gepusht, aber der verlinkte Screen bleibt im aktuellen Setup noch schwarz

## Notes

- Das aktuelle Board-Publishing in `HudEditorBoard.lua` setzt zwar `setRenderScript(...)`, erzeugt aber nur einen Wrapper mit Referenz auf `HudEditorBoard`, den der Screen nicht kennt.
- Das bisherige `Export Screen` in `085-ide-export.js` baut ebenfalls kein valides DU-RenderScript auf: es benutzt `function onDraw(layer)` und Form-APIs mit falscher Signatur statt der dokumentierten RenderScript-Aufrufe.
- Fuer korrekte DU-Ausgabe brauchen wir top-level RenderScript mit `createLayer()`, `setNext*`-Aufrufen und Element-Reihenfolge, die nicht von der impliziten Shape-Sortierung kaputtgemacht wird.
- Live-Stand dieses Durchlaufs:
  - `library/onStart()` wurde sichtbar mit dem aktualisierten `HudEditorBoard.lua` befuellt und gespeichert.
  - `unit/onStart()` liess sich wegen stale IDE-Sync-Metadaten nicht sauber mit der getrackten Datei ueberschreiben; das Routing-Problem wurde auf `snippet.sync.json` eingegrenzt.
  - Das sichtbare `unit/onStart()` liess sich dennoch speichern, um die Board-Initialisierung neu anzustossen.
  - Der verlinkte Screen blieb danach visuell schwarz; der verbleibende Fehler liegt also nicht mehr im fehlenden lokalen Generator allein.
