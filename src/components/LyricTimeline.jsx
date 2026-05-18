// @ts-check
/**
 * LyricTimeline — visual drag-to-edit timeline for lyric page timing.
 *
 * Features:
 *  - Audio waveform visualised via Web Audio API (fetch → decodeAudioData)
 *  - Each lyric page = colour-coded draggable block
 *  - Drag block body        → move start+end together
 *  - Drag right-edge handle → resize duration
 *  - Red playhead direct-DOM update (no React state per frame)
 *  - Auto-scroll: playhead stays visible during playback
 *  - Click ruler/waveform   → seek audio
 *  - Zoom in/out / Fit to container
 *  - Active page gets bright outline
 */

import { useState, useRef, useEffect, useCallback } from 'react'

const RULER_H  = 24
const WAVE_H   = 64
const BLOCK_H  = 50
const PH_HEIGHT = RULER_H + WAVE_H + BLOCK_H + 12   // total playhead height

const MIN_ZOOM =  8   // px / second
const MAX_ZOOM = 400

const PALETTE = [
  '#3b82f6','#8b5cf6','#ec4899','#06b6d4',
  '#10b981','#f59e0b','#ef4444','#6366f1',
  '#84cc16','#f97316','#a855f7','#14b8a6',
]

function fmtT(s) {
  if (s == null || isNaN(s)) return '0:00.0'
  const m   = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

/**
 * @param {{
 *   lines:    {start:number, end:number, text:string, durationMs:number, _pageId?:string}[],
 *   onChange: (lines: any[]) => void,
 *   audioUrl: string,
 *   audioRef: React.RefObject<HTMLAudioElement>,
 * }} props
 */
export default function LyricTimeline({ lines, onChange, audioUrl, audioRef }) {
  const [zoom, setZoom]           = useState(40)
  const [duration, setDuration]   = useState(0)
  const [waveformPeaks, setWave]  = useState(/** @type {Float32Array|null} */ (null))
  const [waveError, setWaveError] = useState(false)
  const [hovIdx, setHovIdx]       = useState(-1)

  const containerRef  = useRef(/** @type {HTMLDivElement|null} */ (null))
  const waveCanvasRef = useRef(/** @type {HTMLCanvasElement|null} */ (null))
  const playheadRef   = useRef(/** @type {HTMLDivElement|null} */ (null))
  const rafRef        = useRef(/** @type {number|null} */ (null))
  const clockRef      = useRef(/** @type {HTMLSpanElement|null} */ (null))

  // Drag state in refs — no stale closures
  const dragRef     = useRef(/** @type {{type:string,idx:number,startX:number,origStart:number,origEnd:number,origLines:any[],zoom:number}|null} */ (null))
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  const zoomRef = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  // ── Audio duration ────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef?.current
    if (!audio) return
    const sync = () => { if (audio.duration > 0) setDuration(audio.duration) }
    if (audio.readyState >= 1) sync()
    audio.addEventListener('loadedmetadata', sync)
    audio.addEventListener('durationchange', sync)
    return () => {
      audio.removeEventListener('loadedmetadata', sync)
      audio.removeEventListener('durationchange', sync)
    }
  }, [audioRef])

  // ── Waveform decode ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!audioUrl) return
    let cancelled = false
    setWave(null)
    setWaveError(false)
    ;(async () => {
      try {
        const ACtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext
        if (!ACtx) { setWaveError(true); return }
        const ctx = new ACtx()
        const res = await fetch(audioUrl, { credentials: 'omit' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf     = await res.arrayBuffer()
        const decoded = await ctx.decodeAudioData(buf)
        await ctx.close()
        if (cancelled) return

        const raw   = decoded.getChannelData(0)
        const N     = 3000
        const step  = Math.max(1, Math.floor(raw.length / N))
        const peaks = new Float32Array(N)
        for (let i = 0; i < N; i++) {
          let max = 0
          for (let j = 0; j < step; j++) {
            const v = Math.abs(raw[i * step + j] || 0)
            if (v > max) max = v
          }
          peaks[i] = max
        }
        if (cancelled) return
        setWave(peaks)
        if (decoded.duration > 0) setDuration(decoded.duration)
      } catch (e) {
        if (!cancelled) {
          console.warn('[LyricTimeline] waveform failed:', e?.message)
          setWaveError(true)
        }
      }
    })()
    return () => { cancelled = true }
  }, [audioUrl])

  // ── Draw waveform canvas ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = waveCanvasRef.current
    if (!canvas) return
    const totalW = Math.max(800, Math.ceil(duration * zoom) + 160)
    canvas.width  = totalW
    canvas.height = WAVE_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#0b1120'
    ctx.fillRect(0, 0, totalW, WAVE_H)

    // Beat grid (every second)
    ctx.lineWidth = 1
    for (let s = 0; s <= Math.ceil(duration) + 2; s++) {
      const x     = s * zoom
      const major = s % 5 === 0
      ctx.strokeStyle = major ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.035)'
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WAVE_H); ctx.stroke()
    }

    const midY = WAVE_H / 2
    if (waveformPeaks?.length) {
      const samplesPerPx = waveformPeaks.length / totalW
      ctx.fillStyle   = 'rgba(59,130,246,0.32)'
      ctx.strokeStyle = 'rgba(96,165,250,0.65)'
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.moveTo(0, midY)
      for (let x = 0; x < totalW; x++) {
        const si  = Math.min(waveformPeaks.length - 1, Math.floor(x * samplesPerPx))
        ctx.lineTo(x, midY - waveformPeaks[si] * (midY - 3))
      }
      for (let x = totalW - 1; x >= 0; x--) {
        const si  = Math.min(waveformPeaks.length - 1, Math.floor(x * samplesPerPx))
        ctx.lineTo(x, midY + waveformPeaks[si] * (midY - 3))
      }
      ctx.closePath(); ctx.fill(); ctx.stroke()
    } else {
      // Centre line placeholder while waveform loads
      ctx.strokeStyle = 'rgba(96,165,250,0.18)'
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(totalW, midY); ctx.stroke()
    }
  }, [waveformPeaks, zoom, duration])

  // ── Playhead + clock: direct DOM — zero React re-renders per frame ────────
  useEffect(() => {
    let lastPx = -1
    const tick = () => {
      const t  = audioRef?.current?.currentTime ?? 0
      const px = t * zoomRef.current

      if (Math.abs(px - lastPx) > 0.5) {
        lastPx = px
        // Move playhead line
        if (playheadRef.current) playheadRef.current.style.left = `${px}px`
        // Update clock text
        if (clockRef.current) clockRef.current.textContent = fmtT(t)

        // Auto-scroll: keep playhead roughly 1/4 from left while playing
        const container = containerRef.current
        const audio     = audioRef?.current
        if (container && audio && !audio.paused) {
          const cw      = container.clientWidth
          const rel     = px - container.scrollLeft
          if (rel > cw * 0.75) container.scrollLeft = px - cw * 0.25
          else if (rel < 60)   container.scrollLeft = Math.max(0, px - 60)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }
  }, [audioRef])

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const startDrag = useCallback((e, idx, type) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      type, idx,
      startX:    e.clientX,
      origStart: lines[idx].start,
      origEnd:   lines[idx].end,
      origLines: lines,
      zoom:      zoomRef.current,
    }
    setHovIdx(idx)
  }, [lines])

  const onMouseMove = useCallback((e) => {
    const drag = dragRef.current
    if (!drag) return
    const { type, idx, startX, origStart, origEnd, origLines } = drag
    const dt      = (e.clientX - startX) / drag.zoom
    const MIN_DUR = 0.2
    let newLines

    if (type === 'move') {
      const ns  = Math.max(0, Math.min(origStart + dt, duration - (origEnd - origStart)))
      const dur = origEnd - origStart
      newLines  = origLines.map((l, i) => i !== idx ? l : {
        ...l,
        start:      Math.round(ns * 100) / 100,
        end:        Math.round((ns + dur) * 100) / 100,
        durationMs: Math.round(dur * 1000),
      })
    } else {
      const ne = Math.max(origStart + MIN_DUR, Math.min(origEnd + dt, duration))
      newLines  = origLines.map((l, i) => i !== idx ? l : {
        ...l,
        end:        Math.round(ne * 100) / 100,
        durationMs: Math.round((ne - l.start) * 1000),
      })
    }
    onChangeRef.current(newLines)
    // Advance snapshot so next move is relative to latest position
    drag.origLines = newLines
    drag.origStart = newLines[idx].start
    drag.origEnd   = newLines[idx].end
    drag.startX    = e.clientX
  }, [duration])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])

  // Click ruler / waveform → seek
  const handleSeekClick = useCallback((e) => {
    if (dragRef.current) return
    const rect   = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const scroll = containerRef.current?.scrollLeft ?? 0
    const x      = e.clientX - rect.left + scroll
    if (audioRef?.current) audioRef.current.currentTime = Math.max(0, x / zoomRef.current)
  }, [audioRef])

  const totalWidth = Math.max(800, Math.ceil(duration * zoom) + 160)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* ── Controls bar ── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={SL}>ZOOM</span>
        <button style={SB} onClick={() => setZoom(z => Math.max(MIN_ZOOM, Math.round(z / 1.5)))}>－</button>
        <span style={{ ...SL, minWidth: 52, textAlign: 'center' }}>{zoom}px/s</span>
        <button style={SB} onClick={() => setZoom(z => Math.min(MAX_ZOOM, Math.round(z * 1.5)))}>＋</button>
        <button style={SB} onClick={() => {
          const cw = containerRef.current?.clientWidth ?? 800
          if (duration > 0) setZoom(Math.max(MIN_ZOOM, Math.floor((cw - 80) / duration)))
        }}>Fit</button>
        <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#f59e0b', marginLeft: 10 }}>
          ⏱ <span ref={clockRef}>0:00.0</span>
        </span>
        <span style={{ ...SL }}>/ {fmtT(duration)}</span>
        {waveError && (
          <span style={{ fontSize: 10, color: '#f87171', marginLeft: 8 }}>⚠ Waveform unavailable — timeline still editable</span>
        )}
        <span style={{ ...SL, marginLeft: 8, fontStyle: 'italic' }}>drag block=move · drag right edge=resize · click waveform=seek</span>
      </div>

      {/* ── Scrollable timeline canvas ── */}
      <div
        ref={containerRef}
        style={{
          overflowX: 'auto', overflowY: 'hidden',
          border: '1px solid var(--border,#2c3a52)', borderRadius: 6,
          background: '#0b1120', position: 'relative',
          cursor: dragRef.current ? 'grabbing' : 'default',
          minHeight: PH_HEIGHT + 4,
        }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div style={{ width: totalWidth, position: 'relative', userSelect: 'none' }}>

          {/* Time ruler */}
          <div
            style={{ height: RULER_H, background: '#0f172a', borderBottom: '1px solid #1e293b', position: 'relative', cursor: 'crosshair' }}
            onClick={handleSeekClick}
          >
            {Array.from({ length: Math.ceil(duration) + 3 }, (_, s) => {
              const x     = s * zoom
              const major = s % 5 === 0
              return (
                <div key={s} style={{ position: 'absolute', left: x, top: 0, height: '100%', borderLeft: `1px solid ${major ? '#374151' : '#1e293b'}` }}>
                  {(zoom >= 14 || major) && (
                    <span style={{ fontSize: 9, color: major ? '#9ca3af' : '#4b5563', paddingLeft: 2, lineHeight: `${RULER_H}px`, whiteSpace: 'nowrap' }}>
                      {fmtT(s)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Waveform track */}
          <div style={{ height: WAVE_H, cursor: 'crosshair' }} onClick={handleSeekClick}>
            <canvas ref={waveCanvasRef} style={{ display: 'block' }} />
          </div>

          {/* Block track */}
          <div style={{ height: BLOCK_H + 8, position: 'relative', padding: '4px 0', background: '#080e1a' }}>
            {lines.map((line, i) => {
              const bx     = Math.round(line.start * zoom)
              const bw     = Math.max(4, Math.round((line.end - line.start) * zoom))
              const col    = PALETTE[i % PALETTE.length]
              const isInst = !line.text
              const isHov  = hovIdx === i
              return (
                <div
                  key={line._pageId ?? i}
                  title={`#${i + 1} [${fmtT(line.start)} → ${fmtT(line.end)}] ${line.text || '♪ instrumental'}`}
                  style={{
                    position:    'absolute',
                    left:        bx,
                    width:       bw,
                    top:         4,
                    height:      BLOCK_H - 8,
                    background:  isInst ? 'rgba(99,102,241,0.25)' : `${col}55`,
                    border:      `1px solid ${isHov ? col : `${col}66`}`,
                    borderRadius: 3,
                    boxSizing:   'border-box',
                    overflow:    'hidden',
                    cursor:      'grab',
                    boxShadow:   isHov ? `0 0 0 2px ${col}88` : 'none',
                    transition:  'box-shadow 0.1s',
                  }}
                  onMouseEnter={() => setHovIdx(i)}
                  onMouseLeave={() => setHovIdx(-1)}
                  onMouseDown={(e) => startDrag(e, i, 'move')}
                >
                  {bw > 18 && (
                    <span style={{
                      display:      'block',
                      fontSize:     9,
                      lineHeight:   1.4,
                      padding:      '2px 4px',
                      color:        isInst ? '#818cf8' : '#fff',
                      whiteSpace:   'nowrap',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {i + 1}. {line.text || '♪'}
                    </span>
                  )}
                  {bw > 10 && (
                    <div
                      title="Drag to resize"
                      style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'ew-resize', background: `${col}44`, borderLeft: `1px solid ${col}88` }}
                      onMouseDown={(e) => startDrag(e, i, 'resize')}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Red playhead — updated via DOM ref, not state */}
          <div
            ref={playheadRef}
            style={{
              position:      'absolute',
              left:          0,
              top:           0,
              width:         2,
              height:        PH_HEIGHT,
              background:    '#ef4444',
              pointerEvents: 'none',
              zIndex:        20,
              transition:    'none',
            }}
          >
            <div style={{
              position:    'absolute',
              top:         0,
              left:        -5,
              width:       0, height: 0,
              borderLeft:  '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop:   '9px solid #ef4444',
            }} />
          </div>

        </div>
      </div>

      {!waveformPeaks && !waveError && audioUrl && (
        <div style={{ fontSize: 10, color: 'var(--t3,#888)' }}>⏳ Decoding waveform…</div>
      )}

      {/* Manual timing input section */}
      {lines.length > 0 && (
        <div style={{ marginTop: 8, padding: '8px', background: 'var(--bg2,#1a1a2e)', borderRadius: 4, border: '1px solid var(--border,#2c3a52)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--t2,#ddd)' }}>📝 Manual Timing Input</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: 6, alignItems: 'center', fontSize: 11 }}>
            {lines.map((line, i) => (
              <ManualTimingRow 
                key={line._pageId ?? i} 
                idx={i} 
                line={line} 
                lines={lines}
                onChange={onChange}
                duration={duration}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Manual timing input row component */
function ManualTimingRow({ idx, line, lines, onChange, duration }) {
  const parseTime = (str) => {
    if (!str) return 0
    if (str.includes(':')) {
      const [m, s] = str.split(':').map(Number)
      return m * 60 + (s || 0)
    }
    return parseFloat(str) || 0
  }

  const handleStartChange = (e) => {
    const val = parseTime(e.target.value)
    const minVal = 0
    const maxVal = line.end - 0.2
    const newStart = Math.max(minVal, Math.min(val, maxVal))
    const newLines = lines.map((l, i) => i !== idx ? l : {
      ...l,
      start: Math.round(newStart * 100) / 100,
      durationMs: Math.round((l.end - newStart) * 1000),
    })
    onChange(newLines)
  }

  const handleEndChange = (e) => {
    const val = parseTime(e.target.value)
    const minVal = line.start + 0.2
    const maxVal = duration
    const newEnd = Math.max(minVal, Math.min(val, maxVal))
    const newLines = lines.map((l, i) => i !== idx ? l : {
      ...l,
      end: Math.round(newEnd * 100) / 100,
      durationMs: Math.round((newEnd - l.start) * 1000),
    })
    onChange(newLines)
  }

  return (
    <>
      <span style={{ color: 'var(--t3,#888)', fontWeight: 500 }}>{idx + 1}.</span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="text"
          defaultValue={fmtT(line.start)}
          onBlur={handleStartChange}
          onKeyDown={(e) => e.key === 'Enter' && handleStartChange(e)}
          style={{ width: 50, padding: '2px 4px', fontSize: 10, background: 'var(--bg1,#0f1419)', color: 'var(--t1,#fff)', border: '1px solid var(--border,#2c3a52)', borderRadius: 2 }}
          title="Start time (MM:SS or seconds)"
        />
        <span style={{ color: 'var(--t3,#888)' }}>→</span>
        <input
          type="text"
          defaultValue={fmtT(line.end)}
          onBlur={handleEndChange}
          onKeyDown={(e) => e.key === 'Enter' && handleEndChange(e)}
          style={{ width: 50, padding: '2px 4px', fontSize: 10, background: 'var(--bg1,#0f1419)', color: 'var(--t1,#fff)', border: '1px solid var(--border,#2c3a52)', borderRadius: 2 }}
          title="End time (MM:SS or seconds)"
        />
      </div>
      <span style={{ color: 'var(--t3,#888)', textAlign: 'right', fontFamily: 'monospace' }}>{(line.durationMs / 1000).toFixed(2)}s</span>
      <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        {line.text && (
          <span style={{ color: 'var(--t3,#888)', fontSize: 9, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={line.text}>
            {line.text}
          </span>
        )}
      </div>
    </>
  )
}

const SL = { fontSize: 10, color: 'var(--t3,#888)' }
const SB = {
  border: '1px solid var(--border,#444)',
  background: 'var(--bg3,#2a2a3e)',
  color: 'var(--t2,#ccc)',
  borderRadius: 3,
  padding: '2px 8px',
  cursor: 'pointer',
  fontSize: 12,
}
