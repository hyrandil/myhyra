# MyHyra Dokumentenserver

MyHyra ist eine moderne, selbst gehostete Dokumentenplattform nach dem Vorbild von paperless-ngx. Die Lösung besteht aus einem FastAPI-Backend mit OCR-gestützter Indexierung sowie einem React-Frontend mit hellem und dunklem Theme.

## Features

- 🔐 Benutzerverwaltung mit JWT-Authentifizierung und optionaler TOTP-Zwei-Faktor-Authentifizierung.
- 📂 Überwachung definierter Netzwerkfreigaben und optional verwalteter Importverzeichnisse (Windows & Linux).
- 🧾 Automatisches Ablegen der Originaldateien im Rohformat sowie Volltextindexierung (SQLite FTS5).
- 🏷️ Tags für flexible Klassifizierung (z. B. Rechnung, Lieferschein, Lohnabrechnung) und Filtersuche.
- 🔍 Volltextsuche über OCR-Inhalte, Titel und Beschreibungen.
- 🖥️ Modernes Frontend mit Light/Dark-Mode, Upload-Dialog, Tag-Filter und Freigabe-Verwaltung.
- 🛠️ Bereitstellung als Docker-Compose-Stack für Windows- und Linux-Hosts, inklusive Tesseract-OCR.

## Projektstruktur

```
backend/   # FastAPI-Anwendung
frontend/  # React + Material UI Frontend
infrastructure/
├─ docker-compose.yml (siehe Root)
└─ ...
```

## Schnellstart mit Docker Compose

Voraussetzungen: Docker und Docker Compose.

```bash
git clone <repo-url>
cd myhyra
docker compose up --build
```

- Backend: http://localhost:8000/docs für die API-Dokumentation.
- Frontend: http://localhost:5173 für die Weboberfläche.

Standard-Login nach dem ersten Start:

- Benutzername: `admin`
- Passwort: `changeme` (bitte im Betrieb sofort ändern!)

Optional kann `ALLOW_USER_REGISTRATION=true` gesetzt werden, um weitere Benutzer über die API zu registrieren.

**2FA-Login:** Beim Login mit aktiviertem TOTP muss der sechsstellige Code als zusätzliches `scope`-Feld übermittelt werden (die Weboberfläche unterstützt dies automatisch).

## Manuelle Entwicklung (ohne Docker)

### Backend

1. Python 3.11 installieren.
2. Abhängigkeiten installieren:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Anwendung starten:
   ```bash
   uvicorn app.main:app --reload
   ```

Konfiguration via `.env` im Backend:

```
SECRET_KEY=wechselmich
DATABASE_URL=sqlite:///./data/app.db
STORAGE_DIR=./data/raw
IMPORT_SHARES_ROOT=./data/import_shares
ALLOW_USER_REGISTRATION=false
ENABLE_OCR=true
```

> **Hinweis:** Für lokale OCR-Verarbeitung müssen Tesseract-OCR sowie Poppler-Binaries installiert sein (Windows: z. B. via Chocolatey).

### Frontend

1. Node.js ≥ 18 installieren.
2. Abhängigkeiten installieren und Entwicklung starten:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Import-Freigaben

- In der UI können beliebige Netzwerkpfade (UNC, NFS, lokale Pfade) hinterlegt werden. Nach erfolgreichem Import werden Dateien am Ursprungsort entfernt.
- Für verwaltete Freigaben legt MyHyra automatisch Unterordner unterhalb des `IMPORT_SHARES_ROOT` an, die anschließend via SMB/WebDAV o. Ä. freigegeben werden können.

## Sicherheit

- Keine Backdoors oder versteckte Accounts.
- Passwörter werden mit BCrypt gehasht.
- JWT-Token mit anpassbarer Ablaufzeit.
- Optionaler 2FA-Support via TOTP.

## Tests

(Beispiel)
```bash
# Backend-Tests
cd backend
pytest
```

## Lizenz

Dieses Projekt dient als Referenzimplementierung und kann nach Bedarf erweitert werden.
