# Findings & Decisions

## Requirements

- Die zwei bereits identifizierten Endprodukte sollen vor einer konkreten Implementierung sauber ausgearbeitet werden.
- Die Ergebnisse sollen in `rs_emulator/planning` liegen.
- Das Material soll als Grundlage fuer spaetere Architektur- und Umsetzungsentscheidungen dienen.
- Die neue Planung soll auf den realen SVG-Arbeitspatches dieser Session aufsetzen, nicht auf abstrakten Annahmen.

## Research Findings

- [svg-work-patches.md](/d:/github/du-tobi/rs_emulator/svg-work-patches.md) zeigt bereits mehrere implizite Shape-Typen:
  - Logo-Aussensegmente als Quads
  - rechte und linke Edge-Decals als Quads
  - unteres mittleres Frame-Segment als Quad
  - innerer Hex-Ring als eigene Render-Form
- [SvgParser.lua](/d:/github/du-tobi/rs_emulator/lib/SvgParser.lua) liefert derzeit vor allem `d`, `fill`, `transform` und etwas SVG-Kontext, aber keine reichere Shape-Semantik.
- [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua#L596) zeichnet SVG-Pfade aktuell im Kern als Liniensegmente mit `addLine(...)`; echte Pfadflaechen sind kein generischer Teil des aktuellen Transfers.
- [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua#L990) bis [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua#L1123) enthaelt bereits mehrere shape-artige Primitive wie `hexagon`, `hexRing`, `notchedHex`, `circularSegments`.
- Das bedeutet: Die Bibliothek hat bereits ein erstes Shape-Vokabular, aber es ist noch nicht an einen SVG-Klassifikations- oder Porting-Workflow angeschlossen.
- Die erste Classifier-Iteration kann stabil aus `path d`-Daten geometrische Struktur ableiten:
  - mehrere Subpaths erkennen
  - explizit und implizit geschlossene Pfade unterscheiden
  - transformierte Polygonpunktlisten approximieren
  - Bounds und primaeren Teilpfad bestimmen
  - `outline_path`, `closed_polygon`, `triangle`, `quad`, `trapezoid` und `compound_path` klassifizieren
- Das Board-Decal `m2330 1473 29 34v-38l-29-34v38` aus `SimpleSignS_html.lua` wird mit angewendetem SVG-Transform als `quad` mit den erwarteten vier Punkten erkannt. Das bestaetigt, dass die neue Analyse nicht nur auf synthetischen Testpfaden funktioniert.
- Viele kleine SVG-Flaechen nutzen implizite Schliessung ohne explizites `z`. Diese Form muss der Classifier selbst erkennen, sonst fallen reale Decals faelschlich in `outline_path`.

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Classifier und Shape-Library werden als getrennte, aber gekoppelte Architekturthemen beschrieben | Der Classifier produziert Shape-Wissen; die Library konsumiert dieses Wissen |
| Es wird zunaechst auf geometrische Klassifikation fokussiert | Das ist deutlich realistischer und stabiler als sofortige semantische Vollautomatik |
| Bestehende Workarounds gelten als Beweis fuer benoetigte Shape-Klassen | Das aktuelle Skript zeigt bereits, welche Formtypen in der Praxis gebraucht werden |
| Die bestehende `SilverZeroRsLib.lua` wird als wahrscheinliche Heimat der ersten Shape-Bausteine betrachtet | Dort existieren bereits passende geometrische Hilfen und Layout-Konventionen |
| Die erste produktive API bleibt rein analytisch (`analyzePath`, `classifyItem`, `classifyItems`, `classify`) | So entsteht sofort wiederverwendbare Shape-Logik, ohne das Beispielskript mit neuen Sonderfaellen zu vermischen |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `planning-with-files` ist standardmaessig auf Root-Dateien ausgelegt | Planungsdateien wurden bewusst in `rs_emulator/planning` angelegt, wie vom Nutzer gewuenscht |
| Aktuelle Codebasis enthaelt Workarounds, aber noch kein explizites Shape-System | Diese Luecke wird in den Fachpapieren direkt adressiert |

## Resources

- [svg-work-patches.md](/d:/github/du-tobi/rs_emulator/svg-work-patches.md)
- [SimpleSignS-svg.lua](/d:/github/du-tobi/rs_emulator/examples/SilverZero/SimpleSignS-svg.lua)
- [SimpleSignS_html.lua](/d:/github/du-tobi/rs_emulator/examples/SilverZero/SimpleSignS_html.lua)
- [SvgParser.lua](/d:/github/du-tobi/rs_emulator/lib/SvgParser.lua)
- [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua)
- [convert-ideas.md](/d:/github/du-tobi/rs_emulator/examples/SilverZero/convert-ideas.md)

## Visual/Browser Findings

- Die Session hat mehrfach gezeigt, dass kleine gefuellte SVG-Formen visuell scheitern, wenn sie nur als Outline-Pfade uebertragen werden.
- Dagegen waren Quads und gezielte Shape-Helfer fuer dieselben Bereiche stabil und visuell korrekt.
- Der innere Hex-Ring war der erste erfolgreiche Fall, in dem eine visuell zusammenhaengende SVG-Form bewusst in eine eigene Geometrie-Funktion ueberfuehrt wurde.
