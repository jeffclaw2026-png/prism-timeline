# Prism Timeline

A web-based subtitle editing tool. Load a video and SRT file, edit subtitles on a visual timeline — drag, resize, split, ripple-edit — and export back to SRT.

## Features

- **Timeline editing** — drag/resize subtitle blocks with snapping and collision detection
- **Inline text editing** — click a cue to edit text directly
- **Ripple edit** — Alt+drag or Alt+arrows to shift all subsequent cues together
- **Overlap detection** — overlapping cues highlighted in red; stacked preview on video
- **Play selection** — play only the selected cue's time range
- **Keyboard shortcuts** — Space, arrows, Delete, S (split), Ctrl+Z/Y, Ctrl+S
- **Auto-save** — edits persist in localStorage; Ctrl+S exports SRT file

## Quick Start

```bash
cd web
npm install
npm run dev
```

Open the app, load a video + SRT, and start editing.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| ← → | Nudge ±100ms |
| Shift+← → | Nudge ±500ms |
| Alt+← → | Ripple ±100ms |
| Alt+Shift+← → | Ripple ±500ms |
| Alt+drag | Ripple drag on timeline |
| Enter | Insert new cue at playhead |
| Delete / Backspace | Delete selected cue |
| S | Split cue at playhead |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+S | Save to localStorage |
| Ctrl+E | Export SRT file |

## Tech Stack

- React 19 + TypeScript
- Vite
- Zustand (state)
- Vitest (tests)

## Project Structure

```
web/src/
├── domain/
│   ├── srt/          # SRT parser & writer
│   └── timing/       # Commands, snapping, collision
├── components/
│   └── timeline/     # Timeline component
└── App.tsx           # Main app
```

## License

MIT
