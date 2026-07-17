# RUDI — simulare livrare cu evitare de obstacol

Demo complet pe banc pentru robotul RUDI (livrator de documente, șasiu tip
tanc cu șenile): robotul primește comanda de plecare, merge înainte, **tu pui
un obiect în fața senzorului ultrasonic**, robotul oprește, ocolește obstacolul
folosind giroscopul, ajunge la "destinație" și așteaptă **scanarea unui tag
RFID** drept confirmare de livrare.

> **Notă pentru asistenți AI (Claude etc.):** tot ce e nevoie e în acest folder.
> Pașii de build sunt în `stm32/build.ps1` (auto-detectează toolchain-ul) și în
> secțiunea ESP32 de mai jos. Porturile seriale se află cu
> `[System.IO.Ports.SerialPort]::GetPortNames()` (PowerShell) sau `pio device list`.
> Protocolul serial e text simplu la 115200 — poți pilota și valida întregul
> demo citind/scriind pe portul serial, fără unelte speciale.

## Arhitectură

```
PC / aplicație  ──USB──  ESP32-C3 SuperMini  ──UART──  STM32F769I-DISCO
 (colegul)               (punte transparentă)           │ driver motoare → 2 motoare DC
                                                        │ HC-SR04 (obstacole)
                                                        │ MPU6050 (viraje precise)
                                                        └ RC522 (confirmare livrare)
```

STM32-ul face toată treaba (motoare, senzori, misiune). ESP32-ul e doar puntea
prin care aplicația vorbește cu robotul — **PC-ul se conectează NUMAI la USB-ul
ESP-ului**. Pentru dezvoltare merge și direct pe consola ST-Link a plăcii STM32
(al doilea port COM, același protocol).

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

## Protocol serial (115200, text + Enter)

Te conectezi la **portul serial USB al ESP-ului** (sau la VCP-ul ST-Link).
Comenzi:

| Comandă | Efect |
|---|---|
| `DEMO` | misiunea ghidată completă (mesaje pas cu pas pentru operator) |
| `GO` | aceeași misiune, mesaje minime |
| `MOT` | puls scurt ambele motoare înainte — verificarea sensurilor |
| `S` | o citire de status: distanță, giroscop, RC522, tag |
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
