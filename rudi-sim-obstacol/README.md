# RUDI — simulare livrare cu evitare de obstacol

Demo complet pe banc pentru robotul RUDI (livrator de documente, șasiu tip
tanc cu șenile): robotul primește comanda de plecare, merge înainte, **tu pui
un obiect în fața senzorului ultrasonic**, robotul oprește, ocolește obstacolul
folosind giroscopul, ajunge la "destinație" și așteaptă **scanarea unui tag
RFID** drept confirmare de livrare.

Robotul nu trebuie să fie încă montat pe șenile. Pentru demonstrația actuală,
se ține pe un suport, cu roțile/motoarele libere, iar motoarele mimează mersul
și evitarea.

> **Notă pentru asistenți AI (Claude etc.):** tot ce e nevoie e în acest folder.
> Pașii de build sunt în `stm32/build.ps1` (auto-detectează toolchain-ul) și în
> secțiunea ESP32 de mai jos. Porturile seriale se află cu
> `[System.IO.Ports.SerialPort]::GetPortNames()` (PowerShell) sau `pio device list`.
> Protocolul serial e text simplu la 115200 — poți pilota și valida întregul
> demo citind/scriind pe portul serial, fără unelte speciale.

## Arhitectură

```
Telefon cu aplicația Expo ──WiFi/WebSocket──╮
PC (debug)             ────USB────────────── ESP32-C3 ──UART── STM32F769I-DISCO
                                             (punte)            │ driver motoare → 2 motoare DC
                                                                │ HC-SR04 (obstacole)
                                                                │ MPU6050 (viraje precise)
                                                                └ RC522 (confirmare livrare)
```

STM32-ul face toată treaba (motoare, senzori, misiune). ESP32-ul e puntea:
ridică propria rețea WiFi și expune un **WebSocket** — exact ce știe să
folosească o aplicație Expo/React Native fără niciun modul nativ, direct din
Expo Go. Același protocol e disponibil și pe USB-ul ESP-ului (debug de pe
laptop) și direct pe consola ST-Link a plăcii STM32 (al doilea port COM).

## Integrare cu aplicația Expo (React Native)

1. Telefonul se conectează la rețeaua WiFi a robotului:
   SSID **`RUDI-ROBOT`**, parola **`rudi1234`** (ESP-ul e Access Point,
   nu are nevoie de niciun router).
2. În aplicație, un singur obiect `WebSocket` (API standard, merge în Expo Go):

```js
const ws = new WebSocket('ws://192.168.4.1:81');

ws.onopen    = () => console.log('conectat la RUDI');
ws.onmessage = (e) => {
  // fiecare mesaj = o linie de la robot, ex.:
  // "OBSTACOL la 18.3 cm — STOP!" sau "=== LIVRARE CONFIRMATA — UID=... ==="
  console.log(e.data);
};

ws.send('DEMO');  // comenzi: DEMO | GO | MOT | S | X
```

3. Recomandări pentru aplicație: afișează liniile primite ca jurnal al
   misiunii; butoane pentru `DEMO`/`GO` și un buton mare roșu care trimite
   `X`; reconectare automată la `onclose` (dacă robotul se restartează).
   Evenimentele cheie se pot detecta simplu după prefix:
   `OBSTACOL`, `=== AM AJUNS`, `=== LIVRARE CONFIRMATA`, `STOP DE URGENTA`.

### Conectare la ESP fără să desfaci cablajul

ESP32-C3 rămâne legat la STM32 prin GPIO4/GPIO5 și GND pe toată durata
testului. USB-ul poate rămâne conectat pentru alimentare și loguri; comenzile
de operare se trimit separat, prin Wi-Fi.

Pe laptopul colegului:

1. Conectează Wi-Fi-ul la **`RUDI-ROBOT`**, parola **`rudi1234`**.
2. Acceptă mesajul sistemului că rețeaua nu are internet.
3. Deschide Chrome/Edge, apoi DevTools (`F12`) și fila Console.
4. Rulează:

```js
const rudi = new WebSocket('ws://192.168.4.1:81');
rudi.onopen = () => console.log('RUDI conectat');
rudi.onmessage = ({ data }) => console.log('[RUDI]', data);
rudi.onclose = () => console.log('RUDI deconectat');
```

5. Verifică legătura fără să pornești motoarele:

```js
rudi.send('S');
```

6. Cu roțile ridicate, testul poate fi pornit cu:

