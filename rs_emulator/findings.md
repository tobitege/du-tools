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

- Für wiederholte Linien braucht es eine Hilfsroutine wie SilverZeroRsLib.lua -> `library.line`, die `setNextStrokeColor` und `setNextStrokeWidth` vor jedem `addLine` erneut setzt.

## Screenshot-Vergleich nach Anpassung

- Die Sonne liegt jetzt links angeschnitten und deutlich zurückhaltender; der störende große weiße Mittelpunkt ist entfernt.
- Die Planeten stehen jetzt auf einer gemeinsamen Basislinie ohne unbeauftragte Schwebe-/Pulsbewegung.
- Die Namen sind oberhalb der Planeten gesetzt und überdecken sich im getesteten Emulatorstand nicht mehr.
- Der untere Bereich zeigt nun planetenbezogene Erz-Karten für `Alioth`, `Alioth M1`, `Alioth M2` und `Alioth M4` statt einer frei erfundenen Tabellenansicht.
- Gegenüber der JSON-Vorlage bleiben zwei bewusste Vereinfachungen: keine echten Planeten-/Erz-Sprites und keine fotografischen Hintergrundbilder.
