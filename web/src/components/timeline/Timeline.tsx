import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
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
  onMoveCueLane: (index: number, lane: 1 | 2) => void
  onSeek: (ms: number) => void
  onZoom: (delta: number) => void
}

const PX_PER_SEC_BASE = 80
const RULER_HEIGHT = 28
const LANE_HEIGHT = 56
const LANE_GAP = 10
const LANES_TOP = RULER_HEIGHT + 10
const BLOCK_TOP_LANE_1 = LANES_TOP
const BLOCK_TOP_LANE_2 = LANES_TOP + LANE_HEIGHT + LANE_GAP

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

// CSS custom property references for colors (avoid hardcoded hex in JS)
const C = {
  rulerLine: 'var(--prism-text-secondary)',
  rulerText: 'var(--prism-text-secondary)',
  laneGuide: 'rgba(136, 150, 168, 0.25)',
  laneLabel: 'var(--prism-text-secondary)',
  blockBg: 'var(--prism-bg-elevated, #1a202e)',
  blockBorder: 'var(--prism-border, #252d3a)',
  blockText: 'var(--prism-text-primary, #e4e8ee)',
  blockResizeHandle: 'var(--prism-text-secondary)',
  blockSelectedBorder: 'var(--prism-accent, #6366f1)',
  blockOverlapBg: 'var(--prism-danger-subtle, #291a1e)',
  blockOverlapBorder: 'var(--prism-danger, #ef4444)',
  playheadColor: 'var(--prism-playhead, #ef4444)',
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
  onMoveCueLane,
  onSeek,
  onZoom,
}: Props) {
  const pxPerMs = (PX_PER_SEC_BASE * zoom) / 1000
  const widthPx = Math.max(800, durationMs * pxPerMs)
  const totalHeight = BLOCK_TOP_LANE_2 + LANE_HEIGHT + 8
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const lastManualScrollAtRef = useRef(0)
  const [dragPreview, setDragPreview] = useState<{
    cueIndex: number
    mode: DragMode
    deltaMs: number
    lane: 1 | 2
  } | null>(null)

  const dragRef = useRef<{
    cueIndex: number
    mode: DragMode
    startClientX: number
    startClientY: number
    lastClientY: number
    origStartMs: number
    origEndMs: number
    origLane: 1 | 2
    altKey: boolean
    timelineTop: number
    pendingDeltaMs: number
    pendingLane: 1 | 2
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
      startClientY: e.clientY,
      lastClientY: e.clientY,
      origStartMs: cue.startMs,
      origEndMs: cue.endMs,
      origLane: cue.lane ?? 1,
      altKey: e.altKey,
      timelineTop: (e.currentTarget as HTMLElement).closest('[data-timeline]')?.getBoundingClientRect().top ?? 0,
      pendingDeltaMs: 0,
      pendingLane: cue.lane ?? 1,
    }

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return
      const d = dragRef.current
      d.lastClientY = ev.clientY
      const deltaMs = Math.round((ev.clientX - d.startClientX) / pxPerMs)
      const thisCue = cues.find((c) => c.index === d.cueIndex)
      if (!thisCue) return
      const edgeCandidates = cues
        .filter((c) => c.index !== d.cueIndex)
        .flatMap((c) => [c.startMs, c.endMs])

      const laneBoundaryY = d.timelineTop + BLOCK_TOP_LANE_2 - (LANE_GAP / 2)
      const nextLane: 1 | 2 = ev.clientY >= laneBoundaryY ? 2 : 1
      d.pendingLane = nextLane

      if (d.mode === 'move') {
        const targetStart = applySnapping(d.origStartMs + deltaMs, edgeCandidates)
        d.pendingDeltaMs = targetStart - d.origStartMs
      } else if (d.mode === 'resize-start') {
        const targetStart = applySnapping(d.origStartMs + deltaMs, edgeCandidates)
        d.pendingDeltaMs = targetStart - d.origStartMs
      } else {
        const targetEnd = applySnapping(d.origEndMs + deltaMs, edgeCandidates)
        d.pendingDeltaMs = targetEnd - d.origEndMs
      }

      setDragPreview({
        cueIndex: d.cueIndex,
        mode: d.mode,
        deltaMs: d.pendingDeltaMs,
        lane: d.pendingLane,
      })
    }

    const onUp = () => {
      const d = dragRef.current
      if (d) {
        if (d.mode === 'move') {
          if (d.altKey) onRippleMove(d.cueIndex, d.pendingDeltaMs)
          else onMoveCue(d.cueIndex, d.pendingDeltaMs)
          if (d.pendingLane !== d.origLane) onMoveCueLane(d.cueIndex, d.pendingLane)
        } else if (d.mode === 'resize-start') {
          onResizeStart(d.cueIndex, d.origStartMs + d.pendingDeltaMs)
        } else {
          onResizeEnd(d.cueIndex, d.origEndMs + d.pendingDeltaMs)
        }
      }
      dragRef.current = null
      setDragPreview(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleTimelineDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
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

  useEffect(() => {
    if (!scrollRef.current || selectedCueIndex === null) return
    const cue = cues.find((c) => c.index === selectedCueIndex)
    if (!cue) return

    const container = scrollRef.current
    const cueLeft = cue.startMs * pxPerMs
    const cueRight = cue.endMs * pxPerMs
    const currentLeft = container.scrollLeft
    const currentRight = currentLeft + container.clientWidth

    if (cueLeft >= currentLeft && cueRight <= currentRight) return

    const cueCenter = (cueLeft + cueRight) / 2
    const nextLeft = Math.max(0, cueCenter - container.clientWidth / 2)
    container.scrollTo({ left: nextLeft, behavior: 'smooth' })
  }, [selectedCueIndex, cues])

  useEffect(() => {
    if (!scrollRef.current) return
    if (Date.now() - lastManualScrollAtRef.current < 900) return
    const container = scrollRef.current
    const viewLeft = container.scrollLeft
    const viewRight = viewLeft + container.clientWidth
    const padding = Math.min(120, container.clientWidth * 0.15)

    const leftBound = viewLeft + padding
    const rightBound = viewRight - padding
    if (playheadX >= leftBound && playheadX <= rightBound) return

    const nextLeft = Math.max(0, playheadX - container.clientWidth * 0.35)
    container.scrollTo({ left: nextLeft, behavior: 'smooth' })
  }, [playheadX])

  // Compute lane label color based on hover/drag state
  const getLaneLabelColor = (lane: 1 | 2) => {
    if (!dragPreview) return 'var(--prism-text-secondary)'
    return dragPreview.lane === lane ? 'var(--prism-accent)' : 'var(--prism-text-secondary)'
  }

  return (
    <div
      ref={scrollRef}
      className="prism-timeline-track"
      onScroll={() => {
        lastManualScrollAtRef.current = Date.now()
      }}
      onWheel={(e) => {
        if (e.shiftKey) {
          e.preventDefault()
          lastManualScrollAtRef.current = Date.now()
          onZoom(e.deltaY < 0 ? 0.1 : -0.1)
        }
      }}
    >
      <div
        data-timeline
        className="prism-timeline-canvas"
        style={{ width: widthPx, height: totalHeight }}
        onDoubleClick={handleTimelineDoubleClick}
      >
        {/* Time ruler */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: widthPx, height: RULER_HEIGHT, pointerEvents: 'none' }}>
          {ticks.map(({ ms, label }) => (
            <g key={ms}>
              <line x1={ms * pxPerMs} y1={RULER_HEIGHT - 8} x2={ms * pxPerMs} y2={RULER_HEIGHT} stroke={C.rulerLine} strokeWidth={1} />
              <text x={ms * pxPerMs + 4} y={RULER_HEIGHT - 10} fill={C.rulerText} fontSize={10} fontFamily="monospace">
                {label}
              </text>
            </g>
          ))}
        </svg>

        {/* Subtitle blocks */}
        {cues.map((cue) => {
          let startMs = cue.startMs
          let endMs = cue.endMs
          let lane: 1 | 2 = cue.lane ?? 1
          if (dragPreview && dragPreview.cueIndex === cue.index) {
            lane = dragPreview.lane
            if (dragPreview.mode === 'move') {
              startMs = cue.startMs + dragPreview.deltaMs
              endMs = cue.endMs + dragPreview.deltaMs
            } else if (dragPreview.mode === 'resize-start') {
              startMs = cue.startMs + dragPreview.deltaMs
            } else {
              endMs = cue.endMs + dragPreview.deltaMs
            }
          }

          const left = Math.max(0, startMs) * pxPerMs
          const width = Math.max(10, (Math.max(startMs + 1, endMs) - Math.max(0, startMs)) * pxPerMs)
          const isSelected = selectedCueIndex === cue.index
          const isOverlap = overlapCueIndices.has(cue.index)
          const top = lane === 2 ? BLOCK_TOP_LANE_2 : BLOCK_TOP_LANE_1

          // Build dynamic border color
          let blockBorderColor = C.blockBorder
          if (isSelected) blockBorderColor = C.blockSelectedBorder
          else if (isOverlap) blockBorderColor = C.blockOverlapBorder

          const blockBgColor = isOverlap ? C.blockOverlapBg : C.blockBg

          return (
            <div
              key={cue.index}
              onClick={(e) => { e.stopPropagation(); onSelectCue(cue.index) }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onMoveCueLane(cue.index, lane === 1 ? 2 : 1)
              }}
              style={{
                position: 'absolute',
                left,
                width,
                top,
                height: 50,
                borderRadius: 6,
                border: isSelected ? `2px solid ${C.blockSelectedBorder}` : `1px solid ${blockBorderColor}`,
                background: blockBgColor,
                color: C.blockText,
                fontSize: 12,
                userSelect: 'none',
                display: 'flex',
                alignItems: 'stretch',
              }}
            >
              <div
                title="Resize start"
                style={{ width: 8, cursor: 'ew-resize', background: C.blockResizeHandle, borderRadius: '6px 0 0 6px' }}
                onPointerDown={(e) => beginDrag(e, cue, 'resize-start')}
              />
              <div
                title={cue.text}
                style={{ flex: 1, padding: '4px 6px', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'grab' }}
                onPointerDown={(e) => beginDrag(e, cue, 'move')}
              >
                L{lane} #{cue.index} {cue.text}
              </div>
              <div
                title="Resize end"
                style={{ width: 8, cursor: 'ew-resize', background: C.blockResizeHandle, borderRadius: '0 6px 6px 0' }}
                onPointerDown={(e) => beginDrag(e, cue, 'resize-end')}
              />
            </div>
          )
        })}

        {/* Lane guides */}
        <div
          style={{
            position: 'absolute',
            top: BLOCK_TOP_LANE_1 - 2,
            left: 0,
            width: widthPx,
            height: 1,
            background: C.laneGuide,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: BLOCK_TOP_LANE_2 - 2,
            left: 0,
            width: widthPx,
            height: 1,
            background: C.laneGuide,
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'absolute', top: BLOCK_TOP_LANE_1 + 2, left: 6, color: getLaneLabelColor(1), fontSize: 10, pointerEvents: 'none' }}>
          Channel 1
        </div>
        <div style={{ position: 'absolute', top: BLOCK_TOP_LANE_2 + 2, left: 6, color: getLaneLabelColor(2), fontSize: 10, pointerEvents: 'none' }}>
          Channel 2
        </div>

        {/* Playhead line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: playheadX,
            width: 2,
            height: totalHeight,
            background: C.playheadColor,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      </div>
    </div>
  )
}
