# SVG Classifier Plan

## Ziel

Ein Modul definieren, das SVG-Fragmente nicht nur als rohe `path d`-Strings weiterreicht, sondern geometrisch einordnet und in ein brauchbares Shape-Datenmodell ueberfuehrt.

Arbeitstitel:
- `SvgShapeClassifier`

Dieses Modul soll spaeter zwischen Parser und Render-Library sitzen.

## Problem, das geloest werden soll

Der aktuelle Parser liefert genug Information, um Pfade zu lesen, aber nicht genug, um sie sinnvoll als Shape-Wissen zu behandeln.

Der aktuelle Zustand fuehrt dazu, dass:
- kleine gefuellte Formen als Outline-Pfade fehlinterpretiert werden
- Compound Paths schwer einzuordnen sind
- zusammengehoerige Fragmente im Zielskript manuell geraten werden
- Shape-Wissen lokal im Beispielskript landet statt in einer wiederverwendbaren Struktur

## Nicht-Ziel

Kein vollautomatisches "SVG versteht sich semantisch komplett selbst".

Nicht Ziel der ersten Version:
- perfekte semantische Objektgruppierung fuer beliebige Logos
- automatische Texterkennung
- universelle Deutung komplexer Illustrationen

Die erste Version soll robust geometrisch arbeiten.

## Zielbild

Pipeline:

1. `SvgParser.parse(...)` liefert SVG-Eintraege und Items
2. `SvgShapeClassifier.classify(doc)` analysiert die Items
3. Das Ergebnis ist eine Liste normierter Shape-Objekte
4. Ein spaeterer Porter oder Renderer konsumiert diese Shape-Objekte

Die zentrale Aenderung ist:
- von `item.d` als roher String
- zu `shape.kind + shape.geometry + shape.style + shape.source`

## Kernaufgaben des Classifiers

### 1. Geometrie extrahieren

Aus einem SVG-Item sollen strukturelle Informationen entstehen:
- Subpaths
- geschlossene vs. offene Pfade
- approximierte Polygonpunkte
- Bounding Box
- Orientierung
- Flaechen- oder Outline-Charakter

### 2. Primitive erkennen

Erste robuste Shape-Klassen:
- `outline_path`
- `closed_polygon`
- `triangle`
- `quad`
- `trapezoid`
- `polygon_ring`
- `hex_ring`
- `compound_path`

### 3. Rollenhinweise vergeben

Zusatzlich zur Geometrie kann das Modul heuristische Rollen vergeben:
- `logo_segment`
- `edge_decal`
- `frame_cap`
- `ornament`
- `frame_outline`

Diese Rollen muessen nicht perfekt sein. Sie sollen Porting und Review erleichtern.

### 4. Gruppierung vorbereiten

Nicht sofort Vollautomatik, aber erste Gruppierungssignale:
- gleicher Fill
- gleiche Transform-Matrix
- gleiche SVG-Gruppe
- raeumliche Naehe
- aehnliche Groesse
- regelmaessige Winkel-/Radiusbeziehung

Damit kann spaeter aus mehreren Fragmenten ein groesseres Shape-Konstrukt entstehen.

## Vorgeschlagenes Datenmodell

```lua
{
  kind = "quad",
  role = "edge_decal",
  geometry = {
    points = {
      { x = 226.095, y = 16.646 },
      { x = 228.937, y = 13.314 },
      { x = 228.937, y = 17.038 },
      { x = 226.095, y = 20.370 },
    },
    bounds = { x = 226.095, y = 13.314, w = 2.842, h = 7.056 },
  },
  style = {
    fill = "var(--highlight-color)",
    stroke = nil,
  },
  source = {
    svgIndex = 2,
    itemIndex = 11,
    path = "m2330 1473 29 34v-38l-29-34v38",
    transform = { ... },
  },
  confidence = 0.98,
}
```

## Klassifikationsstufen

### Stufe 1: Struktur

Ausgabe:
- `open` oder `closed`
- `subpathCount`
- `pointCount`
- `bounds`
- `style`

Diese Stufe ist Pflicht fuer alles Weitere.

### Stufe 2: Primitive Geometrie

Regeln:
- 3 Ecken -> `triangle`
- 4 Ecken -> `quad`
- 4 Ecken mit parallelen Ober-/Unterseiten -> `trapezoid`
- regelmaessige 6-Eck-Geometrie mit Loch -> `hex_ring`
- mehrere Teilpfade -> `compound_path`

### Stufe 3: Heuristische Rolle

Regeln koennen sein:
- klein + Randnaehe + Highlight-Fill -> `edge_decal`
- mittig + regelmaessig + ringfoermig -> `logo_ring`
- grosser, nahezu viewBox-deckender `compound_path` mit zwei echten oder effektiv geschlossenen Konturen -> `frame_outline`
- grosse, zentrierte Innenflaeche nur im Kontext eines passenden `frame_outline` -> `frame_cap`

