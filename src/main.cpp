// ==========================================
// Proiect:  ESP32-C3 WiFi Web Server
// Descriere: Conectare la retea Wi-Fi locala, server HTTP cu
//            control LED integrat si senzor de temperatura simulat.
// Autor:    Thecon
// Data:     2026
// ==========================================
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include "wifi_config.h"

// ==========================================
// CONFIGURARE WI-FI (din wifi_config.h)
// ==========================================
const char* ssid     = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// ==========================================
// CONFIGURARE HARDWARE
// Majoritatea plăcuțelor ESP32-C3 au LED-ul pe pinul 8 sau 10.
// Modifică dacă plăcuța ta are LED-ul pe alt pin.
// ==========================================
#define LED_PIN 8

// ==========================================
// CONFIGURARE IP STATIC
// ==========================================
IPAddress staticIP(172, 27, 53, 100);   // IP fix al placutei (mereu acelasi)
IPAddress gateway(172, 27, 53, 209);    // IP-ul telefonului (gateway hotspot)
IPAddress subnet(255, 255, 255, 0);     // Masca de retea standard

// Inițializăm serverul web pe portul standard 80
WebServer server(80);

// Stările virtuale pentru testare
bool virtualLedState = false;

// Funcție pentru generarea datelor simulate ale senzorului
float obtineTemperaturaSimulata() {
  // Returnează o valoare între 21.0 și 24.0 grade Celsius
  return 21.0f + (analogRead(A0) % 30) / 10.0f;
}
unsigned short int abc = 0;
// Handler pentru ruta GET /status
void handleStatus() {
  Serial.println("[SERVER] Cerere primita pe: /status");
  abc++; // Incrementam contorul cu 1 la fiecare cerere
  float temp = obtineTemperaturaSimulata();
  
  // Construim un răspuns în format JSON
  String jsonResponse = "{";
  jsonResponse += "\"status\":\"online\",";
  jsonResponse += "\"led_virtual\":" + String(virtualLedState ? "true" : "false") + ",";
  jsonResponse += "\"temperatura_simulata\":" + String(temp, 1) + ",";
  jsonResponse += "\"nr_initJSON\":" + String(abc);
  jsonResponse += "}";
  
  // Adăugăm headere CORS pentru a permite accesul din orice aplicație de mobil/web
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", jsonResponse);
}

// Handler pentru ruta GET /led/toggle
void handleLedToggle() {
  Serial.println("[SERVER] Cerere primita pe: /led/toggle");
  
  // Schimbăm starea LED-ului virtual
  virtualLedState = !virtualLedState;
  
  // Actualizăm și starea pinului fizic
  digitalWrite(LED_PIN, virtualLedState ? LOW : HIGH); // Logica inversata: LOW = aprins, HIGH = stins
  
  Serial.print("[HARDWARE] Stare LED fizic/virtual schimbata in: ");
  Serial.println(virtualLedState ? "PORNIT (HIGH)" : "OPRIT (LOW)");
  
  // Construim răspunsul JSON
  String jsonResponse = "{";
  jsonResponse += "\"status\":\"success\",";
  jsonResponse += "\"led_virtual\":" + String(virtualLedState ? "true" : "false");
  jsonResponse += "}";
  
  // Adăugăm headere CORS
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", jsonResponse);
}

// Handler pentru cereri inexistente (404)
void handleNotFound() {
  Serial.print("[SERVER] Eroare 404. Ruta inexistenta apelata: ");
  Serial.println(server.uri());
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(404, "text/plain", "Eroare 404 - Ruta nu exista pe ESP32-C3");
}

void setup() {
  // Pornim comunicarea serială pentru debug
  Serial.begin(115200);
  delay(1000); // Așteptăm inițializarea portului serial
  
  Serial.println("\n==========================================");
  Serial.println("ESP32-C3 Server Pornit");
  Serial.println("==========================================");
  
  // Configuram pinul LED-ului ca iesire
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // Începe stins (logica inversata: HIGH = stins pe ESP32-C3)
  
  // Configuram explicit modul Station (client) si deconectam conexiunile anterioare
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  
  // SCANARE REȚELE (Diagnostic)
  Serial.println("[WIFI] Pornire scanare retele Wi-Fi disponibile...");
  int n = WiFi.scanNetworks();
  Serial.println("[WIFI] Scanare finalizata.");
  if (n == 0) {
    Serial.println("[WIFI] ATENTIE: Nu s-a gasit nicio retea Wi-Fi in zona!");
  } else {
    Serial.printf("[WIFI] S-au gasit %d retele:\n", n);
    for (int i = 0; i < n; ++i) {
      Serial.printf("  - %s (Semnal: %d dBm)\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i));
      delay(10);
    }
  }
  Serial.println("------------------------------------------");
  
  // Începem conexiunea la rețeaua Wi-Fi
  Serial.print("[WIFI] Se conecteaza la rețeaua: ");
  Serial.println(ssid);
  
  // Aplicam configuratia de IP static inainte de conectare
  WiFi.config(staticIP, gateway, subnet);
  WiFi.begin(ssid, password);
  
  // Așteptăm să se conecteze (afișăm puncte în Serial Monitor) - mărim timpul la 30 de secunde (60 încercări)
  int incercari = 0;
  while (WiFi.status() != WL_CONNECTED && incercari < 60) {
    delay(500);
    Serial.print(".");
    incercari++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Conectat cu succes!");
    Serial.print("[WIFI] Adresa IP locala: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WIFI] Timeout! Verifica daca s-a conectat totusi in fundal.");
    Serial.print("[WIFI] Status curent: ");
    Serial.println(WiFi.status()); // Printează statusul (3 = WL_CONNECTED)
    Serial.print("[WIFI] IP actual (daca exista): ");
    Serial.println(WiFi.localIP());
  }
  
  // Configurăm rutele serverului web
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/led/toggle", HTTP_GET, handleLedToggle);
  server.onNotFound(handleNotFound);
  
  // Pornim serverul
  server.begin();
  Serial.println("[SERVER] Serverul HTTP a pornit pe portul 80");
  
  // Pornim mDNS - placuta va fi accesibila si la adresa: http://esp32.local
  if (MDNS.begin("esp32")) {
    Serial.println("[mDNS] Activ! Acceseaza: http://esp32.local");
  } else {
    Serial.println("[mDNS] Eroare la pornirea mDNS.");
  }
}

void loop() {
  // Gestionează cererile clienților în mod continuu
  server.handleClient();
  delay(2); // Mică întârziere pentru a nu bloca CPU-ul plăcuței
}
