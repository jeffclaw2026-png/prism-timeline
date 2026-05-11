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
