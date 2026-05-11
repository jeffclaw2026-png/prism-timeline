import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { parseSrt, serializeSrt, type Cue } from './domain/srt/srt'
import { CommandStack, moveCueBy, resizeCueEnd, resizeCueStart, deleteCue, splitCue, editCueText, rippleMoveCues } from './domain/timing/commands'
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
  const stackRef = useRef<CommandStack | null>(null)
  const playRangeEndRef = useRef<number | null>(null)

  const activeCue = useMemo(
    () => cues.find((cue) => currentMs >= cue.startMs && currentMs <= cue.endMs),
    [cues, currentMs],
  )

  const activeCues = useMemo(
    () => cues.filter((cue) => currentMs >= cue.startMs && currentMs <= cue.endMs),
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement | null)?.tagName
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return

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
        downloadSrt()
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

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      <h1>Prism Timeline MVP</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <label>
          Video:
          <input type="file" accept="video/*" onChange={(e) => onVideoFile(e.target.files?.[0] ?? null)} />
        </label>

        <label>
          SRT:
          <input type="file" accept=".srt,text/plain" onChange={(e) => onSrtFile(e.target.files?.[0] ?? null)} />
        </label>

        <button
          onClick={() => {
            stackRef.current?.undo()
            syncFromStack()
          }}
        >
          Undo
        </button>
        <button
          onClick={() => {
            stackRef.current?.redo()
            syncFromStack()
          }}
        >
          Redo
        </button>

        <button onClick={downloadSrt}>Export SRT (.srt file)</button>
      </div>

      {error && <p style={{ color: 'crimson' }}>SRT parse error: {error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          <div style={{ position: 'relative', background: '#111', borderRadius: 8, overflow: 'hidden' }}>
            {videoUrl ? (
              <video
                ref={videoRef}
                controls
                src={videoUrl}
                style={{ width: '100%', display: 'block' }}
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
              <div style={{ height: 320, display: 'grid', placeItems: 'center', color: '#aaa' }}>Load a video to start</div>
            )}

            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 12,
                textAlign: 'center',
                color: 'white',
                textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                padding: '0 12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              {activeCues.length > 0 ? (
                activeCues.map((cue, i) => {
                  const size = Math.max(12, 20 - i * 3)
                  const opacity = 1 - i * 0.15
                  return (
                    <div
                      key={cue.index}
                      style={{
                        fontSize: size,
                        opacity,
                        lineHeight: 1.3,
                        background: i > 0 ? 'rgba(0,0,0,0.5)' : undefined,
                        padding: i > 0 ? '1px 8px' : undefined,
                        borderRadius: 4,
                        maxWidth: '100%',
                      }}
                    >
                      {activeCues.length > 1 && <span style={{ fontSize: 10, opacity: 0.6 }}>#{cue.index} </span>}
                      {cue.text}
                    </div>
                  )
                })
              ) : (
                <span style={{ fontSize: 20 }}>{activeCue?.text ?? ''}</span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 12, marginBottom: 8 }}>
            <strong>Playhead:</strong> {Math.floor(currentMs)} ms
            <label style={{ marginLeft: 16 }}>
              Zoom
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              {zoom.toFixed(1)}x
            </label>
            <span style={{ marginLeft: 16, color: '#888', fontSize: 12 }}>
              Alt+drag/Alt+←→ = ripple
            </span>
          </div>

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
            onSeek={(ms) => {
              setCurrentMs(ms)
              if (videoRef.current) videoRef.current.currentTime = ms / 1000
            }}
          />

          {selectedCueIndex && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => {
                  const cue = cues.find((c) => c.index === selectedCueIndex)
                  if (cue) playSelection(cue)
                }}
                style={{ fontWeight: 'bold', background: '#16a34a', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer' }}
              >
                ▶ Play selection
              </button>
              <button onClick={() => runMoveCue(selectedCueIndex, -100)}>←100ms</button>
              <button onClick={() => runMoveCue(selectedCueIndex, 100)}>100ms→</button>
              <button onClick={() => runRippleMove(selectedCueIndex, -100)}>⟪←100ms ripple</button>
              <button onClick={() => runRippleMove(selectedCueIndex, 100)}>⟫100ms ripple→</button>
            </div>
          )}
        </div>

        <div>
          <h3>Cues ({cues.length}) {overlapCueIndices.size > 0 ? `• ${overlapCueIndices.size} overlap` : ''}</h3>
          <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
            {cues.map((cue) => {
              const isSelected = cue.index === selectedCueIndex
              return (
                <div
                  key={cue.index}
                  onClick={() => setSelectedCueIndex(cue.index)}
                  style={{
                    padding: 8,
                    borderBottom: '1px solid #eee',
                    textAlign: 'left',
                    background: isSelected
                      ? '#fff7ed'
                      : overlapCueIndices.has(cue.index)
                        ? '#fee2e2'
                        : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                    #{cue.index} {cue.startMs} → {cue.endMs}
                  </div>
                  {isSelected ? (
                    <textarea
                      value={editingText}
                      onChange={(e) => {
                        setEditingText(e.target.value)
                      }}
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
                      style={{
                        width: '100%',
                        boxSizing: 'border-box' as const,
                        font: 'inherit',
                        fontSize: 13,
                        padding: 4,
                        borderRadius: 4,
                        border: '1px solid #fbbf24',
                        background: '#fff',
                        resize: 'vertical' as const,
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 13 }}>{cue.text}</div>
                  )}
                </div>
              )
            })}
            {cues.length === 0 && <div style={{ padding: 8, color: '#666' }}>No cues loaded</div>}
          </div>
        </div>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary>Loaded SRT source</summary>
        <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>{srtRaw}</pre>
      </details>

      <details style={{ marginTop: 12 }} open={Boolean(exportText)}>
        <summary>Exported SRT</summary>
        <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>{exportText}</pre>
      </details>
    </div>
  )
}

export default App
