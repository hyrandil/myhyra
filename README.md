# MyHyra Zeiterfassung

Browserbasierte Beispiel-Anwendung für eine Zeiterfassung mit Express/SQLite-API und React-Frontend.

## Features
- Rollenbasierte Anmeldung (Mitarbeiter, Teamleiter, Administrator) mit serverseitigen Sitzungen (HttpOnly-Cookie) und Passwort-Hashing.
- Mitarbeitendenverwaltung (Personalnummer, Standort, Abteilung, Eintritt/Austritt, Aktiv-Status) inkl. Suche.
- Stempeluhr mit Kommen/Gehen/Pausen, Quellen (WEB/APP) und optionalen GPS-Daten.
- Arbeitszeitmodelle je Wochentag, automatische Pausenregel (Abzug bis 30 min nach >6 h ohne echte Pause).
- Urlaubs- und Abwesenheitsanträge (Urlaub/Krank/Remote/Sonstige) mit Genehmigung durch Teamleiter oder Admin.
- Monatsübersicht mit Plan-/Ist-Minuten pro Tag und Abwesenheitsmarkern, plus Anwesenheitsreport.
- Feiertagsprofile pro Bundesland (Mehrjahres-Import + eigene ganze/halbe Tage), bei Mitarbeitenden hinterlegbar und in Plan/Ist-Berechnung
  sowie Kalenderansichten berücksichtigt.
- Beispiel-Unit-Test für die Kernlogik der Tagesberechnung.

## Setup (Schritt für Schritt, sehr ausführlich)
> Ziel: API-Server starten und Web-Client starten.  
> Dieses Projekt hat **zwei** Teile:
> 1. **Server** (Express API + SQLite)
> 2. **Web-Frontend** (React/Vite)

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

### 3) Typische Start-Reihenfolge (Kurzfassung)
1. Terminal 1: `cd server && npm run dev` (Port 3001)
2. Terminal 2: `cd web && npm run dev` (Port 5173)
3. Browser öffnen: `http://localhost:5173`

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
