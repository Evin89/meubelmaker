import { create } from 'zustand'
import { newId, newProject } from '../lib/blocks'
import { explodeToPanels, localParts, stackHeight } from '../lib/parts'
import { localStore, type ProjectStore } from '../lib/storage'
import type { Item, Project } from '../lib/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Wijzigingen met dezelfde groep binnen deze tijd worden één ongedaan-maakstap (bv. typen in een veld). */
const COALESCE_MS = 800
const HISTORY_LIMIT = 100

type AppState = {
  projects: Project[]
  currentId: string | null
  selectedId: string | null
  saveState: SaveState
  loaded: boolean
  toast: string | null
  past: Project[]
  future: Project[]

  load(): Promise<void>
  openProject(id: string): void
  createProject(templateKey: string): void
  importProject(p: Project): void
  duplicateProject(): void
  deleteProject(): Promise<void>
  renameProject(name: string): void
  setProjectField<K extends 'kerf' | 'waste'>(key: K, value: number): void
  setSheet(t: number, size: [number, number]): void

  undo(): void
  redo(): void

  select(id: string | null): void
  addItem(item: Item): void
  /** `group` voegt snelle opeenvolgende wijzigingen samen tot één ongedaan-maakstap. */
  updateItem(id: string, fn: (it: Item) => Item, group?: string): void
  removeItem(id: string): void
  duplicateItem(id: string): void
  stackItem(id: string): void
  loosenItem(id: string): void
  toggleHidden(id: string): void
  nudge(id: string, dx: number, dy: number, dz: number): void

  showToast(msg: string): void
}

let store: ProjectStore = localStore
/** Alleen voor tests: een andere opslag gebruiken. */
export const setProjectStore = (s: ProjectStore) => {
  store = s
}
let saveTimer: ReturnType<typeof setTimeout> | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined
let lastGroup: { key: string; at: number } | null = null

