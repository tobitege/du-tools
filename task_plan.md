# Task Plan

## Goal

Verstehen, warum die ScreenLayoutEditor-Persistenz auf dem Programming Board nach Board-Neustart nicht wiederhergestellt wird, obwohl interaktive Änderungen auf dem Screen vorgenommen wurden.

## Phases

- [completed] Dokumentierte Persistenzkette in `live_board` prüfen
- [completed] Live-Artefakt gegen Repo-Dateien vergleichen
- [completed] Fehlerursache eingrenzen: `setOutput`-Envelope zu groß, Live-`onTimer` veraltet
- [completed] Kompakte Persistenz-Serialisierung in Repo-Dateien umsetzen und lokal verifizieren
- [completed] Live-Handlers in den Programming-Board-Editor pushen
- [in_progress] Persistenz im Spiel nachprüfen

## Notes

- `unit/onTimer(UPD)` und `unit/onStart()` sind jetzt beide live gepusht und gespeichert.
- Für die Restprüfung braucht es jetzt nur noch einen echten Ingame-Move am Screen plus Beobachtung von Chat/HUD bzw. Restore nach Neustart.
