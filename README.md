# MyHyra Zeiterfassung

Vollständiges Beispiel einer Zeiterfassungslösung bestehend aus drei Projekten:

- **server** – Node/Express API mit SQLite, JWT-Login und Standortfeldern.
- **web** – React-Vite-Frontend für Mitarbeitende und Admins.
- **mobile** – Expo/React-Native-App inkl. Standortabfrage fürs Stempeln.

## Features

- Nutzerbasierte Logins (Admin + Mitarbeitende) mit JWT.
- Zentraler Kommen/Gehen-Button, der automatisch den nächsten Schritt anbietet.
- Kommen/Gehen-Stempelung inkl. verpflichtender Standortübermittlung (Browser/App fragen die Freigabe aktiv an).
- Kalenderansicht pro Nutzer mit Tageszusammenfassung (Arbeits- & Pausenzeit) und Google-Maps-Vorschau der Standorte.
- Admin-Inspector: Liste aller Mitarbeitenden, Auswahl eines Profils öffnet dieselbe Kalenderansicht.
- Expo-App speichert Token sicher, fragt Standortberechtigungen an und erlaubt Map-Aufrufe aus den Buchungsdetails.

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
| POST | `/api/auth/register` | (Admin) Benutzer anlegen. |
| GET | `/api/bookings/me` | Eigene Buchungen (für Kalender & Button-State). |
| GET | `/api/bookings/user/:id` | (Admin) Buchungen für ausgewählten Mitarbeitenden. |
| POST | `/api/bookings/clock-in` | Kommen buchen – verweigert Requests ohne GPS. |
| POST | `/api/bookings/clock-out` | Gehen buchen – ebenfalls mit Standortpflicht. |
| GET | `/api/bookings` | (Admin) Gesamtliste aller Buchungen. |
| GET | `/api/users` | (Admin) Mitarbeitendenliste für den Inspector. |

## Mobile & Browser Standortnachweis

- Web/Browser: Der große Punch-Button funktioniert nur mit aktiver Geofreigabe (`navigator.geolocation`). Wird sie verweigert, zeigt das UI eine Fehlermeldung.
- Expo-App: nutzt `expo-location`, fordert Berechtigung bei jeder Stempelung an und öffnet Google Maps für gespeicherte Koordinaten.

## Sicherheit & Weiteres

- Speichere starke `JWT_SECRET`- und Admin-Passwörter in der `.env`.
- Hinterlege HTTPS sowie zusätzliche Prüfungen (z. B. IP-Range, Geräteverwaltung) je nach Compliance.
- SQLite eignet sich für Demos. Für Produktion empfiehlt sich Postgres + Prisma.
