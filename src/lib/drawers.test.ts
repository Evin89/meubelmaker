import { describe, expect, it } from 'vitest'
import { makeItem, newProject } from './blocks'
import { cutList } from './cutlist'
import { drawerInner, drawerParts } from './drawers'
import { localParts } from './parts'
import type { Part } from './types'

const overlap = (a: Part, b: Part) =>
  a.x < b.x + b.sx - 1e-6 && b.x < a.x + a.sx - 1e-6 && a.y < b.y + b.sy - 1e-6 && b.y < a.y + a.sy - 1e-6 && a.z < b.z + b.sz - 1e-6 && b.z < a.z + a.sz - 1e-6

const spec = { speling: 2, geleider: 2, zij: 12, bodem: 9, front: 18 }

describe('lades', () => {
  it('maakt een front en een ladebak van vijf delen', () => {
    const p = drawerParts({ x: 18, y: 18, w: 564, h: 200, zBack: 6, zFront: 450 }, spec, 'Lade 1')
    expect(p.map((q) => q.name.split(' · ')[1]).sort()).toEqual(['bodem', 'front', 'voor/achter', 'voor/achter', 'zijkant', 'zijkant'])
    const front = p.find((q) => q.name.endsWith('front'))!
    expect([front.sx, front.sy, front.sz]).toEqual([560, 196, 18])
    expect(front.z + front.sz).toBe(450)
  })

  it('geeft de binnenmaat van de ladebak', () => {
    // 564 breed - 2×2 ruimte - 2×12 wand = 536; diepte 450-18-(6+10)-24 = 392; hoogte 200-2-10-9 = 179
    expect(drawerInner({ x: 18, y: 18, w: 564, h: 200, zBack: 6, zFront: 450 }, spec)).toEqual([536, 392, 179])
  })

  it('past in de kast zonder romp of andere lades te raken', () => {
    const kast = makeItem('kast', { p: { B: 600, H: 700, D: 450, planken: 2, vakken: ['lade', 'lade', 'lade'] } })
    const parts = localParts(kast).parts
    const romp = parts.filter((q) => !q.name.startsWith('Lade'))
    const lade = parts.filter((q) => q.name.startsWith('Lade'))
    expect(lade).toHaveLength(18)
    for (const a of lade) {
      for (const r of romp) expect(overlap(a, r), `${a.name} raakt ${r.name}`).toBe(false)
      for (const b of lade) if (a !== b) expect(overlap(a, b), `${a.name} raakt ${b.name}`).toBe(false)
    }
  })

  it('zonder lade-vakken verandert de kast niet', () => {
    const open = localParts(makeItem('kast', { p: { vakken: ['open', 'open'] } })).parts
    const plain = localParts(makeItem('kast')).parts
    expect(open).toEqual(plain)
  })

  it('schuift na draaien de goede kant op', () => {
    const kast = makeItem('kast', { p: { planken: 0, vakken: ['lade'] } })
    const recht = localParts(kast).parts.find((q) => q.slide)!
    const gedraaid = localParts({ ...kast, rot: 90 }).parts.find((q) => q.slide)!
    expect(recht.slide![0]).toBe(0)
    expect(recht.slide![1]).toBeGreaterThan(0)
    expect(gedraaid.slide![0]).toBeGreaterThan(0)
    expect(gedraaid.slide![1]).toBeCloseTo(0)
  })

  it('ladekast-sjabloon heeft drie fronten in de zaaglijst', () => {
    const rows = cutList(newProject('ladekast').items)
    const fronts = rows.filter((r) => [...r.names.keys()].some((n) => n.includes('front')))
    expect(fronts.reduce((s, r) => s + r.count, 0)).toBe(3)
  })
})
