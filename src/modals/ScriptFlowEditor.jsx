/**
 * ScriptFlowEditor.jsx — Visual branching flowchart editor for FluxAura Studio.
 *
 * Renders all script pages as interactive node cards in an SVG+HTML flow
 * graph. Shows every page's elements, branching/linking, timings, assets,
 * and animations. Error indicators surface broken links, dead-ends, and
 * missing media.
 *
 * Props:
 *   pages          {Array}    Page objects from app state
 *   onClose        {Function} Close the editor
 *   onNavigatePage {Function} onNavigatePage(pageIdx) — jump to that page
 */

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from 'react'

// ─── Layout constants ────────────────────────────────────────────────────────

const NODE_W      = 270
const NODE_H_BASE = 60   // header
const EL_ROW_H    = 28   // per element
const TIMING_ROW  = 24
const COL_GAP     = 120
const ROW_GAP     = 80
const MARGIN      = 60

// ─── Helper: element type icon ────────────────────────────────────────────────

function elTypeIcon(el) {
  if (el.type === 'text')    return '📝'
  if (el.type === 'button')  return '🖱'
  if (el.type === 'hotspot') return '🎯'
  if (el.type === 'clip') {
    const k = el.mediaKind || ''
    if (k === 'video') return '🎬'
    if (k === 'audio') return '🔊'
    return '🖼'
  }
  if (el.type === 'mpeg') return '🎵'
  return '◻'
}

// ─── Helper: element row action summary ───────────────────────────────────────

function elActionSummary(el) {
  const parts = []
  if (el.animIn  && el.animIn  !== 'none') parts.push(`↘ ${el.animIn}`)
  if (el.animOut && el.animOut !== 'none') parts.push('↗ out')
  if (el.onPlayMode && el.onPlayMode !== 'auto') parts.push(`▶ ${el.onPlayMode}`)
  if (el.waitToPlay && el.waitToPlay !== 'none') parts.push('⏸ wait')
  if (el.afterPlay && el.afterPlay !== 'none') {
    if      (el.afterPlay === 'next') parts.push('→ next')
    else if (el.afterPlay === 'prev') parts.push('← prev')
    else if (el.afterPlay === 'goto') parts.push(`→ ${el.afterPlayTarget || '?'}`)
    else                              parts.push(`⚡ ${el.afterPlay}`)
  }
  if      (el.action === 'goto') parts.push(`→ ${el.linkTarget || '?'}`)
  else if (el.action === 'next') parts.push('→ next')
  else if (el.action === 'prev') parts.push('← prev')
  else if (el.action === 'quit') parts.push('✗ quit')
  return parts.join('  ')
}

// ─── Helper: resolve navigation target to page index ─────────────────────────

function resolveTarget(action, target, currentIdx, pages) {
  if (action === 'next'      || action === 'goto-next') return currentIdx + 1
  if (action === 'prev'      || action === 'goto-prev') return currentIdx - 1
  if (action === 'loop')                                return currentIdx
  if (action === 'quit')                                return -2 // special: quit
  if (action === 'goto' || action === 'goto-page') {
    const idx = pages.findIndex(p => p.name === target || p.id === target)
    if (idx >= 0) return idx
    const m = String(target || '').match(/^Page\s*(\d+)$/i)
    if (m) return parseInt(m[1], 10) - 1
    return -1 // broken link
  }
  return null // no edge
}

// ─── Build edges from all navigation sources ──────────────────────────────────