```js
rudi.send('DEMO');
```

Oprirea de urgență este:

```js
rudi.send('X');
```

Aceasta este o conexiune directă la ESP, nu la backend. Nu folosi URL-ul ngrok
sau `EXPO_PUBLIC_WS_URL` pentru acest test direct.

> Dacă Claude trebuie să rămână online în timpul testului, laptopul are nevoie
> de o a doua cale către internet (de exemplu Ethernet sau un al doilea adaptor),
> deoarece Wi-Fi-ul principal este conectat la AP-ul ESP. Firmware-ul din acest
> branch pornește în prezent numai în mod Access Point. Comentariile despre STA
> din `main.cpp` nu implementează efectiv conectarea la router.

Controlul de mai sus nu cere deconectarea ESP-ului. În schimb, **actualizarea
firmware-ului prin Wi-Fi nu este încă implementată**: prima încărcare și orice
reflash folosesc momentan USB + PlatformIO.

### Atenție: aplicația și ESP-ul nu folosesc încă același protocol

În forma actuală:

- aplicația Expo se conectează la backend-ul FastAPI și trimite/primește JSON;
- ESP-ul expune alt WebSocket, la `ws://192.168.4.1:81`, și schimbă linii text
  precum `DEMO`, `S`, `OBSTACOL...`;
- serviciul `rudi-app/src/services/websocket.ts` execută `JSON.parse` pentru
  fiecare mesaj, deci nu poate fi conectat direct la ESP fără un adaptor;
- backend-ul retransmite mesaje între aplicații, dar nu este încă legat la ESP.

Pentru integrarea completă trebuie ales unul dintre cele două trasee:

1. aplicația păstrează WebSocket-ul către backend, iar backend-ul primește o
   punte suplimentară către ESP; sau
2. aplicația deschide un al doilea WebSocket direct către ESP și convertește
   evenimentele text în stările sale interne.

## Fluxul cerut pentru testul cu operator/Claude

Fluxul țintă descris pentru demonstrație este:

1. Operatorul/Claude pornește misiunea; motoarele mimează mersul înainte.
2. Claude îi cere colegului să pună un obiect în fața HC-SR04.
3. La detectarea obiectului, robotul oprește și mimează evitarea.
4. Claude îi cere colegului să ia obiectul; după eliberarea traseului, robotul
   revine pe direcția inițială și continuă.
5. La destinație, robotul se oprește, iar Claude cere apropierea cartelei RFID.
6. Citirea RFID confirmă identitatea/ajungerea, dar robotul trebuie să rămână
   oprit și să aștepte confirmarea că hârtia a fost luată.
7. Aplicația colegului trimite confirmarea de preluare; abia atunci testul se
   încheie.

### Ce face codul acum și ce mai lipsește

Codul STM32 actual implementează mersul, detectarea obstacolului, manevra
temporizată de ocolire, revenirea, oprirea la destinație și citirea RFID.
Totuși:

- după `OBSTACOL`, manevra pornește automat; nu există încă starea
  `WAIT_CLEAR` care să aștepte scoaterea obiectului;
- după citirea RFID, codul afișează imediat `LIVRARE CONFIRMATA` și încheie
  misiunea;
- nu există încă o comandă de confirmare a preluării hârtiei venită din
  aplicație.

Nu folosi o comandă goală (`""`) pentru confirmare. Puntea ESP adaugă doar un
newline, iar parserul STM32 ignoră liniile fără conținut, deci nu se poate
verifica sigur că o astfel de comandă a fost primită. Protocolul final ar
trebui să folosească mesaje explicite, de exemplu:

| Direcție | Mesaj propus | Rol |
|---|---|---|
| STM32 → aplicație | `OBSTACLE_DETECTED` | Claude cere scoaterea obiectului |
| aplicație → STM32 | `PATH_CLEAR` | operatorul confirmă traseul liber |
| STM32 → aplicație | `RFID_SCANNED UID=...` | cartela a fost citită |
| aplicație → STM32 | `PAPER_TAKEN` | destinatarul confirmă preluarea |
| STM32 → aplicație | `TEST_COMPLETE` | testul s-a încheiat |

Aceste comenzi sunt propunerea pentru pasul următor; firmware-ul din branch nu
le recunoaște încă.

## Hardware necesar

