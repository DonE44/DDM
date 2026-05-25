// @ts-check
/**
 * LyricTimingEditor — Full-screen post-generation lyric timing editor.
 *
 * Opens as an overlay on top of the PresentationPlayer.
 * Displays all lyric pages as draggable/resizable blocks over the audio
 * waveform so users can visually align page timings to the audio track.
 *
 * Usage:
 *   <LyricTimingEditor
 *     pages={pages}
 *     presentationAudio={{ file, name, volume, loop }}
 *     onSave={(updatedPages) => setPages(updatedPages)}
 *     onClose={() => setOpen(false)}
 *   />
 *
 * On save: only page.lyricStart and page.lyricEnd are modified.
 * All other page data (elements, style, wordTimestamps, etc.) is preserved.
 */

import { useState, useRef, useCallback } from 'react'
import LyricTimeline from '../components/LyricTimeline.jsx'

// ── Conversion helpers ────────────────────────────────────────────────────────

/** Convert a page array to LyricTimeline "lines" format. */
function pagesToLines(pages) {
  return pages
    .filter(pg => pg.lyricStart != null || pg.timing?.mode === 'lyric')
    .map(pg => {
      const lyricEl = pg.elements?.find(el => el.elLabel === 'lyric')
      const instrEl = pg.elements?.find(el => el.elLabel === 'instrumental')
      const text    = lyricEl?.content || instrEl?.content || ''
      const isInst  = !lyricEl?.content && !!instrEl
      const start   = pg.lyricStart ?? 0
      const endFall = start + (pg.timing?.durationMs ? pg.timing.durationMs / 1000 : 4)
      const end     = pg.lyricEnd ?? endFall
      return {
        start,
        end,
        text:       isInst ? '' : text,
        durationMs: Math.round((end - start) * 1000),
        _pageId:    pg.id,
        _pageName:  pg.name,
      }
    })
    .sort((a, b) => a.start - b.start)
}

