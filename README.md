# Haltestellenanzeige

Abfahrtstafel für BSAG-Haltestellen im Stil der Fahrgastinfo – als Webseite und als Bild für ein ESP32 mit E-Ink-Display. Hintergrund und Entscheidungen: [PLAN.md](PLAN.md).

## Server

```bash
npm install
npm start          # http://localhost:3000
npm test
```

Oder per Docker:

```bash
docker build -t haltestellenanzeige .
docker run -d --restart unless-stopped -p 3000:3000 haltestellenanzeige
```

Auf `http://<server>:3000/` Haltestelle suchen, Weg in Minuten und optionale Filter eintragen → Links für Browser und ESP.

| Pfad | Zweck |
|---|---|
| `/board?stop=…&offset=…&lines=…&dir=…` | Tafel im Browser |
| `/board?…&eink=1` | E-Ink-Vorschau |
| `/board.bin?…` | 96.000 Byte Bitebenen fürs ESP (Header `ETag`, `X-Sleep`) |
| `/api/board?…`, `/api/stops?q=…` | JSON |

## ESP32 / E-Ink

ESP32 + Waveshare 7,5″ (B) V2, Pins in [firmware/src/main.cpp](firmware/src/main.cpp).

```bash
cd firmware && pio run -t upload
```

Beim ersten Start öffnet das ESP das WLAN „Haltestellenanzeige“: dort WLAN und die `board.bin`-URL eintragen (mit der LAN-IP des Servers, nicht `localhost`). BOOT-Taste beim Reset gedrückt halten setzt alles zurück.

Daten: VBN/BSAG-Fahrplanauskunft (inoffizielle HAFAS-Schnittstelle).
