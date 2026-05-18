// FontPicker — scrollable A-Z font selector with live preview (includes system fonts)
// Uses createPortal so the dropdown renders at document.body, escaping any parent overflow clipping.
// Uses a transparent backdrop overlay to close the dropdown on outside clicks (simpler than
// capture-phase mousedown listeners).
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { FONT_LIST } from '../constants/index.js'
import { loadSystemFonts } from '../utils/systemFonts.js'

const STATIC_FONTS = FONT_LIST.flatMap(g => g.fonts)
const PICKER_W = 280
const ROW_H = 32
const MAX_VISIBLE = 12  // rows visible at once

function buildSortedList(sysFonts) {
  const all = [...new Set([...STATIC_FONTS, ...sysFonts])]
  return all.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

export default function FontPicker({ value, onChange, style = {} }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sysFonts, setSysFonts] = useState([])
  const [pos, setPos] = useState({ top: 0, left: 0, width: PICKER_W })
  const searchRef = useRef(null)
  const listRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    loadSystemFonts().then(fonts => {
      if (fonts?.length) setSysFonts(fonts.map(f => f.name ?? f))
    }).catch(() => {})
  }, [])

  const allFonts = buildSortedList(sysFonts)

  const displayed = query.trim()
    ? allFonts.filter(f => f.toLowerCase().includes(query.toLowerCase()))
    : allFonts

  // Auto-scroll to selected font when dropdown opens
  useEffect(() => {
    if (!open || !listRef.current) return
    const idx = displayed.findIndex(f => f === value)
    if (idx >= 0) {
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = Math.max(0, (idx - 3) * ROW_H)
      })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback((font) => {
    onChange(font)
    setOpen(false)
    setQuery('')
  }, [onChange])

  const calcPos = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dropH = ROW_H * MAX_VISIBLE + 90
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < dropH + 8 && rect.top > dropH + 8
    const top = openUp
      ? Math.max(4, rect.top - dropH - 4)
      : Math.min(rect.bottom + 2, window.innerHeight - dropH - 4)
    const left = Math.min(rect.left, window.innerWidth - PICKER_W - 8)
    setPos({ top, left, width: Math.max(PICKER_W, rect.width) })
  }, [])

  const openPicker = useCallback(() => {
    calcPos()
    setOpen(true)
    setQuery('')
    setTimeout(() => searchRef.current?.focus(), 30)
  }, [calcPos])

  const closePicker = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', calcPos, true)
    window.addEventListener('resize', calcPos)
    return () => {
      window.removeEventListener('scroll', calcPos, true)
      window.removeEventListener('resize', calcPos)
    }
  }, [open, calcPos])

  const portal = open ? createPortal(
    <>
      {/* Transparent full-screen backdrop — clicking it closes the picker */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
        onClick={closePicker}
      />

      {/* Dropdown panel — above backdrop */}
      <div
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          zIndex: 99999,
          width: pos.width,
          background: '#1e1e1e',
          border: '1px solid #666',
          borderRadius: 5,
          boxShadow: '0 10px 40px rgba(0,0,0,0.95)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'all',
        }}
      >
        {/* Search bar */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#252525', borderBottom: '1px solid #444', padding: '0 8px' }}>
          <span style={{ color: '#666', fontSize: 12, marginRight: 4 }}>🔍</span>
          <input
            ref={searchRef}
            style={{
              flex: 1, padding: '7px 4px',
              background: 'transparent', border: 'none',
              color: '#eee', fontSize: 13, outline: 'none',
            }}
            placeholder={`Filter ${allFonts.length} fonts…`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') closePicker()
              if (e.key === 'Enter' && displayed.length > 0) pick(displayed[0])
            }}
          />
          {query && (
            <span
              style={{ color: '#888', fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}
              onClick={e => { e.stopPropagation(); setQuery('') }}
            >✕</span>
          )}
        </div>

        {/* Font count */}
        <div style={{ padding: '3px 10px', fontSize: 10, color: '#555', background: '#1a1a1a', borderBottom: '1px solid #333' }}>
          {query.trim() ? `${displayed.length} of ${allFonts.length} fonts` : `${allFonts.length} fonts — scroll to browse`}
        </div>

        {/* Scrollable A-Z list */}
        <div
          ref={listRef}
          style={{ height: ROW_H * MAX_VISIBLE, overflowY: 'scroll', overflowX: 'hidden' }}
        >
          {displayed.length === 0 ? (
            <div style={{ padding: '14px 12px', color: '#666', fontSize: 12 }}>
              No fonts match "{query}"
            </div>
          ) : (
            displayed.map(font => {
              const isActive = font === value
              return (
                <div
                  key={font}
                  onClick={e => { e.stopPropagation(); pick(font) }}
                  style={{
                    height: ROW_H,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 12px',
                    cursor: 'pointer',
                    background: isActive ? '#2a5fa0' : 'transparent',
                    color: isActive ? '#fff' : '#ccc',
                    fontFamily: `'${font}', sans-serif`,
                    fontSize: 15,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    borderBottom: '1px solid #252525',
                    flexShrink: 0,
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2c2c2c' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? '#2a5fa0' : 'transparent' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{font}</span>
                  {isActive && <span style={{ fontSize: 11, color: '#6cf', flexShrink: 0, marginLeft: 6 }}>✓</span>}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>,
    document.body
  ) : null

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}>
      {/* Trigger button — uses onClick, no preventDefault, maximally compatible */}
      <div
        onClick={openPicker}
        title={value || 'Select font'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px',
          background: open ? '#2c2c2c' : '#1a1a1a',
          border: `1px solid ${open ? '#888' : '#444'}`,
          borderRadius: 4,
          cursor: 'pointer',
          minWidth: 160, maxWidth: 260,
          color: '#eee', fontSize: 13,
          fontFamily: `'${value || 'Rajdhani'}', sans-serif`,
          userSelect: 'none',
          transition: 'border-color .1s, background .1s',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || 'Select font…'}
        </span>
        <span style={{ fontSize: 10, color: '#888', flexShrink: 0, fontFamily: 'sans-serif' }}>{open ? '▲' : '▼'}</span>
      </div>
      {portal}
    </div>
  )
}
