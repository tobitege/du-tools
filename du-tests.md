# DuMcpBridge & Lua-Probe — API-Testvorlage

Schritt-für-Schritt-Reihenfolge zum manuellen oder agentischen Testen der MCP-Tools. Die Bridge bleibt **Transport**; echtes Verhalten kommt aus **ModUiExtractor** + **injizierter Lua-Probe**.

---

## Bootstrap-Prompt (Kurz für einen Folge-Assistenten)

Für eine **neue** Agent-Sitzung ohne Zugriff auf frühere Tool-Ausgaben: den folgenden Block kopieren und vor dem ersten MCP-Schritt einfügen (diese Datei `du-tests.md` im Repo als Autoritätsquelle für Schritte und Erwartungen).

```text
Du arbeitest im Repo du-tobi an DuMcpBridge + ModUiExtractor (Lua-Editor-Probe). Orientierung: Datei du-tests.md (API-Testvorlage).

MCP-Server: DuMcpBridge (z. B. user-DuMcpBridge in Cursor). Vor jedem Testlauf playerId per du_list_active_sessions ermitteln; alle probe/relevanten Calls für dieselbe playerId sequentiell ausführen (keine parallelen MCP-Calls pro Session, wenn Race vermieden werden soll).

Empfohlener Kernpfad: du_ui_describe → optional du_ui_wait → du_ui_invoke(method = select_context) → du_editor_push_code → du_editor_save. Nach Slot-Wechsel nicht sofort mit alten Filter-Daten weiterarbeiten; der FILTERS-Bereich kann verzögert neu aufgebaut werden.

du_ui_invoke(method = add_filter): timeoutMs eher 10000–15000. Debug: du_ui_invoke(method = outer_html / raw_eval); generische Live-Pfade sind du_ui_describe, du_ui_invoke, du_ui_wait (uiKind: lua_editor).

Observability ohne direkten describe: du_get_last_result, du_tail_runtime_logs. du_editor_pull_code liefert Datei-/Rig-Workspace — kann vom Live-CodeMirror pro Filter abweichen; Live-Text eher describe / raw_eval.

du_editor_save kann bei lua_editor die gesamte Lua-Editor-Maske schließen — nur bewusst oder ganz am Ende nutzen.

Falls zusätzlich ein Windows-Screenshot-MCP wie `ScreenShotNet` verfügbar ist: Screenshots nur gezielt nutzen, um den sichtbaren DU-Client-Zustand zu prüfen, wenn Probe-Status und sichtbarer Zustand auseinanderlaufen könnten. Gute Zeitpunkte sind direkt vor nativen Inputs wie `Ctrl+L` / `du_open_editor_native` und direkt nach `apply`. Nicht bei jedem Schritt verwenden; Bild-Payload ist deutlich schwerer als normale Probe-Ergebnisse.

Probe/Build: ModUiExtractor/payload/lua-editor-probe.modules/035-lua-mcp-runtime.js, tools/build-lua-probe.ps1, tools/publish-lua-probe.ps1 (Repo → `payload-overrides`), Chat-Stempel lua-editor-probe.build.json. **Module-Override:** Server konkateniert Manifest + Module und wrappt mit derselben IIFE wie `build-lua-probe.ps1` (`ModUIExtractor.cs` — bei Änderung DLL neu bauen). Theming: drei Presets (Monokai / GitHub Dark / Gruvbox), APPLY/CANCEL an Themes gekoppelt — siehe `ModUiExtractor/README.md`.

Bei Timeouts/Fehlern: Probe-Override validieren, Editor im Client offen, bridge-events.ndjson (command_enqueued → command_result → probe_result) prüfen.
```

---

## 1. Prerequisites

### 1.1 Laufende Komponenten

| Komponente | Erwartung |
| ------------ | ----------- |
| **Dual Universe Server + Client** | Spieler eingeloggt, ggf. Lua-Editor-Kontext verfügbar |
| **Mod `ModUIExtractor`** | Aktuelle DLL im Mods-Ordner des Servers (siehe `ModUiExtractor/README.md` → Deploy) |
| **DuMcpBridge** | MCP-Server gestartet (z. B. `DuMcpBridge/run-mcp.cmd` oder Eintrag in Cursor/Codex) |
| **Umgebungsvariablen** | Optional: `DU_UI_DUMP_ROOT`, `DU_MCP_BRIDGE_ROOT` — sonst Default unter Server-`tmp\ui-dumps` (siehe `DuMcpBridge`-README) |

### 1.2 Pfade (anpassen)

Default aus der Doku (Beispiel):

