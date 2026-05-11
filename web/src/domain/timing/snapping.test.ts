import { describe, expect, it } from 'vitest'
import { applySnapping } from './snapping'

describe('applySnapping', () => {
  it('snaps to nearest grid when within threshold', () => {
    expect(applySnapping(1048, [], 100, 60)).toBe(1000)
    expect(applySnapping(2952, [], 100, 60)).toBe(3000)
  })

  it('snaps to nearest edge when closer than grid', () => {
    const edges = [1400, 2600]
    expect(applySnapping(1425, edges, 100, 60)).toBe(1400)
  })

  it('keeps original value when no candidate inside threshold', () => {
    expect(applySnapping(1170, [1400], 100, 20)).toBe(1170)
  })
})
