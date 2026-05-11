import type { Cue } from '../srt/srt'

export function findOverlappingCueIndices(cues: Cue[]): Set<number> {
  const overlaps = new Set<number>()
  const byLane = new Map<number, Cue[]>()

  for (const cue of cues) {
    const lane = cue.lane ?? 1
    const group = byLane.get(lane) ?? []
    group.push(cue)
    byLane.set(lane, group)
  }

  for (const laneCues of byLane.values()) {
    const sorted = [...laneCues].sort((a, b) => a.startMs - b.startMs)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      if (curr.startMs < prev.endMs) {
        overlaps.add(prev.index)
        overlaps.add(curr.index)
      }
    }
  }

  return overlaps
}
