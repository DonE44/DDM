// @ts-check
import { useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import MenuBarElement from '../components/MenuBarElement.jsx'
import { MENU_BAR_TEMPLATES, getMenuBarTemplatesByPosition } from '../utils/menuBarTemplates.js'
import SmartColorPicker from '../components/SmartColorPicker.tsx'
import FontPicker from '../components/FontPicker.jsx'
import ChromaKeyModal from './ChromaKeyModal.jsx'

// ─── Styles ────────────────────────────────────────────────────────────────────

const backdrop = /** @type {import('react').CSSProperties} */ ({
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 10000,
})
const box = /** @type {import('react').CSSProperties} */ ({
  background: '#1a1a2e', color: '#e0e0e0', border: '1px solid #333',
  borderRadius: 8, width: 900, maxWidth: '95vw', maxHeight: '90vh',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
})
const toolbar = /** @type {import('react').CSSProperties} */ ({
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 14px', borderBottom: '1px solid #333',
  background: '#12122a', flexShrink: 0, flexWrap: 'wrap',
})
const tabBtn = (active) => ({
  padding: '5px 14px', borderRadius: 4, cursor: 'pointer',
  border: 'none', fontSize: 13, fontWeight: 600,
  background: active ? '#e94560' : '#252540',
  color: active ? '#fff' : '#aaa',
})
const posBtn = (active) => ({
  padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
  border: `1px solid ${active ? '#e94560' : '#444'}`,
  background: active ? 'rgba(233,69,96,0.2)' : 'transparent',
  color: active ? '#e94560' : '#aaa', fontSize: 12, fontWeight: 600,
})
const applyBtn = {
  marginLeft: 'auto', padding: '5px 16px', borderRadius: 4, cursor: 'pointer',
  border: 'none', background: '#e94560', color: '#fff', fontWeight: 700, fontSize: 13,
}
const cancelBtn = {
  padding: '5px 14px', borderRadius: 4, cursor: 'pointer',
  border: '1px solid #555', background: 'transparent', color: '#aaa', fontSize: 13,
}
const body = {
  flex: 1, overflow: 'auto', padding: 16,
}
const sectionHeader = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: '#e94560', marginBottom: 8, marginTop: 16, borderBottom: '1px solid #2a2a4a',
  paddingBottom: 4,
}
const fieldRow = {
  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
}
const label = {
  width: 160, fontSize: 12, color: '#aaa', flexShrink: 0,
}
const inp = {
  background: '#252540', border: '1px solid #444', borderRadius: 4,
  color: '#e0e0e0', padding: '3px 7px', fontSize: 13, minWidth: 0,
}
const sel = {
  ...inp, cursor: 'pointer',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

let _uid = Date.now()
const uid = () => `_${(++_uid).toString(36)}`

/** Wraps SmartColorPicker to match the (val, onChange) API used in this file */
function ColorInput({ val, onChange }) {
  return <SmartColorPicker value={val && val.length > 0 ? val : '#000000'} onChange={onChange} />
}

/**
 * Target selector — shows page dropdown for 'goto', URL input for 'url'.
 * @param {{ action: string, target: string, onChange: (t:string)=>void, pages?: {id:string,name:string}[] }} props
 */
function TargetField({ action, target, onChange, pages = [] }) {
  if (action === 'none') return null
  if (action === 'url') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>🌐 URL</span>
        <input
          type="url"
          value={target || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..."
          style={{ ...inp, flex: 1 }}
        />
      </div>
    )
  }
  // goto — prefer page picker; fallback free-text
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
      <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>↗ Go to</span>
      {pages.length > 0 ? (
        <select
          value={target || ''}
          onChange={e => onChange(e.target.value)}
          style={{ ...sel, flex: 1 }}
        >
          <option value="">— Select page —</option>
          <option value="_first">▶ First page</option>
          <option value="_last">⏩ Last page</option>
          <option value="_next">▶ Next page</option>
          <option value="_prev">◀ Previous page</option>
          {pages.map(pg => (
            <option key={pg.id} value={pg.name}>{pg.name}</option>
          ))}
          <option value="_custom">✏ Type name…</option>
        </select>
      ) : null}
      {(pages.length === 0 || target === '_custom') && (
        <input
          value={target === '_custom' ? '' : (target || '')}
          onChange={e => onChange(e.target.value)}
          placeholder="Page name or #anchor"
          style={{ ...inp, flex: 1 }}
        />
      )}
    </div>
  )
}

// ─── 10 Color Themes ─────────────────────────────────────────────────────────

