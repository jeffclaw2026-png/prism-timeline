import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { parseSrt, serializeSrt, type Cue } from './domain/srt/srt'
import { CommandStack, moveCueBy, resizeCueEnd, resizeCueStart } from './domain/timing/commands'
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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stackRef = useRef<CommandStack | null>(null)

  const activeCue = useMemo(
    () => cues.find((cue) => currentMs >= cue.startMs && currentMs <= cue.endMs),
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

      if (!selectedCueIndex) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        runMoveCue(selectedCueIndex, e.shiftKey ? -500 : -100)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        runMoveCue(selectedCueIndex, e.shiftKey ? 500 : 100)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedCueIndex, cues])

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
                onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
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
                fontSize: 20,
                textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                padding: '0 12px',
              }}
            >
              {activeCue?.text ?? ''}
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
            onResizeStart={runResizeStart}
            onResizeEnd={runResizeEnd}
            onSeek={(ms) => {
              setCurrentMs(ms)
              if (videoRef.current) videoRef.current.currentTime = ms / 1000
            }}
          />

          {selectedCueIndex && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => runMoveCue(selectedCueIndex, -100)}>Nudge -100ms</button>
              <button onClick={() => runMoveCue(selectedCueIndex, 100)}>Nudge +100ms</button>
            </div>
          )}
        </div>

        <div>
          <h3>Cues ({cues.length}) {overlapCueIndices.size > 0 ? `• ${overlapCueIndices.size} overlap` : ''}</h3>
          <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
            {cues.map((cue) => (
              <div
                key={cue.index}
                onClick={() => setSelectedCueIndex(cue.index)}
                style={{
                  padding: 8,
                  borderBottom: '1px solid #eee',
                  textAlign: 'left',
                  background:
                    cue.index === selectedCueIndex
                      ? '#fff7ed'
                      : overlapCueIndices.has(cue.index)
                        ? '#fee2e2'
                        : undefined,
                  cursor: 'pointer',
                }}
              >
                <div>
                  #{cue.index} {cue.startMs} → {cue.endMs}
                </div>
                <div>{cue.text}</div>
              </div>
            ))}
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
