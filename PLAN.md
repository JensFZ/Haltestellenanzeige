# Plan: BSAG-Haltestellenanzeige

Ergebnis der Grilling-Session vom 2026-10-03.

## Architektur
- **Server** (Node.js/TypeScript, Docker, nur Heimnetz) holt Abfahrten und rendert Webseite *und* E-Ink-Bild. Das ESP ist „dumm“.
- **Datenquelle:** VBN-HAFAS via `hafas-client` (Profil `vbn`), ohne Key, inoffiziell. Cache 45 s pro Haltestelle.
  Offizieller Fallback (VBN HAFAS ReST, Key über api@vbn.de, 12.000 Abrufe/Monat) wird erst gebaut, wenn A ausfällt.
- **Konfiguration** komplett per URL: `/board?stop=<id>&offset=<min>&lines=4,6&dir=Lilienthal`. Kein Login, keine DB.

## Anzeige
- Layout angelehnt an die BSAG-Fahrgastinfo: dunkle Kopfzeile (Ⓗ, Haltestelle, Uhrzeit), 6 Zeilen, nächste erreichbare Abfahrt rot hervorgehoben.
- Linien-Badges: Straßenbahn = Quadrat, Bus = Kreis, Farben nach BSAG-Liniennetz (Webseite). E-Ink: Tram rot, Bus schwarz.
- **Offset**: unerreichbare Abfahrten ausblenden; Zeile zeigt „los in X min“ (≤ 60 min), sonst „HH:MM“; darunter Plan-Zeit, Verspätung „+3“ rot.
- Ausfall: durchgestrichen + „fällt aus“. Zeitfenster 90 min.
- Datenausfall: letzte Daten bis 10 min mit „Stand HH:MM ⚠“, danach Fehlertafel.
- Webseite: Auto-Refresh 30 s, vollbildskaliert (Kiosk), Startseite mit Haltestellensuche + Link-Generator. Nur Deutsch.

## E-Ink
- `/board.bin?…` = Puppeteer-Screenshot derselben Seite (`&eink=1`) → 2 Bitebenen schwarz/rot, 800×480, je 48.000 Byte, 1 = Tinte, MSB zuerst.
- `ETag` → ESP spart sich den Refresh bei 304. `X-Sleep` sagt dem ESP, wie lange es warten soll (60 s, nachts 0–5 Uhr bis 5 Uhr).
- Hardware: ESP32 + Waveshare 7,5″ (B) V2 schwarz/weiß/rot, USB-Strom.
- Firmware: PlatformIO + GxEPD2 + WiFiManager; Tafel-URL im Setup-Portal. BOOT beim Reset gedrückt halten = Einstellungen löschen.
- Server nicht erreichbar: altes Bild bleibt, Hinweiszeile unten.

## Bewusst weggelassen
- Mehrere Haltestellen pro Tafel, offizieller API-Fallback, Deep Sleep/Akku – erst bei Bedarf.
