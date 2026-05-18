/**
 * ScriptExportModal — Export the entire presentation script as a ready-to-play MP4.
 *
 * Each page is rendered frame-by-frame:
 *   - Pages with video backgrounds/elements → 25 fps (full motion)
 *   - Pages with lyric karaoke word highlights → 10 fps (word-transition fidelity)
 *   - Static pages (image/gradient/color bg, no animation) → 1 frame (full duration)
 *
 * Frames are streamed to the main process in batches of 50 to avoid large IPC payloads.
 * Audio is automatically sourced from the presentation audio track.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'

function ignoreError() {}

const SCRIPT_EXPORT_PREFS_KEY = 'fluxaura_script_export_prefs_v1'

function loadExportPrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCRIPT_EXPORT_PREFS_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// ── Canvas helpers ──────────────────────────────────────────────────────────

function wrapText(ctx, text, maxW) {
  if (!text) return ['']
  const words = text.split(/\s+/)
  const lines = []; let cur = ''
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w
    if (ctx.measureText(test).width <= (maxW || 9999)) { cur = test }
    else { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ── Video cache: loads each src once, seeks efficiently ─────────────────────

class VideoCache {
  constructor() { this._map = new Map() }

  load(src) {
    if (this._map.has(src)) return Promise.resolve(this._map.get(src))
    return new Promise((resolve) => {
      const vid = document.createElement('video')
      vid.crossOrigin = 'anonymous'; vid.muted = true; vid.preload = 'auto'
      vid.src = src
      const done = (v) => { this._map.set(src, v); resolve(v) }
      vid.addEventListener('loadeddata', () => done(vid), { once: true })
      vid.addEventListener('error', () => done(null), { once: true })
      setTimeout(() => { if (!this._map.has(src)) done(null) }, 10000)
      vid.load()
    })
  }

  async getAtTime(src, targetTime) {
    const vid = await this.load(src)
    if (!vid) return null
    const t = (typeof targetTime === 'number' && isFinite(targetTime) && targetTime >= 0) ? targetTime : 0
    if (Math.abs(vid.currentTime - t) < 0.04) return vid
    return new Promise((resolve) => {
      vid.addEventListener('seeked', () => resolve(vid), { once: true })
      setTimeout(() => resolve(vid), 3000)
      vid.currentTime = t
    })
  }

  cleanup() {
    for (const vid of this._map.values()) { if (vid) vid.src = '' }
    this._map.clear()
  }
}

// ── Image cache: loads each src once ────────────────────────────────────────

class ImageCache {
  constructor() { this._map = new Map() }

  get(src) {
    if (this._map.has(src)) return Promise.resolve(this._map.get(src))
    return new Promise((resolve) => {
      const img = new Image(); img.crossOrigin = 'anonymous'
      img.onload  = () => { this._map.set(src, img); resolve(img) }
      img.onerror = () => { this._map.set(src, null); resolve(null) }
      img.src = src
    })
  }
}

// ── Karaoke word-highlight canvas renderer (matches KaraokeText.jsx) ─────────
//
// absoluteTime — seconds from the start of the audio track
// wordTimestamps — [{start, end, text}] pre-filtered to this page's words

function drawTextWithKaraoke(ctx, el, wordTimestamps, absoluteTime) {
  if (!wordTimestamps || wordTimestamps.length === 0) return

  const fontSize   = el.size || 36
  const fontName   = el.font || 'Arial'
  const weight     = el.weight || '700'
  const fontStr    = `${el.italic ? 'italic ' : ''}${weight} ${fontSize}px "${fontName}", sans-serif`
  ctx.font         = fontStr
  ctx.textBaseline = 'top'

  const ACTIVE_COLOR = '#f59e0b'
  const ACTIVE_GLOW  = 14
  const PAST_ALPHA   = 0.45
  const normalColor  = el.color || '#fff'
  const TOLS         = 0.05

  const elX = el.x || 0
  const elY = el.y || 0
  const elW = el.w || 800
  const elH = el.h || 100
  const textAlign = el.align || 'center'

  // Find active word (same logic as KaraokeText.jsx)
  let activeIdx = -1
  for (let i = 0; i < wordTimestamps.length; i++) {
    const w = wordTimestamps[i]
    if (absoluteTime >= w.start - TOLS && absoluteTime < w.end + TOLS) { activeIdx = i; break }
  }
  // After last word ends, keep last word highlighted until next page
  if (activeIdx === -1 && wordTimestamps.length > 0 && absoluteTime >= wordTimestamps[wordTimestamps.length - 1].start) {
    activeIdx = wordTimestamps.length - 1
  }

  // Measure each word width
  const SPACE_W = ctx.measureText(' ').width
  const words = wordTimestamps.map(w => ({ ...w, width: ctx.measureText(w.text || '').width }))

  // Word-wrap into lines within el.w
  const lines = []
  let curLine = [], curW = 0
  for (let i = 0; i < words.length; i++) {
    const needed = curLine.length === 0 ? words[i].width : curW + SPACE_W + words[i].width
    if (needed > elW && curLine.length > 0) {
      lines.push({ wordIdxs: curLine, totalWidth: curW })
      curLine = [i]; curW = words[i].width
    } else {
      curLine.push(i); curW = needed
    }
  }
  if (curLine.length > 0) lines.push({ wordIdxs: curLine, totalWidth: curW })

  // Vertical positioning
  const lineH     = fontSize * 1.35
  const totalTxtH = lines.length * lineH
  let startY      = elY
  if (el.vAlign === 'middle') startY = elY + Math.max(0, elH - totalTxtH) / 2
  else if (el.vAlign === 'bottom') startY = elY + Math.max(0, elH - totalTxtH)

  // Draw each word
  for (let li = 0; li < lines.length; li++) {
    const line  = lines[li]
    const lineY = startY + li * lineH
    let x = textAlign === 'center' ? elX + (elW - line.totalWidth) / 2
           : textAlign === 'right'  ? elX + elW - line.totalWidth
           : elX

    for (let wi = 0; wi < line.wordIdxs.length; wi++) {
      const gIdx = line.wordIdxs[wi]
      const word = words[gIdx]

      ctx.save()
      if (gIdx === activeIdx) {
        ctx.fillStyle    = ACTIVE_COLOR
        ctx.shadowColor  = ACTIVE_COLOR
        ctx.shadowBlur   = ACTIVE_GLOW
        ctx.globalAlpha  = 1
      } else if (gIdx < activeIdx) {
        ctx.fillStyle   = normalColor
        ctx.globalAlpha = PAST_ALPHA
        if (el.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2 }
      } else {
        ctx.fillStyle   = normalColor
        ctx.globalAlpha = 1
        if (el.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2 }
      }
      ctx.fillText(word.text || '', x, lineY)
      ctx.restore()

      x += word.width + (wi < line.wordIdxs.length - 1 ? SPACE_W : 0)
    }
  }
}

// ── Detect whether a page needs multi-frame rendering ────────────────────────

function pageHasVideo(page) {
  const bgIsVideo = page.bgMediaKind === 'video' ||
    /\.(mp4|webm|mov|avi|mkv|ogv)$/i.test(page.bgMediaName || '')
  if ((page.bgMediaSrc || page.bgImage) && bgIsVideo) return true
  for (const el of (page.elements || [])) {
    if ((el.type === 'clip' || el.type === 'mpeg') &&
        (el.mediaKind === 'video' || /\.(mp4|webm|mov|avi|mkv|ogv)$/i.test(el.file || el.mediaFile || '')))
      return true
  }
  return false
}

function pageHasWordHighlight(page) {
  return !!(page.wordTimestamps?.length > 0 &&
    (page.elements || []).some(el => el.type === 'text' && el.elLabel === 'lyric'))
}

// ── Full page renderer at a specific time offset ─────────────────────────────
//
// baseTime    — absolute audio time (seconds) at which this page starts
// timeInPage  — seconds elapsed since page start (0 = start of page)
// absoluteTime = baseTime + timeInPage (used for word timestamp matching)
// Video backgrounds use absoluteTime so they play continuously through the song.
// Inline video clips use (mediaStartTime || 0) + timeInPage.

async function renderPageAtTime(page, W, H, timeInPage, baseTime, videoCache, imageCache, persistentCanvas) {
  const canvas = persistentCanvas || document.createElement('canvas')
  if (canvas.width !== W) canvas.width = W
  if (canvas.height !== H) canvas.height = H

  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  const absoluteTime = (typeof baseTime === 'number' ? baseTime : 0) + timeInPage

  // ── Background ─────────────────────────────────────────────────────────────
  const bgSrc     = page.bgMediaSrc || page.bgImage || null
  const bgName    = page.bgMediaName || ''
  const bgIsVideo = page.bgMediaKind === 'video' || /\.(mp4|webm|mov|avi|mkv|ogv)$/i.test(bgName)

  if (bgSrc && bgIsVideo) {
    const vid = await videoCache.getAtTime(bgSrc, absoluteTime)
    if (vid) { try { ctx.drawImage(vid, 0, 0, W, H) } catch { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H) } }
    else { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H) }
  } else if (bgSrc) {
    const img = await imageCache.get(bgSrc)
    if (img) ctx.drawImage(img, 0, 0, W, H)
    else { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H) }
  } else if (page.bgGradientEnabled) {
    const angle = ((page.bgGradientAngle || 0) * Math.PI) / 180
    const cx = W / 2, cy = H / 2
    const grad = ctx.createLinearGradient(
      cx - Math.cos(angle) * W / 2, cy - Math.sin(angle) * H / 2,
      cx + Math.cos(angle) * W / 2, cy + Math.sin(angle) * H / 2
    )
    grad.addColorStop(0, page.bgGradientFrom || '#000020')
    grad.addColorStop(1, page.bgGradientTo || '#001a40')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
  } else {
    ctx.fillStyle = page.bgColor || '#000'
    ctx.fillRect(0, 0, W, H)
  }

  // ── Elements (sorted by z) ─────────────────────────────────────────────────
  const sorted = [...(page.elements || [])].sort((a, b) => (a.z || 0) - (b.z || 0))

  for (const el of sorted) {
    if (el.visible === false) continue
    ctx.save()

    if (el.type === 'text') {
      const wordTimestamps = (el.elLabel === 'lyric' && page.wordTimestamps?.length > 0)
        ? page.wordTimestamps : null

      if (wordTimestamps) {
        drawTextWithKaraoke(ctx, el, wordTimestamps, absoluteTime)
      } else {
        const fs = el.size || 36
        ctx.font         = `${el.italic ? 'italic ' : ''}${el.weight || 700} ${fs}px "${el.font || 'Arial'}", sans-serif`
        ctx.fillStyle    = el.color || '#fff'
        ctx.textAlign    = el.align || 'left'
        ctx.textBaseline = 'top'
        if (el.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2 }
        const elW       = el.w || W - el.x
        const txtLines  = wrapText(ctx, el.content || '', elW)
        const lineH     = fs * 1.35
        const totalTxtH = txtLines.length * lineH
        let yOff        = el.y
        if (el.vAlign === 'middle') yOff = el.y + Math.max(0, (el.h || H) - totalTxtH) / 2
        else if (el.vAlign === 'bottom') yOff = el.y + Math.max(0, (el.h || H) - totalTxtH)
        const xPos = el.align === 'center' ? el.x + elW / 2 : el.align === 'right' ? el.x + elW : el.x
        for (let li = 0; li < txtLines.length; li++) ctx.fillText(txtLines[li], xPos, yOff + li * lineH, elW)
      }

    } else if (el.type === 'clip' || el.type === 'mpeg') {
      const src = el.file || el.mediaFile || null
      if (src) {
        const isVid = el.mediaKind === 'video' || /\.(mp4|webm|mov|avi|mkv|ogv)$/i.test(el.mediaName || el.file || '')
        ctx.globalAlpha = el.opacity != null ? el.opacity : 1
        if (isVid) {
          const vidTime = (el.mediaStartTime || 0) + timeInPage
          const vid = await videoCache.getAtTime(src, vidTime)
          if (vid) { try { ctx.drawImage(vid, el.x, el.y, el.w, el.h) } catch { ignoreError() } }
        } else if (el.mediaKind !== 'audio') {
          const img = await imageCache.get(src)
          if (img) ctx.drawImage(img, el.x, el.y, el.w, el.h)
        }
        ctx.globalAlpha = 1
      }

    } else if (el.type === 'button') {
      const r = parseInt(el.radius) || 4
      ctx.fillStyle = el.bgColor || '#1a3a5c'
      roundRectPath(ctx, el.x, el.y, el.w, el.h, r)
      ctx.fill()
      if ((el.borderWidth || 2) > 0) {
        ctx.strokeStyle = el.borderColor || '#4a8fc0'
        ctx.lineWidth   = el.borderWidth || 2
        roundRectPath(ctx, el.x, el.y, el.w, el.h, r)
        ctx.stroke()
      }
      if (el.btnImage) {
        const img = await imageCache.get(el.btnImage)
        if (img) {
          roundRectPath(ctx, el.x, el.y, el.w, el.h, r)
          ctx.clip()
          ctx.drawImage(img, el.x, el.y, el.w, el.h)
        }
      } else {
        const fs = el.fontSize || 14
        ctx.font         = `${el.fontWeight || 600} ${fs}px "${el.font || 'Arial'}", sans-serif`
        ctx.fillStyle    = el.fgColor || '#fff'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(el.label || '', el.x + el.w / 2, el.y + el.h / 2, el.w - 12)
      }
    }

    ctx.restore()
  }

  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
}

function getPageDuration(page, fallback, audioDurations, padBefore, padAfter) {
  // Lyric pages: absolute timing from lyricStart/lyricEnd
  if (page.lyricStart != null && page.lyricEnd != null) {
    return Math.max(0.1, page.lyricEnd - page.lyricStart)
  }
  // Per-page export override (set in inspector, saved to script)
  const t = page.timing
  if (t?.exportDuration > 0) return t.exportDuration
  // Audio-driven: use narration audio duration + padding
  if (audioDurations && page.id) {
    const audioDur = audioDurations.get(page.id)
    if (audioDur > 0) return (padBefore || 0) + audioDur + (padAfter || 0)
  }
  if (!t) return fallback
  if (t.duration > 0) return t.duration + (t.ms || 0) / 1000
  if (t.durationMs > 0) return t.durationMs / 1000  // wizard title pages use durationMs
  return fallback
}

// Returns duration in seconds for a local audio file via media server.
function getAudioDuration(nativePath) {
  return new Promise((resolve) => {
    if (!nativePath) return resolve(0)
    const port = window.smmDesktop?.mediaServerPort || 0
    const url = port > 0
      ? `http://127.0.0.1:${port}/media?p=${encodeURIComponent(nativePath)}`
      : `app-media:///${nativePath.replace(/\\/g, '/').split('/').map((s) => /^[a-zA-Z]:$/.test(s) ? s : encodeURIComponent(s)).join('/')}`
    const audio = new Audio()
    const done = (v) => { audio.src = ''; resolve(v) }
    audio.addEventListener('loadedmetadata', () => done(audio.duration || 0), { once: true })
    audio.addEventListener('error', () => done(0), { once: true })
    setTimeout(() => done(0), 8000)  // 8s timeout guard
    audio.src = url
    audio.load()
  })
}

// Pre-compute audio durations for all pages that have narration.
// Returns Map<pageId, durationSeconds>.
async function buildAudioDurationMap(pages) {
  const map = new Map()
  await Promise.all(pages.map(async (pg) => {
    const p = pg.narration?.sourcePath || pg.sound?.sourcePath
      || (pg.elements || []).find(e => e.mediaKind === 'audio' && e.mediaSourcePath)?.mediaSourcePath
    if (p && pg.id) {
      const dur = await getAudioDuration(p)
      if (dur > 0) map.set(pg.id, dur)
    }
  }))
  return map
}

function findAudioPath(presentationAudio) {
  // 1. Explicit native path (set by Electron file picker)
  if (presentationAudio?.sourcePath) return presentationAudio.sourcePath
  // 2. Extract from URL scheme (Electron custom protocol or file://)
  const f = presentationAudio?.file || ''
  if (f.startsWith('app-media:///')) {
    return decodeURIComponent(f.replace(/^app-media:\/\/\//, ''))
  }
  if (f.startsWith('file:///')) {
    const raw = decodeURIComponent(f.replace(/^file:\/\/\//, ''))
    // Windows: file:///C:/foo → "C:/foo"; Unix: file:///foo → "/foo"
    return /^[a-zA-Z]:/.test(raw) ? raw : '/' + raw
  }
  return null
}

// Build per-page audio clips [{path, startSec}] from orderedEntries.
// Used when there is no single presentation-level audio track.
function buildAudioClips(orderedEntries) {
  const clips = []
  for (const { page, baseTime } of orderedEntries) {
    let p = null
    if (page.narration?.sourcePath) p = page.narration.sourcePath
    else if (page.sound?.sourcePath) p = page.sound.sourcePath
    else {
      for (const el of (page.elements || [])) {
        if (el.mediaKind === 'audio' && el.mediaSourcePath) { p = el.mediaSourcePath; break }
      }
    }
    if (p) clips.push({ path: p, startSec: baseTime })
  }
  return clips
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ScriptExportModal({ pages, stageWidth, stageHeight, presentationAudio, onClose }) {
  const savedPrefsRef = useRef(loadExportPrefs())
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [done, setDone] = useState(null)
  const [error, setError] = useState(null)
  const [defaultDuration, setDefaultDuration] = useState(() => clampNumber(savedPrefsRef.current.defaultDuration, 5, 1, 300))
  const [quality, setQuality] = useState(() => clampNumber(savedPrefsRef.current.quality, 22, 0, 51))
  const [useAudioTiming, setUseAudioTiming] = useState(() => savedPrefsRef.current.useAudioTiming !== false)
  const [padBefore, setPadBefore] = useState(() => clampNumber(savedPrefsRef.current.padBefore, 0.5, 0, 10))
  const [padAfter, setPadAfter] = useState(() => clampNumber(savedPrefsRef.current.padAfter, 0.5, 0, 10))
  const cancelRef = useRef(false)

  const isElectron = !!(window.smmDesktop?.lyricExport)
  const audioPath = findAudioPath(presentationAudio)
  const isLyricProject = pages.some(p => p.lyricStart != null && p.lyricEnd != null)
  const timedPages = isLyricProject
    ? pages.filter((p) => p.lyricStart != null && p.lyricEnd != null)
    : pages.filter((p) => p.timing?.mode === 'auto' && (p.timing?.duration || 0) > 0)
  const untimedPages = isLyricProject
    ? pages.filter(p => p.lyricStart == null || p.lyricEnd == null)
    : pages.filter(p => !p.timing?.duration || p.timing?.mode !== 'auto')

  useEffect(() => {
    try {
      localStorage.setItem(SCRIPT_EXPORT_PREFS_KEY, JSON.stringify({
        defaultDuration,
        quality,
        useAudioTiming,
        padBefore,
        padAfter,
      }))
    } catch {
      ignoreError()
    }
  }, [defaultDuration, quality, useAudioTiming, padBefore, padAfter])

  const handleExport = useCallback(async () => {
    if (!isElectron) { setError('Export requires the Electron desktop app.'); return }
    cancelRef.current = false
    setExporting(true); setProgress(0); setProgressMsg('Probing audio durations…'); setDone(null); setError(null)

    const videoCache = new VideoCache()
    const imageCache = new ImageCache()
    const exportCanvas = document.createElement('canvas')
    const BATCH_SIZE = 50   // frames per IPC push
    const FPS_VIDEO  = 25
    const FPS_WORDS  = 10
    const FPS_STATIC = 1    // 1 frame for the full duration

    try {
      // Pre-probe audio durations for all pages (so page timing can match narration length)
      const audioDurations = useAudioTiming ? await buildAudioDurationMap(pages) : new Map()
      const { outputPath, canceled } = await window.smmDesktop.lyricExport.saveDialog({ defaultName: 'presentation.mp4' })
      if (canceled) { setExporting(false); return }

      // Init export session on main process (creates tmpDir + empty frames.txt)
      const { tmpId } = await window.smmDesktop.lyricExport.exportInit()

      const W = stageWidth, H = stageHeight

      // ── Build ordered page list with baseTime ───────────────────────────────
      // baseTime is the absolute audio-time (seconds) when each page starts.
      // This lets background videos scroll forward continuously through the song.
      const orderedEntries = []

      if (isLyricProject) {
        const titlePages   = pages.filter(p => p.lyricStart == null)
        const lyricPages   = pages.filter(p => p.lyricStart != null).sort((a, b) => a.lyricStart - b.lyricStart)
        const introPage    = titlePages.find(p => (p.name || '').toLowerCase().includes('intro'))
        const creditPage   = titlePages.find(p => (p.name || '').toLowerCase().includes('credit'))
        const firstLyricStart = lyricPages[0]?.lyricStart ?? 0

        if (introPage) {
          const introDur = firstLyricStart > 1 ? firstLyricStart : getPageDuration(introPage, defaultDuration, audioDurations, padBefore, padAfter)
          orderedEntries.push({ page: introPage, duration: Math.max(1, introDur), baseTime: 0 })
        }

        let prevEnd = firstLyricStart
        for (let i = 0; i < lyricPages.length; i++) {
          const pg = lyricPages[i]
          const ls = pg.lyricStart, le = pg.lyricEnd
          const gapDur = ls - prevEnd
          if (gapDur >= 0.5 && i > 0) {
            // Instrumental gap: show previous page's background, no lyrics
            const bgPage = { ...lyricPages[i - 1], elements: [] }
            orderedEntries.push({ page: bgPage, duration: gapDur, baseTime: prevEnd })
          }
          orderedEntries.push({ page: pg, duration: Math.max(0.1, le - ls), baseTime: ls })
          prevEnd = le
        }

        if (creditPage) {
          orderedEntries.push({ page: creditPage, duration: getPageDuration(creditPage, defaultDuration, audioDurations, padBefore, padAfter), baseTime: prevEnd })
        }
      } else {
        let runningTime = 0
        for (const pg of pages) {
          const dur = Math.max(0.1, getPageDuration(pg, defaultDuration, audioDurations, padBefore, padAfter))
          orderedEntries.push({ page: pg, duration: dur, baseTime: runningTime })
          runningTime += dur
        }
      }

      // ── Count total frames for progress ─────────────────────────────────────
      let totalFrames = 0
      for (const entry of orderedEntries) {
        const fps = pageHasVideo(entry.page) ? FPS_VIDEO
                  : pageHasWordHighlight(entry.page) ? FPS_WORDS
                  : FPS_STATIC
        totalFrames += (fps === FPS_STATIC) ? 1 : Math.max(1, Math.ceil(entry.duration * fps))
      }
      setProgressMsg(`Rendering ${totalFrames} frames across ${orderedEntries.length} pages…`)

      // ── Render and stream frames ─────────────────────────────────────────────
      let framesSent = 0
      let batch      = []

      const flushBatch = async () => {
        if (batch.length === 0) return
        const result = await window.smmDesktop.lyricExport.pushBatch({
          tmpId, batch, startIndex: framesSent - batch.length
        })
        if (!result.ok) throw new Error(`Batch push failed: ${result.error}`)
        batch = []
      }

      const pushFrame = async (imageBase64, durationSec) => {
        batch.push({ imageBase64, durationSec })
        framesSent++
        if (batch.length >= BATCH_SIZE) await flushBatch()
        setProgress(Math.min(32, Math.round((framesSent / totalFrames) * 32)))
      }

      for (let ei = 0; ei < orderedEntries.length; ei++) {
        if (cancelRef.current) break
        const { page, duration, baseTime } = orderedEntries[ei]
        const hasVid   = pageHasVideo(page)
        const hasWords = pageHasWordHighlight(page)
        const fps      = hasVid ? FPS_VIDEO : hasWords ? FPS_WORDS : FPS_STATIC

        setProgressMsg(`Rendering page ${ei + 1}/${orderedEntries.length}${hasVid ? ' 🎬' : hasWords ? ' 🎤' : ''}…`)

        if (fps === FPS_STATIC) {
          const img = await renderPageAtTime(page, W, H, 0, baseTime, videoCache, imageCache, exportCanvas)
          await pushFrame(img, duration)
        } else {
          const frameDur = 1 / fps
          const nFrames  = Math.max(1, Math.ceil(duration * fps))
          for (let fi = 0; fi < nFrames; fi++) {
            if (cancelRef.current) break
            const t = fi * frameDur
            const img = await renderPageAtTime(page, W, H, t, baseTime, videoCache, imageCache, exportCanvas)
            await pushFrame(img, Math.min(frameDur, duration - t > 0 ? duration - t : frameDur))
            // Yield to browser every 5 frames to keep UI responsive
            if (fi % 5 === 4) await new Promise(r => setTimeout(r, 0))
          }
        }
      }

      if (!cancelRef.current) await flushBatch()
      videoCache.cleanup()

      if (cancelRef.current) { setExporting(false); return }

      // ── Encode ───────────────────────────────────────────────────────────────
      setProgressMsg('Encoding MP4…'); setProgress(33)

      // For lyric projects: single presentation audio track mixed over whole video.
      // For script projects: per-page narration clips placed at their time offsets.
      const audioClips = audioPath ? null : buildAudioClips(orderedEntries)

      const unsubProgress = window.smmDesktop.lyricExport.onProgress(({ status, progress: p }) => {
        if (status) setProgressMsg(status)
        if (p != null) setProgress(33 + Math.round(p * 0.65))
      })

      const result = await window.smmDesktop.lyricExport.encode({
        tmpId,
        totalFrames: framesSent,
        audioSourcePath: audioPath || null,
        audioClips: audioClips && audioClips.length > 0 ? audioClips : null,
        outputPath,
        width: W,
        height: H,
        crf: quality,
      })
      unsubProgress()

      if (result.ok) {
        setProgress(100)
        setDone(result.outputPath || outputPath)
      } else {
        setError(result.error || 'Export failed.')
      }
    } catch (e) {
      videoCache.cleanup()
      setError(e?.message || 'Unexpected error during export.')
    } finally {
      setExporting(false)
    }
  }, [pages, stageWidth, stageHeight, defaultDuration, quality, audioPath, isElectron, isLyricProject, useAudioTiming, padBefore, padAfter])

  const S = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    box: { background: 'var(--panel-bg,#1a2233)', border: '1px solid var(--border,#2c3a52)', borderRadius: 10, padding: '1.6rem 2rem', minWidth: 440, maxWidth: 560, color: 'var(--t1,#e8e8e8)', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 14 },
    title: { fontSize: 17, fontWeight: 700, color: 'var(--accent,#e8a020)', display: 'flex', alignItems: 'center', gap: 8 },
    row: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 },
    label: { minWidth: 160, color: 'var(--t2,#aab)' },
    input: { background: 'var(--input-bg,#111827)', border: '1px solid var(--border,#2c3a52)', borderRadius: 4, padding: '3px 8px', color: 'var(--t1,#e8e8e8)', fontSize: 13, width: 80 },
    infoBox: { background: 'rgba(14,116,144,0.12)', border: '1px solid rgba(14,116,144,0.3)', borderRadius: 5, padding: '8px 12px', fontSize: 12, color: 'var(--t2,#aab)', lineHeight: 1.6 },
    warnBox: { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 5, padding: '8px 12px', fontSize: 12, color: '#f5c060', lineHeight: 1.6 },
    progressBar: { height: 8, background: 'var(--border,#2c3a52)', borderRadius: 4, overflow: 'hidden', marginTop: 2 },
    progressFill: { height: '100%', background: 'linear-gradient(90deg,#0ea5e9,#7c3aed)', borderRadius: 4, transition: 'width 0.3s' },
    btn: { padding: '7px 20px', borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    footer: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>

        <div style={S.title}>🎬 Export Script as MP4</div>

        {/* Info summary */}
        <div style={S.infoBox}>
          <strong>{pages.length}</strong> pages &nbsp;·&nbsp;
          <strong>{stageWidth}×{stageHeight}</strong> px &nbsp;·&nbsp;
          {isLyricProject
            ? <><strong>{timedPages.length}</strong> lyric-timed / <strong>{untimedPages.length}</strong> title pages</>
            : <><strong>{timedPages.length}</strong> timed / <strong>{untimedPages.length}</strong> untimed pages</>}
          {audioPath
            ? <><br />🎵 Audio: {presentationAudio?.name || 'Presentation track'} — will be mixed in.</>
            : presentationAudio?.file
              ? <><br />⚠️ Audio loaded via browser picker — native path unavailable. Re-pick audio via the native file dialog (🎵 Browse…) for audio in export.</>
              : (() => {
                  const clipCount = pages.filter(p =>
                    p.narration?.sourcePath || p.sound?.sourcePath ||
                    (p.elements||[]).some(e => e.mediaKind === 'audio' && e.mediaSourcePath)
                  ).length
                  return clipCount > 0
                    ? <><br />🎵 Per-page narration: <strong>{clipCount}</strong> page{clipCount !== 1 ? 's' : ''} with audio — will be mixed at correct offsets.</>
                    : <><br />⚠️ No audio track attached — exported video will be silent.</>
                })()}
        </div>

        {/* Options */}
        <div style={S.row}>
          <span style={S.label}>Default page duration</span>
          <input type="number" min="1" max="300" step="1" value={defaultDuration}
            onChange={e => setDefaultDuration(Math.max(1, parseInt(e.target.value) || 5))}
            style={S.input} title="Duration (seconds) used for pages without an explicit timing" />
          <span style={{ fontSize: 12, color: 'var(--t3,#888)' }}>sec (for untimed pages)</span>
        </div>
        <div style={S.row}>
          <span style={S.label}>Quality (CRF 0–51)</span>
          <input type="number" min="0" max="51" step="1" value={quality}
            onChange={e => setQuality(Math.min(51, Math.max(0, parseInt(e.target.value) || 22)))}
            style={S.input} title="Lower = better quality, larger file. 18=near-lossless, 22=high, 28=medium" />
          <span style={{ fontSize: 12, color: 'var(--t3,#888)' }}>{quality <= 18 ? '🏆 Near-lossless' : quality <= 23 ? '✅ High quality' : quality <= 28 ? '📦 Medium' : '⚡ Fast/small'}</span>
        </div>

        {/* Audio-driven page timing */}
        <div style={{ ...S.row, alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={useAudioTiming} onChange={e => setUseAudioTiming(e.target.checked)} />
            <span>🎵 Use narration audio duration for page timing</span>
          </label>
          {useAudioTiming && (
            <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={S.row}>
                <span style={{ ...S.label, minWidth: 130 }}>Pad before narration</span>
                <input type="number" min="0" max="10" step="0.1" value={padBefore}
                  onChange={e => setPadBefore(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{ ...S.input, width: 60 }} />
                <span style={{ fontSize: 12, color: 'var(--t3,#888)' }}>sec</span>
              </div>
              <div style={S.row}>
                <span style={{ ...S.label, minWidth: 130 }}>Pad after narration</span>
                <input type="number" min="0" max="10" step="0.1" value={padAfter}
                  onChange={e => setPadAfter(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{ ...S.input, width: 60 }} />
                <span style={{ fontSize: 12, color: 'var(--t3,#888)' }}>sec</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3,#888)' }}>
                Per-page override: set "Export duration" in the Page Timing inspector to fix a specific page.
              </div>
            </div>
          )}
        </div>

        {!isElectron && (
          <div style={S.warnBox}>⚠️ MP4 export is only available in the Electron desktop app, not the browser.</div>
        )}

        {/* Progress */}
        {(exporting || done || error) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={S.progressBar}>
              <div style={{ ...S.progressFill, width: `${progress}%` }} />
            </div>
            <div style={{ fontSize: 12, color: done ? '#4ade80' : error ? '#f87171' : 'var(--t2,#aab)' }}>
              {done
                ? `✅ Saved to: ${done}`
                : error
                  ? `❌ ${error}`
                  : progressMsg}
            </div>
          </div>
        )}

        <div style={S.footer}>
          {exporting && (
            <button style={{ ...S.btn, background: '#7f1d1d', color: '#fca5a5' }}
              onClick={() => { cancelRef.current = true }}>
              Cancel
            </button>
          )}
          {!exporting && (
            <button style={{ ...S.btn, background: 'var(--border,#2c3a52)', color: 'var(--t2,#aab)' }}
              onClick={onClose}>
              {done ? 'Close' : 'Cancel'}
            </button>
          )}
          {!exporting && !done && (
            <button style={{ ...S.btn, background: isElectron ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : '#333', color: '#fff', opacity: isElectron ? 1 : 0.4 }}
              onClick={handleExport}
              disabled={!isElectron}>
              🎬 Export MP4…
            </button>
          )}
          {done && !exporting && (
            <button style={{ ...S.btn, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: '#fff' }}
              onClick={onClose}>
              Done
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
