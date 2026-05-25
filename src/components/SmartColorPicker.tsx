import { type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import {
  getRecentColors, pushRecentColor, getSavedColors, getSavedPalettes,
  savePalette, deletePalette, saveNamedColor, deleteNamedColor, extractColorsFromImage,
} from '../utils/colorUtils.js'

/* ─── RGBA helpers ─────────────────────────────────────────────────────── */

/** Normalize any hex (#RGB #RGBA #RRGGBB #RRGGBBAA) → [r,g,b,a 0-255] */
function hexToRgba(hex: string): [number,number,number,number] {
  let h = (hex || '').replace('#', '')
  if (h.length === 3)      h = h.split('').map(c => c+c).join('') + 'ff'
  else if (h.length === 4) h = h.split('').map(c => c+c).join('')
  else if (h.length === 6) h = h + 'ff'
  else if (h.length !== 8) h = '000000ff'
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16)
  const b = parseInt(h.slice(4,6),16), a = parseInt(h.slice(6,8),16)
  return [
    isNaN(r)?0:r, isNaN(g)?0:g, isNaN(b)?0:b, isNaN(a)?255:a
  ]
}

/** [r,g,b,a] → #RRGGBB (opaque) or #RRGGBBAA */
function rgbaToHex(r:number,g:number,b:number,a:number): string {
  const h = (n:number) => Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')
  return a === 255 ? `#${h(r)}${h(g)}${h(b)}` : `#${h(r)}${h(g)}${h(b)}${h(a)}`
}

/** CSS background for a swatch — checkerboard under the colour for transparency */
function swatchBg(hex: string): string {
  const [r,g,b,a] = hexToRgba(hex)
  const rgba = `rgba(${r},${g},${b},${a/255})`
  if (a === 255) return rgba
  return `linear-gradient(${rgba},${rgba}),
    repeating-conic-gradient(#888 0% 25%,#ccc 0% 50%) 0 0/8px 8px`
}

