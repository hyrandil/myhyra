# MyHyra Zeiterfassung

Vollständiges Beispiel einer Zeiterfassungslösung bestehend aus drei Projekten:

- **server** – Node/Express API mit SQLite, JWT-Login und Standortfeldern.
- **web** – React-Vite-Frontend für Mitarbeitende und Admins.
- **mobile** – Expo/React-Native-App inkl. Standortabfrage fürs Stempeln.

## Features

- Nutzerbasierte Logins (Admin + Mitarbeitende) mit JWT.
- Kommen/Gehen-Stempelung inkl. Standort (mobil via Browser-Geolocation/App).
- Persönliche Übersicht aller Buchungen.
- Adminansicht mit allen Buchungen inkl. Koordinaten.
- Expo-App speichert Token sicher und fragt Standortberechtigungen an.

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
| GET | `/api/bookings/me` | Eigene Buchungen. |
| POST | `/api/bookings/clock-in` | Kommen buchen inkl. Standort. |
| POST | `/api/bookings/clock-out` | Gehen buchen. |
| GET | `/api/bookings` | (Admin) Alle Buchungen. |

## Mobile Standortnachweis

- Web/Browser: `navigator.geolocation` (freiwillig, fallback ohne Koordinaten).
- Expo-App: nutzt `expo-location`, fordert Berechtigung bei jeder Stempelung an und sendet Koordinaten in die API.

## Sicherheit & Weiteres

- Speichere starke `JWT_SECRET`- und Admin-Passwörter in der `.env`.
- Hinterlege HTTPS sowie zusätzliche Prüfungen (z. B. IP-Range, Geräteverwaltung) je nach Compliance.
- SQLite eignet sich für Demos. Für Produktion empfiehlt sich Postgres + Prisma.