const MENU_BAR_COLOR_THEMES = [
  {
    id: 'slate', name: '1. Minimalist Slate',
    style: {
      bgColor: '#2F2F2F', bgGradientEnabled: false,
      itemColor: '#FFFFFF', itemHoverBg: '#A9A9A9', itemHoverColor: '#FFFFFF',
      itemActiveBg: '#888888', itemActiveColor: '#FFFFFF',
      dropdownBg: '#3a3a3a', dropdownColor: '#FFFFFF',
      dropdownGroupColor: '#A9A9A9', dropdownItemHoverBg: 'rgba(169,169,169,0.25)',
      dropdownItemHoverColor: '#FFFFFF', dropdownBorderColor: '#555555',
      logoColor: '#A9A9A9',
    },
  },
  {
    id: 'ocean', name: '2. Ocean Depth',
    style: {
      bgColor: '#1A1A40', bgGradientEnabled: true, bgGradientFrom: '#1A1A40', bgGradientTo: '#0d0d2a', bgGradientAngle: 180,
      itemColor: '#FFFFFF', itemHoverBg: '#00A8E8', itemHoverColor: '#FFFFFF',
      itemActiveBg: '#0090cc', itemActiveColor: '#FFFFFF',
      dropdownBg: '#141430', dropdownColor: '#FFFFFF',
      dropdownGroupColor: '#00A8E8', dropdownItemHoverBg: 'rgba(0,168,232,0.2)',
      dropdownItemHoverColor: '#FFFFFF', dropdownBorderColor: '#00A8E8',
      logoColor: '#00A8E8',
    },
  },
  {
    id: 'emerald', name: '3. Emerald Essence',
    style: {
      bgColor: '#053A35', bgGradientEnabled: false,
      itemColor: '#F0F8F0', itemHoverBg: '#4CAF50', itemHoverColor: '#FFFFFF',
      itemActiveBg: '#388e3c', itemActiveColor: '#FFFFFF',
      dropdownBg: '#042e2a', dropdownColor: '#F0F8F0',
      dropdownGroupColor: '#4CAF50', dropdownItemHoverBg: 'rgba(76,175,80,0.2)',
      dropdownItemHoverColor: '#FFFFFF', dropdownBorderColor: '#4CAF50',
      logoColor: '#4CAF50',
    },
  },
  {
    id: 'sunset', name: '4. Sunset Project',
    style: {
      bgColor: '#333333', bgGradientEnabled: false,
      itemColor: '#FFFFFF', itemHoverBg: '#FF5733', itemHoverColor: '#FFFFFF',
      itemActiveBg: '#cc3010', itemActiveColor: '#FFFFFF',
      dropdownBg: '#2a2a2a', dropdownColor: '#FFFFFF',
      dropdownGroupColor: '#FF5733', dropdownItemHoverBg: 'rgba(255,87,51,0.2)',
      dropdownItemHoverColor: '#FFFFFF', dropdownBorderColor: '#FF5733',
      logoColor: '#FF5733',
    },
  },
  {
    id: 'lavender', name: '5. Digital Lavender',
    style: {
      bgColor: '#A78BFA', bgGradientEnabled: true, bgGradientFrom: '#A78BFA', bgGradientTo: '#7c5de6', bgGradientAngle: 135,
      itemColor: '#FFFFFF', itemHoverBg: '#6D28D9', itemHoverColor: '#FFFFFF',
      itemActiveBg: '#5b21b6', itemActiveColor: '#FFFFFF',
      dropdownBg: '#8b70f0', dropdownColor: '#FFFFFF',
      dropdownGroupColor: '#FFFFFF', dropdownItemHoverBg: 'rgba(109,40,217,0.3)',
      dropdownItemHoverColor: '#FFFFFF', dropdownBorderColor: '#6D28D9',
      logoColor: '#FFFFFF',
    },
  },
  {
    id: 'mocha', name: '6. Mocha Mousse',
    style: {
      bgColor: '#A47864', bgGradientEnabled: false,
      itemColor: '#FFFFFF', itemHoverBg: '#5C3D2E', itemHoverColor: '#FFFFFF',
      itemActiveBg: '#4a2e20', itemActiveColor: '#FFE8D6',
      dropdownBg: '#8c6555', dropdownColor: '#FFFFFF',
      dropdownGroupColor: '#FFD4B8', dropdownItemHoverBg: 'rgba(92,61,46,0.3)',
      dropdownItemHoverColor: '#FFFFFF', dropdownBorderColor: '#5C3D2E',
      logoColor: '#FFD4B8',
    },
  },
  {
    id: 'cyber', name: '7. Cyber Night',
    style: {
      bgColor: '#000000', bgGradientEnabled: false,
      itemColor: '#E0E0E0', itemHoverBg: '#00FFAB', itemHoverColor: '#000000',
      itemActiveBg: '#00cc88', itemActiveColor: '#000000',
      dropdownBg: '#111111', dropdownColor: '#E0E0E0',
      dropdownGroupColor: '#00FFAB', dropdownItemHoverBg: 'rgba(0,255,171,0.15)',
      dropdownItemHoverColor: '#00FFAB', dropdownBorderColor: '#00FFAB',
      logoColor: '#00FFAB',
    },
  },
  {
    id: 'berry', name: '8. Berry Blush',
    style: {
      bgColor: '#D58D8D', bgGradientEnabled: false,
      itemColor: '#FFFFFF', itemHoverBg: '#4A001F', itemHoverColor: '#FFFFFF',
      itemActiveBg: '#380018', itemActiveColor: '#FFD6E0',
      dropdownBg: '#c07070', dropdownColor: '#FFFFFF',
      dropdownGroupColor: '#FFD6E0', dropdownItemHoverBg: 'rgba(74,0,31,0.3)',
      dropdownItemHoverColor: '#FFFFFF', dropdownBorderColor: '#4A001F',
      logoColor: '#FFD6E0',
    },
  },
  {
    id: 'arctic', name: '9. Arctic High-Contrast',
    style: {
      bgColor: '#FFFFFF', bgGradientEnabled: false,
      itemColor: '#0A0A0A', itemHoverBg: '#0066CC', itemHoverColor: '#FFFFFF',
      itemActiveBg: '#0050a0', itemActiveColor: '#FFFFFF',
      dropdownBg: '#F8F8F8', dropdownColor: '#0A0A0A',
      dropdownGroupColor: '#0066CC', dropdownItemHoverBg: 'rgba(0,102,204,0.1)',
      dropdownItemHoverColor: '#0066CC', dropdownBorderColor: '#0066CC',
      logoColor: '#0066CC',
    },
  },
  {
    id: 'golden', name: '10. Golden Hour',
    style: {
      bgColor: '#2C003E', bgGradientEnabled: true, bgGradientFrom: '#2C003E', bgGradientTo: '#1a0028', bgGradientAngle: 180,
      itemColor: '#FAF3E0', itemHoverBg: '#D4AF37', itemHoverColor: '#2C003E',
      itemActiveBg: '#b8932a', itemActiveColor: '#2C003E',
      dropdownBg: '#230032', dropdownColor: '#FAF3E0',
      dropdownGroupColor: '#D4AF37', dropdownItemHoverBg: 'rgba(212,175,55,0.2)',
      dropdownItemHoverColor: '#D4AF37', dropdownBorderColor: '#D4AF37',
      logoColor: '#D4AF37',
    },
  },
]


