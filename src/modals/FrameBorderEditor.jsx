/**
 * FrameBorderEditor.jsx — Frame / Border styling editor for media elements (FluxAura Studio).
 *
 * Renders via React Portal using .modal-backdrop + .modal-box CSS classes.
 *
 * Props:
 *   el        {object}              Element object (clip/mpeg); uses el.frameBorder for initial state
 *   onApply   {(frameBorderData) => void}  Callback with complete frame config
 *   onCancel  {() => void}          Close without saving
 *
 * Named exports:
 *   DEFAULT_FRAME   — default frame configuration (import into stageUtils.js)
 *   FRAME_TEMPLATES — full template library
 *   getFrameCSS     — CSS style object generator (import into App.jsx for canvas/presenter)
 */

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import SmartColorPicker from '../components/SmartColorPicker.tsx'

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT FRAME CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_FRAME = {
  enabled:        true,
  style:          'solid',       // 'solid' | 'gradient' | 'bevel' | 'texture' | 'template'
  widthMode:      'uniform',     // 'uniform' | 'per-side'
  width:          16,            // uniform border width (px)
  widths:         { top: 16, right: 16, bottom: 16, left: 16 },
  color:          '#c8a020',     // uniform color / bevel base
  colors:         { top: '#e8c040', right: '#c8a020', bottom: '#a07010', left: '#c8a020' },
  gradient: {
    top:    ['#e8c040', '#c8a020', '#e8c040'],
    right:  ['#c8a020', '#a07010', '#c8a020'],
    bottom: ['#a07010', '#805010', '#a07010'],
    left:   ['#c8a020', '#a07010', '#c8a020'],
  },
  bevelStyle:     'out',         // 'out' (raised) | 'in' (inset)
  bevelDepth:     6,             // px
  bevelHighlight: '#ffffff',
  bevelShadow:    '#000000',
  textureId:      null,          // one of TEXTURE_IDS or null
  templateId:     null,          // one of FRAME_TEMPLATES[].id or null
  customTexture:  null,          // data URL of user-imported texture
  cornerMode:     'uniform',     // 'uniform' | 'per-corner'
  radius:         0,             // uniform outer corner radius
  radii:          { tl: 0, tr: 0, br: 0, bl: 0 },
  innerShape:     'rect',        // 'rect' | 'rounded' | 'ellipse'
  innerRadius:    0,             // inner corner radius (only for 'rounded')
  opacity:        100,           // 0–100
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXTURE IDS
// ─────────────────────────────────────────────────────────────────────────────

const TEXTURE_IDS = [
  'wood-oak', 'wood-mahogany', 'stone-marble', 'stone-granite',
  'metal-steel', 'metal-gold', 'metal-copper',
]

// ─────────────────────────────────────────────────────────────────────────────
// FRAME TEMPLATES — complete config overrides for each preset
// ─────────────────────────────────────────────────────────────────────────────

/** Shorthand: same 3-stop gradient on all four sides */
const mg = (stops) => ({
  top: [...stops], right: [...stops], bottom: [...stops], left: [...stops],
})

const B = DEFAULT_FRAME  // alias for compact template definitions

export const FRAME_TEMPLATES = [
  // ── Cinema & Film ──────────────────────────────────────────────────────────
  { id: 'cinema-scope',  label: 'Cinemascope',  category: 'Cinema',
    config: { ...B, style: 'solid', widthMode: 'per-side',
      widths: { top: 24, right: 8, bottom: 24, left: 8 },
      colors: { top: '#080808', right: '#181818', bottom: '#080808', left: '#181818' },
      radius: 0 } },

  { id: 'silver-screen', label: 'Silver Screen', category: 'Cinema',
    config: { ...B, style: 'gradient', widthMode: 'per-side',
      widths: { top: 8, right: 22, bottom: 8, left: 22 },
      gradient: {
        top:    ['#0a0a0a', '#181818', '#0a0a0a'],
        bottom: ['#0a0a0a', '#181818', '#0a0a0a'],
        right:  ['#909090', '#d8d8d8', '#909090'],
        left:   ['#909090', '#d8d8d8', '#909090'],
      }, radius: 0 } },

  { id: 'film-strip',    label: 'Film Strip',    category: 'Cinema',
    config: { ...B, style: 'gradient', width: 20,
      gradient: mg(['#3d2408', '#c8a020', '#3d2408']), radius: 0 } },

  { id: 'drive-in',      label: 'Drive-In',      category: 'Cinema',
    config: { ...B, style: 'solid', width: 16, color: '#f0f0f0',
      colors: { top: '#f0f0f0', right: '#f0f0f0', bottom: '#f0f0f0', left: '#f0f0f0' },
      radius: 8 } },

  { id: 'vhs-tape',      label: 'VHS Tape',      category: 'Cinema',
    config: { ...B, style: 'gradient', width: 16,
      gradient: mg(['#2c3137', '#4a5260', '#2c3137']), radius: 0 } },

  // ── Theatre & Stage ────────────────────────────────────────────────────────
  { id: 'red-velvet',      label: 'Red Velvet',      category: 'Theatre',
    config: { ...B, style: 'gradient', width: 20,
      gradient: mg(['#8b0000', '#cc2200', '#8b0000']), radius: 4 } },

  { id: 'gold-proscenium', label: 'Gold Proscenium', category: 'Theatre',
    config: { ...B, style: 'gradient', width: 18,
      gradient: mg(['#d4af37', '#ffd700', '#d4af37']), radius: 2 } },

  { id: 'broadway',        label: 'Broadway',        category: 'Theatre',
    config: { ...B, style: 'gradient', width: 16,
      gradient: mg(['#f0f0f0', '#cc0000', '#ffd700']), radius: 0 } },

  { id: 'spotlight',       label: 'Spotlight',       category: 'Theatre',
    config: { ...B, style: 'gradient', width: 20,
      gradient: mg(['#000000', '#111111', '#ffffff']), radius: 0 } },

  { id: 'royal-box',       label: 'Royal Box',       category: 'Theatre',
    config: { ...B, style: 'bevel', width: 22, color: '#4b0082',
      bevelStyle: 'out', bevelDepth: 8,
      bevelHighlight: '#d4af37', bevelShadow: '#1a0030', radius: 4 } },

  // ── Art Deco ───────────────────────────────────────────────────────────────
  { id: 'art-deco-gold',   label: 'Art Deco Gold',   category: 'Art Deco',
    config: { ...B, style: 'bevel', width: 18, color: '#b8960c',
      bevelStyle: 'out', bevelDepth: 6,
      bevelHighlight: '#ffd700', bevelShadow: '#7a6000', radius: 0 } },

  { id: 'art-deco-silver', label: 'Art Deco Silver', category: 'Art Deco',
    config: { ...B, style: 'gradient', width: 18,
      gradient: mg(['#a8a9ad', '#d4d5d9', '#a8a9ad']), radius: 0 } },

  { id: 'jazz-age',        label: 'Jazz Age',        category: 'Art Deco',
    config: { ...B, style: 'gradient', width: 20,
      gradient: mg(['#0a0a0a', '#d4af37', '#0a0a0a']), radius: 0 } },

  { id: 'sunburst',        label: 'Sunburst',        category: 'Art Deco',
    config: { ...B, style: 'bevel', width: 16, color: '#e8a020',
      bevelStyle: 'out', bevelDepth: 5,
      bevelHighlight: '#f8c040', bevelShadow: '#a05000', radius: 0 } },

  { id: 'manhattan',       label: 'Manhattan',       category: 'Art Deco',
    config: { ...B, style: 'gradient', width: 14,
      gradient: mg(['#f5f0e0', '#ebe0c0', '#f5f0e0']), radius: 0 } },

  // ── Gothic ─────────────────────────────────────────────────────────────────
  { id: 'dark-stone', label: 'Dark Stone', category: 'Gothic',
    config: { ...B, style: 'gradient', width: 24,
      gradient: mg(['#2a2a2a', '#3a3a3a', '#2a2a2a']), radius: 0 } },

  { id: 'iron-gate',  label: 'Iron Gate',  category: 'Gothic',
    config: { ...B, style: 'gradient', width: 20,
      gradient: mg(['#3a3530', '#5a5550', '#3a3530']), radius: 0 } },

  { id: 'cathedral',  label: 'Cathedral',  category: 'Gothic',
    config: { ...B, style: 'gradient', width: 22,
      gradient: mg(['#0a0a3a', '#1a1a5a', '#0a0a3a']), radius: 4 } },

  { id: 'midnight',   label: 'Midnight',   category: 'Gothic',
    config: { ...B, style: 'bevel', width: 18, color: '#050510',
      bevelStyle: 'in', bevelDepth: 6,
      bevelHighlight: '#1a2060', bevelShadow: '#000000', radius: 0 } },

  { id: 'gargoyle',   label: 'Gargoyle',   category: 'Gothic',
    config: { ...B, style: 'gradient', width: 24,
      gradient: mg(['#555555', '#777777', '#555555']), radius: 0 } },

  // ── 3D Bevel ───────────────────────────────────────────────────────────────
  { id: 'gold-bevel-out',   label: 'Gold Raised',   category: 'Bevel',
    config: { ...B, style: 'bevel', width: 16, color: '#d4af37',
      bevelStyle: 'out', bevelDepth: 8,
      bevelHighlight: '#fffacd', bevelShadow: '#7a6000', radius: 0 } },

  { id: 'silver-bevel-out', label: 'Silver Raised', category: 'Bevel',
    config: { ...B, style: 'bevel', width: 16, color: '#c0c0c0',
      bevelStyle: 'out', bevelDepth: 7,
      bevelHighlight: '#ffffff', bevelShadow: '#404040', radius: 0 } },

  { id: 'bronze-bevel',     label: 'Bronze',        category: 'Bevel',
    config: { ...B, style: 'bevel', width: 16, color: '#cd7f32',
      bevelStyle: 'out', bevelDepth: 7,
      bevelHighlight: '#e8b070', bevelShadow: '#5a3000', radius: 0 } },

  { id: 'obsidian-bevel',   label: 'Obsidian',      category: 'Bevel',
    config: { ...B, style: 'bevel', width: 16, color: '#0a0a0a',
      bevelStyle: 'in', bevelDepth: 6,
      bevelHighlight: '#404040', bevelShadow: '#000000', radius: 0 } },

  { id: 'chrome-bevel',     label: 'Chrome',        category: 'Bevel',
    config: { ...B, style: 'bevel', width: 16, color: '#d0d8e0',
      bevelStyle: 'out', bevelDepth: 9,
      bevelHighlight: '#ffffff', bevelShadow: '#303840', radius: 2 } },

  // ── Metallic ───────────────────────────────────────────────────────────────
  { id: 'brushed-steel', label: 'Brushed Steel', category: 'Metal',
    config: { ...B, style: 'gradient', width: 16,
      gradient: mg(['#7a8a9a', '#b8c8d8', '#7a8a9a']), radius: 2 } },

  { id: 'gold-leaf',     label: 'Gold Leaf',     category: 'Metal',
    config: { ...B, style: 'gradient', width: 12,
      gradient: mg(['#c8a020', '#f0d040', '#c8a020']), radius: 0 } },

  { id: 'copper',        label: 'Copper',        category: 'Metal',
    config: { ...B, style: 'gradient', width: 16,
      gradient: mg(['#b87333', '#da8a3a', '#b87333']), radius: 0 } },

  { id: 'gunmetal',      label: 'Gunmetal',      category: 'Metal',
    config: { ...B, style: 'gradient', width: 18,
      gradient: mg(['#2c3137', '#4a5260', '#2c3137']), radius: 0 } },

  { id: 'platinum',      label: 'Platinum',      category: 'Metal',
    config: { ...B, style: 'gradient', width: 12,
      gradient: mg(['#e8e8e8', '#f8f8f8', '#e8e8e8']), radius: 0 } },

  // ── Wood ───────────────────────────────────────────────────────────────────
  { id: 'oak',       label: 'Oak',       category: 'Wood',
    config: { ...B, style: 'gradient', width: 20,
      gradient: mg(['#c19a6b', '#deb887', '#c19a6b']), radius: 2 } },

  { id: 'mahogany',  label: 'Mahogany',  category: 'Wood',
    config: { ...B, style: 'gradient', width: 22,
      gradient: mg(['#4a1c0c', '#8b3a1a', '#4a1c0c']), radius: 2 } },

  { id: 'walnut',    label: 'Walnut',    category: 'Wood',
    config: { ...B, style: 'gradient', width: 20,
      gradient: mg(['#3d2310', '#6b4226', '#3d2310']), radius: 2 } },

  { id: 'driftwood', label: 'Driftwood', category: 'Wood',
    config: { ...B, style: 'gradient', width: 18,
      gradient: mg(['#a89070', '#c0a882', '#a89070']), radius: 4 } },

  { id: 'bamboo',    label: 'Bamboo',    category: 'Wood',
    config: { ...B, style: 'gradient', width: 16,
      gradient: mg(['#c8b560', '#e8d888', '#c8b560']), radius: 0 } },

  // ── Stone ──────────────────────────────────────────────────────────────────
  { id: 'marble-white', label: 'White Marble', category: 'Stone',
    config: { ...B, style: 'gradient', width: 20,
      gradient: mg(['#f0f0f0', '#e0e0e0', '#f0f0f0']), radius: 0 } },

  { id: 'marble-black', label: 'Black Marble', category: 'Stone',
    config: { ...B, style: 'gradient', width: 20,
      gradient: mg(['#1a1a1a', '#2a2a2a', '#1a1a1a']), radius: 0 } },

  { id: 'granite',      label: 'Granite',      category: 'Stone',
    config: { ...B, style: 'gradient', width: 22,
      gradient: mg(['#4a4a4a', '#6a6a6a', '#4a4a4a']), radius: 0 } },

  { id: 'slate',        label: 'Slate',        category: 'Stone',
    config: { ...B, style: 'gradient', width: 20,
      gradient: mg(['#475569', '#64748b', '#475569']), radius: 0 } },

  { id: 'sandstone',    label: 'Sandstone',    category: 'Stone',
    config: { ...B, style: 'gradient', width: 18,
      gradient: mg(['#c2a06a', '#d4b87a', '#c2a06a']), radius: 2 } },

  // ── Neon & Modern ──────────────────────────────────────────────────────────
  { id: 'neon-pink',    label: 'Neon Pink',    category: 'Neon',
    config: { ...B, style: 'solid', width: 8, color: '#ff0090',
      colors: { top: '#ff0090', right: '#ff0090', bottom: '#ff0090', left: '#ff0090' },
      radius: 0 } },

  { id: 'neon-blue',    label: 'Neon Blue',    category: 'Neon',
    config: { ...B, style: 'solid', width: 8, color: '#00e5ff',
      colors: { top: '#00e5ff', right: '#00e5ff', bottom: '#00e5ff', left: '#00e5ff' },
      radius: 0 } },

  { id: 'neon-green',   label: 'Neon Green',   category: 'Neon',
    config: { ...B, style: 'solid', width: 8, color: '#39ff14',
      colors: { top: '#39ff14', right: '#39ff14', bottom: '#39ff14', left: '#39ff14' },
      radius: 0 } },

  { id: 'holographic',  label: 'Holographic',  category: 'Neon',
    config: { ...B, style: 'gradient', width: 12,
      gradient: mg(['#ff0000', '#00ff00', '#0000ff']), radius: 0 } },

  { id: 'glitch',       label: 'Glitch',       category: 'Neon',
    config: { ...B, style: 'gradient', width: 10,
      gradient: {
        top:    ['#ff0000', '#00ff00', '#0000ff'],
        right:  ['#0000ff', '#ff0000', '#00ff00'],
        bottom: ['#00ff00', '#0000ff', '#ff0000'],
        left:   ['#ff0000', '#00ff00', '#0000ff'],
      }, radius: 0 } },
]

const TEMPLATE_CATEGORIES = [...new Set(FRAME_TEMPLATES.map(t => t.category))]

// ─────────────────────────────────────────────────────────────────────────────
// CSS GENERATOR — exported for App.jsx canvas / presenter rendering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a React style object for a frame wrapper div.
 * Apply this to the outer element that wraps the media content.
 *
 * Note: gradient style uses border-image which does not honour border-radius.
 * For rounded gradient frames the App should use the background-padding technique.
 */
export function getFrameCSS(frame) {
  if (!frame?.enabled) return {}

  const {
    style, widthMode, width, widths,
    color, colors, gradient,
    bevelStyle, bevelDepth, bevelHighlight, bevelShadow,
    cornerMode, radius, radii, opacity,
  } = frame

  const wT = widthMode === 'per-side' ? (widths?.top    ?? width) : width
  const wR = widthMode === 'per-side' ? (widths?.right  ?? width) : width
  const wB = widthMode === 'per-side' ? (widths?.bottom ?? width) : width
  const wL = widthMode === 'per-side' ? (widths?.left   ?? width) : width

  const borderRadius = cornerMode === 'per-corner'
    ? `${radii?.tl ?? 0}px ${radii?.tr ?? 0}px ${radii?.br ?? 0}px ${radii?.bl ?? 0}px`
    : `${radius ?? 0}px`

  const opacityVal = (opacity ?? 100) / 100
  let css = { boxSizing: 'border-box', borderRadius, opacity: opacityVal }

  if (style === 'solid') {
    if (widthMode === 'uniform') {
      css = { ...css, border: `${width}px solid ${color}` }
    } else {
      css = {
        ...css,
        borderTopWidth:    `${wT}px`,
        borderRightWidth:  `${wR}px`,
        borderBottomWidth: `${wB}px`,
        borderLeftWidth:   `${wL}px`,
        borderStyle: 'solid',
        borderTopColor:    colors?.top    ?? color,
        borderRightColor:  colors?.right  ?? color,
        borderBottomColor: colors?.bottom ?? color,
        borderLeftColor:   colors?.left   ?? color,
      }
    }

  } else if (style === 'gradient') {
    const g       = gradient ?? {}
    const topStop = (g.top ?? [color, '#ffffff', color]).join(', ')
    css = {
      ...css,
      borderWidth: `${wT}px ${wR}px ${wB}px ${wL}px`,
      borderStyle: 'solid',
      borderColor: 'transparent',
      // border-image paints a uniform gradient; per-side variation visible in preview only
      borderImage: `linear-gradient(to right, ${topStop}) 1`,
    }

  } else if (style === 'bevel') {
    const depth  = bevelDepth ?? 6
    const hi     = bevelHighlight ?? '#ffffff'
    const sh     = bevelShadow   ?? '#000000'
    const raised = bevelStyle !== 'in'
    css = {
      ...css,
      borderWidth: `${wT}px ${wR}px ${wB}px ${wL}px`,
      borderStyle: 'solid',
      borderTopColor:    raised ? hi : sh,
      borderLeftColor:   raised ? hi : sh,
      borderBottomColor: raised ? sh : hi,
      borderRightColor:  raised ? sh : hi,
      boxShadow: raised
        ? `inset ${depth}px ${depth}px ${depth * 2}px rgba(255,255,255,0.18), inset -${depth}px -${depth}px ${depth * 2}px rgba(0,0,0,0.35)`
        : `inset ${depth}px ${depth}px ${depth * 2}px rgba(0,0,0,0.35), inset -${depth}px -${depth}px ${depth * 2}px rgba(255,255,255,0.18)`,
    }

  } else if (style === 'texture') {
    css = {
      ...css,
      borderWidth: `${wT}px ${wR}px ${wB}px ${wL}px`,
      borderStyle: 'solid',
      borderColor: color,
    }
  }

  return css
}

/** Returns a style object for the inner content div (media clip area). */
export function getInnerCSS(frame) {
  const { innerShape, innerRadius } = frame ?? {}
  if (innerShape === 'ellipse')  return { borderRadius: '50%',              overflow: 'hidden' }
  if (innerShape === 'rounded')  return { borderRadius: `${innerRadius ?? 0}px`, overflow: 'hidden' }
  return {}
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS (dark app palette — mirrors App.css variables)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg0:      '#0e0e1c',
  bg1:      '#12121e',
  bg2:      '#1a1a2e',
  bg3:      '#22223a',
  border:   'rgba(60,184,190,0.22)',
  teal:     '#3cb8be',
  text:     '#e8e0d0',
  muted:    '#9090a0',
  accent:   '#4ad8de',
}

// Shared inline-style primitives
const S = {
  row:          { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  label:        { fontSize: 11, color: T.muted, minWidth: 60, textAlign: 'right', userSelect: 'none', flexShrink: 0 },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: T.teal, textTransform: 'uppercase',
                  letterSpacing: '0.08em', margin: '12px 0 5px' },
  btn:          { padding: '3px 9px', borderRadius: 4, border: `1px solid ${T.border}`,
                  background: T.bg3, color: T.text, fontSize: 11, cursor: 'pointer', lineHeight: '18px' },
  btnOn:        { background: T.teal, color: T.bg0, border: `1px solid ${T.teal}`, fontWeight: 700 },
  divider:      { height: 1, background: T.border, margin: '10px 0' },
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

/** Inline colour-picker row: label + SmartColorPicker */
function ColorRow({ label, value, onChange }) {
  const safeVal = typeof value === 'string' ? value : '#888888'
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <SmartColorPicker value={safeVal} onChange={onChange} />
    </div>
  )
}

/** Slider row with numeric readout */
function SliderRow({ label, min, max, value, onChange, unit = 'px', step = 1 }) {
  const safeVal = typeof value === 'number' && isFinite(value) ? value : 0
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={safeVal}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: T.teal, cursor: 'pointer', minWidth: 60 }}
      />
      <span style={{ fontSize: 11, color: T.text, minWidth: 36, textAlign: 'right' }}>
        {safeVal}{unit}
      </span>
    </div>
  )
}