export const useApp = create<AppState>((set, get) => {
  const current = () => get().projects.find((p) => p.id === get().currentId)

  const scheduleSave = (p: Project) => {
    set({ saveState: 'saving' })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      store.save(p).then(
        () => set({ saveState: 'saved' }),
        () => set({ saveState: 'error' }),
      )
    }, 600)
  }

  /** Vervang het huidige project (zonder geschiedenis) en sla op. */
  const replaceCurrent = (next: Project) => {
    set((s) => ({ projects: s.projects.map((p) => (p.id === next.id ? next : p)) }))
    scheduleSave(next)
  }

  /** Werk het huidige project bij, onthoud de vorige stand voor ongedaan maken, en sla op. */
  const mutate = (fn: (p: Project) => Project, group?: string) => {
    const prev = current()
    if (!prev) return
    const now = Date.now()
    // Groepen die met 'session:' beginnen (bv. één sleepbeweging) blijven één stap, hoe lang ze ook duren.
    const coalesce = group !== undefined && lastGroup?.key === group && (group.startsWith('session:') || now - lastGroup.at < COALESCE_MS)
    lastGroup = group !== undefined ? { key: group, at: now } : null
    if (!coalesce) set((s) => ({ past: [...s.past, prev].slice(-HISTORY_LIMIT), future: [] }))
    replaceCurrent({ ...fn(prev), updatedAt: now })
  }
  const mutateItems = (fn: (items: Item[]) => Item[], group?: string) => mutate((p) => ({ ...p, items: fn(p.items) }), group)

  const resetHistory = () => {
    lastGroup = null
    return { past: [] as Project[], future: [] as Project[] }
  }

  const addNew = (p: Project) => {
    set((s) => ({ projects: [...s.projects, p], currentId: p.id, selectedId: p.items[0]?.id ?? null, saveState: 'saving', ...resetHistory() }))
    store.save(p).then(
      () => set({ saveState: 'saved' }),
      () => set({ saveState: 'error' }),
    )
  }

  /** Houd de selectie geldig na ongedaan maken of opnieuw doen. */
  const keepSelection = (p: Project) => {
    const sel = get().selectedId
    return p.items.some((i) => i.id === sel) ? sel : (p.items[0]?.id ?? null)
  }

  return {
    projects: [],
    currentId: null,
    selectedId: null,
    saveState: 'idle',
    loaded: false,
    toast: null,
    past: [],
    future: [],

    async load() {
      const projects = await store.loadAll()
      const last = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      set({
        projects,
        loaded: true,
        currentId: last?.id ?? null,
        selectedId: last?.items[0]?.id ?? null,
        saveState: projects.length ? 'saved' : 'idle',
        ...resetHistory(),
      })
    },
    openProject(id) {
      const p = get().projects.find((x) => x.id === id)
      set({ currentId: id, selectedId: p?.items[0]?.id ?? null, ...resetHistory() })
    },
    createProject(key) {
      addNew(newProject(key))
    },
    importProject(p) {
      addNew(p)
      get().showToast('Project geïmporteerd')
    },
    duplicateProject() {
      const p = current()
      if (!p) return
      const copy: Project = structuredClone(p)
      copy.id = newId()
      copy.name = `${p.name} (kopie)`
      copy.items.forEach((i) => (i.id = newId()))
      copy.updatedAt = Date.now()
      addNew(copy)
      get().showToast('Kopie gemaakt')
    },
    async deleteProject() {
      const p = current()
      if (!p) return
      await store.remove(p.id)
      const rest = get().projects.filter((x) => x.id !== p.id)
      const next = [...rest].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      set({ projects: rest, currentId: next?.id ?? null, selectedId: next?.items[0]?.id ?? null, ...resetHistory() })
      get().showToast(`"${p.name}" verwijderd`)
    },
    renameProject(name) {
      mutate((p) => ({ ...p, name }), 'name')
    },
    setProjectField(key, value) {
      mutate((p) => ({ ...p, [key]: value }), `field:${key}`)
    },
    setSheet(t, size) {
      mutate((p) => ({ ...p, sheets: { ...p.sheets, [String(t)]: size } }))
    },

    undo() {
      const { past, future } = get()
      const cur = current()
      const prev = past.at(-1)
      if (!cur || !prev) return
      lastGroup = null
      set({ past: past.slice(0, -1), future: [cur, ...future], selectedId: keepSelection(prev) })
      replaceCurrent({ ...prev, updatedAt: Date.now() })
    },
    redo() {
      const { past, future } = get()
      const cur = current()
      const next = future[0]
      if (!cur || !next) return
      lastGroup = null
      set({ past: [...past, cur], future: future.slice(1), selectedId: keepSelection(next) })
      replaceCurrent({ ...next, updatedAt: Date.now() })
    },

    select(id) {
      set({ selectedId: id })
    },
    addItem(item) {
      if (!current()) addNew(newProject('leeg'))
      const items = current()!.items
      const maxX = items.reduce((m, i) => Math.max(m, i.x + localParts(i).fx), 0)
      const same = items.filter((i) => i.type === item.type).length
      const placed = { ...item, x: items.length ? Math.round(maxX + 100) : 0, name: same ? `${item.name} ${same + 1}` : item.name }
      mutateItems((list) => [...list, placed])
      set({ selectedId: placed.id })
    },
    updateItem(id, fn, group) {
      mutateItems((list) => list.map((i) => (i.id === id ? fn(i) : i)), group)
    },
    removeItem(id) {
      const name = current()?.items.find((i) => i.id === id)?.name
      mutateItems((list) => list.filter((i) => i.id !== id))
      set({ selectedId: current()?.items[0]?.id ?? null })
      if (name) get().showToast(`"${name}" verwijderd · Ctrl+Z maakt het ongedaan`)
    },
    duplicateItem(id) {
      const it = current()?.items.find((i) => i.id === id)
      if (!it) return
      const copy = { ...structuredClone(it), id: newId(), name: `${it.name} kopie`, x: it.x + localParts(it).fx + 50 }
      mutateItems((list) => [...list, copy])
      set({ selectedId: copy.id })
    },
    stackItem(id) {
      const items = current()?.items ?? []
      const it = items.find((i) => i.id === id)
      if (!it) return
      const y = stackHeight(it, items)
      get().updateItem(id, (i) => ({ ...i, y }))
      get().showToast(y ? `Op ${y} mm hoogte gezet` : 'Op de vloer gezet')
    },
    loosenItem(id) {
      const it = current()?.items.find((i) => i.id === id)
      if (!it) return
      const loose = explodeToPanels(it, newId)
      mutateItems((list) => list.flatMap((i) => (i.id === id ? loose : [i])))
      set({ selectedId: loose[0]?.id ?? null })
      get().showToast(`${it.name} is nu ${loose.length} losse panelen`)
    },
    toggleHidden(id) {
      get().updateItem(id, (i) => ({ ...i, hidden: !i.hidden }))
    },
    nudge(id, dx, dy, dz) {
      get().updateItem(id, (i) => ({ ...i, x: i.x + dx, y: Math.max(0, i.y + dy), z: i.z + dz }), `nudge:${id}`)
    },

    showToast(msg) {
      set({ toast: msg })
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => set({ toast: null }), 2600)
    },
  }
})

export const useCurrent = () => useApp((s) => s.projects.find((p) => p.id === s.currentId) ?? null)
