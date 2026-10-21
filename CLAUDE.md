# Meubelmaker

Web-app om meubels te ontwerpen uit bouwstenen (bak, kast, blad met rand) of losse panelen, met 3D-weergave, zaaglijst, m² en plaatindeling. Gebruiker: Evin (Builder Basement). Hij maakt meubels van multiplex die hij lijmt en schroeft, en heeft een CNC (Two Trees TTC 450 Pro) en toegang tot lasersnijders.

## Commando's

- `npm run dev` start de dev-server
- `npm test` voert de Vitest-tests uit (`src/**/*.test.ts`)
- `npm run typecheck` controleert de types
- `npm run lint` draait oxlint
- `npm run build` maakt de productiebuild in `dist/`

Draai `npm test`, `npm run typecheck` en `npm run lint` voordat je iets oplevert.

## Stack

Vite + React 19 + TypeScript (strict) + Tailwind v4 (`@tailwindcss/vite`), three.js via `@react-three/fiber` en `@react-three/drei`, state in zustand. Dezelfde basis als MordheimManager. Hosting is bedoeld voor Cloudflare Pages (statische build), opslag later via Supabase.

## Opbouw

- `src/lib/` bevat de pure domeinlogica, zonder React of DOM. Alles wat rekent hoort hier en krijgt tests.
  - `types.ts`: `Item` (bouwsteen), `Part` (plaatonderdeel als asgerichte balk), `Project`
  - `parts.ts`: `localParts` zet een bouwsteen om in onderdelen. Ook `cutDims`, `boundingBox`, `stackHeight` (bovenop zetten) en `explodeToPanels` (losmaken)
  - `blocks.ts`: definities van de bouwstenen (standaardwaarden, formuliervelden), de sjablonen en `parseProject` voor import
  - `cutlist.ts`: zaaglijst, m² per dikte, CSV
  - `nesting.ts`: plaatindeling in stroken en SVG-export voor laser/CNC
  - `storage.ts`: de `ProjectStore`-interface met een localStorage-implementatie
- `src/store/useApp.ts`: zustand-store voor projecten, selectie, mutaties, ongedaan maken en vertraagd opslaan
- `src/useShortcuts.ts`: sneltoetsen (ook de lijst in de app staat hier)
- `src/components/`: TopBar, SidePanel (bouwstenen, lijst, eigenschappen), Viewer3D (lazy geladen), CutListView, SheetLayoutView

## Conventies

- **Alle maten in mm.** Assen: x = breedte, y = hoogte, z = diepte, en de voorkant is +z. In 3D geldt 1 eenheid = 1 m (`S = 0.001`).
- Een `Part` is altijd een asgerichte balk met positie = de hoek met de kleinste x, y en z. De dikte `t` hoort bij één van `sx/sy/sz`. `cutDims` gebruikt dat om de zaagmaat te bepalen.
- Draaien kan alleen in stappen van 90° om de y-as (`rot: 0 | 90`).
- Een nieuwe bouwsteen voeg je toe in drie stappen: een type in `types.ts`, een `case` in `localParts` en een definitie in `BLOCKS`. Het formulier wordt dan automatisch gemaakt.
- UI-tekst is Nederlands, kort en direct, en beschrijft wat de knop doet ("Bovenop zetten", "Losmaken"). Geen emoji.
- Kleuren komen alleen uit de CSS-tokens in `src/index.css` (licht en donker). Gebruik Tailwind-klassen zoals `bg-sheet`, `text-muted`, `border-rule` en `text-accent`, geen losse kleurwaarden.
- Houd de domeinlogica vrij van React, zodat hij te testen blijft.
- Elke wijziging aan een project loopt via `mutate` in de store, zodat ongedaan maken werkt. Geef bij invoer die per toetsaanslag verandert (velden, pijltjes) een `group` mee, bv. `item:<id>:<veld>`. Wijzigingen met dezelfde groep binnen 800 ms worden één stap.
- Slepen in 3D (`Viewer3D`, pure rekenregels in `lib/snap.ts`) werkt alleen op de geselecteerde bouwsteen, zodat slepen op een andere bouwsteen het beeld blijft draaien. Elke sleepbeweging heeft een groep `session:drag:…` en is daardoor één ongedaan-maakstap, hoe lang hij ook duurt.
- `hidden` op een bouwsteen verbergt hem alleen in 3D. Zaaglijst en plaatindeling tellen hem wel mee.
- 3D-labels zijn gewone DOM-elementen die `LabelProjector` elk frame op hun plek zet. drei `Html` liet met React 19 het eerste label leeg.

## Bekende beperkingen

- De plaatindeling is een strookindeling (first-fit decreasing met twee strategieën). Hij houdt geen rekening met houtnerf en is niet optimaal.
- Er zijn nog geen uitsparingen (vinger- en handgaten), deuvels of verbindingen.
- Projecten staan in localStorage en blijven dus in één browser.

## Roadmap (ideeën van Evin)

1. Opslag via Supabase (een `ProjectStore`-implementatie) met login, zodat projecten op elk apparaat beschikbaar zijn
2. Uitsparingen en gaten in onderdelen (vingergat, handgat, deuvelgaten), ook in de SVG-export
3. Vingerverbindingen voor lasersnijden en DXF-export voor de CNC
4. Lade als eigen bouwsteen (met front en speling) en scharnierende deksels
5. Houtnerfrichting per onderdeel en een betere plaatindeling (maxrects)
6. Een PDF-bouwtekening met aanzichten en maatvoering
7. Deploy naar Cloudflare Pages
