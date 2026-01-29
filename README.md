# MyHyra Zeiterfassung

Browserbasierte Beispiel-Anwendung für eine Zeiterfassung mit Express/SQLite-API und React-Frontend.

## Features
- Rollenbasierte Anmeldung (Mitarbeiter, Teamleiter, Administrator) mit serverseitigen Sitzungen (HttpOnly-Cookie) und Passwort-Hashing.
- Mitarbeitendenverwaltung (Personalnummer, Standort, Abteilung, Eintritt/Austritt, Aktiv-Status) inkl. Suche.
- Stempeluhr mit Kommen/Gehen/Pausen, Quellen (WEB/APP/TERMINAL) und optionalen GPS-Daten.
- Arbeitszeitmodelle je Wochentag, automatische Pausenregel (Abzug bis 30 min nach >6 h ohne echte Pause).
- Urlaubs- und Abwesenheitsanträge (Urlaub/Krank/Remote/Sonstige) mit Genehmigung durch Teamleiter oder Admin.
- Monatsübersicht mit Plan-/Ist-Minuten pro Tag und Abwesenheitsmarkern, plus Anwesenheitsreport.
- Feiertagsprofile pro Bundesland (Mehrjahres-Import + eigene ganze/halbe Tage), bei Mitarbeitenden hinterlegbar und in Plan/Ist-Berechnung
  sowie Kalenderansichten berücksichtigt.
- Beispiel-Unit-Test für die Kernlogik der Tagesberechnung.

## Setup (Schritt für Schritt, sehr ausführlich)
> Ziel: API-Server starten, Web-Client starten, Terminal-Client einrichten.  
> Dieses Projekt hat **drei** Teile:
> 1. **Server** (Express API + SQLite)
> 2. **Web-Frontend** (React/Vite)
> 3. **Terminal-Client** (lokale HTML-Seite für RFID)

### Voraussetzungen (einmalig)
1. **Node.js installieren** (empfohlen: aktuelle LTS Version).
2. **Repository klonen** und in den Projektordner wechseln.  
   Beispielpfad:  
   ```
   /path/to/myhyra
   ```
3. Stelle sicher, dass du **Terminal/PowerShell** öffnen kannst und der Befehl `node -v` eine Version ausgibt.

---

### 1) Server starten (API)
**Pfad:**  
```
/path/to/myhyra/server
```

**Befehle (genau in dieser Reihenfolge):**
```bash
cd server
cp .env.example .env
npm install
npm run dev
# Produktion: npm run build && npm start
```

**Was passiert hier?**
- `cd server` wechselt in den Server-Ordner.
- `cp .env.example .env` erstellt eine lokale Konfigurationsdatei.
- `npm install` installiert Abhängigkeiten.
- `npm run dev` startet den API-Server.

**Standard-Port:**  
In `.env` steht `PORT` (z. B. `3001`).  
Die API ist dann unter **`http://localhost:3001/api`** erreichbar.

