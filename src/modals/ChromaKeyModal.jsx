/**
 * ChromaKeyModal.jsx — Background removal / transparency editor.
 *
 * Modes:
 *   🎨 Colour Key  — click on the image to eyedrop the background colour, adjust tolerance + softness
 *   ▭  Rectangle   — drag to define a "keep" zone; everything outside = transparent
 *   ⬭  Ellipse     — drag to define an elliptical keep zone
 *   △  Polygon     — click to add vertices, right-click / double-click to close
 *   ✏  Freehand    — hold and drag; optional smart-snap to nearest Sobel edge
 *
 * Selection shapes are combined by union: all areas inside any shape are kept.
 * Colour key is applied first, then selection masking on top.
 *
 * Props:
 *   src      {string}              Current element file URL (blob: or data:)
 *   origSrc  {string|undefined}    Original un-keyed URL (preserved across re-edits)
 *   onApply  {(dataUrl: string) => void}
 *   onCancel {() => void}
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { hexToRgb } from '../utils/chromaKey.js'
import SmartColorPicker from '../components/SmartColorPicker.tsx'

function ignoreError() {}

// ─────────────────────────────────────────────────────────────────────────────
// Image-space processing helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Sobel edge-strength map (Float32Array, same size as imageData). */
function computeEdgeMap(imageData) {
  const { data, width, height } = imageData
  const edges = new Float32Array(width * height)
  const gray = (x, y) => {
    const i = (y * width + x) * 4
    return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx =
        -gray(x - 1, y - 1) + gray(x + 1, y - 1) +
        -2 * gray(x - 1, y) + 2 * gray(x + 1, y) +
        -gray(x - 1, y + 1) + gray(x + 1, y + 1)
      const gy =
        -gray(x - 1, y - 1) - 2 * gray(x, y - 1) - gray(x + 1, y - 1) +
        gray(x - 1, y + 1) + 2 * gray(x, y + 1) + gray(x + 1, y + 1)
      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy)
    }
  }
  return edges
}

/** Find the strongest edge pixel within `radius` of (x, y). */
function snapToEdge(x, y, edgeMap, width, height, radius = 12) {
  let bx = x, by = y, best = 25 // min threshold to trigger snap
  const r = Math.floor(radius)
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (dx * dx + dy * dy > r * r) continue
      const s = edgeMap[ny * width + nx]
      if (s > best) { best = s; bx = nx; by = ny }
    }
  }
  return { x: bx, y: by }
}

/**
 * Draw a selection shape path onto a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} sel — { type, x?, y?, w?, h?, points? }
 */
function drawSelectionPath(ctx, sel) {
  ctx.beginPath()
  if (sel.type === 'rect') {
    ctx.rect(sel.x, sel.y, sel.w, sel.h)
  } else if (sel.type === 'ellipse') {
    ctx.ellipse(sel.x + sel.w / 2, sel.y + sel.h / 2,
      Math.abs(sel.w / 2), Math.abs(sel.h / 2), 0, 0, Math.PI * 2)
  } else if (sel.type === 'polygon' || sel.type === 'freehand') {
    const pts = sel.points
    if (!pts || pts.length < 2) return
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath()
  }
}

/**
 * Render the final masked image.
 * @param {HTMLImageElement} img
 * @param {Array}  selections  — committed selection shapes
 * @param {{ enabled, color, tolerance, softness }|null} chromaOpts
 * @returns {string} PNG data URL
 */
function renderMask(imgProxy, selections, chromaOpts) {
  const drawable = imgProxy._drawable || imgProxy   // handles both real Image and video proxy
  const w = imgProxy.naturalWidth, h = imgProxy.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(drawable, 0, 0)

  // 1. Apply colour key
  if (chromaOpts?.enabled) {
    const [kr, kg, kb] = hexToRgb(chromaOpts.color || '#000000')
    const tol = Math.max(0, chromaOpts.tolerance || 30)
    const soft = Math.max(0, chromaOpts.softness || 8)
    const id = ctx.getImageData(0, 0, w, h)
    const px = id.data
    for (let i = 0; i < px.length; i += 4) {
      const dist = Math.sqrt((px[i] - kr) ** 2 + (px[i + 1] - kg) ** 2 + (px[i + 2] - kb) ** 2)
      if (dist <= tol) {
        px[i + 3] = 0
      } else if (soft > 0 && dist < tol + soft) {
        px[i + 3] = Math.round(px[i + 3] * (dist - tol) / soft)
      }
    }
    ctx.putImageData(id, 0, 0)
  }

  // 2. Apply selection mask (keep inside, transparent outside)
  if (selections.length > 0) {
    // Build white-on-black mask
    const mCanvas = document.createElement('canvas')
    mCanvas.width = w; mCanvas.height = h
    const mCtx = mCanvas.getContext('2d')
    mCtx.fillStyle = 'black'
    mCtx.fillRect(0, 0, w, h)
    mCtx.fillStyle = 'white'
    for (const sel of selections) {
      drawSelectionPath(mCtx, sel)
      mCtx.fill()
    }

    const imgData = ctx.getImageData(0, 0, w, h)
    const maskData = mCtx.getImageData(0, 0, w, h)
    const px = imgData.data
    const mp = maskData.data
    for (let i = 0; i < px.length; i += 4) {
      if (mp[i] < 128) px[i + 3] = 0
    }
    ctx.putImageData(imgData, 0, 0)
  }

  return canvas.toDataURL('image/png')
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'chroma',   label: '🎨 Colour Key',  title: 'Click image to eyedrop background colour' },
  { id: 'rect',     label: '▭ Rectangle',    title: 'Drag to define the visible area' },
  { id: 'ellipse',  label: '⬭ Ellipse',      title: 'Drag to define an elliptical visible area' },
  { id: 'polygon',  label: '△ Polygon',      title: 'Click to add vertices; right-click or double-click to close' },
  { id: 'freehand', label: '✏ Freehand',     title: 'Draw freely; smart edge snap helps follow subject outline' },
]

