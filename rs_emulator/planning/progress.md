# Progress Log

## Session: 2026-03-24

## Summary

Der `SvgShapeClassifier` bleibt in dieser Runde unveraendert. Die shape-library / porting-Anbindung deckt jetzt zusaetzlich auch einen ersten `compound_path`-Fall ab. Damit laufen jetzt `hex_ring`, `polygon_ring`, vierpunktige Fill-Shapes, `closed_polygon`-Flaechen und geeignete `compound_path`-Fragmente ueber gemeinsame classifier->library-Regeln statt ueber lokale Sondertabellen.

## Phase Snapshot

### Phase 1-4: Planning

- Anforderungen, Zielbild, Risiken und Einfuehrungsstrategie fuer Classifier und Shape-Library ausgearbeitet.
- Arbeitsunterlagen in `rs_emulator/planning` angelegt.

### Phase 5: First Classifier Implementation

- Grundlegende SVG-Analyse aufgebaut: Path-Flattening, Subpaths, Bounds, offene vs. geschlossene Pfade, erste Primitive.

### Phase 6-7: Ring Classification

- `polygon_ring` und danach `hex_ring` auf realen `SimpleSignS`-Faellen eingefuehrt.

### Phase 8: Group Hints

- erste geometrische Clustering-Hinweise mit `sameCluster`, `clusterSize` und `neighbors` umgesetzt.

### Phase 9-11: First Role Hints

- `frame_outline`, `edge_decal` und `frame_cap` produktiv aus realen `SimpleSignS`-Geometrien abgeleitet.

### Phase 12: Review Hardening

- Rollen- und Clusterlogik gegen Fehlklassifikationen gehaertet.
- `frame_outline` verlangt echte oder effektiv geschlossene Konturen.
- `frame_cap` verlangt passenden Rahmenkontext.
- `groupHints` sind rollenbewusst.

### Phase 13: Logo Segment

- `logo_segment` fuer quadranten-gespiegelte `closed_polygon`-Familien innerhalb eines gemeinsamen `frame_outline` umgesetzt.
- Rahmenkontext in `findCenteredFrameOutline(...)` und `findEnclosingFrameOutline(...)` getrennt.
- Reale `SimpleSignS`-Ecksegmente `SVG 1 #01`, `#02`, `#05`, `#06` tragen jetzt `role=logo_segment`.

### Phase 14: First Shape-Library Handoff

- erster classifier-getriebener Library-Adapter in `SilverZeroRsLib.lua` umgesetzt: `drawClassifiedShape(...)` und `drawClassifiedHexRing(...)`
- `hex_ring` wird jetzt aus klassifizierter Geometrie auf den bestehenden `hexRing(...)`-Renderer abgebildet
- `SimpleSignS-svg.lua` nutzt fuer den realen Logo-Ring jetzt diese classifier->library Strecke statt lokaler Ring-Konstanten und Transform-Sonderlogik

### Phase 15: Four-Point Board Fills

- `SilverZeroRsLib.lua` zeichnet jetzt auch klassifizierte vierpunktige Shapes (`quad`, `trapezoid`, geeignete `outline_path`-Faelle) ueber `drawClassifiedFourPointShape(...)`
- `SimpleSignS-svg.lua` klassifiziert das Board-SVG einmal und versucht fuer gefuellte Items zuerst den neuen classified-shape-Adapter
- die lokale `skipBoardPath`-Stringliste sowie die handgeschriebenen Board-Quad-Tabellen sind damit entfernt

### Phase 16: Closed Polygon Fill Path

- `SilverZeroRsLib.lua` trianguliert jetzt klassifizierte `closed_polygon`- und `triangle`-Shapes ueber `drawClassifiedClosedPolygon(...)`
- der reale `frame_cap`-Fall im `SimpleSignS`-Board laeuft dadurch jetzt ueber classifier->library->triangle rendering statt ueber den alten Path-Fallback
- der End-to-End-Render von `SimpleSignS-svg.lua` enthaelt jetzt auch `AddTriangle`-Kommandos aus diesem Porting-Pfad

### Phase 17: Logo Segment Porting Cleanup

- `SimpleSignS-svg.lua` nutzt jetzt auch im Logo dieselbe Regel wie im Board: gefuellte Items versuchen zuerst `drawClassifiedShape(...)`, erst danach folgt der Path-Fallback
- die lokale `logoSegmentQuads`-Tabelle und ihre Sonderzeichenlogik sind entfernt
- reale `logo_segment`-Fragmente laufen jetzt ueber denselben classifier->library-Pfad wie `frame_cap` und die vierpunktigen Board-Fills

### Phase 18: Polygon Ring Path

- `SilverZeroRsLib.lua` zeichnet jetzt klassifizierte `polygon_ring`-Shapes ueber einen allgemeinen Ringsegment-Adapter
- der `master-artboard`-Branch in `SimpleSignS-svg.lua` klassifiziert jetzt ebenfalls einmal und versucht fuer gefuellte Items zuerst `drawClassifiedShape(...)`
- die realen `SimpleSignS`-Marker-Ringe werden dadurch nicht mehr nur als Pfadkonturen, sondern als explizite Ringsegmente aus der Shape-Library gerendert

### Phase 19: Compound Path Geometry Path

- `SilverZeroRsLib.lua` zeichnet jetzt `compound_path`-Shapes ueber ihre extrahierten Teilpfade als Liniensegmente
- der reale `SimpleSignS`-Board-Fall `compound_path role=edge_decal` laeuft dadurch jetzt ueber classifier->library statt ueber den frueheren `firstSubpathOnly(...)`-Fallback
- die Porter geben den bisherigen Stroke-Kontext (`strokeWidth`) jetzt ebenfalls in den classifier-basierten Library-Pfad weiter

