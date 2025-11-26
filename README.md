# MyHyra Zeiterfassung

Browserbasierte Beispiel-Anwendung für eine Zeiterfassung mit Express/SQLite-API und React-Frontend.

## Features
- Rollenbasierte Anmeldung (Mitarbeiter, Teamleiter, HR, Administrator) mit serverseitigen Sitzungen (HttpOnly-Cookie) und Passwort-Hashing.
- Mitarbeitendenverwaltung (Personalnummer, Standort, Abteilung, Eintritt/Austritt, Aktiv-Status) inkl. Suche.
- Stempeluhr mit Kommen/Gehen/Pausen, Quellen (WEB/APP/TERMINAL) und optionalen GPS-Daten.
- Arbeitszeitmodelle je Wochentag, automatische Pausenregel (Abzug bis 30 min nach >6 h ohne echte Pause).
- Urlaubs- und Abwesenheitsanträge (Urlaub/Krank/Remote/Sonstige) mit Genehmigung durch Lead/HR/Admin.
- Monatsübersicht mit Plan-/Ist-Minuten pro Tag und Abwesenheitsmarkern, plus Anwesenheitsreport.
- Feiertagsprofile pro Bundesland (Mehrjahres-Import + eigene ganze/halbe Tage), bei Mitarbeitenden hinterlegbar und in Plan/Ist-Berechnung
  sowie Kalenderansichten berücksichtigt.
- Beispiel-Unit-Test für die Kernlogik der Tagesberechnung.

## Setup
### Server
```bash
cd server
cp .env.example .env
npm install
npm run dev
# Produktion: npm run build && npm start
```
Standard-Admin stammt aus `.env` (ADMIN_EMAIL/ADMIN_PASSWORD). Datenbank liegt in `data/myhyra.db` oder in `DATABASE_FILE`.

### Web
```bash
cd web
npm install
npm run dev
```
`VITE_API_URL` zeigt auf die API (Standard: `http://localhost:4000/api`). Cookies werden automatisch (withCredentials) gesendet.

## Wichtige Endpunkte
- `POST /api/auth/login` – Login, legt Session-Cookie an.
- `POST /api/auth/register` – Admin/HR legen neue Nutzer an.
- `GET /api/users?q=` – Liste mit Suche; `POST /api/users` anlegen; `PATCH /api/users/:id` Stammdaten/Rolle/Status.
- `GET /api/time/me` – eigene Buchungen; `POST /api/time/clock-in|clock-out|break-start|break-end` – Stempelvorgänge.
- `GET /api/time/me/daily?month=YYYY-MM` – Plan/Ist/Δ und Abwesenheiten je Tag.
- `POST /api/absences/request` – Abwesenheitsantrag stellen; `GET /api/absences/requests` & `PATCH /api/absences/requests/:id/status` – Genehmigung.
- `GET /api/reports/attendance?month=YYYY-MM` – Monatsreport je Mitarbeitendem.

## Tests
```bash
cd server
npm test
```
Unit-Test prüft die Tagesarbeitszeit inkl. automatischer Pausenlogik (`src/tests/timeService.test.ts`).

## Beispiel-Logins
- Admin: `admin@example.com` / Passwort aus `.env` (Standard `ChangeMe!123`).
