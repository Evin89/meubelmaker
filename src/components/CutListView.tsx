import { areaByThickness, cutList, toCSV } from '../lib/cutlist'
import { download, m2, mm, parseNum, slug } from '../lib/format'
import type { Project } from '../lib/types'
import { useApp } from '../store/useApp'

export function CutListView({ project }: { project: Project }) {
  const setField = useApp((s) => s.setProjectField)
  const rows = cutList(project.items)
  if (!rows.length) return <p className="text-muted">Nog geen onderdelen. Voeg een bouwsteen toe.</p>
  const areas = areaByThickness(rows)
  const factor = 1 + project.waste / 100
  const total = [...areas.values()].reduce((a, b) => a + b, 0)
  return (
    <div className="grid min-w-0 gap-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid w-36 gap-1">
          <label htmlFor="f-waste" className="label">
            Zaagverlies (%)
          </label>
          <input
            id="f-waste"
            className="input font-mono"
            inputMode="decimal"
            defaultValue={project.waste}
            onChange={(e) => {
              const n = parseNum(e.target.value)
              if (n !== null) setField('waste', Math.max(0, n))
            }}
          />
        </div>
        <button className="btn" onClick={() => download(`${slug(project.name)}-zaaglijst.csv`, toCSV(rows), 'text/csv')}>
          Download CSV
        </button>
        <button
          className="btn"
          onClick={() => {
            const { id: _id, ...rest } = project
            void _id
            download(`${slug(project.name)}.json`, JSON.stringify({ app: 'meubelmaker', version: 1, ...rest }, null, 2), 'application/json')
          }}
        >
          Download project (JSON)
        </button>
      </div>
      <div className="overflow-x-auto rounded border border-rule">
        <table className="w-full min-w-[520px] border-collapse text-[0.86rem]">
          <thead>
            <tr className="bg-sunk font-mono text-[0.68rem] tracking-widest text-muted uppercase">
              {['Aantal', 'Lengte × breedte', 'Dikte', 'Onderdelen', 'm²'].map((h) => (
                <th key={h} className="border-b border-rule px-2.5 py-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...areas.keys()].map((t) => (
              <ThicknessGroup key={t} t={t} rows={rows.filter((r) => r.t === t)} area={areas.get(t)!} factor={factor} waste={project.waste} />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-sunk font-bold">
              <td colSpan={4} className="px-2.5 py-2">
                Totaal netto
              </td>
              <td className="px-2.5 py-2 font-mono">{m2(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="max-w-[70ch] text-[0.82rem] text-muted">Maten in mm, lengte is de langste zijde. Gelijke onderdelen zijn samengevoegd.</p>
    </div>
  )
}

function ThicknessGroup({ t, rows, area, factor, waste }: { t: number; rows: ReturnType<typeof cutList>; area: number; factor: number; waste: number }) {
  return (
    <>
      <tr className="bg-paper">
        <th colSpan={5} className="border-b border-rule px-2.5 py-2 text-left font-display text-[0.85rem] [font-stretch:85%]">
          {mm(t)} mm
          <span className="ml-2 font-mono text-[0.75rem] font-medium text-muted">
            {m2(area)} m² netto · {m2(area * factor)} m² met {mm(waste)}% zaagverlies
          </span>
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={`${r.a}-${r.b}`} className="align-top">
          <td className="border-b border-rule px-2.5 py-2 font-mono">{r.count}×</td>
          <td className="border-b border-rule px-2.5 py-2 font-mono whitespace-nowrap">
            {mm(r.a)} × {mm(r.b)}
          </td>
          <td className="border-b border-rule px-2.5 py-2 font-mono">{mm(t)}</td>
          <td className="border-b border-rule px-2.5 py-2 text-muted">
            {[...r.names].map(([n, c]) => (
              <div key={n}>
                {n}
                {c > 1 ? ` (${c})` : ''}
              </div>
            ))}
          </td>
          <td className="border-b border-rule px-2.5 py-2 font-mono">{m2(r.a * r.b * r.count)}</td>
        </tr>
      ))}
    </>
  )
}
