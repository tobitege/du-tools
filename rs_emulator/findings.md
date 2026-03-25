# OreExplorerM Findings

## Vorlage aus `OreExplorerM.json`

- Die obere Szene nutzt eine Weltraum-/Solar-System-Zeile mit Hintergrundbild.
- `#helios` ist kein zentraler heller Kreis, sondern ein sehr großes, weit nach links versetztes Objekt, das nur angeschnitten sichtbar ist.
- Die Planeten liegen in einer horizontalen Reihe, skalieren pro Planet unterschiedlich und stehen auf einer gemeinsamen Basislinie.
- Der aktive Planet wird über ein Inline-Override auf `10vmin` vergrößert, nicht über frei schwebende Animationen.
- Die Planetennamen stehen oberhalb bzw. leicht über den Planeten und sind knapp gesetzt.
- Der untere Bereich ist keine kompakte Tabellenansicht, sondern ein breites Raster aus Planet-Card plus mehreren Erz-Items pro Zeile.

## Befunde zum aktuellen Lua-Port

- Die Sonne ist derzeit dominant mittig platziert und visuell deutlich lauter als in der Vorlage.
- Die Planeten haben zusätzliche vertikale Bewegung und pulsierende Hervorhebungen, die in der Vorlage nicht angelegt sind.
- Namen und Tier-Texte konkurrieren räumlich mit den Planeten; dadurch entstehen Überlagerungen und ungenaue Textausrichtungen.
- Die Datenansicht wurde in eine sektor-/tabellenartige Anzeige umgebaut und trifft die Raster-Intention der Vorlage nur grob.

## RenderScript-spezifisch

- Für wiederholte Linien braucht es eine Hilfsroutine wie `lib/SilverZeroRsLib.lua` -> `library.line`, die `setNextStrokeColor` und `setNextStrokeWidth` vor jedem `addLine` erneut setzt.

## Screenshot-Vergleich nach Anpassung

- Die Sonne liegt jetzt links angeschnitten und deutlich zurückhaltender; der störende große weiße Mittelpunkt ist entfernt.
- Die Planeten stehen jetzt auf einer gemeinsamen Basislinie ohne unbeauftragte Schwebe-/Pulsbewegung.
- Die Namen sind oberhalb der Planeten gesetzt und überdecken sich im getesteten Emulatorstand nicht mehr.
- Der untere Bereich zeigt nun planetenbezogene Erz-Karten für `Alioth`, `Alioth M1`, `Alioth M2` und `Alioth M4` statt einer frei erfundenen Tabellenansicht.
- Gegenüber der JSON-Vorlage bleiben zwei bewusste Vereinfachungen: keine echten Planeten-/Erz-Sprites und keine fotografischen Hintergrundbilder.

## 2026-03-25 ContainerHubHubM Findings

- Das große Linienfächer-Artefakt im aktuellen Screenshot stammt direkt aus `examples/SilverZero/ContainerHubHubM.lua` (`layers.fx`) und nicht aus `SvgParser.lua`.
- Die aktuelle Lua-Version ist ein freier Dashboard-Mock mit zusätzlichen Texten wie `A HUB`, `SCROLL` und `MAX MASS`, die in der Original-HTML so nicht vorkommen.
- Die Originalvorlage in `ContainerHubHubM.json` nutzt drei wichtige SVG-Bausteine:
  - einen großen Panel-/Rahmen-SVG-Hintergrund,
  - einen schmalen vertikalen Separator-SVG,
  - eine wiederverwendete Item-Card-SVG-Kontur.
- Die eigentliche Top-Bar in der Vorlage ist ein schräger Parallelogramm-Balken plus segmentierte `p2`-Segmente, nicht die aktuell gezeichnete flache Box-Leiste.
- Die Browser-Karten enthalten im Original nur Icon, Name und Menge; zusätzliche Hub-Zeilen gehören zur aktuellen Lua-Abweichung.

## 2026-03-25 ContainerHubHubM Feinschliff Findings

- Die zu kleinen Top-Texte kamen nicht nur von konservativen Basisgrößen, sondern vor allem vom Font-Cache in `DrawBuffer.LoadFont(...)`: gleiche Font-Familie mit anderer Größe bekam denselben Handle und damit am Ende die zuletzt geladene kleine Größe.
- Für `ContainerHubHubM.lua` passen viewport-basierte Fontgrößen besser als `scaleFontSize(...)`, weil die Originalvorlage CSS-Größen wie `7vh`, `6vw` und `5vw` nutzt.
- Die schrägen Füllbalken waren geometrisch zu flach: das bisherige Quad nutzte nur einen kleinen festen Offset statt eines zum CSS-`skew(-30deg)` passenden Offsets (`tan(30deg) * Höhe`).
- Die linke Kartenbildfläche war in der Portierung deutlich zu klein und zu tief. Aus dem Original-CSS umgerechnet liegt sie ungefähr bei `x=28.5`, `y=37.3`, `w=h=197.4` im Card-ViewBox-Raum.

## 2026-03-25 DispenserSignS Findings

- Der bisherige `DispenserSignS.lua` war kein HTML-naher Port, sondern ein frei erfundenes Promo-Layout mit Texten wie `DISPENSER`, `MARKET PRICE`, `SALE` und zusätzlicher Linien-/Badge-Deko, die im Original nicht vorkommt.
- Die Originalvorlage `DispenserSignS.html` kombiniert vier klar getrennte Bausteine:
  - das bekannte rote Circuit-Hintergrund-SVG,
  - das gleiche große Panel-/Board-SVG wie `SimpleSignS`,
  - das große SilverZero-Logo links unten,
  - drei HTML-Overlays für Beschreibung, Bildslot und Preisblock.
- Anders als beim Board nutzen die Text- und Overlay-Blöcke gemischte CSS-Einheiten: viele vertikale Positionen sind in `vw` gesetzt, der Logo-Slot und das Board aber in `vh`/`vw`. Für den Port ist deshalb direkte CSS-zu-Pixel-Umrechnung sauberer als ein einheitlicher ViewBox-Mock.
- Der Preisblock muss trotz Single-Run als zusammengesetzte Gruppe behandelt werden: Zahl rechtsbündig im `price`-Container, das `ħ` separat darüber versetzt aus `top:-4.25vw` und `left:2vw`.
- Das Original-Screenshot zeigt den Bildslot mit defektem/fehlendem Bild. Ein leerer Rahmen plus kleines Broken-Image-Symbol trifft die Vorlage besser als ein erfundenes Icon oder ein dekoratives Platzhalter-Label.
