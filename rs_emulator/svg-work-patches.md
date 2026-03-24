# SVG Work Patches

Diese Notiz sammelt die SVG-Arbeitspatches, die im aktuellen `SimpleSignS`-Port bereits faktisch entstanden sind.

Ziel ist noch nicht die Endarchitektur, sondern eine belastbare Grundlage fuer die naechste Planungsrunde:

- Welche SVG-Fragmente mussten wir bereits speziell behandeln?
- Welche Formtypen lassen sich daraus ableiten?
- Welche Root-Causes tauchen wiederholt auf?
- Welche Teile gehoeren spaeter in eine eigene Shape-Bibliothek statt in ein Beispielskript?

## Warum diese Datei existiert

Im aktuellen Stand werden etliche SVG-Formen nicht mehr als rohe Pfade gerendert, sondern als gezielt ueberfuehrte Lua-Formen:

- Quads fuer kleine Decals
- Quads fuer einfache Segmentflaechen
- ein eigener Hex-Ring fuer das innere Logo
- ein `skip...`-Mechanismus, um problematische Originalpfade zu ueberspringen

Das funktioniert fuer das konkrete Beispiel, ist aber noch kein reproduzierbares System.

## Aktuelle Beispiele aus `SimpleSignS-svg.lua`

Quelle:

- [SimpleSignS-svg.lua](/d:/github/du-tobi/rs_emulator/examples/SilverZero/SimpleSignS-svg.lua)

### 1. Logo-Aussensegmente als Quads

Im Skript werden sechs aeussere Logo-Segmente nicht mehr direkt aus SVG-Pfaden gezeichnet, sondern ueber `logoSegmentQuads`.

Beobachtung:

- Die Segmente sind einfache gefuellte Flaechen
- Ein generischer Stroke-basierter Pfadtransfer war dafuer ungeeignet
- Das Ergebnis ist bereits ein impliziter Formtyp: `logo segment quad`

Moegliche spaetere Bibliotheksform:

- `drawLogoSegmentQuad(layout, points, color)`
- oder allgemeiner `drawQuadShape(layout, points, style)`

### 2. Rechte Board-Decals als Quads

Im Skript werden sechs kleine rechte Dekoformen ueber `boardRightDecalQuads` gezeichnet.

Beobachtung:

- Diese Formen sind kleine schiefe Trapeze bzw. Quads
- Als rohe SVG-Pfade sahen sie mit der aktuellen Pfadzeichnung schlecht aus
- Sie wurden deshalb in feste Flaechen ueberfuehrt

Impliziter Formtyp:

- `edge decal quad`
- Auspraegung: rechte Kante, oben und unten gruppiert

### 3. Linke Board-Decals als Quads

Im Skript werden zwei linke Dekoformen ueber `boardLeftDecalQuads` gezeichnet.

Beobachtung:

- Gleiche Problemklasse wie rechts
- Andere Orientierung
- Formtyp ist verwandt, nur gespiegelt bzw. anders ausgerichtet

Impliziter Formtyp:

- `edge decal quad`
- Auspraegung: linke Kante

### 4. Unteres mittleres Highlight-Segment als Quad

Im Skript wird das untere weisse Mittelstueck ueber `boardCenterHighlightQuads` gezeichnet.

Beobachtung:

- Das Original ist eine gefuellte trapezaehnliche Form
- Das Ergebnis ist nicht nur ein kosmetischer Patch, sondern ein weiterer klarer Shape-Kandidat

Impliziter Formtyp:

- `frame center cap`
- geometrisch: flaches Trapez / Vierseiter

### 5. Innerer Logo-Ring als eigene Shape-Logik

Im Skript wird ein weisser innerer Ring nicht als generischer Pfad gezeichnet, sondern ueber:

- `deferredLogoFillItems`
- `applyTransformPoint(...)`
- `applyTransformDistance(...)`
- `SZ.hexRing(...)`

Beobachtung:

- Das ist bereits mehr als ein Patch
- Hier wurde eine Form erkannt und bewusst als eigene Geometrie beschrieben

Impliziter Formtyp:

- `hex ring`

Das ist bisher der beste Hinweis darauf, wie ein spaeteres SVG-taugliches Shape-System aussehen koennte:

- Form erkennen
- in normierte Geometrie umrechnen
- ueber eine stabile Hilfsfunktion rendern

### 6. Multi-Subpath-Reduktion

Im Skript gibt es `firstSubpathOnly(pathData)`.

Beobachtung:

- Manche importierten SVG-Pfade enthalten mehrere Teilpfade
- Fuer den aktuellen Transfer wird teils nur der erste Teilpfad genutzt
- Das ist ein Hinweis auf fehlende Strukturinformation im Porting-Schritt

Impliziter Problemtyp:

- `compound path`
- ein einzelner `d`-String repraesentiert mehrere Formen oder Unterformen

## Aktuelle Workaround-Mechanik

Im Board-Bereich gibt es diese zentrale Stelle:

```lua
local skipBoardPath = item.fill == "var(--highlight-color)" and (
    ...
)
```

Beobachtung:

- Bestimmte Originalpfade werden per exaktem Stringvergleich erkannt
- Diese Pfade werden im Standardpfad uebersprungen
- Danach werden sie als eigene Quads erneut gezeichnet

Das ist aktuell nuetzlich, aber als Muster fragil:

- kleinste SVG-Aenderung bricht die Erkennung
- Zusammenhang zwischen Pfaden bleibt implizit
- echte Shape-Semantik lebt nur im Beispielskript

## Bereits sichtbare Fragment-Klassen

Aus dem aktuellen Port lassen sich schon jetzt sinnvolle Klassen ableiten.

### A. Einfache gefuellte Vierseiter

Beispiele:

