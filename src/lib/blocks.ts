import type { BakParams, BladParams, Item, ItemType, KastParams, PaneelParams, Project } from './types'

export const newId = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

type FieldDef = { key: string; label: string; options?: Record<string, string>; count?: boolean; group?: string; showIf?: (p: Record<string, unknown>) => boolean }

const hasDrawer = (p: Record<string, unknown>) => Array.isArray(p.vakken) && p.vakken.includes('lade')

export const BLOCKS: {
  [K in ItemType]: { label: string; hint: string; defaults: Extract<Item, { type: K }>['p']; fields: FieldDef[] }
} = {
  bak: {
    label: 'Bak',
    hint: 'open bak of lade, op binnenmaat',
    defaults: { L: 440, B: 320, H: 100, wand: 18, bodem: 9, bodemPos: 'onder' } satisfies BakParams,
    fields: [
      { key: 'L', label: 'Binnenlengte' },
      { key: 'B', label: 'Binnenbreedte' },
      { key: 'H', label: 'Binnenhoogte' },
      { key: 'wand', label: 'Wanddikte' },
      { key: 'bodem', label: 'Bodemdikte' },
      { key: 'bodemPos', label: 'Bodem', options: { onder: 'onder de wanden', tussen: 'tussen de wanden' } },
    ],
  },
  kast: {
    label: 'Kast',
    hint: 'romp met legplanken en lades',
    defaults: {
      B: 800,
      H: 900,
      D: 350,
      t: 18,
      planken: 2,
      achter: 'opgezet',
      achterT: 6,
      vakken: [],
      ladeSpeling: 2,
      ladeGeleider: 2,
      ladeZij: 12,
      ladeBodem: 9,
      ladeFront: 18,
    } satisfies KastParams,
    fields: [
      { key: 'B', label: 'Breedte' },
      { key: 'H', label: 'Hoogte' },
      { key: 'D', label: 'Diepte' },
      { key: 't', label: 'Plaatdikte' },
      { key: 'planken', label: 'Legplanken', count: true },
      { key: 'achter', label: 'Achterwand', options: { geen: 'geen', ingelegd: 'ingelegd (tussen zijkanten)', opgezet: 'opgezet (achterop)' } },
      { key: 'achterT', label: 'Dikte achterwand' },
      { key: 'ladeSpeling', label: 'Speling rond front', group: 'Lades', showIf: hasDrawer },
      { key: 'ladeGeleider', label: 'Ruimte per kant', group: 'Lades', showIf: hasDrawer },
      { key: 'ladeFront', label: 'Dikte front', group: 'Lades', showIf: hasDrawer },
      { key: 'ladeZij', label: 'Dikte ladewanden', group: 'Lades', showIf: hasDrawer },
      { key: 'ladeBodem', label: 'Dikte ladebodem', group: 'Lades', showIf: hasDrawer },
    ],
  },
  blad: {
    label: 'Blad',
    hint: 'deksel, tafelblad, dienblad',
    defaults: { L: 600, B: 400, t: 12, randH: 5, randVoor: 25, randZij: 25 } satisfies BladParams,
    fields: [
      { key: 'L', label: 'Lengte' },
      { key: 'B', label: 'Breedte' },
      { key: 't', label: 'Plaatdikte' },
      { key: 'randH', label: 'Randdikte (hoogte)' },
      { key: 'randVoor', label: 'Rand voor/achter breed' },
      { key: 'randZij', label: 'Rand zijkant breed' },
    ],
  },
  paneel: {
    label: 'Paneel',
    hint: 'losse plaat, vrij te plaatsen',
    defaults: { L: 600, B: 300, t: 18, orient: 'plat' } satisfies PaneelParams,
    fields: [
      { key: 'L', label: 'Lengte' },
      { key: 'B', label: 'Breedte' },
      { key: 't', label: 'Dikte' },
      { key: 'orient', label: 'Stand', options: { plat: 'plat (liggend)', 'staand-x': 'staand, langs de breedte', 'staand-z': 'staand, langs de diepte' } },
    ],
  },
}

export function makeItem<T extends ItemType>(
  type: T,
  over: Partial<Omit<Extract<Item, { type: T }>, 'p' | 'type'>> & { p?: Partial<Extract<Item, { type: T }>['p']> } = {},
): Extract<Item, { type: T }> {
  const { p, ...rest } = over
  return {
    id: newId(),
    type,
    name: BLOCKS[type].label,
    x: 0,
    y: 0,
    z: 0,
    rot: 0,
    ...rest,
    p: { ...BLOCKS[type].defaults, ...(p ?? {}) },
  } as unknown as Extract<Item, { type: T }>
}

