// @ts-check
// Extracted from App.jsx — stage/element layout and factory utilities
import { SW, SH, STAGE_PRESETS } from '../constants/index.js'

export function uid() {
  return `_${Math.random().toString(36).slice(2, 8)}`
}

export function normalizeZ(elements) {
  return [...elements]
    .sort((a, b) => a.z - b.z)
    .map((el, i) => ({ ...el, z: i }))
}

export function reindexZByCurrentOrder(elements) {
  return elements.map((el, i) => ({ ...el, z: i }))
}

export function drawGridCanvas(ctx, stageWidth, stageHeight) {
  ctx.save()
  // 'difference' blending inverts grid lines against any background colour:
  // white lines on dark bg stay light; white lines on light/white bg turn dark.
  ctx.globalCompositeOperation = 'difference'
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  const g = 40
  for (let x = 0; x <= stageWidth; x += g) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, stageHeight)
    ctx.stroke()
  }
  for (let y = 0; y <= stageHeight; y += g) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(stageWidth, y)
    ctx.stroke()
  }
  ctx.restore()
}

export function moveOrResizeElementHelper(
  el,
  mode,
  handle,
  origX,
  origY,
  origW,
  origH,
  dx,
  dy,
  stageWidth,
  stageHeight,
) {
  if (mode !== 'resize') {
    // Allow elements to be dragged partially or fully off-canvas (fly-in / fly-out positions).
    // Clamp to 3× stage size in each direction so handles don't disappear into infinity.
    const limit = Math.max(stageWidth, stageHeight) * 3
    return {
      ...el,
      x: Math.max(-limit, Math.min(stageWidth + limit, origX + dx)),
      y: Math.max(-limit, Math.min(stageHeight + limit, origY + dy)),
    }
  }

  const min = 4
  let x = origX
  let y = origY
  let w = origW
  let h = origH

  if (handle === 'br') {
    w = Math.max(min, origW + dx)
    h = Math.max(min, origH + dy)
  }
  if (handle === 'bl') {
    const nw = Math.max(min, origW - dx)
    x = origX + (origW - nw)
    w = nw
    h = Math.max(min, origH + dy)
  }
  if (handle === 'tr') {
    w = Math.max(min, origW + dx)
    const nh = Math.max(min, origH - dy)
    y = origY + (origH - nh)
    h = nh
  }
  if (handle === 'tl') {
    const nw = Math.max(min, origW - dx)
    const nh = Math.max(min, origH - dy)
    x = origX + (origW - nw)
    y = origY + (origH - nh)
    w = nw
    h = nh
  }
  if (handle === 'mr') w = Math.max(min, origW + dx)
  if (handle === 'ml') {
    const nw = Math.max(min, origW - dx)
    x = origX + (origW - nw)
    w = nw
  }
  if (handle === 'bc') h = Math.max(min, origH + dy)
  if (handle === 'tc') {
    const nh = Math.max(min, origH - dy)
    y = origY + (origH - nh)
    h = nh
  }

  // Allow resize beyond canvas — do not clamp w/h to stage dimensions
  return { ...el, x, y, w, h }
}

export function clampElementToStage(el) {
  // Allow elements to exceed the stage boundary (user can resize/position media beyond canvas)
  const w = Math.max(4, Number(el.w) || 4)
  const h = Math.max(4, Number(el.h) || 4)
  const x = Number(el.x) || 0
  const y = Number(el.y) || 0
  return { ...el, x, y, w, h }
}

export function clampPageToStage(page) {
  // Callers may pass (page, stageWidth, stageHeight); extra args are silently accepted.
  // Elements are intentionally allowed to exceed stage bounds — no clamping applied.
  return {
    ...page,
    elements: normalizeZ((page.elements || []).map((el) => clampElementToStage(el))),
  }
}

export function getPresetKey(width, height) {
  const match = STAGE_PRESETS.find((preset) => preset.width === width && preset.height === height)
  return match ? match.key : STAGE_PRESETS[0].key
}