/** Small toggle-button group */
function BtnGroup({ options, value, onChange, small = false }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{ ...S.btn, ...(value === opt.value ? S.btnOn : {}), ...(small ? { fontSize: 10, padding: '2px 7px' } : {}) }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE-SPECIFIC TAB CONTENT
// ─────────────────────────────────────────────────────────────────────────────

/** Solid tab: uniform color OR per-side color pickers */
function SolidControls({ frame, update, updateNested }) {
  const perSide = frame.widthMode === 'per-side'
  const copyTopToAll = () => update({
    color: frame.colors.top,
    colors: { top: frame.colors.top, right: frame.colors.top, bottom: frame.colors.top, left: frame.colors.top },
  })

  return (
    <div>
      <p style={S.sectionTitle}>Color</p>
      {perSide ? (
        <>
          {[['top','Top'], ['right','Right'], ['bottom','Bottom'], ['left','Left']].map(([k, lbl]) => (
            <ColorRow key={k} label={lbl} value={frame.colors[k]}
              onChange={v => updateNested('colors', k, v)} />
          ))}
          <button style={{ ...S.btn, marginTop: 4 }} onClick={copyTopToAll}>
            Copy Top → All Sides
          </button>
        </>
      ) : (
        <ColorRow label="Color" value={frame.color} onChange={v => update({ color: v })} />
      )}
    </div>
  )
}

/** 3-stop gradient editor for a single side */
function GradientStopRow({ side, stops, onChange }) {
  const dirs = { top: 'to right', right: 'to bottom', bottom: 'to right', left: 'to bottom' }
  const preview = `linear-gradient(${dirs[side]}, ${stops.join(',')})`
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: T.muted, marginBottom: 2, textTransform: 'capitalize' }}>{side}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {stops.map((c, i) => (
          <SmartColorPicker
            key={i}
            value={c}
            onChange={v => { const s = [...stops]; s[i] = v; onChange(s) }}
          />
        ))}
        <div style={{ flex: 1, height: 14, borderRadius: 3, background: preview, border: `1px solid ${T.border}` }} />
      </div>
    </div>
  )
}

