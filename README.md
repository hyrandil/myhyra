# MyHyra

MyHyra ist eine schlanke Web-App zur Lager- und Versandverwaltung für Sammelkarten (Yu-Gi-Oh!, Pokémon und One Piece). Das System kombiniert Inventarisierung, Barcode-gestützte Picklisten und den Import von Cardmarket-Bestellungen in einem Next.js 14 Stack.

## Funktionsumfang

- **Inventarisierung**: Formular zur Erfassung neuer Karten inklusive automatischer Item-Code-Generierung und Etikettendruck.
- **Lagerorte**: Verwaltung von Locations (z. B. `A-03-12`) und direkte Verknüpfung beim Anlegen von Items.
- **Bestellimport**: Serverseitiges PDF-Parsing (Cardmarket) inkl. Matching vorhandener Item-Codes und Anlegen von Picklisten.
- **Barcode-Scanning**: Kamera-basierter Scan-Modus für Picken & Verifizieren mit Rückmeldung zum Lagerort.
- **Audit Trail**: Scan-Logs dokumentieren jeden Inventur-, Pick- oder Verify-Vorgang.

## Technologiestack

- **Frontend & API**: Next.js 14 (App Router) mit TypeScript, Tailwind CSS und shadcn-inspirierten UI-Patterns.
- **Datenbank**: PostgreSQL mit Prisma ORM.
- **Barcode & Scan**: `bwip-js` für Etiketten, `@zxing/browser` für Kamerascans.
- **Validierung**: Zod für API-Validierungen.
- **PDF-Verarbeitung**: `pdf-parse` für serverseitige Textextraktion.

## Entwicklung starten

```bash
npm install
npm run dev
```

Die Anwendung läuft anschließend unter [http://localhost:3000](http://localhost:3000).

## Betrieb im Docker-Container

### Image lokal bauen

```bash
docker build -t myhyra:latest .
```

### Mit Docker Compose starten

```bash
docker compose up --build
```

Die Compose-Umgebung startet einen PostgreSQL-Container (`db`) und die Anwendung (`app`). Beim Start führt der `app`-Container automatisch `prisma migrate deploy` aus, sodass Schemaänderungen direkt angewendet werden. Nach dem erfolgreichen Start ist die App unter [http://localhost:3000](http://localhost:3000) erreichbar.

### Umgebungsvariablen

Kopiere `.env.example` zu `.env` und passe mindestens den Datenbank-Zugang an.

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/myhyra?schema=public"
DEFAULT_USER_EMAIL="demo@example.com"
```

> Hinweis: Wenn `DEFAULT_USER_EMAIL` nicht gesetzt ist, legt die Anwendung automatisch einen Demo-Benutzer (`demo@example.com`) an.

## Kern-Workflows

### Inventarisieren
1. Formular unter `/inventory/new` ausfüllen und speichern.
2. Item-Code wird generiert, Barcode-Preview erscheint und Etikett kann gedruckt werden.
3. Über `/labels/{itemCode}` steht eine Druckansicht bereit.

### Bestellung importieren
1. Cardmarket-PDF per POST an `/api/import-order` hochladen.
2. Service extrahiert Order-Nummer und Item-Codes, legt bzw. aktualisiert den Auftrag.
3. Pickliste per `/api/picklist/{orderId}` abrufen.

### Picken & Verifizieren
1. Scan-Ansicht unter `/scan` öffnen.
2. Barcode scannen, System bestätigt Item und Lagerort.
3. Optional `orderId` beim API-Call mitschicken, um Positionen zu markieren.

## Weitere Schritte

- NextAuth-Integration für echte Benutzerkonten
- UI-Listen für Inventar, Locations und Aufträge
- Versandlabel-Integration und erweiterte Laufwegeoptimierung

Viel Spaß beim Ausbau des Systems!
