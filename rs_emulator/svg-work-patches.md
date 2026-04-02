# SVG Work Patches

Diese Notiz sammelt die SVG-Arbeitspatches und die wichtigen Ableitungen aus dem aktuellen `SimpleSignS`-Port.

Ziel ist nicht nur eine Zwischenstands-Doku, sondern ein belastbarer Merkkasten fuer die naechste Planungsrunde:

- Welche SVG-Fragmente mussten speziell behandelt werden?
- Welche Root-Causes sind dabei wirklich aufgetaucht?
- Welche Erkenntnisse gehoeren spaeter in Parser oder Bibliothek statt ins Beispielskript?
- Welche Denkfehler sollten wir beim naechsten Port bewusst vermeiden?

## Warum diese Datei existiert

Im aktuellen Stand ist klar:

- Nicht jedes SVG-Fragment sollte durch dieselbe Renderroute gehen.
- Kleine gefuellte Kanten-Decals sind keine gute Aufgabe fuer einen rein pfadbasierten Transfer.
- Einige Probleme waren keine Renderprobleme, sondern Datenprobleme im Prepared-Asset.
- Einige Probleme waren keine Geometrieprobleme, sondern Initialisierungs-/Loadingprobleme.

Die wichtigste praktische Lehre ist:

- Visuelles Ziel zuerst, aktuelle Repräsentation erst danach.
- Wenn etwas in der Zielgrafik nur ein scharfes gefuelltes Trapez oder Quad ist, sollte man zuerst pruefen, ob ein natives `addQuad(...)` oder `addTriangle(...)` die richtige Ebene ist.
- Nicht an einer Pfad-Idee festhalten, nur weil das Skript oder das Asset gerade bereits pfadbasiert aussieht.

## Aktueller Stand in `SimpleSignS-svg.lua`

Quelle:

- [SimpleSignS-svg.lua](rs_emulator/examples/SilverZero/SimpleSignS-svg.lua)

### 1. Das innere Board besteht aktuell aus drei klar getrennten Teilen

- dunkler Hintergrund: natives `addBox(...)`
- roter Hauptrahmen: manueller `boardOutlinePath` ueber `SZ.drawPath(...)`
- weisse Highlights: aus `SimpleSignBoardPrepared`, aber nicht mehr komplett ueber eine einzige Route

Das ist wichtig, weil damit der grosse rote Rahmen bewusst weiterhin pfadbasiert bleibt, waehrend die kleinen Kanten-Decals nicht mehr daran gekoppelt sind.

### 2. Nicht-`edge_decal`-Highlights kommen weiter aus den Prepared-Board-Daten

Die weissen Board-Highlights werden aus `sharedAssets.boardSvg` gezogen.

Dabei werden nur Eintraege mit `item.fill == "var(--highlight-color)"` beruecksichtigt.

Wichtig:

- Nicht jede Highlight-Form wird automatisch als native Primitive gezeichnet.
- Längere Balken und andere nicht-problematische Highlight-Elemente duerfen weiterhin ueber `SZ.drawSvgEntry(...)` laufen.

### 3. `edge_decal`-Formen werden bewusst als native Quads gezeichnet

Die kleinen Kanten-Decals werden nicht mehr als rohe Pfade gezeichnet.

Stattdessen gilt:

- `SimpleSignBoardPrepared` liefert bereits `role = "edge_decal"`
- dieselben Prepared-Shapes liefern auch die 4 Punktkoordinaten
- diese Punktliste wird direkt mit einer nativen Quad-Flaeche gezeichnet

Der Ablauf ist damit:

1. Prepared-Board-Asset liefert klassifizierte Shape-Daten
2. `shape.role == "edge_decal"` trennt die problematischen kleinen Kanten-Decals ab
3. `shape.geometry.points` liefert die vier Eckpunkte
4. `SZ.drawQuadPoints(...)` rendert diese Form als echte gefuellte native Flaeche

Das ist der entscheidende praktische Patch, weil genau diese Formen vorher als pfadbasierte Mini-Formen visuell instabil waren.

