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
- Die neu exportierte `SimpleSignS`-Preview zeigt eine klar wiederkehrende reale Geometrieklasse: zwei geschlossene, ineinanderliegende Subpaths mit gemeinsamem Zentrum.
  - Im kleinen Preview-SVG sind das drei bisher als `compound_path` gefuehrte Ringformen.
  - Im `master-artboard` sind das 23 kleine Marker-Ringe mit Bounds `17.2 x 17.2`, die zuvor ebenfalls nur als `compound_path` auftauchten.
- Diese Formen lassen sich rein geometrisch ueber Verschachtelung, Zentrum und Innenkontur erkennen; dafuer ist keine semantische Sonderlogik im Beispielskript noetig.
- Innerhalb dieser Ringformen gibt es in `SimpleSignS` nochmals eine echte Untergruppe:
  - Die drei grossen Ringformen im oberen SVG verhalten sich geometrisch wie sechseckige Doppelkonturen und lassen sich robust zu `hex_ring` verfeinern.
  - Die 23 kleinen Marker im `master-artboard` bleiben dagegen bewusst generische `polygon_ring`, weil ihre approximierten Kurven mit `24+24` Punkten rund und nicht hexagonal sind.
- Nach der Gruppierungsrunde zeigt die Preview zusaetzlich wiederkehrende Formfamilien:
  - die 23 Marker-Ringe im `master-artboard` bilden einen gemeinsamen `polygon_ring`-Cluster
  - die vier offenen Kantenfragmente in `SVG 3` bilden einen gemeinsamen `outline_path`-Cluster
  - die vier kleinen Rand-Quads in `SVG 3` bilden einen gemeinsamen `quad`-Cluster
  - die beiden oberen bzw. unteren Doppelstrips in `SVG 3` werden als zusammengehoerige `compound_path`-Paare sichtbar
- Zwei der verbliebenen grossen `compound_path`-Faelle verhalten sich ebenfalls auffaellig konsistent:
  - `SVG 1 #10` deckt die komplette kleine Sign-ViewBox fast vollstaendig ab und besteht aus genau zwei echten oder effektiv geschlossenen Konturen
  - `SVG 3 #20` zeigt dasselbe Muster fuer den grossen Rahmen des breiten Schilds
- Diese beiden Realfaelle lassen sich rein geometrisch als `frame_outline` markieren, ohne semantische Sonderfaelle aus dem Beispielskript zu brauchen.
- Der Review-Fix hat gezeigt, dass "effektiv geschlossen" hier wichtig ist:
  - die realen Rahmenkonturen in `SimpleSignS` sind nicht immer formal mit `z` geschlossen
  - fuer `frame_outline` reicht aber ein sehr kleiner Start/End-Abstand innerhalb derselben Kontur
  - grosse offene Linienbuendel duerfen dadurch trotzdem nicht faelschlich als Rahmen gelten
- Der naechste groessere Restblock besteht aus vielen kleinen Highlight-Fragmenten direkt an den Aussenraendern:
  - in `SVG 3` betrifft das die Fragmente `#02` bis `#19` in mehreren Primitive-Klassen (`trapezoid`, `compound_path`, `quad`, `outline_path`)
  - in `SVG 1` bleibt ausserdem `#07` als schmaler, randnaher `outline_path` uebrig
- Diese Formen teilen dieselbe robuste Geometrie: sehr schlanke Bounds, geringe Flaechenabdeckung, klare Randnaehe und Highlight-Fill. Das reicht fuer einen ersten Rollenhinweis `edge_decal`.
- Nach `frame_outline` und `edge_decal` bleibt im breiten Schild noch genau eine grosse, zentrierte und fast viewBox-deckende Innenflaeche ohne Rolle uebrig:
  - `SVG 3 #01` ist ein `closed_polygon` mit 32 Punkten und Bounds `230.267 x 154.604` bei einer ViewBox von `231 x 156`
  - die Form ist klar groesser als die Rand-Decals, aber zugleich keine Doppelkontur wie `frame_outline`
- Diese Geometrie eignet sich als erster belastbarer `frame_cap`-Fall.
- Der Review-Fix hat die Regel enger gemacht:
  - `frame_cap` wird nicht mehr nur aus Groesse und Zentrierung abgeleitet
  - die Flaeche braucht jetzt einen passenden umschliessenden `frame_outline` im selben SVG-Kontext
  - dadurch werden generische Backdrops oder isolierte grosse Polygone nicht vorschnell als Rahmenflaeche markiert

