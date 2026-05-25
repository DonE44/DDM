import assert from 'node:assert/strict'
import { buildPlayerHtml } from '../src/utils/publishUtils.js'

const samplePages = [
  {
    id: 'page-1',
    name: 'Smoke Page',
    bgColor: '#102030',
    timing: { mode: 'click' },
    wordTimestamps: [
      { start: 0, end: 0.6, text: 'Smoke' },
      { start: 0.6, end: 1.2, text: 'Test' },
    ],
    narration: { file: 'https://example.com/a.mp3', autoPlay: false },
    narration2: { file: 'https://example.com/b.mp3', autoPlay: false },
    elements: [
      {
        id: 'lyric-1',
        type: 'text',
        x: 40,
        y: 40,
        w: 400,
        h: 120,
        elLabel: 'lyric',
        content: 'Smoke Test',
      },
      {
        id: 'btn-lyrics',
        type: 'button',
        x: 40,
        y: 200,
        w: 220,
        h: 56,
        label: 'Lyrics',
        action: 'event',
        elLabel: 'lyrics-btn',
      },
      {
        id: 'btn-mute',
        type: 'button',
        x: 280,
        y: 200,
        w: 220,
        h: 56,
        label: 'Narration Mute',
        action: 'event',
        elLabel: 'narration-mute-btn',
      },
      {
        id: 'btn-toggle',
        type: 'button',
        x: 520,
        y: 200,
        w: 220,
        h: 56,
        label: 'Narration',
        action: 'event',
        elLabel: 'narration-btn',
      },
    ],
  },
]

const stage = { width: 1280, height: 720 }

const html = await buildPlayerHtml(samplePages, stage, [], {
  title: 'Publish Toggle Smoke',
  navControls: true,
  kiosk: false,
})

assert.match(html, /NARRATION_TOGGLE_EVENTS/)
assert.match(html, /NARRATION_MUTE_EVENTS/)
assert.match(html, /LYRICS_TOGGLE_EVENTS/)
assert.match(html, /styleToggleButton\(/)
assert.match(html, /karaokeWordSpans/)
assert.match(html, /toggleButtons = Array\.from\(document\.querySelectorAll\('\[data-smme-toggle-role\]'\)\)/)
assert.match(html, /"elLabel":"lyrics-btn"/)
assert.match(html, /"elLabel":"narration-mute-btn"/)
assert.match(html, /"elLabel":"narration-btn"/)

console.log('[publish-toggle-smoke] PASS')
