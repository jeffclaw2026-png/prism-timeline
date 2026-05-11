import type { Cue } from '../srt/srt'

type CueCommand = {
  apply: (cues: Cue[]) => Cue[]
}

function mapCue(cues: Cue[], cueIndex: number, fn: (cue: Cue) => Cue): Cue[] {
  return cues.map((cue) => (cue.index === cueIndex ? fn(cue) : cue))
}

const MIN_DURATION_MS = 1

export function moveCueBy(cueIndex: number, deltaMs: number): CueCommand {
  return {
    apply: (cues) =>
      mapCue(cues, cueIndex, (cue) => {
        const startMs = Math.max(0, cue.startMs + deltaMs)
        const dur = cue.endMs - cue.startMs
        return { ...cue, startMs, endMs: startMs + dur }
      }),
  }
}

export function resizeCueStart(cueIndex: number, nextStartMs: number): CueCommand {
  return {
    apply: (cues) =>
      mapCue(cues, cueIndex, (cue) => {
        const maxStart = cue.endMs - MIN_DURATION_MS
        return { ...cue, startMs: Math.max(0, Math.min(nextStartMs, maxStart)) }
      }),
  }
}

export function resizeCueEnd(cueIndex: number, nextEndMs: number): CueCommand {
  return {
    apply: (cues) =>
      mapCue(cues, cueIndex, (cue) => {
        const minEnd = cue.startMs + MIN_DURATION_MS
        return { ...cue, endMs: Math.max(minEnd, nextEndMs) }
      }),
  }
}

export function deleteCue(cueIndex: number): CueCommand {
  return {
    apply: (cues) => cues.filter((cue) => cue.index !== cueIndex),
  }
}

export function splitCue(cueIndex: number, splitMs: number): CueCommand {
  return {
    apply: (cues) => {
      const idx = cues.findIndex((c) => c.index === cueIndex)
      if (idx === -1) return cues
      const cue = cues[idx]
      if (splitMs <= cue.startMs || splitMs >= cue.endMs) return cues

      const newIndex = Math.max(...cues.map((c) => c.index), 0) + 1
      const first: Cue = { ...cue, endMs: splitMs }
      const second: Cue = { index: newIndex, startMs: splitMs, endMs: cue.endMs, text: '' }
      return [...cues.slice(0, idx), first, second, ...cues.slice(idx + 1)]
    },
  }
}

export function editCueText(cueIndex: number, text: string): CueCommand {
  return {
    apply: (cues) => mapCue(cues, cueIndex, (cue) => ({ ...cue, text })),
  }
}

export function rippleMoveCues(fromIndex: number, deltaMs: number): CueCommand {
  return {
    apply: (cues) =>
      cues.map((cue) => {
        if (cue.index < fromIndex) return cue
        const startMs = Math.max(0, cue.startMs + deltaMs)
        const dur = cue.endMs - cue.startMs
        return { ...cue, startMs, endMs: startMs + dur }
      }),
  }
}

export function insertCue(startMs: number, endMs: number): CueCommand {
  return {
    apply: (cues) => {
      const newIndex = Math.max(...cues.map((c) => c.index), 0) + 1
      const newCue: Cue = { index: newIndex, startMs, endMs, text: '' }
      // Insert in sorted position by startMs
      const idx = cues.findIndex((c) => c.startMs > startMs)
      if (idx === -1) return [...cues, newCue]
      return [...cues.slice(0, idx), newCue, ...cues.slice(idx)]
    },
  }
}

export class CommandStack {
  private history: Cue[][]
  private cursor: number

  constructor(initialCues: Cue[]) {
    this.history = [initialCues]
    this.cursor = 0
  }

  current(): Cue[] {
    return this.history[this.cursor]
  }

  execute(command: CueCommand) {
    const next = command.apply(this.current())
    this.history = [...this.history.slice(0, this.cursor + 1), next]
    this.cursor += 1
  }

  undo() {
    this.cursor = Math.max(0, this.cursor - 1)
  }

  redo() {
    this.cursor = Math.min(this.history.length - 1, this.cursor + 1)
  }
}
