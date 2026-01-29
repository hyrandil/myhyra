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

## Setup (Schritt für Schritt)
### 1) Server starten (API)
```bash
cd server
cp .env.example .env
npm install
npm run dev
# Produktion: npm run build && npm start
```
Standard-Admin stammt aus `.env` (ADMIN_EMAIL/ADMIN_PASSWORD). Datenbank liegt in `data/myhyra.db` oder in `DATABASE_FILE`.

**API-Basis-URL:** `http://localhost:<PORT>/api` (Standard-Port siehe `.env`, z. B. 3001).

### 2) Web-Client starten
```bash
cd web
npm install
npm run dev
```
Vite hört auf `0.0.0.0:5173`, damit du über die LAN-IP entwickeln kannst. Setze in `.env` im Server `WEB_ORIGINS` auf eine kommagetrennte Liste (z. B. `http://localhost:5173,http://10.10.1.18:5173,https://zeit-pilot.de`) oder auf die Domain deines Reverse-Proxys, damit CORS Cookies für deine Entwickler-IP bzw. dein Produktiv-Host zulässt.
`VITE_API_URL` zeigt auf die API (Standard: relative `/api`, damit der Vite-Proxy greift). Cookies werden automatisch (withCredentials) gesendet.

### 3) Terminal-Client starten (RFID)
Der Server liefert eine kleine lokale Terminal-Oberfläche unter:
```
http://localhost:<PORT>/terminal
```
**Ablauf:**
1. Im Web-UI als Admin unter **Terminals** einen neuen API-Key erzeugen.
2. In der Terminal-Seite den API-Key eintragen.
3. RFID-Chipnummer scannen und **Kommen/Gehen** senden.

### 4) Terminal-API konfigurieren (für lokale Clients)
Der lokale Terminal-Client sendet folgende Anfrage an den Server:
```
POST /api/terminals/entry
Header: x-api-key: <API_KEY>
Body: { "rfid": "<RFID>", "type": "CLOCK_IN" | "CLOCK_OUT" }
```
Stelle sicher, dass der Server erreichbar ist (Portfreigabe/Reverse Proxy) und der API-Key aktiv ist.

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
