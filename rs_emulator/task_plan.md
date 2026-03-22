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

- Nur `examples/SilverZero/OreExplorerM.lua` und nur falls wirklich sinnvoll `examples/SilverZero/SilverZeroRsLib.lua` ändern.
- Keine Änderungen in `live_board/`.
- `setNext*` immer direkt vor dem jeweiligen Draw-Call setzen; keine stillen Mehrfachwirkungen annehmen.
- Bewegungsanimationen nur behalten, wenn sie klar Teil der Originalintention sind.

## Offene Punkte

- Das Original liegt hier nicht als `.html`, sondern in `OreExplorerM.json` mit eingebettetem HTML/CSS vor.
- Sprite-Texturen und Hintergrundbilder des Originals werden weiterhin nur abstrakt angenähert, nicht 1:1 nachgebaut.

## Fehlerprotokoll

| Fehler | Versuch | Auflösung |
|---|---|---|
