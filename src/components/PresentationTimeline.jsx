// @ts-check
/**
 * PresentationTimeline — Main FluxAura Studio visual timeline editor for the bottom panel.
 *
 * Two modes (auto-detected):
 *  • Lyric mode   — pages have lyricStart/lyricEnd (absolute time in seconds)
 *  • Regular mode — pages positioned sequentially by cumulative timing.duration
 *
 * Features:
 *  - Each page = coloured draggable block showing name, wipeIn→wipeOut, duration
 *  - Drag block body        → move (lyric: shift lyricStart/lyricEnd; regular: reorder)
 *  - Drag right-edge handle → resize duration (lyric: lyricEnd; regular: timing.duration)
 *  - Audio track lane below pages — shows filename, total duration bar + waveform
 *  - Red playhead synced to presentationAudio currentTime via rAF (direct DOM)
 *  - Click ruler/waveform   → seek audio
 *  - Zoom in/out / Fit to container
 *  - Current page highlighted in amber
 */

import { useState, useRef, useEffect, useCallback } from 'react'

const RULER_H  = 20
const WAVE_H   = 44
const BLOCK_H  = 56
const AUDIO_H  = 44
const TOTAL_H  = RULER_H + BLOCK_H + AUDIO_H + 8

const MIN_ZOOM =  6
const MAX_ZOOM = 300

// Repeating colour palette per page index
const PALETTE = [
  '#3b82f6','#8b5cf6','#ec4899','#06b6d4',
  '#10b981','#f59e0b','#ef4444','#6366f1',
  '#84cc16','#f97316','#a855f7','#14b8a6',
]

function fmtT(s) {
  if (s == null || isNaN(s) || s < 0) return '0:00'
  const m   = Math.floor(s / 60)
  const sec = (s % 60).toFixed(s < 60 ? 1 : 0)
  return `${m}:${String(sec).padStart(m > 0 ? 5 : 4, '0')}`
}

