/** Alle maten zijn in millimeters. Assenstelsel: x = breedte, y = hoogte, z = diepte (voorkant = +z). */

export type BakParams = {
  /** Binnenlengte (langs x) */
  L: number
  /** Binnenbreedte (langs z) */
  B: number
  /** Binnenhoogte, gemeten vanaf de bovenkant van de bodem */
  H: number
  wand: number
  bodem: number
  bodemPos: 'onder' | 'tussen'
}

export type KastParams = {
  /** Buitenbreedte */
  B: number
  /** Buitenhoogte */
  H: number
  /** Buitendiepte, inclusief een opgezette achterwand */
  D: number
  t: number
  planken: number
  achter: 'geen' | 'ingelegd' | 'opgezet'
  achterT: number
}

export type BladParams = {
  L: number
  B: number
  t: number
  /** Dikte van het randmateriaal = hoogte van de rand boven de plaat */
  randH: number
  randVoor: number
  randZij: number
}

export type PaneelParams = {
  L: number
  B: number
  t: number
  orient: 'plat' | 'staand-x' | 'staand-z'
}

type ItemBase = {
  id: string
  name: string
  x: number
  y: number
  z: number
  rot: 0 | 90
  /** Verborgen in 3D; telt wel mee in zaaglijst en plaatindeling. */
  hidden?: boolean
}

export type Item =
  | (ItemBase & { type: 'bak'; p: BakParams })
  | (ItemBase & { type: 'kast'; p: KastParams })
  | (ItemBase & { type: 'blad'; p: BladParams })
  | (ItemBase & { type: 'paneel'; p: PaneelParams })

export type ItemType = Item['type']

/** Eén plaatonderdeel als asgerichte balk. Positie = hoek met de kleinste x, y, z. */
export type Part = {
  name: string
  /** Plaatdikte */
  t: number
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
}

export type WorldPart = Part & { itemId: string; itemName: string }

export type Footprint = { fx: number; fy: number; fz: number }

export type Project = {
  id: string
  name: string
  /** Zaagsnede in mm */
  kerf: number
  /** Zaagverlies in procenten, voor de bruto m² */
  waste: number
  /** Plaatmaat per dikte, sleutel = dikte als string, waarde = [lengte, breedte] */
  sheets: Record<string, [number, number]>
  items: Item[]
  updatedAt: number
}