function buildEdges(pages) {
  const edges = []

  pages.forEach((pg, pgIdx) => {
    const push = (targetIdx, type, label, elIdx = null) => {
      edges.push({ from: pgIdx, to: targetIdx, type, label, elIdx })
    }

    // 1. Page timing auto-advance
    const t = pg.timing
    if (t?.mode === 'auto' && t?.onEnd) {
      const tgt = resolveTarget(t.onEnd, t.onEndTarget, pgIdx, pages)
      if (tgt !== null) push(tgt, 'auto', `⏱ ${t.onEnd}`)
    }

    // 2. Per-element sources
    ;(pg.elements || []).forEach((el, elIdx) => {
      // Direct action (button / hotspot)
      if (el.action) {
        const tgt = resolveTarget(el.action, el.linkTarget, pgIdx, pages)
        if (tgt !== null) push(tgt, 'click', elActionSummary(el) || el.action, elIdx)
      }

      // afterPlay on media elements
      if (el.afterPlay && el.afterPlay !== 'none') {
        const tgt = resolveTarget(el.afterPlay, el.afterPlayTarget, pgIdx, pages)
        if (tgt !== null) push(tgt, 'after-play', `▶ ${el.afterPlay}`, elIdx)
      }

      // actionChain steps
      ;(el.actionChain || []).forEach(step => {
        const tgt = resolveTarget(step.action, step.target, pgIdx, pages)
        if (tgt !== null) push(tgt, 'click', `chain: ${step.action}`, elIdx)
      })

      // conditions (thenGoTo / elseGoTo)
      ;(el.conditions || []).forEach(cond => {
        if (cond.thenGoTo) {
          const tgt = resolveTarget('goto', cond.thenGoTo, pgIdx, pages)
          if (tgt !== null) push(tgt, 'conditional', `if → ${cond.thenGoTo}`, elIdx)
        }
        if (cond.elseGoTo) {
          const tgt = resolveTarget('goto', cond.elseGoTo, pgIdx, pages)
          if (tgt !== null) push(tgt, 'conditional', `else → ${cond.elseGoTo}`, elIdx)
        }
      })

      // hoverAction / clickAction
      if (el.hoverAction) {
        const tgt = resolveTarget(el.hoverAction, el.hoverTarget, pgIdx, pages)
        if (tgt !== null) push(tgt, 'click', `hover: ${el.hoverAction}`, elIdx)
      }
      if (el.clickAction) {
        const tgt = resolveTarget(el.clickAction, el.clickTarget, pgIdx, pages)
        if (tgt !== null) push(tgt, 'click', `click: ${el.clickAction}`, elIdx)
      }
    })
  })

  return edges
}

// ─── Error / warning analysis ────────────────────────────────────────────────

function analyzeErrors(pages, edges) {
  // Build incoming-edge sets
  const incoming = Array.from({ length: pages.length }, () => [])
  edges.forEach(e => {
    if (e.to >= 0 && e.to < pages.length) incoming[e.to].push(e)
  })

  return pages.map((pg, pgIdx) => {
    const errors   = []
    const warnings = []
    const infos    = []

    // Broken links
    edges.filter(e => e.from === pgIdx && e.to === -1).forEach(e => {
      errors.push(`Broken link: "${e.label}"`)
    })

    // Missing media
    ;(pg.elements || []).forEach(el => {
      if (el.mediaName && !el.file) {
        warnings.push(`Missing media: "${el.mediaName}"`)
      }
    })

    // Dead-end detection
    const outgoing = edges.filter(e => e.from === pgIdx && e.to !== -2)
    const hasInteractive = (pg.elements || []).some(
      el => el.type === 'button' || el.type === 'hotspot'
    )
    if (outgoing.length === 0 && pg.timing?.mode !== 'auto' && !hasInteractive) {
      warnings.push('Dead-end: no outgoing navigation')
    }

    // Unreachable (no incoming) — skip page 0
    if (pgIdx > 0 && incoming[pgIdx].length === 0) {
      infos.push('Unreachable: no pages link here')
    }

    // Orphan elements (button/hotspot with no link)
    ;(pg.elements || []).forEach(el => {
      if ((el.type === 'button' || el.type === 'hotspot') &&
          el.action === 'goto' && !el.linkTarget) {
        infos.push(`Orphan element: ${el.type} has no link target`)
      }
    })

    return { errors, warnings, infos }
  })
}

// ─── Compute node positions ────────────────────────────────────────────────────

function computePositions(pages) {
  const cols = Math.min(4, Math.ceil(Math.sqrt(pages.length + 1)))

  // First pass: collect actual node heights
  const nodeHeights = pages.map(pg =>
    NODE_H_BASE + (pg.elements?.length || 0) * EL_ROW_H + TIMING_ROW
  )

  // Max height per row
  const rowHeights = {}
  pages.forEach((_, i) => {
    const row = Math.floor(i / cols)
    rowHeights[row] = Math.max(rowHeights[row] || 0, nodeHeights[i])
  })

  // Cumulative row y-offsets
  const rowY = {}
  let cumY = MARGIN
  Object.keys(rowHeights).sort((a, b) => a - b).forEach(r => {
    rowY[r] = cumY
    cumY += rowHeights[r] + ROW_GAP
  })

  return pages.map((_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      x: MARGIN + col * (NODE_W + COL_GAP),
      y: rowY[row],
      w: NODE_W,
      h: nodeHeights[i],
    }
  })
}

