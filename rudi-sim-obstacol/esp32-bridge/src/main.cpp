#include <Arduino.h>

// Punte transparenta USB <-> STM32F769I-DISCO pentru RUDI.
//
// PC/aplicatia colegului <--USB CDC--> ESP32-C3 <--UART1--> STM32 (USART6)
//   ESP GPIO4 (TX) -> STM32 D0 (PC7, USART6_RX)
//   ESP GPIO5 (RX) <- STM32 D1 (PC6, USART6_TX)
//   GND comun obligatoriu.
//
// Tot ce scrii in portul serial USB al ESP-ului ajunge la robot si invers.
// Comenzile robotului: DEMO | GO | MOT | S | X (text + Enter).

namespace {
constexpr int LINK_TX_PIN = 4;
constexpr int LINK_RX_PIN = 5;
constexpr uint32_t LINK_BAUD = 115200;
}  // namespace

void setup() {
  Serial.begin(115200);  // USB CDC catre PC
  Serial1.begin(LINK_BAUD, SERIAL_8N1, LINK_RX_PIN, LINK_TX_PIN);
  delay(500);
  Serial.println("[punte ESP32] gata — comenzi: DEMO | GO | MOT | S | X");
}

void loop() {
  while (Serial.available() > 0) {
    Serial1.write(Serial.read());
  }
  while (Serial1.available() > 0) {
    Serial.write(Serial1.read());
  }
}