- **Commands:** `D:\MyDUserver\tmp\ui-dumps\mcp-bridge\commands\`
- **Events:** `D:\MyDUserver\tmp\ui-dumps\mcp-bridge\events\bridge-events.ndjson`
- **Probe-Override (Module):** `D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.modules\` + `manifest.txt`
- **Build-Stamp (Chat-Zeile):** `lua-editor-probe.build.json` im Override-Root **oder** im Module-Ordner (siehe `ModUiExtractor/README.md`)

### 1.3 Lua-Probe / Board

1. Repo: `ModUiExtractor\tools\build-lua-probe.ps1` ausführen (Bundle + `lua-editor-probe.build.json`).
2. Optional: `tools\publish-lua-probe.ps1` oder manuell `035-lua-mcp-runtime.js` + ggf. gesamten Modulordner + `build.json` in den Override-Pfad kopieren.
3. **Im Spiel:** „Lua probe“ / injizieren; private Chat-Zeile sollte u. a. **`[probe <Zeitstempel> <kurzHash>]`** zeigen — damit ist die **gleiche** Version wie die gebaute `build.json` abgleichbar.
4. **Lua-Editor** öffnen (z. B. Control Unit → Edit Lua), passendes Board/Slot-Kontext.

### 1.4 `playerId`

- Aus **`du_list_active_sessions`** ermitteln (typisch z. B. `10000`), oder aus eurer Umgebung bekannt.
- Tests **sequentiell** für dieselbe `playerId` ausführen (keine parallelen MCP-Calls für dieselbe Session, wenn Race/Debug vermieden werden soll).

### 1.5 Timeouts

- Viele Tools: `timeoutMs` 250–15000 ms (MCP-Schema-Maximum).
- **`du_ui_invoke(method = add_filter)`:** eher **10000–15000** ms (Cohtml / `setTimeout` in der Probe).

---

## 2. Basis-Checks (Reihenfolge beibehalten)

### Schritt B0 — Sessions

- **Tool:** `du_list_active_sessions`  
- **Erwartung:** Mindestens eine Zeile `player=… sources=lua_editor` (oder eure Quelle), wenn der Lua-Editor-Pfad aktiv war.

### Schritt B1 — Editor sichtbar / Snapshot

- **Tool:** `du_ui_describe` (`uiKind: lua_editor`, `playerId`, `timeoutMs` z. B. 8000)
- **Erwartung:** JSON mit `visible`, `title`, `slots[]`, `filters[]`, `selectedSlot`, `selectedFilter`, `codeLength`.  
- **Bei Fehler / Timeout:** Override + erneut injizieren; Editor wirklich offen; `du_ui_wait` (optional).
- **Optional visuell:** Wenn ein Screenshot-MCP verfügbar ist, `capture_window_screenshot` für `Dual Universe` nur dann nutzen, wenn unklar ist, ob der sichtbare Client-Zustand wirklich zum Probe-Snapshot passt.

### Schritt B2 — Warten auf Editor (optional)

- **Tool:** `du_ui_wait` (`uiKind: lua_editor`, `maxWaitMs`, `timeoutMs`, `requireVisible` nach Bedarf)
- **Erwartung:** `ready: true` mit Snapshot, oder nach Budget `ready: false` (dann Logs / NDJSON prüfen).

---

## 3. Navigations- und Code-Pfad (empielene Reihenfolge)

### Schritt N1 — Slot + Filter wählen

- **Tool:** `du_ui_invoke` mit `uiKind: lua_editor`, `method: select_context`, `slotName`, `filterName`, optional `settleMs`
- **Erwartung:** `selectedSlot` und `selectedFilter` passen; der Toolpfad wartet nach dem Slot-Wechsel bereits auf das notwendige UI-Settling.

### Schritt N2 — Code setzen

- **Tool:** `du_editor_push_code` (`playerId`, `targetKind: lua_editor`, `sourcePath`)
- **Erwartung:** Import wurde staged; im Spielbuffer landet der Dateiinhalt nach dem IDE-Sync-Pfad.

### Schritt N3 — Erneut beschreiben

- **Tool:** `du_ui_describe`
- **Erwartung:** Konsistenz mit N1–N3.

---

## 4. Filter anlegen (`add_filter`)

- **Voraussetzung:** Richtiger Slot (N1); Handler-Name muss im **Kebab-Menü der neuen Zeile** existieren (slot-/geräteabhängig).
- **Tool:** `du_ui_invoke` mit `uiKind: lua_editor`, `method: add_filter`, `filterName`, ggf. `timeoutMs` 15000
- **Erwartung:** `added` und erweiterte `filters[]`; oder `alreadyPresent: true` bei Idempotenz.  
- **Hinweis:** Die Probe nutzt **`+ add filter`** (`.lua_add_filter_button`), nicht nur Kebab auf einer bereits befüllten Zeile zum „Neu-Anlegen“.

---

## 5. DOM / Debug

### Schritt D1 — `outer_html`

- **Tool:** `du_ui_invoke` mit `uiKind: lua_editor`, `method: outer_html`, `selector` z. B. `#filters` oder `.lua_add_filter_button`
- **Erwartung:** JSON mit `outerHTML`, `truncated`, `originalLength` — nur wenn die Probe `outer_html` enthält (aktueller Override/DLL).