type Template = { key: string; name: string; desc: string; make: () => Pick<Project, 'name' | 'items'> & Partial<Pick<Project, 'sheets'>> }

const SMALL: [number, number] = [1220, 610]

export const TEMPLATES: Template[] = [
  { key: 'leeg', name: 'Leeg project', desc: 'Begin met een lege werkbank', make: () => ({ name: 'Nieuw meubel', items: [] }) },
  {
    key: 'knutsel',
    name: 'Knutselkist',
    desc: '3 stapelbare bakken + deksel met snijmat',
    make: () => ({
      name: 'Knutselkist',
      sheets: { '18': SMALL, '12': SMALL, '9': SMALL, '5': SMALL },
      items: [
        makeItem('bak', { name: 'Bak diep', p: { L: 440, B: 320, H: 150, wand: 18, bodem: 9 } }),
        makeItem('bak', { name: 'Bak ondiep', y: 159, p: { L: 440, B: 320, H: 50, wand: 18, bodem: 9 } }),
        makeItem('bak', { name: 'Bak ondiep', y: 218, p: { L: 440, B: 320, H: 50, wand: 18, bodem: 9 } }),
        makeItem('blad', { name: 'Deksel', y: 277, p: { L: 476, B: 356, t: 12, randH: 5, randVoor: 26, randZij: 11 } }),
      ],
    }),
  },
  {
    key: 'boek',
    name: 'Boekenkast',
    desc: '80 × 180 cm, 4 legplanken',
    make: () => ({ name: 'Boekenkast', items: [makeItem('kast', { name: 'Boekenkast', p: { B: 800, H: 1800, D: 300, planken: 4 } })] }),
  },
  {
    key: 'nacht',
    name: 'Nachtkastje',
    desc: 'open vak onder, lade boven',
    make: () => ({
      name: 'Nachtkastje',
      items: [makeItem('kast', { name: 'Nachtkastje', p: { B: 450, H: 500, D: 380, planken: 1, vakken: ['open', 'lade'] } })],
    }),
  },
  {
    key: 'ladekast',
    name: 'Ladekast',
    desc: '60 × 70 cm, drie lades',
    make: () => ({
      name: 'Ladekast',
      items: [makeItem('kast', { name: 'Ladekast', p: { B: 600, H: 700, D: 450, planken: 2, vakken: ['lade', 'lade', 'lade'] } })],
    }),
  },
]

export function newProject(key = 'leeg'): Project {
  const t = TEMPLATES.find((x) => x.key === key) ?? TEMPLATES[0]
  const b = t.make()
  return { id: newId(), name: b.name, kerf: 3, waste: 15, sheets: b.sheets ?? {}, items: b.items, updatedAt: Date.now() }
}

/** Project als JSON voor een .meubel- of .json-bestand, zonder id en bestandspad. */
export function serializeProject(p: Project): string {
  const { id: _id, filePath: _path, ...rest } = p
  void _id
  void _path
  return JSON.stringify({ app: 'meubelmaker', version: 1, ...rest }, null, 2)
}

/** Leest een geïmporteerd JSON-project en vult ontbrekende waarden aan. Gooit een fout bij ongeldige invoer. */
export function parseProject(raw: unknown, fallbackName = 'Geïmporteerd'): Project {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { items?: unknown }).items)) throw new Error('Geen Meubelmaker-project')
  const d = raw as Record<string, unknown> & { items: unknown[] }
  const num = (v: unknown, f: number) => (typeof v === 'number' && isFinite(v) ? v : f)
  const items: Item[] = []
  for (const r of d.items) {
    if (!r || typeof r !== 'object') continue
    const i = r as Record<string, unknown>
    const type = i.type as ItemType
    if (!(type in BLOCKS)) continue
    items.push({
      id: newId(),
      type,
      name: typeof i.name === 'string' ? i.name : BLOCKS[type].label,
      x: num(i.x, 0),
      y: num(i.y, 0),
      z: num(i.z, 0),
      rot: i.rot === 90 ? 90 : 0,
      ...(i.hidden === true ? { hidden: true } : {}),
      p: { ...BLOCKS[type].defaults, ...((i.p as object) ?? {}) },
    } as Item)
  }
  return {
    id: newId(),
    name: typeof d.name === 'string' ? d.name : fallbackName,
    kerf: num(d.kerf, 3),
    waste: num(d.waste, 15),
    sheets: (d.sheets as Project['sheets']) ?? {},
    items,
    updatedAt: Date.now(),
  }
}
