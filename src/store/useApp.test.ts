import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeItem } from '../lib/blocks'
import type { Project } from '../lib/types'
import { setProjectStore, useApp } from './useApp'

const mem: Project[] = []
setProjectStore({
  loadAll: async () => mem,
  save: async () => {},
  remove: async () => {},
})

const cur = () => useApp.getState().projects.find((p) => p.id === useApp.getState().currentId)!

describe('ongedaan maken', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useApp.getState().createProject('leeg')
  })

  it('maakt een toegevoegde bouwsteen ongedaan en weer opnieuw', () => {
    const s = useApp.getState()
    s.addItem(makeItem('bak'))
    expect(cur().items).toHaveLength(1)
    s.undo()
    expect(cur().items).toHaveLength(0)
    s.redo()
    expect(cur().items).toHaveLength(1)
  })

  it('voegt snel typen in hetzelfde veld samen tot één stap', () => {
    const s = useApp.getState()
    s.addItem(makeItem('bak'))
    const id = cur().items[0].id
    for (const L of [4, 45, 450]) s.updateItem(id, (i) => ({ ...i, p: { ...i.p, L } }) as typeof i, `item:${id}:L`)
    expect(cur().items[0].p).toMatchObject({ L: 450 })
    s.undo()
    expect(cur().items[0].p).toMatchObject({ L: 440 })
  })

  it('maakt aparte stappen als er tijd tussen zit', () => {
    const s = useApp.getState()
    s.addItem(makeItem('bak'))
    const id = cur().items[0].id
    s.nudge(id, 10, 0, 0)
    vi.advanceTimersByTime(1000)
    s.nudge(id, 10, 0, 0)
    s.undo()
    expect(cur().items[0].x).toBe(10)
  })

  it('houdt een sleepsessie één stap, ook als hij lang duurt', () => {
    const s = useApp.getState()
    s.addItem(makeItem('bak'))
    const id = cur().items[0].id
    for (let i = 1; i <= 5; i++) {
      s.updateItem(id, (it) => ({ ...it, x: i * 100 }), 'session:drag:1')
      vi.advanceTimersByTime(2000)
    }
    s.undo()
    expect(cur().items[0].x).toBe(0)
  })

  it('wist de redo-stapel na een nieuwe wijziging', () => {
    const s = useApp.getState()
    s.addItem(makeItem('bak'))
    s.undo()
    s.addItem(makeItem('kast'))
    expect(useApp.getState().future).toHaveLength(0)
  })

  it('verbergen telt als wijziging en is ongedaan te maken', () => {
    const s = useApp.getState()
    s.addItem(makeItem('blad'))
    const id = cur().items[0].id
    s.toggleHidden(id)
    expect(cur().items[0].hidden).toBe(true)
    s.undo()
    expect(cur().items[0].hidden).toBeFalsy()
  })
})
