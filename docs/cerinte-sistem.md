# RUDI — Cerințe de sistem, aplicație și firmware

Document de referință pentru echipă. Descrie arhitectura completă a robotului
de livrat documente **RUDI**, ce trebuie să facă fiecare componentă și, în
special, **ce are de construit echipa de aplicație/backend**. Firmware-ul pe
microcontrollere e scris separat (vezi secțiunea „Responsabilități firmware").

> Status: specificație de lucru, iulie 2026. Se completează pe măsură ce
> validăm pe banc. Deciziile deschise sunt marcate cu ❓.

---

## 1. Ce este RUDI

Robot pe **șenile** (tip tanc) care duce documente de la un expeditor la un
destinatar într-un birou. Fluxul: cineva cheamă robotul din aplicație, pune
documentul, alege destinatarul; robotul merge singur pe un traseu **învățat în
prealabil**, evită obstacolele pe drum, ajunge la destinatar, anunță pe LCD-ul
din spate că a sosit și așteaptă **confirmarea preluării din aplicație**.

Principii cheie:
- Traseele se **învață prin demonstrație** (operatorul conduce robotul o dată),
  nu se programează în cod.
- Destinatari și trasee noi se adaugă **fără a rescrie cod** (self-service).
- Robotul funcționează **autonom în timpul misiunii** — nu depinde de o
  conexiune live cu telefonul.

---

## 2. Arhitectura pe 3 niveluri

Separăm strict trei preocupări care nu trebuie amestecate:

```
Telefon (aplicație)  ──WiFi/WebSocket──  ESP8266 (punte)  ──UART──  STM32F103 (creier)  ──UART──  STM32F769-DISCO (display)
   UI, autoring,                          modem WiFi                 control real-time,             ecran de status
   bibliotecă rute,                       transparent                senzori, motoare,              (montat pe spatele
   notificări                                                        odometrie, rute (SD)            robotului)
```

| Nivel | Unde | Responsabilitate |
|---|---|---|
| **Control real-time** | STM32F103 | motoare, senzori, evitare, oprire de urgență, teach/replay, stocare rute pe SD. Determinist, pe robot. |
| **Rute ca DATE** | card SD pe F103 | fiecare rută = fișier. Rută nouă = fișier nou la runtime → niciodată reflash. |
| **UI + bibliotecă + notificări** | telefon + backend | butoane, teach/route/demo, meniu rute, DB destinatari, notificări „cere ajutor". Nu în calea critică. |

**De ce F103 e creierul, nu Disco:** placa cu LCD (Disco) nu are destui pini
liberi pentru toți senzorii; F103VC (100 pini) are. Disco rămâne un **display
inteligent**, alimentat cu starea prin UART de la F103.

---

## 3. Hardware și dispunerea senzorilor

| Componentă | Cantitate | Rol | Conectat la |
|---|---|---|---|
| STM32F103VCT6 | 1 | creierul robotului | — |
| STM32F769I-DISCO | 1 | display de status (spatele robotului) | UART ↔ F103 |
| ESP8266 | 1 | punte WiFi ↔ UART | UART ↔ F103 |
| Motoare JGA25-370 (șenile) | 2 | tracțiune | driver DIR/PWM → F103 |
| Driver dublu punte H (DIR+PWM) | 1 | comandă motoare | F103 |
| **HC-SR04** | **6** | evitare obstacole — **2 față, 2 stânga, 2 dreapta** | F103 |
| MPU6050 / GY-521 | 1 | giroscop (direcție/heading) | I2C → F103 |
| **TCRT5000** | **2** | encoder DIY (linii pe roată) — odometrie | F103, câte unul pe fiecare șenilă |
| RC522 + tag-uri | 1 | citire tag-uri de poziție de pe podea | SPI → F103 |
| Card microSD | 1 | biblioteca de rute (fișiere) | SPI/SDIO → F103 |

Note importante:
- **Inelul de ultrasonice** (2+2+2): permite găsirea direcției libere la ocolire
  și detecția „sunt blocat pe toate părțile" (→ cere ajutor). Fără senzor în
  spate — robotul nu merge normal cu spatele în misiune.
- **TCRT5000**: linii albe desenate pe roata motorului; senzorul numără trecerile
  = encoder. Câte unul pe fiecare parte = odometrie diferențială + detecție
  patinare. Rezoluția depinde de numărul de linii (mai multe = mai precis).
- **RFID**: tag-uri DOAR la **home/expeditor** și la **destinatari**, NU pe
  traseu. Se citesc cu cititorul cu fața spre podea. Confirmarea livrării NU se
  face cu cardul de către om — se face din aplicație.

---

## 4. Comunicație

### WiFi (ESP8266)
- ESP-ul ridică propriul Access Point: **SSID `RUDI-ROBOT`**, parolă `rudi1234`
  (nu depinde de niciun router).
- Verificare stare: `http://192.168.4.1/health`
- Canal de comenzi/telemetrie: **WebSocket `ws://192.168.4.1:81`**
- Protocolul e **text, linie cu linie** (nu JSON pe legătura cu robotul).

### UART (intern)
- ESP8266 ↔ F103: 115200 8N1, bidirecțional (puntea WiFi).
- F103 ↔ Disco: 115200 8N1, bidirecțional (F103 trimite starea; Disco trimite
  apăsările de pe butoanele touch STOP/ACASA).

---

## 5. Protocolul de comenzi și telemetrie (draft)

Aplicația trimite **comenzi text**, robotul răspunde cu **linii text**. Acesta
e contractul pe care se sincronizează echipa de app cu firmware-ul. Se poate
extinde; se versionează aici.

### Comenzi telefon → robot
| Comandă | Efect |
|---|---|
| `FWD` / `BACK` / `LEFT` / `RIGHT` | control manual (telecomandă) |
| `STOP` sau `X` | **oprire de urgență** (oricând) |
| `HOME` | întoarcere la stația de bază |
| `TEACH <nume>` | pornește înregistrarea unui traseu nou |
| `TEACH_END` | termină și salvează traseul |
| `DEMO` | mod demonstrație (arată comportamentul, incl. la obstacole) |
| `RUN <nume>` | rulează un traseu salvat |
| `ROUTES` | listează traseele de pe SD |
| `CONFIRM` | confirmă preluarea documentului (încheie livrarea) |
| `S` | cere o citire de status |

### Telemetrie robot → aplicație (linii, ~2-10 Hz)
Exemple de linii pe care aplicația trebuie să le parseze după prefix:
```
STATE=MISSION            # starea curentă (vezi lista de stări)
DIST=F:32,45 L:80,120 R:15,90   # cele 6 ultrasonice grupate (cm)
HEAD=+87.5               # heading giroscop (grade)
ODO=1240                 # distanță parcursă (mm) de la ultimul reper
TAG=E9EAF006             # tag RFID citit
BATT=87                  # baterie (%)
OBSTACLE                 # eveniment: obstacol detectat
BLOCKED                  # eveniment: blocat pe toate părțile → cere ajutor
ARRIVED                  # a ajuns la destinație
DELIVERED                # livrare confirmată
```

Stări posibile (`STATE=`): `IDLE`, `MISSION`, `OBSTACLE`, `AVOID`, `ARRIVED`,
`WAIT_CONFIRM`, `ESTOP`, `GOING_HOME`, `TEACH`, `BLOCKED`.

---

## 6. Cerințe pentru aplicația de telefon

Tehnologie recomandată: **Expo / React Native** (WebSocket standard, merge în
Expo Go fără module native). Se conectează la `ws://192.168.4.1:81`.

### 6.1 Ecranul de control (telecomandă)
- Butoane direcționale: înainte / înapoi / stânga / dreapta (apăsat = mișcă,
  eliberat = stop), plus buton mare **STOP de urgență** mereu vizibil.
- Telemetrie live: starea robotului, cele 6 distanțe (ideal o mică diagramă cu
  robotul și senzorii), heading, baterie, semnal.

### 6.2 Învățare (teach) și demonstrație
- Buton **„Învață traseu"**: pornește `TEACH <nume>`, operatorul conduce robotul
  cu telecomanda din home până la destinatar; la final `TEACH_END` salvează.
- Buton **„Demonstrație"**: mod în care arăți comportamentul (inclusiv cum să
  reacționeze la obstacole). Aceeași infrastructură de înregistrare, alt scop.
