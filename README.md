# Hyra Labs – Labor Management System

Ein webbasiertes Labor-Management-System auf Basis von React und Vite. Die Anwendung bildet die Kernprozesse der täglichen Probenentnahme, -auswertung und -verwaltung ab.

## Features

- **Probenverwaltung** mit hierarchischer Auswahl (Programm → Anlage → Probenart), Messwerterfassung, Notizfeld, Echtzeitvalidierung und CSV-Export.
- **Programme**, **Anlagen** und **Mitarbeiter** können komfortabel über Modalformulare gepflegt werden.
- **Dashboard** mit zentralen Kennzahlen, Verteilungen und Zeitreihen – dynamisch filterbar nach Zeitraum, Programm, Anlage und Mitarbeiter.
- Moderne Sidebar-Navigation, responsive Layouts sowie farbcodierte Status-Badges für klare visuelle Orientierung.
- Rein clientseitige Datenspeicherung innerhalb der Session (kein LocalStorage).

## Entwicklung

```bash
npm install
npm run dev
```

Der Entwicklungsserver läuft standardmäßig unter <http://localhost:5173>.

Für einen Produktionsbuild:

```bash
npm run build
```

## Technologie-Stack

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- Moderne CSS-Layouts (Flexbox, Grid)

## Lizenz

MIT
