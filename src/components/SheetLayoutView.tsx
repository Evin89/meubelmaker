import { useState } from 'react'
import { m2, mm, parseNum } from '../lib/format'
import { exportSVG } from '../platform'
import { nestProject, SHEET_PRESETS, type Sheet } from '../lib/nesting'
import type { Project } from '../lib/types'
import { useApp } from '../store/useApp'

function SheetSvg({ sheet, W, H, index, total }: { sheet: Sheet; W: number; H: number; index: number; total: number }) {
  const fs = Math.max(14, Math.min(W, H) / 32)
  return (
    <figure className="m-0 grid gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Plaat ${index + 1}`} className="block h-auto w-full rounded-sm border border-rule bg-sunk">
        <rect x={0} y={0} width={W} height={H} style={{ fill: 'var(--sheet)', stroke: 'var(--muted)', strokeWidth: W / 400 }} />
        {sheet.placed.map((p, i) => (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} style={{ fill: 'var(--woodfill)', stroke: 'var(--ink)', strokeWidth: W / 600 }} />
            {p.w > fs * 5 && p.h > fs * 1.6 && (
              <text x={p.x + p.w / 2} y={p.y + p.h / 2} fontSize={fs} textAnchor="middle" dominantBaseline="central" fontFamily="monospace" style={{ fill: 'var(--ink)' }}>
                {p.label} {mm(p.w)}×{mm(p.h)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="font-mono text-[0.74rem] text-muted">
        plaat {index + 1} van {total} · {W} × {H}
      </figcaption>
    </figure>
  )
}

export function SheetLayoutView({ project }: { project: Project }) {
  const { setProjectField, setSheet, showToast } = useApp()
  const [own, setOwn] = useState<Record<number, string>>({})
  const groups = nestProject(project)
  if (!groups.length) return <p className="text-muted">Nog geen onderdelen om in te delen.</p>
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid w-36 gap-1">
          <label htmlFor="f-kerf" className="label">
            Zaagsnede (mm)
          </label>
          <input
            id="f-kerf"
            className="input font-mono"
            inputMode="decimal"
            defaultValue={project.kerf}
            onChange={(e) => {
              const n = parseNum(e.target.value)
              if (n !== null) setProjectField('kerf', Math.max(0, n))
            }}
          />
        </div>
        <button className="btn" onClick={exportSVG}>
          Download SVG (laser/CNC)
        </button>
      </div>
      {groups.map((g) => {
        const used = g.sheets.length
        const util = used ? (g.area / (used * g.W * g.H)) * 100 : 0
        const key = `${g.W}x${g.H}`
        const known = SHEET_PRESETS.some(([w, h]) => `${w}x${h}` === key)
        return (
          <div key={g.t} className="grid gap-2.5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-base font-bold">
                {mm(g.t)} mm · {used} {used === 1 ? 'plaat' : 'platen'}
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1">
                  <label htmlFor={`f-sheet-${g.t}`} className="label">
                    Plaatmaat
                  </label>
                  <select
                    id={`f-sheet-${g.t}`}
                    className="input font-mono"
                    value={key}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number)
                      setSheet(g.t, [w, h])
                    }}
                  >
                    {SHEET_PRESETS.map(([w, h]) => (
                      <option key={`${w}x${h}`} value={`${w}x${h}`}>
                        {w} × {h}
                      </option>
                    ))}
                    {!known && <option value={key}>{g.W} × {g.H} (eigen)</option>}
                  </select>
                </div>
                <div className="grid w-40 gap-1">
                  <label htmlFor={`f-own-${g.t}`} className="label">
                    Eigen maat
                  </label>
                  <input
                    id={`f-own-${g.t}`}
                    className="input font-mono"
                    placeholder="bv. 1500x1220"
                    value={own[g.t] ?? ''}
                    onChange={(e) => setOwn((o) => ({ ...o, [g.t]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    onBlur={() => {
                      const v = own[g.t]
                      if (!v) return
                      const m = v.match(/(\d+)\s*[x×*]\s*(\d+)/i)
                      if (!m) return showToast('Typ een maat als 1500x1220')
                      const a = +m[1]
                      const b = +m[2]
                      setSheet(g.t, [Math.max(a, b), Math.min(a, b)])
                      setOwn((o) => ({ ...o, [g.t]: '' }))
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="font-mono text-[0.78rem] text-muted">
              benutting {mm(util)}% · {m2(g.area)} m² onderdelen op {m2(used * g.W * g.H)} m² plaat
            </div>
            {g.over.length > 0 && (
              <p className="text-[0.85rem] font-semibold text-danger">
                {g.over.length} {g.over.length === 1 ? 'onderdeel past' : 'onderdelen passen'} niet op deze plaat:{' '}
                {g.over.map((p) => `${p.item} · ${p.label} ${mm(p.a)}×${mm(p.b)}`).join(', ')}
              </p>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
              {g.sheets.map((s, i) => (
                <SheetSvg key={i} sheet={s} W={g.W} H={g.H} index={i} total={used} />
              ))}
            </div>
          </div>
        )
      })}
      <p className="max-w-[70ch] text-[0.82rem] text-muted">
        Snelle indeling in stroken, met de lange kant langs de plaat. Houtnerf telt niet mee. Goed als inkoopschatting en als startpunt voor je zaagplan.
      </p>
    </div>
  )
}
