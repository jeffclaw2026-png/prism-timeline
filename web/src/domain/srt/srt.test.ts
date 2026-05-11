import { describe, expect, it } from 'vitest'
import { parseSrt, serializeSrt } from './srt'

describe('SRT parser/serializer', () => {
  it('parses basic SRT cues', () => {
    const input = `1
00:00:01,000 --> 00:00:02,500
Hello world

2
00:00:03,000 --> 00:00:04,000
Second cue`

    const parsed = parseSrt(input)

    expect(parsed.cues).toHaveLength(2)
    expect(parsed.cues[0]).toMatchObject({
      index: 1,
      startMs: 1000,
      endMs: 2500,
      text: 'Hello world',
    })
  })

  it('serializes cues back to valid SRT format', () => {
    const output = serializeSrt({
      cues: [
        { index: 1, startMs: 1000, endMs: 2500, text: 'Hello world' },
        { index: 2, startMs: 3000, endMs: 4000, text: 'Second cue' },
      ],
    })

    expect(output).toContain('00:00:01,000 --> 00:00:02,500')
    expect(output).toContain('00:00:03,000 --> 00:00:04,000')
  })

  it('round-trips parse -> serialize -> parse', () => {
    const input = `1
00:00:00,500 --> 00:00:01,200
A

2
00:00:01,300 --> 00:00:02,800
B`

    const once = parseSrt(input)
    const serialized = serializeSrt(once)
    const twice = parseSrt(serialized)

    expect(twice.cues).toEqual(once.cues)
  })
})
