# Meubelmaker

Ontwerp meubels uit bouwstenen of losse platen en zie meteen wat je moet zagen.

- **Bouwstenen:** bak (op binnenmaat), kast met legplanken, achterwand en per vak een lade (inliggend front, speling en wanddiktes instelbaar), blad met rand, en een los paneel. Met **Losmaken** zet je een bouwsteen om in losse panelen die je één voor één aanpast.
- **3D:** draaien, uit elkaar schuiven, een onderdeel aantikken voor de naam en maat, maatlijnen, aanzichten (3D, voor, zij, boven), lades open schuiven en bouwstenen verbergen.
- **Bewerken:** de geselecteerde bouwsteen slepen in 3D (raster 10 mm, Shift = hoogte, Alt = 1 mm), ongedaan maken en opnieuw doen, en sneltoetsen voor verplaatsen (pijltjes), dupliceren en verwijderen.
- **Zaaglijst:** gelijke onderdelen samengevoegd per dikte, met m² netto en met zaagverlies. Te downloaden als CSV.
- **Plaatindeling:** per dikte een plaatmaat kiezen. Je ziet het aantal platen en de benutting, en kunt een SVG in mm downloaden voor de laser of de CNC.
- **Sjablonen:** knutselkist, boekenkast, nachtkastje, ladekast. Projecten kun je importeren en exporteren als JSON.

## Desktopapp (Windows)

De Meubelmaker bestaat ook als desktopprogramma (Electron), met:

- een eigen venster en menu
- projecten als `.meubel`-bestanden: Opslaan (Ctrl+S), Opslaan als en Openen (Ctrl+O). Dubbelklikken op een `.meubel`-bestand opent het project.
- exports met een opslaan-venster
- offline werken: de lettertypes zitten in de app

**Downloaden:** elke push naar `main` bouwt een installer via GitHub Actions. Ga op GitHub naar *Actions → Desktopapp (Windows) → de laatste run → Artifacts → Meubelmaker-Windows*. Daarin zit `Meubelmaker Setup x.y.z.exe` (installer) en een zip die zonder installeren werkt.

Zelf bouwen of starten:

```bash
npm run desktop       # bouwen en starten
npm run desktop:dev   # met de dev-server (hot reload)
npm run dist:win      # installer + zip in release/ (op Windows; op Linux alleen de zip, zonder wine)
```

## Starten

```bash
npm install
npm run dev
```

## Controleren

```bash
npm test          # domeinlogica (Vitest)
npm run typecheck
npm run lint
npm run build
```

Stack: Vite, React, TypeScript, Tailwind v4, three.js (react-three-fiber) en zustand. Zie `CLAUDE.md` voor de opbouw, de conventies en de roadmap.