### 4. Neue kleine Bibliotheks-Ergaenzung: `SZ.drawQuadPoints(...)`

Quelle:

- [SilverZeroRsLib.lua](rs_emulator/lib/SilverZeroRsLib.lua)

Die Punktliste-zu-Quad-Logik ist nicht mehr lokal im Beispiel versteckt, sondern als oeffentliche Hilfsmethode vorhanden:

- `SZ.drawQuadPoints(layer, layout, points, color)`

Zweck:

- vermeidet den wiederholten 8-Zeilen-Block aus `toScreenX(...)` / `toScreenY(...)`
- haelt den Porting-Schritt auf der Ebene "4 Punkte -> gefuelltes Quad"
- macht dieselbe Verfeinerung in anderen Skripten wiederverwendbar

## Root-Causes, die wir inzwischen wirklich gesehen haben

## 1. Nicht jedes kleine Fill-Shape sollte ueber `drawPath(...)` laufen

Das war kein theoretischer Punkt mehr, sondern ein praktischer Fehler.

Beobachtung:

- Der du-mocks-Test fuer Formen zeigt, dass ein natives gefuelltes Quad/Trapez im Vanilla-RenderScript sauber und mit scharfen Kanten darstellbar ist.
- Wenn die Ziel-Form visuell nur ein kleiner gefuellter Vierseiter ist, ist ein nativer Quad-Pfad meist die bessere Ebene als ein SVG-Pfadtransfer.

Konsequenz:

- Kleine edge decals zuerst als Primitive denken
- Pfadtransfer nur dann beibehalten, wenn die Form wirklich davon profitiert

## 2. "Koordinaten kennen" reicht nicht, wenn man auf der falschen Ebene arbeitet

Ein wichtiger Denkfehler im Port war:

- Source-Pfade, Transform und visuelle Lage wurden gedanklich dauernd ineinander gemischt
- insbesondere bei invertiertem Y durch den Board-Transform

Die bessere Arbeitsregel ist:

- Nicht nur die Koordinaten kennen
- sondern zuerst entscheiden, welche Primitive die Ziel-Form wirklich beschreibt

Kurz:

- Die richtige Geometrieebene ist wichtiger als die blosse Kenntnis des Ursprungs-Pfads

## 3. Ein Teil des Problems war echter Datenmuell im Prepared-Asset

Quelle:

- [SimpleSignBoardPrepared.lua](rs_emulator/examples/SilverZero/SimpleSignBoardPrepared.lua)

Es gab eine echte Duplikation des Bottom-Left-Highlight-Segments:

- derselbe Trapez-Pfad war zweimal im Prepared-Shape-Bereich vorhanden
- derselbe SVG-Item-Eintrag war auch zweimal im Prepared-`items`-Bereich vorhanden

Folge:

- Das linke untere Eck wirkte dichter als das linke obere
- Der untere Decal-Bereich wirkte dadurch optisch "an den roten Rahmen gedrueckt"

Wichtige Lehre:

- Nicht Symptome auf Call-Site wegskippen, wenn die Daten selbst falsch sind
- Wenn der Prepared-Input redundant ist, sollte die Korrektur dort stattfinden

## 4. Ein Teil des Problems war Initialisierung ueber mehrere Frames

Quelle:

- [SimpleSignSharedAssetsSelective.lua](rs_emulator/lib/SimpleSignSharedAssetsSelective.lua)

Beim Umstellen von "nur Logo laden" auf "Board + Logo laden" trat Emulator-Flicker auf.

Ursache:

- `prepareStep(...)` liefert absichtlich unvollstaendige Zwischenschritte
- in Kombination mit `requestAnimationFrame(1)` fuehrte das zu sichtbaren Zwischenframes

Korrektur:

- fuer diesen statischen Screen werden die benoetigten Assets ueber `get(...)` direkt fertig geladen
- keine gestaffelte Script-Initialisierung ueber mehrere Frames

Wichtige Lehre:

- Geometrie-Fixes und Loading-Fixes sind unterschiedliche Problemklassen
- sichtbares Flackern muss nicht von den Shapes kommen

