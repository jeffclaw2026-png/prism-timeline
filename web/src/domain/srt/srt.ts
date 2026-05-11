export type Cue = {
  index: number
  startMs: number
  endMs: number
  text: string
  lane?: 1 | 2
}

export type SubtitleTrack = {
  cues: Cue[]
}

const TIMECODE_RE = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/

function parseTimecode(value: string): number {
  const m = value.trim().match(TIMECODE_RE)
  if (!m) throw new Error(`Invalid SRT timecode: ${value}`)

  const [, hh, mm, ss, ms] = m
  return Number(hh) * 3600000 + Number(mm) * 60000 + Number(ss) * 1000 + Number(ms)
}

function formatTimecode(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms))
  const hh = Math.floor(clamped / 3600000)
  const mm = Math.floor((clamped % 3600000) / 60000)
  const ss = Math.floor((clamped % 60000) / 1000)
  const mmm = clamped % 1000

  const p2 = (n: number) => String(n).padStart(2, '0')
  const p3 = (n: number) => String(n).padStart(3, '0')
  return `${p2(hh)}:${p2(mm)}:${p2(ss)},${p3(mmm)}`
}

export function parseSrt(input: string): SubtitleTrack {
  const normalized = input.replace(/\r\n/g, '\n').trim()
  if (!normalized) return { cues: [] }

  const blocks = normalized.split(/\n\s*\n/)
  const cues: Cue[] = blocks.map((block) => {
    const lines = block.split('\n')
    if (lines.length < 3) throw new Error(`Invalid SRT block: ${block}`)

    const index = Number(lines[0].trim())
    if (Number.isNaN(index)) throw new Error(`Invalid SRT index: ${lines[0]}`)

    const [startRaw, endRaw] = lines[1].split('-->').map((part) => part.trim())
    if (!startRaw || !endRaw) throw new Error(`Invalid SRT timing line: ${lines[1]}`)

    return {
      index,
      startMs: parseTimecode(startRaw),
      endMs: parseTimecode(endRaw),
      text: lines.slice(2).join('\n').trim(),
      lane: 1,
    }
  })

  return { cues }
}

export function serializeSrt(track: SubtitleTrack): string {
  return track.cues
    .map((cue, i) => {
      const index = i + 1
      return `${index}\n${formatTimecode(cue.startMs)} --> ${formatTimecode(cue.endMs)}\n${cue.text}`
    })
    .join('\n\n')
}
