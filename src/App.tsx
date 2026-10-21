import { lazy, Suspense, useEffect, useState } from 'react'
import { CutListView } from './components/CutListView'
import { SheetLayoutView } from './components/SheetLayoutView'
import { SidePanel } from './components/SidePanel'
import { TopBar } from './components/TopBar'
import { TEMPLATES } from './lib/blocks'
import { m2, mm, woodCss } from './lib/format'
import { nestProject } from './lib/nesting'
import { allParts, boundingBox, cutDims } from './lib/parts'
import type { Project } from './lib/types'
import { useApp, useCurrent } from './store/useApp'

const Viewer3D = lazy(() => import('./components/Viewer3D').then((m) => ({ default: m.Viewer3D })))

type Tab = '3d' | 'cut' | 'nest'
const TABS: [Tab, string][] = [
  ['3d', '3D'],
  ['cut', 'Zaaglijst'],
  ['nest', 'Plaatindeling'],
]

function Summary({ project }: { project: Project }) {
  if (!project.items.length) return null
  const b = boundingBox(project.items)!
  const parts = allParts(project.items)
  const area = parts.reduce((s, q) => {
    const [a, c] = cutDims(q)
    return s + a * c
  }, 0)
  const sheets = nestProject(project).reduce((s, g) => s + g.sheets.length, 0)
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[0.78rem] text-muted">
      <span>
        totaal{' '}
        <b className="text-ink">
          {mm(b.hi[0] - b.lo[0])} × {mm(b.hi[2] - b.lo[2])} × {mm(b.hi[1] - b.lo[1])}
        </b>{' '}
        mm
      </span>
      <span>
        onderdelen <b className="text-ink">{parts.length}</b>
      </span>
      <span>
        hout netto <b className="text-ink">{m2(area)} m²</b>
      </span>
      <span>
        platen <b className="text-ink">{sheets}</b>
      </span>
    </div>
  )
}

function Welcome() {
  const createProject = useApp((s) => s.createProject)
  return (
    <div className="grid justify-items-start gap-4 px-5 py-7">
      <h2 className="text-2xl font-bold">Wat ga je bouwen?</h2>
      <p className="m-0 max-w-[60ch] text-muted">
        Kies een startpunt. Je past daarna maten, plaatdiktes en posities aan, en de zaaglijst en plaatindeling rekenen mee.
      </p>
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        {TEMPLATES.map((t) => (
          <button key={t.key} className="grid gap-1 rounded-md border border-rule bg-sunk p-3.5 text-left hover:border-accent" onClick={() => createProject(t.key)}>
            <b className="font-display text-[1.05rem] [font-stretch:85%]">{t.name}</b>
            <small className="text-muted">{t.desc}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const { load, loaded, selectedId, select, toast } = useApp()
  const project = useCurrent()
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('meubelmaker.tab') as Tab) || '3d')
  const [explode, setExplode] = useState(0)
  const [edges, setEdges] = useState(true)
  const [fitKey, setFitKey] = useState(0)

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => localStorage.setItem('meubelmaker.tab', tab), [tab])

  const thicknesses = project ? [...new Set(allParts(project.items).map((q) => q.t))].sort((a, b) => b - a) : []

  return (
    <div className="mx-auto grid max-w-[1360px] gap-3 px-4 py-4">
      <TopBar />
      <div className="grid items-start gap-3 min-[861px]:grid-cols-[330px_minmax(0,1fr)]">
        <SidePanel />
        <div className="grid min-w-0 gap-2.5">
          {project && <Summary project={project} />}
          <div className="flex gap-0.5 border-b border-rule" role="tablist">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className="-mb-px border-b-2 border-transparent px-3 py-2 text-[0.88rem] font-bold text-muted aria-selected:border-accent aria-selected:text-ink"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="panel min-w-0" role="tabpanel">
            {!loaded ? (
              <p className="p-5 text-muted">Laden…</p>
            ) : !project ? (
              <Welcome />
            ) : tab === '3d' ? (
              <>
                <Suspense fallback={<div className="h-[min(68vh,640px)] min-h-[340px] rounded-t-md bg-scene" />}>
                  <Viewer3D project={project} selectedId={selectedId} onSelect={select} explode={explode} edges={edges} fitKey={fitKey} />
                </Suspense>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule px-3 py-2.5">
                  <label htmlFor="explode" className="flex items-center gap-2 text-[0.82rem] text-muted">
                    Uit elkaar
                    <input id="explode" type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(+e.target.value)} className="w-40 accent-accent" />
                  </label>
                  <label htmlFor="edges" className="flex items-center gap-2 text-[0.82rem] text-muted">
                    <input id="edges" type="checkbox" checked={edges} onChange={(e) => setEdges(e.target.checked)} className="accent-accent" />
                    Lijnen
                  </label>
                  <button className="btn" onClick={() => setFitKey((k) => k + 1)}>
                    Passend in beeld
                  </button>
                  <div className="ml-auto flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.72rem] text-muted">
                    {thicknesses.map((t) => (
                      <span key={t}>
                        <i className="mr-1 inline-block h-2.5 w-3 border border-ink align-[-1px]" style={{ background: woodCss(t) }} />
                        {mm(t)} mm
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="grid min-w-0 gap-3.5 p-3.5">{tab === 'cut' ? <CutListView project={project} /> : <SheetLayoutView project={project} />}</div>
            )}
          </div>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100%-32px)] -translate-x-1/2 rounded bg-ink px-3.5 py-2 text-[0.85rem] text-paper" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
