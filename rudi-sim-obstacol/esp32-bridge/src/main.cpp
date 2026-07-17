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
// Varianta STA (aceeasi retea cu telefonul): decomenteaza si completeaza,
// apoi foloseste IP-ul afisat pe USB la pornire.
// constexpr char STA_SSID[] = "...";
// constexpr char STA_PASS[] = "...";

constexpr int LINK_TX_PIN = 4;
constexpr int LINK_RX_PIN = 5;
constexpr uint32_t LINK_BAUD = 115200;

WebSocketsServer ws(81);
char lineBuf[220];
size_t lineLen = 0;

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

}  // namespace

void setup() {
  Serial.begin(115200);  // USB CDC (debug / varianta laptop)
  Serial1.begin(LINK_BAUD, SERIAL_8N1, LINK_RX_PIN, LINK_TX_PIN);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);

  ws.begin();
  ws.onEvent(onWsEvent);

  delay(300);
  Serial.printf("[punte] AP '%s' parola '%s' — WebSocket ws://%s:81\n",
                AP_SSID, AP_PASS, WiFi.softAPIP().toString().c_str());
}

void loop() {
  ws.loop();

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
