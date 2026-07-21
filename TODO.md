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

---

### #5. ÎNVĂȚARE, TELECOMANDĂ & SCALARE DESTINATARI
*Robotul învață traseele de la operator, iar destinatarii se administrează singuri, fără cod nou.*

- [ ] **Aplicație tip telecomandă pe telefon (modul de antrenare)**
  - [ ] Control manual al robotului (înainte/înapoi/viraje/stop) prin WebSocket, cu telemetrie live pe ecran (distanță HC-SR04, giroscop, stare motoare).
  - [ ] Înregistrarea continuă a sesiunilor de pilotare: comenzile operatorului + citirile senzorilor, sincronizate pe timp (jurnal pe episod).
- [ ] **Reprezentarea traseelor pe grafuri**
  - [ ] Model de date: nodurile = stații/tag-uri RFID (birouri, puncte de predare), muchiile = segmente de traseu cu metadate (durată, viraje, praguri, zone cu risc de obstacole).
  - [ ] Persistarea grafului în backend; robotul primește o rută ca listă de muchii de parcurs.
- [ ] **Mod exemplu — învățare prin demonstrație**
  - [ ] Operatorul duce robotul din A în B cu telecomanda, punând intenționat obstacole pe drum; senzorii sunt citiți constant, ca sistemul să vadă exact cum se evită fiecare obstacol.
  - [ ] Salvarea demonstrațiilor ca episoade etichetate (traseu, momente de obstacol, manevre de evitare) — baza de învățare pentru evitarea autonomă.
- [ ] **Scenariul "robot blocat" + buton "Cere ajutor"**
  - [ ] În modul exemplu: robotul e înconjurat de obstacole fără ieșire; operatorul apasă "Cere ajutor" în aplicația de antrenare.
  - [ ] La apăsare, robotul trimite automat notificare în aplicația UTILIZATORULUI (cea de livrare, NU cea de antrenare): "Robotul are nevoie de ajutor!" + ultima stație/poziție cunoscută.
  - [ ] Pas următor: detectare automată a blocajului (toate direcțiile obturate mai mult de N secunde) → robotul cere ajutor singur, fără buton.
- [ ] **Self-service destinatari (increase capacity, fără cod nou)**
  - [ ] Onboarding destinatar nou 100% din aplicație: se lipește un tag RFID nou la stația lui + se înregistrează în aplicație (nume, birou) → apare automat ca nod nou în graf.
  - [ ] Traseu nou configurabil oricând: destinatarul/administratorul leagă stația nouă de graful existent printr-o demonstrație scurtă cu telecomanda — zero modificări de firmware sau de cod la fiecare destinatar adăugat.