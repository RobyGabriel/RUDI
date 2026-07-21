#include <Arduino.h>
#include <WebSocketsServer.h>
#include <WiFi.h>

// Punte RUDI: WiFi (WebSocket) + USB <-> STM32F769I-DISCO (UART).
//
// Aplicatia Expo/React Native se conecteaza la WiFi-ul robotului si deschide:
//     const ws = new WebSocket('ws://192.168.4.1:81');
//     ws.onmessage = e => console.log(e.data);   // liniile robotului
//     ws.send('DEMO');                            // comenzi: DEMO|GO|MOT|S|X
//
// Cablaj: ESP GPIO4 (TX) -> STM32 D0 (PC7),  ESP GPIO5 (RX) <- STM32 D1 (PC6),
//         GND comun. USB-ul ESP-ului ramane consola de debug (acelasi protocol).

namespace {

// --- WiFi: Access Point propriu (nu depinde de niciun router) ---
constexpr char AP_SSID[] = "RUDI-ROBOT";
constexpr char AP_PASS[] = "rudi1234";  // minim 8 caractere
constexpr int AP_CHANNEL = 6;
constexpr char STA_SSID[] = "RUDI-LAB";  // hotspot comun, test local
constexpr char STA_PASS[] = "rudi1234";

constexpr int LINK_TX_PIN = 4;
constexpr int LINK_RX_PIN = 5;
constexpr uint32_t LINK_BAUD = 115200;

WebSocketsServer ws(81);
char lineBuf[220];
size_t lineLen = 0;
uint32_t lastStaRetryMs = 0;

void onWsEvent(uint8_t client, WStype_t type, uint8_t *payload, size_t len) {
  switch (type) {
    case WStype_CONNECTED:
      ws.sendTXT(client, "[punte] conectat la RUDI — comenzi: DEMO|GO|MOT|S|X");
      break;
    case WStype_TEXT:
      // comanda din aplicatie -> robot (adaugam newline daca lipseste)
      Serial1.write(payload, len);
      if (len == 0 || payload[len - 1] != '\n') {
        Serial1.write('\n');
      }
      break;
    default:
      break;
  }
}

// linie completa de la robot -> toti clientii WebSocket + USB
void flushLine() {
  if (lineLen == 0) {
    return;
  }
  lineBuf[lineLen] = 0;
  ws.broadcastTXT(lineBuf, lineLen);
  Serial.println(lineBuf);
  lineLen = 0;
}

void connectSta() {
  const int networkCount = WiFi.scanNetworks();
  int staNetwork = -1;
  int32_t staBestRssi = -1000;
  for (int i = 0; i < networkCount; ++i) {
    if (WiFi.SSID(i) == STA_SSID && WiFi.RSSI(i) > staBestRssi) {
      staNetwork = i;
      staBestRssi = WiFi.RSSI(i);
    }
  }

  if (staNetwork < 0) {
    Serial.printf("[punte] STA: '%s' nu apare la scanare\n", STA_SSID);
    WiFi.begin(STA_SSID, STA_PASS);
    return;
  }

  uint8_t staBssid[6];
  memcpy(staBssid, WiFi.BSSID(staNetwork), sizeof(staBssid));
  const int32_t channel = WiFi.channel(staNetwork);
  const wifi_auth_mode_t auth = WiFi.encryptionType(staNetwork);
  Serial.printf(
      "[punte] STA gasit: RSSI %ld dBm, canal %ld, auth=%d, BSSID=%s\n",
      static_cast<long>(staBestRssi), static_cast<long>(channel),
      static_cast<int>(auth), WiFi.BSSIDstr(staNetwork).c_str());

  if (auth == WIFI_AUTH_OPEN) {
    WiFi.begin(STA_SSID, nullptr, channel, staBssid);
  } else {
    WiFi.begin(STA_SSID, STA_PASS, channel, staBssid);
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);  // USB CDC (debug / varianta laptop)
  Serial1.begin(LINK_BAUD, SERIAL_8N1, LINK_RX_PIN, LINK_TX_PIN);

  // Pornire curata a radioului. Pe unele placi ESP32-C3, o configuratie WiFi
  // ramasa in NVS de la firmware-ul precedent poate impiedica AP-ul sa fie
  // vizibil, chiar daca softAPIP() intoarce adresa implicita.
  WiFi.persistent(false);
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_OFF);
  delay(200);
  // Conectam mai intai statia. ESP32-C3 are un singur radio; pornirea AP-ului
  // pe alt canal inaintea STA poate bloca autentificarea la hotspot.
  WiFi.mode(WIFI_STA);
  WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
    if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
      Serial.printf("[punte] STA deconectat, motiv WiFi=%u\n",
                    info.wifi_sta_disconnected.reason);
    } else if (event == ARDUINO_EVENT_WIFI_STA_GOT_IP) {
      Serial.printf("[punte] STA CONECTAT: IP %s — WebSocket ws://%s:81\n",
                    WiFi.localIP().toString().c_str(),
                    WiFi.localIP().toString().c_str());
    }
  });
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
  WiFi.setMinSecurity(WIFI_AUTH_OPEN);
  WiFi.setAutoReconnect(true);

  connectSta();
  const uint32_t staStartedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - staStartedAt < 15000) {
    delay(250);
  }
  const bool staConnected = WiFi.status() == WL_CONNECTED;
  bool apStarted = false;
  if (!staConnected) {
    WiFi.mode(WIFI_AP_STA);
    apStarted = WiFi.softAP(AP_SSID, AP_PASS, AP_CHANNEL, false, 4);
  }

  ws.begin();
  ws.onEvent(onWsEvent);

  delay(300);
  if (apStarted) {
    Serial.printf(
        "[punte] AP PORNIT: '%s', parola '%s', canal %d, MAC %s — WebSocket "
        "ws://%s:81\n",
        AP_SSID, AP_PASS, AP_CHANNEL, WiFi.softAPmacAddress().c_str(),
        WiFi.softAPIP().toString().c_str());
  } else {
    Serial.println("[punte] AP fallback inactiv (STA conectat)");
  }
  Serial.printf("[punte] STA %s: '%s', IP %s\n",
                staConnected ? "CONECTAT" : "NECONECTAT", STA_SSID,
                WiFi.localIP().toString().c_str());
}

void loop() {
  ws.loop();

  if (WiFi.status() != WL_CONNECTED && millis() - lastStaRetryMs >= 10000) {
    lastStaRetryMs = millis();
    Serial.printf("[punte] reincerc STA '%s'...\n", STA_SSID);
    WiFi.softAPdisconnect(true);
    WiFi.disconnect(false, false);
    WiFi.mode(WIFI_STA);
    delay(100);
    connectSta();
  }

  // robot -> aplicatie (linie cu linie) + USB
  while (Serial1.available() > 0) {
    char c = static_cast<char>(Serial1.read());
    if (c == '\n' || c == '\r') {
      flushLine();
    } else if (lineLen < sizeof(lineBuf) - 1) {
      lineBuf[lineLen++] = c;
    } else {
      flushLine();  // linie prea lunga: trimite ce avem
    }
  }

  // laptop (USB) -> robot, pentru debug fara telefon
  while (Serial.available() > 0) {
    Serial1.write(Serial.read());
  }
}
