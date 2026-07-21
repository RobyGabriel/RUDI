#include <Arduino.h>
#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <WebSocketsServer.h>

// Punte RUDI pentru ESP8266MOD:
//   WiFi/WebSocket <-> UART0 <-> STM32F769I-DISCO
//
// Cablaj:
//   ESP TX / GPIO1 -> STM32 D0 / PC7 / USART6_RX
//   ESP RX / GPIO3 <- STM32 D1 / PC6 / USART6_TX
//   ESP GND        -> STM32 GND
//
// UART0 este comun cu adaptorul USB-serial al placii ESP8266. Dupa flash,
// pentru un test UART fara contentie, ESP-ul trebuie alimentat fara ca
// adaptorul USB-serial sa ramana activ pe RX/TX.

namespace {

constexpr char AP_SSID[] = "RUDI-ROBOT";
constexpr char AP_PASS[] = "rudi1234";
constexpr uint32_t LINK_BAUD = 115200;

WebSocketsServer ws(81);
ESP8266WebServer http(80);

char lineBuf[256];
size_t lineLen = 0;

void onWsEvent(uint8_t client, WStype_t type, uint8_t *payload, size_t len) {
  switch (type) {
    case WStype_CONNECTED:
      ws.sendTXT(client,
                 "[punte8266] conectat — comenzi: DEMO|GO|MOT|S|X");
      break;

    case WStype_TEXT:
      Serial.write(payload, len);
      if (len == 0 || payload[len - 1] != '\n') {
        Serial.write('\n');
      }
      Serial.flush();
      break;

    default:
      break;
  }
}

void flushRobotLine() {
  if (lineLen == 0) {
    return;
  }

  lineBuf[lineLen] = '\0';
  ws.broadcastTXT(lineBuf, lineLen);
  lineLen = 0;
}

}  // namespace

void setup() {
  // UART0 foloseste pinii fizici TX=GPIO1 si RX=GPIO3.
  Serial.begin(LINK_BAUD);
  Serial.setRxBufferSize(512);

  WiFi.persistent(false);
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(250);
  WiFi.mode(WIFI_AP);
  WiFi.setOutputPower(20.5f);
  WiFi.softAP(AP_SSID, AP_PASS, 6, false, 4);

  ws.begin();
  ws.onEvent(onWsEvent);

  http.on("/", []() {
    http.send(200, "text/plain",
              "RUDI ESP8266 bridge OK; WebSocket ws://192.168.4.1:81");
  });
  http.on("/health", []() {
    http.send(200, "application/json",
              "{\"ok\":true,\"bridge\":\"esp8266-uart\","
              "\"websocket\":\"ws://192.168.4.1:81\"}");
  });
  http.begin();
}

void loop() {
  ws.loop();
  http.handleClient();

  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\r' || c == '\n') {
      flushRobotLine();
    } else if (lineLen < sizeof(lineBuf) - 1) {
      lineBuf[lineLen++] = c;
    } else {
      flushRobotLine();
    }
  }

  yield();
}