- STM32F769I-DISCO (se alimentează prin USB ST-LINK, conector CN15)
- ESP32-C3 SuperMini (USB-C propriu)
- Driver de motoare dual cu intrări DIR + PWM per canal (testat: BESTEP 2×punte H)
- 2 motoare DC cu perii, **fiecare cu condensator ceramic 100 nF ("104") lipit
  direct pe borne** — NU e opțional, vezi Troubleshooting
- HC-SR04 + divizor de tensiune pe ECHO (1 kΩ / 2 kΩ)
- GY-521 (MPU6050), RC522 + tag
- Sursă de banc pentru motoare (6–12 V după motoare)

## Cablaj

### Driver motoare → STM32 (header Arduino)
| Driver | Pin Arduino | Pin STM32 |
|---|---|---|
| PWM1 | D3 | PF6 (TIM10_CH1) |
| DIR1 | D4 | PJ0 |
| PWM2 | D6 | PF7 (TIM11_CH1) |
| DIR2 | D7 | PJ3 |
| +5V logică | 5V | — |
| GND | GND | — |

Puterea driverului (V+/GND) vine din sursa de banc; motoarele la ieșirile
M1/M2. GND-ul sursei, al driverului și al plăcii = masă comună.

### HC-SR04 (VCC la 5V din header)
| HC-SR04 | Pin Arduino | Pin STM32 | Notă |
|---|---|---|---|
| TRIG | D2 | PJ1 | |
| ECHO | D5 | PC8 | **prin divizor 1k/2k** (ECHO e 5 V!) |

#### Construirea traductorului HC-SR04 (divizorul pentru ECHO)

ECHO iese la ~5 V, iar pinul STM32 vrea 3,3 V — divizorul e obligatoriu și se
face din două rezistoare (1 kΩ și 2 kΩ), lipite sau pe breadboard:

```text
HC-SR04 ECHO ---- rezistor 1 kΩ ----+---- D5 (PC8)
                                    |
                                 rezistor 2 kΩ
                                    |
                                   GND
```

Pași:
1. Un capăt al rezistorului de 1 kΩ la pinul ECHO al senzorului.
2. Celălalt capăt al lui 1 kΩ se leagă împreună cu un capăt al lui 2 kΩ —
   acest nod comun merge la **D5**.
3. Capătul liber al lui 2 kΩ la **GND**.
4. Verificare cu multimetrul: nodul divizorului în repaus = **~0 V**; în timpul
   unei măsurători vârfurile ajung la ~3,3 V (prea scurte pentru multimetru,
   dar 0 V în repaus + citiri `DIST` valide confirmă montajul).

TRIG nu are nevoie de nimic — semnalul pleacă de la STM32 (3,3 V) și senzorul
îl acceptă direct.

### MPU6050 / GY-521 (VCC la 3V3, AD0 liber)
| GY-521 | Pin Arduino | Pin STM32 |
|---|---|---|
| SCL | D15 | PB8 |
| SDA | D14 | PB9 |

### RC522 (VCC STRICT 3V3, IRQ neconectat)
| RC522 | Pin Arduino | Pin STM32 |
|---|---|---|
| SCK | D13 | PA12 |
| MISO | D12 | PB14 |
| MOSI | D11 | PB15 |
| SDA/CS | D10 | PA11 |
| RST | D8 | PJ4 |

### ESP32-C3 ↔ STM32 (ambele 3,3 V, fire directe)
| ESP32-C3 | STM32 |
|---|---|
| GPIO4 (TX) | D0 (PC7, RX) |
| GPIO5 (RX) | D1 (PC6, TX) |
| GND | GND |

### ESP8266 ↔ STM32 (alternativa folosită de puntea din `esp8266-bridge/`)
| ESP8266 (NodeMCU) | STM32 |
|---|---|
| TX / GPIO1 | D0 (PC7, RX) |
| RX / GPIO3 | D1 (PC6, TX) |
| GND | GND |

Note pentru ESP8266: GPIO1/GPIO3 sunt și UART-ul lui de programare — la flash
prin USB se scot firele spre STM32, iar în timpul testului nu ține niciun
monitor serial/adaptor pe acești pini. ESP8266 se alimentează de la placa lui
(USB sau 5V/VIN), niciodată 5 V direct în GPIO.

## Testarea cablării (10 minute care scutesc ore)

Regula de aur, plătită scump pe bancul nostru: **90% din "nu merge nimic"
înseamnă un fir de GND sau de alimentare lipsă** — de trei ori la rând asta a
fost cauza, nu codul.