/* ─── SmartColorPicker ─────────────────────────────────────────────────── */
export default function SmartColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })
  const [tab, setTab] = useState('recent')
  const [recent, setRecent] = useState(() => getRecentColors())
  const [saved, setSaved] = useState(() => getSavedColors())
  const [palettes, setPalettes] = useState(() => getSavedPalettes())
  const [saveName, setSaveName] = useState('')
  const [palName, setPalName] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [hexInput, setHexInput] = useState('')
  const [hexErr, setHexErr] = useState(false)
  const [prevValue, setPrevValue] = useState(value)
  const wrapRef = useRef(null)
  const panelRef = useRef(null)
  const nativeRef = useRef(null)
  const alphaTrackRef = useRef<HTMLDivElement | null>(null)
  const currentDotRef = useRef<HTMLSpanElement | null>(null)
  const triggerSwatchRef = useRef<HTMLSpanElement | null>(null)
  const PANEL_W = 220
  const PANEL_H = 300

  // Decompose current value
  const [cr,cg,cb,ca] = hexToRgba(value)
  const rgbHex = `#${[cr,cg,cb].map(n=>n.toString(16).padStart(2,'0')).join('')}`
  const fullHex = rgbaToHex(cr,cg,cb,ca)

  // Sync hex input when value changes externally (e.g. swatch click)
  if (value !== prevValue) {
    setPrevValue(value)
    setHexInput(fullHex)
    setHexErr(false)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (
        (wrapRef.current && wrapRef.current.contains(e.target)) ||
        (panelRef.current && panelRef.current.contains(e.target))
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function computePos() {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = rect.left
    if (left + PANEL_W > vw - 8) left = Math.max(8, rect.right - PANEL_W)
    let top = rect.bottom + 4
    if (top + PANEL_H > vh - 8) top = Math.max(8, rect.top - PANEL_H - 4)
    setPanelPos({ top, left })
  }

  useEffect(() => {
    if (!open) return
    const handler = () => computePos()
    window.addEventListener('resize', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [open])

  useEffect(() => {
    if (!panelRef.current) return
    panelRef.current.style.top = `${panelPos.top}px`
    panelRef.current.style.left = `${panelPos.left}px`
  }, [panelPos.top, panelPos.left, open])

  useEffect(() => {
    if (!alphaTrackRef.current) return
    alphaTrackRef.current.style.setProperty('--scp-rgb', `${cr},${cg},${cb}`)
  }, [cr, cg, cb])

  useEffect(() => {
    if (currentDotRef.current) currentDotRef.current.style.background = swatchBg(fullHex)
    if (triggerSwatchRef.current) triggerSwatchRef.current.style.background = swatchBg(fullHex)
  }, [fullHex])

  function setDotBg(el: HTMLSpanElement | null, hex: string) {
    if (!el) return
    el.style.background = swatchBg(hex)
  }

  function openPanel() {
    setRecent(getRecentColors())
    setSaved(getSavedColors())
    setPalettes(getSavedPalettes())
    setHexInput(fullHex)
    setHexErr(false)
    computePos()
    setOpen(true)
  }

  function pick(hex: string) {
    onChange(hex)
    setHexInput(hex)
    setHexErr(false)
    pushRecentColor(hex)
    setRecent(getRecentColors())
  }

  function handleNativeChange(e) {
    // native input only gives #RRGGBB — keep existing alpha
    const [,,, a] = hexToRgba(value)
    const [r,g,b] = hexToRgba(e.target.value)
    pick(rgbaToHex(r,g,b,a))
  }

  function handleAlpha(e) {
    const a = Math.round((parseFloat(e.target.value) / 100) * 255)
    pick(rgbaToHex(cr,cg,cb,a))
  }

  function handleHexInput(e) {
    const v = e.target.value
    setHexInput(v)
    const cleaned = v.trim()
    const valid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(cleaned)
    setHexErr(!valid && cleaned.length > 1)
    if (valid) pick(cleaned)
  }

  function handleHexKey(e) {
    if (e.key === 'Enter') { e.target.blur(); setOpen(false) }
  }

  function handleSaveColor() {
    const name = saveName.trim() || fullHex
    saveNamedColor(name, fullHex)
    setSaved(getSavedColors())
    setSaveName('')
  }

  function handleDelColor(id) {
    deleteNamedColor(id)
    setSaved(getSavedColors())
  }

  function handleSavePalette() {
    const name = palName.trim()
    if (!name) return
    const colors = [...recent].slice(0, 8)
    savePalette(name, colors)
    setPalettes(getSavedPalettes())
    setPalName('')
  }

  function handleDelPalette(id) {
    deletePalette(id)
    setPalettes(getSavedPalettes())
  }

  async function handleExtract(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    const colors = await extractColorsFromImage(file, 16)
    setExtracting(false)
    if (colors.length) {
      const name = file.name.replace(/\.[^.]+$/, '') + ' palette'
      savePalette(name, colors)
      setPalettes(getSavedPalettes())
      setTab('palettes')
    }
  }

  const alphaPct = Math.round((ca / 255) * 100)

  const panel = open ? (
    <div
      ref={panelRef}
      className="scp-panel"
    >
      {/* Tabs */}
      <div className="scp-tabs">
        {[['recent','🕐 Recent'],['saved','⭐ Saved'],['palettes','🎨 Palettes']].map(([k,l]) => (
          <button key={k} className={`scp-tab${tab===k?' scp-tab-active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'recent' && (
        <div>
          {/* Transparent quick-pick */}
          <div className="scp-row scp-row-mb6">
            <span
              className="scp-dot scp-transparent-dot"
              title="Transparent (#00000000)"
              onClick={() => { pick('#00000000'); setOpen(false) }}
            />
            <span className="scp-transparent-label">Transparent</span>
          </div>
          <div className="scp-swatches">
            {recent.length === 0 && <span className="scp-empty">No recent colours yet</span>}
            {recent.map((c, i) => (
              <span key={i} ref={(el) => setDotBg(el, c)} className="scp-dot scp-transparent-bg" title={c} onClick={() => { pick(c); setOpen(false) }} />
            ))}
          </div>
          <div className="scp-row">
            <input className="scp-name-input" placeholder="Name this colour…" value={saveName} onChange={e => setSaveName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveColor()} />
            <button className="scp-action-btn" onClick={handleSaveColor} title="Save current colour">⭐ Save</button>
          </div>
        </div>
      )}

      {tab === 'saved' && (
        <div>
          <div className="scp-swatches scp-saved-list">
            {saved.length === 0 && <span className="scp-empty">No saved colours yet</span>}
            {saved.map(sc => (
              <span key={sc.id} className="scp-saved-item" title={`${sc.name}\n${sc.hex}`}>
                <span ref={(el) => setDotBg(el, sc.hex)} className="scp-dot scp-dot-lg scp-transparent-bg" onClick={() => { pick(sc.hex); setOpen(false) }} />
                <span className="scp-saved-name" onClick={() => { pick(sc.hex); setOpen(false) }}>{sc.name}</span>
                <button className="scp-del" onClick={() => handleDelColor(sc.id)}>✕</button>
              </span>
            ))}
          </div>
          <div className="scp-row">
            <input className="scp-name-input" placeholder="Name for current colour…" value={saveName} onChange={e => setSaveName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveColor()} />
            <button className="scp-action-btn" onClick={handleSaveColor}>⭐ Save</button>
          </div>
        </div>
      )}

      {tab === 'palettes' && (
        <div>
          {palettes.map(pal => (
            <div key={pal.id} className="scp-palette">
              <div className="scp-pal-head">
                <span className="scp-pal-name">{pal.name}</span>
                <button className="scp-del" onClick={() => handleDelPalette(pal.id)}>✕</button>
              </div>
              <div className="scp-swatches">
                {pal.colors.map((c, i) => (
                  <span key={i} ref={(el) => setDotBg(el, c)} className="scp-dot scp-transparent-bg" title={c} onClick={() => { pick(c); setOpen(false) }} />
                ))}
              </div>
            </div>
          ))}
          {palettes.length === 0 && <span className="scp-empty">No palettes saved yet</span>}
          <div className="scp-row scp-row-mt6">
            <input className="scp-name-input" placeholder="Palette name…" value={palName} onChange={e => setPalName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSavePalette()} />
            <button className="scp-action-btn" onClick={handleSavePalette} title="Save recent colours as palette">＋ Save</button>
          </div>
          <label className="scp-extract-btn" title="Extract colour palette from an image">
            {extracting ? '⏳ Extracting…' : '🖼 From image…'}
            <input type="file" accept="image/*" className="scp-file-input" onChange={handleExtract} />
          </label>
        </div>
      )}

      {/* Current colour + hex input + alpha + native picker access */}
      <div className="scp-current">
        <span ref={currentDotRef} className="scp-dot scp-dot-lg scp-transparent-bg" />
        <input
          className={`scp-hex-input${hexErr ? ' scp-hex-err' : ''}`}
          value={hexInput}
          onChange={handleHexInput}
          onKeyDown={handleHexKey}
          spellCheck={false}
          title="Type a hex colour: #RRGGBB or #RRGGBBAA"
          maxLength={9}
        />
        <span className="scp-alpha-pct" title={`Alpha: ${alphaPct}%`}>{alphaPct}%</span>
        <button
          className="scp-action-btn scp-wheel-btn"
          title="Open colour wheel"
          onClick={() => nativeRef.current?.click()}
        >🎨</button>
      </div>
      {/* Alpha slider */}
      <div className="scp-alpha-row">
        <span className="scp-alpha-label">α</span>
        <div ref={alphaTrackRef} className="scp-alpha-track scp-transparent-bg">
          <input
            type="range" min={0} max={100} value={alphaPct}
            className="scp-alpha-slider"
            onChange={handleAlpha}
            title={`Opacity: ${alphaPct}%`}
          />
        </div>
      </div>
    </div>
  ) : null

  return (
    <span className="scp-wrap" ref={wrapRef}>
      {/* Colour swatch — click to open panel (with alpha/transparent support) */}
      <span
        ref={triggerSwatchRef}
        className="scp-swatch scp-transparent-bg"
        onClick={() => open ? setOpen(false) : openPanel()}
        title={`${fullHex} — click to edit`}
      />
      {/* Hidden native picker — accessible via 🎨 button inside the panel */}
      <input
        ref={nativeRef}
        type="color"
        value={rgbHex}
        onChange={handleNativeChange}
        className="scp-native"
        aria-label="Native color picker"
        title="Native color picker"
        onBlur={() => pushRecentColor(fullHex)}
      />
      {/* Dropdown toggle */}
      <button
        className={`scp-toggle${open ? ' scp-toggle-open' : ''}`}
        onClick={() => open ? setOpen(false) : openPanel()}
        title="Recent colours &amp; palettes"
      >▾</button>
      {open && createPortal(panel, document.body)}
    </span>
  )
}
