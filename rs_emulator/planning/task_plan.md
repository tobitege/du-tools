# Task Plan: SVG Shape Planning

## Goal

Die zwei fehlenden Endprodukte fuer den SVG-Porting-Workflow im `rs_emulator` fachlich ausarbeiten: ein SVG-Fragment-Klassifikationsmodul und eine Lua-Shape-Bibliothek, jeweils mit Zielbild, Datenmodell, Phasen, Risiken und konkreten Einstiegsaufgaben.

## Current Phase

Phase 5

## Phases

### Phase 1: Requirements & Discovery

- [x] Nutzerziel fuer die zwei Endprodukte erfassen
- [x] Bestehende SVG-Arbeitspatches sichten
- [x] Aktuelle technische Grenzen im Parser und in der Render-Lib festhalten
- **Status:** complete

### Phase 2: Planning Workspace

- [x] Eigenes Verzeichnis `rs_emulator/planning` anlegen
- [x] File-based planning Unterlagen in diesem Verzeichnis anlegen
- [x] Ausgangslage und Folgedokumente verlinken
- **Status:** complete

### Phase 3: Classifier Planning

- [x] Zielbild fuer ein `SvgShapeClassifier` beschreiben
- [x] Klassifikationsstufen und Ausgabeformat definieren
- [x] Risiken und Einfuehrungsstrategie festhalten
- **Status:** complete

### Phase 4: Shape Library Planning

- [x] Zielbild fuer eine Lua-Shape-Bibliothek beschreiben
- [x] Shape-Kategorien und API-Vorschlaege definieren
- [x] Migrationsstrategie aus ad-hoc-Patches herausarbeiten
- **Status:** complete

### Phase 5: Delivery

- [x] Ergebnisse in Planungsdateien zusammenfassen
- [x] Nächste sinnvolle Umsetzungsschritte benennen
- [x] Mit dem Nutzer entscheiden, welcher Track zuerst umgesetzt wird
- **Status:** complete

## Key Questions

1. Welche Fragment-Typen koennen wir robust geometrisch erkennen, ohne sofort semantische Wunder zu erwarten?
2. Wie sollte das Shape-Datenmodell aussehen, damit Klassifikation und Lua-Rendering dieselben Begriffe sprechen?
3. Welche bestehenden Workarounds lassen sich spaeter komplett entfernen, wenn Classifier und Shape-Library vorhanden sind?

## Offene Umsetzungspunkte Nach Der Ersten Iteration

- [x] `polygon_ring` implementieren
- [x] `hex_ring` implementieren
- [x] `frame_outline` als ersten Rollenhinweis implementieren
- [x] `edge_decal` als zweiten Rollenhinweis implementieren
- [x] `frame_cap` als dritten Rollenhinweis implementieren
- [x] Review-Fixes fuer `frame_outline`, `frame_cap` und rollenbewusste `groupHints` nachziehen
- [x] `logo_segment` als weiteren Rollenhinweis implementieren
- [ ] Weiteren Rollenhinweis `ornament` implementieren
- [x] Gruppierung mehrerer Fragmente bzw. `groupHints` implementieren
- [ ] Classifier-Ausgabe an den eigentlichen Render-/Porting-Schritt anbinden

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Planungsdateien liegen in `rs_emulator/planning` statt im Repo-Root | Entspricht dem Nutzerwunsch und trennt Architekturarbeit von allgemeinem Projektmaterial |
| Zwei Themen werden in getrennten Fachpapieren ausgearbeitet | Klassifikation und Shape-Library sind eng verwandt, aber als Umsetzungsstreams getrennt planbar |
| `svg-work-patches.md` ist die Ausgangsbasis | Diese Datei enthaelt bereits die faktisch bekannten Shape-Typen und Root-Causes |
| Die erste produktive Umsetzung startet mit dem `SvgShapeClassifier` | Der Nutzer hat den geometrischen Track fuer die erste Iteration explizit priorisiert |

## Notes

- Primäre Ausgangsdatei: [svg-work-patches.md](/d:/github/du-tobi/rs_emulator/svg-work-patches.md)
- Fachpapiere: [svg-classifier-plan.md](/d:/github/du-tobi/rs_emulator/planning/svg-classifier-plan.md) und [svg-shape-library-plan.md](/d:/github/du-tobi/rs_emulator/planning/svg-shape-library-plan.md)