### Pasul 0 — vizual, fără alimentare
- Toate GND-urile (sursă motoare, driver, STM32, ESP) legate împreună?
- 3V3 doar la MPU6050 și RC522; 5 V doar la HC-SR04 și logica driverului.
- ECHO trece prin divizor? Condensatoarele 100 nF pe motoare?

### Pasul 1 — multimetru, cu alimentare pornită, fără să miști nimic
| Punct de măsură (negru pe GND) | Aștepți |
|---|---|
| pinul 3V3 al plăcii | ~3,3 V |
| VCC pe HC-SR04 | ~5 V |
| VCC pe GY-521 și RC522 | ~3,3 V |
| nodul divizorului ECHO, în repaus | ~0 V |

### Pasul 2 — puntea serială (loopback), înainte să acuzi robotul
Scoate cele două fire TX/RX de la STM32 și leagă-le cap la cap (sau un jumper
direct între pinii TX-RX ai ESP-ului). Tot ce trimiți prin WebSocket/serial
trebuie să se întoarcă ecou. Fără ecou = problema e în punte/fire/adaptor, nu
în robot. (Adaptorul nostru CP2102 nou-nouț era mort din fabrică — există și
asta.)

### Pasul 3 — senzorii, unul câte unul, din comenzi
- `S` → DIST plauzibil (nu `---`), MPU=OK, RC522 cu versiune diferită de
  0x00/0xFF (clonele raportează 0x82/0x12/0xB2 — sunt OK dacă citesc taguri).
- `GYRO` → valorile se mișcă atunci când rotești șasiul.
- `RFID` → apropie tagul: UID stabil la fiecare citire.
- `DIST=---` permanent → fir TRIG/ECHO desprins, divizor greșit sau senzor
  mort. DIST arată fundalul, nu obiectul → obiect prea mic sau oblic (conul
  senzorului are ~15°; folosește o cutie lată, perpendiculară).

### Pasul 4 — motoarele, OBLIGATORIU cu șenilele ridicate
`MOT` (înainte) apoi `MOTR` (înapoi): ambele motoare, ambele sensuri. Un motor
care merge doar într-un sens = canal de driver ars — procedura completă de
diagnostic cu multimetrul e în README-ul din branch-ul `test-motoare-esp32`
(studiul de caz cu Q1/Q2 arși de EMI).

## Build & flash

### STM32 (folderul `stm32/`)
Cerințe: Windows cu STM32CubeIDE instalat (aduce GCC + programatorul) și
pachetul firmware STM32CubeF7 (CubeMX îl descarcă în
`%USERPROFILE%\STM32Cube\Repository`; alternativ clonează
`github.com/STMicroelectronics/STM32CubeF7`).

```powershell
cd stm32
.\build.ps1        # scrie build\firmware.hex si build\firmware.bin
```

Flash — oricare variantă:
1. **Cel mai simplu:** copiază `build\firmware.bin` pe unitatea USB
   `DIS_F769NI` care apare când conectezi placa (drag & drop, ST-Link MSD).
2. Cu programatorul din CubeIDE:
   `STM32_Programmer_CLI.exe -c port=SWD mode=UR -d build\firmware.hex -v -rst`
3. STM32CubeProgrammer cu interfață grafică.

### ESP32 (folderul `esp32-bridge/`)
```powershell
pip install platformio
cd esp32-bridge
pio run -t upload      # placa conectată pe USB; port auto-detectat
```

### ESP8266 (folderul `esp8266-bridge/`, board NodeMCU)
```powershell
cd esp8266-bridge
pio run -t upload      # NodeMCU pe USB; scoate firele spre STM32 la flash!
```
Aceeași rețea și același protocol ca puntea ESP32: AP **`RUDI-ROBOT`** /
**`rudi1234`**, verificare rapidă la `http://192.168.4.1/health`, comenzi pe
`ws://192.168.4.1:81`.

## Protocol serial (115200, text + Enter)

Te conectezi la **portul serial USB al ESP-ului** (sau la VCP-ul ST-Link).
Comenzi:

| Comandă | Efect |
|---|---|
| `DEMO` | misiunea ghidată completă (mesaje pas cu pas pentru operator) |
| `GO` | aceeași misiune, mesaje minime |
| `MOT` | puls scurt ambele motoare înainte — verificarea sensurilor |
| `MOTR` | puls scurt ambele motoare înapoi |
| `S` | o citire de status: distanță, giroscop, RC522, tag |
| `GYRO` | diagnostic MPU6050: mostre brute consecutive, fără mișcare necesară |
| `RFID` | diagnostic RC522 + așteptare tag |
| `X` | **STOP DE URGENȚĂ** — oricând, inclusiv în timpul misiunii |