/** Gradient tab: 3-stop gradient editors for all four sides */
function GradientControls({ frame, update }) {
  const { gradient } = frame
  const updateSide = (side, stops) => update({ gradient: { ...gradient, [side]: stops } })
  const mirrorOpposite = () => update({
    gradient: {
      top:    [...gradient.top],
      bottom: [...gradient.top],
      left:   [...gradient.right],
      right:  [...gradient.right],
    },
  })

  return (
    <div>
      <p style={S.sectionTitle}>Gradient Stops (From · Mid · To)</p>
      {['top', 'right', 'bottom', 'left'].map(side => (
        <GradientStopRow
          key={side} side={side}
          stops={gradient[side] ?? [frame.color, '#ffffff', frame.color]}
          onChange={stops => updateSide(side, stops)}
        />
      ))}
      <button style={{ ...S.btn, marginTop: 4 }} onClick={mirrorOpposite}>
        ↕ Mirror Opposite Sides
      </button>
    </div>
  )
}

/** Bevel tab: direction, depth, highlight/shadow colors */
function BevelControls({ frame, update }) {
  return (
    <div>
      <p style={S.sectionTitle}>Bevel Direction</p>
      <BtnGroup
        options={[{ label: '▲ Raised (Out)', value: 'out' }, { label: '▼ Inset (In)', value: 'in' }]}
        value={frame.bevelStyle}
        onChange={v => update({ bevelStyle: v })}
      />
      <p style={S.sectionTitle}>Depth & Colors</p>
      <SliderRow label="Depth" min={1} max={20} value={typeof frame.bevelDepth === 'number' ? frame.bevelDepth : 6}
        onChange={v => update({ bevelDepth: v })} />
      <ColorRow label="Highlight" value={frame.bevelHighlight}
        onChange={v => update({ bevelHighlight: v })} />
      <ColorRow label="Shadow"    value={frame.bevelShadow}
        onChange={v => update({ bevelShadow: v })} />
      <p style={S.sectionTitle}>Base Color</p>
      <ColorRow label="Color" value={frame.color} onChange={v => update({ color: v })} />
    </div>
  )
}

