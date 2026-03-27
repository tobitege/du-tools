# Findings

- `live_board/unit-onStart.lua` restauriert Persistenz ausschließlich aus der `databank` unter `screen_layout_editor:document` und übergibt den restaurierten Dokumenttext via `SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT` an das Screen-Render-Script.
- `live_board/unit-onTimer-UPD.lua` ist der einzige Persistenzschreiber: Es liest `Screen.getScriptOutput()`, validiert den Envelope mit `buildPersistenceRecordFromOutput(...)` und schreibt erst dann in die `databank`.
- Das Screen-Render-Script schreibt nicht selbst in die `databank`. Es emittiert nur einen Envelope über `setOutput(envelope)`.
- Damit ist die tatsächliche Persistenzkette: `RenderScript commit` -> `setOutput(envelope)` -> Board `onTimer("UPD")` -> `Screen.getScriptOutput()` -> `databank.setStringValue(...)` -> nächstes `onStart` liest aus `databank`.
- Die Restore-Seite wirkt im Code konsistent. Wenn nach Neustart immer das Default-Layout erscheint, ist wahrscheinlicher, dass der Screen-Output nie ankommt oder vom Board beim Validieren verworfen wird.
- Besonders verdächtig: `pcall(setOutput, envelope)` im Render-Script schluckt einen Fehler still; bei Fehlschlag gibt es dort kein Logging.
- Ebenfalls verdächtig, aber schwächer: `buildPersistenceRecordFromOutput(...)` kann `parseError` oder `output_mismatch` liefern; diese Fälle würden Persistenz verhindern und nur als `system.print`-Warnung erscheinen.
- `D:\github\yfs-tools\lua` enthält nützliche Referenzmuster für Board->Screen (`setRenderScript`, `system.setScreen`) und `databank`-Initialisierung, aber kein vergleichbares Screen->Board-Persistenzmuster mit `getScriptOutput()/setOutput()`.