/** Apply edited lines back onto the pages array (only lyricStart/lyricEnd change). */
function applyLinesToPages(allPages, editedLines) {
  const lineMap = new Map(editedLines.map(l => [l._pageId, l]))
  return allPages.map(pg => {
    const line = lineMap.get(pg.id)
    if (!line) return pg
    return { ...pg, lyricStart: line.start, lyricEnd: line.end }
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   pages: import('../types/desktop-api').SmmPage[],
 *   presentationAudio: { file:string, name?:string, volume?:number, loop?:boolean } | null,
 *   onSave: (updatedPages: import('../types/desktop-api').SmmPage[]) => void,
 *   onClose: () => void,
 * }} props
 */
export default function LyricTimingEditor({ pages, presentationAudio, onSave, onClose }) {
  const [lines, setLines]   = useState(() => pagesToLines(pages))
  const [dirty, setDirty]   = useState(false)
  const audioRef            = useRef(/** @type {HTMLAudioElement|null} */ (null))

  const audioUrl = presentationAudio?.file ?? ''

  const handleLinesChange = useCallback((newLines) => {
    setLines(newLines)
    setDirty(true)
  }, [])

  const handleSave = useCallback(() => {
    const updatedPages = applyLinesToPages(pages, lines)
    onSave(updatedPages)
    onClose()
  }, [pages, lines, onSave, onClose])

  const handleClose = useCallback(() => {
    if (dirty) {
      if (!window.confirm('Discard timing changes?')) return
    }
    onClose()
  }, [dirty, onClose])

  // ── Computed stats ──────────────────────────────────────────────────────────
  const lyricCount = lines.filter(l => l.text).length
  const instCount  = lines.filter(l => !l.text).length

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={S.title}>⏱ Lyric Timing Editor</span>
            {dirty && <span style={S.dirtyBadge}>● unsaved</span>}
          </div>
          <p style={S.subtitle}>
            Drag page blocks left/right to shift timing · drag right edge to change duration · click waveform to seek
          </p>
          <button onClick={handleClose} style={S.closeBtn} title="Close">✕</button>
        </div>

        {/* ── Audio player ── */}
        <div style={S.audioBar}>
          <span style={S.audioLabel}>🎵 {presentationAudio?.name ?? 'Audio track'}</span>
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            style={S.audioEl}
          />
        </div>

        {/* ── Page summary ── */}
        <div style={S.summary}>
          <span style={S.stat}>{lines.length} total pages</span>
          <span style={S.stat}>{lyricCount} lyric</span>
          <span style={S.stat}>{instCount} instrumental</span>
          <span style={{ ...S.stat, marginLeft: 'auto', color: 'var(--t3,#888)' }}>
            Drag blocks to match audio · the red line = current playback position
          </span>
        </div>

        {/* ── Timeline (scrollable) ── */}
        <div style={S.timelineWrap}>
          {lines.length === 0 ? (
            <div style={S.empty}>
              No timed pages found. Generate a lyric video first, then open this editor.
            </div>
          ) : (
            <LyricTimeline
              lines={lines}
              onChange={handleLinesChange}
              audioUrl={audioUrl}
              audioRef={audioRef}
            />
          )}
        </div>

        {/* ── Footer actions ── */}
        <div style={S.footer}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              style={S.secondaryBtn}
              title="Reset all timings back to original (un-saves changes)"
              onClick={() => { setLines(pagesToLines(pages)); setDirty(false) }}
            >
              ↺ Reset
            </button>
            <button
              style={S.secondaryBtn}
              title="Auto-fill each page's end time with the next page's start"
              onClick={() => {
                const sorted = [...lines].sort((a, b) => a.start - b.start)
                const filled = sorted.map((l, i) => ({
                  ...l,
                  end:        i < sorted.length - 1 ? sorted[i + 1].start : l.end,
                  durationMs: i < sorted.length - 1
                    ? Math.round((sorted[i + 1].start - l.start) * 1000)
                    : l.durationMs,
                }))
                setLines(filled)
                setDirty(true)
              }}
            >
              🔗 Auto-fill ends
            </button>
            <button
              style={S.secondaryBtn}
              title="Sort pages by start time"
              onClick={() => {
                setLines(prev => [...prev].sort((a, b) => a.start - b.start))
                setDirty(true)
              }}
            >
              ⇅ Sort
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleClose} style={S.cancelBtn}>Cancel</button>
            <button
              onClick={handleSave}
              style={S.saveBtn}
              disabled={lines.length === 0}
            >
              💾 Save Timings
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
/** @type {Record<string, import('react').CSSProperties>} */
const S = {
  overlay: {
    position:        'fixed',
    inset:           0,
    background:      'rgba(0,0,0,0.88)',
    zIndex:          9999,
    display:         'flex',
    alignItems:      'stretch',
    justifyContent:  'center',
    padding:         24,
    boxSizing:       'border-box',
  },
  modal: {
    width:          '100%',
    maxWidth:       1400,
    background:     'var(--bg1,#12151f)',
    border:         '1px solid var(--border,#2c3a52)',
    borderRadius:   10,
    display:        'flex',
    flexDirection:  'column',
    overflow:       'hidden',
    boxShadow:      '0 24px 80px rgba(0,0,0,0.7)',
  },
  header: {
    padding:        '14px 18px 10px',
    borderBottom:   '1px solid var(--border,#2c3a52)',
    position:       'relative',
    background:     'var(--bg2,#1a1a2e)',
  },
  title: {
    fontSize:   16,
    fontWeight: 700,
    color:      '#f59e0b',
  },
  dirtyBadge: {
    fontSize:  11,
    color:     '#f87171',
    fontWeight: 600,
  },
  subtitle: {
    margin:   '4px 0 0',
    fontSize: 11,
    color:    'var(--t3,#888)',
  },
  closeBtn: {
    position:    'absolute',
    top:         12,
    right:       14,
    background:  'none',
    border:      'none',
    color:       'var(--t2,#ccc)',
    fontSize:    16,
    cursor:      'pointer',
    padding:     '2px 6px',
    borderRadius: 4,
  },
  audioBar: {
    padding:     '8px 14px',
    borderBottom: '1px solid var(--border,#2c3a52)',
    background:  'var(--bg2,#1a1a2e)',
    display:     'flex',
    alignItems:  'center',
    gap:         12,
  },
  audioLabel: {
    fontSize:    11,
    color:       'var(--t3,#888)',
    flex:        '0 0 auto',
    maxWidth:    260,
    overflow:    'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:  'nowrap',
  },
  audioEl: {
    flex:   1,
    height: 34,
  },
  summary: {
    padding:    '5px 14px',
    display:    'flex',
    gap:        14,
    alignItems: 'center',
    borderBottom: '1px solid var(--border,#2c3a52)',
    background: 'var(--bg2,#1a1a2e)',
    flexWrap:   'wrap',
  },
  stat: {
    fontSize:   10,
    color:      'var(--t2,#bbc)',
    fontWeight: 600,
  },
  timelineWrap: {
    flex:       1,
    overflow:   'hidden',
    padding:    '10px 14px',
    minHeight:  200,
  },
  empty: {
    padding:    40,
    textAlign:  'center',
    color:      'var(--t3,#888)',
    fontSize:   13,
  },
  footer: {
    padding:      '10px 14px',
    borderTop:    '1px solid var(--border,#2c3a52)',
    background:   'var(--bg2,#1a1a2e)',
    display:      'flex',
    justifyContent: 'space-between',
    alignItems:   'center',
    gap:          10,
    flexWrap:     'wrap',
  },
  secondaryBtn: {
    padding:     '4px 10px',
    fontSize:    11,
    cursor:      'pointer',
    border:      '1px solid var(--border,#444)',
    borderRadius: 4,
    background:  'var(--bg3,#2a2a3e)',
    color:       'var(--t2,#ccc)',
  },
  cancelBtn: {
    padding:     '5px 14px',
    fontSize:    12,
    cursor:      'pointer',
    border:      '1px solid var(--border,#444)',
    borderRadius: 5,
    background:  'var(--bg3,#2a2a3e)',
    color:       'var(--t2,#ccc)',
  },
  saveBtn: {
    padding:     '5px 18px',
    fontSize:    13,
    fontWeight:  700,
    cursor:      'pointer',
    border:      'none',
    borderRadius: 5,
    background:  '#7c3aed',
    color:       '#fff',
  },
}