/** Texture tab: built-in texture chips + custom import */
function TextureControls({ frame, update, fileRef }) {
  const handleImport = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => update({ customTexture: ev.target.result, textureId: 'custom' })
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <p style={S.sectionTitle}>Built-in Textures</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {TEXTURE_IDS.map(tid => (
          <button key={tid}
            onClick={() => update({ textureId: tid, customTexture: null })}
            style={{ ...S.btn, ...(frame.textureId === tid ? S.btnOn : {}), fontSize: 10 }}>
            {tid}
          </button>
        ))}
        <button
          onClick={() => update({ textureId: 'custom' })}
          style={{ ...S.btn, ...(frame.textureId === 'custom' ? S.btnOn : {}), fontSize: 10 }}>
          custom
        </button>
      </div>
      <button style={S.btn} onClick={() => fileRef.current?.click()}>
        📂 Import Custom Texture
      </button>
      <input ref={fileRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleImport} />
      <p style={S.sectionTitle}>Tint</p>
      <ColorRow label="Tint Color" value={frame.color} onChange={v => update({ color: v })} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WIDTH CONTROLS (left panel)
// ─────────────────────────────────────────────────────────────────────────────

function WidthControls({ frame, update, updateNested }) {
  const perSide = frame.widthMode === 'per-side'
  return (
    <div>
      <p style={{ ...S.sectionTitle, marginTop: 0 }}>Border Width</p>
      <div style={S.row}>
        <span style={S.label}>Mode</span>
        <BtnGroup small
          options={[{ label: 'Uniform', value: 'uniform' }, { label: 'Per-Side', value: 'per-side' }]}
          value={frame.widthMode}
          onChange={v => update({ widthMode: v })}
        />
      </div>
      {perSide
        ? ['top', 'right', 'bottom', 'left'].map(side => (
            <SliderRow key={side}
              label={side.charAt(0).toUpperCase() + side.slice(1)}
              min={0} max={80}
              value={typeof (frame.widths?.[side]) === 'number' ? frame.widths[side] : (typeof frame.width === 'number' ? frame.width : 16)}
              onChange={v => updateNested('widths', side, v)} />
          ))
        : <SliderRow label="Width" min={0} max={80} value={typeof frame.width === 'number' ? frame.width : 16}
            onChange={v => update({ width: v })} />
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CORNER & INNER SHAPE CONTROLS (left panel)
// ─────────────────────────────────────────────────────────────────────────────

function CornerControls({ frame, update, updateNested }) {
  const perCorner = frame.cornerMode === 'per-corner'
  return (
    <div>
      <p style={S.sectionTitle}>Outer Corners</p>
      <div style={S.row}>
        <span style={S.label}>Mode</span>
        <BtnGroup small
          options={[{ label: 'Uniform', value: 'uniform' }, { label: 'Per-Corner', value: 'per-corner' }]}
          value={frame.cornerMode}
          onChange={v => update({ cornerMode: v })}
        />
      </div>
      {perCorner
        ? [['tl','Top-Left'], ['tr','Top-Right'], ['br','Bot-Right'], ['bl','Bot-Left']].map(([key, lbl]) => (
            <SliderRow key={key} label={lbl} min={0} max={100}
              value={typeof frame.radii?.[key] === 'number' ? frame.radii[key] : 0}
              onChange={v => updateNested('radii', key, v)} />
          ))
        : <SliderRow label="Radius" min={0} max={100} value={typeof frame.radius === 'number' ? frame.radius : 0}
            onChange={v => update({ radius: v })} />
      }

      <p style={S.sectionTitle}>Inner Shape</p>
      <div style={{ ...S.row, marginBottom: 6 }}>
        <span style={S.label}>Shape</span>
        <BtnGroup small
          options={[
            { label: 'Rect',    value: 'rect'    },
            { label: 'Rounded', value: 'rounded' },
            { label: 'Ellipse', value: 'ellipse' },
          ]}
          value={frame.innerShape}
          onChange={v => update({ innerShape: v })}
        />
      </div>
      {frame.innerShape === 'rounded' && (
        <SliderRow label="Inner R" min={0} max={100} value={typeof frame.innerRadius === 'number' ? frame.innerRadius : 0}
          onChange={v => update({ innerRadius: v })} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE SWATCH — 60×42 mini-preview of a template
// ─────────────────────────────────────────────────────────────────────────────

function TemplateSwatch({ tpl, isSelected, onClick }) {
  // Scale width down for the miniature preview so it looks proportional
  const scale = 1 / 3.5
  const mini = {
    ...tpl.config,
    width:      Math.max(2, Math.round((tpl.config.width ?? 16) * scale)),
    widths:     Object.fromEntries(
      Object.entries(tpl.config.widths ?? DEFAULT_FRAME.widths)
        .map(([k, v]) => [k, Math.max(2, Math.round(v * scale))])
    ),
    radius:     Math.round((tpl.config.radius    ?? 0) / 2),
    bevelDepth: Math.max(1, Math.round((tpl.config.bevelDepth ?? 6) * scale)),
    opacity:    100,
  }
  const css = getFrameCSS(mini)

  return (
    <div
      title={tpl.label}
      onClick={onClick}
      style={{
        width: 64, height: 46, cursor: 'pointer', flexShrink: 0,
        borderRadius: 4,
        outline: isSelected ? `2px solid ${T.teal}` : `1px solid ${T.border}`,
        outlineOffset: isSelected ? 2 : 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a18',
        overflow: 'hidden',
        transition: 'outline 0.1s, transform 0.1s',
        transform: isSelected ? 'scale(1.06)' : 'scale(1)',
      }}
    >
      {/* Mini frame ring around a tiny media placeholder */}
      <div style={{
        ...css,
        width: 56, height: 38,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, #252535 0%, #353545 100%)',
        }} />
      </div>
      <div style={{
        fontSize: 8, color: T.muted, position: 'absolute', bottom: 2,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: 60, textAlign: 'center', lineHeight: 1,
      }}>
        {tpl.label}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE GALLERY — category filter + swatch grid
// ─────────────────────────────────────────────────────────────────────────────

function TemplateGallery({ frame, onSelect }) {
  const [cat, setCat] = useState(TEMPLATE_CATEGORIES[0])
  const visible = FRAME_TEMPLATES.filter(t => t.category === cat)

  return (
    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 12 }}>
      <p style={{ ...S.sectionTitle, marginTop: 0 }}>Template Gallery</p>

      {/* Category filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
        {TEMPLATE_CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ ...S.btn, ...(cat === c ? S.btnOn : {}), padding: '2px 7px', fontSize: 10 }}>
            {c}
          </button>
        ))}
      </div>

      {/* Swatch grid */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
        maxHeight: 130, overflowY: 'auto',
        paddingBottom: 4, paddingRight: 2,
      }}>
        {visible.map(tpl => (
          <TemplateSwatch
            key={tpl.id}
            tpl={tpl}
            isSelected={frame.templateId === tpl.id}
            onClick={() => onSelect(tpl)}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE PREVIEW — 320×200 frame preview with checkerboard + media placeholder
// ─────────────────────────────────────────────────────────────────────────────

function FramePreview({ frame }) {
  const outerCss = getFrameCSS(frame)
  const innerCss = getInnerCSS(frame)

  const W = 260, H = 163  // 16:10 proxy; real media aspect handled by the canvas
  const wT = frame.widthMode === 'per-side' ? (frame.widths?.top    ?? frame.width) : frame.width
  const wR = frame.widthMode === 'per-side' ? (frame.widths?.right  ?? frame.width) : frame.width
  const wB = frame.widthMode === 'per-side' ? (frame.widths?.bottom ?? frame.width) : frame.width
  const wL = frame.widthMode === 'per-side' ? (frame.widths?.left   ?? frame.width) : frame.width

  const totalW = W + wL + wR
  const totalH = H + wT + wB

  const outerRadius = frame.cornerMode === 'per-corner'
    ? `${frame.radii?.tl ?? 0}px ${frame.radii?.tr ?? 0}px ${frame.radii?.br ?? 0}px ${frame.radii?.bl ?? 0}px`
    : `${frame.radius ?? 0}px`

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 8px 8px',
      background: T.bg0, borderRadius: 6,
      border: `1px solid ${T.border}`,
    }}>
      <div style={{ fontSize: 10, color: T.muted, marginBottom: 8, letterSpacing: '0.05em' }}>
        LIVE PREVIEW
      </div>

      {/* Checkerboard outer wrapper (shows transparency) */}
      <div style={{
        width: totalW, height: totalH,
        background: 'repeating-conic-gradient(#262636 0% 25%, #1a1a28 0% 50%) 0 0 / 12px 12px',
        borderRadius: outerRadius,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {/* Frame wrapper — receives the generated CSS border */}
        <div style={{ ...outerCss, width: '100%', height: '100%', display: 'flex', alignItems: 'stretch' }}>
          {/* Media placeholder */}
          <div style={{
            ...innerCss,
            flex: 1,
            background: 'linear-gradient(135deg, #1e2040 0%, #2a2a50 45%, #1e2040 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', userSelect: 'none', letterSpacing: '0.05em' }}>
              ▶ media
            </span>
          </div>
        </div>
      </div>

      {/* Readout bar */}
      <div style={{ fontSize: 9, color: T.muted, marginTop: 6, display: 'flex', gap: 12 }}>
        <span>{W}×{H}</span>
        <span>border: {frame.widthMode === 'uniform' ? `${frame.width}px` : `T${wT}/R${wR}/B${wB}/L${wL}`}</span>
        <span>style: {frame.style}</span>
        <span>opacity: {frame.opacity ?? 100}%</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_TABS = ['solid', 'gradient', 'bevel', 'texture', 'templates']

export default function FrameBorderEditor({ el, onApply, onCancel }) {
  const [frame, setFrame] = useState(() => {
    const base = { ...DEFAULT_FRAME, ...(el?.frameBorder ?? {}) }
    // ── Type-safe helpers ─────────────────────────────────────────────────────
    const toNum = (v, fb) => (typeof v === 'number' && isFinite(v) ? v : fb)
    const toStr = (v, fb) => (typeof v === 'string' && v.length > 0 ? v : fb)
    const toArr = (v, fb) => (Array.isArray(v) ? v : fb)
    // ── Scalar numbers ────────────────────────────────────────────────────────
    base.width       = toNum(base.width,       DEFAULT_FRAME.width)
    base.bevelDepth  = toNum(base.bevelDepth,  DEFAULT_FRAME.bevelDepth)
    base.radius      = toNum(base.radius,      DEFAULT_FRAME.radius)
    base.innerRadius = toNum(base.innerRadius, DEFAULT_FRAME.innerRadius)
    base.opacity     = toNum(base.opacity,     DEFAULT_FRAME.opacity)
    // ── Scalar strings (color swatches) ───────────────────────────────────────
    base.color         = toStr(base.color,         DEFAULT_FRAME.color)
    base.bevelHighlight= toStr(base.bevelHighlight, DEFAULT_FRAME.bevelHighlight)
    base.bevelShadow   = toStr(base.bevelShadow,    DEFAULT_FRAME.bevelShadow)
    // ── Per-side widths { top, right, bottom, left } — all numbers ────────────
    if (!base.widths || typeof base.widths !== 'object' || Array.isArray(base.widths)) {
      base.widths = { top: base.width, right: base.width, bottom: base.width, left: base.width }
    } else {
      ;['top', 'right', 'bottom', 'left'].forEach(s => { base.widths[s] = toNum(base.widths[s], base.width) })
    }
    // ── Per-side colors { top, right, bottom, left } — all strings ────────────
    if (!base.colors || typeof base.colors !== 'object' || Array.isArray(base.colors)) {
      base.colors = { top: base.color, right: base.color, bottom: base.color, left: base.color }
    } else {
      ;['top', 'right', 'bottom', 'left'].forEach(s => { base.colors[s] = toStr(base.colors[s], base.color) })
    }
    // ── Gradient { top, right, bottom, left } — each an array of 3 strings ───
    const dg = DEFAULT_FRAME.gradient
    if (!base.gradient || typeof base.gradient !== 'object' || Array.isArray(base.gradient)) {
      base.gradient = { ...dg }
    } else {
      ;['top', 'right', 'bottom', 'left'].forEach(s => {
        base.gradient[s] = toArr(base.gradient[s], dg[s])
        base.gradient[s] = base.gradient[s].map((c, i) => toStr(c, dg[s][i] ?? '#888888'))
      })
    }
    // ── Per-corner radii { tl, tr, br, bl } — all numbers ─────────────────────
    if (!base.radii || typeof base.radii !== 'object' || Array.isArray(base.radii)) {
      base.radii = { tl: base.radius, tr: base.radius, br: base.radius, bl: base.radius }
    } else {
      ;['tl', 'tr', 'br', 'bl'].forEach(s => { base.radii[s] = toNum(base.radii[s], base.radius) })
    }
    return base
  })

  // Active style tab — initialise from existing config, fall back to 'solid'
  const [activeTab, setActiveTab] = useState(() => {
    const s = el?.frameBorder?.style
    return STYLE_TABS.includes(s) ? s : 'solid'
  })

  const fileRef = useRef(null)

  const update       = useCallback((patch) => setFrame(f => ({ ...f, ...patch })), [])
  const updateNested = useCallback((key, subKey, val) =>
    setFrame(f => ({ ...f, [key]: { ...f[key], [subKey]: val } })), [])

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab)
    if (tab !== 'templates') {
      update({ style: tab })
    }
  }, [update])

  const handleTemplateSelect = useCallback((tpl) => {
    const s = tpl.config.style
    setFrame({ ...tpl.config, templateId: tpl.id })
    setActiveTab(STYLE_TABS.includes(s) ? s : 'solid')
  }, [])

  const handleApply = () => onApply({ ...frame })

  // ── Layout styles ──────────────────────────────────────────────────────────

  const panelLeft = {
    width: 260, flexShrink: 0,
    padding: '10px 14px',
    overflowY: 'auto',
    borderRight: `1px solid ${T.border}`,
    background: T.bg1,
    display: 'flex', flexDirection: 'column',
  }

  const panelRight = {
    flex: 1,
    padding: '12px 14px',
    overflowY: 'auto',
    background: T.bg0,
    display: 'flex', flexDirection: 'column',
    minWidth: 0,
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const content = (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        style={{ width: 860, maxWidth: '96vw', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <h3>🖼 Frame / Border Editor</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.text, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox" checked={frame.enabled}
                onChange={e => update({ enabled: e.target.checked })}
                style={{ accentColor: T.teal }}
              />
              Enabled
            </label>
            <button
              onClick={onCancel}
              className="modal-close"
              style={{ background: 'none', border: 'none', color: T.muted, fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Style Tabs ── */}
        <div style={{
          display: 'flex', gap: 2, padding: '8px 14px 0',
          background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0,
        }}>
          {STYLE_TABS.map(tab => {
            const active = activeTab === tab
            return (
              <button key={tab} onClick={() => handleTabChange(tab)} style={{
                padding: '5px 14px', fontSize: 12, cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                border: `1px solid ${active ? T.border : 'transparent'}`,
                borderBottom: active ? `1px solid ${T.bg1}` : `1px solid ${T.border}`,
                background: active ? T.bg1 : 'transparent',
                color: active ? T.teal : T.muted,
                fontWeight: active ? 700 : 400,
                textTransform: 'capitalize',
                marginBottom: -1,
              }}>
                {tab}
              </button>
            )
          })}
        </div>

        {/* ── Body ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* Left panel — width, opacity, corners (always visible) */}
          <div style={panelLeft}>
            <WidthControls frame={frame} update={update} updateNested={updateNested} />
            <div style={S.divider} />
            <SliderRow
              label="Opacity" min={0} max={100} value={typeof frame.opacity === 'number' ? frame.opacity : 100}
              onChange={v => update({ opacity: v })} unit="%" />
            <div style={S.divider} />
            <CornerControls frame={frame} update={update} updateNested={updateNested} />
          </div>

          {/* Right panel — tab content + live preview + template gallery */}
          <div style={panelRight}>

            {/* Style-specific controls */}
            {activeTab === 'solid' && (
              <SolidControls frame={frame} update={update} updateNested={updateNested} />
            )}
            {activeTab === 'gradient' && (
              <GradientControls frame={frame} update={update} />
            )}
            {activeTab === 'bevel' && (
              <BevelControls frame={frame} update={update} />
            )}
            {activeTab === 'texture' && (
              <TextureControls frame={frame} update={update} fileRef={fileRef} />
            )}
            {activeTab === 'templates' && (
              <p style={{ ...S.sectionTitle, marginTop: 0 }}>
                Click any swatch below to load that template
              </p>
            )}

            {/* Live preview — always visible */}
            <div style={{ marginTop: 14 }}>
              <FramePreview frame={frame} />
            </div>

            {/* Template gallery — always visible at bottom */}
            <TemplateGallery frame={frame} onSelect={handleTemplateSelect} />
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10, padding: '10px 16px',
          borderTop: `1px solid ${T.border}`,
          background: T.bg1, flexShrink: 0,
        }}>
          <button onClick={onCancel} style={{ ...S.btn, padding: '5px 18px', fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={handleApply} style={{ ...S.btn, ...S.btnOn, padding: '5px 22px', fontSize: 13 }}>
            ✓ Apply
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
