# MyHyra Zeiterfassung

Vollständiges Beispiel einer Zeiterfassungslösung bestehend aus drei Projekten:

- **server** – Node/Express API mit SQLite, JWT-Login und Standortfeldern.
- **web** – React-Vite-Frontend für Mitarbeitende und Admins.
- **mobile** – Expo/React-Native-App inkl. Standortabfrage fürs Stempeln.

## Features

- Nutzerbasierte Logins (Admin + Mitarbeitende) mit JWT.
- Zentraler Kommen/Gehen-Button, der automatisch den nächsten Schritt anbietet.
- Kommen/Gehen-Stempelung inkl. verpflichtender Standortübermittlung (Browser/App fragen die Freigabe aktiv an).
- Kompakte Kalenderansicht pro Nutzer mit Tageszusammenfassung (Arbeits- & Pausenzeit), eingetragenen Abwesenheiten und Google-Maps-Vorschau der Standorte.
- Admin-Center mit aufklappbaren Bereichen: getrenntes Mitarbeitenden-Menü (Stammdaten/Rolle/Status, Geburtsdatum, Personalnummer, Kontaktdaten), Arbeitszeitplanung pro Wochentag und aufgeräumtes Kalender-/Planungs-Tab mit gestapelter Übersicht.
- Schnelle Mitarbeitenden-Suche nach Name oder Personalnummer in Anlage und Planung.
- Farblegende wie bei timeCard: Urlaub (orange), Krank (rot), Remote (blau) & Sonstiges (grau) direkt im Kalender; offene Buchungen werden mit rotem ✕ markiert, korrekte Buchungen als schwarzer Punkt.
- Admin-Werkzeuge zum Anlegen neuer Nutzer:innen, Bearbeiten von Stammdaten/Rollen, Zurücksetzen von Passwörtern, De-/Aktivieren von Logins sowie manuellen Korrekturen oder Ergänzungen einzelner Buchungen.
- Einstellungsbereich für Mitarbeitende mit Passwortwechsel sowie praxisnahen Optionen wie Sprache, Wochenstart und Zeitformat.
- Urlaubs- & Abwesenheitsverwaltung wie in klassischen Zeiterfassungssystemen: Admins erfassen Urlaub/Krank/Remote/Sonstige mit Start-/Enddatum, pflegen pro Person das Urlaubskontingent, planen Abwesenheitszeiträume und erhalten eine Monatsübersicht zu Anwesenheit & Abwesenheit (Nicht-Arbeitstage laut Plan werden automatisch übersprungen und bei Urlaub nicht abgezogen). Überlappende Abwesenheiten werden überschrieben, sodass Krankheit Urlaubstage verdrängt und doppelte Einträge nicht mehrfach zählen.
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
| GET/PATCH | `/api/users/:id/profile` | (Admin) Stammdaten, Geburtsdatum, Personalnummer & Kontaktdaten pflegen. |
| GET/PUT | `/api/users/:id/schedule` | (Admin) Arbeitszeitplanung pro Wochentag (Minuten) hinterlegen. |
| PATCH | `/api/users/:id/password` | (Admin) Passwort zurücksetzen. |
| PATCH | `/api/users/:id/status` | (Admin) Login eines Mitarbeitenden de-/aktivieren. |
| PATCH | `/api/users/:id` | (Admin) Stammdaten/Rolle eines Nutzers anpassen. |
| PATCH | `/api/users/me/password` | Mitarbeitende ändern ihr eigenes Passwort nach alter Kennwortprüfung. |
| GET/PATCH | `/api/users/me/settings` | Persönliche Einstellungen laden/ändern (Sprache, Wochenstart, Zeitformat). |
| GET | `/api/users/me/schedule` | Eigener Arbeitszeitplan (Minuten je Wochentag) für Kalender/Abwesenheitsgutschriften. |
| PATCH | `/api/users/:id/settings` | (Admin) Urlaubskontingent eines Mitarbeitenden anpassen. |
| GET | `/api/absences/me` | Eigene Abwesenheiten (Urlaub, Krank, Remote, Sonstige) inklusive Bereichen im Kalender laden. |
| GET | `/api/absences/me/summary` | Persönliche Urlaubsauswertung (Kontingent, Resttage). |
| GET | `/api/absences/user/:id` | (Admin) Abwesenheiten eines Mitarbeitenden. |
| POST | `/api/absences/user/:id` | (Admin) Abwesenheitszeiträume mit Start- & Enddatum (volle/halbe Tage), überspringt automatisch freie Tage aus dem Arbeitszeitplan. |
| DELETE | `/api/absences/:id` | (Admin) Abwesenheit entfernen. |
| GET | `/api/absences/summary` | (Admin) Gesamtübersicht aller Urlaubskonten. |
| GET | `/api/reports/attendance?month=YYYY-MM` | (Admin) Monatsreport zu Anwesenheit/Urlaub/Krank/Remote inklusive Resturlaub. |

### Abwesenheiten & Arbeitszeitpläne

- Abwesenheiten werden mit Start- und Enddatum gespeichert und direkt im Kalender markiert; freie Tage aus dem individuellen Arbeitszeitplan (z. B. Wochenenden oder feste Freitage) werden automatisch übersprungen und nicht auf den Urlaub angerechnet.
- Tageszusammenfassungen buchen Abwesenheiten automatisch gut: Krankheit/Remote/Sonstiges füllen bis zum geplanten Soll auf (bereits gestempelte Arbeitszeit wird angerechnet), Urlaub schreibt den Sollwert fest und addiert zusätzlich tatsächlich geleistete Minuten; halbe Tage rechnen je 50 %.
- Admins pflegen pro Mitarbeitendem die Sollzeiten je Wochentag. Diese Planung steuert, welche Tage als Arbeitstage gelten und bildet die Basis für Urlaubssummen, Attendance-Reports und die Monatsübersicht im Admin-Center.
- Mitarbeitende sehen ihre Abwesenheiten in der Tages-Detailansicht; Admins legen Abwesenheiten ausschließlich über das Admin-Menü an (Mitarbeitende können keine eigenen Abwesenheiten erfassen).

## Mobile & Browser Standortnachweis

- Web/Browser: Der große Punch-Button funktioniert nur mit aktiver Geofreigabe (`navigator.geolocation`). Wird sie verweigert, zeigt das UI eine Fehlermeldung.
- Expo-App: nutzt `expo-location`, fordert Berechtigung bei jeder Stempelung an und öffnet Google Maps für gespeicherte Koordinaten.

## Sicherheit & Weiteres

- Speichere starke `JWT_SECRET`- und Admin-Passwörter in der `.env`.
- Hinterlege HTTPS sowie zusätzliche Prüfungen (z. B. IP-Range, Geräteverwaltung) je nach Compliance.
- SQLite eignet sich für Demos. Für Produktion empfiehlt sich Postgres + Prisma.
