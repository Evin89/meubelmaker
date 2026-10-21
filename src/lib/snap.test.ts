import { describe, expect, it } from 'vitest'
import { dragTarget, snap } from './snap'

describe('slepen', () => {
  it('rondt af op het raster', () => {
    expect(snap(123, 10)).toBe(120)
    expect(snap(126, 10)).toBe(130)
    expect(snap(123.4, 1)).toBe(123)
    expect(snap(123.4, 0)).toBe(123.4)
  })

  it('verplaatst in het vlak zonder de hoogte te veranderen', () => {
    expect(dragTarget({ x: 0, y: 159, z: 0 }, { x: 47, y: 80, z: -12 }, 10, 'vlak')).toEqual({ x: 50, y: 159, z: -10 })
  })

  it('verplaatst in de hoogte en blijft boven de vloer', () => {
    expect(dragTarget({ x: 5, y: 159, z: 7 }, { x: 40, y: 64, z: 3 }, 10, 'hoogte')).toEqual({ x: 5, y: 220, z: 7 })
    expect(dragTarget({ x: 0, y: 30, z: 0 }, { x: 0, y: -200, z: 0 }, 10, 'hoogte').y).toBe(0)
  })
})
