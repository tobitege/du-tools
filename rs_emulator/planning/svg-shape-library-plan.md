# SVG Shape Library Plan

## Ziel

Eine Lua-Bibliothek definieren, die erkannte SVG-Formen als wiederverwendbare RenderScript-Primitiven zeichnet, statt jedes Mal ad-hoc im Zielskript neue Quads, Rings oder Sonderpfade zu formulieren.

Arbeitstitel:
- `SvgShapeLibrary`

Wahrscheinlicher Ort:
- als neues Modul
- oder als gezielte Erweiterung von [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua)

## Problem, das geloest werden soll

Das aktuelle Beispielskript weiss bereits, wie bestimmte Formen "eigentlich" gezeichnet werden sollten:
- Decals als Quads
- Segmentflaechen als Quads
- der innere Logo-Ring als Hex-Ring

Dieses Wissen ist aber:
- im Beispiel versteckt
- nicht wiederverwendbar
- nicht als API formuliert

Die Folge ist wiederholte Port-Arbeit bei jedem neuen SVG.

## Zielbild

Statt:

```lua
if item.d == "..." then
  -- Sonderfall
end
```

soll spaeter moeglich sein:

```lua
local shape = classifierOutput[i]
SvgShapeLibrary.draw(layer, layout, shape, theme)
```

Oder expliziter:

```lua
SvgShapeLibrary.drawEdgeDecal(layer, layout, shape)
SvgShapeLibrary.drawFrameCap(layer, layout, shape)
SvgShapeLibrary.drawHexRing(layer, layout, shape)
```

## Designprinzipien

### 1. Geometrie bleibt lokal

Shapes sollen ihre Quellkoordinaten behalten.

Die Bibliothek uebernimmt:
- Positionierung
- Skalierung
- Farben
- optionale Stilueberschreibungen

### 2. Primitive zuerst

Die erste Version braucht keine riesige Oberflaeche.

Wichtige Basistypen:
- Triangle
- Quad
- Trapezoid
- Polygon Ring
- Hex Ring
- Outline Path

### 3. Rollen koennen auf Primitive abbilden

Ein `edge_decal` ist am Ende geometrisch oft nur ein `quad`.

Die Bibliothek braucht daher zwei Ebenen:
- generische primitive Renderer
- optionale benannte Komfort-Renderer

### 4. Keine stillen Magien

Wenn eine Form nicht sauber auf ein Shape abbildbar ist, soll die Bibliothek das nicht erraten.

Lieber:
- `drawUnknownOutline(...)`
- oder Rueckfall auf `drawPath(...)`

## Vorgeschlagene API

### Kern-Dispatcher

```lua
SvgShapeLibrary.draw(layer, layout, shape, options)
```

Der Dispatcher verzweigt nach `shape.kind`.

### Primitive APIs

```lua
SvgShapeLibrary.drawTriangle(layer, layout, shape, options)
SvgShapeLibrary.drawQuad(layer, layout, shape, options)
SvgShapeLibrary.drawTrapezoid(layer, layout, shape, options)
SvgShapeLibrary.drawClosedPolygon(layer, layout, shape, options)
SvgShapeLibrary.drawOutlinePath(layer, layout, shape, options)
SvgShapeLibrary.drawHexRing(layer, layout, shape, options)
```

### Rollen-APIs

```lua
SvgShapeLibrary.drawEdgeDecal(layer, layout, shape, options)
SvgShapeLibrary.drawLogoSegment(layer, layout, shape, options)
SvgShapeLibrary.drawFrameCap(layer, layout, shape, options)
```

Diese Rollen-APIs duennen am Ende oft auf Primitive aus.

## Shape-Datenmodell aus Sicht der Library

Minimal:

```lua
{
  kind = "quad",
  geometry = {
    points = {
      { x = 0, y = 0 },
      { x = 10, y = 0 },
      { x = 12, y = 4 },
      { x = 2, y = 4 },
    }
  },
  style = {
    fill = { 1, 1, 1, 1 },
    stroke = nil,
  }
}
```

Rollenbeispiel:

```lua
{
  kind = "quad",
  role = "edge_decal",
  variant = "right",
  geometry = { ... },
  style = { ... },
}
```

