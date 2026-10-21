import { useEffect } from 'react'
import { useApp } from './store/useApp'

export const SHORTCUTS: [string, string][] = [
  ['Ctrl+Z', 'Ongedaan maken'],
  ['Ctrl+Shift+Z / Ctrl+Y', 'Opnieuw'],
  ['Pijltjes', 'Verplaatsen in breedte en diepte (10 mm)'],
  ['PageUp / PageDown', 'Omhoog of omlaag (10 mm)'],
  ['+ Shift / + Alt', 'Stap van 100 mm / 1 mm'],
  ['Ctrl+D', 'Dupliceren'],
  ['Delete', 'Verwijderen'],
  ['H', 'Verbergen of tonen in 3D'],
  ['Esc', 'Selectie opheffen'],
]

/** Sneltoetsen voor de hele app. Werkt niet terwijl je in een veld typt, behalve ongedaan maken. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState()
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && (key === 'z' || key === 'y')) {
        e.preventDefault()
        if (key === 'y' || e.shiftKey) s.redo()
        else s.undo()
        return
      }

      const t = e.target as HTMLElement | null
      if (t?.closest('input, select, textarea, [contenteditable="true"]')) return
      const id = s.selectedId
      if (!id) return

      const step = e.shiftKey ? 100 : e.altKey ? 1 : 10
      const move: Record<string, [number, number, number]> = {
        arrowleft: [-step, 0, 0],
        arrowright: [step, 0, 0],
        arrowup: [0, 0, -step],
        arrowdown: [0, 0, step],
        pageup: [0, step, 0],
        pagedown: [0, -step, 0],
      }
      if (move[key] && !mod) {
        e.preventDefault()
        s.nudge(id, ...move[key])
      } else if (mod && key === 'd') {
        e.preventDefault()
        s.duplicateItem(id)
      } else if (key === 'delete' || key === 'backspace') {
        e.preventDefault()
        s.removeItem(id)
      } else if (key === 'h' && !mod) {
        s.toggleHidden(id)
      } else if (key === 'escape') {
        s.select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