- Fuer `groupHints` gilt nach dem Review ebenfalls eine neue Erkenntnis:
  - reine Geometrie-Fingerprints reichen fuer spaetere Porting-Entscheidungen nicht immer aus
  - Rollen wie `frame_cap` und andere spaetere Rollen muessen beim Clustering mitberuecksichtigt werden
  - sonst koennen semantisch verschiedene, aber geometrisch aehnliche Fragmente im selben Cluster landen
- Nach `frame_outline`, `frame_cap` und `edge_decal` bleibt im kleinen `SVG 1` eine klare Restfamilie uebrig:
  - die vier grossen Eck-Polygone `#01`, `#02`, `#05` und `#06`
  - alle vier liegen innerhalb desselben `frame_outline`
  - alle vier haben sehr aehnliche Bounds
  - ihre Mittelpunkte sind ueber beide Achsen um denselben Rahmenmittelpunkt gespiegelt
- Wichtig fuer diese Familie:
  - der Fill ist nicht das tragende Merkmal
  - die reale `SimpleSignS`-Familie mischt Primaerfarbe und Highlight-Fill
  - ein Fill-basierter Ausschluss verliert echte Logo-Segmente
- Fuer spaetere Rollenlogik brauchten wir deshalb zwei Rahmen-Kontexte:
  - `findCenteredFrameOutline(...)` fuer zentrierte Innenflaechen wie `frame_cap`
  - `findEnclosingFrameOutline(...)` fuer umschlossene, aber absichtlich exzentrische Fragmente wie `logo_segment`
- Daraus ergibt sich ein belastbarer neuer Rollenhinweis:
  - `logo_segment` fuer einzelne `closed_polygon`-Fragmente, die innerhalb eines `frame_outline` eine vollstaendige, vierfach gespiegelte Quadrantenfamilie mit aehnlicher Groesse bilden
  - im aktuellen `SimpleSignS` betrifft das genau die vier Eckfragmente des kleinen Logos
  - die zentralen `hex_ring`-Formen und der seitliche Steg bleiben dabei bewusst ohne diese Rolle

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
- Die aktualisierte Shape-Preview macht sichtbar, dass mehrere reale `compound_path`-Faelle eigentlich Ringformen sind und in der Overlay-Ausgabe als `polygon_ring` deutlich lesbarer werden.
- Nach der zweiten Verfeinerung unterscheidet die Preview jetzt sichtbar zwischen echten `hex_ring`-Formen im oberen Sign-SVG und den runden `polygon_ring`-Markern im Artboard.
- Die Summary zeigt jetzt auch `groupHints`, sodass sich wiederkehrende Fragmente ohne manuelle String-Suche als Familien lesen lassen.
- Die naechste Verfeinerung macht in der Summary jetzt auch die grossen Schildrahmen explizit sichtbar: `SVG 1 #10` und `SVG 3 #20` tragen dort `role=frame_outline`.
- Nach der aktuellen Verfeinerung sind die randnahen Highlight-Fragmente im breiten Schild und der schmale Seitenstreifen in `SVG 1` explizit als `role=edge_decal` sichtbar.
- Die aktuelle Preview trennt im breiten Schild jetzt drei Ebenen klar voneinander: `frame_outline` fuer den aeusseren Rahmen, `frame_cap` fuer die grosse Innenflaeche und `edge_decal` fuer die kleinen Randfragmente.
- Nach dem Review-Fix sind diese drei Ebenen auch intern sauberer abgesichert: `frame_outline` verlangt echte oder effektiv geschlossene Konturen, `frame_cap` einen Rahmenkontext, und `groupHints` respektieren jetzt die vergebene Rolle.
- Die aktuelle Summary weist jetzt auch die vier grossen Eckfragmente in `SVG 1` explizit als `role=logo_segment` aus.
- Die zugehoerige Regel greift nicht auf die `hex_ring`-Zentralformen oder den einseitigen Seitensteg ueber; die Restmenge wird dadurch sichtbar kleiner und zugleich sauberer abgegrenzt.
