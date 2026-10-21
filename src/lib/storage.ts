import type { Project } from './types'

/**
 * Opslaglaag. Nu localStorage; een Supabase-variant kan later dezelfde interface implementeren
 * (zie CLAUDE.md → Roadmap).
 */
export interface ProjectStore {
  loadAll(): Promise<Project[]>
  save(p: Project): Promise<void>
  remove(id: string): Promise<void>
}

const KEY = 'meubelmaker.projects.v1'

function read(): Project[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Project[]) : []
  } catch {
    return []
  }
}

function write(list: Project[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* opslag vol of geblokkeerd: de app blijft werken tot de pagina sluit */
  }
}

export const localStore: ProjectStore = {
  async loadAll() {
    return read()
  },
  async save(p) {
    const list = read()
    const i = list.findIndex((x) => x.id === p.id)
    if (i >= 0) list[i] = p
    else list.push(p)
    write(list)
  },
  async remove(id) {
    write(read().filter((x) => x.id !== id))
  },
}
