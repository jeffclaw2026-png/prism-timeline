import { describe, expect, it } from 'vitest'
import type { Cue } from '../srt/srt'
import { CommandStack, moveCueBy, resizeCueEnd, resizeCueStart, deleteCue, splitCue } from './commands'

const cues: Cue[] = [
  { index: 1, startMs: 1000, endMs: 2000, text: 'A' },
  { index: 2, startMs: 2500, endMs: 3200, text: 'B' },
]

describe('timing commands', () => {
  it('moves cue by delta and supports undo/redo', () => {
    const stack = new CommandStack(cues)
    stack.execute(moveCueBy(1, 300))

    expect(stack.current()[0]).toMatchObject({ startMs: 1300, endMs: 2300 })

    stack.undo()
    expect(stack.current()[0]).toMatchObject({ startMs: 1000, endMs: 2000 })

    stack.redo()
    expect(stack.current()[0]).toMatchObject({ startMs: 1300, endMs: 2300 })
  })

  it('resizes start but never passes end', () => {
    const stack = new CommandStack(cues)
    stack.execute(resizeCueStart(1, 1900))
    expect(stack.current()[0]).toMatchObject({ startMs: 1900, endMs: 2000 })

    stack.execute(resizeCueStart(1, 2200))
    expect(stack.current()[0]).toMatchObject({ startMs: 1999, endMs: 2000 })
  })

  it('resizes end but never goes before start', () => {
    const stack = new CommandStack(cues)
    stack.execute(resizeCueEnd(1, 1500))
    expect(stack.current()[0]).toMatchObject({ startMs: 1000, endMs: 1500 })

    stack.execute(resizeCueEnd(1, 900))
    expect(stack.current()[0]).toMatchObject({ startMs: 1000, endMs: 1001 })
  })

  it('deletes a cue and supports undo', () => {
    const stack = new CommandStack(cues)
    expect(stack.current()).toHaveLength(2)

    stack.execute(deleteCue(1))
    expect(stack.current()).toHaveLength(1)
    expect(stack.current()[0].index).toBe(2)

    stack.undo()
    expect(stack.current()).toHaveLength(2)
    expect(stack.current()[0].index).toBe(1)
  })

  it('splits a cue at the given ms', () => {
    const stack = new CommandStack(cues)
    stack.execute(splitCue(1, 1500))

    const result = stack.current()
    expect(result).toHaveLength(3)
    // First half
    expect(result[0]).toMatchObject({ index: 1, startMs: 1000, endMs: 1500, text: 'A' })
    // Second half (new cue)
    expect(result[1]).toMatchObject({ startMs: 1500, endMs: 2000, text: '' })
    expect(result[1].index).toBeGreaterThan(2)

    stack.undo()
    expect(stack.current()).toHaveLength(2)
  })
})
