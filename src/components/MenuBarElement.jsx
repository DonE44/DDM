// @ts-check
import { useState, useEffect, useCallback, useRef } from 'react'

function ignoreError() {}

// ─── AutoPlayVideo ─────────────────────────────────────────────────────────────
// React's autoPlay attribute alone is unreliable — we also call .play() via ref.
/** Module-level cache: data URL → blob URL (avoids repeated re-encoding on re-render) */
const _dataUrlBlobCache = new Map()

/** Resolve any URL to something a video element can play quickly in Electron.
 *  - blob: URL → use as-is
 *  - http://127.0.0.1: → use as-is (local media server, supports range requests, streams fast)
 *  - data:video/ → convert to blob URL once, cache for re-use
 *  - anything else → fetch → blob URL
 */
async function resolveVideoSrc(src) {
  if (!src) return ''
  if (src.startsWith('blob:') || src.startsWith('http://127.0.0.1:')) return src
  if (_dataUrlBlobCache.has(src)) return _dataUrlBlobCache.get(src)
  try {
    const resp = await fetch(src)
    if (!resp.ok) throw new Error('fetch failed')
    const blob = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    if (src.startsWith('data:')) _dataUrlBlobCache.set(src, blobUrl)
    return blobUrl
  } catch {
    return src
  }
}

function AutoPlayVideo({ src, style }) {
  const ref = useRef(null)
  const blobRef = useRef(null)

  useEffect(() => {
    const vid = ref.current
    if (!vid || !src) return
    let cancelled = false

    async function load() {
      const playableSrc = await resolveVideoSrc(src)
      if (cancelled) return
      // Track blob URL only if we created it (not a cached/shared one)
      if (playableSrc !== src && !_dataUrlBlobCache.has(src)) blobRef.current = playableSrc
      vid.src = playableSrc
      vid.play().catch(ignoreError)  // play() triggers load; no need for vid.load()
    }

    load()
    return () => {
      cancelled = true
      try { vid.pause(); vid.src = '' } catch { ignoreError() }
      if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null }
    }
  }, [src])

  return <video ref={ref} muted loop playsInline style={style} />
}

