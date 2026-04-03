# Task Plan

## Goal

Den HUD Editor / Lua Painter so erweitern, dass das geladene Layout als echtes DU-RenderScript fuer verlinkte Screens erzeugt wird, lokal verifiziert wird und bei passender Live-Session ueber den dokumentierten Programming-Board-Workflow geprueft werden kann.

## Phases

- [completed] Pflichtdokumente und Live-Workflow fuer `live_lua_coding`, `DuMcpBridge`, `ModUiExtractor` und `Renderscript.md` lesen
- [completed] HUD-Editor-Dateien fuer Board, Screen, Export und Load/Save-Fluss inspizieren
- [completed] Gemeinsame RenderScript-Erzeugung fuer geladene Layouts in den getrackten HUD-Editor-Quellen umsetzen
- [completed] Web-Build und Browser-Verifikation fuer den Exportpfad ausfuehren
- [completed] Live-Session, Watcher- und UI-Zustand per dokumentiertem MCP-Workflow pruefen
- [completed] Toolbar fuer Primitive auf ein auto-schliessendes `Shapes`-Dropdown verdichten und die Browser-Regressionen dafuer absichern
- [completed] Getrackten Snippet-Plan fuer `shapes.lua` plus Screenshot-Demo anlegen, damit Web-Harness und spaetere Lua-Erzeugung dieselbe Taxonomie nutzen
- [completed] Live-HUD-Validierung fuer das neue `Shapes`-Dropdown im echten DU-Lua-Editor durchfuehren
- [completed] Ersten echten Snippet-Katalog im HUD-Editor-Code verankern und lokal wie live pruefen
- [completed] Gemeinsame Screen-Draw-Command-Schicht fuer Web-Export und Lua-Runtime einfuehren und lokal wie live auf die neue `doc.c`-Struktur pruefen
- [completed] Live-Board-/Screen-Verhalten eingrenzen und die echte Board->Screen-Aktivierung fuer den HUD-Editor erfolgreich bis zum sichtbaren Screen-Ergebnis pruefen
- [completed] Vollstaendige E2E-Testanleitung fuer `hud_editor_v1` dokumentieren
- [completed] Gemeinsamen Probe-/Runtime-Modul-Hook einfuehren, damit Runtime-Plugins ihre UI ueber MCP schliessen koennen
- [completed] `shapes.lua` als editierbares HUD-Editor-Dokument mit fehlenden DU-Primitiven (`bezierArc`, `triangle`, `quad`, `image`) sowie `rotation`/`shadow`-Feldern umsetzen und lokal wie live pruefen

## Notes

- Das aktuelle Board-Publishing in `HudEditorBoard.lua` setzt zwar `setRenderScript(...)`, erzeugt aber nur einen Wrapper mit Referenz auf `HudEditorBoard`, den der Screen nicht kennt.
- Das bisherige `Export Screen` in `085-ide-export.js` baut ebenfalls kein valides DU-RenderScript auf: es benutzt `function onDraw(layer)` und Form-APIs mit falscher Signatur statt der dokumentierten RenderScript-Aufrufe.
- Fuer korrekte DU-Ausgabe brauchen wir top-level RenderScript mit `createLayer()`, `setNext*`-Aufrufen und Element-Reihenfolge, die nicht von der impliziten Shape-Sortierung kaputtgemacht wird.
- Live-Stand dieses Durchlaufs:
  - `library/onStart()` wurde sichtbar mit dem aktualisierten `HudEditorBoard.lua` befuellt und gespeichert.
  - `unit/onStart()` liess sich wegen stale IDE-Sync-Metadaten nicht sauber mit der getrackten Datei ueberschreiben; das Routing-Problem wurde auf `snippet.sync.json` eingegrenzt.
  - Das sichtbare `unit/onStart()` liess sich dennoch speichern, um die Board-Initialisierung neu anzustossen.
  - Der verlinkte Screen blieb danach visuell schwarz; der verbleibende Fehler liegt also nicht mehr im fehlenden lokalen Generator allein.
- Der aktuelle UI-/Planungsschritt aendert nur Toolbar-, Test- und Doku-Quellen im HUD-Editor. Deshalb war lokale Browser-Verifikation passend; eine neue DU-Live-Mutation wurde in diesem Schritt bewusst nicht erzwungen.
- Fuer Runtime-Modul-Codeaenderungen im HUD Editor gilt praktisch: Nach `publish.ps1` kann ein `du_reinject_lua_probe` noetig sein, bevor der Lua-Editor den neuen Runtime-Modulstand wirklich sieht.
- Neuer Stand fuer den Screen-Export:
  - Web und Lua verwenden jetzt beide eine normalisierte `doc.c`-Befehlsliste statt direkt ueber rohe Elementtypen zu serialisieren.
  - Die aktuelle Befehlsmenge deckt `shape`, `line` und `text` ab; das ist die gemeinsame Basis fuer spaetere `renderOnly`-Snippets und DOM-Paritaet.
- Neuer Stand fuer die Runtime-Plugin-Recovery:
  - Der Lua-Probe-MCP-Pfad unterstuetzt jetzt `close_runtime_ui` fuer `lua_editor`.
  - Runtime-Module koennen dafuer optional `closeUi(reason)` exponieren; der HUD-Editor implementiert diesen Hook jetzt ueber sein Runtime-Modul.
  - Die eigentliche Live-Verifikation dieses neuen Recovery-Hooks ist in diesem Durchlauf noch offen, weil der DU-Client beim Validierungsversuch nur den Account-Login-Screen zeigte.
- Neuer Stand fuer den `shapes.lua`-Umbau:
  - Der HUD-Editor unterstuetzt jetzt echte editierbare Dokumenttypen fuer `bezierArc`, `triangle`, `quad` und `image` sowie gemeinsame `rotation`- und `shadow`-/Glow-Felder.
  - Der Snippet-Katalog enthaelt jetzt `demo_shapes_lua_full`, das den DU-`renderScript/shapes.lua`-Aufbau mit 63 editierbaren Elementen materialisiert.
  - Lokal sind Build + Browser-Harness dafuer gruen.
  - Live liess sich das Demo-Dokument im echten HUD Editor laden, als `unit/onStart()` speichern und im sichtbaren Buffer bestaetigen.
  - Nach Push des neuen `library/onStart()`-`HudEditorBoard.lua` und echtem Board-Off/On kamen frische Lua-Chatzeilen fuer den groesseren Publish (`sc=5820`, `ic=9019`), aber der sichtbare verlinkte Screen blieb schwarz. Der verbleibende Fehler liegt damit im Live-Screen-Runtime-Verhalten, nicht mehr in der fehlenden editierbaren Layout-Darstellung.