### Phase 20: SimpleSignS SVG Regression Guard

- nach einem sichtbaren Rueckschritt bei `SimpleSignS-svg.lua` bleiben `master-artboard` und Logo vorerst auf dem bekannten Renderpfad statt auf dem weiter ausgedehnten classifier-first-Porting
- die produktiven Library-Adapter fuer `hex_ring`, `polygon_ring`, vierpunktige Fills, `closed_polygon` und `compound_path` bleiben erhalten; aktiv produktiv genutzt wird im End-to-End-Port aktuell vor allem der Board-Pfad
- fuer das Logo gilt jetzt eine engere Regel: fill-faehige klassifizierte Shapes gehen ueber `drawClassifiedShape(...)`, reine Outline-Faelle bleiben auf `drawPath(...)`
- `luaRuntime.test.ts` prueft fuer `SimpleSignS-svg.lua` jetzt die aktuelle Add-Op-Verteilung (`5438` Render-Calls insgesamt, davon `5335` `AddLine`, `34` `AddQuad`, `67` `AddTriangle`) und verankert den Logo-Layer auf `675` Linien, `18` Quads und `37` Dreiecken statt auf dem zwischenzeitlichen Outline-only-Pfad

### Phase 21: Fill-Only Adapter Rule

- `SilverZeroRsLib.lua` bietet jetzt mit `drawClassifiedFillShape(...)` eine wiederverwendbare Regel fuer classifier-getriebene Fill-Familien, ohne Outline- oder Compound-Faelle implizit mitzuziehen
- `SimpleSignS-svg.lua` nutzt diese Library-Regel jetzt im Logo statt einer lokalen Kind-Whitelist
- neue Runtime-Tests pruefen die reale Logo-Nutzung direkt: `logo_segment` wird ueber den Fill-Adapter gezeichnet, `outline_path role=edge_decal` wird dort bewusst ausgelassen

### Phase 22: Free-Form Adapter Probe

- mit `examples/SilverZero/ShapeAdapterProbe.lua` gibt es jetzt ein freies, von `SimpleSign*` unabhaengiges Sichtpruef-Skript fuer die aktuelle Shape-Library-Anbindung
- der Probe zeigt beschriftete Beispielzellen fuer `hex_ring`, `polygon_ring`, `trapezoid`, `closed_polygon`, `compound_path` und `outline_path`
- `luaRuntime.test.ts` fuehrt den Probe ebenfalls aus und prueft sowohl die textuelle Zusammenfassung der Adapter-Ergebnisse als auch das Vorhandensein von Text-, Linien-, Quad- und Triangle-Render-Calls

### Phase 23: Stroke Adapter Rule

- `SilverZeroRsLib.lua` bietet jetzt mit `drawClassifiedStrokeShape(...)` eine wiederverwendbare Regel fuer stroke-lastige classifier-Familien
- der erste produktive Umfang davon ist bewusst klein und geometrisch: `outline_path` und `compound_path`
- der freie `ShapeAdapterProbe.lua` nutzt diese Stroke-Regel jetzt direkt fuer die beiden unteren rechten Zellen statt eines impliziten Fallbacks
- neue Runtime-Tests pruefen den Stroke-Adapter direkt fuer ein synthetisches `outline_path`- und `compound_path`-Beispiel

### Phase 24: Classified Path-Item Porter Helper

- `SilverZeroRsLib.lua` bietet jetzt mit `drawClassifiedPathItem(...)` eine wiederverwendbare Porter-Hilfe, die classifier-getriebene Library-Adapter und den bisherigen `drawPath(...)`-Fallback unter einer gemeinsamen Regel zusammenfasst
- `SimpleSignS-svg.lua` nutzt diese Library-Hilfe jetzt sowohl fuer den Board-Branch (`classifiedMode = "shape"` plus `fallbackFirstSubpathOnly`) als auch fuer den Logo-Branch (`classifiedMode = "fill"`)
- die reale Board-Regel bleibt dabei bewusst erhalten: `outline_path`-Decals duerfen weiter als gefuellte Vierpunkt-Shapes ueber den generischen Adapter laufen, waehrend Outline-Only-Logo-Teile im Fill-Modus weiter sauber auf den Pfad-Fallback gehen
- neue Runtime-Tests pruefen die Porter-Hilfe direkt fuer einen realen Board-Decal-Fall und einen realen Outline-Only-Logo-Fall

## Files Touched In The Latest Iteration

- [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua)
- [SimpleSignS-svg.lua](/d:/github/du-tobi/rs_emulator/examples/SilverZero/SimpleSignS-svg.lua)
- [luaRuntime.test.ts](/d:/github/du-tobi/rs_emulator/test/luaRuntime.test.ts)
- [progress.md](/d:/github/du-tobi/rs_emulator/planning/progress.md)

## Current Verification

Stand nach der letzten inhaltlichen Code-Aenderung:

| Check | Result |
|-------|--------|
| `npm test -- luaRuntime.test.ts` | 77/77 tests passed |
| `npm test` | 130/130 tests passed |
| `npm run build` | succeeded |

## Open Follow-Ups

- Rollenhinweis `ornament` ist noch offen.
- Weitere Primitive und Rollen ausser `hex_ring`, `polygon_ring`, vierpunktigen Fill-Shapes, `closed_polygon`-Flaechen und dem ersten `compound_path`-Linienpfad sind noch nicht an den eigentlichen Render-/Porting-Schritt angebunden.