// --- VideoChromaCanvas ---
// Renders video with real-time chroma key and/or shape masking.
// Uses Canvas 2D (CPU per-pixel) -- reliable in Electron (no WebGL texImage2D(video) issues).
// For a logo-sized canvas (<=128px tall) the CPU loop runs in < 1ms per frame.
function VideoChromaCanvas({ src, chromaColor, tolerance, softness, maskShape, style }) {
  const canvasRef = useRef(null)
  const vidRef    = useRef(null)
  const blobRef   = useRef(null)
  const rafRef    = useRef(null)
  const chromaRef = useRef(chromaColor)
  const tolRef    = useRef(tolerance)
  const softRef   = useRef(softness)
  const maskRef   = useRef(maskShape)

  useEffect(() => {
    chromaRef.current = chromaColor
    tolRef.current = tolerance
    softRef.current = softness
    maskRef.current = maskShape
  }, [chromaColor, tolerance, softness, maskShape])

  function parseHex(hex) {
    const h = (hex || '#000000').replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !src) return
    let cancelled = false
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null }
    if (vidRef.current) {
      try { vidRef.current.pause(); vidRef.current.src = '' } catch { ignoreError() }
      try { if (document.body.contains(vidRef.current)) document.body.removeChild(vidRef.current) } catch { ignoreError() }
      vidRef.current = null
    }
    const vid = document.createElement('video')
    vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = 'auto'
    vid.style.cssText = 'position:fixed;top:-2000px;left:-2000px;width:128px;height:72px;pointer-events:none;z-index:-32767'
    document.body.appendChild(vid)
    vidRef.current = vid
    const ctx = canvas.getContext('2d')

    function renderLoop() {
      if (cancelled) return
      if (vid.readyState >= 2 && vid.videoWidth && vid.videoHeight) {
        const cw = canvas.width, ch = canvas.height
        if (cw > 0 && ch > 0) {
          ctx.clearRect(0, 0, cw, ch)
          ctx.drawImage(vid, 0, 0, cw, ch)
          const cc   = chromaRef.current
          const ms   = maskRef.current
          const tol  = tolRef.current  != null ? tolRef.current  : 30
          const soft = Math.max(softRef.current != null ? softRef.current : 8, 1)
          if (cc || ms) {
            let imgData
            try { imgData = ctx.getImageData(0, 0, cw, ch) } catch { rafRef.current = requestAnimationFrame(renderLoop); return }
            const px = imgData.data
            let kr = 0, kg = 0, kb = 0
            if (cc) [kr, kg, kb] = parseHex(cc)
            for (let y = 0; y < ch; y++) {
              for (let x = 0; x < cw; x++) {
                const i = (y * cw + x) * 4
                let a = px[i + 3]
                if (ms && a > 0) {
                  const nx = x / cw, ny = y / ch
                  let inside
                  if (ms.type === 'rect') {
                    inside = nx >= ms.x && nx <= ms.x + ms.w && ny >= ms.y && ny <= ms.y + ms.h
                  } else {
                    const dx = (nx - (ms.x + ms.w / 2)) / (ms.w / 2)
                    const dy = (ny - (ms.y + ms.h / 2)) / (ms.h / 2)
                    inside = dx * dx + dy * dy <= 1
                  }
                  if (!inside) a = 0
                }
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

    async function setup() {
      // Resolve URL to something video element can play fast
      // http://127.0.0.1: → use directly (local HTTP server, no IPC needed)
      // data:/blob: → handled by resolveVideoSrc (cache-aware)
      let playableSrc = src
      if (!src.startsWith('blob:') && !src.startsWith('http://127.0.0.1:')) {
        const resolved = await resolveVideoSrc(src)
        if (cancelled) return
        if (resolved !== src) blobRef.current = resolved
        playableSrc = resolved
      }

      if (cancelled) return

      // Set canvas to a default size so it can start rendering immediately
      canvas.width  = 128
      canvas.height = 72

      vid.src = playableSrc
      vid.play().catch(ignoreError)

      // Update canvas dimensions when video metadata is known
      vid.addEventListener('loadedmetadata', () => {
        if (cancelled) return
        const vw = vid.videoWidth  || 640
        const vh = vid.videoHeight || 360
        const H  = 128
        canvas.width  = Math.round(H * vw / vh)
        canvas.height = H
      }, { once: true })

      // Start RAF immediately — renderLoop handles readyState < 2 gracefully
      rafRef.current = requestAnimationFrame(renderLoop)
    }

    setup()

    return () => {
      cancelled = true
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      try { vid.pause(); vid.src = '' } catch { ignoreError() }
      try { if (document.body.contains(vid)) document.body.removeChild(vid) } catch { ignoreError() }
      if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null }
      vidRef.current = null
    }
  }, [src])

  return <canvas ref={canvasRef} style={{ ...style, background: 'transparent' }} />
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isVideoDataUrl(src) {
  if (typeof src !== 'string') return false
  if (src.startsWith('data:video/') || src.startsWith('blob:')) return true
  // http://127.0.0.1 media server URLs — detect by extension
  const VIDEO_EXTS = /\.(mp4|webm|mov|ogv|ogg|m4v|avi)(\?|$)/i
  return VIDEO_EXTS.test(src)
}

/**
 * MenuBarElement — renders a menubar element in editor (static preview)
 * or presenter (fully interactive) mode.
 *
 * @param {{
 *   el: object,
 *   isEditor?: boolean,
 *   stageWidth?: number,
 *   stageHeight?: number,
 *   onNavigate?: (target: string) => void,
 *   zoom?: number
 * }} props
 */
export default function MenuBarElement({
  el,
  isEditor = false,
  stageWidth = 1920,
  stageHeight = 1080,
  onNavigate,
}) {
  const s = el?.style || {}
  const position = el?.position || 'top'
  const items = el?.items || []

  const [openItem, setOpenItem] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [hoveredSub, setHoveredSub] = useState(null)
  const closeTimerRef = useRef(null)
  const itemRefs = useRef({})

  const isVertical = position === 'left' || position === 'right'
  const barHeight = s.barHeight || 56
  const barWidth = s.barWidth || 220

  // ── ESC to close ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isEditor) return
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpenItem(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isEditor])

  // ── Click outside to close ─────────────────────────────────────────────────
  useEffect(() => {
    if (isEditor || !openItem) return
    const handleDown = (e) => {
      if (!e.target.closest('[data-menubar]')) setOpenItem(null)
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [isEditor, openItem])

  // ── Close-timer helpers ────────────────────────────────────────────────────
  const clearClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    clearClose()
    closeTimerRef.current = setTimeout(() => setOpenItem(null), 160)
  }, [clearClose])

  // ── Background builder ─────────────────────────────────────────────────────
  const buildBg = (gradEnabled, from, to, angle, solid) => {
    if (gradEnabled) {
      return `linear-gradient(${angle ?? 180}deg, ${from || solid || '#1a1a2e'}, ${to || solid || '#1a1a2e'})`
    }
    return solid || '#1a1a2e'
  }

  // ── Container position & size ──────────────────────────────────────────────
  // In the EDITOR: the stage already applies CSS transform:scale(zoom), and the
  // element wrapper div (class="elem") is already positioned/sized at el.x/el.y/el.w/el.h.
  // MenuBarElement just needs to fill that wrapper: position absolute, inset 0.
  //
  // In the PRESENTER: MenuBarElement is rendered directly on the stage (no wrapper),
  // so we position it ourselves using el.x/el.y/el.w/el.h.
  //
  // Either way: NO zoom multiplication needed here — stage CSS transform handles it.
  const elW = el?.w || (isVertical ? barWidth : stageWidth)
  const elH = el?.h || (isVertical ? stageHeight : barHeight)
  const elX = el?.x || (position === 'right' ? stageWidth - barWidth : 0)
  const elY = el?.y || (position === 'bottom' ? stageHeight - barHeight : 0)

  // ── Border per position ────────────────────────────────────────────────────
  const positionBorder = {}
  if (position === 'top' && s.borderBottom) positionBorder.borderBottom = s.borderBottom
  if (position === 'bottom' && s.borderTop) positionBorder.borderTop = s.borderTop
  if (position === 'left' && s.borderRight) positionBorder.borderRight = s.borderRight
  if (position === 'right' && s.borderLeft) positionBorder.borderLeft = s.borderLeft

  // ── Main container style ───────────────────────────────────────────────────
  const containerStyle = /** @type {import('react').CSSProperties} */ ({
    position: 'absolute',
    // Editor: fill the element wrapper (wrapper already handles x/y/w/h)
    // Presenter: position ourselves on the stage using el coords
    ...(isEditor
      ? { left: 0, top: 0, width: '100%', height: '100%' }
      : { left: elX, top: elY, width: elW, height: elH }),
    overflow: 'visible', // dropdowns must extend beyond the bar bounds
    zIndex: s.zIndex || 1000,
    background: buildBg(s.bgGradientEnabled, s.bgGradientFrom, s.bgGradientTo, s.bgGradientAngle, s.bgColor),
    display: 'flex',
    flexDirection: isVertical ? 'column' : 'row',
    alignItems: isVertical ? 'stretch' : 'center',
    fontFamily: s.fontFamily || 'sans-serif',
    fontSize: s.fontSize || 14,
    boxSizing: 'border-box',
    ...positionBorder,
  })

  // ── Items flex container ───────────────────────────────────────────────────
  const itemsWrapStyle = /** @type {import('react').CSSProperties} */ ({
    display: 'flex',
    flexDirection: isVertical ? 'column' : 'row',
    alignItems: isVertical ? 'stretch' : 'center',
    flex: 1,
    gap: s.itemGap || 0,
    ...(isVertical ? { overflowY: 'auto', overflowX: 'visible' } : {}),
  })

  // ── Dropdown entry transform per animation type ────────────────────────────
  const getDropdownTransform = () => {
    const anim = s.dropdownAnimation || 'slide'
    switch (anim) {
      case 'slide':       return 'translateY(-8px)'
      case 'slide-up':    return 'translateY(8px)'
      case 'slide-right': return 'translateX(-10px)'
      case 'slide-left':  return 'translateX(10px)'
      case 'scale':       return 'scale(0.95) translateY(-6px)'
      default:            return 'translateY(-8px)' // fade
    }
  }

  // ── Dropdown positioning relative to the triggering item ──────────────────
  // The dropdown is rendered INSIDE the item div (position:relative),
  // so "100%" refers to the item's own dimension.
  const getDropdownPos = () => {
    switch (position) {
      case 'top':    return { top: '100%', left: 0 }
      case 'bottom': return { bottom: '100%', left: 0 }
      case 'left':   return { top: 0, left: '100%' }
      case 'right':  return { top: 0, right: '100%' }
      default:       return { top: '100%', left: 0 }
    }
  }

  // ── Render a dropdown panel for one top-level item ─────────────────────────
  const renderDropdown = (item) => {
    if (!item.children?.length || isEditor) return null
    const isOpen = openItem === item.id

    const ddBg = buildBg(
      s.dropdownBgGradientEnabled,
      s.dropdownBgGradientFrom,
      s.dropdownBgGradientTo,
      180,
      s.dropdownBg,
    )

    const ddStyle = /** @type {import('react').CSSProperties} */ ({
      position: 'absolute',
      ...getDropdownPos(),
      background: ddBg,
      border: `${s.dropdownBorderWidth || 1}px solid ${s.dropdownBorderColor || 'rgba(255,255,255,0.2)'}`,
      boxShadow: s.dropdownShadow || '0 8px 32px rgba(0,0,0,0.4)',
      padding: typeof s.dropdownPadding === 'number' ? s.dropdownPadding : 24,
      display: 'flex',
      flexDirection: isVertical ? 'column' : 'row',
      gap: s.dropdownColumnGap || 32,
      minWidth: s.dropdownMinWidth || 200,
      zIndex: 9999,
      // CSS transition: mount then reveal for smooth enter
      opacity: isOpen ? 1 : 0,
      transform: isOpen ? 'none' : getDropdownTransform(),
      pointerEvents: isOpen ? 'auto' : 'none',
      transition: 'opacity 0.18s ease, transform 0.18s ease',
      boxSizing: 'border-box',
    })

    return (
      <div
        style={ddStyle}
        onMouseEnter={clearClose}
        onMouseLeave={scheduleClose}
      >
        {item.children.map((group) => (
          <div key={group.id} style={{ minWidth: 140 }}>
            {group.groupLabel && (
              <div
                style={{
                  color: s.dropdownGroupColor || '#888',
                  fontSize: s.dropdownGroupFontSize || 11,
                  fontWeight: s.dropdownGroupFontWeight || '700',
                  letterSpacing: s.dropdownGroupLetterSpacing || '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                  paddingBottom: 6,
                  borderBottom: s.separatorEnabled
                    ? `1px solid ${s.separatorColor || 'rgba(255,255,255,0.15)'}`
                    : 'none',
                  fontFamily: s.fontFamily || 'sans-serif',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.groupLabel}
              </div>
            )}
            {group.items?.map((subItem) => {
              const isSubHovered = hoveredSub === subItem.id
              return (
                <div
                  key={subItem.id}
                  style={{
                    padding: '7px 10px',
                    cursor: 'pointer',
                    color: isSubHovered
                      ? (s.dropdownItemHoverColor || '#ffffff')
                      : (s.dropdownColor || '#e0e0e0'),
                    background: isSubHovered
                      ? (s.dropdownItemHoverBg || 'rgba(255,255,255,0.1)')
                      : 'transparent',
                    fontSize: s.dropdownItemFontSize || 13,
                    fontWeight: s.dropdownItemFontWeight || '400',
                    fontFamily: s.fontFamily || 'sans-serif',
                    borderRadius: 4,
                    transition: 'background 0.12s ease, color 0.12s ease',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                  onMouseEnter={() => setHoveredSub(subItem.id)}
                  onMouseLeave={() => setHoveredSub(null)}
                  onClick={() => {
                    setOpenItem(null)
                    onNavigate?.(subItem.target || subItem.label)
                  }}
                >
                  {subItem.label}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  // ── Render one top-level menu item ─────────────────────────────────────────
  const renderItem = (item) => {
    const isOpen = openItem === item.id
    const isHov = hovered === item.id
    const active = isOpen || isHov
    const hasChildren = Boolean(item.children?.length)

    const itemStyle = /** @type {import('react').CSSProperties} */ ({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: isVertical ? 'flex-start' : 'center',
      padding: `${s.itemPaddingV || 12}px ${s.itemPaddingH || 20}px`,
      cursor: isEditor ? 'default' : 'pointer',
      color: active ? (s.itemHoverColor || '#ffffff') : (s.itemColor || '#e0e0e0'),
      background: active ? (s.itemHoverBg || 'rgba(255,255,255,0.1)') : 'transparent',
      fontSize: s.fontSize || 14,
      fontWeight: s.fontWeight || '600',
      fontFamily: s.fontFamily || 'sans-serif',
      letterSpacing: s.letterSpacing || 'normal',
      textTransform: s.textTransform || 'none',
      whiteSpace: 'nowrap',
      transition: 'background 0.15s ease, color 0.15s ease',
      gap: 6,
      userSelect: 'none',
      flexShrink: 1,   // allow items to shrink within available bar width
      minWidth: 0,
      // underline on hover
      borderBottom: (!isVertical && s.itemUnderlineOnHover && isHov)
        ? `2px solid ${s.itemUnderlineColor || '#fff'}`
        : (!isVertical && s.itemUnderlineOnHover)
          ? '2px solid transparent'
          : undefined,
    })

    const presenterHandlers = isEditor ? {} : {
      onMouseEnter: () => {
        clearClose()
        setHovered(item.id)
        if (hasChildren) setOpenItem(item.id)
      },
      onMouseLeave: () => {
        setHovered(null)
        if (hasChildren) scheduleClose()
      },
      onClick: () => {
        if (!hasChildren) onNavigate?.(item.target || item.label)
      },
    }

    return (
      <div
        key={item.id}
        ref={(node) => { itemRefs.current[item.id] = node }}
        style={itemStyle}
        data-menubar="item"
        {...presenterHandlers}
      >
        {item.icon ? <span style={{ marginRight: 4 }}>{item.icon}</span> : null}
        <span>{item.label}</span>
        {hasChildren && (
          <span
            style={{
              marginLeft: 4,
              fontSize: 9,
              opacity: 0.65,
              display: 'inline-block',
              transform: isVertical
                ? (isOpen ? 'rotate(90deg)' : 'rotate(0deg)')
                : (isOpen ? 'rotate(180deg)' : 'rotate(0deg)'),
              transition: 'transform 0.15s ease',
            }}
          >
            {isVertical ? '▶' : '▾'}
          </span>
        )}
        {/* Dropdown always rendered (opacity:0 when closed) for CSS transitions */}
        {hasChildren && renderDropdown(item)}
      </div>
    )
  }

  // ── Logo ───────────────────────────────────────────────────────────────────
  const renderLogo = () => {
    if (!s.logoText && !s.logoImage) return null
    if (s.logoPosition === 'none') return null

    const logoStyle = {
      color: s.logoColor || '#ffffff',
      fontSize: s.logoFontSize || 22,
      fontWeight: s.logoFontWeight || '700',
      fontFamily: s.fontFamily || 'sans-serif',
      padding: isVertical
        ? `${(s.itemPaddingV || 12) + 6}px ${s.itemPaddingH || 20}px ${s.itemPaddingV || 12}px`
        : `0 ${s.itemPaddingH || 20}px`,
      whiteSpace: 'nowrap',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      letterSpacing: '0.02em',
    }

    const logoH = s.logoFontSize ? s.logoFontSize * 1.5 : 32
    const mediaStyle = /** @type {import('react').CSSProperties} */ ({ height: logoH, width: 'auto', display: 'block', objectFit: 'contain' })

    let content
    if (s.logoImage) {
      if (isVideoDataUrl(s.logoImage)) {
        if (s.logoChromaColor || s.logoMaskShape) {
          // Real-time WebGL: chroma key + optional shape mask
          content = (
            <VideoChromaCanvas
              src={s.logoImage}
              chromaColor={s.logoChromaColor || null}
              tolerance={s.logoChromaTolerance ?? 30}
              softness={s.logoChromaSoftness ?? 8}
              maskShape={s.logoMaskShape || null}
              style={{ ...mediaStyle, height: logoH }}
            />
          )
        } else {
          content = <AutoPlayVideo src={s.logoImage} style={mediaStyle} />
        }
      } else {
        // Static image / GIF / APNG / WebP
        content = <img src={s.logoImage} alt={s.logoText || 'logo'} style={mediaStyle} />
      }
    } else {
      content = s.logoText
    }

    return <div style={logoStyle}>{content}</div>
  }

  // ── Editor overlay label ───────────────────────────────────────────────────
  const editorOverlay = isEditor ? (
    <div
      style={{
        position: 'absolute',
        top: 4,
        right: 8,
        fontSize: 10,
        color: 'rgba(255,255,255,0.45)',
        pointerEvents: 'none',
        letterSpacing: '0.06em',
        fontFamily: 'monospace',
        userSelect: 'none',
      }}
    >
      ☰ MENU BAR
    </div>
  ) : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={containerStyle} data-menubar="bar">
      {renderLogo()}
      <div style={itemsWrapStyle}>
        {items.map(renderItem)}
      </div>
      {editorOverlay}
    </div>
  )
}