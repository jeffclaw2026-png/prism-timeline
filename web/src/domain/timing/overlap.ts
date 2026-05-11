import type { Cue } from '../srt/srt'

export function findOverlappingCueIndices(cues: Cue[]): Set<number> {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs)
  const overlaps = new Set<number>()

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (curr.startMs < prev.endMs) {
      overlaps.add(prev.index)
      overlaps.add(curr.index)
    }
  }

  return overlaps
}