Robotul răspunde cu linii text (exemple):
```
=== MISIUNE PORNITA (DEMO ghidat) ===
>>> OPERATOR: cand vrei, PUNE UN OBIECT la sub 25 cm in fata senzorului ultrasonic!
OBSTACOL la 18.3 cm — STOP!
>>> Ocolesc obstacolul: viraj dreapta ~80 grade...
VIRAJ: +81.2 grade masurate
=== AM AJUNS LA DESTINATIE ===
>>> OPERATOR: scaneaza tagul RFID pentru confirmarea livrarii!
=== LIVRARE CONFIRMATA — UID=E9:EA:F0:06 ===
```

## Scenariul DEMO pas cu pas

1. Trimite `DEMO`. Robotul pornește înainte la 45% (cu rampă).
2. Când vrei, pune o cutie/mâna la **sub 25 cm** de HC-SR04 → robotul oprește
   și anunță distanța.
3. Ocolire automată: viraj dreapta ~80° (măsurat cu giroscopul), avans 1,5 s,
   viraj stânga ~80°, revenire pe direcție.
4. Mai merge 3 s → "AM AJUNS LA DESTINATIE".
5. Scanează tagul RFID → "LIVRARE CONFIRMATA" cu UID-ul. Gata.

Timeout-uri de siguranță: 60 s pentru obstacol, 60 s pentru scanare, `X`
funcționează oricând.

## Prima pornire (obligatoriu, în ordinea asta)

1. Cu **rotile sus** (robotul pe un suport, șenilele în aer)!
2. `S` — verifică: DIST plauzibil, MPU=OK, RC522 ver diferit de 0x00/0xFF.
3. `MOT` — ambele motoare trebuie să meargă ÎNAINTE. Dacă unul merge invers,
   schimbă `M1_DIR_FORWARD`/`M2_DIR_FORWARD` în `stm32/src/main.c` și re-flash.
4. `DEMO` cu robotul tot pe suport — verifică toată secvența fără deplasare.
5. Abia apoi pe podea.

## Constante de reglaj (`stm32/src/main.c`, sus)

| Constantă | Implicit | Sens |
|---|---|---|
| `CRUISE_DUTY` | 450 | viteza de mers (din 1000) |
| `TURN_DUTY` | 400 | viteza în viraje |
| `OBSTACLE_STOP_CM` | 25 | pragul de oprire |
| `AVOID_TURN_DEG` | 80 | unghiul virajelor de ocolire |
| `BYPASS_DRIVE_MS` | 1500 | avansul lateral pe lângă obstacol |
| `FINAL_DRIVE_MS` | 3000 | mersul final până la "destinație" |
| `TURN_RIGHT_SIGN` | 1 | pune -1 dacă "dreapta" iese stânga |

## Troubleshooting

- **MPU6050 raportează WHO_AM_I=0x72 în loc de 0x68** — clonă frecventă a
  cipului; funcționează normal, ignoră.
- **RC522 raportează VersionReg=0x82/0x12/0xB2 în loc de 0x91/0x92** — clonă;
  dacă citește UID-ul tagului, e bun.
- **DIST arată fundalul, nu obiectul** — obiectul trebuie să fie lat, plat și
  perpendicular pe senzor; conul HC-SR04 are ~15°.
- **ESP32 se resetează / STM32 se comportă haotic când pornesc motoarele** —
  lipsesc condensatoarele de 100 nF de pe motoare. Istoric real: fără ele am
  ars jumătate dintr-un driver (vezi README-ul din branch-ul
  `test-motoare-esp32`, secțiunea "Studiu de caz", inclusiv cum diagnostichezi
  un canal ars cu multimetrul).
- **Un motor merge doar într-un sens** — canal de driver defect; procedura de
  diagnostic e în același README din `test-motoare-esp32`.
- **Virajele n-au unghiul bun** — robotul patinează pe suprafață; ajustează
  `AVOID_TURN_DEG` sau `TURN_DUTY`, și verifică bias-ul giroscopului (placa
  trebuie să stea nemișcată la pornire, când se calibrează).