function Field({ lbl, children }) {
  return (
    <div style={fieldRow}>
      <span style={label}>{lbl}</span>
      {children}
    </div>
  )
}

function Toggle({ val, onChange }) {
  return (
    <button
      onClick={() => onChange(!val)}
      style={{
        padding: '3px 12px', borderRadius: 12, cursor: 'pointer',
        border: 'none', fontSize: 12, fontWeight: 600,
        background: val ? '#e94560' : '#333',
        color: val ? '#fff' : '#888',
      }}
    >
      {val ? 'ON' : 'OFF'}
    </button>
  )
}

// ─── Structure Tab ─────────────────────────────────────────────────────────────

function StructureTab({ data, setData, pages }) {
  const [open, setOpen] = useState({})
  const toggle = (id) => setOpen(p => ({ ...p, [id]: !p[id] }))

  const updItem = (idx, patch) => setData(prev => {
    const items = prev.items.map((it, i) => i === idx ? { ...it, ...patch } : it)
    return { ...prev, items }
  })
  const moveItem = (idx, dir) => setData(prev => {
    const items = [...prev.items]
    const target = idx + dir
    if (target < 0 || target >= items.length) return prev
    ;[items[idx], items[target]] = [items[target], items[idx]]
    return { ...prev, items }
  })
  const delItem = (idx) => setData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  const addItem = () => setData(prev => ({
    ...prev,
    items: [...prev.items, { id: uid(), label: 'New Item', action: 'goto', target: '', icon: '', children: [] }],
  }))

  const updGroup = (iIdx, gIdx, patch) => setData(prev => {
    const items = prev.items.map((it, i) => {
      if (i !== iIdx) return it
      const children = it.children.map((g, j) => j === gIdx ? { ...g, ...patch } : g)
      return { ...it, children }
    })
    return { ...prev, items }
  })
  const moveGroup = (iIdx, gIdx, dir) => setData(prev => {
    const items = prev.items.map((it, i) => {
      if (i !== iIdx) return it
      const children = [...it.children]
      const target = gIdx + dir
      if (target < 0 || target >= children.length) return it
      ;[children[gIdx], children[target]] = [children[target], children[gIdx]]
      return { ...it, children }
    })
    return { ...prev, items }
  })
  const delGroup = (iIdx, gIdx) => setData(prev => {
    const items = prev.items.map((it, i) => {
      if (i !== iIdx) return it
      return { ...it, children: it.children.filter((_, j) => j !== gIdx) }
    })
    return { ...prev, items }
  })
  const addGroup = (iIdx) => setData(prev => {
    const items = prev.items.map((it, i) => {
      if (i !== iIdx) return it
      return { ...it, children: [...(it.children || []), { id: uid(), groupLabel: 'New Group', items: [] }] }
    })
    return { ...prev, items }
  })

  const updSub = (iIdx, gIdx, sIdx, patch) => setData(prev => {
    const items = prev.items.map((it, i) => {
      if (i !== iIdx) return it
      const children = it.children.map((g, j) => {
        if (j !== gIdx) return g
        const sitems = g.items.map((s, k) => k === sIdx ? { ...s, ...patch } : s)
        return { ...g, items: sitems }
      })
      return { ...it, children }
    })
    return { ...prev, items }
  })
  const moveSub = (iIdx, gIdx, sIdx, dir) => setData(prev => {
    const items = prev.items.map((it, i) => {
      if (i !== iIdx) return it
      const children = it.children.map((g, j) => {
        if (j !== gIdx) return g
        const sitems = [...g.items]
        const target = sIdx + dir
        if (target < 0 || target >= sitems.length) return g
        ;[sitems[sIdx], sitems[target]] = [sitems[target], sitems[sIdx]]
        return { ...g, items: sitems }
      })
      return { ...it, children }
    })
    return { ...prev, items }
  })
  const delSub = (iIdx, gIdx, sIdx) => setData(prev => {
    const items = prev.items.map((it, i) => {
      if (i !== iIdx) return it
      const children = it.children.map((g, j) => {
        if (j !== gIdx) return g
        return { ...g, items: g.items.filter((_, k) => k !== sIdx) }
      })
      return { ...it, children }
    })
    return { ...prev, items }
  })
  const addSub = (iIdx, gIdx) => setData(prev => {
    const items = prev.items.map((it, i) => {
      if (i !== iIdx) return it
      const children = it.children.map((g, j) => {
        if (j !== gIdx) return g
        return { ...g, items: [...(g.items || []), { id: uid(), label: 'New Sub-item', action: 'goto', target: '', icon: '' }] }
      })
      return { ...it, children }
    })
    return { ...prev, items }
  })

  const rowBtn = (label, onClick, color = '#555') => (
    <button onClick={onClick} style={{ padding: '2px 8px', fontSize: 11, cursor: 'pointer', border: `1px solid ${color}`, borderRadius: 3, background: 'transparent', color: color }}>{label}</button>
  )

  return (
    <div>
      {(data.items || []).map((item, iIdx) => (
        <div key={item.id} style={{ marginBottom: 8, border: '1px solid #2a2a4a', borderRadius: 5 }}>
          {/* Top-level item header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#1e1e3a', borderRadius: '5px 5px 0 0', cursor: 'pointer' }}
            onClick={() => toggle(item.id)}>
            <span style={{ fontSize: 12, color: '#888', marginRight: 2 }}>{open[item.id] ? '▾' : '▸'}</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{item.label || '(no label)'}</span>
            <span style={{ fontSize: 11, color: '#666', marginLeft: 4 }}>[{item.action}]</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {rowBtn('↑', (e) => { e.stopPropagation(); moveItem(iIdx, -1) })}
              {rowBtn('↓', (e) => { e.stopPropagation(); moveItem(iIdx, 1) })}
              {rowBtn('✕', (e) => { e.stopPropagation(); delItem(iIdx) }, '#e94560')}
            </span>
          </div>
          {open[item.id] && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid #2a2a4a' }}>
              <div style={fieldRow}>
                <span style={{ ...label, width: 70 }}>Label</span>
                <input value={item.label} onChange={e => updItem(iIdx, { label: e.target.value })} style={{ ...inp, flex: 1 }} />
              </div>
              <div style={fieldRow}>
                <span style={{ ...label, width: 70 }}>Action</span>
                <select value={item.action} onChange={e => updItem(iIdx, { action: e.target.value })} style={sel}>
                  <option value="goto">↗ Go to page</option>
                  <option value="url">🌐 Open URL</option>
                  <option value="next">▶ Next page</option>
                  <option value="prev">◀ Previous page</option>
                  <option value="none">— None (has children)</option>
                </select>
              </div>
              {item.action !== 'none' && (
                <div style={fieldRow}>
                  <span style={{ ...label, width: 70 }}>Target</span>
                  <TargetField action={item.action} target={item.target || ''} onChange={v => updItem(iIdx, { target: v })} pages={pages} />
                </div>
              )}
              {item.action === 'none' && (
                <div>
                  {(item.children || []).map((group, gIdx) => (
                    <div key={group.id} style={{ marginLeft: 12, marginBottom: 6, border: '1px solid #2e2e52', borderRadius: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: '#171730', borderRadius: '4px 4px 0 0', cursor: 'pointer' }}
                        onClick={() => toggle(group.id)}>
                        <span style={{ fontSize: 11, color: '#888' }}>{open[group.id] ? '▾' : '▸'}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#e94560' }}>{group.groupLabel || '(group)'}</span>
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                          {rowBtn('↑', (e) => { e.stopPropagation(); moveGroup(iIdx, gIdx, -1) })}
                          {rowBtn('↓', (e) => { e.stopPropagation(); moveGroup(iIdx, gIdx, 1) })}
                          {rowBtn('✕', (e) => { e.stopPropagation(); delGroup(iIdx, gIdx) }, '#e94560')}
                        </span>
                      </div>
                      {open[group.id] && (
                        <div style={{ padding: '6px 10px', borderTop: '1px solid #2e2e52' }}>
                          <div style={fieldRow}>
                            <span style={{ ...label, width: 80 }}>Group Label</span>
                            <input value={group.groupLabel || ''} onChange={e => updGroup(iIdx, gIdx, { groupLabel: e.target.value })} style={{ ...inp, flex: 1 }} />
                          </div>
                          {(group.items || []).map((sub, sIdx) => (
                            <div key={sub.id} style={{ marginLeft: 10, marginBottom: 5, padding: '5px 8px', background: '#1a1a36', borderRadius: 4, border: '1px solid #252545' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 600 }}>{sub.label || '(sub)'}</span>
                                <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                  {rowBtn('↑', () => moveSub(iIdx, gIdx, sIdx, -1))}
                                  {rowBtn('↓', () => moveSub(iIdx, gIdx, sIdx, 1))}
                                  {rowBtn('✕', () => delSub(iIdx, gIdx, sIdx), '#e94560')}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <input value={sub.label || ''} onChange={e => updSub(iIdx, gIdx, sIdx, { label: e.target.value })} style={{ ...inp, flex: '1 1 100px' }} placeholder="Label" />
                                <select value={sub.action || 'goto'} onChange={e => updSub(iIdx, gIdx, sIdx, { action: e.target.value })} style={sel}>
                                  <option value="goto">↗ Go to page</option>
                                  <option value="url">🌐 Open URL</option>
                                  <option value="next">▶ Next</option>
                                  <option value="prev">◀ Previous</option>
                                  <option value="none">— None</option>
                                </select>
                                <TargetField action={sub.action || 'goto'} target={sub.target || ''} onChange={v => updSub(iIdx, gIdx, sIdx, { target: v })} pages={pages} />
                              </div>
                            </div>
                          ))}
                          <button onClick={() => addSub(iIdx, gIdx)} style={{ marginTop: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer', border: '1px solid #3a3a6a', borderRadius: 3, background: 'transparent', color: '#9090d0' }}>+ Add Sub-item</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addGroup(iIdx)} style={{ marginTop: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', border: '1px solid #e9456044', borderRadius: 3, background: 'transparent', color: '#e94560' }}>+ Add Group</button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <button onClick={addItem} style={{ marginTop: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', border: '1px solid #e94560', borderRadius: 4, background: 'rgba(233,69,96,0.12)', color: '#e94560', fontWeight: 600 }}>+ Add Top-level Item</button>
    </div>
  )
}

// ─── Logo Image Picker ─────────────────────────────────────────────────────────

// Accepted MIME types for logo media
const LOGO_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/apng,video/mp4,video/webm,video/ogg'

function isVideoDataUrl(src) {
  return typeof src === 'string' && src.startsWith('data:video/')
}

function LogoImagePicker({ logoImage, logoOrigImage, logoChromaColor, onPick, onPickWithOrig, onChromaVideo, onClear }) {
  const fileRef = useRef(null)
  const [showChroma, setShowChroma] = useState(false)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = /** @type {string} */(reader.result)
      onPickWithOrig(dataUrl, dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleChromaApply = (resultDataUrl, meta) => {
    // Live shape mask — video stays animated, shape mask applied via WebGL
    if (meta?.hasLiveMask && meta.wasVideo && meta.videoSrc) {
      onChromaVideo(meta.videoSrc, logoOrigImage || meta.videoSrc, {
        chromaColor:   meta.chromaEnabled ? meta.chromaColor : null,
        tolerance:     meta.tolerance,
        softness:      meta.softness,
        maskShape:     meta.liveMaskShape,
      })
      setShowChroma(false)
      return
    }
    // Video + colour-key only (no shape selections) — keep video alive
    if (meta?.wasVideo && meta.chromaEnabled && !meta.hasSelections && meta.videoSrc) {
      onChromaVideo(meta.videoSrc, logoOrigImage || meta.videoSrc, {
        chromaColor:   meta.chromaColor,
        tolerance:     meta.tolerance,
        softness:      meta.softness,
        maskShape:     null,
      })
    } else {
      // Shape selections or image source — bake to PNG still
      onPick(resultDataUrl)
    }
    setShowChroma(false)
  }

  const handleRevert = () => {
    if (logoOrigImage) onPickWithOrig(logoOrigImage, logoOrigImage)
  }

  const previewStyle = /** @type {import('react').CSSProperties} */ ({ height: 40, maxWidth: 160, objectFit: 'contain', border: '1px solid #444', borderRadius: 4, background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 12px 12px' })

  const hasBgRemoval = (logoOrigImage && logoOrigImage !== logoImage) || !!logoChromaColor
  const isVideo = isVideoDataUrl(logoImage)

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ ...fieldRow, alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ ...label, paddingTop: 4 }}>Logo Media</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>

          {/* Preview + remove */}
          {logoImage ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {isVideo
                ? <video src={logoImage} autoPlay loop muted playsInline style={previewStyle} />
                : <img src={logoImage} alt="logo" style={previewStyle} />
              }
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {hasBgRemoval && (
                  <span style={{ fontSize: 10, color: '#4caf50' }}>
                    {logoChromaColor
                      ? '🎬 Chroma key active — playing live with BG removed'
                      : isVideoDataUrl(logoOrigImage) && !isVideo
                        ? '✔ BG removal active (PNG frame from video)'
                        : '✔ BG removal active'
                    }
                  </span>
                )}
                <button onClick={onClear}
                  style={{ padding: '3px 8px', fontSize: 11, cursor: 'pointer', border: '1px solid #e94560', borderRadius: 3, background: 'transparent', color: '#e94560' }}>
                  ✕ Remove
                </button>
                {hasBgRemoval && (
                  <button onClick={handleRevert}
                    style={{ padding: '3px 8px', fontSize: 11, cursor: 'pointer', border: '1px solid #888', borderRadius: 3, background: 'transparent', color: '#aaa' }}>
                    ↺ Revert original
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>No media — using text logo</div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => fileRef.current?.click()}
              style={{ padding: '4px 12px', fontSize: 11, cursor: 'pointer', border: '1px solid #444', borderRadius: 3, background: '#252540', color: '#ccc' }}>
              📂 {logoImage ? 'Replace…' : 'Browse media…'}
            </button>
            <input ref={fileRef} type="file" accept={LOGO_ACCEPT} style={{ display: 'none' }} onChange={handleFile} />

            {logoImage && (
              <button onClick={() => setShowChroma(true)}
                style={{ padding: '4px 12px', fontSize: 11, cursor: 'pointer', border: `1px solid ${hasBgRemoval ? '#4caf50' : '#6a5acd'}`, borderRadius: 3, background: hasBgRemoval ? '#1a2a1a' : '#1a1a30', color: hasBgRemoval ? '#4caf50' : '#9a8aff' }}>
                {hasBgRemoval ? '↺ Re-edit BG removal…' : '🎨 Remove Background…'}
              </button>
            )}
          </div>

          <div style={{ fontSize: 10, color: '#555' }}>PNG · JPEG · GIF · WebP · APNG · SVG · MP4 · WebM — animated formats play looped. Colour-key BG removal on video keeps it animated (WebGL). Shape selections produce a PNG still.</div>
        </div>
      </div>

      {/* Chroma Key Modal */}
      {showChroma && createPortal(
        <ChromaKeyModal
          src={logoImage}
          origSrc={logoOrigImage || logoImage}
          mediaKind={isVideo ? 'video/mp4' : 'image'}
          onApply={handleChromaApply}
          onCancel={() => setShowChroma(false)}
        />,
        document.body
      )}
    </div>
  )
}

// ─── Style Tab ─────────────────────────────────────────────────────────────────

function StyleTab({ data, upStyle }) {
  const s = data.style || {}
  const pos = data.position || 'top'
  const isVertical = pos === 'left' || pos === 'right'

  const row = (lbl, children) => <Field lbl={lbl}>{children}</Field>
  const numInp = (key, min = 0, max = 9999, step = 1) => (
    <input type="number" value={s[key] ?? ''} min={min} max={max} step={step}
      onChange={e => upStyle({ [key]: e.target.value === '' ? '' : Number(e.target.value) })}
      style={{ ...inp, width: 80 }} />
  )
  const txtInp = (key, placeholder = '') => (
    <input type="text" value={s[key] ?? ''} placeholder={placeholder}
      onChange={e => upStyle({ [key]: e.target.value })}
      style={{ ...inp, flex: 1, minWidth: 160 }} />
  )
  const colorInp = (key) => <ColorInput val={s[key] || ''} onChange={v => upStyle({ [key]: v })} />
  const selInp = (key, options) => (
    <select value={s[key] ?? ''} onChange={e => upStyle({ [key]: e.target.value })} style={sel}>
      {options.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
    </select>
  )

  const applyTheme = (e) => {
    const theme = MENU_BAR_COLOR_THEMES.find(t => t.id === e.target.value)
    if (theme) upStyle(theme.style)
    e.target.value = ''
  }

  return (
    <div>
      {/* ── Themes ── */}
      <div style={sectionHeader}>🎨 Themes</div>
      <div style={{ ...fieldRow, flexWrap: 'wrap', gap: 6 }}>
        <select defaultValue="" onChange={applyTheme} style={{ ...sel, minWidth: 220 }}>
          <option value="" disabled>Apply colour theme…</option>
          {MENU_BAR_COLOR_THEMES.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: '#888' }}>Instantly sets all bar, item &amp; dropdown colours</span>
      </div>
      {/* Theme swatch row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {MENU_BAR_COLOR_THEMES.map(t => (
          <button
            key={t.id}
            title={t.name}
            onClick={() => upStyle(t.style)}
            style={{
              width: 28, height: 28, borderRadius: 4, cursor: 'pointer',
              border: s.bgColor === t.style.bgColor ? '2px solid #fff' : '2px solid transparent',
              background: t.style.bgColor,
              position: 'relative', overflow: 'hidden', padding: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,.5)',
            }}
          >
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, background: t.style.itemHoverBg }} />
          </button>
        ))}
      </div>

      {/* ── Bar ── */}
      <div style={sectionHeader}>Bar</div>
      {row('Background Color', colorInp('bgColor'))}
      {row('BG Gradient', <Toggle val={!!s.bgGradientEnabled} onChange={v => upStyle({ bgGradientEnabled: v })} />)}
      {s.bgGradientEnabled && <>
        {row('Gradient From', colorInp('bgGradientFrom'))}
        {row('Gradient To', colorInp('bgGradientTo'))}
        {row('Gradient Angle', <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" min={0} max={360} value={s.bgGradientAngle ?? 0} onChange={e => upStyle({ bgGradientAngle: Number(e.target.value) })} style={{ width: 140 }} />
          <span style={{ fontSize: 13, minWidth: 36 }}>{s.bgGradientAngle ?? 0}°</span>
        </div>)}
      </>}
      {row(isVertical ? 'Bar Width (px)' : 'Bar Height (px)', numInp(isVertical ? 'barWidth' : 'barHeight', 20, 600))}

      {/* ── Items ── */}
      <div style={sectionHeader}>Items</div>
      {row('Item Color', colorInp('itemColor'))}
      {row('Item Hover BG', colorInp('itemHoverBg'))}
      {row('Item Hover Color', colorInp('itemHoverColor'))}
      {row('Item Active BG', colorInp('itemActiveBg'))}
      {row('Item Active Color', colorInp('itemActiveColor'))}
      {row('Font Size (px)', numInp('fontSize', 8, 40))}
      {row('Font Family', <FontPicker value={s.fontFamily || 'Rajdhani'} onChange={v => upStyle({ fontFamily: v })} />)}
      {row('Font Weight', selInp('fontWeight', [['400','400 Regular'],['500','500 Medium'],['600','600 SemiBold'],['700','700 Bold'],['800','800 ExtraBold']]))}
      {row('Letter Spacing', txtInp('letterSpacing', 'e.g. 0.05em'))}
      {row('Text Transform', selInp('textTransform', [['none','none'],['uppercase','UPPERCASE'],['capitalize','Capitalize'],['lowercase','lowercase']]))}
      {row('Padding H (px)', numInp('itemPaddingH', 0, 100))}
      {row('Padding V (px)', numInp('itemPaddingV', 0, 60))}
      {row('Item Gap (px)', numInp('itemGap', 0, 40))}
      {row('Underline on Hover', <Toggle val={!!s.itemUnderlineOnHover} onChange={v => upStyle({ itemUnderlineOnHover: v })} />)}
      {s.itemUnderlineOnHover && row('Underline Color', colorInp('itemUnderlineColor'))}

      {/* ── Logo ── */}
      <div style={sectionHeader}>Logo</div>
      <LogoImagePicker
        logoImage={s.logoImage || ''}
        logoOrigImage={s.logoOrigImage || ''}
        logoChromaColor={s.logoChromaColor || ''}
        onClear={() => upStyle({ logoImage: '', logoOrigImage: '', logoChromaColor: '', logoChromaTolerance: undefined, logoChromaSoftness: undefined, logoMaskShape: null })}
        onPick={(dataUrl) => upStyle({ logoImage: dataUrl, logoChromaColor: '', logoChromaTolerance: undefined, logoChromaSoftness: undefined })}
        onPickWithOrig={(dataUrl, origUrl) => upStyle({ logoImage: dataUrl, logoOrigImage: origUrl, logoChromaColor: '', logoChromaTolerance: undefined, logoChromaSoftness: undefined })}
        onChromaVideo={(videoSrc, origSrc, params) => upStyle({
          logoImage: videoSrc,
          logoOrigImage: origSrc,
          logoChromaColor: params.chromaColor || '',
          logoChromaTolerance: params.tolerance,
          logoChromaSoftness: params.softness,
          logoMaskShape: params.maskShape || null,
        })}
      />
      {!s.logoImage && row('Logo Text', txtInp('logoText'))}
      {!s.logoImage && row('Logo Color', colorInp('logoColor'))}
      {!s.logoImage && row('Logo Font Size (px)', numInp('logoFontSize', 10, 80))}
      {!s.logoImage && row('Logo Font Weight', selInp('logoFontWeight', [['400','400'],['600','600'],['700','700'],['800','800'],['900','900']]))}
      {row('Logo Height (px)', numInp('logoFontSize', 10, 200))}
      {row('Logo Position', selInp('logoPosition', [['left','Left'],['right','Right'],['none','None']]))}

      {/* ── Dropdown ── */}
      <div style={sectionHeader}>Dropdown</div>
      {row('Dropdown BG', colorInp('dropdownBg'))}
      {row('Dropdown BG Gradient', <Toggle val={!!s.dropdownBgGradientEnabled} onChange={v => upStyle({ dropdownBgGradientEnabled: v })} />)}
      {s.dropdownBgGradientEnabled && <>
        {row('Gradient From', colorInp('dropdownBgGradientFrom'))}
        {row('Gradient To', colorInp('dropdownBgGradientTo'))}
      </>}
      {row('Border Color', colorInp('dropdownBorderColor'))}
      {row('Border Width (px)', numInp('dropdownBorderWidth', 0, 10))}
      {row('Shadow', txtInp('dropdownShadow', 'e.g. 0 8px 32px rgba(0,0,0,0.5)'))}
      {row('Animation', selInp('dropdownAnimation', [['slide','Slide'],['fade','Fade'],['scale','Scale'],['slide-up','Slide Up'],['slide-right','Slide Right'],['slide-left','Slide Left']]))}

      {/* ── Dropdown Items ── */}
      <div style={sectionHeader}>Dropdown Items</div>
      {row('Item Color', colorInp('dropdownColor'))}
      {row('Group Label Color', colorInp('dropdownGroupColor'))}
      {row('Item Hover BG', colorInp('dropdownItemHoverBg'))}
      {row('Item Hover Color', colorInp('dropdownItemHoverColor'))}
      {row('Group Font Size (px)', numInp('dropdownGroupFontSize', 8, 24))}
      {row('Item Font Size (px)', numInp('dropdownItemFontSize', 8, 24))}
      {row('Padding (px)', numInp('dropdownPadding', 0, 80))}
      {row('Column Gap (px)', numInp('dropdownColumnGap', 0, 80))}
      {row('Min Width (px)', numInp('dropdownMinWidth', 80, 600))}
    </div>
  )
}

// ─── Preview Tab ────────────────────────────────────────────────────────────────

function PreviewTab({ data }) {
  const previewW = 800
  const previewH = data?.h || data?.style?.barHeight || 56
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
        Scaled preview — interactive in editor mode.
      </div>
      <div style={{ position: 'relative', width: previewW, maxWidth: '100%', height: previewH, background: '#0a1a2a', borderRadius: 6, overflow: 'visible' }}>
        <MenuBarElement el={{ ...data, w: previewW, h: previewH, x: 0, y: 0 }} isEditor={true} stageWidth={previewW} stageHeight={previewH} zoom={1} />
      </div>
    </div>
  )
}

// ─── Main Modal ─────────────────────────────────────────────────────────────────

/**
 * @param {{ el: object, onApply: (el: object) => void, onClose: () => void, pages?: import('../types/desktop-api').SmmPage[] }} props
 */
export default function MenuBarEditorModal({ el, onApply, onClose, pages = [] }) {
  const [tab, setTab] = useState('structure')
  const [data, setData] = useState(() => JSON.parse(JSON.stringify(el)))

  const up = useCallback((patch) => setData(prev => ({ ...prev, ...patch })), [])
  const upStyle = useCallback((patch) => setData(prev => ({ ...prev, style: { ...prev.style, ...patch } })), [])

  const templates = getMenuBarTemplatesByPosition(data.position || 'top')

  const applyTemplate = (e) => {
    const tpl = MENU_BAR_TEMPLATES.find(t => t.id === e.target.value)
    if (!tpl) return
    setData(prev => ({
      ...prev,
      style: { ...prev.style, ...tpl.style },
      items: tpl.items ? JSON.parse(JSON.stringify(tpl.items)) : prev.items,
    }))
    e.target.value = ''
  }

  return createPortal(
    <div style={backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={box}>
        {/* Toolbar */}
        <div style={toolbar}>
          {/* Tab buttons */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['structure', 'style', 'preview'].map(t => (
              <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: '#444', margin: '0 4px' }} />

          {/* Position selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#888', marginRight: 2 }}>Position:</span>
            {['top', 'bottom', 'left', 'right'].map(p => (
              <button key={p} style={posBtn(data.position === p)} onClick={() => up({ position: p })}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: '#444', margin: '0 4px' }} />

          {/* Template selector */}
          <select onChange={applyTemplate} style={{ ...sel, maxWidth: 180 }} defaultValue="">
            <option value="" disabled>Load template…</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Apply / Cancel */}
          <button style={applyBtn} onClick={() => onApply(data)}>Apply</button>
          <button style={cancelBtn} onClick={onClose}>Cancel</button>
        </div>

        {/* Body */}
        <div style={body}>
          {tab === 'structure' && <StructureTab data={data} setData={setData} pages={pages} />}
          {tab === 'style' && <StyleTab data={data} upStyle={upStyle} />}
          {tab === 'preview' && <PreviewTab data={data} />}
        </div>
      </div>
    </div>,
    document.body
  )
}
