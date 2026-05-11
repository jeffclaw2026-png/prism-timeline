# Prism Timeline

A web-based subtitle editing tool. Load a video and SRT file, edit subtitles on a visual timeline (2 channels), and export back to SRT.

## Features

- **Timeline editing** — smooth drag/resize subtitle blocks with snapping
- **2-channel lanes** — move cues between Channel 1 and Channel 2 by vertical drag/drop
- **Inline text editing** — click a cue to edit text directly
- **Ripple edit** — Alt+drag or Alt+arrows to shift all subsequent cues together
- **Lane-aware overlap detection** — overlaps are highlighted only within the same channel
- **Play selection** — play only the selected cue's time range
- **Keyboard shortcuts** — Space, arrows, Delete, S (split), Ctrl+Z/Y, Ctrl+S
- **Timecode display** — cue list shows `HH:MM:SS.CS` format

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
| Ctrl+S | Save autosave snapshot to localStorage |
| Ctrl+E | Export SRT file |
| Ctrl+= / Ctrl+- | Zoom in / out |
| Shift+scroll | Zoom on timeline |
| Double-click timeline | Seek playhead |
| ↑ / ↓ | Move selected cue to Ch1 / Ch2 |

## Tech Stack

- React 19 + TypeScript
- Vite
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
