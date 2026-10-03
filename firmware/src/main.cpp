// Haltestellenanzeige: polls /board.bin and pushes the two bitplanes to a 7.5" b/w/red e-paper.
// Server does all layout work; this only downloads, compares ETag and draws.
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <GxEPD2_3C.h>

// Wiring: generic ESP32 + Waveshare 7.5" (B) V2 HAT. Adjust pins to your board.
// For the Waveshare "e-Paper ESP32 Driver Board" use CS=15, DC=27, RST=26, BUSY=25 and SPI.begin(13, 12, 14, 15).
GxEPD2_3C<GxEPD2_750c_Z08, GxEPD2_750c_Z08::HEIGHT / 4> display(GxEPD2_750c_Z08(/*CS=*/5, /*DC=*/17, /*RST=*/16, /*BUSY=*/4));

const int W = 800, H = 480, PLANE = W * H / 8;
uint8_t *black, *red;  // 1 bit = ink, MSB first, row-major (same as the server)
String url, etag;
bool offline = false;
Preferences prefs;

void drawText(int y, const char *msg, uint16_t color) {
  display.setTextSize(2);
  display.setTextColor(color);
  display.setCursor(16, y);
  display.print(msg);  // default GFX font: ASCII only, no umlauts
}

void draw(const char *msg = nullptr) {
  display.setFullWindow();
  display.firstPage();
  do {
    display.fillScreen(GxEPD_WHITE);
    display.drawBitmap(0, 0, black, W, H, GxEPD_BLACK);
    display.drawBitmap(0, 0, red, W, H, GxEPD_RED);
    if (msg) drawText(H - 20, msg, GxEPD_RED);
  } while (display.nextPage());
  display.hibernate();
}

bool readFully(WiFiClient *s, uint8_t *buf, size_t n) {
  size_t got = 0;
  uint32_t start = millis();
  while (got < n && millis() - start < 15000) {
    int r = s->read(buf + got, n - got);
    if (r > 0) got += r; else delay(5);
  }
  return got == n;
}

// One poll. Returns the seconds to wait, as told by the server (X-Sleep).
int poll() {
  HTTPClient http;
  http.begin(url);
  const char *keys[] = {"ETag", "X-Sleep"};
  http.collectHeaders(keys, 2);
  if (etag.length()) http.addHeader("If-None-Match", etag);
  int code = http.GET();
  int sleep = http.header("X-Sleep").toInt();
  if (sleep <= 0) sleep = 60;

  if (code == 200 && http.getSize() == 2 * PLANE) {
    WiFiClient *s = http.getStreamPtr();
    if (readFully(s, black, PLANE) && readFully(s, red, PLANE)) {
      etag = http.header("ETag");
      offline = false;
      draw();
    } else {
      etag = "";  // buffers are half-written; force a full redraw on the next good poll
    }
  } else if (code == 304) {
    if (offline) { offline = false; draw(); }
  } else if (!offline) {  // keep the old image, just mark it
    Serial.printf("HTTP %d\n", code);
    offline = true;
    draw("Server nicht erreichbar");
  }
  http.end();
  return sleep;
}

void setup() {
  Serial.begin(115200);
  black = (uint8_t *)calloc(PLANE, 1);
  red = (uint8_t *)calloc(PLANE, 1);
  display.init(115200, true, 2, false);

  prefs.begin("board");
  url = prefs.getString("url", "");

  WiFiManager wm;
  pinMode(0, INPUT_PULLUP);
  if (digitalRead(0) == LOW) {  // hold BOOT while resetting: forget WiFi + URL
    wm.resetSettings();
    url = "";
  }
  WiFiManagerParameter urlParam("url", "Tafel-URL (http://server:3000/board.bin?stop=...)", url.c_str(), 300);
  wm.addParameter(&urlParam);
  wm.setAPCallback([](WiFiManager *) {
    display.setFullWindow();
    display.firstPage();
    do {
      display.fillScreen(GxEPD_WHITE);
      drawText(200, "Einrichtung: mit WLAN 'Haltestellenanzeige' verbinden", GxEPD_BLACK);
      drawText(230, "und im Portal WLAN + Tafel-URL eintragen.", GxEPD_BLACK);
    } while (display.nextPage());
    display.hibernate();
  });
  bool ok = url.isEmpty() ? wm.startConfigPortal("Haltestellenanzeige") : wm.autoConnect("Haltestellenanzeige");
  if (!ok) ESP.restart();

  if (strlen(urlParam.getValue())) {
    url = urlParam.getValue();
    prefs.putString("url", url);
  }
}

void loop() {
  // ponytail: plain delay with WiFi on, fine on USB power; switch to deep sleep for battery use.
  delay(poll() * 1000UL);
}