- rechte Decals
- linke Decals
- unteres mittleres Highlight
- aeussere Logo-Segmente

Bibliotheksidee:

- `drawQuad(points, color)`
- `drawSkewedQuad(bounds, skew, color)`
- `drawTrapezoid(points, color)`

### B. Ringfoermige Formen mit Loch

Beispiel:

- innerer weisser Hex-Ring im Logo

Bibliotheksidee:

- `drawHexRing(center, outerRadius, innerRadius, color)`
- allgemeiner spaeter eventuell `drawPolygonRing(...)`

### C. Outline-Pfade

Beispiele:

- Grossteil der roten Rahmen- und Circuit-Linien
- viele Logo-Linien, die als Kontur korrekt sind

Bibliotheksidee:

- bisher bereits durch `drawPath(...)` abgedeckt
- vermutlich weiterhin sinnvoll fuer echte Linienformen

### D. Compound Paths / zusammenhaengende Fragmente

Beispiel:

- Pfade, bei denen mehrere Teilpfade zusammen eine optische Form ergeben
- oder Formen, deren Zusammenhang aus dem SVG allein nicht offen sichtbar ist

Hier fehlt derzeit ein Erkennungs- oder Klassifikationsschritt.

## Root Causes, die aus dem aktuellen Stand sichtbar sind

Quelle:

- [SvgParser.lua](/d:/github/du-tobi/rs_emulator/lib/SvgParser.lua)
- [SilverZeroRsLib.lua](/d:/github/du-tobi/rs_emulator/lib/SilverZeroRsLib.lua)

### 1. Der Parser liefert zu wenig semantische Forminformation

Aktuell wird vor allem `item.d`, `fill`, `transform` und etwas SVG-Kontext uebernommen.

Es fehlt z. B.:

- explizite Subpath-Struktur
- geschlossene Polygonpunkte als einfache Liste
- Einordnung, ob etwas eher Fill, Outline, Ring, Quad oder Compound Shape ist

### 2. `drawPath(...)` ist im Kern stroke-basiert

Der aktuelle Pfadtransfer in `SilverZeroRsLib.lua` baut Liniensegmente auf und zeichnet sie ueber `addLine(...)`.

Folge:

- kleine gefuellte Formen sehen schlecht aus
- Fill und Stroke sind nicht wirklich getrennt modelliert
- geschlossene Pfade werden nicht automatisch zu Flaechen

### 3. Shape-Wissen steckt aktuell im Beispielskript

Das Beispiel kennt schon mehr ueber die Geometrie als Parser und Bibliothek:

- welche Pfade eigentlich Decals sind
- welche Flaechen simple Quads sind
- welche Form als Hex-Ring besser gezeichnet wird

Dieses Wissen ist aktuell:

- lokal
- fragil
- nicht wiederverwendbar

## Was daraus als fehlende Endprodukte folgt

### 1. Ein SVG-Fragment-Klassifikationsmodul

Arbeitstitel:

- `SvgShapeClassifier`

Aufgabe:

- SVG-Fragmente geometrisch einordnen
- nicht nur Pfadstrings weiterreichen

Erste moegliche Outputs:

- `kind = "quad"`
- `kind = "trapezoid"`
- `kind = "hex_ring"`
- `kind = "outline_path"`
- `kind = "compound_path"`

Moegliche weitere Felder:

- `role = "logo_segment" | "edge_decal" | "frame_cap" | "ornament"`
- `points`
- `center`
- `outerRadius`
- `innerRadius`
- `fillColor`
- `strokeColor`
- `sourcePath`

### 2. Eine Lua-Shape-Bibliothek

Arbeitstitel:

- `SvgShapeLibrary`
- oder Erweiterung in `SilverZeroRsLib.lua`

Aufgabe:

- erkannte Formen nicht mehr immer wieder neu im Beispielskript formulieren

Moegliche API-Kandidaten:

- `drawQuadShape(layer, layout, shape)`
- `drawEdgeDecal(layer, layout, shape)`
- `drawFrameCap(layer, layout, shape)`
- `drawHexRingShape(layer, layout, shape)`
- `drawOutlinePath(layer, layout, shape)`

Wichtig:

- das Shape sollte seine Geometrie in lokalen Quellkoordinaten behalten
- Layout, Position, Farben und Skalierung kommen ueber Parameter

## Erster Datenmodell-Vorschlag

Ein spaeterer Port koennte statt roher Workarounds etwa solche Objekte erzeugen:

```lua
{
  kind = "edge_decal",
  variant = "right",
  points = {
    { x = 226.095, y = 16.646 },
    { x = 228.937, y = 13.314 },
    { x = 228.937, y = 17.038 },
    { x = 226.095, y = 20.370 },
  },
  fill = "highlight",
  source = {
    svg = "board",
    path = "m2330 1473 29 34v-38l-29-34v38",
  }
}
```

Oder fuer den Ring:

```lua
{
  kind = "hex_ring",
  center = { x = 15186.2, y = 10315.975 },
  outerRadius = 1285.415,
  innerRadius = 917.845,
  fill = "highlight",
  transform = item.transform,
}
```

## Praktischer Nutzen dieser Sammlung

Diese Datei soll spaeter helfen bei:

- Planungsarbeit fuer einen generischen SVG-Porting-Workflow
- Definition eines Klassifikationsmoduls
- Herausziehen von Shape-Helfern aus Beispielskripten
- Vergleich neuer SVG-Ports mit bereits geloesten Problemtypen

## Aktueller Zwischenstand in einem Satz

Wir haben bereits mehrere SVG-Fragmente erfolgreich in wiederverwendbare geometrische Formen uebersetzt, aber diese Formen leben noch als ad-hoc-Wissen im Beispielskript statt als explizites SVG-Shape-System.
