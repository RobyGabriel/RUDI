# Test motoare pe banc — ESP32-C3 + driver DIR/PWM

Firmware de test pentru motoarele DC cu perii ale robotului RUDI, comandate
printr-un driver clasic cu intrări **DIR + PWM** per canal. Rulează pe un
**ESP32-C3 SuperMini** (USB-C nativ).

## Hardware necesar

- ESP32-C3 SuperMini (apare ca port serial USB nativ, ex. `COM5`)
- Driver de motoare cu intrări DIR + PWM per canal, alimentat separat de logica ESP-ului
- 1–2 motoare DC cu perii
- Sursă de alimentare pentru motoare (NU din USB-ul plăcii!)
- GND comun între driver și ESP32 — obligatoriu

### Cablaj (pinii din cod)

| Semnal | Pin ESP32-C3 |
|---|---|
| DIR motor 1 | GPIO21 |
| PWM motor 1 | GPIO0 |
| DIR motor 2 | GPIO10 |
| PWM motor 2 | GPIO1 |

## ⚠️ Important: zgomotul de la perii (EMI)

Fără măsuri anti-parazitare, zgomotul electric al periilor poate **bloca sau
reseta intermitent ESP32-C3** în timpul mersului (panic `Interrupt wdt timeout`
sau reset hard `TG0WDT_SYS_RST`). Am reprodus problema pe banc: până la 5 din
6 rulări eșuate. Obligatoriu înainte de teste serioase:

1. **Condensator ceramic 100 nF direct pe bornele fiecărui motor** (marcaj „104",
   nepolarizat — NU electrolitic, motorul își inversează polaritatea!)
2. Firele fiecărui motor răsucite între ele și cât mai scurte
3. Masă în punct unic — curentul motoarelor să nu treacă prin GND-ul plăcii ESP
4. Opțional: electrolitic ≥470 µF pe alimentarea driverului, aproape de driver

Atenție: dacă ESP-ul îngheață cu motorul pornit, motorul **continuă să meargă
~12 secunde** până îl oprește watchdog-ul prin reset. Ține mâna pe alimentare
la primele teste.

## 💀 Studiu de caz: cum ne-a ars EMI-ul jumătate de driver (iul 2026)

Am rulat săptămâni întregi FĂRĂ condensatoarele de mai sus. Rezultatul, pe un
driver BESTEP cu două punți H (8× MOSFET RU6099R, Q1–Q4 = canalul 1,
Q5–Q8 = canalul 2): un vârf de tensiune a **scurtcircuitat Q1** (high-side) și
a **străpuns porțile la Q1 și Q2** — toată jumătatea stângă a punții canalului 1.

Partea perfidă: **defectul e invizibil luni de zile.** Cu high-side-ul în scurt,
sensul „înainte" merge perfect (tranzistorul e oricum „mereu pornit"). Doar la
„înapoi" nu există drum de curent: motorul stă complet mut, fără zumzet, fără
fum, la orice PWM. Dacă motorul tău merge într-un singur sens — citește mai jos
înainte să dai vina pe cod.

### Cum diagnostichezi în 10 minute (comenzile sunt deja în firmware)

1. **Semnalul DIR ajunge la driver?** Trimite `L` apoi `H` și măsoară cu
   multimetrul pe pinul DIR al driverului față de GND: trebuie ~0 V la `L` și
   ~3,3 V la `H`. Dacă da, ESP-ul și cablajul sunt nevinovate.
2. **Driverul scoate tensiune în ambele sensuri?** Sondele pe cele două borne
   ale motorului (NU la GND!), apoi trimite `F` (înainte 99%, 10 s) și `B`
   (înapoi 99%, 10 s). Driver sănătos: aproape tensiunea sursei, cu semn
   schimbat între F și B (ex. +5,9 V / −5,9 V). Canal ars: plin într-un sens,
   **0 V** în celălalt.