- În timpul teach: senzorii sunt citiți 100% din timp; aplicația poate arăta un
  jurnal live al mișcărilor.

### 6.3 Trasee și rute alternative
- **Meniu „Trasee"**: lista traseelor salvate (de pe SD, via `ROUTES`).
- **Rute alternative**: pentru aceeași destinație pot exista mai multe trasee
  (A, B). Dacă drumul principal e blocat total, robotul revine la home și ia
  alternativa. Aplicația trebuie să permită asocierea mai multor trasee la un
  destinatar și marcarea unuia ca principal.
- ❓ Ramificare la mijloc de traseu: posibilă doar dacă se pune un tag RFID în
  punctul de decizie (altfel robotul nu știe unde e). Deocamdată: alternativă
  „de la home".

### 6.4 Livrare
- La `ARRIVED`, robotul afișează pe LCD „am ajuns" și trece în `WAIT_CONFIRM`.
- Destinatarul **confirmă preluarea din aplicație** (buton) → `CONFIRM` →
  robotul se întoarce acasă. Robotul rămâne oprit până la confirmare.

### 6.5 „Robotul are nevoie de ajutor"
- Când robotul e blocat (toate direcțiile obturate) trimite `BLOCKED`.
- Aplicația **utilizatorului/destinatarului** (nu cea de antrenare) primește
  automat o **notificare**: „Robotul are nevoie de ajutor!" + ultima poziție/
  stație cunoscută.
