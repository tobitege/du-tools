# OreExplorerM Portierung

## Ziel

`examples/SilverZero/OreExplorerM.lua` näher an die visuelle Absicht der ursprünglichen SilverZero-Vorlage bringen, ohne kreative Neugestaltung.

## Phasen

| Phase | Status | Inhalt |
|---|---|---|
| 1 | complete | Vorlage und bestehendes Lua-Skript analysieren |
| 2 | complete | Gezielte Layout- und Darstellungsfehler in `OreExplorerM.lua` beheben |
| 3 | complete | Ergebnis im laufenden Emulator per Browser neu laden und visuell prüfen |
| 4 | complete | `npm run test -- test/luaRuntime.test.ts` in `rs_emulator` ausführen |

## Leitplanken

- Nur `examples/SilverZero/OreExplorerM.lua` und nur falls wirklich sinnvoll `lib/SilverZeroRsLib.lua` ändern.
- Keine Änderungen in `live_lua_coding/`.
- `setNext*` immer direkt vor dem jeweiligen Draw-Call setzen; keine stillen Mehrfachwirkungen annehmen.
- Bewegungsanimationen nur behalten, wenn sie klar Teil der Originalintention sind.

## Offene Punkte

- Das Original liegt hier nicht als `.html`, sondern in `OreExplorerM.json` mit eingebettetem HTML/CSS vor.
- Sprite-Texturen und Hintergrundbilder des Originals werden weiterhin nur abstrakt angenähert, nicht 1:1 nachgebaut.

## Fehlerprotokoll

| Fehler | Versuch | Auflösung |
|---|---|---|

## 2026-03-25 ContainerHubHubM SVG-Fix

### Ziel

`examples/SilverZero/ContainerHubHubM.lua` deutlich näher an die originale `ContainerHubHubM.json`-Vorlage bringen und die aktuell sichtbaren Mock-/Artefaktfehler entfernen.

### Phasen

| Phase | Status | Inhalt |
|---|---|---|
| 1 | complete | Original-HTML/SVG aus `ContainerHubHubM.json` extrahieren und die gröbsten Abweichungen zum Lua-Mock festhalten |
| 2 | complete | Gemeinsame SVG-Render-Helfer in `lib/SilverZeroRsLib.lua` ergänzen und `ContainerHubHubM.lua` auf die Originalstruktur umbauen |
| 3 | complete | Regressionen in `test/luaRuntime.test.ts` ergänzen |
| 4 | complete | Betroffene Tests ausführen und Ergebnis prüfen |

### Leitplanken

- Bestehende Nutzeränderungen im Worktree nicht zurücksetzen.
- Keine neue freie Mock-Deko hinzufügen, wenn sie in der Vorlage nicht angelegt ist.
- SVG-Rahmen und Item-Karten möglichst aus der Originalvorlage ableiten statt neu zu erfinden.

## 2026-03-25 ContainerHubHubM Feinschliff

### Ziel

Die verbliebenen Screenshot-Abweichungen in `examples/SilverZero/ContainerHubHubM.lua` gezielt beheben: Top-Bar-Winkel angleichen, Top-Texte deutlich größer machen und Karten-Icons wieder in die originale Geometrie bringen.

### Phasen

| Phase | Status | Inhalt |
|---|---|---|
| 1 | complete | Ursache der zu kleinen Top-Texte und der schiefen Karten-Geometrie im Emulator/Beispiel lokalisieren |
| 2 | complete | Font-Handle-Verhalten, Viewport-Fontgrößen und ContainerHubHubM-Geometrie anpassen |
| 3 | complete | `test/drawBuffer.test.ts` und `test/luaRuntime.test.ts` erweitern |
| 4 | complete | Betroffene Tests ausführen und Ergebnis prüfen |

## 2026-03-25 DispenserSignS Portierung

### Ziel

`examples/SilverZero/DispenserSignS.lua` vom freien Mock auf eine CSS-nahe Portierung der originalen `DispenserSignS.html` umbauen, mit einmaligem Run und Wiederverwendung der bereits korrekten SimpleSign-Hintergrund-/Board-/Logo-Bausteine.

### Phasen

| Phase | Status | Inhalt |
|---|---|---|
| 1 | complete | Original-HTML/CSS lesen und die größten Abweichungen zum bisherigen Lua-Mock festhalten |
| 2 | complete | `DispenserSignS.lua` auf Originalstruktur, Originaltexte und Single-Run umbauen |
| 3 | complete | `test/luaRuntime.test.ts` um charakteristische Dispenser-Assertions ergänzen |
| 4 | complete | Betroffenen Runtime-Test ausführen und Ergebnis prüfen |
