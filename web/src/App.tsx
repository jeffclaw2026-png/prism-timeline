import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { parseSrt, serializeSrt, type Cue } from './domain/srt/srt'
import { CommandStack, moveCueBy, resizeCueEnd, resizeCueStart, deleteCue, splitCue, editCueText, rippleMoveCues, insertCue, setCueLane } from './domain/timing/commands'
import { findOverlappingCueIndices } from './domain/timing/overlap'
import { Timeline } from './components/timeline/Timeline'

function App() {
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [cues, setCues] = useState<Cue[]>([])
  const [srtRaw, setSrtRaw] = useState('')
  const [currentMs, setCurrentMs] = useState(0)
  const [error, setError] = useState<string>('')
  const [zoom, setZoom] = useState(1)
  const [selectedCueIndex, setSelectedCueIndex] = useState<number | null>(null)
  const [exportText, setExportText] = useState('')
  const [editingText, setEditingText] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cueListRef = useRef<HTMLDivElement | null>(null)
  const cueItemRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const stackRef = useRef<CommandStack | null>(null)
  const playRangeEndRef = useRef<number | null>(null)

  const activeCue = useMemo(
    () => cues.find((cue) => currentMs >= cue.startMs && currentMs < cue.endMs),
    [cues, currentMs],
  )

  const activeCues = useMemo(
    () => cues.filter((cue) => currentMs >= cue.startMs && currentMs < cue.endMs),
    [cues, currentMs],
  )

  const durationMs = useMemo(() => Math.max(10000, ...cues.map((c) => c.endMs), currentMs), [cues, currentMs])
  const overlapCueIndices = useMemo(() => findOverlappingCueIndices(cues), [cues])

  const syncFromStack = () => {
    if (!stackRef.current) return
    setCues(stackRef.current.current())
  }

  const onVideoFile = (file: File | null) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
  }

  const onSrtFile = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    setSrtRaw(text)
    try {
      const track = parseSrt(text)
      stackRef.current = new CommandStack(track.cues)
      setCues(track.cues)
      setSelectedCueIndex(track.cues[0]?.index ?? null)
      setError('')
      setExportText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse SRT')
      setCues([])
      stackRef.current = null
    }
  }

  // Auto-save to localStorage when cues change
  useEffect(() => {
    if (cues.length > 0) {
      const content = serializeSrt({ cues })
      try { localStorage.setItem('prism-autosave', content) } catch { /* quota exceeded */ }
    }
  }, [cues])

  // Sync editing text when selected cue changes
  useEffect(() => {
    const cue = cues.find((c) => c.index === selectedCueIndex)
    setEditingText(cue?.text ?? '')
  }, [selectedCueIndex, cues])

  useEffect(() => {
    if (selectedCueIndex === null) return
    const container = cueListRef.current
    const item = cueItemRefs.current[selectedCueIndex]
    if (!container || !item) return

    const containerTop = container.scrollTop
    const containerBottom = containerTop + container.clientHeight
    const itemTop = item.offsetTop
    const itemBottom = itemTop + item.offsetHeight

    if (itemTop >= containerTop && itemBottom <= containerBottom) return
    item.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selectedCueIndex])

  useEffect(() => {
    try {
      localStorage.removeItem('prism-editor-state-v1')
    } catch {
      // ignore storage issues
    }
  }, [])

  const runMoveCue = (index: number, deltaMs: number) => {
    if (!stackRef.current) return
    stackRef.current.execute(moveCueBy(index, deltaMs))
    syncFromStack()
  }

  const runResizeStart = (index: number, nextStartMs: number) => {
    if (!stackRef.current) return
    stackRef.current.execute(resizeCueStart(index, nextStartMs))
    syncFromStack()
  }

  const runResizeEnd = (index: number, nextEndMs: number) => {
    if (!stackRef.current) return
    stackRef.current.execute(resizeCueEnd(index, nextEndMs))
    syncFromStack()
  }

  const runDelete = (index: number) => {
    if (!stackRef.current) return
    stackRef.current.execute(deleteCue(index))
    syncFromStack()
    setSelectedCueIndex(null)
  }

  const runSplit = (index: number) => {
    if (!stackRef.current) return
    stackRef.current.execute(splitCue(index, currentMs))
    syncFromStack()
  }

  const runEditText = (index: number, text: string) => {
    if (!stackRef.current) return
    stackRef.current.execute(editCueText(index, text))
    syncFromStack()
  }

  const runRippleMove = (fromIndex: number, deltaMs: number) => {
    if (!stackRef.current) return
    stackRef.current.execute(rippleMoveCues(fromIndex, deltaMs))
    syncFromStack()
  }

  const runInsert = () => {
    if (!stackRef.current) return
    const DEFAULT_DURATION = 2000 // 2 seconds
    stackRef.current.execute(insertCue(currentMs, currentMs + DEFAULT_DURATION))
    syncFromStack()
  }

  const runMoveLane = (index: number, lane: 1 | 2) => {
    if (!stackRef.current) return
    stackRef.current.execute(setCueLane(index, lane))
    syncFromStack()
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement | null)?.tagName
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return

      if (e.code === 'Enter') {
        e.preventDefault()
        runInsert()
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        const v = videoRef.current
        if (!v) return
        if (v.paused) void v.play()
        else v.pause()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) stackRef.current?.redo()
        else stackRef.current?.undo()
        syncFromStack()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        // Save to localStorage only
        const content = serializeSrt({ cues })
        try { localStorage.setItem('prism-autosave', content) } catch { /* quota exceeded */ }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        downloadSrt()
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setZoom((z) => Math.min(4, z + 0.2))
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        setZoom((z) => Math.max(0.5, z - 0.2))
        return
      }

      if (!selectedCueIndex) return

      // Ripple move with Alt key
      if (e.altKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          runRippleMove(selectedCueIndex, e.shiftKey ? -500 : -100)
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          runRippleMove(selectedCueIndex, e.shiftKey ? 500 : 100)
          return
        }
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        runMoveCue(selectedCueIndex, e.shiftKey ? -500 : -100)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        runMoveCue(selectedCueIndex, e.shiftKey ? 500 : 100)
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        runDelete(selectedCueIndex)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        runMoveLane(selectedCueIndex, 1)
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        runMoveLane(selectedCueIndex, 2)
      }
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        runSplit(selectedCueIndex)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedCueIndex, cues, currentMs])

  const downloadSrt = () => {
    const content = serializeSrt({ cues })
    setExportText(content)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'edited.srt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const playSelection = (cue: Cue) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = cue.startMs / 1000
    playRangeEndRef.current = cue.endMs
    void v.play()
  }

  const formatTimecode = (ms: number) => {
    const safeMs = Math.max(0, Math.floor(ms))
    const hours = Math.floor(safeMs / 3_600_000)
    const minutes = Math.floor((safeMs % 3_600_000) / 60_000)
    const seconds = Math.floor((safeMs % 60_000) / 1000)
    const centiseconds = Math.floor((safeMs % 1000) / 10)

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
  }

  return (
    <div className="prism-shell">
      {/* Header */}
      <div className="prism-header">
        <h1 className="prism-title">Prism Timeline Editor</h1>
        <div className="prism-toolbar">
          <label className="prism-file-label">
            <span>Video</span>
            <input
              type="file"
              accept="video/*"
              className="prism-file-input"
              onChange={(e) => onVideoFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="prism-file-label">
            <span>SRT</span>
            <input
              type="file"
              accept=".srt,text/plain"
              className="prism-file-input"
              onChange={(e) => onSrtFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button className="prism-btn prism-btn-secondary" onClick={() => { stackRef.current?.undo(); syncFromStack() }}>
            Undo
          </button>
          <button className="prism-btn prism-btn-secondary" onClick={() => { stackRef.current?.redo(); syncFromStack() }}>
            Redo
          </button>
          <button className="prism-btn prism-btn-primary" onClick={downloadSrt}>
            Export SRT
          </button>
        </div>
      </div>

      {error && <p className="prism-error">SRT parse error: {error}</p>}

      {/* Main Layout */}
      <div className="prism-main-grid">
        {/* Left: Video + Timeline */}
        <div>
          {/* Video Player */}
          <div className="prism-video-container">
            {videoUrl ? (
              <video
                ref={videoRef}
                controls
                src={videoUrl}
                className="prism-video"
                onTimeUpdate={(e) => {
                  const ms = e.currentTarget.currentTime * 1000
                  setCurrentMs(ms)
                  // Auto-stop when playing a range
                  if (playRangeEndRef.current !== null && ms >= playRangeEndRef.current) {
                    e.currentTarget.pause()
                    playRangeEndRef.current = null
                  }
                }}
              />
            ) : (
              <div className="prism-video-placeholder">Load a video to start</div>
            )}

            {/* Subtitle overlay */}
            <div className="prism-subtitle-overlay">
              {activeCues.length > 0 ? (
                activeCues.map((cue) => (
                  <div key={cue.index} className="prism-subtitle-line">
                    {cue.text}
                  </div>
                ))
              ) : (
                <span className="prism-subtitle-line">{activeCue?.text ?? ''}</span>
              )}
            </div>
          </div>

          {/* Playhead info bar */}
          <div className="prism-playhead-bar">
            <span className="prism-playhead-time">{formatTimecode(currentMs)}</span>
            <label className="prism-zoom-label">
              Zoom
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.1}
                value={zoom}
                className="prism-zoom-slider"
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <span className="prism-zoom-value">{zoom.toFixed(1)}×</span>
            </label>
            <span className="prism-hint">
              Double-click timeline = seek · Shift+wheel = timeline zoom · Alt+drag/Alt+←→ = ripple
            </span>
          </div>

          {/* Timeline */}
          <Timeline
            cues={cues}
            durationMs={durationMs}
            zoom={zoom}
            currentMs={currentMs}
            selectedCueIndex={selectedCueIndex}
            overlapCueIndices={overlapCueIndices}
            onSelectCue={setSelectedCueIndex}
            onMoveCue={runMoveCue}
            onRippleMove={runRippleMove}
            onResizeStart={runResizeStart}
            onResizeEnd={runResizeEnd}
            onMoveCueLane={runMoveLane}
            onSeek={(ms) => {
              setCurrentMs(ms)
              if (videoRef.current) videoRef.current.currentTime = ms / 1000
            }}
            onZoom={(delta) => setZoom((z) => Math.max(0.5, Math.min(4, z + delta)))}
          />

          {/* Cue actions toolbar */}
          {selectedCueIndex && (
            <div className="prism-cue-toolbar">
              <button
                className="prism-btn prism-btn-success"
                onClick={() => {
                  const cue = cues.find((c) => c.index === selectedCueIndex)
                  if (cue) playSelection(cue)
                }}
              >
                ▶ Play
              </button>
              <button className="prism-btn prism-btn-secondary prism-btn-sm" onClick={() => runMoveCue(selectedCueIndex, -100)}>
                ← 100ms
              </button>
              <button className="prism-btn prism-btn-secondary prism-btn-sm" onClick={() => runMoveCue(selectedCueIndex, 100)}>
                100ms →
              </button>
              <button className="prism-btn prism-btn-secondary prism-btn-sm" onClick={() => runMoveLane(selectedCueIndex, 1)}>
                Ch 1 ↑
              </button>
              <button className="prism-btn prism-btn-secondary prism-btn-sm" onClick={() => runMoveLane(selectedCueIndex, 2)}>
                Ch 2 ↓
              </button>
              <button className="prism-btn prism-btn-secondary prism-btn-sm" onClick={() => runRippleMove(selectedCueIndex, -100)}>
                ⟪ 100ms ripple
              </button>
              <button className="prism-btn prism-btn-secondary prism-btn-sm" onClick={() => runRippleMove(selectedCueIndex, 100)}>
                100ms ripple ⟫
              </button>
              <button className="prism-btn prism-btn-danger prism-btn-sm" onClick={() => runDelete(selectedCueIndex)}>
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Right: Cue List */}
        <div className="prism-panel">
          <div className="prism-panel-header">
            <span>Cues ({cues.length})</span>
            {overlapCueIndices.size > 0 && (
              <span style={{ color: 'var(--prism-warning)' }}>{overlapCueIndices.size} overlapping</span>
            )}
          </div>
          <div ref={cueListRef} className="prism-cue-list">
            {cues.map((cue) => {
              const isSelected = cue.index === selectedCueIndex
              const isOverlap = overlapCueIndices.has(cue.index)

              const itemClass = [
                'prism-cue-item',
                isSelected && 'prism-cue-item--selected',
                isOverlap && !isSelected && 'prism-cue-item--overlap',
              ].filter(Boolean).join(' ')

              return (
                <div
                  key={cue.index}
                  ref={(el) => { cueItemRefs.current[cue.index] = el }}
                  className={itemClass}
                  onClick={() => {
                    setSelectedCueIndex(cue.index)
                    setCurrentMs(cue.startMs)
                    if (videoRef.current) videoRef.current.currentTime = cue.startMs / 1000
                  }}
                >
                  <div className="prism-cue-meta">
                    Ch{cue.lane ?? 1} · #{cue.index} · {formatTimecode(cue.startMs)} → {formatTimecode(cue.endMs)}
                  </div>
                  {isSelected ? (
                    <textarea
                      value={editingText}
                      className="prism-cue-textarea"
                      onChange={(e) => { setEditingText(e.target.value) }}
                      onBlur={() => {
                        if (editingText !== (cues.find((c) => c.index === cue.index)?.text ?? '')) {
                          runEditText(cue.index, editingText)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          (e.target as HTMLTextAreaElement).blur()
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      rows={2}
                    />
                  ) : (
                    <div className="prism-cue-text">{cue.text}</div>
                  )}
                </div>
              )
            })}
            {cues.length === 0 && <div className="prism-cue-empty">No cues loaded</div>}
          </div>
        </div>
      </div>

      {/* SRT source viewer */}
      <details className="prism-details">
        <summary>Loaded SRT source</summary>
        <pre className="prism-code-block">{srtRaw}</pre>
      </details>

      <details className="prism-details" open={Boolean(exportText)}>
        <summary>Exported SRT</summary>
        <pre className="prism-code-block">{exportText}</pre>
      </details>
    </div>
  )
}

export default App
