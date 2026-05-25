import { useEffect, useRef } from 'react'
import { hexToRgb } from '../utils/chromaKey.js'

function ignoreError() {}

function drawNormalizedShape(ctx, shape, w, h) {
  if (!shape) return
  ctx.beginPath()
  if (shape.type === 'rect') {
    ctx.rect(shape.x * w, shape.y * h, shape.w * w, shape.h * h)
  } else if (shape.type === 'ellipse') {
    ctx.ellipse(
      (shape.x + shape.w / 2) * w,
      (shape.y + shape.h / 2) * h,
      Math.abs(shape.w * w / 2),
      Math.abs(shape.h * h / 2),
      0,
      0,
      Math.PI * 2
    )
  } else if ((shape.type === 'polygon' || shape.type === 'freehand') && Array.isArray(shape.points) && shape.points.length > 1) {
    ctx.moveTo(shape.points[0].x * w, shape.points[0].y * h)
    for (let i = 1; i < shape.points.length; i++) ctx.lineTo(shape.points[i].x * w, shape.points[i].y * h)
    ctx.closePath()
  }
}

function isInsideShape(shape, nx, ny) {
  if (!shape) return false
  if (shape.type === 'rect') {
    return nx >= shape.x && nx <= shape.x + shape.w && ny >= shape.y && ny <= shape.y + shape.h
  }
  if (shape.type === 'ellipse') {
    const rx = shape.w / 2
    const ry = shape.h / 2
    if (!rx || !ry) return false
    const dx = (nx - (shape.x + rx)) / rx
    const dy = (ny - (shape.y + ry)) / ry
    return dx * dx + dy * dy <= 1
  }
  return false
}

function isAnimatedImageSource(src) {
  const s = String(src || '').toLowerCase().split('?')[0].split('#')[0]
  return s.endsWith('.gif') || s.endsWith('.apng') || s.startsWith('data:image/gif') || s.startsWith('data:image/apng')
}

export default function ImageChromaCanvas({ src, chromaColor, tolerance, softness, maskShape, maskShapes, onError, style }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !src) return
    let cancelled = false
    let rafId = null
    const img = new Image()
    if (!src.startsWith('data:') && !src.startsWith('blob:')) img.crossOrigin = 'anonymous'

    const renderFrame = () => {
      if (cancelled) return
      const w = img.naturalWidth || img.width || 1
      const h = img.naturalHeight || img.height || 1
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)

      const shapes = Array.isArray(maskShapes) && maskShapes.length
        ? maskShapes
        : (maskShape ? [maskShape] : [])

      if (chromaColor) {
        let imgData
        try { imgData = ctx.getImageData(0, 0, w, h) } catch { return }
        const px = imgData.data
        const [kr, kg, kb] = hexToRgb(chromaColor)
        const tol = tolerance != null ? tolerance : 30
        const soft = Math.max(softness != null ? softness : 8, 1)
        const simpleMask = shapes.length === 1 && (shapes[0].type === 'rect' || shapes[0].type === 'ellipse') ? shapes[0] : null

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4
            let a = px[i + 3]
            if (simpleMask && a > 0 && !isInsideShape(simpleMask, x / w, y / h)) a = 0
            if (a > 0) {
              const dr = px[i] - kr
              const dg = px[i + 1] - kg
              const db = px[i + 2] - kb
              const dist = Math.sqrt(dr * dr + dg * dg + db * db)
              if (dist <= tol) a = 0
              else if (dist < tol + soft) a = Math.round(a * (dist - tol) / soft)
            }
            px[i + 3] = a
          }
        }
        ctx.putImageData(imgData, 0, 0)
      }

      if (shapes.length && !(shapes.length === 1 && (shapes[0].type === 'rect' || shapes[0].type === 'ellipse') && chromaColor)) {
        const maskCanvas = document.createElement('canvas')
        maskCanvas.width = w
        maskCanvas.height = h
        const maskCtx = maskCanvas.getContext('2d')
        if (!maskCtx) return
        maskCtx.fillStyle = 'black'
        maskCtx.fillRect(0, 0, w, h)
        maskCtx.fillStyle = 'white'
        for (const shape of shapes) {
          drawNormalizedShape(maskCtx, shape, w, h)
          maskCtx.fill()
        }
        const imgData = ctx.getImageData(0, 0, w, h)
        const maskData = maskCtx.getImageData(0, 0, w, h)
        const px = imgData.data
        const mp = maskData.data
        for (let i = 0; i < px.length; i += 4) {
          if (mp[i] < 128) px[i + 3] = 0
        }
        ctx.putImageData(imgData, 0, 0)
      }

      if (isAnimatedImageSource(src)) rafId = requestAnimationFrame(renderFrame)
    }

    img.onload = () => {
      renderFrame()
    }
    img.onerror = () => {
      if (!cancelled) {
        try { onError?.() } catch { ignoreError() }
      }
    }
    img.src = src
    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [src, chromaColor, tolerance, softness, maskShape, maskShapes, onError])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', ...style }} />
}
