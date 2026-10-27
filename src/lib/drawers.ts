import type { Part } from './types'

export type DrawerSpec = {
  /** Speling rondom het front (mm) */
  speling: number
  /** Ruimte per kant tussen ladebak en kast, voor hout-op-hout of geleiders (mm) */
  geleider: number
  /** Dikte zijkanten, voor- en achterkant van de ladebak */
  zij: number
  /** Dikte ladebodem (onder de zijkanten) */
  bodem: number
  /** Dikte van het front */
  front: number
}

/** Een vak in lokale coördinaten: binnenkant van de kast, voorkant op `zFront`. */
export type Opening = { x: number; y: number; w: number; h: number; zBack: number; zFront: number }

/** Ruimte boven de ladebak, zodat hij er zonder klemmen in en uit gaat. */
export const TOP_CLEARANCE = 10
/** Ruimte achter de ladebak. */
export const BACK_CLEARANCE = 10
/** Hoe ver een open lade naar voren komt, als deel van de diepte van de bak. */
export const OPEN_FRACTION = 0.7

/**
 * Lade in een vak: een inliggend front (gelijk met de voorkant van de kast) en
 * een ladebak met vier wanden en een bodem eronder. De bak staat op de onderkant van het vak.
 */
export function drawerParts(o: Opening, d: DrawerSpec, label: string): Part[] {
  const parts: Part[] = []
  const s = d.speling
  const fw = o.w - 2 * s
  const fh = o.h - 2 * s
  if (fw <= 0 || fh <= 0) return parts

  const bw = o.w - 2 * d.geleider
  const bh = o.h - s - TOP_CLEARANCE
  const zBoxFront = o.zFront - d.front
  const db = zBoxFront - (o.zBack + BACK_CLEARANCE)
  const wallH = bh - d.bodem
  const slide: [number, number] = [0, Math.max(0, db) * OPEN_FRACTION]
  const add = (name: string, t: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    if (sx > 0 && sy > 0 && sz > 0) parts.push({ name: `${label} · ${name}`, t, x, y, z, sx, sy, sz, slide })
  }

  add('front', d.front, o.x + s, o.y + s, zBoxFront, fw, fh, d.front)
  if (bw <= 2 * d.zij || db <= 2 * d.zij || wallH <= 0) return parts

  const bx = o.x + d.geleider
  const by = o.y
  const bz = zBoxFront - db
  add('bodem', d.bodem, bx, by, bz, bw, d.bodem, db)
  add('zijkant', d.zij, bx, by + d.bodem, bz, d.zij, wallH, db)
  add('zijkant', d.zij, bx + bw - d.zij, by + d.bodem, bz, d.zij, wallH, db)
  add('voor/achter', d.zij, bx + d.zij, by + d.bodem, bz, bw - 2 * d.zij, wallH, d.zij)
  add('voor/achter', d.zij, bx + d.zij, by + d.bodem, zBoxFront - d.zij, bw - 2 * d.zij, wallH, d.zij)
  return parts
}

/** Binnenmaat van de ladebak (breedte × diepte × hoogte), handig voor in het formulier. */
export function drawerInner(o: Opening, d: DrawerSpec): [number, number, number] {
  const bw = o.w - 2 * d.geleider
  const db = o.zFront - d.front - (o.zBack + BACK_CLEARANCE)
  const bh = o.h - d.speling - TOP_CLEARANCE
  return [bw - 2 * d.zij, db - 2 * d.zij, bh - d.bodem]
}
