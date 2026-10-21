import { allParts, cutDims } from './parts'
import type { Project } from './types'

export type NestPart = { a: number; b: number; label: string; item: string }
export type Placed = NestPart & { x: number; y: number; w: number; h: number }
export type Sheet = { placed: Placed[] }
export type NestResult = { sheets: Sheet[]; over: NestPart[] }

export const DEFAULT_SHEET: [number, number] = [2500, 1220]
export const SHEET_PRESETS: [number, number][] = [
  [2500, 1250],
  [2500, 1220],
  [2440, 1220],
  [1220, 610],
  [1200, 600],
  [800, 450],
]

/**
 * Strookindeling (first-fit decreasing, guillotine-zaagbaar): onderdelen op lengte gesorteerd,
 * in horizontale stroken langs de lange kant van de plaat. Draaien mag, houtnerf telt niet mee.
 */
export function nest(parts: NestPart[], W: number, H: number, kerf: number): NestResult {
  // Twee strategieën voor nieuwe stroken (laag of hoog); neem de uitkomst met de minste platen.
  const low = nestWith(parts, W, H, kerf, false)
  const high = nestWith(parts, W, H, kerf, true)
  const score = (r: NestResult) => r.over.length * 1e6 + r.sheets.length * 1e3 - (r.sheets.at(-1)?.placed.length ?? 0) / 1e3
  return score(high) < score(low) ? high : low
}

function nestWith(parts: NestPart[], W: number, H: number, kerf: number, preferTall: boolean): NestResult {
  type Shelf = { y: number; h: number; x: number }
  type S = { shelves: Shelf[]; placed: Placed[]; used: number }
  const eps = 1e-6
  const list = [...parts].sort((p, q) => q.a - p.a || q.b - p.b)
  const sheets: S[] = []
  const over: NestPart[] = []
  const fits = (w: number, h: number) => w <= W + eps && h <= H + eps

  for (const p of list) {
    const ors = ([[p.a, p.b], [p.b, p.a]] as [number, number][]).filter(([w, h]) => fits(w, h))
    if (!ors.length) {
      over.push(p)
      continue
    }
    let best: { s: S; sh: Shelf; w: number; h: number; waste: number } | null = null
    for (const s of sheets)
      for (const sh of s.shelves)
        for (const [w, h] of ors)
          if (h <= sh.h + eps && sh.x + w <= W + eps) {
            const waste = sh.h - h
            if (!best || waste < best.waste) best = { s, sh, w, h, waste }
          }
    if (best) {
      best.s.placed.push({ ...p, x: best.sh.x, y: best.sh.y, w: best.w, h: best.h })
      best.sh.x += best.w + kerf
      continue
    }
    const byHeight = [...ors].sort((u, v) => (preferTall ? v[1] - u[1] : u[1] - v[1]))
    let pick = byHeight[0]
    let s = sheets.find((x) => x.used + pick[1] <= H + eps)
    if (!s && byHeight[1]) {
      const alt = sheets.find((x) => x.used + byHeight[1][1] <= H + eps)
      if (alt) {
        pick = byHeight[1]
        s = alt
      }
    }
    const [w, h] = pick
    if (!s) {
      s = { shelves: [], placed: [], used: 0 }
      sheets.push(s)
    }
    const sh: Shelf = { y: s.used, h, x: w + kerf }
    s.shelves.push(sh)
    s.used += h + kerf
    s.placed.push({ ...p, x: 0, y: sh.y, w, h })
  }
  return { sheets: sheets.map((s) => ({ placed: s.placed })), over }
}

export type ThicknessNest = NestResult & { t: number; W: number; H: number; area: number }

export function sheetFor(project: Project, t: number): [number, number] {
  return project.sheets[String(t)] ?? DEFAULT_SHEET
}

/** Plaatindeling voor alle diktes in een project, dikste eerst. */
export function nestProject(project: Project): ThicknessNest[] {
  const P = allParts(project.items)
  const ts = [...new Set(P.map((q) => q.t))].sort((a, b) => b - a)
  return ts.map((t) => {
    const [W, H] = sheetFor(project, t)
    const parts = P.filter((q) => q.t === t).map((q) => {
      const [a, b] = cutDims(q)
      return { a, b, label: q.name, item: q.itemName }
    })
    return { t, W, H, area: parts.reduce((s, p) => s + p.a * p.b, 0), ...nest(parts, W, H, project.kerf) }
  })
}

const escXml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** SVG in millimeters voor laser of CNC: rood = snijlijn onderdeel, blauw = plaatrand. */
export function nestToSVG(project: Project, groups = nestProject(project)): string {
  const gap = 90
  let y = 0
  let maxW = 0
  let out = ''
  for (const g of groups)
    g.sheets.forEach((s, i) => {
      const fs = Math.max(14, Math.min(g.W, g.H) / 32)
      const rects = s.placed
        .map((p) => {
          const text =
            p.w > fs * 5 && p.h > fs * 1.6
              ? `<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" font-family="monospace">${escXml(p.label)} ${p.w}×${p.h}</text>`
              : ''
          return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="none" stroke="#ff0000" stroke-width="0.2"/>${text}`
        })
        .join('')
      out += `<g transform="translate(0 ${y})"><text x="0" y="-12" font-size="24" font-family="monospace">${g.t} mm · plaat ${i + 1}/${g.sheets.length} · ${g.W}×${g.H}</text><rect x="0" y="0" width="${g.W}" height="${g.H}" fill="none" stroke="#0000ff" stroke-width="0.2"/>${rects}</g>`
      y += g.H + gap
      maxW = Math.max(maxW, g.W)
    })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${maxW}mm" height="${y + 40}mm" viewBox="0 -40 ${maxW} ${y + 40}">\n<!-- ${escXml(project.name)} · Meubelmaker -->\n${out}\n</svg>`
}
