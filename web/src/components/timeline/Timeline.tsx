import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { Cue } from '../../domain/srt/srt'
import { applySnapping } from '../../domain/timing/snapping'

type Props = {
  cues: Cue[]
  durationMs: number
  zoom: number
  currentMs: number
  selectedCueIndex: number | null
  overlapCueIndices: Set<number>
  onSelectCue: (index: number) => void
  onMoveCue: (index: number, deltaMs: number) => void
  onRippleMove: (fromIndex: number, deltaMs: number) => void
  onResizeStart: (index: number, nextStartMs: number) => void
  onResizeEnd: (index: number, nextEndMs: number) => void
  onSeek: (ms: number) => void
  onZoom: (delta: number) => void
}

const PX_PER_SEC_BASE = 80
const RULER_HEIGHT = 28
const BLOCK_TOP = RULER_HEIGHT + 6

type DragMode = 'move' | 'resize-start' | 'resize-end'

function formatRulerTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

function calcTickInterval(pxPerMs: number): number {
  const targetPx = 80
  const idealMs = targetPx / pxPerMs
  const candidates = [500, 1000, 2000, 5000, 10000, 30000, 60000]
  for (const c of candidates) {
    if (c >= idealMs) return c
  }
  return 60000
}

export function Timeline({
  cues,
  durationMs,
  zoom,
  currentMs,
  selectedCueIndex,
  overlapCueIndices,
  onSelectCue,
  onMoveCue,
  onRippleMove,
  onResizeStart,
  onResizeEnd,
  onSeek,
  onZoom,
}: Props) {
  const pxPerMs = (PX_PER_SEC_BASE * zoom) / 1000
  const widthPx = Math.max(800, durationMs * pxPerMs)
  const totalHeight = BLOCK_TOP + 60

  const dragRef = useRef<{
    cueIndex: number
    mode: DragMode
    startClientX: number
    origStartMs: number
    origEndMs: number
    altKey: boolean
  } | null>(null)

  const beginDrag = (
    e: ReactPointerEvent,
    cue: Cue,
    mode: DragMode,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    onSelectCue(cue.index)

    dragRef.current = {
      cueIndex: cue.index,
      mode,
      startClientX: e.clientX,
      origStartMs: cue.startMs,
      origEndMs: cue.endMs,
      altKey: e.altKey,
    }

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return
      const d = dragRef.current
      const deltaMs = Math.round((ev.clientX - d.startClientX) / pxPerMs)
      const thisCue = cues.find((c) => c.index === d.cueIndex)
      if (!thisCue) return
      const edgeCandidates = cues
        .filter((c) => c.index !== d.cueIndex)
        .flatMap((c) => [c.startMs, c.endMs])

      if (d.mode === 'move') {
        if (d.altKey) {
          // Ripple: shift all cues from this index onward
          onRippleMove(d.cueIndex, deltaMs)
        } else {
          const targetStart = applySnapping(d.origStartMs + deltaMs, edgeCandidates)
          onMoveCue(d.cueIndex, targetStart - thisCue.startMs)
        }
      } else if (d.mode === 'resize-start') {
        const targetStart = applySnapping(d.origStartMs + deltaMs, edgeCandidates)
        onResizeStart(d.cueIndex, targetStart)
      } else {
        const targetEnd = applySnapping(d.origEndMs + deltaMs, edgeCandidates)
        onResizeEnd(d.cueIndex, targetEnd)
      }
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleTimelineClick = (e: ReactPointerEvent) => {
    const rect = (e.target as HTMLElement).closest('[data-timeline]')?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const ms = Math.round(x / pxPerMs)
    onSeek(Math.max(0, Math.min(ms, durationMs)))
  }

  // Build ruler ticks
  const tickInterval = calcTickInterval(pxPerMs)
  const ticks: { ms: number; label: string }[] = []
  for (let ms = 0; ms <= durationMs; ms += tickInterval) {
    ticks.push({ ms, label: formatRulerTime(ms) })
  }

  // Playhead position
  const playheadX = currentMs * pxPerMs

  return (
    <div
      style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: 8, padding: 0 }}
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          onZoom(e.deltaY < 0 ? 0.1 : -0.1)
        }
      }}
    >
      <div
        data-timeline
        style={{ width: widthPx, height: totalHeight, position: 'relative', background: '#0f172a', cursor: 'crosshair' }}
        onPointerDown={handleTimelineClick}
      >
        {/* Time ruler */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: widthPx, height: RULER_HEIGHT, pointerEvents: 'none' }}>
          {ticks.map(({ ms, label }) => (
            <g key={ms}>
              <line x1={ms * pxPerMs} y1={RULER_HEIGHT - 8} x2={ms * pxPerMs} y2={RULER_HEIGHT} stroke="#64748b" strokeWidth={1} />
              <text x={ms * pxPerMs + 4} y={RULER_HEIGHT - 10} fill="#94a3b8" fontSize={10} fontFamily="monospace">
                {label}
              </text>
            </g>
          ))}
        </svg>

        {/* Subtitle blocks */}
        {cues.map((cue) => {
          const left = cue.startMs * pxPerMs
          const width = Math.max(10, (cue.endMs - cue.startMs) * pxPerMs)
          const isSelected = selectedCueIndex === cue.index
          const isOverlap = overlapCueIndices.has(cue.index)

          return (
            <div
              key={cue.index}
              onClick={(e) => { e.stopPropagation(); onSelectCue(cue.index) }}
              style={{
                position: 'absolute',
                left,
                width,
                top: BLOCK_TOP,
                height: 50,
                borderRadius: 6,
                border: isSelected
                  ? '2px solid #fbbf24'
                  : isOverlap
                    ? '1px solid #ef4444'
                    : '1px solid #64748b',
                background: isOverlap ? '#7f1d1d' : '#334155',
                color: '#f8fafc',
                fontSize: 12,
                userSelect: 'none',
                display: 'flex',
                alignItems: 'stretch',
              }}
            >
              <div
                title="Resize start"
                style={{ width: 8, cursor: 'ew-resize', background: '#94a3b8', borderRadius: '6px 0 0 6px' }}
                onPointerDown={(e) => beginDrag(e, cue, 'resize-start')}
              />
              <div
                title={cue.text}
                style={{ flex: 1, padding: '4px 6px', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'grab' }}
                onPointerDown={(e) => beginDrag(e, cue, 'move')}
              >
                #{cue.index} {cue.text}
              </div>
              <div
                title="Resize end"
                style={{ width: 8, cursor: 'ew-resize', background: '#94a3b8', borderRadius: '0 6px 6px 0' }}
                onPointerDown={(e) => beginDrag(e, cue, 'resize-end')}
              />
            </div>
          )
        })}

        {/* Playhead line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: playheadX,
            width: 2,
            height: totalHeight,
            background: '#ef4444',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      </div>
    </div>
  )
}