/**
 * Compute CSS filter/boxShadow for media shadow.
 * Returns an object suitable for spreading into an inline style.
 * @param {object} el
 */
export function getMediaShadowStyle(el) {
  if (!el.mediaShadow) return {}
  const x = el.mediaShadowX ?? 4
  const y = el.mediaShadowY ?? 6
  const blur = el.mediaShadowBlur ?? 12
  const color = el.mediaShadowColor || 'rgba(0,0,0,0.6)'
  if (el.mediaShadowInner) {
    const spread = el.mediaShadowSpread ?? 0
    return { boxShadow: `inset ${x}px ${y}px ${blur}px ${spread}px ${color}` }
  }
  return { filter: `drop-shadow(${x}px ${y}px ${blur}px ${color})` }
}

/** @returns {import('../types/desktop-api').SmmElement} */
export function makeElem(type, x, y, w, h) {
  const base = {
    id: uid(),
    type,
    x: Number(x),
    y: Number(y),
    w: Number(w),
    h: Number(h),
    z: 0,
    visible: true,
    wipe: '',
    wipeSpeed: 5,
    wipeDir: 0,
    // Behavior / playback controls
    loop: false,
    playCount: 1,
    onPlayMode: 'auto',
    afterPlay: 'none',
    afterPlayTarget: '',
    afterPlayTargetType: 'page',
    audioEvent: '',
    audioEventName: '',
    elLabel: '',
    groupId: '',
    locked: false,
    afterElementLabel: '',       // for onPlayMode='after-element': label of element to wait for
    onPlayDelay: 0,              // ms delay for onPlayMode='delay'
    playConditionAfterEl: '',    // for playCondition='after-element'
    playConditionSeqOrder: 1,    // for playCondition='sequence'
    // ── Animation / Fly-in-out ──────────────────────────
    animIn: 'none',          // key from ANIM_IN_TYPES
    animInDuration: 600,     // ms
    animInDelay: 0,          // ms delay before fly-in starts
    animInEasing: 'ease-out',// CSS easing
    animOut: 'none',         // key from ANIM_OUT_TYPES
    animOutDuration: 600,    // ms
    animOutTrigger: 'never', // 'auto'|'click'|'key'|'never'
    animOutDelay: 0,         // ms dwell after fly-in completes before auto fly-out starts
    animLoop: 'none',        // key from ANIM_LOOP_TYPES — continuous idle animation while visible
    animLoopSpeed: 1,        // speed multiplier: 0.4=very slow, 1=normal, 2.5=very fast
    animInRepeat: 1,         // how many times the enter animation plays (1=once, 0=infinite)
    // ── Media Timeline ────────────────────────────────────
    mediaStartTime: 0,          // seconds to start playback from
    mediaPauseTime: null,       // null = no pause; number = pause at this time (seconds)
    mediaPauseAction: 'none',   // what to do at pause: 'none'|'next'|'prev'|'goto-page'|'goto-element'|'hyperlink'|'script'|'loop'|'stop'
    mediaPauseTarget: '',       // page name / URL / element ID depending on action
    mediaPauseScript: '',       // script content if action === 'script'
    mediaEndTime: null,         // null = play to natural end; number = stop at this time
    mediaInTransition: 'none',  // 'none'|'fade'|'cut'|<wipe-name>
    mediaInDuration: 500,       // ms for in-transition
    mediaOutTransition: 'none', // 'none'|'fade'|'cut'|<wipe-name>
    mediaOutDuration: 500,      // ms for out-transition
    mediaTimeMode: 'seconds',   // 'seconds'|'frames' — how times are expressed
    mediaFPS: 25,               // frames per second (for frame-mode display)
    // ── Universal Interaction (button behavior for any element) ──
    interactive: false,          // enables button behavior on this element
    waitOnClick: false,          // page auto-advance paused until element clicked
    // ── Wait-to-Play trigger ──────────────────────────────────────
    waitToPlay: 'none',          // 'none'|'click'|'key' — hold playback until trigger
    waitToPlayKey: '',           // key combo string e.g. 'Enter', 'Space', 'Ctrl+Enter'
    // ── Show / Hide triggers ──────────────────────────────────────
    showOnTrigger: 'none',       // 'none'|'click'|'key' — make element visible on trigger
    showOnTriggerKey: '',        // key combo for showOnTrigger
    hideOnTrigger: 'none',       // 'none'|'click'|'key' — hide element on trigger
    hideOnTriggerKey: '',        // key combo for hideOnTrigger
    hoverScale: 1.0,             // scale multiplier on hover (1.0 = no change)
    hoverOpacity: 100,           // opacity % on hover
    hoverColorOverlay: '',       // CSS color tint on hover e.g. 'rgba(255,255,255,0.2)'
    hoverOverlayOn: false,
    hoverSoundFile: '',          // audio file to play on hover
    hoverSoundName: '',
    hoverMediaPlay: false,       // start playing media element on hover
    hoverMediaFile: '',          // animated media (GIF/WebP/video/MP4) to show on hover
    hoverMediaName: '',
    hoverMediaLoop: true,        // loop hover media
    hoverMediaPlayCount: 0,      // 0 = infinite, N = play N times then stop
    hoverFullscreen: false,      // open hover media in fullscreen lightbox
    clickMediaFile: '',          // animated media to show on click
    clickMediaName: '',
    clickMediaLoop: false,
    clickMediaPlayCount: 1,      // default: play once on click
    clickFullscreen: false,      // open click media (or element media) in fullscreen lightbox
    clickScale: 0.96,            // scale on click/press
    clickSoundFile: '',          // audio file on click
    clickSoundName: '',
    // Action chain — ordered array of action step objects
    actionChain: [],
    // Simple condition gate (evaluated before action chain)
    ifCondVar: '',               // project variable name to test
    ifCondOp: '==',              // '=='|'!='|'>'|'<'|'>='|'<='|'contains'
    ifCondVal: '',               // value to compare to
    ifCondElse: [],              // action chain to run if condition is FALSE
    // Frame / Border overlay
    frameBorder: {
      enabled: false,
      style: 'solid',            // 'solid'|'gradient'|'bevel'|'texture'|'template'
      width: { top: 16, right: 16, bottom: 16, left: 16 },
      radius: { tl: 0, tr: 0, br: 0, bl: 0 },
      color: { top: '#c8a020', right: '#a07010', bottom: '#705010', left: '#e8c040' },
      bevel: { style: 'out', depth: 6 },
      texture: null,
      templateId: null,
    },
  }

  if (type === 'text') {
    return {
      ...base,
      content: 'Text',
      font: 'Rajdhani',
      size: 36,
      weight: '700',
      color: '#e8a020',
      align: 'center',
      vAlign: 'middle',
      shadow: false,
      outline: false,
      italic: false,
      underline: false,
      bgColor: '#000000',
      bgOn: false,
      textScrollable: false,  // user can scroll overflow text within the box
    }
  }

  if (type === 'clip') {
    return {
      ...base,
      file: '',
      fit: 'contain',
      opacity: 100,
      transparent: false,
      resizeW: 0,
      resizeH: 0,
      // Drop shadow
      mediaShadow: false,
      mediaShadowX: 4,
      mediaShadowY: 6,
      mediaShadowBlur: 12,
      mediaShadowColor: 'rgba(0,0,0,0.6)',
      mediaShadowSpread: 0,  // used for box-shadow only (inner glow mode)
      mediaShadowInner: false, // box-shadow inset glow instead of drop-shadow
    }
  }

  if (type === 'button') {
    return {
      ...base,
      w: w || 160,
      h: h || 44,
      label: 'Button',
      btnShape: 'rect',
      btnImage: '',
      bgColor: '#1a3a5c',
      fgColor: '#e8a020',
      borderColor: '#4a8fc0',
      borderWidth: 2,
      radius: '0px',
      bevel: false,
      fontSize: 14,
      font: 'Rajdhani',
      fontWeight: '600',
      textShadow: false,
      action: 'next',
      linkType: 'page',
      linkTarget: '',
      target: '',
      urlTarget: '',
      mediaFile: '',
      mediaFileName: '',
      scriptContent: '',
      gotoType: 'page',
      gotoPageName: '',
      gotoObjectId: '',
      gotoObjectLabel: '',
      matchSize: true,
      btnShadow: false,
      btnGrad: '',
      btnClipPng: '',
      textAnchorX: '50%',
      textAnchorY: '50%',
      hoverBg: '',
      hoverFg: '',
      hoverGrad: '',
      hoverBtnImage: '',
      pressedBg: '',
      pressedFg: '',
      pressedGrad: '',
      pressedBtnImage: '',
    }
  }

  if (type === 'mpeg') {
    return {
      ...base,
      file: '',
      device: 'avivideo',
      wait: false,
      maximize: false,
      // Drop shadow
      mediaShadow: false,
      mediaShadowX: 4,
      mediaShadowY: 6,
      mediaShadowBlur: 12,
      mediaShadowColor: 'rgba(0,0,0,0.6)',
      mediaShadowInner: false,
    }
  }

  if (type === 'hotspot') {
    return {
      ...base,
      w: w || 160,
      h: h || 120,
      hotspotShape: 'rect',  // 'rect'|'oval'|'circle'|'star'|'hexagon'|'pentagon'|'octagon'|'freehand'
      points: [],            // [{x,y}] normalized 0-1 for freehand polygon
      borderOn: true,
      borderColor: '#3cb8be',
      borderWidth: 2,
      borderStyle: 'dashed', // 'solid'|'dashed'|'dotted'|'none'
      fillOpacity: 0,        // 0 = fully transparent, 0-1
      fillColor: '#ffffff',  // fill tint color (combined with fillOpacity)
      hoverEffect: 'tint',   // 'none'|'tint'|'glow'|'invert'
      hoverColor: 'rgba(255,255,255,0.18)',
      pressedEffect: 'darken', // 'none'|'darken'|'tint'
      pressedColor: 'rgba(0,0,0,0.25)',
      tooltip: '',
      label: '',
      // Action
      action: 'none',        // 'none'|'next'|'prev'|'goto-page'|'goto-element'|'hyperlink'|'script'
      linkTarget: '',        // URL for hyperlink
      gotoPageName: '',      // target page name
      gotoObjectId: '',      // target element id
      gotoObjectLabel: '',   // target element label
      scriptContent: '',     // inline script
    }
  }

  if (type === 'menubar') {
    return {
      ...base,
      x: 0, y: 0,
      w: w || 1920,
      h: h || 60,
      position: 'top',
      style: {
        bgColor: '#1a1a2e',
        bgGradientEnabled: false,
        bgGradientFrom: '#1a1a2e',
        bgGradientTo: '#16213e',
        bgGradientAngle: 0,
        itemColor: '#ffffff',
        itemHoverBg: '#e94560',
        itemHoverColor: '#ffffff',
        itemActiveBg: '#e94560',
        itemActiveColor: '#ffffff',
        dropdownBg: '#16213e',
        dropdownBgGradientEnabled: false,
        dropdownBgGradientFrom: '#16213e',
        dropdownBgGradientTo: '#0f0f23',
        dropdownColor: '#ffffff',
        dropdownGroupColor: '#e94560',
        dropdownItemHoverBg: 'rgba(233,69,96,0.2)',
        dropdownItemHoverColor: '#ffffff',
        dropdownBorderColor: '#e94560',
        dropdownBorderWidth: 1,
        dropdownShadow: '0 8px 32px rgba(0,0,0,0.5)',
        dropdownAnimation: 'slide',
        barHeight: 60,
        barWidth: 220,
        itemPaddingH: 20,
        itemPaddingV: 14,
        itemGap: 2,
        fontSize: 14,
        fontFamily: 'Rajdhani',
        fontWeight: '600',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        logoText: 'FluxAura',
        logoColor: '#e94560',
        logoFontSize: 20,
        logoFontWeight: '700',
        logoImage: '',
        logoPosition: 'left',
        borderBottom: '2px solid #e94560',
        borderTop: '',
        borderLeft: '',
        borderRight: '',
        itemUnderlineOnHover: false,
        itemUnderlineColor: '#e94560',
        dropdownGroupFontSize: 11,
        dropdownGroupFontWeight: '700',
        dropdownGroupLetterSpacing: '0.1em',
        dropdownItemFontSize: 13,
        dropdownItemFontWeight: '400',
        dropdownPadding: 20,
        dropdownColumnGap: 24,
        dropdownMinWidth: 180,
        separatorColor: 'rgba(233,69,96,0.3)',
        separatorEnabled: true,
        zIndex: 1000,
      },
      items: [
        { id: '_mi1', label: 'Home',    action: 'goto', target: '', icon: '', children: [] },
        { id: '_mi2', label: 'About',   action: 'goto', target: '', icon: '', children: [
          { id: '_mg1', groupLabel: 'About Us', items: [
            { id: '_msi1', label: 'Team',    action: 'goto', target: '', icon: '' },
            { id: '_msi2', label: 'Mission', action: 'goto', target: '', icon: '' },
          ]}
        ]},
        { id: '_mi3', label: 'Gallery', action: 'goto', target: '', icon: '', children: [] },
        { id: '_mi4', label: 'Contact', action: 'goto', target: '', icon: '', children: [] },
      ],
    }
  }

  return base
}

