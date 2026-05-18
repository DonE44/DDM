import { type MouseEvent, useEffect, useRef, useState } from 'react'

export default function PngButtonEditor({ imageUrl, initialTextAnchor, onApply, onClose }) {
  const canvasRef = useRef(null)
  const wrapRef   = useRef(null)
  const [origData,   setOrigData]   = useState(null)
  const [threshold,  setThreshold]  = useState(30)
  const [wandMode,   setWandMode]   = useState(true)
  const [textPos,    setTextPos]    = useState(initialTextAnchor || { x: 50, y: 50 })
  const [dragging,   setDragging]   = useState(false)
  const [status,     setStatus]     = useState('Click the background colour to remove it (magic wand)')

  useEffect(() => {
    if (!imageUrl) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      setOrigData(ctx.getImageData(0, 0, canvas.width, canvas.height))
      setStatus('Click background to remove — adjust Threshold slider as needed')
    }
    img.onerror = () => setStatus('⚠ Could not load image (CORS / local path restriction)')
    img.src = imageUrl
  }, [imageUrl])

  function floodFill(imgData, sx, sy, tol) {
    const { data, width, height } = imgData
    const idx = (y, x) => (y * width + x) * 4
    const si = idx(sy, sx)
    const [sR, sG, sB] = [data[si], data[si + 1], data[si + 2]]
    const match = (i) => Math.abs(data[i] - sR) + Math.abs(data[i + 1] - sG) + Math.abs(data[i + 2] - sB) <= tol * 3
    const visited = new Uint8Array(width * height)
    const q = [[sx, sy]]
    while (q.length) {
      const [cx, cy] = q.pop()
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue
      const vi = cy * width + cx
      if (visited[vi]) continue
      visited[vi] = 1
      const pi = idx(cy, cx)
      if (!match(pi)) continue
      data[pi + 3] = 0
      q.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1])
    }
  }

  function handleCanvasClick(e: MouseEvent<HTMLCanvasElement>) {
    if (!wandMode || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const sx = Math.floor((e.clientX - rect.left) * (canvas.width  / rect.width))
    const sy = Math.floor((e.clientY - rect.top)  * (canvas.height / rect.height))
    const ctx = canvas.getContext('2d')
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    floodFill(imgData, sx, sy, threshold)
    ctx.putImageData(imgData, 0, 0)
    setStatus('Background removed — click again to refine, or adjust Threshold and Reset')
  }

  function resetCanvas() {
    if (!origData || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.putImageData(origData, 0, 0)
    setStatus('Reset — click background to remove again')
  }

  function applyResult() {
    if (!canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onApply(dataUrl, { x: textPos.x, y: textPos.y })
  }

  /* Draggable text anchor handle */
  function handleHandleMouseDown(e) {
    e.stopPropagation()
    setDragging(true)
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const wrap = wrapRef.current
      if (!wrap) return
      const r = wrap.getBoundingClientRect()
      const x = Math.max(5, Math.min(95, Math.round(((e.clientX - r.left) / r.width)  * 100)))
      const y = Math.max(5, Math.min(95, Math.round(((e.clientY - r.top)  / r.height) * 100)))
      setTextPos({ x, y })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  return (
    <div className="pngedit-overlay" onClick={onClose}>
      <div className="pngedit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pngedit-header">
          <span>PNG Button Editor</span>
          <button className="btn-editor-close" onClick={onClose}>✕</button>
        </div>

        <div className="pngedit-toolbar">
          <button className={wandMode ? 'on' : ''} onClick={() => setWandMode(!wandMode)}>🪄 Magic Wand {wandMode ? 'ON' : 'OFF'}</button>
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            Threshold: <input type="range" min="5" max="150" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} style={{ flex: 1 }} /> <span style={{ minWidth: 24 }}>{threshold}</span>
          </label>
          <button onClick={resetCanvas}>↺ Reset</button>
        </div>

        <div className="pngedit-status">{status}</div>

        <div className="pngedit-canvas-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{ cursor: wandMode ? 'crosshair' : 'default', maxWidth: '100%', maxHeight: 340, display: 'block', background: 'repeating-conic-gradient(#888 0% 25%,#ccc 0% 50%) 0/12px 12px' }}
          />
          {/* Draggable text position handle */}
          <div
            className="pngedit-text-handle"
            style={{ left: `${textPos.x}%`, top: `${textPos.y}%` }}
            onMouseDown={handleHandleMouseDown}
            title="Drag to reposition button label"
          >T</div>
        </div>

        <div className="pngedit-hint">
          Drag the <strong>T</strong> marker to set where the button label appears · {textPos.x}%, {textPos.y}%
        </div>

        <div className="pngedit-footer">
          <button onClick={onClose}>Cancel</button>
          <button className="btn-ed-confirm" onClick={applyResult}>✓ Apply to Button</button>
        </div>
      </div>
    </div>
  )
}
