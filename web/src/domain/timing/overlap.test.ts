import { describe, expect, it } from 'vitest'
import type { Cue } from '../srt/srt'
import { findOverlappingCueIndices } from './overlap'

describe('findOverlappingCueIndices', () => {
  it('returns empty set when no overlaps', () => {
    const cues: Cue[] = [
      { index: 1, startMs: 0, endMs: 1000, text: 'A' },
      { index: 2, startMs: 1000, endMs: 2000, text: 'B' },
    ]
    expect([...findOverlappingCueIndices(cues)]).toEqual([])
  })

  it('flags both cues when overlapping', () => {
    const cues: Cue[] = [
      { index: 1, startMs: 0, endMs: 1200, text: 'A' },
      { index: 2, startMs: 1000, endMs: 2000, text: 'B' },
      { index: 3, startMs: 2100, endMs: 2600, text: 'C' },
    ]
    expect([...findOverlappingCueIndices(cues)].sort((a, b) => a - b)).toEqual([1, 2])
  })
})