const CURSOR = { chroma: 'crosshair', rect: 'crosshair', ellipse: 'crosshair', polygon: 'crosshair', freehand: 'crosshair' }

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ChromaKeyModal({ src, origSrc, mediaKind, onApply, onCancel }) {
  const imageSrc = origSrc || src || ''
  // Determine if source is video — trust mediaKind prop first, then fall back to URL extension
  const isVideoSrc = (mediaKind && mediaKind !== 'image') ||
    /\.(webm|mp4|ogv|ogg|mov|avi|mkv)(\?|$)/i.test(imageSrc) ||
    imageSrc.startsWith('app-media:')

  // ── Mode / colour key state ─────────────────────────────────────────────
  const [tool, setTool]               = useState('chroma')
  const [chromaEnabled, setChromaEnabled] = useState(false)
  const [chromaColor, setChromaColor] = useState('#00ff00')
  const [tolerance, setTolerance]     = useState(30)
  const [softness, setSoftness]       = useState(8)
  const [snapEnabled, setSnapEnabled] = useState(true)

  // ── Selection state ─────────────────────────────────────────────────────
  const [selections, setSelections]   = useState([])    // committed shapes
  const [isDrawing, setIsDrawing]     = useState(false)
  const [drawStart, setDrawStart]     = useState(null)
  const [drawCurrent, setDrawCurrent] = useState(null)
  const [polyPoints, setPolyPoints]   = useState([])    // in-progress polygon
  const [freePoints, setFreePoints]   = useState([])    // in-progress freehand

  // ── Live Mask state (video only) ─────────────────────────────────────────
  const [liveMask, setLiveMask]       = useState({ type: 'rect', x: 0.1, y: 0.1, w: 0.8, h: 0.8 })

  // ── UI state ────────────────────────────────────────────────────────────
  const [previewUrl, setPreviewUrl]   = useState(null)
  const [frameVersion, setFrameVersion] = useState(0)  // bumped when source snapshot is ready
  const [processing, setProcessing]   = useState(false)
  const [msg, setMsg]                 = useState(
    (mediaKind && mediaKind !== 'image') ||
    /\.(webm|mp4|ogv|ogg|mov|avi|mkv)(\?|$)/i.test(origSrc || src || '')
      ? '🎬 Extracting frame from video for colour picking…'
      : '💡 Click the image to pick the background colour, then click Apply.'
  )

  // ── Refs ─────────────────────────────────────────────────────────────────
  const imgCanvasRef = useRef(null)   // draws the image (background)
  const overlayRef   = useRef(null)   // transparent overlay, captures mouse events
  const imgRef       = useRef(null)   // HTMLImageElement after load
  const edgeMapRef   = useRef(null)   // Float32Array Sobel edge map

  // ── Load source — handles both images and video (frame extraction) ────────
  useEffect(() => {
    setPreviewUrl(null)
    imgRef.current = null
    let cancelled = false
    let blobUrl = null
    let domVid = null   // DOM-attached video element — tracked for cleanup

    function cleanupVid(vid) {
      try { vid.pause(); vid.src = '' } catch { ignoreError() }
      try { if (document.body.contains(vid)) document.body.removeChild(vid) } catch { ignoreError() }
      domVid = null
    }

    function revokeBlob() {
      if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null }
    }

    function onSourceReady(snapCanvas, w, h) {
      if (cancelled) return
      imgRef.current = { naturalWidth: w, naturalHeight: h, _drawable: snapCanvas }
      setFrameVersion(v => v + 1)
    }

    async function loadSource() {
      if (!imageSrc) {
        setMsg('⚠ No media source provided.')
        return
      }
      if (isVideoSrc) {
        setMsg('🎬 Extracting frame from video…')

        // ── Step 1: get a blob URL — fetch() handles all URL types reliably ──
        let playableSrc = imageSrc
        // Convert any non-blob src to blob — avoids MEDIA_ERR_SRC_NOT_SUPPORTED (error 4)
        // for app-media://, http://127.0.0.1:PORT/media?p=..., and data: URLs in Electron
        if (!imageSrc.startsWith('blob:')) {
          // Try IPC readMediaDataUrl first for native path embedded in app-media/http URLs
          let resolved = false
          if (window.smmDesktop?.readMediaDataUrl) {
            // Extract native path from http://127.0.0.1:PORT/media?p=ENCODED_PATH
            const httpMatch = imageSrc.match(/^http:\/\/127\.0\.0\.1:\d+\/media\?p=(.+)$/)
            const appMediaMatch = imageSrc.match(/^app-media:\/\/\/(.+)$/)
            const nativePath = httpMatch
              ? decodeURIComponent(httpMatch[1])
              : appMediaMatch ? decodeURIComponent(appMediaMatch[1]) : null
            if (nativePath) {
              try {
                const result = await window.smmDesktop.readMediaDataUrl({ filePath: nativePath, category: 'video' })
                if (result?.ok && result.dataUrl && !cancelled) {
                  const resp2 = await fetch(result.dataUrl)
                  const blob2 = await resp2.blob()
                  if (!cancelled) { blobUrl = URL.createObjectURL(blob2); playableSrc = blobUrl; resolved = true }
                }
              } catch { /* fall through to fetch */ }
            }
          }
          if (!resolved) {
            try {
              const resp = await fetch(imageSrc)
              if (resp.ok) {
                const blob = await resp.blob()
                if (cancelled) return
                blobUrl = URL.createObjectURL(blob)
                playableSrc = blobUrl
              }
            } catch {
              playableSrc = imageSrc   // fallback: use URL directly
            }
          }
        }
        if (cancelled) return

        // ── Step 2: create video, ATTACH TO DOM (required in Electron for HW decoder) ──
        const vid = document.createElement('video')
        domVid = vid
        vid.muted = true
        vid.playsInline = true
        vid.preload = 'auto'
        // 16×9px visible (off-screen) — Electron GPU compositor throttles 1×1px/opacity:0 elements
        vid.style.cssText = [
          'position:fixed', 'top:-9999px', 'left:-9999px',
          'width:16px', 'height:9px', 'opacity:0.01',
          'pointer-events:none', 'z-index:-32767',
        ].join(';')
        document.body.appendChild(vid)

        await new Promise((resolve) => {
          let captured = false

          const doCapture = async () => {
            if (cancelled || captured) return
            const w = vid.videoWidth
            const h = vid.videoHeight
            if (!w || !h) return   // dimensions not ready yet — another event will retry
            captured = true

            const snap = document.createElement('canvas')
            snap.width = w; snap.height = h

            try {
              // createImageBitmap forces the browser to materialise actual frame pixels
              // — more reliable than drawImage(vid) which can produce blank on Electron
              const bitmap = await createImageBitmap(vid, { resizeQuality: 'high' })
              snap.getContext('2d').drawImage(bitmap, 0, 0, w, h)
              bitmap.close()
            } catch {
              // fallback: direct drawImage (works on most platforms when frame is decoded)
              snap.getContext('2d').drawImage(vid, 0, 0, w, h)
            }

            if (!cancelled) {
              onSourceReady(snap, w, h)
              setMsg('💡 Frame captured. Use colour key or draw a selection to remove background.')
            }
            cleanupVid(vid)
            revokeBlob()
            resolve()
          }

          // requestVideoFrameCallback — fires exactly when a new frame is available
          // (Chromium 83+ / Electron 12+ — most reliable method)
          if (typeof vid.requestVideoFrameCallback === 'function') {
            vid.requestVideoFrameCallback(() => { doCapture() })
          }

          vid.addEventListener('timeupdate',     () => { if (!captured) doCapture() })
          vid.addEventListener('seeked',         () => { if (!captured) doCapture() })
          vid.addEventListener('canplaythrough', () => {
            if (!captured) {
              vid.currentTime = 0.1
              vid.play().catch(() => {})
            }
          })
          vid.addEventListener('canplay', () => {
            if (!captured) {
              vid.currentTime = 0.1
              vid.play().catch(() => {})
            }
          })
          vid.addEventListener('loadeddata', () => {
            if (!captured) { vid.currentTime = 0.1; vid.play().catch(() => {}) }
          })
          vid.addEventListener('loadedmetadata', () => {
            if (!captured) vid.play().catch(() => {})
          })
          vid.addEventListener('error', () => {
            const code = vid.error?.code ?? '?'
            if (!cancelled) setMsg(`⚠ Could not load video (error ${code}). Ensure the file is a valid MP4 or WebM.`)
            cleanupVid(vid)
            revokeBlob()
            resolve()
          })

          // Last-resort timeout — 10s: try to capture whatever we have
          const giveUp = setTimeout(() => {
            if (!captured && !cancelled) {
              captured = true
              const w = vid.videoWidth || 0, h = vid.videoHeight || 0
              if (w && h) {
                const snap = document.createElement('canvas')
                snap.width = w; snap.height = h
                snap.getContext('2d').drawImage(vid, 0, 0, w, h)
                if (!cancelled) {
                  onSourceReady(snap, w, h)
                  setMsg('⚠ Frame extracted (timeout). Result may look incorrect.')
                }
              } else {
                if (!cancelled) setMsg('⚠ Video timed out — could not extract a frame.')
              }
              cleanupVid(vid)
              revokeBlob()
              resolve()
            }
          }, 10000)

          vid.addEventListener('seeked', () => clearTimeout(giveUp), { once: true })

          vid.src = playableSrc
          vid.load()
          // Immediately attempt play — some Electron builds need this to start decoding
          vid.play().catch(() => {})
        })

      } else {
        // ── Image path ──
        await new Promise((resolve) => {
          const img = new Image()
          // crossOrigin must NOT be set on data/blob URLs — causes canvas taint
          if (!imageSrc.startsWith('data:') && !imageSrc.startsWith('blob:')) {
            img.crossOrigin = 'anonymous'
          }
          img.onload = () => {
            if (cancelled) { resolve(); return }
            const snap = document.createElement('canvas')
            snap.width = img.naturalWidth; snap.height = img.naturalHeight
            snap.getContext('2d').drawImage(img, 0, 0)
            onSourceReady(snap, img.naturalWidth, img.naturalHeight)
            setMsg('💡 Click the image to pick the background colour, then click Apply.')
            resolve()
          }
          img.onerror = () => {
            if (!cancelled) setMsg('⚠ Could not load image.')
            resolve()
          }
          img.src = imageSrc
        })
      }
    }

    loadSource()

    return () => {
      cancelled = true
      if (domVid) cleanupVid(domVid)
      revokeBlob()
    }
  }, [imageSrc, isVideoSrc])

  // ── Draw snapshot to display canvas once both are ready ─────────────────
  useEffect(() => {
    if (frameVersion === 0 || !imgRef.current) return
    const snap = imgRef.current._drawable
    if (!snap) return
    const c = imgCanvasRef.current
    if (!c) return
    const { naturalWidth: w, naturalHeight: h } = imgRef.current
    c.width = w; c.height = h
    const ov = overlayRef.current
    if (ov) { ov.width = w; ov.height = h }
    c.getContext('2d').drawImage(snap, 0, 0)
    // Build Sobel edge map (deferred)
    setTimeout(() => {
      if (!imgRef.current) return
      const id = c.getContext('2d').getImageData(0, 0, w, h)
      edgeMapRef.current = computeEdgeMap(id)
    }, 50)
  }, [frameVersion])

  // ── Overlay redraw ───────────────────────────────────────────────────────
  useEffect(() => {
    const ov = overlayRef.current
    if (!ov || !ov.width) return
    const ctx = ov.getContext('2d')
    ctx.clearRect(0, 0, ov.width, ov.height)

    // Committed selections — teal fill + dashed stroke
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = '#3cb8be'
    ctx.lineWidth = 1.5
    ctx.fillStyle = 'rgba(60,184,190,0.18)'
    for (const sel of selections) {
      drawSelectionPath(ctx, sel)
      ctx.fill()
      ctx.stroke()
    }

    // Active selection being drawn — white dashed
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.fillStyle = 'rgba(255,255,255,0.08)'

    if ((tool === 'rect') && isDrawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x)
      const y = Math.min(drawStart.y, drawCurrent.y)
      const w = Math.abs(drawCurrent.x - drawStart.x)
      const h = Math.abs(drawCurrent.y - drawStart.y)
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke()
    } else if (tool === 'ellipse' && isDrawing && drawStart && drawCurrent) {
      const cx = (drawStart.x + drawCurrent.x) / 2
      const cy = (drawStart.y + drawCurrent.y) / 2
      const rx = Math.abs(drawCurrent.x - drawStart.x) / 2
      const ry = Math.abs(drawCurrent.y - drawStart.y) / 2
      ctx.beginPath(); ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    } else if (tool === 'polygon' && polyPoints.length > 0) {
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(polyPoints[0].x, polyPoints[0].y)
      for (let i = 1; i < polyPoints.length; i++) ctx.lineTo(polyPoints[i].x, polyPoints[i].y)
      if (drawCurrent) ctx.lineTo(drawCurrent.x, drawCurrent.y)
      ctx.stroke()
      // Vertex dots
      ctx.setLineDash([])
      ctx.fillStyle = '#ffffff'
      for (const pt of polyPoints) {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill()
      }
      // Highlight close zone on first point
      if (polyPoints.length >= 3) {
        ctx.strokeStyle = '#ffdd44'
        ctx.beginPath(); ctx.arc(polyPoints[0].x, polyPoints[0].y, 10, 0, Math.PI * 2); ctx.stroke()
      }
    } else if (tool === 'freehand' && freePoints.length > 1) {
      ctx.beginPath()
      ctx.moveTo(freePoints[0].x, freePoints[0].y)
      for (let i = 1; i < freePoints.length; i++) ctx.lineTo(freePoints[i].x, freePoints[i].y)
      ctx.stroke()
    }
  }, [tool, selections, isDrawing, drawStart, drawCurrent, polyPoints, freePoints])

  // ── Coordinate helpers ────────────────────────────────────────────────────
  const toImageCoords = useCallback((e) => {
    const ov = overlayRef.current
    if (!ov) return { x: 0, y: 0 }
    const rect = ov.getBoundingClientRect()
    return {
      x: Math.round((e.clientX - rect.left) * ov.width  / rect.width),
      y: Math.round((e.clientY - rect.top)  * ov.height / rect.height),
    }
  }, [])

  const maybeSnap = useCallback((x, y) => {
    if (!snapEnabled || !edgeMapRef.current || !imgRef.current) return { x, y }
    const { naturalWidth: w, naturalHeight: h } = imgRef.current
    return snapToEdge(x, y, edgeMapRef.current, w, h, 12)
  }, [snapEnabled])

  // ── Commit helpers ────────────────────────────────────────────────────────
  const commitPolygon = useCallback(() => {
    if (polyPoints.length < 3) { setPolyPoints([]); return }
    setSelections(prev => [...prev, { type: 'polygon', points: polyPoints }])
    setPolyPoints([])
    setMsg('Polygon added. Draw more shapes or click Apply.')
  }, [polyPoints])

  const resetDrawTool = useCallback(() => {
    setIsDrawing(false); setDrawStart(null); setDrawCurrent(null)
    setPolyPoints([]); setFreePoints([])
  }, [])

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const pt = toImageCoords(e)

    if (tool === 'chroma') {
      const c = imgCanvasRef.current
      if (!c) return
      const d = c.getContext('2d').getImageData(pt.x, pt.y, 1, 1).data
      const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')
      setChromaColor(hex)
      setChromaEnabled(true)
      setMsg(`Picked: ${hex}  — adjust Tolerance/Softness then click Apply.`)
      return
    }

    if (tool === 'rect' || tool === 'ellipse') {
      setIsDrawing(true); setDrawStart(pt); setDrawCurrent(pt); return
    }

    if (tool === 'polygon') {
      if (polyPoints.length >= 3) {
        const d = Math.hypot(pt.x - polyPoints[0].x, pt.y - polyPoints[0].y)
        if (d <= 12) { commitPolygon(); return }
      }
      setPolyPoints(prev => [...prev, pt]); return
    }

    if (tool === 'freehand') {
      setIsDrawing(true)
      setFreePoints([maybeSnap(pt.x, pt.y)]); return
    }
  }, [tool, toImageCoords, polyPoints, commitPolygon, maybeSnap])

  const handleMouseMove = useCallback((e) => {
    const pt = toImageCoords(e)
    setDrawCurrent(pt)
    if (tool === 'freehand' && isDrawing) {
      const snapped = maybeSnap(pt.x, pt.y)
      setFreePoints(prev => {
        if (!prev.length) return [snapped]
        const last = prev[prev.length - 1]
        if (Math.hypot(snapped.x - last.x, snapped.y - last.y) < 3) return prev
        return [...prev, snapped]
      })
    }
  }, [tool, isDrawing, toImageCoords, maybeSnap])

  const handleMouseUp = useCallback((e) => {
    const pt = toImageCoords(e)

    if (tool === 'rect' && isDrawing && drawStart) {
      const x = Math.min(drawStart.x, pt.x), y = Math.min(drawStart.y, pt.y)
      const w = Math.abs(pt.x - drawStart.x),  h = Math.abs(pt.y - drawStart.y)
      if (w > 4 && h > 4) {
        setSelections(prev => [...prev, { type: 'rect', x, y, w, h }])
        setMsg('Rectangle added. Draw more shapes or click Apply.')
      }
      setIsDrawing(false); setDrawStart(null); setDrawCurrent(null); return
    }

    if (tool === 'ellipse' && isDrawing && drawStart) {
      const x = Math.min(drawStart.x, pt.x), y = Math.min(drawStart.y, pt.y)
      const w = Math.abs(pt.x - drawStart.x),  h = Math.abs(pt.y - drawStart.y)
      if (w > 4 && h > 4) {
        setSelections(prev => [...prev, { type: 'ellipse', x, y, w, h }])
        setMsg('Ellipse added. Draw more shapes or click Apply.')
      }
      setIsDrawing(false); setDrawStart(null); setDrawCurrent(null); return
    }

    if (tool === 'freehand' && isDrawing) {
      if (freePoints.length >= 3) {
        setSelections(prev => [...prev, { type: 'freehand', points: freePoints }])
        setMsg('Freehand area added. Draw more or click Apply.')
      }
      setIsDrawing(false); setFreePoints([]); return
    }
  }, [tool, isDrawing, drawStart, toImageCoords, freePoints])

  const handleDoubleClick = useCallback(() => {
    if (tool === 'polygon' && polyPoints.length >= 3) commitPolygon()
  }, [tool, polyPoints, commitPolygon])

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    if (tool === 'polygon' && polyPoints.length >= 3) commitPolygon()
  }, [tool, polyPoints, commitPolygon])

  // ── Undo last selection ──────────────────────────────────────────────────
  const undoLast = useCallback(() => {
    setSelections(prev => prev.slice(0, -1))
    setMsg('Last selection removed.')
  }, [])

  // ── Preview ───────────────────────────────────────────────────────────────
  const handlePreview = useCallback(async () => {
    if (!imgRef.current) { setMsg('Image not loaded yet.'); return }
    const hasWork = chromaEnabled || selections.length > 0
    if (!hasWork) { setMsg('Enable Colour Key or draw a selection first.'); return }
    setProcessing(true); setMsg('Generating preview…')
    try {
      const chromaOpts = chromaEnabled ? { enabled: true, color: chromaColor, tolerance, softness } : null
      const result = renderMask(imgRef.current, selections, chromaOpts)
      setPreviewUrl(result)
      setMsg('Preview ready — click Edit to go back or Apply to use this.')
    } catch (err) {
      setMsg('Preview error: ' + (err?.message || err))
    } finally { setProcessing(false) }
  }, [chromaEnabled, chromaColor, tolerance, softness, selections])

  // ── Live Mask drag ────────────────────────────────────────────────────────
  const startLiveDrag = (e, handle) => {
    e.preventDefault(); e.stopPropagation()
    const rect = imgCanvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX, sy = e.clientY
    const sm = { ...liveMask }
    const MIN = 0.04

    const onMove = (ev) => {
      const dx = (ev.clientX - sx) / rect.width
      const dy = (ev.clientY - sy) / rect.height
      setLiveMask(() => {
        const m = { type: sm.type, x: sm.x, y: sm.y, w: sm.w, h: sm.h }
        if (handle === 'body') {
          m.x = Math.max(0, Math.min(1 - sm.w, sm.x + dx))
          m.y = Math.max(0, Math.min(1 - sm.h, sm.y + dy))
          return m
        }
        if (handle.includes('w')) {
          const nx = Math.min(sm.x + sm.w - MIN, Math.max(0, sm.x + dx))
          m.w = sm.x + sm.w - nx; m.x = nx
        }
        if (handle.includes('e')) { m.w = Math.max(MIN, Math.min(1 - sm.x, sm.w + dx)) }
        if (handle.includes('n')) {
          const ny = Math.min(sm.y + sm.h - MIN, Math.max(0, sm.y + dy))
          m.h = sm.y + sm.h - ny; m.y = ny
        }
        if (handle.includes('s')) { m.h = Math.max(MIN, Math.min(1 - sm.y, sm.h + dy)) }
        return m
      })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }

  const liveMaskHandles = liveMask ? [
    { id: 'nw', nx: liveMask.x,               ny: liveMask.y               },
    { id: 'n',  nx: liveMask.x+liveMask.w/2,  ny: liveMask.y               },
    { id: 'ne', nx: liveMask.x+liveMask.w,    ny: liveMask.y               },
    { id: 'e',  nx: liveMask.x+liveMask.w,    ny: liveMask.y+liveMask.h/2  },
    { id: 'se', nx: liveMask.x+liveMask.w,    ny: liveMask.y+liveMask.h    },
    { id: 's',  nx: liveMask.x+liveMask.w/2,  ny: liveMask.y+liveMask.h    },
    { id: 'sw', nx: liveMask.x,               ny: liveMask.y+liveMask.h    },
    { id: 'w',  nx: liveMask.x,               ny: liveMask.y+liveMask.h/2  },
  ] : []
  const HANDLE_CURSORS = { nw:'nw-resize', n:'n-resize', ne:'ne-resize', e:'e-resize', se:'se-resize', s:'s-resize', sw:'sw-resize', w:'w-resize' }

  // ── Apply ─────────────────────────────────────────────────────────────────
  const handleApply = useCallback(async () => {
    const hasWork = chromaEnabled || selections.length > 0 || tool === 'livemask'
    if (!hasWork) { setMsg('Enable Colour Key or draw a selection first.'); return }

    // ── For ALL video sources: always use parameter mode (never bake a static PNG).
    // This preserves the video — VideoChromaCanvas applies chroma/mask in real-time.
    if (isVideoSrc) {
      // Use the liveMask shape, or the first rect/ellipse selection if any
      const firstSimpleSel = selections.find(s => s.type === 'rect' || s.type === 'ellipse')
      const maskShape = tool === 'livemask'
        ? { ...liveMask }
        : (firstSimpleSel ? { type: firstSimpleSel.type, x: firstSimpleSel.x / (imgRef.current?.naturalWidth || 1), y: firstSimpleSel.y / (imgRef.current?.naturalHeight || 1), w: firstSimpleSel.w / (imgRef.current?.naturalWidth || 1), h: firstSimpleSel.h / (imgRef.current?.naturalHeight || 1) } : null)
      onApply(null, {
        wasVideo: true,
        hasLiveMask: maskShape !== null,
        hasSelections: selections.length > 0,
        liveMaskShape: maskShape,
        chromaEnabled,
        chromaColor: chromaEnabled ? chromaColor : null,
        tolerance:   chromaEnabled ? tolerance   : null,
        softness:    chromaEnabled ? softness     : null,
        videoSrc: imageSrc,
      })
      return
    }

    // ── Image sources: bake a PNG with the mask applied ────────────────────
    if (!imgRef.current) { setMsg('Image not loaded yet.'); return }
    setProcessing(true); setMsg('Processing…')
    try {
      const chromaOpts = chromaEnabled ? { enabled: true, color: chromaColor, tolerance, softness } : null
      const result = renderMask(imgRef.current, selections, chromaOpts)
      onApply(result, {
        wasVideo: false,
        hasSelections: selections.length > 0,
        chromaEnabled,
        chromaColor: chromaEnabled ? chromaColor : null,
        tolerance:   chromaEnabled ? tolerance   : null,
        softness:    chromaEnabled ? softness     : null,
      })
    } catch (err) {
      setMsg('Error: ' + (err?.message || err))
      setProcessing(false)
    }
  }, [tool, liveMask, chromaEnabled, chromaColor, tolerance, softness, selections, onApply, isVideoSrc, imageSrc])

  // ── Tool switch helper ────────────────────────────────────────────────────
  const switchTool = useCallback((id) => {
    resetDrawTool(); setTool(id)
    const hints = {
      chroma:    '💡 Click anywhere on the image to pick the background colour.',
      rect:      '💡 Drag to draw a rectangle — the area inside will be kept visible.',
      ellipse:   '💡 Drag to draw an ellipse — the area inside will be kept visible.',
      polygon:   '💡 Click to add vertices. Double-click or right-click to close the shape.',
      freehand:  '💡 Hold and drag to draw freely around the subject.',
      livemask:  '📐 Drag the shape to position it. Drag the handles to resize. The area INSIDE is visible; outside is transparent. Plays live on video.',
    }
    setMsg(hints[id] || '')
  }, [resetDrawTool])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const content = (
    <div
      className="modal-backdrop"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="modal-box"
        style={{ maxWidth: '92vw', width: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '10px 14px' }}>
          <h3 style={{ margin: 0 }}>🎨 Background Removal</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        {/* Tool bar */}
        <div style={{ display: 'flex', gap: 4, padding: '6px 10px', background: 'var(--be-bg2)', borderBottom: '1px solid var(--be-border)', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            ...TOOLS,
            ...(isVideoSrc ? [{ id: 'livemask', label: '📐 Live Shape', title: 'Drag & resize one shape — visible area plays live; everything outside = transparent' }] : []),
          ].map(t => (
            <button
              key={t.id}
              className={`be-btn${tool === t.id ? ' on' : ''}`}
              title={t.title}
              onClick={() => switchTool(t.id)}
            >{t.label}</button>
          ))}
          <div style={{ flex: 1 }} />
          {selections.length > 0 && tool !== 'livemask' && (
            <>
              <button className="be-btn" title="Undo last selection" onClick={undoLast} style={{ color: '#ffcc66' }}>↩ Undo</button>
              <button className="be-btn" title="Clear all selections" style={{ color: '#ff8080' }} onClick={() => { setSelections([]); setMsg('Selections cleared.') }}>✕ Clear all</button>
            </>
          )}
          {tool === 'livemask' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              Shape:
              <select value={liveMask.type} onChange={e => setLiveMask(m => ({ ...m, type: e.target.value }))}
                style={{ fontSize: 12, background: 'var(--be-bg2)', color: 'var(--be-text)', border: '1px solid var(--be-border)', borderRadius: 3, padding: '2px 4px' }}>
                <option value="rect">▭ Rectangle</option>
                <option value="ellipse">⬭ Ellipse</option>
              </select>
            </label>
          )}
        </div>

        {/* Canvas / Preview */}
        <div
          style={{ flex: 1, overflow: 'auto', background: '#1a1a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxWidth: '100%', maxHeight: '58vh', display: 'block',
                backgroundImage: 'repeating-conic-gradient(#444 0% 25%, #2a2a2a 0% 50%)',
                backgroundSize: '16px 16px',
              }}
            />
          ) : (
            <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
              {/* Background: image */}
              <canvas
                ref={imgCanvasRef}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '58vh' }}
              />
              {/* Foreground: selection overlay + mouse events (hidden in livemask mode) */}
              <canvas
                ref={overlayRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: CURSOR[tool] || 'crosshair', pointerEvents: tool === 'livemask' ? 'none' : 'auto' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                onMouseLeave={() => setDrawCurrent(null)}
              />
              {/* Live Mask overlay — drag/resize shape on top of frame */}
              {tool === 'livemask' && imgRef.current && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', userSelect: 'none' }}>
                  {/* Dimmed backdrop with shape cut-out using box-shadow */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${liveMask.x * 100}%`,
                      top:  `${liveMask.y * 100}%`,
                      width:  `${liveMask.w * 100}%`,
                      height: `${liveMask.h * 100}%`,
                      borderRadius: liveMask.type === 'ellipse' ? '50%' : 0,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.52)',
                      border: '2px dashed rgba(0,180,255,0.9)',
                      boxSizing: 'border-box',
                      cursor: 'move',
                      zIndex: 2,
                    }}
                    onMouseDown={(e) => startLiveDrag(e, 'body')}
                  />
                  {/* 8 resize handles */}
                  {liveMaskHandles.map(hp => (
                    <div
                      key={hp.id}
                      style={{
                        position: 'absolute',
                        left: `calc(${hp.nx * 100}% - 6px)`,
                        top:  `calc(${hp.ny * 100}% - 6px)`,
                        width: 12, height: 12,
                        background: '#fff',
                        border: '2px solid #00b4ff',
                        borderRadius: 2,
                        cursor: HANDLE_CURSORS[hp.id],
                        zIndex: 3,
                        boxSizing: 'border-box',
                      }}
                      onMouseDown={(e) => { e.stopPropagation(); startLiveDrag(e, hp.id) }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding: '8px 12px', background: 'var(--be-bg2)', borderTop: '1px solid var(--be-border)' }}>

          {/* Video-source notice */}
          {isVideoSrc && !previewUrl && tool !== 'livemask' && (
            <p style={{ fontSize: 11, color: '#ffcc66', margin: '0 0 6px' }}>
              🎬 Working on extracted video frame — result will be a PNG still image with transparency applied. Use <strong>📐 Live Shape</strong> to keep the video playing with real-time masking.
            </p>
          )}
          {isVideoSrc && tool === 'livemask' && (
            <p style={{ fontSize: 11, color: '#80e0ff', margin: '0 0 6px' }}>
              🎬 Live mask mode — the video will play in the bar with only the shape area visible in real time. Optionally enable Colour Key below to also remove a background colour.
            </p>
          )}

          {/* Colour Key controls — shown in chroma mode and optionally in livemask mode */}
          {(tool === 'chroma' || tool === 'livemask') && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <input type="checkbox" checked={chromaEnabled} onChange={e => setChromaEnabled(e.target.checked)} />
                Enable Colour Key
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                Key colour:
                <SmartColorPicker value={chromaColor} onChange={v => setChromaColor(v)} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                Tolerance
                <input type="range" min={0} max={200} value={tolerance}
                  onChange={e => setTolerance(Number(e.target.value))}
                  style={{ width: 90 }} />
                <span style={{ width: 26, fontSize: 11 }}>{tolerance}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                Softness
                <input type="range" min={0} max={64} value={softness}
                  onChange={e => setSoftness(Number(e.target.value))}
                  style={{ width: 70 }} />
                <span style={{ width: 22, fontSize: 11 }}>{softness}</span>
              </label>
            </div>
          )}

          {/* Freehand snap toggle */}
          {tool === 'freehand' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 6 }}>
              <input type="checkbox" checked={snapEnabled} onChange={e => setSnapEnabled(e.target.checked)} />
              Smart edge snap (Sobel) — snaps drawing path to nearby subject edges
            </label>
          )}

          {/* Selection summary */}
          {selections.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--mme-teal)', margin: '0 0 5px' }}>
              {selections.length} selection{selections.length !== 1 ? 's' : ''} drawn — everything <strong>inside</strong> these shapes will be kept; outside = transparent.
            </p>
          )}

          {/* Status message */}
          {msg && <p style={{ fontSize: 11, color: '#999', margin: '0 0 6px' }}>{msg}</p>}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="be-btn" onClick={handlePreview} disabled={processing}>
              {processing ? '⏳' : '👁 Preview'}
            </button>
            {previewUrl && (
              <button className="be-btn" onClick={() => { setPreviewUrl(null); setMsg('') }}>← Edit</button>
            )}
            <button
              className="be-btn"
              onClick={handleApply}
              disabled={processing}
              style={{ background: '#1a4a2a', borderColor: '#2a7a3a', color: '#80e080' }}
            >
              {processing ? '⏳ Processing…' : '✓ Apply'}
            </button>
            <button className="be-btn" style={{ color: '#ff8080' }} onClick={onCancel} disabled={processing}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
  return createPortal(content, document.body)
}
