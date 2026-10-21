import { useEffect, useState } from 'react'
import { BLOCKS, makeItem } from '../lib/blocks'
import { mm, parseNum } from '../lib/format'
import { localParts } from '../lib/parts'
import type { Item, ItemType } from '../lib/types'
import { useApp, useCurrent } from '../store/useApp'

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2.5 border-rule p-3 [&+&]:border-t">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {aside && <small className="text-[0.75rem] text-muted">{aside}</small>}
      </div>
      {children}
    </section>
  )
}

/** Getalveld dat tijdelijke invoer als "1," toestaat en pas bij een geldig getal doorgeeft. */
function NumberField({ id, label, value, onChange, unit = true }: { id: string; label: string; value: number; onChange: (n: number) => void; unit?: boolean }) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if (parseNum(text) !== value) setText(String(value))
    // alleen bijwerken als de waarde van buitenaf verandert, niet tijdens het typen
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={`input font-mono text-[0.85rem] ${unit ? 'pr-9' : ''}`}
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const n = parseNum(e.target.value)
            if (n !== null) onChange(n)
          }}
        />
        {unit && <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[0.7rem] text-muted">mm</span>}
      </div>
    </div>
  )
}

function SelectField({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="input font-mono text-[0.85rem]" value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </div>
  )
}

function derivedText(it: Item) {
  const l = localParts(it)
  switch (it.type) {
    case 'bak':
      return `buitenmaat ${mm(l.fx)} × ${mm(l.fz)} × ${mm(l.fy)}`
    case 'kast': {
      const n = Math.max(0, Math.round(it.p.planken))
      return `vakhoogte ${mm((it.p.H - 2 * it.p.t - n * it.p.t) / (n + 1))} · binnenbreedte ${mm(it.p.B - 2 * it.p.t)}`
    }
    case 'blad':
      return `vrij binnen de rand ${mm(it.p.L - 2 * it.p.randZij)} × ${mm(it.p.B - 2 * it.p.randVoor)}`
    case 'paneel':
      return `${mm(it.p.L)} × ${mm(it.p.B)} × ${mm(it.p.t)}`
  }
}

function Editor({ it }: { it: Item }) {
  const { updateItem, removeItem, duplicateItem, stackItem, loosenItem } = useApp()
  const def = BLOCKS[it.type]
  const setP = (key: string, v: number | string) => updateItem(it.id, (i) => ({ ...i, p: { ...i.p, [key]: v } }) as Item, `item:${it.id}:${key}`)
  const params = it.p as Record<string, number | string>
  return (
    <>
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
        <div className="col-span-2 grid gap-1">
          <label htmlFor="f-name" className="label">
            Naam
          </label>
          <input id="f-name" className="input" value={it.name} onChange={(e) => updateItem(it.id, (i) => ({ ...i, name: e.target.value }), `item:${it.id}:name`)} />
        </div>
        {def.fields.map((f) =>
          f.options ? (
            <SelectField key={f.key} id={`f-${f.key}`} label={f.label} value={String(params[f.key])} options={f.options} onChange={(v) => setP(f.key, v)} />
          ) : (
            <NumberField key={f.key} id={`f-${f.key}`} label={f.label} value={Number(params[f.key])} unit={!f.count} onChange={(n) => setP(f.key, Math.max(0, n))} />
          ),
        )}
        <div className="col-span-2 rounded bg-sunk px-2 py-1.5 font-mono text-[0.75rem] text-muted">{derivedText(it)}</div>
        <div className="col-span-2 mt-1 font-mono text-[0.7rem] font-bold tracking-widest text-muted uppercase">Plaats</div>
        <NumberField id="f-x" label="X (breedte)" value={it.x} onChange={(n) => updateItem(it.id, (i) => ({ ...i, x: n }), `item:${it.id}:x`)} />
        <NumberField id="f-z" label="Z (diepte)" value={it.z} onChange={(n) => updateItem(it.id, (i) => ({ ...i, z: n }), `item:${it.id}:z`)} />
        <NumberField id="f-y" label="Y (hoogte)" value={it.y} onChange={(n) => updateItem(it.id, (i) => ({ ...i, y: n }), `item:${it.id}:y`)} />
        <SelectField id="f-rot" label="Draaiing" value={String(it.rot)} options={{ '0': '0°', '90': '90°' }} onChange={(v) => updateItem(it.id, (i) => ({ ...i, rot: v === '90' ? 90 : 0 }))} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button className="btn" title="Zet bovenop alles wat eronder of erboven staat" onClick={() => stackItem(it.id)}>
          Bovenop zetten
        </button>
        <button className="btn" onClick={() => duplicateItem(it.id)}>
          Dupliceer
        </button>
        {it.type !== 'paneel' && (
          <button className="btn" title="Vervang door losse panelen die je apart kunt aanpassen" onClick={() => loosenItem(it.id)}>
            Losmaken
          </button>
        )}
        <button className="btn btn-danger" onClick={() => removeItem(it.id)}>
          Verwijder
        </button>
      </div>
    </>
  )
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  )
}