- Pas viitor: robotul detectează singur blocajul (fără buton) și cere ajutor.

### 6.6 Self-service destinatari (increase capacity, fără cod)
- Onboarding destinatar nou 100% din aplicație: se lipește un tag RFID nou la
  stația lui, se înregistrează în aplicație (nume, birou) → devine automat o
  destinație validă.
- Traseu nou spre el = o demonstrație scurtă cu telecomanda. **Zero modificări
  de firmware sau cod** la fiecare destinatar adăugat.

---

## 7. Cerințe pentru backend (opțional dar recomandat)

Tehnologie: **FastAPI** (există deja schelet în `rudi-backend`). NU în calea
real-time a misiunii. Rol:
- **Bibliotecă de rute** partajată între telefoane (sincronizare).
- **Bază de date destinatari** (nume, birou, tag RFID, trasee asociate).
- **Notificări „cere ajutor"** către aplicația destinatarului corect.
- Suport multi-utilizator.

---

## 8. Comportamentul de teach / replay (pentru aliniere)

- O rută = **traseu nominal învățat** (profil de direcție + distanță) de la
  tagul de home la tagul de destinatar. Fără tag-uri intermediare.
- **Evitarea obstacolelor NU se rejoacă** din înregistrare (obstacolele se
  mișcă). Evitarea e un **strat reactiv live** cu cele 6 ultrasonice, care
  rulează peste traseul nominal: vede obstacol → ocolește pe unde e liber →
  revine pe traseu. Din demonstrații se poate învăța doar *stilul* de ocolire.
- **Re-localizare**: doar la capete (tag-uri). Între ele, socoteală moartă
  (giroscop pentru direcție + TCRT5000 pentru distanță). Ține traseele simple;
  direcția (giroscopul) e cel mai important factor.
- **Rută alternativă**: al doilea traseu home→dest, folosit ca fallback la
  blocaj total (robotul revine la home, apoi ia alternativa).

---

## 9. Modelul de date — fișier de rută pe SD

Fiecare traseu = un fișier JSON pe cardul SD al F103. Exemplu:

```json
{
  "name": "Birou Darius",
  "recipient": "Darius",
  "home_tag": "BASE",
  "dest_tag": "E9EAF006",
  "primary": true,
  "trajectory": [
    { "t_ms": 0,    "head": 0,   "odo_mm": 0 },
    { "t_ms": 500,  "head": 0,   "odo_mm": 210 },
    { "t_ms": 1000, "head": 45,  "odo_mm": 420 }
  ]
}
```

- Teach-ul umple `trajectory` automat pe măsură ce operatorul conduce.
- Rute alternative = fișiere separate cu același `dest_tag`, `primary: false`.
- Destinatar nou = tag nou → fișier nou. Fără cod.

Formatul se poate simplifica/optimiza; important e că e **date pe SD**, nu cod.

---

## 10. Fluxul complet al unei livrări

1. Expeditor: cheamă robotul, pune documentul, alege destinatarul în aplicație.
2. Robotul pornește pe traseul învățat (LCD: „ÎN MISIUNE").
3. Pe drum, dacă apare un obstacol → oprește, caută pe unde e liber cu inelul
   ultrasonic, ocolește, revine pe traseu (LCD: „OBSTACOL"/„OCOLESC").
4. Dacă drumul e complet blocat → revine la home și încearcă ruta alternativă;
   dacă e închis în cutie → `BLOCKED` + notificare „cere ajutor".
5. Ajunge la destinatar (citește tagul) → LCD „AM AJUNS", `WAIT_CONFIRM`.
6. Destinatarul ia documentul și **confirmă din aplicație** → robotul se
   întoarce acasă.
7. `STOP` din aplicație sau de pe touch-ul LCD oprește totul, oricând.

---

## 11. Responsabilități firmware (se scriu separat)

Pentru context — echipa de app nu scrie astea, dar e util să le știe.

- **STM32F103 (creier):** buclă de control motoare + citire 6 HC-SR04 (tragere
  pe grupuri de senzori opuși, anti cross-talk) + odometrie TCRT5000 + heading
  giroscop + RFID + FatFS pe SD + mașina de stări teach/replay + protocol UART
  cu ESP și Disco.
- **STM32F769-DISCO (display):** interfață TouchGFX (deja prototipată — radar
  animat, stări colorate, butoane STOP/ACASA, baterie, semnal); primește starea
  prin UART, trimite apăsările de buton.
- **ESP8266 (punte):** AP WiFi + WebSocket ↔ UART, transparent, cu `/health`.

---

## 12. Decizii deschise ❓

- Alimentare (baterie + BMS + regulatoare) — de decis după validarea logicii.
- SD pe F103: SPI (simplu) sau SDIO (rapid)? Probabil SPI pe SPI2.
- Număr de linii pe roata TCRT5000 (rezoluția odometriei).
- Ramificare la mijloc de traseu (necesită tag în punctul de decizie).
- Backend obligatoriu sau opțional pentru MVP.
