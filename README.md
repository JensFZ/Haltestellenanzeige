# Haltestellenanzeige

Abfahrtstafel für BSAG-Haltestellen im Stil der Fahrgastinfo – als Webseite und als Bild für ein ESP32 mit E-Ink-Display. Hintergrund und Entscheidungen: [PLAN.md](PLAN.md).

## Server

```bash
npm install
npm start          # http://localhost:3000
npm test
```

Oder per Docker Compose (Port änderbar über `HOST_PORT`, Standard 3000):

```bash
docker compose up -d --build
```

**Deployment:** Jeder Push auf `main` testet, baut das Image und spielt es über Tailscale per SSH nach `/root/haltestellenanzeige` auf den Server ([deploy.yml](.github/workflows/deploy.yml), [docker-compose.prod.yml](docker-compose.prod.yml)). Benötigte Repo-Secrets und Tailscale-Setup wie im Repo [dave](https://github.com/JensFZ/dave/blob/main/DEPLOYMENT.md): `TAILSCALE_OAUTH_CLIENT_ID`, `TAILSCALE_OAUTH_SECRET`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`.

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
