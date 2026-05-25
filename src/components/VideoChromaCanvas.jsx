/**
 * VideoChromaCanvas — renders video with real-time chroma key and/or shape mask.
 *
 * Uses Canvas 2D (CPU per-pixel) — reliable in Electron where WebGL texImage2D(video)
 * is unreliable for off-screen / hidden video elements.
 *
 * Internal canvas is limited to MAX_W (640px) wide for manageable CPU load.
 * CSS stretches the canvas to fill the parent container.
 *
 * Props:
 *   src         {string}   Video URL: blob:, data:, http://127.0.0.1:PORT/media?p=..., app-media:///
 *   chromaColor {string}   Hex colour to key out (e.g. '#00ff00'), or null to disable
 *   tolerance   {number}   Colour tolerance (0–255), default 30
 *   softness    {number}   Edge softness (0–255), default 8
 *   maskShape   {object}   { type: 'rect'|'ellipse', x, y, w, h } (all 0–1 normalised), or null
 *   muted       {boolean}  Mute video audio, default true (canvas-based rendering always mutes display canvas)
 *   volume      {number}   Volume 0.0–1.0, default 1.0 (applied to off-screen video)
 *   onEnded     {Function} Called when the off-screen video finishes.
 
 */

import { useRef, useEffect } from 'react'
import { hexToRgb } from '../utils/chromaKey.js'

function ignoreError() {}

function parseHex(hex) {
  const rgb = hexToRgb(hex || '#000000').map(v => Number.isFinite(v) ? v : 0)
  return /** @type {[number, number, number]} */ (rgb)
}

/** Module-level cache: data URL → blob URL (avoids repeated re-encoding on re-render) */
const _dataUrlBlobCache = new Map()

/** Resolve URL to something a video element can play quickly in Electron.
 *  - blob: → use as-is (already playable)
 *  - http://127.0.0.1: → fetch to blob so canvas pixel reads stay available for chroma
 *  - data: → convert once to blob URL, cache to avoid repeated base64 decode
 *  - app-media:/// → IPC extraction (only path that requires IPC now)
 *  - other → fetch → blob URL
 */
async function resolveToBlob(src) {
  if (!src) return null
  if (src.startsWith('blob:')) return src

  // Live chroma must call getImageData() on every frame. Even when the local
  // media-server URL displays in <video>, direct cross-origin playback can taint
  // the canvas in Chromium/Electron, which makes the effect a no-op.
  if (src.startsWith('http://127.0.0.1:')) {
    try {
      const resp = await fetch(src)
      if (resp.ok) {
        const blob = await resp.blob()
        return URL.createObjectURL(blob)
      }
    } catch { ignoreError() }
    return src
  }

  // data: URLs → cache-aware blob conversion (avoids 24MB base64 decode on every render)
  if (src.startsWith('data:')) {
    if (_dataUrlBlobCache.has(src)) return _dataUrlBlobCache.get(src)
    try {
      const resp = await fetch(src)
      if (resp.ok) {
        const blob = await resp.blob()
        const blobUrl = URL.createObjectURL(blob)
        _dataUrlBlobCache.set(src, blobUrl)
        return blobUrl
      }
    } catch { ignoreError() }
    return src
  }

  // app-media:/// → IPC extraction
  if (window.smmDesktop?.readMediaDataUrl) {
    const appMediaMatch = src.match(/^app-media:\/\/\/(.+)$/)
    if (appMediaMatch) {
      const nativePath = decodeURIComponent(appMediaMatch[1])
      try {
        const result = await window.smmDesktop.readMediaDataUrl({ filePath: nativePath, category: 'video' })
        if (result?.ok && result.dataUrl) {
          const blob = await fetch(result.dataUrl).then(r => r.blob())
          return URL.createObjectURL(blob)
        }
      } catch { ignoreError() }
    }
  }

  // Generic fetch fallback
  try {
    const resp = await fetch(src)
    if (resp.ok) {
      const blob = await resp.blob()
      return URL.createObjectURL(blob)
    }
  } catch { ignoreError() }

  return src
}