3. **Care tranzistor e mort?** Sursa OPRITĂ, motorul deconectat, multimetrul pe
   diode-test. La fiecare MOSFET (stânga=Gate, tab/mijloc=Drain, dreapta=Source),
   trei măsurători, comparate mereu cu **geamănul din același loc de pe canalul
   sănătos** (Q1↔Q5, Q2↔Q6...):
   - A: roșu pe Source, negru pe Drain → normal ~0,4–0,55 V
   - B: roșu pe Drain, negru pe Source → normal OL
   - C: roșu pe Gate, negru pe Source (și invers) → normal OL
   - **~0 V la A și B = FET în scurt. Conducție la C = poartă străpunsă.**
   Orice diferă de geamăn = mortul. (Înainte de A/B atinge scurt Gate de Source,
   să descarci poarta.)

### Reparația

Se schimbă **ambii** tranzistori ai jumătății afectate (ex. Q1+Q2), nu doar cel
evident mort — perechea a încasat același stres. Înlocuitor: exact RU6099R sau
orice N-MOSFET 60 V / ≤10 mΩ în aceeași capsulă. NU folosi FET-uri de înaltă
tensiune din surse (gen 8N65: 650 V dar ~1,2 Ω — de 200× prea rezistiv, cade
toată tensiunea pe el). Alternativa pragmatică: driver nou, iar cel cu un canal
ars rămâne driver de rezervă pe canalul bun.

Morala: **condensatoarele pe motoare se pun ÎNAINTE de prima pornire**, nu după
prima pană.

## Instalare software

1. Instalează [Python](https://www.python.org/downloads/) (bifează „Add to PATH")
2. `pip install platformio`
3. Opțional dar recomandat: VS Code + extensia **PlatformIO IDE** (butoane de
   Build/Upload/Monitor, fără linie de comandă)

## Compilare, încărcare, rulare

```powershell
cd test-esp32-motors
pio run                    # doar compilare (sau: python -m platformio run)
pio run -t upload          # compilare + încărcare pe placă
pio device monitor         # monitor serial la 115200 (ieșire: Ctrl+C)
```

Portul serial se detectează automat; dacă ai mai multe adaptoare USB-serial,
află portul cu `pio device list` și decomentează `upload_port`/`monitor_port`
din `platformio.ini`. Notă: deschiderea monitorului resetează placa (normal la
USB-ul nativ al C3-ului), și monitorul trebuie închis înainte de upload.

## Comenzi în monitorul serial

| Tastă | Acțiune |
|---|---|
| `1` | Diagnostic motor 1: 3 s înainte, 2 s pauză, 3 s înapoi |
| `2` | Diagnostic motor 2: identic |
| `T` | Test scurt ambele motoare pe rând (1 s per sens) |
| `R` | Motor 1 înapoi la 99%, 2 secunde |
| `F` / `B` | Măsurare motor 1 la 99%, 10 s (înainte/înapoi) — pentru multimetru |
| `3` / `4` | Măsurare motor 2 la 99%, 10 s (înainte/înapoi) — la fel, pentru multimetru |
| `L` / `H` | DIR1 forțat LOW/HIGH cu PWM 0 — pentru verificat cablajul cu multimetrul |
| `X` | **STOP DE URGENȚĂ** — oprește tot, funcționează oricând, inclusiv în timpul testelor |

## Configurare (constantele din `src/main.cpp`)

| Constantă | Valoare | Semnificație |
|---|---|---|
| `TEST_DUTY` | 115 | viteza testelor: 115/255 ≈ 45% |
| `RAMP_STEP` / `RAMP_STEP_TIME_MS` | 8 / 20 ms | rampă soft-start (previne vârful de curent la pornire) |
| `DIRECTION_DEAD_TIME_MS` | 250 | pauză cu PWM 0 la schimbarea sensului |
| `PWM_FREQUENCY_HZ` | 1000 | frecvența PWM |

Rampa și dead-time-ul nu sunt decorative — ele previn căderile de tensiune
(brownout) la pornirea motorului. Nu le scoate.
