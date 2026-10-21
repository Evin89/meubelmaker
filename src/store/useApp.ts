import { create } from 'zustand'
import { newId, newProject } from '../lib/blocks'
import { explodeToPanels, localParts, stackHeight } from '../lib/parts'
import { localStore, type ProjectStore } from '../lib/storage'
import type { Item, Project } from '../lib/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type AppState = {
  projects: Project[]
  currentId: string | null
  selectedId: string | null
  saveState: SaveState
  loaded: boolean
  toast: string | null

  load(): Promise<void>
  openProject(id: string): void
  createProject(templateKey: string): void
  importProject(p: Project): void
  duplicateProject(): void
  deleteProject(): Promise<void>
  renameProject(name: string): void
  setProjectField<K extends 'kerf' | 'waste'>(key: K, value: number): void
  setSheet(t: number, size: [number, number]): void

  select(id: string | null): void
  addItem(item: Item): void
  updateItem(id: string, fn: (it: Item) => Item): void
  removeItem(id: string): void
  duplicateItem(id: string): void
  stackItem(id: string): void
  loosenItem(id: string): void

  showToast(msg: string): void
}

const store: ProjectStore = localStore
let saveTimer: ReturnType<typeof setTimeout> | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useApp = create<AppState>((set, get) => {
  /** Werk het huidige project bij en sla het (vertraagd) op. */
  const mutate = (fn: (p: Project) => Project) => {
    const { currentId, projects } = get()
    if (!currentId) return
    let saved: Project | undefined
    const next = projects.map((p) => (p.id === currentId ? (saved = { ...fn(p), updatedAt: Date.now() }) : p))
    set({ projects: next, saveState: 'saving' })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!saved) return
      store.save(saved).then(
        () => set({ saveState: 'saved' }),
        () => set({ saveState: 'error' }),
      )
    }, 600)
  }
  const mutateItems = (fn: (items: Item[]) => Item[]) => mutate((p) => ({ ...p, items: fn(p.items) }))
  const current = () => get().projects.find((p) => p.id === get().currentId)

  const addNew = (p: Project) => {
    set((s) => ({ projects: [...s.projects, p], currentId: p.id, selectedId: p.items[0]?.id ?? null, saveState: 'saving' }))
    store.save(p).then(
      () => set({ saveState: 'saved' }),
      () => set({ saveState: 'error' }),
    )
  }

  return {
    projects: [],
    currentId: null,
    selectedId: null,
    saveState: 'idle',
    loaded: false,
    toast: null,

    async load() {
      const projects = await store.loadAll()
      const last = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      set({ projects, loaded: true, currentId: last?.id ?? null, selectedId: last?.items[0]?.id ?? null, saveState: projects.length ? 'saved' : 'idle' })
    },
    openProject(id) {
      const p = get().projects.find((x) => x.id === id)
      set({ currentId: id, selectedId: p?.items[0]?.id ?? null })
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
      set({ projects: rest, currentId: next?.id ?? null, selectedId: next?.items[0]?.id ?? null })
      get().showToast(`"${p.name}" verwijderd`)
    },
    renameProject(name) {
      mutate((p) => ({ ...p, name }))
    },
    setProjectField(key, value) {
      mutate((p) => ({ ...p, [key]: value }))
    },
    setSheet(t, size) {
      mutate((p) => ({ ...p, sheets: { ...p.sheets, [String(t)]: size } }))
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
    updateItem(id, fn) {
      mutateItems((list) => list.map((i) => (i.id === id ? fn(i) : i)))
    },
    removeItem(id) {
      mutateItems((list) => list.filter((i) => i.id !== id))
      set({ selectedId: current()?.items[0]?.id ?? null })
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

    showToast(msg) {
      set({ toast: msg })
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => set({ toast: null }), 2600)
    },
  }
})

export const useCurrent = () => useApp((s) => s.projects.find((p) => p.id === s.currentId) ?? null)