export default function VideoChromaCanvas({ src, chromaColor, tolerance, softness, maskShape, loop = true, muted = true, volume = 1.0, onEnded, style }) {
  const canvasRef = useRef(null)
  const vidRef    = useRef(null)
  const blobRef   = useRef(null)
  const rafRef    = useRef(null)

  // Live refs — updated every render so the RAF loop reads fresh values without
  // restarting the video pipeline when props change.
  const chromaRef = useRef(chromaColor)
  const tolRef    = useRef(tolerance)
  const softRef   = useRef(softness)
  const maskRef   = useRef(maskShape)
  const onEndedRef = useRef(onEnded)

  useEffect(() => {
    chromaRef.current = chromaColor
    tolRef.current = tolerance
    softRef.current = softness
    maskRef.current = maskShape
    onEndedRef.current = onEnded
  }, [chromaColor, tolerance, softness, maskShape, onEnded])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !src) return
    let cancelled = false

    // ── Cleanup previous instance ──────────────────────────────────────────
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (blobRef.current) {
      const isCached = Array.from(_dataUrlBlobCache.values()).includes(blobRef.current);
      if (!isCached) URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
    if (vidRef.current) {
      try { vidRef.current.pause(); vidRef.current.src = '' } catch { ignoreError() }
      try { if (document.body.contains(vidRef.current)) document.body.removeChild(vidRef.current) } catch { ignoreError() }
      vidRef.current = null
    }

    // ── Create off-screen video element ───────────────────────────────────
    const vid = document.createElement('video')
    vid.muted = muted !== false   // default true to avoid autoplay block; canvas renders pixels
    vid.volume = typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1.0
    vid.loop = loop !== false
    vid.playsInline = true
    vid.preload = 'auto'
    // Real visible dimensions off-screen — Electron GPU compositor throttles 1×1 hidden videos
    vid.style.cssText = 'position:fixed;top:-2000px;left:-2000px;width:128px;height:72px;pointer-events:none;z-index:-32767'
    vid.crossOrigin = 'anonymous'
    document.body.appendChild(vid)
    vidRef.current = vid
    const endedHandler = () => {
      try { onEndedRef.current?.() } catch { ignoreError() }
    }
    vid.addEventListener('ended', endedHandler)

    const ctx = canvas.getContext('2d')
    const MAX_W = 640   // limit internal canvas size for CPU performance

    // ── Per-frame render loop ──────────────────────────────────────────────
    function renderLoop() {
      if (cancelled) return
      if (vid.readyState >= 2 && vid.videoWidth && vid.videoHeight) {
        const vw = vid.videoWidth, vh = vid.videoHeight
        const scale = Math.min(1, MAX_W / vw)
        const cw = Math.round(vw * scale)
        const ch = Math.round(vh * scale)

        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw; canvas.height = ch
        }

        if (cw > 0 && ch > 0) {
          ctx.clearRect(0, 0, cw, ch)
          ctx.drawImage(vid, 0, 0, cw, ch)

          const cc   = chromaRef.current
          const ms   = maskRef.current
          const tol  = tolRef.current  != null ? tolRef.current  : 30
          const soft = Math.max(softRef.current != null ? softRef.current : 8, 1)

          if (cc || ms) {
            let imgData
            try { imgData = ctx.getImageData(0, 0, cw, ch) }
            catch { rafRef.current = requestAnimationFrame(renderLoop); return }

            const px = imgData.data
            let kr = 0, kg = 0, kb = 0
            if (cc) [kr, kg, kb] = parseHex(cc)

            for (let y = 0; y < ch; y++) {
              for (let x = 0; x < cw; x++) {
                const i = (y * cw + x) * 4
                let a = px[i + 3]

                // Shape mask — pixels outside the shape become transparent
                if (ms && a > 0) {
                  const nx = x / cw, ny = y / ch
                  let inside
                  if (ms.type === 'rect') {
                    inside = nx >= ms.x && nx <= ms.x + ms.w &&
                             ny >= ms.y && ny <= ms.y + ms.h
                  } else {
                    const ddx = (nx - (ms.x + ms.w / 2)) / (ms.w / 2)
                    const ddy = (ny - (ms.y + ms.h / 2)) / (ms.h / 2)
                    inside = ddx * ddx + ddy * ddy <= 1
                  }
                  if (!inside) a = 0
                }

                // Chroma key — remove pixels matching the key colour
                if (cc && a > 0) {
                  const dr = px[i] - kr, dg = px[i + 1] - kg, db = px[i + 2] - kb
                  const dist = Math.sqrt(dr * dr + dg * dg + db * db)
                  if (dist <= tol)            a = 0
                  else if (dist < tol + soft) a = Math.round(a * (dist - tol) / soft)
                }

                px[i + 3] = a
              }
            }
            ctx.putImageData(imgData, 0, 0)
          }
        }
      }
      rafRef.current = requestAnimationFrame(renderLoop)
    }

    // ── Async setup: resolve URL → start video → start render loop ────────
    async function setup() {
      const playableSrc = await resolveToBlob(src)
      if (cancelled) { if (playableSrc && playableSrc !== src && !_dataUrlBlobCache.has(src)) URL.revokeObjectURL(playableSrc); return }
      if (playableSrc !== src) blobRef.current = playableSrc

      vid.src = playableSrc
      vid.play().catch(ignoreError)

      // Start RAF immediately — renderLoop handles readyState < 2 gracefully,
      // and canvas dimensions update when loadedmetadata fires
      vid.addEventListener('loadedmetadata', () => {
        if (cancelled || !vid.videoWidth) return
        const vw = vid.videoWidth, vh = vid.videoHeight
        const scale = Math.min(1, MAX_W / vw)
        const cw = Math.round(vw * scale)
        const ch = Math.round(vh * scale)
        if (cw > 0 && ch > 0) { canvas.width = cw; canvas.height = ch }
      }, { once: true })

      rafRef.current = requestAnimationFrame(renderLoop)
    }

    setup()

    return () => {
      cancelled = true
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      try { vid.pause(); vid.src = '' } catch { ignoreError() }
      try { vid.removeEventListener('ended', endedHandler) } catch { ignoreError() }
      try { if (document.body.contains(vid)) document.body.removeChild(vid) } catch { ignoreError() }
      if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null }
      vidRef.current = null
    }
  }, [src, loop, muted, volume])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', background: 'transparent', ...style }}
    />
  )
}