## Welche Teile heute schon fast da sind

In [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua) existieren bereits gute Bausteine:
- `hexagon(...)`
- `hexagonOutline(...)`
- `hexRing(...)`
- `notchedHex(...)`
- `circularSegments(...)`

Das bedeutet:
- Die Bibliothek muss nicht bei null anfangen
- Ein Teil der Arbeit ist eher Konsolidierung und API-Ordnung als rohe Neuentwicklung

## Luecken zur aktuellen Lib

### 1. Es fehlt ein allgemeiner Shape-Dispatcher

Derzeit gibt es einzelne Geometriehilfen, aber kein zentrales `draw(shape)`.

### 2. Quads leben noch lokal im Beispiel

`drawLogoSegmentQuad(...)` und `drawBoardQuad(...)` gehoeren langfristig nicht in `SimpleSignS-svg.lua`, sondern in eine Bibliothek.

### 3. Compound oder gefuellte Pfade haben keinen sauberen Platz

Selbst mit einer Shape-Bibliothek bleibt eine generische Fill-Strategie fuer geschlossene Pfade wichtig.

Die Bibliothek braucht daher wahrscheinlich auch:
- `drawClosedPolygon(...)`
- oder `fillPath(...)` fuer Klassifikationsreste

## Vorgeschlagene Struktur

Option A: Erweiterung von `SilverZeroRsLib.lua`

Vorteile:
- vorhandene Layout-Helfer direkt nutzbar
- kein zusaetzliches Modul im ersten Schritt

Nachteile:
- Datei wird schnell breiter

Option B: Neues Modul `SvgShapeLibrary.lua`

Vorteile:
- klar getrennte Verantwortung
- besser fuer spaetere Klassifikations-Integration

Nachteile:
- etwas mehr Modulgrenzen und Imports

Empfehlung:
- Phase 1 als Erweiterung von `SilverZeroRsLib.lua`
- Phase 2 bei wachsendem Umfang in eigenes Modul auslagern

## Migrationsstrategie

### Schritt 1: Primitive in die Bibliothek ziehen

Aus `SimpleSignS-svg.lua` herausziehen:
- `drawBoardQuad(...)`
- `drawLogoSegmentQuad(...)`

und durch generische Bibliotheksaufrufe ersetzen.

### Schritt 2: Benannte Formen einfuehren

Zum Beispiel:
- `drawEdgeDecal(...)`
- `drawFrameCap(...)`
- `drawLogoSegment(...)`

### Schritt 3: Classifier-Ausgabe andocken

Dann erst:
- `shape.kind`
- `shape.role`
- automatischer Dispatcher

## Risiken

### 1. Zu viele benannte Spezialformen

Risiko:
- Bibliothek wird wieder zur Sammlung von Einzelfaellen

Gegenmassnahme:
- Primitive zuerst
- benannte Formen nur bei echtem Wiederholungswert

### 2. API wird zu frueh zu komplex

Risiko:
- Porting wird schwerer statt leichter

Gegenmassnahme:
- kleines Kernset, klare Datenstruktur

### 3. Fill-Probleme bleiben im Unterbau

Risiko:
- Shape-Bibliothek kaschiert weiter nur die fehlende generische Pfadflaechenlogik

Gegenmassnahme:
- Bibliotheksarbeit parallel mit dem allgemeinen Fill-Thema betrachten

## Erfolgskriterien

- `SimpleSignS-svg.lua` verliert einen grossen Teil seines geometrischen Sonderwissens.
- Neue SVG-Ports koennen vorhandene Formen direkt wiederverwenden.
- Primitive und Rollen lassen sich ohne Stringvergleiche ansprechen.
- Bestehende Shape-Helfer in `SilverZeroRsLib.lua` fuehlen sich wie Teile eines Systems an, nicht wie verstreute Einzelideen.

## Erste Umsetzungsfragen fuer spaeter

1. Wollen wir Primitive nur mit `points` modellieren oder auch mit bequemeren Parametern wie `center`, `size`, `thickness`?
2. Soll die Bibliothek auch Theme-Mapping uebernehmen, also z. B. `"highlight"` zu RGBA aufloesen?
3. Welche minimalen Shape-Typen reichen fuer den ersten realen Nutzen aus?
