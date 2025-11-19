# MyHyra Zeiterfassung

Vollständiges Beispiel einer Zeiterfassungslösung bestehend aus drei Projekten:

- **server** – Node/Express API mit SQLite, JWT-Login und Standortfeldern.
- **web** – React-Vite-Frontend für Mitarbeitende und Admins.
- **mobile** – Expo/React-Native-App inkl. Standortabfrage fürs Stempeln.

## Features

- Nutzerbasierte Logins (Admin + Mitarbeitende) mit JWT.
- Zentraler Kommen/Gehen-Button, der automatisch den nächsten Schritt anbietet.
- Kommen/Gehen-Stempelung inkl. verpflichtender Standortübermittlung (Browser/App fragen die Freigabe aktiv an).
- Kompakte Kalenderansicht pro Nutzer mit Tageszusammenfassung (Arbeits- & Pausenzeit) und Google-Maps-Vorschau der Standorte.
- Admin-Inspector: Liste aller Mitarbeitenden, Auswahl eines Profils öffnet dieselbe Kalenderansicht.
- Admin-Werkzeuge zum Anlegen neuer Nutzer:innen, Bearbeiten von Stammdaten/Rollen, Zurücksetzen von Passwörtern, De-/Aktivieren von Logins sowie manuellen Korrekturen oder Ergänzungen einzelner Buchungen.
- Einstellungsbereich für Mitarbeitende mit eigenem Passwortwechsel, Zielarbeitszeit, Benachrichtigungs- und Theme-Optionen.
- Urlaubs- & Abwesenheitsverwaltung wie in klassischen Zeiterfassungssystemen: halb- oder ganztägige Einträge mit Resturlaubskonto, Übersicht aller Mitarbeitenden sowie Monatsreport zu Anwesenheit/Vakanzen.
- Expo-App speichert Token sicher, fragt Standortberechtigungen an und erlaubt Map-Aufrufe aus den Buchungsdetails.
- Mitarbeitende können ihr eigenes Passwort direkt im Dashboard mit alter Kennwortprüfung ändern.

## Schnellstart

### 1. Server
```bash
cd server
cp .env.example .env   # Werte anpassen
npm install
npm run dev            # startet http://localhost:4000
```
Der Server legt automatisch eine SQLite-Datei im Ordner `server/data` an und erzeugt den Admin-User aus der `.env`. Über die Variable `DATABASE_FILE` kannst du auch einen anderen Speicherort (z. B. Netzlaufwerk) festlegen; das Verzeichnis wird beim Start automatisch erstellt.

### 2. Web-Frontend
```bash
cd web
cp .env.example .env.local
npm install
npm run dev            # startet http://localhost:5173
```
Das Frontend nutzt React Query und ruft die API über `/api` oder `VITE_API_URL` auf.

### 3. Mobile App (Expo)
```bash
cd mobile
npm install
npx expo start
```
Passe die `extra.apiUrl` in `mobile/app.json` oder `EXPO_PUBLIC_API_URL` an, damit die App deinen Server erreicht.

## API Überblick

| Methode | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/api/auth/login` | Login, liefert JWT. |
| GET | `/api/bookings/me` | Eigene Buchungen (für Kalender & Button-State). |
| GET | `/api/bookings/user/:id` | (Admin) Buchungen für ausgewählten Mitarbeitenden. |
| POST | `/api/bookings/clock-in` | Kommen buchen – verweigert Requests ohne GPS. |
| POST | `/api/bookings/clock-out` | Gehen buchen – ebenfalls mit Standortpflicht. |
| PATCH | `/api/bookings/:id` | (Admin) Buchungszeiten anpassen. |
| POST | `/api/bookings/user/:id/manual` | (Admin) Kommen/Gehen manuell erfassen – optional mit Standort, auch einzeln zum Nachpflegen. |
| GET | `/api/bookings` | (Admin) Gesamtliste aller Buchungen. |
| GET | `/api/users` | (Admin) Mitarbeitendenliste für den Inspector. |
| POST | `/api/users` | (Admin) Neue Mitarbeitende inkl. Rollen anlegen. |
| PATCH | `/api/users/:id/password` | (Admin) Passwort zurücksetzen. |
| PATCH | `/api/users/:id/status` | (Admin) Login eines Mitarbeitenden de-/aktivieren. |
| PATCH | `/api/users/:id` | (Admin) Stammdaten/Rolle eines Nutzers anpassen. |
| PATCH | `/api/users/me/password` | Mitarbeitende ändern ihr eigenes Passwort nach alter Kennwortprüfung. |
| GET/PATCH | `/api/users/me/settings` | Persönliche Einstellungen laden/ändern (Sollzeit, Benachrichtigungen, Theme). |
| PATCH | `/api/users/:id/settings` | (Admin) Urlaubskontingent eines Mitarbeitenden anpassen. |
| GET | `/api/absences/me` | Eigene Abwesenheiten (Urlaub, Krank, Remote) anzeigen. |
| GET | `/api/absences/me/summary` | Persönliche Urlaubsauswertung (Kontingent, Resttage). |
| GET | `/api/absences/user/:id` | (Admin) Abwesenheiten eines Mitarbeitenden. |
| POST | `/api/absences/user/:id` | (Admin) Halb- oder Ganztags-Abwesenheit erfassen – Standort optional. |
| DELETE | `/api/absences/:id` | (Admin) Abwesenheit entfernen. |
| GET | `/api/absences/summary` | (Admin) Gesamtübersicht aller Urlaubskonten. |
| GET | `/api/reports/attendance?month=YYYY-MM` | (Admin) Monatsreport zu Anwesenheit/Urlaub/Krank/Remote inklusive Resturlaub. |

## Mobile & Browser Standortnachweis

- Web/Browser: Der große Punch-Button funktioniert nur mit aktiver Geofreigabe (`navigator.geolocation`). Wird sie verweigert, zeigt das UI eine Fehlermeldung.
- Expo-App: nutzt `expo-location`, fordert Berechtigung bei jeder Stempelung an und öffnet Google Maps für gespeicherte Koordinaten.

## Sicherheit & Weiteres

- Speichere starke `JWT_SECRET`- und Admin-Passwörter in der `.env`.
- Hinterlege HTTPS sowie zusätzliche Prüfungen (z. B. IP-Range, Geräteverwaltung) je nach Compliance.
- SQLite eignet sich für Demos. Für Produktion empfiehlt sich Postgres + Prisma.