export function SidePanel() {
  const cur = useCurrent()
  const { selectedId, select, addItem, toggleHidden } = useApp()
  const sel = cur?.items.find((i) => i.id === selectedId) ?? null
  return (
    <div className="panel grid content-start">
      <Section title="Bouwstenen" aside="maten in mm">
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(BLOCKS) as ItemType[]).map((t) => (
            <button key={t} className="grid rounded border border-dashed border-rule bg-sunk p-2 text-left hover:border-solid hover:border-accent" onClick={() => addItem(makeItem(t))}>
              <b className="text-[0.85rem]">+ {BLOCKS[t].label === 'Blad' ? 'Blad met rand' : BLOCKS[t].label}</b>
              <small className="text-[0.72rem] text-muted">{BLOCKS[t].hint}</small>
            </button>
          ))}
        </div>
      </Section>
      <Section title="In dit project" aside={cur?.items.length ? `${cur.items.length} ${cur.items.length === 1 ? 'bouwsteen' : 'bouwstenen'}` : undefined}>
        <div className="grid max-h-64 gap-1 overflow-auto">
          {!cur && <p className="text-[0.85rem] text-muted">Open of maak een project om te beginnen.</p>}
          {cur && !cur.items.length && <p className="text-[0.85rem] text-muted">Nog leeg. Voeg hierboven een bouwsteen toe.</p>}
          {cur?.items.map((it) => {
            const l = localParts(it)
            return (
              <div
                key={it.id}
                className={`flex items-center rounded border ${it.id === selectedId ? 'border-accent bg-sunk' : 'border-transparent hover:bg-sunk'} ${it.hidden ? 'opacity-55' : ''}`}
              >
                <button
                  aria-current={it.id === selectedId}
                  onClick={() => select(it.id)}
                  className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-1.5 pl-2 text-left"
                >
                  <span className="rounded-sm border border-rule px-1 font-mono text-[0.62rem] font-bold tracking-wider text-muted uppercase">{BLOCKS[it.type].label}</span>
                  <span className="truncate font-semibold">{it.name}</span>
                  <span className="font-mono text-[0.72rem] whitespace-nowrap text-muted">
                    {mm(l.fx)} × {mm(l.fz)} × {mm(l.fy)}
                  </span>
                </button>
                <button
                  className="grid h-7 w-8 shrink-0 place-items-center rounded text-muted hover:text-ink"
                  aria-pressed={!it.hidden}
                  aria-label={it.hidden ? `${it.name} tonen in 3D` : `${it.name} verbergen in 3D`}
                  title={it.hidden ? 'Tonen in 3D (H)' : 'Verbergen in 3D (H)'}
                  onClick={() => toggleHidden(it.id)}
                >
                  <EyeIcon off={!!it.hidden} />
                </button>
              </div>
            )
          })}
        </div>
      </Section>
      <Section title="Eigenschappen" aside={sel ? BLOCKS[sel.type].label : undefined}>
        {sel ? <Editor key={sel.id} it={sel} /> : <p className="text-[0.85rem] text-muted">Selecteer een bouwsteen in de lijst of tik er een aan in 3D.</p>}
      </Section>
    </div>
  )
}