/** @returns {import('../types/desktop-api').SmmPage} */
export function makePage(name, pagesLen = 0) {
  return {
    id: uid(),
    name: name || `Page ${pagesLen + 1}`,
    bgColor: '#0a1a2a',
    bgGradientEnabled: false,
    bgGradientFrom: '#0a1a2a',
    bgGradientTo: '#1a3a5c',
    bgGradientAngle: 135,
    bgImage: '',
    bgMediaSrc: '',
    bgMediaName: '',
    bgMediaKind: '',
    bgMediaTransition: 'fade',
    bgMediaSourcePath: '',
    wipeIn: 'Fade',
    wipeOut: 'Fade',
    timing: { mode: 'pause', duration: 5, ms: 0, onEnd: 'continue', onEndTarget: '', ifMode: 'always', ifCount: 1, ifVar: '', ifOp: '==', ifVal: '', elseDo: 'none', elseTarget: '' },
    sound: { file: '', rate: 22050, loops: false, spool: true },
    narration: { file: '', name: '', autoPlay: true },
    input: { mouse: true, keyboard: false, mouseControls: true, pso: false },
    elements: /** @type {import('../types/desktop-api').SmmElement[]} */([]),
    pageScript: { enabled: false, mode: 'inline', code: '', file: '', fileName: '', sharedVars: [], waitForScript: false },
    dataSource: { enabled: false, file: '', fileName: '', type: 'json', rootPath: '', mappings: [] },
    pageType: /** @type {'standard'|'url'} */('standard'),
    iframeUrl: '',
    persistAudio: false,
  }
}

export function pageBgCss(page) {
  if (!page) return '#000'
  if (page.bgGradientEnabled) {
    const angle = page.bgGradientAngle ?? 135
    const from = page.bgGradientFrom || '#0a1a2a'
    const to = page.bgGradientTo || '#1a3a5c'
    return `linear-gradient(${angle}deg, ${from}, ${to})`
  }
  return page.bgColor || '#000'
}

export function bgMediaTransitionClass(page) {
  if (!page?.bgMediaSrc) return ''
  const t = page.bgMediaTransition || 'fade'
  if (t === 'none') return ''
  return `bg-media-${t}`
}

export function esc(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

// SW and SH re-exported for convenience (used by consumers that only import stageUtils)
export { SW, SH }