// ─── Edge colour by type ──────────────────────────────────────────────────────

const EDGE_COLORS = {
  'auto':        '#4a8fc0',
  'click':       '#3cb8be',
  'after-play':  '#a060d0',
  'conditional': '#e8a020',
  'error':       '#d04040',
}

function edgeColor(type, broken) {
  if (broken) return EDGE_COLORS.error
  return EDGE_COLORS[type] || '#4a8fc0'
}

// ─── SVG cubic-bezier path between two points ────────────────────────────────

function cubicPath(x1, y1, x2, y2, isSelfLoop) {
  if (isSelfLoop) {
    // Route below the node
    const r = 36
    return `M ${x1} ${y1} C ${x1 + r} ${y1 + 60} ${x2 + r} ${y2 + 60} ${x2} ${y2}`
  }
  const dx = Math.abs(x2 - x1)
  const ctrl = Math.max(60, dx * 0.45)
  return `M ${x1} ${y1} C ${x1 + ctrl} ${y1} ${x2 - ctrl} ${y2} ${x2} ${y2}`
}

// ─── Dim a hex colour to given opacity over dark ──────────────────────────────

function dimColor(hex, opacity = 0.3) {
  if (!hex || !hex.startsWith('#')) return `rgba(13,16,32,0.85)`
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return `rgba(${r},${g},${b},${opacity})`
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScriptFlowEditor({ pages = [], onClose, onNavigatePage }) {
  const containerRef  = useRef(null)
  const graphRef      = useRef(null)

  const [zoom,   setZoom]   = useState(1)
  const [pan,    setPan]    = useState({ x: 0, y: 0 })
  const [selectedPage, setSelectedPage]     = useState(null)
  const [selectedEl,   setSelectedEl]       = useState(null)   // { pageIdx, elIdx }
  const [hoveredEdge,  setHoveredEdge]      = useState(null)
  const [tooltip,      setTooltip]          = useState(null)   // { x, y, text }
  const [isDragging,   setIsDragging]       = useState(false)
  const dragStart     = useRef(null)

  // Derived data (memoised so it only recomputes when pages change)
  const positions = useMemo(() => computePositions(pages), [pages])
  const edges     = useMemo(() => buildEdges(pages),       [pages])
  const pageErrors = useMemo(() => analyzeErrors(pages, edges), [pages, edges])

  // Total canvas dimensions
  const canvasW = useMemo(() => {
    if (!positions.length) return 800
    return Math.max(...positions.map(p => p.x + p.w)) + MARGIN
  }, [positions])
  const canvasH = useMemo(() => {
    if (!positions.length) return 600
    return Math.max(...positions.map(p => p.y + p.h)) + MARGIN
  }, [positions])

  // Error / warning badge totals
  const totalErrors   = pageErrors.reduce((s, p) => s + p.errors.length,   0)
  const totalWarnings = pageErrors.reduce((s, p) => s + p.warnings.length, 0)

  // ── Fit-all ──────────────────────────────────────────────────────────────

  const fitAll = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const availW = rect.width  - 40
    const availH = rect.height - 40
    const scaleW = availW / canvasW
    const scaleH = availH / canvasH
    const newZoom = Math.min(1, scaleW, scaleH)
    setZoom(newZoom)
    setPan({ x: 0, y: 0 })
  }, [canvasW, canvasH])

  // Auto fit-all on mount
  useLayoutEffect(() => { fitAll() }, [fitAll])

  // ── Pan / zoom handlers ───────────────────────────────────────────────────

  const onWheel = useCallback(e => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setZoom(z => Math.min(3, Math.max(0.3, z + delta)))
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const onMouseDown = useCallback(e => {
    if (e.target !== containerRef.current && e.target !== graphRef.current) return
    setIsDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }, [pan])

  const onMouseMove = useCallback(e => {
    if (!isDragging || !dragStart.current) return
    const dx = (e.clientX - dragStart.current.mx) / zoom
    const dy = (e.clientY - dragStart.current.my) / zoom
    setPan({ x: dragStart.current.px + dx, y: dragStart.current.py + dy })
  }, [isDragging, zoom])

  const onMouseUp = useCallback(() => {
    setIsDragging(false)
    dragStart.current = null
  }, [])

  // ── Node card click ───────────────────────────────────────────────────────

  const handlePageClick = useCallback((idx, e) => {
    e.stopPropagation()
    setSelectedPage(idx)
    setSelectedEl(null)
    onNavigatePage?.(idx)
  }, [onNavigatePage])

  const handleElClick = useCallback((pgIdx, elIdx, e) => {
    e.stopPropagation()
    setSelectedPage(pgIdx)
    setSelectedEl({ pgIdx, elIdx })
  }, [])

  // ── Sidebar: scroll/pan to a page card ────────────────────────────────────

  const panToPage = useCallback((idx) => {
    const pos = positions[idx]
    if (!pos || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const cx = rect.width  / 2 / zoom
    const cy = rect.height / 2 / zoom
    setPan({ x: cx - pos.x - pos.w / 2, y: cy - pos.y - pos.h / 2 })
    setSelectedPage(idx)
  }, [positions, zoom])

  // ── Edge tooltip ──────────────────────────────────────────────────────────

  const handleEdgeMouseEnter = useCallback((e, edge) => {
    setHoveredEdge(edge)
    const r = containerRef.current?.getBoundingClientRect()
    if (r) setTooltip({ x: e.clientX - r.left, y: e.clientY - r.top, edge })
  }, [])

  const handleEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null)
    setTooltip(null)
  }, [])

  // ── Render SVG arrows ─────────────────────────────────────────────────────

  const renderEdges = () => {
    const MARKER_ID_PREFIX = 'arrow-'
    const usedColors = new Set(edges.map(e =>
      edgeColor(e.type, e.to === -1 || e.to === -2)
    ))

    return (
      <svg
        style={{
          position: 'absolute', left: 0, top: 0,
          width: canvasW, height: canvasH,
          pointerEvents: 'none', overflow: 'visible',
        }}
      >
        <defs>
          {[...usedColors].map(color => (
            <marker
              key={color}
              id={`${MARKER_ID_PREFIX}${color.replace('#', '')}`}
              markerWidth="8" markerHeight="8"
              refX="6" refY="3" orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill={color} />
            </marker>
          ))}
        </defs>

        {edges.map((edge, ei) => {
          const broken = edge.to === -1
          const isQuit = edge.to === -2
          if (isQuit) return null // quit has no target card
          if (edge.to >= pages.length) return null // out-of-bounds

          const fromPos = positions[edge.from]
          if (!fromPos) return null
          const toPos   = edge.to >= 0 ? positions[edge.to] : null
          if (!toPos && !broken) return null

          const color   = edgeColor(edge.type, broken)
          const markerId = `${MARKER_ID_PREFIX}${color.replace('#', '')}`
          const isHovered = hoveredEdge === edge
          const isSelf  = edge.from === edge.to

          // Source: right-center of from node + 8px
          const x1 = fromPos.x + fromPos.w + 8
          const y1 = fromPos.y + fromPos.h / 2

          // Target: left-center of to node − 8px (or same node bottom for self-loop)
          const x2 = isSelf
            ? fromPos.x + fromPos.w / 2
            : (broken ? x1 + 80 : toPos.x - 8)
          const y2 = isSelf
            ? fromPos.y + fromPos.h + 20
            : (broken ? y1 + 40 : toPos.y + toPos.h / 2)

          const d = cubicPath(x1, y1, x2, y2, isSelf)
          // Approximate bezier midpoint for label placement
          const lx = isSelf ? x1 + 50 : (x1 + x2) / 2
          const ly = isSelf ? y1 + 50 : (y1 + y2) / 2

          return (
            <g key={ei} style={{ pointerEvents: 'all' }}
               onMouseEnter={ev => handleEdgeMouseEnter(ev, edge)}
               onMouseLeave={handleEdgeMouseLeave}>
              {/* wider invisible hit area */}
              <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
              <path
                d={d} fill="none"
                stroke={isHovered ? '#ffffff' : color}
                strokeWidth={isHovered ? 2.5 : 1.8}
                strokeDasharray={broken ? '6 3' : undefined}
                markerEnd={`url(#${markerId})`}
                opacity={isHovered ? 1 : 0.8}
              />
              {edge.label && (
                <text
                  x={lx} y={ly - 6}
                  fill={isHovered ? '#ffffff' : color}
                  fontSize="10" textAnchor="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {edge.label.length > 22 ? edge.label.slice(0, 20) + '…' : edge.label}
                </text>
              )}
              {broken && (
                <text x={x2 + 6} y={y2 + 4} fill="#d04040" fontSize="11">⚠</text>
              )}
            </g>
          )
        })}
      </svg>
    )
  }

  // ── Render a single page node card ────────────────────────────────────────

  const renderNode = (pg, idx) => {
    const pos    = positions[idx]
    if (!pos) return null
    const errs   = pageErrors[idx]
    const isSelected = selectedPage === idx
    const hasErr = errs.errors.length > 0
    const hasWarn = errs.warnings.length > 0

    let borderColor = '#1e3a5a'
    let boxShadow   = 'none'
    if (hasErr) {
      borderColor = '#d04040'
      boxShadow   = '0 0 10px 2px rgba(208,64,64,0.45)'
    } else if (hasWarn) {
      borderColor = '#c08020'
      boxShadow   = '0 0 8px 2px rgba(192,128,32,0.35)'
    } else if (isSelected) {
      borderColor = '#3cb8be'
      boxShadow   = '0 0 0 1.5px #3cb8be'
    }

    const headerBg = dimColor(pg.bgColor, 0.3)
    const t = pg.timing
    const timingLabel = t
      ? `⏱ ${t.duration ?? '?'}s | mode: ${t.mode || 'manual'}`
      : '⏱ no timing'

    const totalBadge = errs.errors.length + errs.warnings.length
    const outEdges = edges.filter(e => e.from === idx)

    return (
      <div
        key={pg.id || idx}
        onClick={e => handlePageClick(idx, e)}
        style={{
          position: 'absolute',
          left: pos.x, top: pos.y,
          width: pos.w, height: pos.h,
          border: `1.5px solid ${borderColor}`,
          borderRadius: 7,
          background: '#111828',
          boxShadow,
          cursor: 'pointer',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui, "Segoe UI", sans-serif)',
          fontSize: 12,
          color: '#cdd6e8',
          userSelect: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* ─ Header ─ */}
        <div style={{
          height: NODE_H_BASE,
          background: headerBg,
          borderBottom: '1px solid #1e3a5a',
          padding: '6px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: isSelected ? '#3cb8be' : '#4a6a8a',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{
            fontWeight: 600, color: '#e0ecff', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {pg.name || `Page ${idx + 1}`}
            <span style={{ color: '#6070a0', fontWeight: 400, marginLeft: 6 }}>
              #{idx + 1}
            </span>
          </span>
          {totalBadge > 0 && (
            <span style={{
              background: hasErr ? '#d04040' : '#c08020',
              color: '#fff', borderRadius: 10,
              padding: '1px 6px', fontSize: 10, fontWeight: 700,
            }}>
              {totalBadge}
            </span>
          )}
        </div>

        {/* ─ Timing row ─ */}
        <div style={{
          height: TIMING_ROW,
          background: '#0d1020',
          padding: '3px 10px',
          borderBottom: '1px solid #192038',
          color: '#6888aa', fontSize: 11,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>{timingLabel}</span>
          {pg.bgColor && (
            <span style={{
              width: 12, height: 12, borderRadius: 3,
              background: pg.bgColor, border: '1px solid #334',
              display: 'inline-block', flexShrink: 0,
            }} />
          )}
          {outEdges.length > 0 && (
            <span style={{ marginLeft: 'auto', color: '#3cb8be', fontSize: 10 }}>
              {outEdges.length} link{outEdges.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ─ Element rows ─ */}
        {(pg.elements || []).map((el, elIdx) => {
          const isElSel = selectedEl?.pgIdx === idx && selectedEl?.elIdx === elIdx
          const summary = elActionSummary(el)
          const label   = el.name || el.text?.slice(0, 18) || el.mediaName || `el ${elIdx + 1}`

          return (
            <div
              key={elIdx}
              onClick={e => handleElClick(idx, elIdx, e)}
              style={{
                height: EL_ROW_H,
                padding: '0 10px',
                display: 'flex', alignItems: 'center', gap: 6,
                background: isElSel ? '#1a2a44' : 'transparent',
                borderBottom: '1px solid #141c2e',
                cursor: 'default',
              }}
            >
              <span style={{ flexShrink: 0, fontSize: 13 }}>{elTypeIcon(el)}</span>
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: '#b0c4de',
              }}>
                {label.length > 18 ? label.slice(0, 17) + '…' : label}
              </span>
              {summary && (
                <span style={{
                  flexShrink: 0, fontSize: 10,
                  color: '#6888aa', maxWidth: 110,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {summary}
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const renderSidebar = () => (
    <div style={{
      width: 200, flexShrink: 0,
      background: '#080b18',
      borderRight: '1px solid #1a2440',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Page list */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '8px 0',
      }}>
        <div style={{ padding: '4px 12px 6px', color: '#4a6a8a', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
          PAGES
        </div>
        {pages.map((pg, idx) => {
          const errs  = pageErrors[idx]
          const haserr = errs.errors.length > 0
          const haswrn = errs.warnings.length > 0
          const isSel  = selectedPage === idx
          return (
            <div
              key={idx}
              onClick={() => panToPage(idx)}
              style={{
                padding: '5px 12px',
                cursor: 'pointer',
                background: isSel ? '#132840' : 'transparent',
                borderLeft: `3px solid ${isSel ? '#3cb8be' : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: 6,
                color: isSel ? '#e0f4ff' : '#8ca8cc',
                fontSize: 12,
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {idx + 1}. {pg.name || `Page ${idx + 1}`}
              </span>
              {haserr && <span style={{ color: '#d04040', fontSize: 10 }}>●</span>}
              {!haserr && haswrn && <span style={{ color: '#c08020', fontSize: 10 }}>●</span>}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1a2440' }}>
        <div style={{ color: '#4a6a8a', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
          EDGE TYPES
        </div>
        {Object.entries(EDGE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 20, height: 2, background: color, display: 'inline-block' }} />
            <span style={{ color: '#7090b0', fontSize: 10 }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Error list */}
      {(totalErrors + totalWarnings) > 0 && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #1a2440', maxHeight: 180, overflowY: 'auto' }}>
          <div style={{ color: '#4a6a8a', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
            ISSUES
          </div>
          {pageErrors.flatMap((errs, idx) => [
            ...errs.errors.map((msg, mi) => (
              <div key={`e${idx}-${mi}`}
                   onClick={() => panToPage(idx)}
                   style={{ color: '#d04040', fontSize: 10, marginBottom: 3, cursor: 'pointer' }}>
                ⛔ Pg {idx + 1}: {msg}
              </div>
            )),
            ...errs.warnings.map((msg, mi) => (
              <div key={`w${idx}-${mi}`}
                   onClick={() => panToPage(idx)}
                   style={{ color: '#c08020', fontSize: 10, marginBottom: 3, cursor: 'pointer' }}>
                ⚠ Pg {idx + 1}: {msg}
              </div>
            )),
          ])}
        </div>
      )}
    </div>
  )

  // ── Toolbar ───────────────────────────────────────────────────────────────

  const toolbar = useMemo(() => (
    <div style={{
      height: 40, flexShrink: 0,
      background: '#060810',
      borderBottom: '1px solid #1a2440',
      display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 10,
    }}>
      {/* Title */}
      <span style={{ color: '#3cb8be', fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
        🔀 Script Flow Editor
      </span>

      {/* Badge counts */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {totalErrors > 0 && (
          <span style={{
            background: '#d04040', color: '#fff',
            borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700,
          }}>
            ⛔ {totalErrors} error{totalErrors !== 1 ? 's' : ''}
          </span>
        )}
        {totalWarnings > 0 && (
          <span style={{
            background: '#c08020', color: '#fff',
            borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700,
          }}>
            ⚠ {totalWarnings} warning{totalWarnings !== 1 ? 's' : ''}
          </span>
        )}
        {totalErrors === 0 && totalWarnings === 0 && (
          <span style={{ color: '#3a6a40', fontSize: 11 }}>✔ No issues</span>
        )}
        <span style={{ color: '#3a5070', fontSize: 11 }}>
          {pages.length} page{pages.length !== 1 ? 's' : ''} · {edges.length} edge{edges.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Zoom / Fit / Close */}
      <button
        onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}
        title="Zoom out"
        style={{
          background: '#111828', color: '#8ab0d0',
          border: '1px solid #2a4060', borderRadius: 4,
          padding: '3px 10px', cursor: 'pointer', fontSize: 12,
        }}
      >
        −
      </button>
      <button
        onClick={() => setZoom(z => Math.min(3, z + 0.15))}
        title="Zoom in"
        style={{
          background: '#111828', color: '#8ab0d0',
          border: '1px solid #2a4060', borderRadius: 4,
          padding: '3px 10px', cursor: 'pointer', fontSize: 12,
        }}
      >
        +
      </button>
      <button
        onClick={fitAll}
        title="Fit all pages"
        style={{
          background: '#111828', color: '#8ab0d0',
          border: '1px solid #2a4060', borderRadius: 4,
          padding: '3px 10px', cursor: 'pointer', fontSize: 12,
        }}
      >
        Fit All
      </button>
      <span style={{ color: '#3a5070', fontSize: 11 }}>{Math.round(zoom * 100)}%</span>
      <button
        onClick={onClose}
        title="Close"
        style={{
          background: '#1a1020', color: '#d06060',
          border: '1px solid #4a1a1a', borderRadius: 4,
          padding: '3px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
        }}
      >
        ✕
      </button>
    </div>
  ), [totalErrors, totalWarnings, pages.length, edges.length, zoom, fitAll, onClose])

  // ── Tooltip ───────────────────────────────────────────────────────────────

  const renderTooltip = () => {
    if (!tooltip || !tooltip.edge) return null
    const { x, y, edge } = tooltip
    const from = pages[edge.from]?.name || `Page ${edge.from + 1}`
    const to   = edge.to >= 0 ? (pages[edge.to]?.name || `Page ${edge.to + 1}`)
                              : edge.to === -2 ? 'Quit' : '⛔ Broken'
    return (
      <div style={{
        position: 'absolute', left: x + 14, top: y - 10,
        background: '#0d1828', border: '1px solid #2a4060',
        borderRadius: 5, padding: '6px 10px', pointerEvents: 'none',
        fontSize: 11, color: '#b0cce8', zIndex: 100,
        boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
        maxWidth: 220,
      }}>
        <div><strong style={{ color: '#3cb8be' }}>{edge.type}</strong></div>
        <div>From: {from}</div>
        <div>To: {to}</div>
        {edge.label && <div style={{ color: '#8aaacc' }}>{edge.label}</div>}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: '#0a0c14',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-ui, "Segoe UI", sans-serif)',
      }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {toolbar}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {renderSidebar()}

        {/* Canvas area */}
        <div
          ref={containerRef}
          style={{
            flex: 1, position: 'relative',
            overflow: 'hidden',
            background: '#0d1020',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={onMouseDown}
        >
          {/* Dot-grid background */}
          <svg style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', opacity: 0.18,
          }}>
            <defs>
              <pattern id="dot-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#4a6a8a" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dot-grid)" />
          </svg>

          {/* Graph container (transformed for pan+zoom) */}
          <div
            ref={graphRef}
            style={{
              position: 'absolute',
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0',
              width: canvasW,
              height: canvasH,
            }}
          >
            {/* SVG edges layer (underneath nodes) */}
            {renderEdges()}

            {/* Node cards */}
            {pages.map((pg, idx) => renderNode(pg, idx))}
          </div>

          {/* Tooltip (in canvas coordinates, not graph coordinates) */}
          {renderTooltip()}

          {/* Empty-state hint */}
          {pages.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2a4060', fontSize: 18, pointerEvents: 'none',
            }}>
              No pages in script yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
