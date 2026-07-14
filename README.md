# RUDI
Technologii aplicatie
1. Expo (React Native)
Rulând direct pe dispozitivul mobil al utilizatorului, Expo oferă interfața de utilizator cross-platform pe care angajații o folosesc pentru a chema robotul, a selecta destinațiile și a monitoriza starea acestuia în timp real.
2. FastAPI (Python)
Rulând pe laptopul tău local sau pe un Raspberry Pi, FastAPI servește ca server backend central care procesează comenzile primite de la aplicație, interoghează bazele de date și direcționează instrucțiunile către robot.
3. WebSockets
Stabilind o conexiune continuă în întreaga rețea, WebSockets conectează aplicația Expo, backend-ul Python și modulul ESP32 pentru a trimite actualizări de stare instantanee, în timp real, direct pe ecranul utilizatorului.
4. Zustand
Rulând în memoria activă a aplicației mobile, Zustand stochează instantaneu datele primite în timp real prin WebSockets și actualizează automat toate ecranele și hărțile din interfață în același timp.
5. SQLite
Stocată ca un fișier local pe dispozitivul tău backend, SQLite funcționează ca o bază de date simplă care asociază numele angajaților cu ID-urile fizice ale stațiilor acestora.
6. SQLModel
Integrat direct în codul tău de backend, SQLModel traduce înregistrările din baza de date SQLite în obiecte Python clare, permițându-ți să interoghezi și să gestionezi stațiile angajaților fără a scrie interogări SQL brute.
7. Environment Variables (.env)
Salvate atât în directoarele aplicației mobile, cât și în cele ale backend-ului, aceste fișiere de configurare stochează adresa de rețea a serverului tău într-un singur loc, astfel încât să o poți actualiza global atunci când IP-ul se modifică.
8. ngrok
Rulând pe laptopul tău de dezvoltare, ngrok direcționează serverul tău local către un URL HTTPS public și securizat, ocolind regulile de securitate ale sistemelor de operare mobile care blochează traficul de rețea local necriptat.
9. OTA (Over-The-Air) Updates
Implementate pe telefoanele de testare (prin EAS) și pe ESP32 (prin ElegantOTA/ArduinoOTA), aceste instrumente îți permit să trimiți remedieri de cod wireless către hardware și aplicație, fără a fi nevoie de cabluri USB.
10. mDNS (Multicast DNS)
Configurat în rețeaua ta locală, mDNS permite modulului ESP32 și aplicației Expo să localizeze backend-ul folosind un nume de domeniu local permanent (cum ar fi rudi-server.local) în locul unei adrese IP care se schimbă la fiecare repornire a routerului.

De fiecare dată când lucrezi la proiect cu aplicatia

1. Pornește backend-ul (Terminal 1)

bashcd rudi-backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

Verifică că vezi în terminal:

INFO:     Uvicorn running on http://0.0.0.0:8000

2. Pornește ngrok (Terminal 2 — separat, ambele rămân deschise)

bashngrok http 8000

Copiază URL-ul afișat, de tipul:

Forwarding    https://xxxx-xxxx.ngrok-free.app -> http://localhost:8000

3. Actualizează .env din rudi-app

EXPO_PUBLIC_WS_URL=wss://xxxx-xxxx.ngrok-free.app/ws

⚠️ wss://, NU ws:// — ngrok folosește HTTPS/TLS.

4. Repornește Expo

bashcd rudi-app
npx expo start

(.env se citește doar la pornire — dacă Expo rula deja, oprește-l cu Ctrl+C și repornește.)

5. Testează pe telefon

Deschide aplicația în Expo Go → indicatorul de status ar trebui să devină verde (connected).