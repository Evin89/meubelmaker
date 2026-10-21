/** Rondt af op een raster in mm. */
export const snap = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v)

export type DragMode = 'vlak' | 'hoogte'

/**
 * Nieuwe positie van een bouwsteen tijdens slepen.
 * `start` is de positie bij het begin, `delta` de verplaatsing van de muis in mm.
 * In de modus 'vlak' verandert alleen x en z, in 'hoogte' alleen y (nooit onder de vloer).
 */
export function dragTarget(
  start: { x: number; y: number; z: number },
  delta: { x: number; y: number; z: number },
  step: number,
  mode: DragMode,
): { x: number; y: number; z: number } {
  if (mode === 'hoogte') return { x: start.x, y: Math.max(0, snap(start.y + delta.y, step)), z: start.z }
  return { x: snap(start.x + delta.x, step), y: start.y, z: snap(start.z + delta.z, step) }
}
