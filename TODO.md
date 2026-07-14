# 🤖 RUDI (Robotic Utility Document Interface) - Project Board

Bun venit în workspace-ul proiectului RUDI! Acest document servește drept ghid de dezvoltare și urmărire a task-urilor.

## 📅 Backlog & Task Tracker

### #1. MCU & APP
*Interfața cu utilizatorul și creierul de comunicație al robotului.*

- [ ] **Arhitectură & Protocol de Comunicare**
  - [ ] Stabilirea protocolului de comunicare (Wi-Fi direct prin ESP32/ESP8266 conectat la STM32).
  - [ ] Definirea structurii de date trimise (ex: `{"target_employee": "Darius", "status": "call"}`).
- [ ] **Dezvoltare Aplicație Mobilă**
  - [ ] Schițarea UI-ului (Ecran principal: Chemare robot, Selectare destinatar, Status robot).
  - [ ] Implementarea logicii de trimitere a comenzilor către server/robot.
  - [ ] Crearea unei baze de date simple cu angajații și "stațiile" (locațiile) lor.
- [ ] **Integrare MCU de comunicație**
  - [ ] Programare modul Wi-Fi (ESP) pentru a recepționa comenzile din aplicație.
  - [ ] Configurare transmisie UART/I2C între modulul Wi-Fi și STM32.

---

### #2. 3D DESIGN
*Corpul fizic al lui RUDI, sistemul de rulare și suportul de documente.*

- [ ] **Cercetare și Dimensionare**
  - [ ] Măsurarea componentelor electronice (STM32, motoare, baterii, senzori) pentru a le face loc în carcasă.
  - [ ] Proiectarea sistemului de șenile (roți dințate, ghidaje, tensiune șenilă).
- [ ] **Proiectare CAD (3D)**
  - [ ] Design șasiu robust pentru a susține greutatea componentelor și a documentelor.
  - [ ] Design suport/compartiment dedicat pentru documente (ex: un slot securizat sau o tăviță).
  - [ ] Design suporturi pentru senzori (senzori ultrasunete).
- [ ] **Prototipare Fizică**
  - [ ] Printarea 3D a primelor piese de test (toleranțe pentru motoare și rulmenți).
  - [ ] Asamblarea mecanică preliminară și testarea mecanică a șenilelor la rotație liberă.

---

### #3. STM32, LOGICA, MOTOARE
*Logica de mișcare, navigare și controlul fizic al motoarelor.*

- [ ] **Configurare inițială STM32**
  - [ ] Configurare pini în STM32CubeMX (GPIO, PWM pentru motoare, USART pentru debugging/comunicație, ADC pentru senzori).
- [ ] **Control Motoare & Drivere**
  - [ ] Integrare driver motoare (ex: L298N, TB6612FNG) cu STM32.
  - [ ] Scrierea funcțiilor de bază: `mergi_inainte()`, `oprire()`, `intoarce_stanga()`, `intoarce_dreapta()`.
  - [ ] Controlul vitezei prin semnal PWM.
- [ ] **Algoritm de Navigare (Logică)**
  - [ ] Citire date de la senzori (ex: senzori ultrasonici pentru evitarea obstacolelor).
  - [ ] Implementare algoritm de control PID pentru menținerea direcției/urmărirea liniei.
  - [ ] Implementare logică de "stație" (cum știe robotul că a ajuns la Cristi sau la Robert și când să plece înapoi).

---

### #4. HARD, DEBUG, ALIMENTARE & INTEGRARE
*Sistemul energetic, conectica securizată și asamblarea finală.*

- [ ] **Power Management (Alimentare)**
  - [ ] Alegerea acumulatorilor și a unui modul BMS (Battery Management System) adecvat.
  - [ ] Proiectarea circuitului de reglare a tensiunii (ex: 5V pentru senzori/ESP, 3.3V pentru STM32, 7.4V/12V pentru motoare).
- [ ] **Schemă Electronică & Cablare**
  - [ ] Realizarea schemei de conexiuni.
  - [ ] Lipirea cablurilor și realizarea conectorilor rapizi pentru a evita deconectările în timpul mersului.
- [ ] **Debug & Teste Unitare**
  - [ ] Verificarea tensiunilor de alimentare înainte de a conecta STM32-ul (prevenirea scurtcircuitelor).
  - [ ] Testarea individuală a componentelor hardware (motoare sub sarcină, consum curent).
- [ ] **Integrare Finală**
  - [ ] Montarea electronicii în șasiul printat 3D.
  - [ ] Test de calibrare generală (Aplicație -> Wi-Fi -> STM32 -> Motoare/Senzori).
  - [ ] Test complet de livrare a unui document din punctul A în punctul B.