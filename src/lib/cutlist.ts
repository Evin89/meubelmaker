import { allParts, cutDims } from './parts'
import type { Item } from './types'

export type CutRow = {
  t: number
  /** Lengte (langste zijde) */
  a: number
  /** Breedte */
  b: number
  count: number
  /** Onderdeelnaam → aantal */
  names: Map<string, number>
}

/** Zaaglijst: gelijke maten per dikte samengevoegd, dikste plaat eerst. */
export function cutList(items: Item[]): CutRow[] {
  const map = new Map<string, CutRow>()
  for (const q of allParts(items)) {
    const [a, b] = cutDims(q)
    const key = `${q.t}|${a}|${b}`
    let row = map.get(key)
    if (!row) {
      row = { t: q.t, a, b, count: 0, names: new Map() }
      map.set(key, row)
    }
    row.count++
    const nm = `${q.itemName} · ${q.name}`
    row.names.set(nm, (row.names.get(nm) ?? 0) + 1)
  }
  return [...map.values()].sort((x, y) => y.t - x.t || y.a - x.a || y.b - x.b)
}

/** Netto oppervlak in mm² per dikte. */
export function areaByThickness(rows: CutRow[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const r of rows) m.set(r.t, (m.get(r.t) ?? 0) + r.a * r.b * r.count)
  return m
}

export function toCSV(rows: CutRow[]): string {
  const lines = ['Dikte (mm);Lengte (mm);Breedte (mm);Aantal;Onderdelen;m2']
  for (const r of rows) {
    const names = [...r.names].map(([n, c]) => n + (c > 1 ? ` (${c})` : '')).join(', ')
    lines.push([r.t, r.a, r.b, r.count, `"${names.replace(/"/g, '""')}"`, ((r.a * r.b * r.count) / 1e6).toFixed(3).replace('.', ',')].join(';'))
  }
  return lines.join('\n')
}
