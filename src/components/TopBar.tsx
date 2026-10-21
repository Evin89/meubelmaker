import { useEffect, useRef, useState } from 'react'
import { parseProject, TEMPLATES } from '../lib/blocks'
import { useApp, useCurrent } from '../store/useApp'

const STATUS = { idle: '', saving: 'Opslaan…', saved: 'Opgeslagen in deze browser', error: 'Niet opgeslagen' } as const

export function TopBar() {
  const { projects, saveState, openProject, createProject, duplicateProject, deleteProject, renameProject, importProject, showToast } = useApp()
  const cur = useCurrent()
  const [menu, setMenu] = useState(false)
  const [armed, setArmed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(t)
  }, [armed])

  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="panel flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <div className="mr-1.5 font-display text-xl leading-none font-extrabold [font-stretch:80%]">
        Meubel<span className="text-accent">maker</span>
      </div>
      <select className="input w-auto max-w-56 flex-[0_1_220px]" aria-label="Project kiezen" value={cur?.id ?? ''} disabled={!sorted.length} onChange={(e) => openProject(e.target.value)}>
        {sorted.length ? sorted.map((p) => <option key={p.id} value={p.id}>{p.name || 'Naamloos'}</option>) : <option value="">Nog geen projecten</option>}
      </select>
      <input
        className="input flex-[1_1_180px] font-semibold"
        aria-label="Projectnaam"
        placeholder="Projectnaam"
        disabled={!cur}
        value={cur?.name ?? ''}
        onChange={(e) => renameProject(e.target.value)}
      />
      <div className="relative" ref={menuRef}>
        <button className="btn btn-primary" aria-haspopup="true" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          Nieuw project
        </button>
        {menu && (
          <div className="absolute top-[calc(100%+4px)] left-0 z-20 grid min-w-60 gap-0.5 rounded-md border border-rule bg-sheet p-1.5 shadow-lg">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                className="grid rounded px-2.5 py-1.5 text-left hover:bg-sunk"
                onClick={() => {
                  setMenu(false)
                  createProject(t.key)
                }}
              >
                <b>{t.name}</b>
                <small className="text-[0.75rem] text-muted">{t.desc}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="btn" disabled={!cur} onClick={duplicateProject}>
        Dupliceer
      </button>
      <button className="btn" onClick={() => fileRef.current?.click()}>
        Importeer JSON
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            importProject(parseProject(JSON.parse(await f.text()), f.name.replace(/\.json$/, '')))
          } catch {
            showToast('Dit bestand is geen Meubelmaker-project.')
          }
        }}
      />
      <button
        className={`btn btn-danger ${armed ? '!border-danger !bg-danger !text-sheet' : ''}`}
        disabled={!cur}
        onClick={() => {
          if (!armed) return setArmed(true)
          setArmed(false)
          void deleteProject()
        }}
      >
        {armed ? 'Echt verwijderen?' : 'Verwijder'}
      </button>
      <span className={`ml-auto font-mono text-[0.75rem] whitespace-nowrap ${saveState === 'saved' ? 'text-ok' : 'text-muted'}`} aria-live="polite">
        {STATUS[saveState]}
      </span>
    </div>
  )
}