### Stufe 4: Gruppierungskandidaten

Ausgabe ist noch keine harte Fusion, sondern ein Hinweis:

```lua
groupHints = {
  sameCluster = "logo_outer_segments",
  neighbors = { 3, 4, 5 },
}
```

Wichtig:
- `groupHints` sollen kuenftig nicht nur Geometrie, sondern auch vergebene Rollen respektieren.
- Geometrisch aehnliche Fragmente mit unterschiedlicher Rolle sollen nicht im selben Cluster landen.

## Wo die Logik leben koennte

Option A:
- neues Modul `rs_emulator/lib/SvgShapeClassifier.lua`

Option B:
- TypeScript-seitiges Analysemodul fuer Tooling/Porting

Empfehlung:
- die erste produktive Laufzeitversion in Lua halten, damit sie nah am bestehenden Parser und an den Lua-Beispielen bleibt
- optional spaeter ein TypeScript-Debug-/Visualisierungswerkzeug danebenstellen

## Erste Erkennungsheuristiken

### Quad-Erkennung

Voraussetzungen:
- geschlossener Pfad
- vier vereinfachte Eckpunkte
- keine starke Selbstueberschneidung

### Trapez-Erkennung

Voraussetzungen:
- `quad`
- ein Paar gegenueberliegender Kanten annähernd parallel

### Ring-Erkennung

Voraussetzungen:
- zwei geschlossene, ineinanderliegende Pfade
- aehnliche Orientierung
- gemeinsames Zentrum oder naheliegendes Zentrum

### Compound-Path-Erkennung

Voraussetzungen:
- mehr als ein `M`/`m`-Teilpfad
- oder getrennte geschlossene Teilpfade in einem Eintrag

## Risiken

### 1. Zu frueh semantisch werden

Risiko:
- Der Classifier versucht zu viel und wird unzuverlaessig

Gegenmassnahme:
- zuerst geometrisch, dann heuristisch

### 2. Pfadvereinfachung zerstoert Details

Risiko:
- zu aggressive Vereinfachung macht aus sauberen Formen schlechte Primitive

Gegenmassnahme:
- Rohdaten und vereinfachte Daten parallel behalten

### 3. Komplexe SVGs bleiben schwierig

Risiko:
- nicht alles wird klassifizierbar sein

Gegenmassnahme:
- `unknown` und `compound_path` sind legitime Ergebnisse

## Einfuehrungsplan

### Phase A: Analyse-API

- Hilfsfunktionen fuer:
  - Subpaths
  - Schliessung
  - Polygonapproximation
  - Bounds
  - Punktnormalisierung

### Phase B: Primitive Klassifikation

- `triangle`
- `quad`
- `trapezoid`
- `closed_polygon`
- `compound_path`

### Phase C: Spezialformen

- `hex_ring`
- spaeter weitere Rings oder Segmenttypen

### Phase D: Rollenheuristiken

- `frame_outline`
- `edge_decal`
- `logo_segment`
- `frame_cap`
- `ornament`

## Aktueller Implementierungsstand

Stand der ersten produktiven Iteration:

Bereits umgesetzt:
- Subpath-Erkennung
- offene vs. geschlossene Pfade
- implizite Schliessung bei start/end-gleichen Pfaden
- Polygonapproximation
- Bounds
- Primitive:
  - `outline_path`
  - `closed_polygon`
  - `triangle`
  - `quad`
  - `trapezoid`
  - `polygon_ring`
  - `hex_ring`
  - `compound_path`
- Rollenhinweise:
  - `logo_segment`
  - `frame_outline`
  - `edge_decal`
  - `frame_cap`

Noch offen und weiterhin Teil des Plans:
- Rollenhinweise:
  - `ornament`
- Nutzung der Classifier-Ausgabe im eigentlichen Render-/Porting-Schritt

Wichtig:
- Diese Punkte sind nicht verworfen.
- Sie sind fuer die erste Iteration nur noch nicht umgesetzt.

## Erfolgskriterien

- Das aktuelle `SimpleSignS`-Beispiel laesst sich groesserenteils ohne Stringvergleich auf Shape-Klassen abbilden.
- Neue SVG-Ports koennen erkannte Primitive inspizieren, statt nur `d`-Strings zu lesen.
- Die Ausgabe des Classifiers ist stabil genug fuer Debugging, Tooling und spaetere Lua-Shape-Renderer.

## Erste Umsetzungsfragen fuer spaeter

1. Soll die Polygonapproximation direkt auf Parser-Ebene entstehen oder erst im Classifier?
2. Wie stark duerfen Kurven fuer Primitive approximiert werden?
3. Wie wollen wir Debug-Ausgaben inspizieren: JSON, Lua-Table-Dump oder visuelle Overlay-Datei?
