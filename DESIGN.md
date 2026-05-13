---
version: alpha
name: Prism Dark
description: Focused dark theme for a video subtitle editor. Minimal, precise, professional — inspired by modern non-linear video editors like DaVinci Resolve.
colors:
  primary: "#6366f1"
  bg-primary: "#0b0e14"
  bg-secondary: "#131820"
  bg-elevated: "#1a202e"
  border: "#252d3a"
  text-primary: "#e4e8ee"
  text-secondary: "#8896a8"
  accent: "#6366f1"
  accent-hover: "#818cf8"
  accent-subtle: "#1b2240"
  success: "#22c55e"
  success-hover: "#16a34a"
  success-subtle: "#14281c"
  danger: "#ef4444"
  danger-subtle: "#291a1e"
  warning: "#f59e0b"
  warning-subtle: "#29221c"
  channel-1: "#38bdf8"
  channel-2: "#fb923c"
  playhead: "#ef4444"
typography:
  body-md:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 0.875rem
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 0.8125rem
    lineHeight: 1.4
  mono-sm:
    fontFamily: JetBrains Mono, Fira Code, monospace
    fontSize: 0.75rem
    lineHeight: 1.4
  heading:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 8px 16px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.bg-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 8px 16px
  button-secondary-hover:
    backgroundColor: "{colors.border}"
  button-danger:
    backgroundColor: "{colors.danger-subtle}"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  button-danger-hover:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
  timeline-track:
    backgroundColor: "{colors.bg-primary}"
    rounded: "{rounded.lg}"
  cue-block:
    backgroundColor: "{colors.bg-elevated}"
    rounded: "{rounded.md}"
  cue-block-selected:
    backgroundColor: "{colors.accent-subtle}"
  cue-block-overlap:
    backgroundColor: "{colors.danger-subtle}"
  timeline-ruler-text:
    textColor: "{colors.text-secondary}"
  cue-metadata:
    textColor: "{colors.text-secondary}"
  button-success:
    backgroundColor: "{colors.success}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 8px 16px
  button-success-hover:
    backgroundColor: "{colors.success-hover}"
  panel-surface:
    backgroundColor: "{colors.bg-secondary}"
    rounded: "{rounded.lg}"
  input-field:
    backgroundColor: "{colors.bg-primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 6px 10px
---

## Overview

Prism Dark is a **focused dark theme** for a video subtitle editor. It borrows
from modern non-linear video editors (DaVinci Resolve, Premiere Pro) — deep
backgrounds, minimal chrome, precise typography for timecodes.

The design is **restrained**: only one accent color (indigo) drives interaction.
Everything else stays neutral, letting the timeline content be the focus.

## Colors

- **bg-primary (#0b0e14)**: Deepest background — used for the workspace and timeline track.
- **bg-secondary (#131820)**: Panel backgrounds, the overall app shell.
- **bg-elevated (#1a202e)**: Cards, buttons, interactive surfaces that need to pop off bg-secondary.
- **border (#252d3a)**: Subtle borders for panels and containers.
- **text-primary (#e4e8ee)**: Primary body copy. High contrast against all backgrounds.
- **text-secondary (#8896a8)**: Captions, labels, metadata. Lower contrast to recede.
- **accent (#6366f1)**: The sole interaction driver. Buttons, selected states, focus rings.
- **accent-hover (#818cf8)** and **accent-subtle (rgba)**: Interaction variants.
- **success (#22c55e)**: Confirmation, export success.
- **danger (#ef4444)**: Playhead, delete actions, overlap warnings.
- **warning (#f59e0b)**: Overlap indicators in the cue list.
- **channel-1 (#38bdf8)** and **channel-2 (#fb923c)**: Lane colors for the two subtitle channels.
- **playhead (#ef4444)**: Vertical playhead line in the timeline — same as danger for consistency.

## Typography

Use **Inter** as the primary typeface (falls back to system-ui). For timecodes
in the ruler and cue list, use **JetBrains Mono** — monospace gives precise
alignment for time values.

All body text is `0.875rem` (14px) at 1.5 leading. Smaller metadata uses
`0.8125rem` (13px). Headings are `1.25rem` (20px) semibold.

## Layout & Spacing

A 4px base grid. Spacing tokens: xs (4px), sm (8px), md (12px), lg (16px), xl (24px).

The main layout is a 2-column grid: timeline (2fr) + cue list (1fr). Panels
have a subtle border and `rounded.lg` corners. Content inside pads to `spacing.lg`.

## Shapes

Rounded corners follow the `rounded` scale (4-6-8px). Interactive elements use
`rounded.md` (6px). Containers and panels use `rounded.lg` (8px). Timeline
cue blocks use `rounded.md` with 1px borders for subtle definition.

## Components

### Buttons
- **button-primary**: Indigo background, white text. For primary actions (Export SRT).
- **button-secondary**: Elevated surface background, text-primary. For secondary actions (Undo, Redo, fine-tuning).
- **button-danger**: Danger-subtle background, red text. For destructive actions (Delete). On hover, solid red with white text.

### Timeline
- **timeline-track**: Deepest background (#0b0e14), rounded-lg corners. The immersive canvas.
- **cue-block**: Elevated surface (#1a202e) with a 1px border. Displays subtitle text and index.
- **cue-block-selected**: Accent-subtle background, accent border. Active editing state.
- **cue-block-overlap**: Danger-subtle background, danger border. Warning state.

### Input
- **input-field**: Dark background with text-primary text. Subtle but clear. Used for
  file pickers and text fields.

## Do's and Don'ts

- **Do** keep the accent color rare — one or two elements per viewport at most.
- **Do** use monospace for all timecodes (ruler ticks, cue metadata).
- **Don't** introduce new accent colors. Indigo is the only accent.
- **Don't** use box shadows for elevation — rely on background color contrast (bg-secondary → bg-elevated).
- **Don't** use bright white (#fff) for backgrounds — the darkest surface should still have a tint.
