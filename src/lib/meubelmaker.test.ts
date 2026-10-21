import { describe, expect, it } from 'vitest'
import { makeItem, newProject, parseProject } from './blocks'
import { areaByThickness, cutList, toCSV } from './cutlist'
import { nest, nestProject } from './nesting'
import { boundingBox, cutDims, explodeToPanels, localParts, stackHeight } from './parts'

describe('bouwstenen', () => {
  it('bak op binnenmaat geeft de juiste buitenmaat', () => {
    const l = localParts(makeItem('bak', { p: { L: 440, B: 320, H: 50, wand: 18, bodem: 9 } }))
    expect([l.fx, l.fy, l.fz]).toEqual([476, 59, 356])
    expect(l.parts).toHaveLength(5)
  })

  it('bak met bodem tussen de wanden houdt dezelfde binnenhoogte', () => {
    const l = localParts(makeItem('bak', { p: { L: 400, B: 300, H: 100, wand: 18, bodem: 9, bodemPos: 'tussen' } }))
    const bodem = l.parts.find((p) => p.name === 'Bodem')!
    expect([bodem.sx, bodem.sz]).toEqual([400, 300])
    expect(l.fy).toBe(109)
  })

  it('kast verdeelt legplanken gelijk', () => {
    const l = localParts(makeItem('kast', { p: { B: 800, H: 1800, D: 300, t: 18, planken: 4, achter: 'opgezet', achterT: 6 } }))
    const planken = l.parts.filter((p) => p.name === 'Legplank').map((p) => p.y)
    const gap = (1800 - 36 - 4 * 18) / 5
    expect(planken[0]).toBeCloseTo(18 + gap)
    expect(planken[1] - planken[0]).toBeCloseTo(gap + 18)
    const achter = l.parts.find((p) => p.name === 'Achterwand')!
    expect(achter.t).toBe(6)
  })

  it('draaien over 90° verwisselt breedte en diepte', () => {
    const it0 = makeItem('bak', { p: { L: 440, B: 320, H: 50 } })
    const l = localParts({ ...it0, rot: 90 })
    expect([l.fx, l.fz]).toEqual([356, 476])
    for (const p of l.parts) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x + p.sx).toBeLessThanOrEqual(l.fx + 1e-9)
      expect(p.z + p.sz).toBeLessThanOrEqual(l.fz + 1e-9)
    }
  })

  it('zaagmaat laat de dikte weg', () => {
    expect(cutDims({ name: 'x', t: 18, x: 0, y: 0, z: 0, sx: 18, sy: 150, sz: 320 })).toEqual([320, 150])
  })
})

describe('knutselkist-sjabloon', () => {
  const p = newProject('knutsel')

  it('is 476 × 356 × 294 mm', () => {
    const b = boundingBox(p.items)!
    expect(b.hi.map((v, i) => v - b.lo[i])).toEqual([476, 294, 356])
  })

  it('heeft dezelfde netto m² als de bouwtekening', () => {
    const area = areaByThickness(cutList(p.items))
    expect(area.get(18)! / 1e6).toBeCloseTo(0.398, 3)
    expect(area.get(9)! / 1e6).toBeCloseTo(0.508, 3)
    expect(area.get(12)! / 1e6).toBeCloseTo(0.169, 3)
  })

  it('past in 18 mm en 9 mm op één paneel van 1220 × 610', () => {
    const n = nestProject(p)
    expect(n.find((g) => g.t === 18)!.sheets).toHaveLength(1)
    expect(n.find((g) => g.t === 9)!.sheets).toHaveLength(1)
  })

  it('bovenop zetten stapelt op de hoogste overlappende bouwsteen', () => {
    const deksel = p.items[3]
    expect(stackHeight(deksel, p.items)).toBe(277)
  })

  it('losmaken levert evenveel panelen met dezelfde zaaglijst', () => {
    let k = 0
    const loose = p.items.flatMap((it) => explodeToPanels(it, () => String(k++)))
    expect(cutList(loose).map((r) => [r.t, r.a, r.b, r.count])).toEqual(cutList(p.items).map((r) => [r.t, r.a, r.b, r.count]))
  })

  it('CSV heeft een kop en een regel per maat', () => {
    expect(toCSV(cutList(p.items)).split('\n')).toHaveLength(1 + cutList(p.items).length)
  })
})

describe('plaatindeling', () => {
  it('overlapt nooit en blijft binnen de plaat', () => {
    const parts = Array.from({ length: 30 }, (_, i) => ({ a: 300 + ((i * 137) % 900), b: 80 + ((i * 53) % 400), label: `p${i}`, item: 'x' }))
    const r = nest(parts, 2500, 1220, 3)
    expect(r.over).toHaveLength(0)
    expect(r.sheets.reduce((s, x) => s + x.placed.length, 0)).toBe(30)
    for (const s of r.sheets) {
      for (const a of s.placed) {
        expect(a.x + a.w).toBeLessThanOrEqual(2500)
        expect(a.y + a.h).toBeLessThanOrEqual(1220)
        for (const b of s.placed)
          if (a !== b) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true)
      }
    }
  })

  it('meldt onderdelen die te groot zijn voor de plaat', () => {
    expect(nest([{ a: 3000, b: 100, label: 'lang', item: 'x' }], 2500, 1220, 3).over).toHaveLength(1)
  })
})

describe('import', () => {
  it('vult ontbrekende parameters aan en negeert onbekende types', () => {
    const p = parseProject({ name: 'Test', items: [{ type: 'bak', p: { L: 200 } }, { type: 'stoel' }] })
    expect(p.items).toHaveLength(1)
    expect(p.items[0].type === 'bak' && p.items[0].p.wand).toBe(18)
  })
  it('weigert iets dat geen project is', () => {
    expect(() => parseProject({ foo: 1 })).toThrow()
  })
})
