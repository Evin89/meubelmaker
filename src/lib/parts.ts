import type { Footprint, Item, Part, WorldPart } from './types'

const EPS = 1e-6

/** Onderdelen van een bouwsteen in lokale coördinaten, plus de buitenmaat. */
export function localParts(it: Item): { parts: Part[] } & Footprint {
  const parts: Part[] = []
  const add = (name: string, t: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    if (sx > 0 && sy > 0 && sz > 0) parts.push({ name, t, x, y, z, sx, sy, sz })
  }
  let fx = 0
  let fy = 0
  let fz = 0

  switch (it.type) {
    case 'bak': {
      const { L, B, H, wand: w, bodem: b, bodemPos } = it.p
      const oL = L + 2 * w
      const oB = B + 2 * w
      const onder = bodemPos !== 'tussen'
      const y0 = onder ? b : 0
      const wh = onder ? H : H + b
      if (onder) add('Bodem', b, 0, 0, 0, oL, b, oB)
      else add('Bodem', b, w, 0, w, L, b, B)
      add('Lange wand', w, 0, y0, 0, oL, wh, w)
      add('Lange wand', w, 0, y0, oB - w, oL, wh, w)
      add('Korte wand', w, 0, y0, w, w, wh, B)
      add('Korte wand', w, oL - w, y0, w, w, wh, B)
      fx = oL
      fy = y0 + wh
      fz = oB
      break
    }
    case 'kast': {
      const { B, H, D, t, planken, achter, achterT } = it.p
      const ta = achter === 'opgezet' ? achterT : 0
      const inl = achter === 'ingelegd'
      const zd = ta + (inl ? t : 0)
      const hd = D - zd
      add('Zijkant', t, 0, 0, ta, t, H, D - ta)
      add('Zijkant', t, B - t, 0, ta, t, H, D - ta)
      add('Bodem', t, t, 0, zd, B - 2 * t, t, hd)
      add('Top', t, t, H - t, zd, B - 2 * t, t, hd)
      const n = Math.max(0, Math.round(planken))
      const gap = (H - 2 * t - n * t) / (n + 1)
      for (let i = 1; i <= n; i++) add('Legplank', t, t, t + i * gap + (i - 1) * t, zd, B - 2 * t, t, hd)
      if (inl) add('Achterwand', t, t, t, ta, B - 2 * t, H - 2 * t, t)
      if (achter === 'opgezet') add('Achterwand', ta, 0, 0, 0, B, H, ta)
      fx = B
      fy = H
      fz = D
      break
    }
    case 'blad': {
      const { L, B, t, randH: h, randVoor: rv, randZij: rz } = it.p
      add('Bladplaat', t, 0, 0, 0, L, t, B)
      if (h > 0) {
        add('Rand voor/achter', h, 0, t, 0, L, h, rv)
        add('Rand voor/achter', h, 0, t, B - rv, L, h, rv)
        add('Rand zijkant', h, 0, t, rv, rz, h, B - 2 * rv)
        add('Rand zijkant', h, L - rz, t, rv, rz, h, B - 2 * rv)
      }
      fx = L
      fy = t + h
      fz = B
      break
    }
    case 'paneel': {
      const { L, B, t, orient } = it.p
      if (orient === 'staand-x') {
        add('Paneel', t, 0, 0, 0, L, B, t)
        ;[fx, fy, fz] = [L, B, t]
      } else if (orient === 'staand-z') {
        add('Paneel', t, 0, 0, 0, t, B, L)
        ;[fx, fy, fz] = [t, B, L]
      } else {
        add('Paneel', t, 0, 0, 0, L, t, B)
        ;[fx, fy, fz] = [L, t, B]
      }
      break
    }
  }

  if (it.rot === 90) {
    for (const q of parts) {
      const nx = q.z
      const nz = fx - q.x - q.sx
      q.x = nx
      q.z = nz
      ;[q.sx, q.sz] = [q.sz, q.sx]
    }
    ;[fx, fz] = [fz, fx]
  }
  return { parts, fx, fy, fz }
}

/** Onderdelen in wereldcoördinaten, met verwijzing naar de bouwsteen. */
export function worldParts(it: Item): { parts: WorldPart[] } & Footprint {
  const l = localParts(it)
  return {
    ...l,
    parts: l.parts.map((q) => ({ ...q, x: q.x + it.x, y: q.y + it.y, z: q.z + it.z, itemId: it.id, itemName: it.name })),
  }
}

export function allParts(items: Item[]): WorldPart[] {
  return items.flatMap((it) => worldParts(it).parts)
}

/** Zaagmaat van een onderdeel: [lengte, breedte], lengte is de langste zijde. */
export function cutDims(q: Part): [number, number] {
  const d = [q.sx, q.sy, q.sz]
  const i = d.findIndex((v) => Math.abs(v - q.t) < EPS)
  if (i >= 0) d.splice(i, 1)
  else {
    d.sort((a, b) => a - b)
    d.shift()
  }
  d.sort((a, b) => b - a)
  return [d[0], d[1]]
}

/** Buitenmaat van alle bouwstenen samen. */
export function boundingBox(items: Item[]): { lo: [number, number, number]; hi: [number, number, number] } | null {
  let lo: [number, number, number] | null = null
  let hi: [number, number, number] = [0, 0, 0]
  for (const it of items) {
    const l = localParts(it)
    const a: [number, number, number] = [it.x, it.y, it.z]
    const b: [number, number, number] = [it.x + l.fx, it.y + l.fy, it.z + l.fz]
    if (!lo) {
      lo = a
      hi = b
    } else {
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], a[k])
        hi[k] = Math.max(hi[k], b[k])
      }
    }
  }
  return lo ? { lo, hi } : null
}

/** Hoogte waarop een bouwsteen bovenop alles komt te staan waarmee hij overlapt in bovenaanzicht. */
export function stackHeight(it: Item, items: Item[]): number {
  const l = localParts(it)
  let top = 0
  for (const o of items) {
    if (o.id === it.id) continue
    const lo = localParts(o)
    const overlap = o.x < it.x + l.fx && o.x + lo.fx > it.x && o.z < it.z + l.fz && o.z + lo.fz > it.z
    if (overlap) top = Math.max(top, o.y + lo.fy)
  }
  return top
}

/** Zet een bouwsteen om in losse panelen op dezelfde plek. */
export function explodeToPanels(it: Item, newId: () => string): Item[] {
  return worldParts(it).parts.map((q) => {
    let orient: 'plat' | 'staand-x' | 'staand-z'
    let L: number
    let B: number
    if (Math.abs(q.sy - q.t) < EPS) {
      orient = 'plat'
      L = q.sx
      B = q.sz
    } else if (Math.abs(q.sz - q.t) < EPS) {
      orient = 'staand-x'
      L = q.sx
      B = q.sy
    } else {
      orient = 'staand-z'
      L = q.sz
      B = q.sy
    }
    return { id: newId(), type: 'paneel', name: `${it.name} · ${q.name}`, x: q.x, y: q.y, z: q.z, rot: 0, p: { L, B, t: q.t, orient } }
  })
}