**Wichtige Server-Dateien:**
- `.env` (Konfiguration, z. B. `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- Datenbank: `server/data/myhyra.db` (oder `DATABASE_FILE` in `.env`)

---

### 2) Web-Client starten
**Neues Terminal-Fenster öffnen** (Server läuft weiter im ersten Terminal).

**Pfad:**  
```
/path/to/myhyra/web
```

**Befehle:**
```bash
cd web
npm install
npm run dev
```

**Port und URL:**
- Vite läuft standardmäßig auf **`http://localhost:5173`**
- Der Web-Client spricht den Server über `/api` an (Vite-Proxy).

**Wichtig: CORS/Origins konfigurieren**  
In `server/.env` muss `WEB_ORIGINS` die Web-URL erlauben:
```
WEB_ORIGINS=http://localhost:5173
```
Wenn du über LAN oder eine andere IP zugreifst:
```
WEB_ORIGINS=http://localhost:5173,http://<DEINE-IP>:5173
```

**Typische Fehler:**
- `ECONNREFUSED` → Server läuft nicht oder falscher Port.
- Login funktioniert nicht → `WEB_ORIGINS` falsch gesetzt.

---

### 3) Terminal-Client starten (RFID)
Der Terminal-Client läuft **als separate Anwendung** auf einem eigenen Gerät (z. B. Surface Tablet mit RFID-Reader).
Er kommuniziert per **Server-URL + Port + API-Key** mit dem zentralen Server (z. B. Cloud-Instanz).

**Pfad der Terminal-App:**
```
/path/to/myhyra/src/terminal
```

**Terminal-App starten:**
```bash
cd src/terminal
cp .env.example .env
npm install
npm run dev
```

**Standard-Port:**  
Die Terminal-App läuft auf **`http://localhost:5174`**.

**Konfiguration in `.env` (Terminal-App):**
```
VITE_SERVER_URL=https://dein-server.de
VITE_API_KEY=dein-api-key
```

**Ablauf im Terminal-UI:**
1. Terminal-App im Browser öffnen (z. B. `http://localhost:5174`).
2. **Server URL** und **API-Key** prüfen/anpassen (werden aus `.env` geladen).
3. RFID scannen → **Kommen/Gehen** senden.

**Ablauf Schritt für Schritt:**
1. Im Web-UI als **Admin** anmelden.
2. Menüpunkt **Terminals** öffnen.
3. Neues Terminal anlegen → API-Key wird angezeigt.
4. Terminal-Seite öffnen (`/terminal`).
5. API-Key in das Feld eintragen.
6. RFID-Chipnummer eingeben oder scannen.
7. **Kommen** oder **Gehen** senden.

---

### 4) Terminal-API konfigurieren (für eigene Clients)
Wenn du einen **eigenen lokalen Client** bauen willst, nutzt du diesen Request:

**Endpoint (vom Client-Gerät aus):**
```
POST https://dein-server.de/api/terminals/entry
```

**Header:**
```
x-api-key: <DEIN_API_KEY>
Content-Type: application/json
```

**Body:**
```json
{ "rfid": "1234567890", "type": "CLOCK_IN" }
```

**Antwort-Beispiel:**
```json
{
  "ok": true,
  "action": "CLOCK_IN",
  "user": { "id": 5, "name": "Max Mustermann" },
  "timestamp": "2026-01-01T08:00:00.000Z"
}
```

---

### 5) Typische Start-Reihenfolge (Kurzfassung)
1. Terminal 1: `cd server && npm run dev` (Port 3001)
2. Terminal 2: `cd web && npm run dev` (Port 5173)
3. Browser öffnen: `http://localhost:5173`
4. Optional: `http://localhost:3001/terminal`

## Wichtige Endpunkte
- `POST /api/auth/login` – Login, legt Session-Cookie an.
- `POST /api/auth/register` – Admin legt neue Nutzer an.
- `GET /api/users?q=` – Liste mit Suche; `POST /api/users` anlegen; `PATCH /api/users/:id` Stammdaten/Rolle/Status.
- `GET /api/time/me` – eigene Buchungen; `POST /api/time/clock-in|clock-out|break-start|break-end` – Stempelvorgänge.
- `GET /api/time/me/daily?month=YYYY-MM` – Plan/Ist/Δ und Abwesenheiten je Tag.
- `POST /api/absences/request` – Abwesenheitsantrag stellen; `GET /api/absences/requests` & `PATCH /api/absences/requests/:id/status` – Genehmigung.
- `GET /api/reports/attendance?month=YYYY-MM` – Monatsreport je Mitarbeitendem.
- `GET /api/terminals` – Terminal-Keys & Status.
- `POST /api/terminals` – neuen Terminal-Key erzeugen.
- `POST /api/terminals/entry` – Terminal-Buchung via API-Key.

## Tests
```bash
cd server
npm test
```
Unit-Test prüft die Tagesarbeitszeit inkl. automatischer Pausenlogik (`src/tests/timeService.test.ts`).

## Beispiel-Logins
- Admin: `admin@example.com` / Passwort aus `.env` (Standard `ChangeMe!123`).