function fmtDur(s) {
  if (!s) return '—'
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`
}

// ── Wipe palette helper ────────────────────────────────────────────────────────
const WIPE_ABBR = {
  'None': '—', 'none': '—',
  'Fade': 'Fde', 'Cut': 'Cut',
  'Wipe Left': '←', 'Wipe Right': '→', 'Wipe Up': '↑', 'Wipe Down': '↓',
  'Push Left': '←P', 'Push Right': '→P', 'Push Up': '↑P', 'Push Down': '↓P',
  'Zoom In': 'Z+', 'Zoom Out': 'Z-',
  'Flip H': 'FlpH', 'Flip V': 'FlpV',
  'Dissolve': 'Dis', 'Iris': 'Irs',
}
function wipeAbbr(w) { return WIPE_ABBR[w] || (w ? w.slice(0, 3) : '—') }

// ── Compute page layout ────────────────────────────────────────────────────────
/**
 * Returns [{start, end, width, left, pageIdx}] for every page.
 * In lyric mode: start = lyricStart, end = lyricEnd.
 * In regular mode: start = cumulative sum of prior durations, end = start + duration.
 */
function computeLayout(pages, zoom) {
  const isLyric = pages.some(pg => pg.lyricStart != null)
  let cursor = 0
  return pages.map((pg, i) => {
    let start, end
    if (isLyric) {
      start = pg.lyricStart ?? cursor
      end   = pg.lyricEnd   ?? (start + 4)
    } else {
      const dur = pg.timing?.mode === 'pause' ? (Number(pg.timing?.duration) || 0) : 0
      start = cursor
      end   = cursor + Math.max(0.1, dur)
      cursor = end
    }
    if (!isLyric) cursor = end
    return {
      start,
      end,
      dur:   end - start,
      left:  Math.round(start * zoom),
      width: Math.max(4, Math.round((end - start) * zoom)),
      pageIdx: i,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   pages: any[],
 *   currentIdx: number,
 *   onPagesChange: (pages: any[]) => void,
 *   onPagesReorder?: (pages: any[]) => void,
 *   onPageClick: (idx: number) => void,
 *   onPageSelect?: (idx: number, e: MouseEvent) => void,
 *   selectedPageIds?: number[],
 *   presentationAudio: { file:string, name?:string, trimStart?:number, trimEnd?:number|null, offset?:number, playbackRate?:number } | null,
 *   presAudioEl: HTMLAudioElement | null,
 *   onPageAdd?: () => void,
 *   onPageDelete?: () => void,
 *   onAudioChange?: (updates: object) => void,
 *   onResyncAudio?: () => void,
 * }} props
 */
export default function PresentationTimeline({
  pages,
  currentIdx,
  onPagesChange,
  onPagesReorder,
  onPageClick,
  onPageSelect,
  selectedPageIds = [],
  presentationAudio,
  presAudioEl,
  onPageAdd,
  onPageDelete,
  onAudioChange,
  onResyncAudio,
}){
  const [zoom, setZoom]         = useState(32)
  const [waveformPeaks, setWave]= useState(/** @type {Float32Array|null} */ (null))
  const [, setWaveErr] = useState(false)
  const [audioDur, setAudioDur] = useState(0)
  const [hovIdx, setHovIdx]     = useState(-1)

  const containerRef  = useRef(/** @type {HTMLDivElement|null} */ (null))
  const waveCanvasRef = useRef(/** @type {HTMLCanvasElement|null} */ (null))
  const playheadRef   = useRef(/** @type {HTMLDivElement|null} */ (null))
  const clockRef      = useRef(/** @type {HTMLSpanElement|null} */ (null))
  const rafRef        = useRef(/** @type {number|null} */ (null))

  const dragRef          = useRef(/** @type {any|null} */ (null))
  const audioEditRef     = useRef(/** @type {any|null} */ (null))
  const onChangeRef      = useRef(onPagesChange)
  const onAudioChangeRef = useRef(onAudioChange)
  const presAudioStateRef= useRef(presentationAudio)
  const audioDurRef      = useRef(0)
  useEffect(() => { onChangeRef.current = onPagesChange }, [onPagesChange])
  useEffect(() => { onAudioChangeRef.current = onAudioChange }, [onAudioChange])
  useEffect(() => { presAudioStateRef.current = presentationAudio }, [presentationAudio])
  const onReorderRef = useRef(onPagesReorder)
  useEffect(() => { onReorderRef.current = onPagesReorder }, [onPagesReorder])
  const zoomRef = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  const pagesRef = useRef(pages)
  useEffect(() => { pagesRef.current = pages }, [pages])

  const [tlDragOverIdx, setTlDragOverIdx] = useState(-1)
  const selectedPageIdsRef = useRef(selectedPageIds)
  useEffect(() => { selectedPageIdsRef.current = selectedPageIds }, [selectedPageIds])

  /** Reorder pages: move selected indices as a group to just before targetIdx */
  function tlMovePagesTo(pagesArr, selectedIndices, targetIdx) {
    const sel = new Set(selectedIndices)
    if (sel.has(targetIdx)) return null
    const sorted = [...selectedIndices].sort((a, b) => a - b)
    const selPages = sorted.map((i) => pagesArr[i])
    const remaining = pagesArr.filter((_, i) => !sel.has(i))
    const before = sorted.filter((i) => i < targetIdx).length
    const insertAt = Math.min(targetIdx - before, remaining.length)
    return [...remaining.slice(0, insertAt), ...selPages, ...remaining.slice(insertAt)]
  }

  function handleTlDragStart(e, pi) {
    e.dataTransfer.setData('tlDragType', 'tlpage')
    e.dataTransfer.setData('tlPageIdx', String(pi))
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleTlDropAt(e, dropIdx) {
    e.preventDefault()
    setTlDragOverIdx(-1)
    if (e.dataTransfer.getData('tlDragType') !== 'tlpage') return
    const srcIdx = parseInt(e.dataTransfer.getData('tlPageIdx'), 10)
    if (isNaN(srcIdx)) return
    const selIds = selectedPageIdsRef.current
    const moving = selIds.includes(srcIdx) && selIds.length > 1 ? selIds : [srcIdx]
    if (moving.includes(dropIdx)) return
    const newPages = tlMovePagesTo(pagesRef.current, moving, dropIdx)
    if (!newPages) return
    if (onReorderRef.current) onReorderRef.current(newPages)
    else onChangeRef.current(newPages)
  }

  const isLyric    = pages.some(pg => pg.lyricStart != null)
  const hasAudio   = !!presentationAudio
  const canAudioSync = hasAudio && !isLyric

  // Converts sequential pages to audio-sync mode by assigning lyricStart/lyricEnd
  // from cumulative timing.duration, then the user can drag them freely.
  const enableAudioSync = useCallback(() => {
    let cursor = 0
    const newPages = pagesRef.current.map(pg => {
      const dur = pg.timing?.mode === 'pause' ? Math.max(0.5, Number(pg.timing?.duration) || 4) : 4
      const start = cursor
      cursor += dur
      return { ...pg, lyricStart: Math.round(start * 100) / 100, lyricEnd: Math.round(cursor * 100) / 100 }
    })
    onChangeRef.current(newPages)
  }, [])

  // ── Audio duration from element ─────────────────────────────────────────────
  useEffect(() => {
    if (!presAudioEl) return
    const sync = () => { if (presAudioEl.duration > 0) { setAudioDur(presAudioEl.duration); audioDurRef.current = presAudioEl.duration } }
    sync()
    presAudioEl.addEventListener('loadedmetadata', sync)
    presAudioEl.addEventListener('durationchange', sync)
    return () => {
      presAudioEl.removeEventListener('loadedmetadata', sync)
      presAudioEl.removeEventListener('durationchange', sync)
    }
  }, [presAudioEl])

  // ── Waveform decode ───────────────────────────────────────────────────────────
  useEffect(() => {
    const url = presentationAudio?.file
    if (!url) return
    let cancelled = false
    setWave(null); setWaveErr(false)
    ;(async () => {
      try {
        const ACtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext
        if (!ACtx) { setWaveErr(true); return }
        const ctx = new ACtx()
        const res = await fetch(url, { credentials: 'omit' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const decoded = await ctx.decodeAudioData(await res.arrayBuffer())
        await ctx.close()
        if (cancelled) return
        const raw   = decoded.getChannelData(0)
        const N     = 3000
        const step  = Math.max(1, Math.floor(raw.length / N))
        const peaks = new Float32Array(N)
        for (let i = 0; i < N; i++) {
          let max = 0
          for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(raw[i * step + j] || 0))
          peaks[i] = max
        }
        if (!cancelled) { setWave(peaks); setAudioDur(decoded.duration); audioDurRef.current = decoded.duration }
      } catch { if (!cancelled) setWaveErr(true) }
    })()
    return () => { cancelled = true }
  }, [presentationAudio?.file])

  // ── Draw waveform canvas ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = waveCanvasRef.current
    if (!canvas) return
    // Canvas pixel width = audio duration × zoom (not total presentation width)
    const audioW = Math.max(200, Math.ceil((audioDur || 60) * zoom))
    canvas.width = audioW; canvas.height = WAVE_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#080d18'; ctx.fillRect(0, 0, audioW, WAVE_H)
    const midY = WAVE_H / 2
    if (waveformPeaks?.length) {
      const spp = waveformPeaks.length / audioW
      ctx.fillStyle = 'rgba(168,85,247,0.28)'; ctx.strokeStyle = 'rgba(196,132,252,0.6)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, midY)
      for (let x = 0; x < audioW; x++) {
        const si = Math.min(waveformPeaks.length - 1, Math.floor(x * spp))
        ctx.lineTo(x, midY - waveformPeaks[si] * (midY - 2))
      }
      for (let x = audioW - 1; x >= 0; x--) {
        const si = Math.min(waveformPeaks.length - 1, Math.floor(x * spp))
        ctx.lineTo(x, midY + waveformPeaks[si] * (midY - 2))
      }
      ctx.closePath(); ctx.fill(); ctx.stroke()
    } else {
      ctx.strokeStyle = 'rgba(139,92,246,0.25)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(audioW, midY); ctx.stroke()
    }
  }, [waveformPeaks, zoom, audioDur])

  // ── Playhead + clock: direct DOM ──────────────────────────────────────────────
  useEffect(() => {
    let lastPx = -1
    const tick = () => {
      const t  = presAudioEl?.currentTime ?? 0
      const px = t * zoomRef.current
      if (Math.abs(px - lastPx) > 0.4) {
        lastPx = px
        if (playheadRef.current) playheadRef.current.style.left = `${px}px`
        if (clockRef.current)    clockRef.current.textContent   = fmtT(t)
        const container = containerRef.current
        if (container && presAudioEl && !presAudioEl.paused) {
          const cw  = container.clientWidth
          const rel = px - container.scrollLeft
          if (rel > cw * 0.75) container.scrollLeft = px - cw * 0.25
          else if (rel < 60)   container.scrollLeft = Math.max(0, px - 60)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }
  }, [presAudioEl])

  // ── Drag handlers ─────────────────────────────────────────────────────────────
  const startDrag = useCallback((e, pageIdx, type) => {
    e.preventDefault(); e.stopPropagation()
    const pg = pagesRef.current[pageIdx]
    dragRef.current = {
      type, pageIdx,
      startX:    e.clientX,
      origStart: pg.lyricStart ?? 0,
      origEnd:   pg.lyricEnd   ?? 4,
      origDur:   pg.timing?.mode === 'pause' ? (Number(pg.timing?.duration) || 0) : 0,
      origPages: pagesRef.current,
      zoom:      zoomRef.current,
    }
    setHovIdx(pageIdx)
  }, [])

  const startAudioDrag = useCallback((e, type) => {
    e.preventDefault(); e.stopPropagation()
    const pa = presAudioStateRef.current
    const ad = audioDurRef.current
    audioEditRef.current = {
      type,
      startX:       e.clientX,
      origOffset:   pa?.offset       ?? 0,
      origTrimStart:pa?.trimStart    ?? 0,
      origTrimEnd:  pa?.trimEnd      ?? ad,
      origRate:     pa?.playbackRate ?? 1,
      audioDur:     ad,
      zoom:         zoomRef.current,
    }
  }, [])

  const onMouseMove = useCallback((e) => {
    const drag = dragRef.current
    if (drag) {
      const { type, pageIdx, startX, origStart, origEnd, origDur, origPages } = drag
      const dt      = (e.clientX - startX) / drag.zoom
      const MIN_DUR = 0.1
      let newPages

      if (isLyric) {
        if (type === 'move') {
          const ns  = Math.max(0, origStart + dt)
          const dur = origEnd - origStart
          newPages  = origPages.map((pg, i) => i !== pageIdx ? pg : {
            ...pg,
            lyricStart: Math.round(ns * 100) / 100,
            lyricEnd:   Math.round((ns + dur) * 100) / 100,
          })
        } else {
          const ne  = Math.max(origStart + MIN_DUR, origEnd + dt)
          newPages  = origPages.map((pg, i) => i !== pageIdx ? pg : {
            ...pg,
            lyricEnd: Math.round(ne * 100) / 100,
          })
        }
      } else {
        if (type === 'resize') {
          const newDur = Math.max(MIN_DUR, origDur + dt)
          newPages = origPages.map((pg, i) => i !== pageIdx ? pg : {
            ...pg,
            timing: { ...(pg.timing || {}), mode: 'pause', duration: Math.round(newDur * 10) / 10 },
          })
        } else {
          return
        }
      }
      onChangeRef.current(newPages)
      drag.origPages = newPages
      const updated  = newPages[pageIdx]
      drag.origStart = updated.lyricStart ?? origStart
      drag.origEnd   = updated.lyricEnd   ?? origEnd
      drag.origDur   = updated.timing?.duration ?? origDur
      drag.startX    = e.clientX
      return
    }

    // ── Audio clip drag ──
    const ae = audioEditRef.current
    if (!ae || !onAudioChangeRef.current) return
    const { type, startX, origOffset, origTrimStart, origTrimEnd, origRate, audioDur: ad } = ae
    const dt = (e.clientX - startX) / ae.zoom

    if (type === 'move') {
      onAudioChangeRef.current({ offset: Math.max(0, Math.round((origOffset + dt) * 100) / 100) })
    } else if (type === 'trim-start') {
      const ns = Math.max(0, Math.min(origTrimEnd - 0.1, origTrimStart + dt))
      onAudioChangeRef.current({ trimStart: Math.round(ns * 100) / 100 })
    } else if (type === 'trim-end') {
      const ne = Math.max(origTrimStart + 0.1, Math.min(ad, origTrimEnd + dt))
      onAudioChangeRef.current({ trimEnd: Math.round(ne * 100) / 100 })
    } else if (type === 'stretch') {
      const dPx = e.clientX - startX
      const newRate = Math.max(0.25, Math.min(2.0, origRate * Math.pow(2, -dPx / 200)))
      onAudioChangeRef.current({ playbackRate: Math.round(newRate * 100) / 100 })
    }
  }, [isLyric])

  const onMouseUp = useCallback(() => { dragRef.current = null; audioEditRef.current = null }, [])

  // Click ruler → seek audio
  const handleSeekClick = useCallback((e) => {
    if (dragRef.current) return
    const rect   = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const scroll = containerRef.current?.scrollLeft ?? 0
    const t      = Math.max(0, (e.clientX - rect.left + scroll) / zoomRef.current)
    if (presAudioEl) presAudioEl.currentTime = t
  }, [presAudioEl])

  // ── Computed layout ────────────────────────────────────────────────────────────
  const layout    = computeLayout(pages, zoom)
  const totalDur  = isLyric
    ? Math.max(audioDur, ...layout.map(l => l.end))
    : layout.reduce((acc, l) => acc + l.dur, 0)
  const totalW    = Math.max(800, Math.ceil(totalDur * zoom) + 200)

  // Tick marks every N seconds depending on zoom
  const tickStep = zoom >= 80 ? 1 : zoom >= 30 ? 5 : zoom >= 10 ? 10 : 30

  // ── Audio clip geometry ─────────────────────────────────────────────────────
  const paOffset     = presentationAudio?.offset       ?? 0
  const paTrimStart  = presentationAudio?.trimStart    ?? 0
  const paTrimEnd    = presentationAudio?.trimEnd      ?? audioDur
  const paRate       = presentationAudio?.playbackRate ?? 1
  const paRawDur     = audioDur > 0 ? Math.max(0.1, paTrimEnd - paTrimStart) : 0
  const paClipPx     = audioDur > 0 ? Math.max(4, Math.round(paRawDur / paRate * zoom)) : 0
  const paClipLeftPx = Math.round(paOffset * zoom)
  const paCanvasFullW= audioDur > 0 ? Math.max(200, Math.round(audioDur / paRate * zoom)) : 200
  const paCanvasLeft = audioDur > 0 ? -Math.round(paTrimStart / paRate * zoom) : 0
  const paTrimmed    = paTrimStart > 0.01 || (presentationAudio?.trimEnd != null && paTrimEnd < audioDur - 0.01)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '3px 8px', borderBottom: '1px solid var(--border,#2c3a52)', background: 'var(--bg2,#161925)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={SL}>{isLyric ? '🎤 Lyric' : '📋 Seq'} timeline</span>
        <span style={{ ...SL, color: 'var(--border,#444)' }}>|</span>
        <span style={SL}>Zoom</span>
        <button style={SB} onClick={() => setZoom(z => Math.max(MIN_ZOOM, Math.round(z / 1.5)))}>－</button>
        <span style={{ ...SL, minWidth: 44, textAlign: 'center' }}>{zoom}px/s</span>
        <button style={SB} onClick={() => setZoom(z => Math.min(MAX_ZOOM, Math.round(z * 1.5)))}>＋</button>
        <button style={SB} onClick={() => {
          const cw = containerRef.current?.clientWidth ?? 800
          if (totalDur > 0) setZoom(Math.max(MIN_ZOOM, Math.floor((cw - 60) / totalDur)))
        }}>Fit</button>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#f59e0b', fontWeight: 700, marginLeft: 8 }}>
          ⏱ <span ref={clockRef}>0:00</span>
        </span>
        {totalDur > 0 && <span style={SL}>/ {fmtT(totalDur)}</span>}
        {isLyric && <span style={{ ...SL, marginLeft: 8, color: '#a78bfa' }}>drag block=move · right edge=resize · click ruler=seek</span>}
        {!isLyric && <span style={{ ...SL, marginLeft: 8 }}>drag right edge=resize · dbl-click block=edit duration</span>}
        {canAudioSync && (
          <button
            style={{ ...SB, background: '#1e3a5f', color: '#60a5fa', borderColor: '#3b82f6', marginLeft: 8 }}
            title="Enable audio sync: assign page start/end times from current durations so you can drag each page to its position on the audio track"
            onClick={enableAudioSync}
          >🎵 Enable Audio Sync</button>
        )}
        <span style={{ ...SL, color: 'var(--border,#444)', marginLeft: 'auto' }}>|</span>
        {onResyncAudio && (
          <button
            style={{ ...SB, background: '#1a2e1a', color: '#4ade80', borderColor: '#22c55e' }}
            title="Re-sync audio timestamps to current page text — use after editing lyrics or page text"
            onClick={onResyncAudio}
          >🔄 Re-sync Audio</button>
        )}
        {onPageAdd && (
          <button style={SB} title="Add new page after current" onClick={onPageAdd}>＋Pg</button>
        )}
        {onPageDelete && (
          <button style={{ ...SB, opacity: pages.length <= 1 ? 0.4 : 1 }} title="Delete current page" onClick={onPageDelete} disabled={pages.length <= 1}>－Pg</button>
        )}
        {paRate !== 1 && (
          <span style={{ ...SL, marginLeft: 8, color: '#f59e0b', fontWeight: 700 }}>
            🎚 {Math.round(paRate * 100)}%
          </span>
        )}
      </div>

      {/* ── Scrollable timeline ── */}
      <div
        ref={containerRef}
        style={{
          overflowX:  'auto', overflowY: 'hidden',
          flex:       1, minHeight: 0,
          background: '#0b1120',
          cursor:     dragRef.current ? 'grabbing' : 'default',
        }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div style={{ width: totalW, position: 'relative', userSelect: 'none' }}>

          {/* ── Time ruler ── */}
          <div
            style={{ height: RULER_H, background: '#0e1422', borderBottom: '1px solid #1e293b', position: 'relative', cursor: 'crosshair' }}
            onClick={handleSeekClick}
          >
            {Array.from({ length: Math.ceil(totalDur / tickStep) + 2 }, (_, si) => {
              const s = si * tickStep
              const x = s * zoom
              return (
                <div key={s} style={{ position: 'absolute', left: x, top: 0, height: '100%', borderLeft: '1px solid #1e293b' }}>
                  <span style={{ fontSize: 9, color: '#6b7280', paddingLeft: 2, lineHeight: `${RULER_H}px`, whiteSpace: 'nowrap' }}>{fmtT(s)}</span>
                </div>
              )
            })}
          </div>

          {/* ── Page blocks lane ── */}
          <div style={{ height: BLOCK_H, position: 'relative', background: '#090e1c', borderBottom: '1px solid #1e293b' }}>
            {/* Lane label */}
            <span style={{ position: 'absolute', left: 4, top: 2, fontSize: 8, color: '#374151', zIndex: 0, pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: 1 }}>Pages</span>

            {layout.map(({ start, end, dur, left, width, pageIdx: pi }) => {
              const pg     = pages[pi]
              const col    = PALETTE[pi % PALETTE.length]
              const isAct  = pi === currentIdx
              const isHov  = pi === hovIdx
              const wIn    = pg.wipeIn  || pg.transitionIn  || ''
              const wOut   = pg.wipeOut || pg.transitionOut || ''
              const durLabel = fmtDur(dur)
              const wipeLabel = (wIn || wOut)
                ? `${wipeAbbr(wIn)}→${wipeAbbr(wOut)}`
                : ''

              return (
                <div
                  key={pg.id ?? pi}
                  title={`${pg.name}\n${fmtT(start)} → ${fmtT(end)}  (${durLabel})\nWipe in: ${wIn || 'none'}  out: ${wOut || 'none'}`}
                  style={{
                    position:    'absolute',
                    left,
                    width,
                    top:         4,
                    height:      BLOCK_H - 8,
                    background:  isAct ? `${col}cc` : `${col}44`,
                    border:      `1px solid ${isAct ? col : isHov ? `${col}aa` : `${col}55`}`,
                    borderRadius: 3,
                    boxSizing:   'border-box',
                    overflow:    'hidden',
                    cursor:      isLyric ? 'grab' : 'grab',
                    boxShadow:   selectedPageIds.includes(pi)
                      ? `0 0 0 2px #3cb8be, 0 0 0 4px rgba(60,184,190,0.3)`
                      : isAct  ? `0 0 0 2px ${col}` : isHov ? `0 0 0 1px ${col}88` : 'none',
                    outline:     tlDragOverIdx === pi ? '2px solid #f59e0b' : 'none',
                    opacity:     selectedPageIds.includes(pi) && tlDragOverIdx !== pi ? 0.85 : 1,
                  }}
                  onMouseEnter={() => setHovIdx(pi)}
                  onMouseLeave={() => setHovIdx(-1)}
                  onClick={(e) => {
                    if (onPageSelect && (e.ctrlKey || e.metaKey || e.shiftKey)) {
                      onPageSelect(pi, e)
                    } else {
                      onPageClick(pi)
                    }
                  }}
                  onMouseDown={(e) => isLyric && startDrag(e, pi, 'move')}
                  draggable={!isLyric}
                  onDragStart={(e) => !isLyric && handleTlDragStart(e, pi)}
                  onDragOver={(e) => { if (!isLyric) { e.preventDefault(); setTlDragOverIdx(pi) } }}
                  onDrop={(e) => !isLyric && handleTlDropAt(e, pi)}
                  onDragEnd={() => setTlDragOverIdx(-1)}
                >
                  {width > 10 && (
                    <div style={{ padding: '2px 5px 1px', overflow: 'hidden' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                        {pi + 1}. {pg.name || `Slide ${pi + 1}`}
                      </div>
                      {width > 36 && (
                        <div style={{ fontSize: 8, color: isAct ? '#fde68a' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                          {durLabel}{wipeLabel ? `  ${wipeLabel}` : ''}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Right resize handle — always visible in lyric mode so zero-duration blocks can always be recovered */}
                  {(isLyric || width > 12) && (
                    <div
                      title="Drag to resize"
                      style={{ position: 'absolute', right: 0, top: 0, width: isLyric ? Math.max(4, Math.min(7, width)) : 7, height: '100%', cursor: 'ew-resize', background: `${col}66`, borderLeft: `1px solid ${col}cc` }}
                      onMouseDown={(e) => startDrag(e, pi, 'resize')}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Audio lane ── */}
          <div style={{ height: AUDIO_H, position: 'relative', background: '#060b14' }}>
            <span style={{ position: 'absolute', left: 4, top: 2, fontSize: 8, color: '#374151', zIndex: 1, textTransform: 'uppercase', letterSpacing: 1 }}>Audio</span>

            {presentationAudio?.file ? (
              audioDur > 0 ? (
                <>
                  {/* Pre-offset hatched gap */}
                  {paOffset > 1 && (
                    <div style={{ position: 'absolute', left: 0, top: 4, width: paClipLeftPx, height: AUDIO_H - 8, backgroundImage: 'repeating-linear-gradient(45deg,rgba(139,92,246,0.08) 0,rgba(139,92,246,0.08) 4px,transparent 4px,transparent 10px)', border: '1px dashed rgba(139,92,246,0.2)', borderRadius: 3, boxSizing: 'border-box' }} />
                  )}

                  {/* Clip body */}
                  <div
                    title={`Audio Clip\nOffset: +${paOffset.toFixed(2)}s\nTrim: ${paTrimStart.toFixed(2)}s – ${paTrimEnd.toFixed(2)}s\nRate: ${Math.round(paRate * 100)}%`}
                    style={{ position: 'absolute', left: paClipLeftPx, top: 4, width: paClipPx, height: AUDIO_H - 8, background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.55)', borderRadius: 3, boxSizing: 'border-box', overflow: 'hidden', cursor: 'grab' }}
                    onMouseDown={(e) => { if (e.target === e.currentTarget || (e.target instanceof HTMLCanvasElement)) startAudioDrag(e, 'move') }}
                  >
                    {/* Waveform canvas (positioned to show the visible trimmed slice) */}
                    <canvas
                      ref={waveCanvasRef}
                      style={{ position: 'absolute', top: 0, left: paCanvasLeft, width: paCanvasFullW, height: '100%', display: 'block', pointerEvents: 'none' }}
                    />
                    {/* Left trim handle */}
                    <div
                      title="Drag to trim start"
                      style={{ position: 'absolute', left: 0, top: 0, width: 8, height: '100%', cursor: 'ew-resize', background: 'linear-gradient(to right,rgba(167,139,250,0.9),transparent)', borderRight: '1px solid #a78bfa', zIndex: 4 }}
                      onMouseDown={(e) => startAudioDrag(e, 'trim-start')}
                    />
                    {/* Right trim handle */}
                    <div
                      title="Drag to trim end"
                      style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'ew-resize', background: 'linear-gradient(to left,rgba(167,139,250,0.9),transparent)', borderLeft: '1px solid #a78bfa', zIndex: 4 }}
                      onMouseDown={(e) => startAudioDrag(e, 'trim-end')}
                    />
                    {/* Stretch grip (bottom-right corner) */}
                    <div
                      title="Drag to stretch/compress playback speed"
                      style={{ position: 'absolute', right: 8, bottom: 0, width: 12, height: 8, cursor: 'col-resize', background: 'rgba(250,204,21,0.5)', borderRadius: '3px 0 0 0', zIndex: 5 }}
                      onMouseDown={(e) => startAudioDrag(e, 'stretch')}
                    />
                    {/* Label */}
                    {paClipPx > 40 && (
                      <span style={{ position: 'absolute', left: 12, right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: '#c4b5fd', zIndex: 3, pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        🎵 {presentationAudio.name || presentationAudio.file.split(/[\\/]/).pop() || 'Audio'} · {fmtDur(paRawDur / paRate)}{paTrimmed ? ' ✂️' : ''}{paRate !== 1 ? ` ${Math.round(paRate * 100)}%` : ''}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                /* No duration yet — placeholder */
                <div style={{ position: 'absolute', left: 0, top: 4, width: '100%', height: AUDIO_H - 8, background: 'rgba(139,92,246,0.06)', border: '1px dashed rgba(139,92,246,0.25)', borderRadius: 3, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                  <span style={{ fontSize: 9, color: '#7c3aed' }}>🎵 {presentationAudio.name || 'Audio'} — loading…</span>
                </div>
              )
            ) : (
              <div style={{ position: 'absolute', left: 4, top: 4, fontSize: 9, color: '#374151', fontStyle: 'italic' }}>
                No presentation audio — set one in the Properties panel
              </div>
            )}
          </div>

          {/* ── Playhead ── */}
          <div
            ref={playheadRef}
            style={{
              position:      'absolute',
              left:          0,
              top:           0,
              width:         2,
              height:        RULER_H + BLOCK_H + AUDIO_H + 8,
              background:    '#ef4444',
              pointerEvents: 'none',
              zIndex:        30,
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: -5, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid #ef4444' }} />
          </div>

        </div>
      </div>
    </div>
  )
}

const SL = { fontSize: 10, color: 'var(--t3,#888)' }
const SB = {
  border:       '1px solid var(--border,#444)',
  background:   'var(--bg3,#1e2030)',
  color:        'var(--t2,#ccc)',
  borderRadius: 3,
  padding:      '1px 7px',
  cursor:       'pointer',
  fontSize:     11,
}