### Schritt D2 — Low-Level Probe

- **Tool:** `du_ui_invoke` mit `method` + passenden methodenspezifischen Feldern (`filterName`, `selector`, `functionBody`, …)
- **Erwartung:** Direkter Zugriff auf den kanonischen Probe-Pfad.

### Schritt D3 — `raw_eval` (nur vertrauenswürdig)

- **Tool:** `du_ui_invoke` mit `uiKind: lua_editor`, `method: raw_eval`
- **`functionBody`:** Strict Body mit Parameter `state`, z. B.:
  `return state.describeLuaEditor();`  
- **Risiko:** Beliebiges JS im HUD — nicht mit fremden Strings aus dem Internet füttern.

---

## 6. Generische `du_ui_*`-Tools

Kanonischer Live-Pfad:

- `du_ui_describe`: generischer Snapshot
- `du_ui_invoke`: generischer Action-/Debug-Pfad
- `du_ui_wait`: generischer Readiness-Pfad

**Test:** `du_ui_invoke` mit `method: describe` und leeren weiteren Feldern — Ergebnis wie B1.

---

## 7. Bridge ohne direkten Probe-Call

### Schritt R1 — Letztes Event

- **Tool:** `du_get_last_result` (`playerId`, optional `targetKind`, `eventType`)  
- **Resource:** `du://session/{playerId}/last-result`  
- **Erwartung:** Letzter `probe_result` oder anderes Event; bei Debugging `commandId` mit NDJSON abgleichen.

### Schritt R2 — Runtime-Logs

- **Tool:** `du_tail_runtime_logs` (`playerId`, `limit`)

### Schritt R3 — Aktiver Code (Datei-Workspace)

- **Tool:** `du_editor_pull_code` (`playerId`, `targetKind: lua_editor`)  
- **Hinweis:** Kann **Rig/Snippet** aus dem Datei-Workspace zeigen, nicht zwingend den **gleichen** Stand wie der Live-CodeMirror pro Filter. Für pro-Filter-Live-Text eher `describe` / ggf. `raw_eval`.

---

## 8. Save / Apply (Vorsicht)

- **Tool:** `du_editor_save` (`playerId`, `targetKind: lua_editor`)
- **Hinweis:** Führt bei `lua_editor` in der Praxis oft denselben Save-/Apply-Pfad aus und schließt häufig die **gesamte** Lua-Editor-Maske; danach Probe-Schritte ggf. erst nach erneutem Öffnen.
- **Optional visuell:** Ein gezielter Screenshot direkt nach `apply` kann helfen zu unterscheiden, ob der sichtbare Screen stabil ist oder ob nur der Editor erfolgreich gespeichert wurde.

---

## 9. NDJSON-Gegenprobe (manuell)

1. Während der Tests `bridge-events.ndjson` tailen oder letzte Zeilen öffnen.
2. Zu jedem MCP-Call: `command_enqueued` → `command_result` → `probe_result` mit passender `commandId`/`method` erwarten.
3. Bei fehlendem `probe_result`: Mod-Logs; Command in `commands/` verarbeitet? Spiel-Client HUD aktiv?

---

## 10. Build-/Release-Checkliste (kurz)

- [ ] `DuMcpBridge`: `npm run build`
- [ ] `ModUiExtractor`: `dotnet build -c Release` (+ DLL deployen)
- [ ] `build-lua-probe.ps1`; Override + **build.json**; Inject; Chat-Zeile mit Hash verifizieren
- [ ] MCP-Client: Bridge neu starten / Tools neu laden, wenn sich Tool-Schemas geändert haben

---

## 11. Referenzen im Repo

- `DuMcpBridge/README.md` — Tool-/Resource-Liste, Verträge
- `ModUiExtractor/README.md` — Mod, Override, Hot-Reload, Build-Stamp
- `du-visual-subagent.md` — Probe-first Workflow für einen Screenshot-fähigen Hilfs-Subagenten
- `live_lua_coding/README.md` — Fester Repo-Ablageort und getrackte Live-Board-Snapshots

---

*Vorlage: Reihenfolge und Erwartungen bei Bedarf für eure Umgebung anpassen (Pfade, `playerId`, Board-Kontext).*