## Aktuelle Formklassen, die sich sauber abzeichnen

### A. `edge_decal`

Merkmale:

- kleine gefuellte Kantenform
- meist 4 Punkte
- visuell ein Trapez oder schiefes Quad
- sollte bevorzugt als native Flaeche gerendert werden

Praktischer Renderweg:

- `SZ.drawQuadPoints(...)`

### B. `frame highlight bar`

Merkmale:

- laengere weisse Highlight-Balken
- pfadbasiert oft unkritisch
- koennen aus dem Prepared-Board-Asset kommen

Praktischer Renderweg:

- `SZ.drawSvgEntry(...)`

### C. `outline_path`

Merkmale:

- rote Rahmenlinien
- Circuit-Linien
- andere echte Konturformen

Praktischer Renderweg:

- `SZ.drawPath(...)`

## Wichtige Design-Regeln fuer weitere SVG-Ports

### 1. Nicht an einer Idee festkleben

Wenn der aktuelle Ansatz kaempft, dann nicht nur lokal nachpatchen.

Stattdessen fragen:

- Ist das wirklich ein Pfadproblem?
- Oder ist die Form in Wahrheit einfach ein natives Quad?
- Oder ist das Asset selbst redundant/falsch?
- Oder ist das ein Ladeproblem und gar kein Geometrieproblem?

### 2. Root Cause vor Workaround

Wenn ein Duplikat im Prepared-Asset steckt:

- Duplikat im Prepared-Asset entfernen
- nicht erst im Beispielskript mit String-Skips ueberdecken

### 3. Visuelle Ziel-Form wichtiger als SVG-Herkunft

Die Herkunft "kommt aus einem SVG-Pfad" bedeutet nicht automatisch:

- dass sie auch als Pfad gerendert werden sollte

Wenn das Ziel nur ein gefuelltes Trapez ist:

- `addQuad(...)` ist oft die bessere Wahrheit als `drawPath(...)`

### 4. Kleine Primitive in die Bibliothek, nicht in jedes Skript

Wenn derselbe Punkt-zu-Quad-Schritt mehrfach auftaucht:

- als Bibliothekshelfer hochziehen
- Beispielskripte auf Formentscheidung reduzieren, nicht auf Koordinaten-Fleißarbeit

## Was daraus als naechste Endprodukte folgt

### 1. Shape-Klassifikation bleibt weiter sinnvoll

Ein `SvgShapeClassifier` bleibt wertvoll.

Besonders nuetzlich sind Felder wie:

- `kind`
- `role`
- `points`
- `bounds`
- `subpaths`

Der aktuelle `edge_decal`-Weg zeigt bereits, dass diese Informationen direkt in bessere Renderentscheidungen uebersetzt werden koennen.

### 2. Kleine oeffentliche Shape-Helfer statt ad-hoc-Umrechnungen

Der Schritt von lokalem Inline-Code zu `SZ.drawQuadPoints(...)` ist genau die richtige Richtung.

Weitere Kandidaten spaeter:

- `drawTrianglePoints(...)`
- einfache Ring-/Bracket-Helfer
- helper fuer skews oder frame caps, wenn sich die Muster wiederholen

## Praktischer Nutzen dieser Sammlung

Diese Datei soll spaeter helfen bei:

- Planungsarbeit fuer einen generischen SVG-Porting-Workflow
- Trennung zwischen Datenfehler, Geometriefehler und Loadingfehler
- Herausziehen wiederverwendbarer Primitive aus Beispielskripten
- schnellerem Erkennen, wann ein Port nicht weiter auf der Pfad-Ebene debuggt werden sollte

## Aktueller Zwischenstand in einem Satz

Der `SimpleSignS`-Port zeigt jetzt klar: kleine `edge_decal`-Formen sollten aus klassifizierten 4-Punkt-Geometrien als native Quads gerendert werden, waehrend laengere Highlights und Outline-Strukturen weiterhin gut aus Prepared-SVG bzw. Pfadlogik kommen koennen.
