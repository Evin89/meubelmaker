# Meubelmaker

Ontwerp meubels uit bouwstenen of losse platen en zie meteen wat je moet zagen.

- **Bouwstenen:** bak (op binnenmaat), kast met legplanken en achterwand, blad met rand, en een los paneel. Met **Losmaken** zet je een bouwsteen om in losse panelen die je één voor één aanpast.
- **3D:** draaien, uit elkaar schuiven, en een onderdeel aantikken voor de naam en maat.
- **Zaaglijst:** gelijke onderdelen samengevoegd per dikte, met m² netto en met zaagverlies. Te downloaden als CSV.
- **Plaatindeling:** per dikte een plaatmaat kiezen. Je ziet het aantal platen en de benutting, en kunt een SVG in mm downloaden voor de laser of de CNC.
- **Sjablonen:** knutselkist, boekenkast, nachtkastje. Projecten kun je importeren en exporteren als JSON.

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
