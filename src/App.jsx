// @ts-check
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import VariableEditor, { executeScript, VarInspector, ElementScriptPanel } from './VariableEditor'
import ShapeButton, { ShapeButtonInspector } from './ShapeButton'
import { SW, SH, STAGE_PRESETS, SQUARE_BOOK_DPI_OPTIONS, WIPES, BTN_SHAPES, ANIM_IN_TYPES, ANIM_OUT_TYPES, ANIM_LOOP_TYPES, RETRO_BTN_PRESETS, BTN_ACTIONS, FONT_LIST, PROJECT_TEMPLATES, WIPE_META, WIPE_CATEGORIES, FLYIN_META } from './constants/index.js'
import { _clickAudioMap, _midiSynthRegistry, playAudio, stopAllAudio } from './utils/audioUtils.js'
import { detectMediaKind, isMidiMedia, readBrowserFileAsDataUrl, getMediaExtension, isUnresolvedMediaPath, isTempUrl, inferMediaCapability } from './utils/mediaUtils.js'
import { uid, reindexZByCurrentOrder, drawGridCanvas, moveOrResizeElementHelper, clampPageToStage, getPresetKey, makeElem, makePage, pageBgCss, bgMediaTransitionClass, esc, getMediaShadowStyle } from './utils/stageUtils.js'
import { internDataUrl } from './utils/mediaRegistry.js'
import ChromaKeyModal from './modals/ChromaKeyModal.jsx'
import { parseMME, genMME } from './utils/scaUtils.js'
import WipeThumbnail from './components/WipeThumbnail'
import FlyInThumbnail from './components/FlyInThumbnail'
import ShortcutsPanel from './components/ShortcutsPanel'
import PageThumb from './components/PageThumb'
import MidiClipPlayer from './components/MidiClipPlayer'
import AudioClipPlayer from './components/AudioClipPlayer'
import NewProjectDialog from './components/NewProjectDialog'
import PngButtonEditor from './components/PngButtonEditor.tsx'
import SmartColorPicker from './components/SmartColorPicker.tsx'
import MediaResolveDialog from './components/MediaResolveDialog.tsx'
import ButtonEditorModal from './modals/ButtonEditorModal.tsx'
import MemoryGameEditorModal, { DEFAULT_MEM_GAME_CONFIG } from './modals/MemoryGameEditorModal.tsx'
import InteractionEditor from './modals/InteractionEditor.tsx'
import ScriptFlowEditor from './modals/ScriptFlowEditor.jsx'
import FrameBorderEditor, { DEFAULT_FRAME, getFrameCSS } from './modals/FrameBorderEditor.jsx'
import PublishDialog from './modals/PublishDialog.jsx'
import ImportPagesDialog from './modals/ImportPagesDialog.jsx'
import { importProjectPages, resolveMediaForExport } from './utils/publishUtils.js'
import MenuBarElement from './components/MenuBarElement.jsx'
import MenuBarEditorModal from './modals/MenuBarEditorModal.jsx'
import VideoChromaCanvas from './components/VideoChromaCanvas.jsx'
import FontPicker from './components/FontPicker.jsx'
import PiperTTSPanel from './components/PiperTTSPanel.jsx'
import WhisperPanel from './components/WhisperPanel.jsx'
import HFTokenSettings from './components/HFTokenSettings.jsx'
import LyricVideoWizard from './modals/LyricVideoWizard.jsx'
import ScriptExportModal from './modals/ScriptExportModal.jsx'
import KaraokeText from './components/KaraokeText.jsx'
import LyricTimingEditor from './modals/LyricTimingEditor.jsx'
import PresentationTimeline from './components/PresentationTimeline.jsx'
import {
  MousePointer2, Type, Image as ImageIcon, Square, ArrowLeftRight, ArrowUpDown,
  Video, Target, Menu, Undo2, Redo2, Copy, Clipboard, FilePlus, CopyPlus,
  Import, FileText, Upload, Music, BookOpen, Play, SkipBack, SkipForward,
  StopCircle, Repeat, Hand, Maximize, Expand, FolderOpen, Settings, Keyboard,
  Search, Layers, Zap, Wand2, AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Group, Ungroup, PanelLeft, PanelRight, Film, LayoutGrid, Plus, Minus,
  ArrowUp, ArrowDown, RefreshCw, Stethoscope, GitBranch, Code2,
  SlidersHorizontal, Pencil, X, Camera,
} from 'lucide-react'

/** @returns {import('./types/desktop-api').SmmPage[]} */
function seedPages() {
  const p1 = {
    ...makePage('Report firstpage'),
    bgColor: '#f5f0e8',
    timing: { mode: 'wait', duration: 5, ms: 0 },
    elements: [
      {
        ...makeElem('text', 184, 169, 280, 60),
        content: 'Sales Report',
        font: 'Rajdhani',
        size: 56,
        weight: '700',
        color: '#333333',
        shadow: true,
        z: 0,
      },
      {
        ...makeElem('text', 184, 233, 280, 30),
        content: 'month of january 2026',
        font: 'IBM Plex Mono',
        size: 16,
        weight: '400',
        color: '#666666',
        z: 1,
      },
    ],
  }

  const p2 = {
    ...makePage('Overview'),
    bgColor: '#1a2a4a',
    wipeIn: 'Wipe',
    timing: { mode: 'wait', duration: 0, ms: 300 },
    elements: [
      {
        ...makeElem('text', 21, 41, 400, 40),
        content: 'Overview',
        size: 35,
        color: '#e8d0a0',
        align: 'left',
        shadow: true,
        wipe: 'Wipe',
        z: 0,
      },
      {
        ...makeElem('button', 161, 110, 320, 40),
        label: 'Car loans',
        bgColor: '#0a1a30',
        fgColor: '#e8d0a0',
        borderColor: '#4a6a90',
        borderWidth: 1,
        fontSize: 35,
        action: 'goto',
        target: 'Car Loan',
        bevel: true,
        wipe: 'Wipe',
        z: 1,
      },
      {
        ...makeElem('button', 161, 169, 320, 40),
        label: 'House Bonds',
        bgColor: '#0a1a30',
        fgColor: '#e8d0a0',
        borderColor: '#4a6a90',
        borderWidth: 1,
        fontSize: 35,
        action: 'goto',
        target: 'House Bonds',
        bevel: true,
        wipe: 'Wipe',
        z: 2,
      },
      {
        ...makeElem('button', 161, 229, 320, 40),
        label: 'Bank Loan',
        bgColor: '#0a1a30',
        fgColor: '#e8d0a0',
        borderColor: '#4a6a90',
        borderWidth: 1,
        fontSize: 35,
        action: 'goto',
        target: 'Bank Loan',
        bevel: true,
        wipe: 'Wipe',
        z: 3,
      },
    ],
  }

  const p3 = {
    ...makePage('Marketing Structure'),
    bgColor: '#2a1a0a',
    wipeIn: 'Premiere',
    timing: { mode: 'pause', duration: 10, ms: 0 },
    input: { mouse: false, keyboard: false, mouseControls: false, pso: false },
    elements: [
      {
        ...makeElem('text', 71, 42, 465, 70),
        content: 'Marketing Structure',
        size: 60,
        color: '#f0e8d0',
        shadow: true,
        wipe: 'Premiere',
        wipeSpeed: 4,
        wipeDir: 270,
        z: 0,
      },
      {
        ...makeElem('text', 71, 146, 465, 100),
        content: 'Sample Title',
        size: 80,
        color: '#e8a020',
        shadow: true,
        outline: true,
        wipe: 'Center',
        z: 1,
      },
      {
        ...makeElem('text', 71, 411, 465, 55),
        content: 'March 2026',
        size: 48,
        color: '#f0e8d0',
        shadow: true,
        wipe: 'Damped',
        wipeDir: 90,
        z: 2,
      },
    ],
  }

  return [p1, p2, p3]
}

function formatBytes(bytes) {
  const value = Number(bytes || 0)
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const idx = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / (1024 ** idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

function generateMemoryGameVars() {
  const mkv = (name, type, defaultValue, size) => ({
    id: `_${Math.random().toString(36).slice(2, 8)}`,
    name, type, defaultValue: defaultValue ?? (type === 'number' ? 0 : ''), description: '', size,
  })
  return [
    mkv('mg_flips',    'number',  0),
    mkv('mg_matches',  'number',  0),
    mkv('mg_first',    'number', -1),
    mkv('mg_firstSym', 'text',   ''),
    mkv('mg_lock',     'number',  0),
    mkv('mg_best',     'number', 99),
    mkv('mg_sym',      'array',  '', 16),
    mkv('mg_state',    'array',  '', 16),
  ]
}

/** @param {typeof DEFAULT_MEM_GAME_CONFIG} [config]
 * @returns {import('./types/desktop-api').SmmPage[]} */
function generateMemoryGamePages(config) {
  const cfg = {
    ...DEFAULT_MEM_GAME_CONFIG,
    ...(config || {}),
    pairs: (config?.pairs?.length === 8 ? config.pairs : DEFAULT_MEM_GAME_CONFIG.pairs).map(p => ({ ...p })),
  }

  const uid6 = () => `_${Math.random().toString(36).slice(2, 8)}`

  // 16 positions — pair index: pos 0-7 => pair 0-7, pos 8-15 => pair 7-0
  const PAIR_MAP = [0,1,2,3,4,5,6,7, 7,6,5,4,3,2,1,0]
  const CARD_W = 140, CARD_H = 88, COLS = 4
  const GRID_X = 12, GRID_Y = 48, GAP = 4
  const BG     = cfg.bgColor
  const ACCENT = cfg.accentColor
  const BORDER = cfg.borderColor

  const txt = (content, x, y, w, h, size, color, elLabel = '') => ({
    ...makeElem('text', x, y, w, h),
    id: uid6(), content, size, color,
    font: 'Rajdhani', weight: '700', align: 'center', vAlign: 'middle',
    shadow: true, elLabel,
  })

  const navBtn = (label, x, y, w, h, action, target = '', elLabel = '') => ({
    ...makeElem('button', x, y, w, h),
    id: uid6(), label, action, target, elLabel,
    bgColor: '#0d2240', fgColor: ACCENT,
    borderColor: BORDER, borderWidth: 2,
    radius: '4px', bevel: true,
    fontSize: 14, font: 'Rajdhani', fontWeight: '700',
  })

  // Build 16 card-back + 16 card-face button elements
  const cardElements = /** @type {import('./types/desktop-api').SmmElement[]} */ ([])
  for (let i = 0; i < 16; i++) {
    const row = Math.floor(i / COLS)
    const col = i % COLS
    const cx = GRID_X + col * (CARD_W + GAP)
    const cy = GRID_Y + row * (CARD_H + GAP)
    const pairIdx = PAIR_MAP[i]
    const pair = cfg.pairs[pairIdx]

    // Face-down back — player clicks this to flip
    cardElements.push({
      ...makeElem('button', cx, cy, CARD_W, CARD_H),
      id: uid6(), label: cfg.backImage ? '' : cfg.backLabel,
      elLabel: `mg-back-${i}`,
      bgColor: cfg.backColor, fgColor: '#6090c0',
      borderColor: cfg.backBorderColor, borderWidth: 2,
      radius: '6px', bevel: true,
      fontSize: 28, font: 'Rajdhani', fontWeight: '700',
      ...(cfg.backImage ? { btnImage: cfg.backImage } : {}),
      action: 'script', visible: true,
      z: 10 + i,
    })

    // Face-up reveal — shown when card is flipped
    cardElements.push({
      ...makeElem('button', cx, cy, CARD_W, CARD_H),
      id: uid6(), label: pair.image ? '' : pair.symbol,
      elLabel: `mg-face-${i}`,
      bgColor: pair.color, fgColor: '#ffffff',
      borderColor: '#60a0d0', borderWidth: 2,
      radius: '6px', bevel: false,
      fontSize: 40, font: 'Rajdhani', fontWeight: '700',
      ...(pair.image ? { btnImage: pair.image } : {}),
      action: 'script', visible: false,
      z: 26 + i,
    })
  }

  const CARD_SYMS = PAIR_MAP.map(idx => cfg.pairs[idx].symbol)

  // onStartScript: reset counters, populate sym/state arrays
  const initScript = [
    { id: uid6(), type: 'set-var', varName: 'mg_flips',    value: '0' },
    { id: uid6(), type: 'set-var', varName: 'mg_matches',  value: '0' },
    { id: uid6(), type: 'set-var', varName: 'mg_first',    value: '-1' },
    { id: uid6(), type: 'set-var', varName: 'mg_firstSym', value: '' },
    { id: uid6(), type: 'set-var', varName: 'mg_lock',     value: '0' },
    ...CARD_SYMS.map((sym, i) => ({
      id: uid6(), type: 'set-array-item', arrRef: `mg_sym[${i}]`, value: sym,
    })),
    ...Array.from({ length: 16 }, (_, i) => ({
      id: uid6(), type: 'set-array-item', arrRef: `mg_state[${i}]`, value: '0',
    })),
  ]

  /* -- Page 1: Title/Intro -- */
  const titlePage = {
    ...makePage(cfg.title),
    templateId: 'memory-game',
    mgConfig: cfg,
    bgColor: BG,
    timing: { mode: 'pause', duration: 0, ms: 0 },
    elements: /** @type {import('./types/desktop-api').SmmElement[]} */ ([
      txt('🧠 ' + cfg.title,                              60, 110, 520, 90, 52, ACCENT),
      txt('Match all 8 pairs using the fewest flips.',         60, 215, 520, 40, 18, '#c0d8f0'),
      txt('Click a card to reveal it — find its pair!',60, 260, 520, 36, 15, '#6090a0'),
      navBtn('▶  New Game', 220, 340, 200, 52, 'goto', 'Play', 'btn-newgame'),
      navBtn('✕  Quit',     220, 404, 200, 40, 'quit', '',     'btn-quit'),
    ]),
  }

  /* -- Page 2: Play -- */
  const gamePage = {
    ...makePage('Play'),
    templateId: 'memory-game',
    bgColor: BG,
    timing: { mode: 'pause', duration: 0, ms: 0 },
    onStartScript: initScript,
    elements: /** @type {import('./types/desktop-api').SmmElement[]} */ ([
      txt('🧠 Memory',   4,  4, 180, 40,  14, ACCENT),
      txt('Flips:',         192,  4,  56, 18,  11, '#6090b0'),
      txt('0',              250,  4,  50, 18,  16, '#ffff80', 'mg-txt-flips'),
      txt('Pairs:',         308,  4,  56, 18,  11, '#6090b0'),
      txt('0 / 8',          366,  4,  72, 18,  15, '#80ff80', 'mg-txt-pairs'),
      txt('Best:',          446,  4,  50, 18,  11, '#6090b0'),
      txt('--',             498,  4,  60, 18,  13, '#f0a040', 'mg-txt-best'),
      ...cardElements,
      navBtn('New Game',  10, 450, 130, 26, 'script', '', 'btn-newgame'),
      navBtn('Quit',     500, 450, 130, 26, 'quit',   '', 'btn-quit'),
    ]),
  }

  /* -- Page 3: Win -- */
  const winPage = {
    ...makePage('Win!'),
    templateId: 'memory-game',
    bgColor: BG,
    timing: { mode: 'pause', duration: 0, ms: 0 },
    elements: /** @type {import('./types/desktop-api').SmmElement[]} */ ([
      txt('🎉 You Won!',           60, 110, 520, 90,  60, '#ffd700'),
      txt('All 8 pairs matched!',        60, 215, 520, 40,  22, '#c0f0c0'),
      txt('Check your flip count above.',60, 262, 520, 36,  16, '#6090a0'),
      navBtn('▶  Play Again', 190, 340, 260, 52, 'goto', cfg.title, 'btn-again'),
      navBtn('✕  Quit',       190, 404, 260, 40, 'quit', '',         'btn-quit'),
    ]),
  }

  return [titlePage, gamePage, winPage]
}

/** @returns {import('./types/desktop-api').SmmPage[]} */
function generateTemplatePages(tpl) {
  const acc = '#e8a020', light = '#d0e8ff', dark = '#0a1a2a', mid = '#1a3a5c'
  const navBtn = (label, x, y, action, target = '') => ({
    ...makeElem('button', x, y, 200, 50),
    label, action, target,
    bgColor: mid, fgColor: acc, borderColor: '#4a8fc0', borderWidth: 2,
    radius: '4px', bevel: true, fontSize: 15, font: 'Rajdhani', fontWeight: '600',
  })
  const txt = (content, x, y, w, h, size = 32, color = acc, font = 'Rajdhani', weight = '700') => ({
    ...makeElem('text', x, y, w, h),
    content, font, size, weight, color, shadow: true,
  })
  const bodyTxt = (content, x, y, w, h) => txt(content, x, y, w, h, 16, light, 'IBM Plex Mono', '400')

  const id = tpl.id

  /* ── Blank ── */
  if (id === 'blank') {
    return [{ ...makePage('Page 1'), bgColor: dark }]
  }

  /* ── HD Signage Loop ── */
  if (id === 'signage-hd') {
    const pg = (name, bg, headline, sub) => ({
      ...makePage(name), bgColor: bg,
      timing: { mode: 'auto', duration: 8, ms: 0, onEnd: 'continue' },
      wipeIn: 'Fade', wipeOut: 'Fade',
      elements: [
        txt(headline, 80, 400, 1760, 120, 72, '#ffffff'),
        bodyTxt(sub, 80, 520, 1600, 40),
      ],
    })
    return [
      pg('Slide 1', '#0a1a2a', 'Your Headline Here', 'Supporting message or tagline goes here'),
      pg('Slide 2', '#1a0a2a', 'Second Message',      'Another line of supporting information'),
      pg('Slide 3', '#0a2a1a', 'Third Slide',         'Keep it short and impactful'),
    ]
  }

  /* ── Video Showcase ── */
  if (id === 'video-wall') {
    return [{
      ...makePage('Video Page'), bgColor: '#000000',
      timing: { mode: 'wait', duration: 0, ms: 0, onEnd: 'continue' },
      elements: [
        { ...makeElem('clip', 0, 0, 1920, 1080), mediaKind: 'video', file: '' },
        txt('Video Title', 60, 900, 1000, 80, 64, '#ffffff'),
        bodyTxt('Caption text here', 60, 980, 800, 40),
      ],
    }]
  }

  /* ── Info Touch Kiosk ── */
  if (id === 'info-kiosk') {
    const homeMenuBtn = (label, y, target) => ({
      ...makeElem('button', 312, y, 400, 60),
      label, action: 'goto', target,
      bgColor: mid, fgColor: acc, borderColor: '#4a8fc0', borderWidth: 2,
      radius: '6px', bevel: true, fontSize: 17, font: 'Rajdhani', fontWeight: '700',
    })
    const home = {
      ...makePage('Home'), bgColor: dark,
      elements: [
        txt('Welcome', 112, 60, 800, 80, 52, acc),
        bodyTxt('Touch a topic below to learn more', 212, 145, 600, 30),
        homeMenuBtn('› About Us',    230, 'About'),
        homeMenuBtn('› Our Services',310, 'Services'),
        homeMenuBtn('› Contact',     390, 'Contact'),
        homeMenuBtn('› Map & Hours', 470, 'Info'),
      ],
    }
    const contentPg = (name, headline) => ({
      ...makePage(name), bgColor: '#0f1f30',
      elements: [
        txt(headline, 60, 40, 900, 70, 42, acc),
        bodyTxt('Replace this with your content.', 60, 130, 900, 100),
        navBtn('‹ Home', 60, 660, 'goto', 'Home'),
      ],
    })
    return [home, contentPg('About', 'About Us'), contentPg('Services', 'Our Services'), contentPg('Contact', 'Contact'), contentPg('Info', 'Map & Hours')]
  }

  /* ── Product / Menu Catalogue ── */
  if (id === 'product-kiosk') {
    const menuBtn = (label, x, y, target) => ({
      ...makeElem('button', x, y, 210, 160),
      label, action: 'goto', target,
      bgColor: '#0d2240', fgColor: acc, borderColor: '#4a8fc0', borderWidth: 2,
      radius: '8px', bevel: true, fontSize: 14, font: 'Rajdhani', fontWeight: '700',
    })
    const home = {
      ...makePage('Menu'), bgColor: dark,
      elements: [
        txt('Our Products', 212, 40, 600, 70, 46, acc),
        menuBtn('Product A', 62,  160, 'Product A'),
        menuBtn('Product B', 292, 160, 'Product B'),
        menuBtn('Product C', 522, 160, 'Product C'),
        menuBtn('Product D', 752, 160, 'Product D'),
        menuBtn('Product E', 62,  340, 'Product E'),
        menuBtn('Product F', 292, 340, 'Product F'),
      ],
    }
    const detail = (name) => ({
      ...makePage(name), bgColor: '#0f1f30',
      elements: [
        txt(name, 60, 40, 500, 60, 38, acc),
        bodyTxt('Product description goes here.\nList key features, price, and details.', 60, 120, 600, 120),
        navBtn('‹ Menu', 60, 660, 'goto', 'Menu'),
      ],
    })
    return [home, detail('Product A'), detail('Product B'), detail('Product C')]
  }

  /* ── Children's Storybook (double-page spread, 1684×1190) ── */
  if (id === 'storybook') {
    const SW2 = 1684, SH2 = 1190
    const midX = SW2 / 2   // 842 — spine/gutter
    const funColors = ['#1a3a6c','#2a1a5c','#1a4a3a','#4a2a0a','#3a1a4a','#0a3a4a']

    // Navigation buttons (bottom of spread)
    const navBtnL = (label, target) => ({
      ...makeElem('button', 30, SH2 - 80, 160, 54),
      label, action: target === 'prev' ? 'prev' : 'goto', target,
      bgColor: 'rgba(0,0,0,0.45)', fgColor: '#fff',
      borderColor: 'rgba(255,255,255,0.3)', borderWidth: 2,
      radius: '27px', fontSize: 16, font: 'Baloo 2', fontWeight: '700',
    })
    const navBtnR = (label, target) => ({
      ...makeElem('button', SW2 - 190, SH2 - 80, 160, 54),
      label, action: target === 'next' ? 'next' : 'goto', target,
      bgColor: 'rgba(0,0,0,0.45)', fgColor: '#fff',
      borderColor: 'rgba(255,255,255,0.3)', borderWidth: 2,
      radius: '27px', fontSize: 16, font: 'Baloo 2', fontWeight: '700',
    })
    // Narration play button (top-right of text half)
    const narrationBtn = () => ({
      ...makeElem('button', midX + 20, 30, 52, 52),
      label: '🔊', action: 'event', target: '',
      bgColor: 'rgba(255,224,0,0.15)', fgColor: '#ffe000',
      borderColor: '#ffe000', borderWidth: 2,
      radius: '26px', fontSize: 22, font: 'Baloo 2', fontWeight: '700',
      elLabel: 'narration-btn',
    })
    // Tap-to-reveal hidden element (interactive overlay)
    const tapReveal = (x, y, w, h, label) => ({
      ...makeElem('button', x, y, w, h),
      label, action: 'set-var', target: '',
      bgColor: 'rgba(255,200,0,0.12)', fgColor: '#ffe080',
      borderColor: 'rgba(255,200,0,0.4)', borderWidth: 2,
      radius: '12px', fontSize: 14, font: 'Baloo 2', fontWeight: '700',
      elLabel: 'tap-reveal',
    })
    // Story text on right half
    const storyText = (content, y, h) => ({
      ...makeElem('text', midX + 30, y, midX - 60, h),
      content, font: 'Baloo 2', size: 26, weight: '400',
      color: '#fff2d0', align: 'left', vAlign: 'top',
    })
    // Illustration placeholder (left half)
    const illustBox = () => ({
      ...makeElem('clip', 30, 30, midX - 60, SH2 - 60),
      elLabel: 'illustration', mediaName: 'illustration',
    })

    // Cover page — full width
    const cover = {
      ...makePage('Cover'), bgColor: funColors[0],
      wipeIn: 'PageFlip', wipeOut: 'PageFlip',
      narration: { file: '', name: '', autoPlay: true },
      elements: [
        {
          ...makeElem('text', 80, 120, SW2 - 160, 200),
          content: '✨ My Amazing Story Book ✨',
          font: 'Baloo 2', size: 68, weight: '700', color: '#ffe080', align: 'center',
        },
        {
          ...makeElem('text', 180, 360, SW2 - 360, 80),
          content: 'By [Author Name]',
          font: 'Baloo 2', size: 32, weight: '400', color: '#c0e8ff', align: 'center',
        },
        {
          ...makeElem('clip', SW2/2 - 200, 480, 400, 400),
          elLabel: 'cover-art', mediaName: 'cover-art',
        },
        navBtnR('Begin ›', 'next'),
      ],
    }

    // Inner spread pages
    const spreadPage = (name, i, headline, story) => ({
      ...makePage(name), bgColor: funColors[i % funColors.length],
      wipeIn: 'PageFlip', wipeOut: 'PageFlip',
      narration: { file: '', name: '', autoPlay: true },
      elements: [
        // Left half — illustration placeholder
        illustBox(),
        // Gutter line
        {
          ...makeElem('text', midX - 1, 30, 2, SH2 - 60),
          content: '', bgOn: true, bgColor: 'rgba(0,0,0,0.25)',
        },
        // Right half — headline + story text
        {
          ...makeElem('text', midX + 30, 50, midX - 60, 80),
          content: headline, font: 'Baloo 2', size: 34, weight: '700', color: '#ffe080', align: 'left',
        },
        storyText(story, 148, 600),
        // Narration button
        narrationBtn(),
        // Tap-to-reveal interactive element
        tapReveal(midX + 30, 780, midX - 60, 54, '👆 Tap to discover more!'),
        // Navigation
        navBtnL('‹ Back', 'prev'),
        navBtnR('Next ›', 'next'),
      ],
    })

    return [
      cover,
      spreadPage('Spread 1', 1, 'Once upon a time…',    'There lived a curious little creature\nwho loved to explore the world beyond\nthe big enchanted forest.'),
      spreadPage('Spread 2', 2, 'Deep in the forest…', 'She discovered a glowing path\nthat wound between the tall trees,\nleading to a magical clearing.'),
      spreadPage('Spread 3', 3, 'A new friend!',        'There she met a friendly dragon\nwho could juggle fireflies\nand speak in rhymes.'),
      {
        ...makePage('The End'), bgColor: funColors[4],
        wipeIn: 'PageFlip', wipeOut: 'PageFlip',
        narration: { file: '', name: '', autoPlay: true },
        elements: [
          {
            ...makeElem('text', 80, 200, SW2 - 160, 200),
            content: '🌈 The End 🌈',
            font: 'Baloo 2', size: 80, weight: '700', color: '#ffe080', align: 'center',
          },
          {
            ...makeElem('text', 200, 420, SW2 - 400, 80),
            content: 'They all lived happily ever after!',
            font: 'Baloo 2', size: 32, weight: '400', color: '#c0e8ff', align: 'center',
          },
          navBtnL('‹ Back', 'prev'),
          navBtnR('⟳ Again', 'Cover'),
        ],
      },
    ]
  }

  /* ── Digital Magazine ── */
  if (id === 'magazine') {
    const article = (name, headline, sub) => ({
      ...makePage(name), bgColor: '#12121c',
      wipeIn: 'Wipe', wipeOut: 'Wipe',
      elements: [
        txt(headline, 80, 60, 1760, 100, 60, '#ffffff'),
        bodyTxt(sub, 80, 180, 1600, 80),
        navBtn('‹ Prev', 80,   960, 'prev'),
        navBtn('Next ›', 1640, 960, 'next'),
      ],
    })
    return [
      article('Cover',     '📰 Digital Edition',        'Issue 1 — Your Interactive Magazine'),
      article('Feature',   'Feature Article',            'Your main story goes here. Tap to navigate.'),
      article('Gallery',   'Photo Gallery',              'Replace elements with your images.'),
      article('Column',    'Editor\'s Column',           'Opinion piece or editorial content.'),
    ]
  }

  /* ── Corporate Slideshow ── */
  if (id === 'presentation') {
    const slide = (name, headline, body) => ({
      ...makePage(name), bgColor: dark,
      wipeIn: 'Fade', wipeOut: 'Fade',
      timing: { mode: 'auto', duration: 10, ms: 0, onEnd: 'continue' },
      elements: [
        txt(headline, 80, 340, 1760, 120, 72, '#ffffff'),
        bodyTxt(body, 80, 480, 1600, 60),
      ],
    })
    return [
      slide('Title',     'Presentation Title',         'Subtitle or presenter name — Date'),
      slide('Slide 2',   'Key Point One',              'Supporting detail or statistic goes here'),
      slide('Slide 3',   'Key Point Two',              'Another supporting message or visual'),
      { ...makePage('Thank You'), bgColor: '#0a0a1a', timing: { mode: 'pause', duration: 5, ms: 0, onEnd: 'quit' },
        elements: [ txt('Thank You', 360, 400, 1200, 140, 96, acc) ] },
    ]
  }

  /* ── Photo Slideshow ── */
  if (id === 'photo-slideshow') {
    const photoSlide = (name, cap) => ({
      ...makePage(name), bgColor: '#000000',
      wipeIn: 'Fade', wipeOut: 'Fade',
      timing: { mode: 'auto', duration: 7, ms: 0, onEnd: 'continue' },
      elements: [
        { ...makeElem('clip', 0, 0, 1920, 1080), mediaKind: 'image', file: '' },
        bodyTxt(cap, 60, 1000, 1800, 40),
      ],
    })
    return [
      photoSlide('Photo 1', 'Caption for photo 1 — click the clip element to import your image'),
      photoSlide('Photo 2', 'Caption for photo 2'),
      photoSlide('Photo 3', 'Caption for photo 3'),
    ]
  }

  /* ── Quiz ── */
  if (id === 'quiz') {
    const question = (name, qtext, opts, correctTarget) => {
      const labels = ['A', 'B', 'C', 'D']
      const xs = [62, 562], ys = [340, 440]
      return {
        ...makePage(name), bgColor: '#0a1f3a',
        elements: [
          txt('Question', 40, 30, 200, 40, 16, '#6090c0'),
          txt(qtext, 40, 70, 944, 80, 26, '#ffffff'),
          ...opts.map((o, i) => ({
            ...makeElem('button', xs[i % 2], ys[Math.floor(i / 2)], 420, 70),
            label: `${labels[i]}. ${o.label}`,
            action: 'goto', target: o.correct ? correctTarget : 'Wrong Answer',
            bgColor: '#0d2240', fgColor: light, borderColor: '#305080', borderWidth: 2,
            radius: '4px', bevel: false, fontSize: 15, font: 'Rajdhani', fontWeight: '600',
          })),
        ],
      }
    }
    const correct = { ...makePage('Correct!'), bgColor: '#0a2a10',
      elements: [
        txt('✓ Correct!', 200, 260, 624, 100, 56, '#40d060'),
        bodyTxt('Well done! You got the right answer.', 200, 370, 624, 50),
        navBtn('Next Question', 312, 500, 'next'),
      ],
    }
    const wrong = { ...makePage('Wrong Answer'), bgColor: '#2a0a10',
      elements: [
        txt('✗ Try Again', 200, 260, 624, 100, 56, '#e04040'),
        bodyTxt('That was not quite right. Review the question and try again.', 200, 370, 624, 60),
        navBtn('‹ Back', 312, 500, 'prev'),
      ],
    }
    const q1 = question('Question 1', 'What is the capital of France?',
      [{ label: 'London', correct: false }, { label: 'Paris', correct: true }, { label: 'Berlin', correct: false }, { label: 'Madrid', correct: false }],
      'Correct!'
    )
    const q2 = question('Question 2', 'How many sides does a hexagon have?',
      [{ label: 'Five', correct: false }, { label: 'Seven', correct: false }, { label: 'Six', correct: true }, { label: 'Eight', correct: false }],
      'Correct!'
    )
    return [q1, correct, wrong, q2]
  }

  /* ── Interactive Puzzle ── */
  if (id === 'puzzle') {
    const intro = {
      ...makePage('Puzzle Intro'), bgColor: '#0a1a3a',
      elements: [
        txt('🧩 Matching Puzzle', 112, 80, 800, 80, 42, acc),
        bodyTxt('Match each item on the left to its pair on the right.\nClick the buttons in order to make your selections.', 112, 180, 800, 80),
        navBtn('Start Puzzle ›', 312, 460, 'next'),
      ],
    }
    const puzzle = {
      ...makePage('Puzzle 1'), bgColor: '#0a1a3a',
      elements: [
        txt('Match the pairs', 40, 30, 944, 60, 28, acc),
        ...['Item A','Item B','Item C'].map((lbl, i) => ({
          ...makeElem('button', 50, 120 + i * 100, 300, 70),
          label: lbl, action: 'next',
          bgColor: '#1a3a5c', fgColor: light, borderColor: '#4a8fc0', borderWidth: 2,
          radius: '4px', bevel: true, fontSize: 14, font: 'Rajdhani', fontWeight: '600',
        })),
        ...['Match 1','Match 2','Match 3'].map((lbl, i) => ({
          ...makeElem('button', 620, 120 + i * 100, 300, 70),
          label: lbl, action: 'next',
          bgColor: '#1a2a40', fgColor: '#80b0d0', borderColor: '#305070', borderWidth: 2,
          radius: '4px', bevel: false, fontSize: 14, font: 'Rajdhani', fontWeight: '600',
        })),
        navBtn('Check Answer ›', 312, 640, 'next'),
      ],
    }
    const reveal = {
      ...makePage('Answer Reveal'), bgColor: '#0a2a10',
      elements: [
        txt('✓ Answers', 112, 80, 800, 80, 42, '#40d060'),
        bodyTxt('Item A → Match 1\nItem B → Match 2\nItem C → Match 3', 112, 180, 800, 120),
        navBtn('Play Again', 312, 520, 'goto', 'Puzzle 1'),
        navBtn('‹ Intro', 112, 520, 'goto', 'Puzzle Intro'),
      ],
    }
    return [intro, puzzle, reveal]
  }

  /* ── Lesson / Tutorial ── */
  if (id === 'lesson') {
    const step = (name, num, headline, body) => ({
      ...makePage(name), bgColor: num % 2 === 0 ? '#0a1a2a' : '#0f1a30',
      elements: [
        txt(`Step ${num}`, 40, 20, 200, 40, 13, '#6090b0'),
        txt(headline, 40, 55, 944, 70, 34, '#ffffff'),
        bodyTxt(body, 40, 145, 944, 160),
        ...(num > 1 ? [navBtn('‹ Back', 40, 650, 'prev')] : []),
        navBtn(num < 4 ? 'Continue ›' : '✓ Finish', num < 4 ? 764 : 372, 650, num < 4 ? 'next' : 'goto', num < 4 ? '' : 'Step 1'),
      ],
    })
    return [
      step('Intro', 0, 'Welcome to this Lesson', 'This template walks you through a step-by-step tutorial.\nEdit each page to add your own content, images and media.'),
      step('Step 1', 1, 'Lesson Objective',       'Describe what the learner will achieve by the end of this lesson. Keep it clear and specific.'),
      step('Step 2', 2, 'Key Concept',            'Explain the main concept here. Use images or video clips for visual support.'),
      step('Step 3', 3, 'Practice Activity',      'Present a task or activity for the learner to complete. Use buttons to guide interaction.'),
      step('Step 4', 4, 'Summary & Review',       'Recap the key points covered. Celebrate completion and link to the next lesson.'),
    ]
  }

  /* ── Memory Game ── */
  if (id === 'memory-game') {
    return generateMemoryGamePages()
  }

  return [{ ...makePage('Page 1'), bgColor: dark }]
}

function toBlobDownload(content, name, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
  URL.revokeObjectURL(href)
}

// Port assigned by the local HTTP media server in the main process.
// Initialized synchronously from window.smmDesktop.mediaServerPort (set in preload
// via sendSync before any page scripts run), so makeAppMediaUrl always uses HTTP.
let _mediaServerPort = (typeof window !== 'undefined' && window.smmDesktop?.mediaServerPort) || 0

/** Build a URL that the renderer can use to play a native media file.
 *  Prefers the local HTTP server (started in main.cjs) because Chromium's
 *  media pipeline handles standard HTTP range requests perfectly.
 *  Falls back to app-media:// if the port is not yet known (web-only mode).
 */
function makeAppMediaUrl(nativePath) {
  if (_mediaServerPort > 0) {
    return `http://127.0.0.1:${_mediaServerPort}/media?p=${encodeURIComponent(String(nativePath || ''))}`
  }
  // Fallback: legacy app-media:// protocol
  const forward = String(nativePath || '').replace(/\\/g, '/')
  const encoded = forward.split('/').map((seg, i) => {
    if (i === 0 && /^[a-zA-Z]:$/.test(seg)) return seg  // preserve drive letter
    return encodeURIComponent(seg)
  }).join('/')
  return `app-media:///${encoded}`
}

/* ═══════════════════════════════════════════
   WIPE / TRANSITION ENGINE
   ═══════════════════════════════════════════ */
const WIPE_MAP = {
  Fade:             { base: 'wipa-fade',         dir: false },
  CopyBackground:   { base: 'wipa-fade',         dir: false },
  Texture:          { base: 'wipa-fade',         dir: false },
  RandomAlways:     { base: 'wipa-fade',         dir: false },
  RandomOnce:       { base: 'wipa-fade',         dir: false },
  Wipe:             { base: 'wipa-wipe',         dir: true, dirMap: { 0:'-r', 90:'-b', 180:'-l', 270:'-t' }, def: '-r' },
  Straight:         { base: 'wipa-wipe',         dir: true, dirMap: { 0:'-r', 90:'-b', 180:'-l', 270:'-t' }, def: '-r' },
  PaintRoller:      { base: 'wipa-wipe-r',       dir: false },
  Wiper:            { base: 'wipa-wipe',         dir: true, dirMap: { 0:'-r', 90:'-b', 180:'-l', 270:'-t' }, def: '-r' },
  WipeItOff:        { base: 'wipa-wipe-l',       dir: false },
  SplitSweep:       { base: 'wipa-split',        dir: false },
  Center:           { base: 'wipa-center',       dir: false },
  SoftDiagonal:     { base: 'wipa-diagonal',     dir: false },
  DiagonalZooms:    { base: 'wipa-diagonal',     dir: false },
  CornerSlice:      { base: 'wipa-corner',       dir: false },
  ZoomUp:           { base: 'wipa-zoom-in',      dir: false },
  ZoomInOut:        { base: 'wipa-zoom-out',     dir: false },
  ZoomPush:         { base: 'wipa-slide',        dir: true, dirMap: { 0:'-from-l', 90:'-from-t', 180:'-from-r', 270:'-from-b' }, def: '-from-r' },
  InYoFace:         { base: 'wipa-zoom-face',    dir: false },
  SquareZoom:       { base: 'wipa-zoom-in',      dir: false },
  Megalopolis:      { base: 'wipa-zoom-in',      dir: false },
  RandomSquareZoom: { base: 'wipa-zoom-in',      dir: false },
  ScaleIn:          { base: 'wipa-zoom-in',      dir: false },
  Swiss:            { base: 'wipa-zoom-in',      dir: false },
  TheBlob:          { base: 'wipa-zoom-in',      dir: false },
  ReturnOfTheBlob:  { base: 'wipa-zoom-out',     dir: false },
  GlideInOut:       { base: 'wipa-slide',        dir: true, dirMap: { 0:'-from-l', 90:'-from-t', 180:'-from-r', 270:'-from-b' }, def: '-from-r' },
  GlideIn:          { base: 'wipa-slide',        dir: true, dirMap: { 0:'-from-l', 90:'-from-t', 180:'-from-r', 270:'-from-b' }, def: '-from-r' },
  GlideWave:        { base: 'wipa-wave',         dir: false },
  SplineWave:       { base: 'wipa-wave',         dir: false },
  Sine:             { base: 'wipa-sine',         dir: false },
  SwimIn:           { base: 'wipa-slide-from-b', dir: false },
  ArcIn:            { base: 'wipa-arc',          dir: false },
  DropWave:         { base: 'wipa-arc',          dir: false },
  ScrollDivide:     { base: 'wipa-slide',        dir: true, dirMap: { 0:'-from-l', 90:'-from-t', 180:'-from-r', 270:'-from-b' }, def: '-from-r' },
  Stacker:          { base: 'wipa-slide-from-b', dir: false },
  Boomerang:        { base: 'wipa-bounce',       dir: false },
  Damped:           { base: 'wipa-bounce',       dir: false },
  Cascade:          { base: 'wipa-cascade',      dir: false },
  Premiere:         { base: 'wipa-premiere',     dir: false },
  PremiereReveal:   { base: 'wipa-premiere',     dir: false },
  SqueezeIn:        { base: 'wipa-squeeze',      dir: false },
  Stripes:          { base: 'wipa-stripes',      dir: false },
  Stripper:         { base: 'wipa-stripes',      dir: false },
  SuperStripper:    { base: 'wipa-stripes',      dir: false },
  Timeslice:        { base: 'wipa-stripes',      dir: false },
  BlindsFantasy2:   { base: 'wipa-blinds',       dir: false },
  BlindsFantasy3:   { base: 'wipa-blinds',       dir: false },
  SmallBlinds:      { base: 'wipa-blinds',       dir: false },
  ClosingBlinds:    { base: 'wipa-blinds',       dir: false },
  BouncingBlinds:   { base: 'wipa-blinds',       dir: false },
  SpiralIris:       { base: 'wipa-spin-in',      dir: false },
  Crescent:         { base: 'wipa-spin-in',      dir: false },
  Vortex:           { base: 'wipa-spin-in',      dir: false },
  FlipFour:         { base: 'wipa-flip-h',       dir: false },
  FlipCoin:         { base: 'wipa-flip-h',       dir: false },
}

function wipeAnimName(wipeName, wipeDir) {
  const entry = WIPE_MAP[wipeName]
  if (!entry) return 'wipa-fade'
  if (!entry.dir) return entry.base
  const deg = Number(wipeDir) || 0
  const norm = ((deg % 360) + 360) % 360
  const bucket = norm < 45 ? 0 : norm < 135 ? 90 : norm < 225 ? 180 : norm < 315 ? 270 : 0
  return entry.base + (entry.dirMap?.[bucket] || entry.def || '-r')
}

function wipeDuration(speed) {
  const s = Math.max(1, Math.min(10, Number(speed) || 5))
  return ((11 - s) * 0.08 + 0.15).toFixed(2) + 's'
}

function pageWipeStyle(wipeName, speed) {
  return {
    animationName: wipeAnimName(wipeName || 'Fade', 0),
    animationDuration: wipeDuration(speed || 5),
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  }
}

/** @returns {import('react').CSSProperties} */
function elemWipeStyle(wipeName, speed, wipeDir, z) {
  if (!wipeName) return {}
  const stagger = wipeName === 'Cascade' ? 0.18 : 0.06
  return {
    animationName: wipeAnimName(wipeName, wipeDir),
    animationDuration: wipeDuration(speed || 5),
    animationTimingFunction: 'ease-out',
    animationDelay: `${(z || 0) * stagger}s`,
    animationFillMode: 'both',
  }
}

/**
 * @param {{ el: Record<string, any>, elStyle: import('react').CSSProperties, ws: import('react').CSSProperties, onClick: (e: React.MouseEvent) => void }} props
 */
function ButtonEl({ el, elStyle, ws, onClick }) {
  const [over, setOver] = useState(false)
  const [down, setDown] = useState(false)
  const shape = BTN_SHAPES.find((s) => s.key === el.btnShape)
  const stateKey = down ? 'pressed' : over ? 'hover' : 'normal'
  const bg =
    stateKey === 'pressed' ? (el.pressedGrad || el.pressedBg || el.btnGrad || el.bgColor || '#1a3a5c')
    : stateKey === 'hover'   ? (el.hoverGrad   || el.hoverBg   || el.btnGrad || el.bgColor || '#1a3a5c')
    :                           (el.btnGrad     || el.bgColor   || '#1a3a5c')
  const fg =
    stateKey === 'pressed' ? (el.pressedFg || el.fgColor || '#e8a020')
    : stateKey === 'hover'   ? (el.hoverFg   || el.fgColor || '#e8a020')
    :                           (el.fgColor   || '#e8a020')
  const imgSrc =
    stateKey === 'pressed' ? (el.pressedBtnImage || el.btnImage || '')
    : stateKey === 'hover'   ? (el.hoverBtnImage   || el.btnImage || '')
    :                           (el.btnImage        || '')

  /* Text anchor: prefer per-element override, then shape default, then 50%/50% */
  const textLeft = el.textAnchorX || shape?.textX || '50%'
  const textTop  = el.textAnchorY || shape?.textY || '50%'

  const labelSpan = !imgSrc && el.label ? (
    <span style={{
      position: 'absolute',
      left: textLeft,
      top: textTop,
      transform: 'translate(-50%, -50%)',
      width: '80%',
      textAlign: 'center',
      pointerEvents: 'none',
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>{el.label}</span>
  ) : null

  const handlers = {
    onMouseEnter: () => setOver(true),
    onMouseLeave: () => { setOver(false); setDown(false) },
    onMouseDown: () => setDown(true),
    onMouseUp: () => setDown(false),
  }

  /* Clip-path shapes: CSS border renders on the bounding rectangle, not on the
     polygon edge. Use a two-layer approach instead:
     — outer border layer (inset:0, clip-pathed, filled with borderColor)
     — inner fill button (inset:borderWidth, same clip-path, filled with button color)
     The visible ring between them is the "border" following the exact shape edge. */
  if (shape?.clipPath) {
    const bw = el.borderWidth ?? 2
    /** @type {import('react').CSSProperties} */
    const fillStyle = {
      position: 'absolute', top: bw, left: bw, right: bw, bottom: bw,
      background: imgSrc ? `url(${imgSrc}) center/cover no-repeat` : bg,
      color: fg,
      border: 'none', borderRadius: '0px',
      fontSize: el.fontSize || 14,
      fontFamily: `${el.font || 'Rajdhani'}, sans-serif`,
      fontWeight: el.fontWeight || '600',
      textShadow: el.textShadow ? '1px 1px 3px rgba(0,0,0,.8)' : 'none',
      boxShadow: el.bevel ? 'inset 2px 2px 4px rgba(255,255,255,.2), inset -2px -2px 4px rgba(0,0,0,.4)' : 'none',
      filter: el.btnShadow ? 'drop-shadow(2px 3px 6px rgba(0,0,0,.65))' : undefined,
      clipPath: shape.clipPath,
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }
    return (
      <div
        id={`presenter-el-${el.id}`}
        style={{ ...elStyle, ...ws }}
        onClick={onClick}
        {...handlers}
      >
        {/* Border ring: same clip-path, filled solid with borderColor */}
        <div style={{
          position: 'absolute', inset: 0,
          background: el.borderColor || '#4a8fc0',
          clipPath: shape.clipPath,
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        {/* Fill layer: inset by borderWidth so the border layer peeks behind */}
        <button style={{ ...fillStyle, zIndex: 1 }}>
          {labelSpan}
        </button>
      </div>
    )
  }

  /* Non-clip-path shapes (rect, rounded, pill, ellipse): CSS border works correctly */
  /** @type {import('react').CSSProperties} */
  const style = {
    ...elStyle, ...ws,
    background: imgSrc ? `url(${imgSrc}) center/cover no-repeat` : bg,
    color: fg,
    border: `${el.borderWidth ?? 2}px solid ${el.borderColor || '#4a8fc0'}`,
    borderRadius: el.radius || '0px',
    fontSize: el.fontSize || 14,
    fontFamily: `${el.font || 'Rajdhani'}, sans-serif`,
    fontWeight: el.fontWeight || '600',
    textShadow: el.textShadow ? '1px 1px 3px rgba(0,0,0,.8)' : 'none',
    boxShadow: el.bevel ? 'inset 2px 2px 4px rgba(255,255,255,.2), inset -2px -2px 4px rgba(0,0,0,.4)' : 'none',
    filter: el.btnShadow ? 'drop-shadow(2px 3px 6px rgba(0,0,0,.65))' : undefined,
    WebkitMaskImage: el.btnClipPng ? `url(${el.btnClipPng})` : undefined,
    WebkitMaskSize: '100% 100%',
    maskImage: el.btnClipPng ? `url(${el.btnClipPng})` : undefined,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  }
  return (
    <button
      id={`presenter-el-${el.id}`}
      style={style}
      onClick={onClick}
      {...handlers}
    >
      {labelSpan}
    </button>
  )
}

/** Returns extra CSS style props for F4 text visual effects (gradient fill, neon, outline, image-fill). */
function getTextStyleProps(el) {
  if (!el.textStyle || el.textStyle === 'none') return {}
  const c1 = el.textStyleColor1 || '#e8a020'
  const c2 = el.textStyleColor2 || '#62c2ff'
  switch (el.textStyle) {
    case 'gradient-h':
      return { background: `linear-gradient(90deg, ${c1}, ${c2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }
    case 'gradient-v':
      return { background: `linear-gradient(180deg, ${c1}, ${c2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }
    case 'gradient-diag':
      return { background: `linear-gradient(135deg, ${c1}, ${c2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }
    case 'neon-glow':
      return { textShadow: `0 0 6px ${c1}, 0 0 14px ${c1}, 0 0 30px ${c1}99, 0 0 54px ${c1}55`, color: c1 }
    case 'outline-stroke':
      return { WebkitTextStroke: `2px ${c1}`, WebkitTextFillColor: 'transparent', color: 'transparent' }
    case 'shadow-3d':
      return { textShadow: `1px 1px 0 ${c2}, 2px 2px 0 ${c2}cc, 4px 4px 0 ${c2}88, 6px 6px 10px rgba(0,0,0,.6)`, color: c1 }
    case 'image-fill':
      if (!el.textStyleImage) return {}
      return { backgroundImage: `url(${el.textStyleImage})`, backgroundSize: 'cover', backgroundPosition: 'center', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }
    default:
      return {}
  }
}

function PresentationPlayer({ pages, stage, startIdx, onClose, loop, onNavigate, showControls, interactive, devMode, projectVars = [], hideMediaControls, presentationAudio, preCreatedAudioRef, onUpdatePages }) {
  const stageWidth = stage.width
  const stageHeight = stage.height
  const [idx, setIdx] = useState(startIdx || 0)
  const [prevIdx, setPrevIdx] = useState(-1)
  const [pageKey, setPageKey] = useState(0)
  const timerRef = useRef(null)
  const visitCounts = useRef({})  // track visits per page id for ifMode='count'
  const scriptVars = useRef({})   // runtime variable store for ifMode='var'
  const soundRef = useRef(null)   // page background sound <Audio>
  const presAudioRef = useRef(null) // persistent presentation track — survives page changes
  const narrationRef = useRef(null) // per-page narration audio (Piper TTS / loaded WAV)
  const idxRef = useRef(idx)         // stable ref to current idx for lyric sync rAF loop
  const [elapsed, setElapsed] = useState(0)
  const [dbgOpen, setDbgOpen] = useState(true)
  const [dbgVarSnapshot, setDbgVarSnapshot] = useState({})
  const [hideMediaCtrls, setHideMediaCtrls] = useState(!!(interactive || hideMediaControls))
  const pageStartRef = useRef(Date.now())
  const bookmarkRef = useRef(null)    // for GO TO (bookmark) / RETURN TO BOOKMARK
  const [elOverrides, setElOverrides] = useState({}) // {elLabel: {visible, opacity, text, ...}}
  const [hoveredElId, setHoveredElId] = useState(null) // for hover sound/media overlays
  const [clickedElId, setClickedElId] = useState(null) // for click media overlays
  // Fullscreen lightbox: { src, kind, title }
  const [lightbox, setLightbox] = useState(null)
  const [lyricsVisible, setLyricsVisible] = useState(true)
  const [lyricTimingOpen, setLyricTimingOpen] = useState(false)

  // ── Element animation engine ──────────────────────────────
  const elAnimPhase = useRef({})     // el.id → 'in'|'visible'|'out'|'gone'
  const animTimers = useRef([])      // active setTimeout handles (cleared on page change)
  const outWaiters = useRef([])      // el.ids waiting for click/key trigger
  const [, setAnimTick] = useState(0)  // force re-render when phase changes
  // waitToPlay: elements waiting for a click/key before their media starts
  const waitToPlayEls = useRef({})    // el.id → { key?, resolved }
  // showOnTrigger / hideOnTrigger pending ids
  const showTriggerEls = useRef([])   // [{id, trigger, key}]
  const hideTriggerEls = useRef([])   // [{id, trigger, key}]

  // Reset element animation phases when page changes
  useEffect(() => {
    // Clear previous timers
    animTimers.current.forEach(t => clearTimeout(t))
    animTimers.current = []
    outWaiters.current = []
    elAnimPhase.current = {}
    waitToPlayEls.current = {}
    showTriggerEls.current = []
    hideTriggerEls.current = []

    const pg = pages[idx]
    if (!pg) return

    // Set up timers for each animated element
    ;(pg.elements || []).forEach((el) => {
      if (el.visible === false) return

      // ── Wait-to-play registration ──────────────────────────────
      if (el.waitToPlay && el.waitToPlay !== 'none') {
        waitToPlayEls.current[el.id] = { trigger: el.waitToPlay, key: el.waitToPlayKey || '', resolved: false }
      }
      // ── Show/Hide trigger registration ────────────────────────
      if (el.showOnTrigger && el.showOnTrigger !== 'none') {
        showTriggerEls.current.push({ id: el.id, label: el.elLabel || el.id, trigger: el.showOnTrigger, key: el.showOnTriggerKey || '' })
      }
      if (el.hideOnTrigger && el.hideOnTrigger !== 'none') {
        hideTriggerEls.current.push({ id: el.id, label: el.elLabel || el.id, trigger: el.hideOnTrigger, key: el.hideOnTriggerKey || '' })
      }
      if (el.animIn && el.animIn !== 'none') {
        elAnimPhase.current[el.id] = 'in'
        const inDone = el.animInDelay + el.animInDuration

        // After fly-in completes → mark visible
        const t1 = setTimeout(() => {
          elAnimPhase.current[el.id] = 'visible'
          setAnimTick(v => v + 1)

          // Set up fly-out based on trigger
          if (el.animOut && el.animOut !== 'none') {
            if (el.animOutTrigger === 'auto') {
              const t2 = setTimeout(() => {
                elAnimPhase.current[el.id] = 'out'
                setAnimTick(v => v + 1)
                const t3 = setTimeout(() => {
                  elAnimPhase.current[el.id] = 'gone'
                  setAnimTick(v => v + 1)
                }, el.animOutDuration)
                animTimers.current.push(t3)
              }, el.animOutDelay || 0)
              animTimers.current.push(t2)
            } else if (el.animOutTrigger === 'click' || el.animOutTrigger === 'key') {
              outWaiters.current.push(el.id)
            }
          }
        }, inDone)
        animTimers.current.push(t1)
      }
    })
    setAnimTick(v => v + 1)

    return () => {
      animTimers.current.forEach(t => clearTimeout(t))
      animTimers.current = []
    }
  // animTimers/outWaiters are stable refs; only idx change should restart element animations
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  // Handle click/key triggers for fly-out
  function triggerOutWaiters(type, keyStr) {
    const ids = [...outWaiters.current]
    outWaiters.current = []
    ids.forEach((id) => {
      const pg = pages[idx]
      const el = pg?.elements?.find(e => e.id === id)
      if (!el) return
      if (el.animOutTrigger !== type) { outWaiters.current.push(id); return }
      if (type === 'key' && keyStr && el.animOutKey && !matchesKeyCombo(keyStr, el.animOutKey)) { outWaiters.current.push(id); return }
      elAnimPhase.current[id] = 'out'
      const t = setTimeout(() => {
        elAnimPhase.current[id] = 'gone'
        setAnimTick(v => v + 1)
      }, el.animOutDuration)
      animTimers.current.push(t)
    })
    setAnimTick(v => v + 1)
  }

  // Resolve waitToPlay for any element matching the given trigger
  function resolveWaitToPlay(type, keyStr) {
    let changed = false
    Object.entries(waitToPlayEls.current).forEach(([id, info]) => {
      if (info.resolved) return
      if (info.trigger !== type) return
      if (type === 'key' && keyStr && info.key && !matchesKeyCombo(keyStr, info.key)) return
      waitToPlayEls.current[id] = { ...info, resolved: true }
      changed = true
    })
    if (changed) setAnimTick(v => v + 1)
  }

  // Process show/hide triggers for a given interaction type
  function processTriggers(type, keyStr) {
    let changed = false
    showTriggerEls.current.forEach(({ label, trigger, key }) => {
      if (trigger !== type) return
      if (type === 'key' && keyStr && key && !matchesKeyCombo(keyStr, key)) return
      setElOverrides(prev => ({ ...prev, [label]: { ...(prev[label] || {}), visible: true } }))
      changed = true
    })
    hideTriggerEls.current.forEach(({ label, trigger, key }) => {
      if (trigger !== type) return
      if (type === 'key' && keyStr && key && !matchesKeyCombo(keyStr, key)) return
      setElOverrides(prev => ({ ...prev, [label]: { ...(prev[label] || {}), visible: false } }))
      changed = true
    })
    if (changed) setAnimTick(v => v + 1)
  }

  /** Match an event key description like 'Ctrl+Enter' or 'Space' */
  function matchesKeyCombo(evtKey, comboStr) {
    if (!comboStr) return true // blank = any key
    const parts = comboStr.split('+').map(s => s.trim().toLowerCase())
    const mainKey = parts[parts.length - 1]
    const needCtrl = parts.includes('ctrl')
    const needShift = parts.includes('shift')
    const needAlt = parts.includes('alt')
    const ev = _lastKeyEvent.current
    if (!ev) return evtKey.toLowerCase() === mainKey
    if (needCtrl !== ev.ctrlKey) return false
    if (needShift !== ev.shiftKey) return false
    if (needAlt !== ev.altKey) return false
    return ev.key.toLowerCase() === mainKey || ev.code.toLowerCase() === mainKey
  }
  const _lastKeyEvent = useRef(null)

  function runActionChain(chain) {
    let delay = 0
    for (const step of chain) {
      const d = delay
      const s = step
      setTimeout(() => {
        switch (s.action) {
          case 'goto-next': navigate(idx + 1); break
          case 'goto-prev': navigate(idx - 1); break
          case 'goto-page': {
            let i = pages.findIndex(p => p.name === s.target || p.id === s.target)
            if (i < 0) {
              const m = String(s.target || '').match(/^Page\s+(\d+)/i)
              if (m) i = parseInt(m[1], 10) - 1
            }
            if (i >= 0 && i < pages.length) navigate(i)
            break
          }
          case 'goto-element': {
            const node = document.getElementById(`presenter-el-${s.target}`) ||
              [...document.querySelectorAll('[id^="presenter-el-"]')].find(n => {
                const pg = pages.flatMap(p => p.elements || []).find(e => e.elLabel === s.target)
                return pg && n.id === `presenter-el-${pg.id}`
              })
            if (node) {
              node.classList.add('presenter-el-highlight')
              setTimeout(() => node.classList.remove('presenter-el-highlight'), 1500)
            }
            break
          }
          case 'hyperlink': {
            if (s.target) window.open(s.target, '_blank', 'noopener,noreferrer')
            break
          }
          case 'play-media': {
            if (s.target) {
              // Resolve native path to playable URL if needed
              const mediaUrl = isUnresolvedMediaPath(s.target) ? makeAppMediaUrl(s.target) : s.target
              playAudio(mediaUrl, 'chain-' + Math.random().toString(36).slice(2))
            }
            break
          }
          case 'stop-media': {
            document.querySelectorAll('audio, video').forEach(m => {
              const media = /** @type {HTMLMediaElement} */(m)
              media.pause(); media.currentTime = 0
            })
            break
          }
          case 'set-var': {
            const varName = s.customTarget || s.target
            if (varName) { scriptVars.current[varName] = s.targetVal ?? ''; setDbgVarSnapshot({ ...scriptVars.current }) }
            break
          }
          case 'show-element': {
            const pg = pages[idx]; const el2 = (pg?.elements || []).find(e => e.elLabel === s.target)
            if (el2) { const node = document.getElementById(`presenter-el-${el2.id}`); if (node) node.style.visibility = 'visible' }
            break
          }
          case 'hide-element': {
            const pg2 = pages[idx]; const el3 = (pg2?.elements || []).find(e => e.elLabel === s.target)
            if (el3) { const node2 = document.getElementById(`presenter-el-${el3.id}`); if (node2) node2.style.visibility = 'hidden' }
            break
          }
          case 'loop-back': navigate(idx); break
          case 'quit': onClose(); break
          case 'if-then': {
            const varVal = String(scriptVars.current[s.ifVar ?? ''] ?? '')
            const cmpVal = String(s.ifVal ?? '')
            const op = s.ifOp || '=='
            let cond = false
            if (op === '==') cond = varVal === cmpVal
            else if (op === '!=') cond = varVal !== cmpVal
            else if (op === '>') cond = Number(varVal) > Number(cmpVal)
            else if (op === '<') cond = Number(varVal) < Number(cmpVal)
            else if (op === '>=') cond = Number(varVal) >= Number(cmpVal)
            else if (op === '<=') cond = Number(varVal) <= Number(cmpVal)
            else if (op === 'contains') cond = varVal.includes(cmpVal)
            const act = cond ? (s.thenAction || 'goto-next') : (s.elseAction || 'goto-next')
            const tgt = cond ? (s.thenTarget || '') : (s.elseTarget || '')
            runActionChain([{ action: act, target: tgt }])
            break
          }
          case 'script': {
            try {
            const fn = new Function('navigate', 'pages', 'idx', 'vars', s.target || '')
              fn((t) => { const i = pages.findIndex(p => p.name === t || p.id === t); if (i >= 0) navigate(i) }, pages, idx, scriptVars.current)
            } catch (err) { console.error('Action chain script error:', err) }
            break
          }
          default: break
        }
      }, d)
      // For wait action, accumulate delay
      if (step.action === 'wait') delay += Math.max(0, Number(step.target) || 0)
    }
  }

  // Element control callback — used by executeScript for SHOW-EL/HIDE-EL/SET-TEXT/SET-OPACITY
  const elCtrlFn = (label, action, value) => {
    setElOverrides(prev => ({
      ...prev,
      [label]: {
        ...(prev[label] || {}),
        ...(action === 'show'       ? { visible: true }       : {}),
        ...(action === 'hide'       ? { visible: false }      : {}),
        ...(action === 'set-text'   ? { text: value }         : {}),
        ...(action === 'set-opacity'? { opacity: Number(value)}: {}),
        ...(action === 'set-image'  ? { imageSrc: value }     : {}),
      }
    }))
  }

  // Inject system variables into scriptVars at page start
  const injectSystemVars = (pageIdx) => {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const pg = pages[pageIdx]
    const pid = pg?.id || String(pageIdx)
    Object.assign(scriptVars.current, {
      DATE:         now.toISOString().slice(0, 10),
      TIME:         `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
      WEEKDAY:      DAYS[now.getDay()],
      PAGE:         pg?.name || `Page ${pageIdx + 1}`,
      PAGE_NUM:     pageIdx + 1,
      VISIT_COUNT:  visitCounts.current[pid] || 0,
      TOTAL_PAGES:  pages.length,
    })
  }

  // Initialize scriptVars from projectVars defaults on mount
  useEffect(() => {
    const init = {}
    for (const v of projectVars) {
      let val = v.defaultValue ?? ''
      if (v.type === 'number') val = Number(val) || 0
      else if (v.type === 'boolean') val = val === 'true' || val === true
      init[v.name] = val
    }
    scriptVars.current = init
    setDbgVarSnapshot({ ...init })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onNavigateRef = useRef(onNavigate)
  useEffect(() => { onNavigateRef.current = onNavigate })

  // Adaptive scaling — fit stage inside available screen space
  const overlayRef = useRef(null)
  // stageAreaRef measures the EXACT available area for the canvas, bypassing all
  // hardcoded control-bar-height assumptions. This is the definitive source of truth.
  const stageAreaRef = useRef(null)
  // layout = { scale, left, top } — computed together so they are ALWAYS consistent.
  // position:fixed on the wrap means left/top are viewport-relative — no containing-block
  // ambiguity, no flex-layout interaction, no ref-timing dependency.
  const [layout, setLayout] = useState(() => {
    const ctrlH = (showControls !== false && !interactive) ? 40 : 0
    if (!stageWidth || !stageHeight) return { scale: 1, left: 0, top: 0 }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const s = Math.min(vw / stageWidth, (vh - ctrlH) / stageHeight)
    return {
      scale: s,
      left: Math.max(0, Math.round((vw - stageWidth  * s) / 2)),
      top:  Math.max(0, Math.round((vh - ctrlH - stageHeight * s) / 2)),
    }
  })
  const elPlayCounts = useRef({})  // per-element play counts, reset on page change
  const playDurationTimers = useRef({})  // per-element play-duration timers

  useEffect(() => {
    function recalcScale() {
      if (!stageWidth || !stageHeight) return
      // Use overlayRef (position:fixed; inset:0) — guaranteed to equal viewport dimensions.
      // Subtract 1px from height to avoid sub-pixel boundary clips.
      const ctrlH = (showControls !== false && !interactive) ? 40 : 0
      const vw = window.innerWidth
      const vh = window.innerHeight
      const s = Math.min(vw / stageWidth, (vh - ctrlH - 1) / stageHeight)
      setLayout({
        scale: s,
        left: Math.max(0, Math.round((vw - stageWidth  * s) / 2)),
        top:  Math.max(0, Math.round((vh - ctrlH - stageHeight * s) / 2)),
      })
    }
    recalcScale()
    window.addEventListener('resize', recalcScale)
    // Update scale after Electron enters/exits fullscreen
    document.addEventListener('fullscreenchange', recalcScale)
    // Electron/webkit prefixed fullscreen event
    document.addEventListener('webkitfullscreenchange', recalcScale)
    // Belt-and-suspenders: Electron's fullscreen transition may not update
    // window.innerWidth/Height synchronously, so fire delayed recalcs as well.
    const t1 = setTimeout(recalcScale, 100)
    const t2 = setTimeout(recalcScale, 500)
    const t3 = setTimeout(recalcScale, 1000)
    // ResizeObserver on the stage-area catches any remaining cases (e.g. dev-tools open)
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => recalcScale())
      if (stageAreaRef.current) ro.observe(stageAreaRef.current)
      if (overlayRef.current) ro.observe(overlayRef.current)
    }
    return () => {
      window.removeEventListener('resize', recalcScale)
      document.removeEventListener('fullscreenchange', recalcScale)
      document.removeEventListener('webkitfullscreenchange', recalcScale)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      if (ro) ro.disconnect()
    }
  }, [stageWidth, stageHeight, showControls, interactive])

  // Reset per-element play counts and duration timers when page changes
  useEffect(() => {
    elPlayCounts.current = {}
    Object.values(playDurationTimers.current).forEach(clearTimeout)
    playDurationTimers.current = {}
  }, [idx])
  // Snapshot scriptVars for the debug overlay on page change
  useEffect(() => { setDbgVarSnapshot({ ...scriptVars.current }) }, [idx])

  const page = pages[idx] || null

  // Page background sound — play/stop as pages change
  useEffect(() => {
    if (soundRef.current) { soundRef.current.pause(); soundRef.current = null }
    const snd = page?.sound
    if (snd?.file) {
      try {
        const url = /^(https?:|data:|blob:|app-media:)/i.test(snd.file)
          ? snd.file
          : makeAppMediaUrl(snd.file)
        const audio = new Audio(url)
        audio.loop = !!snd.loops
        audio.play().catch(() => {})
        soundRef.current = audio
      } catch { /* ignore */ }
    }
    return () => { if (soundRef.current) { soundRef.current.pause(); soundRef.current = null } }
  }, [idx, page])

  // Per-page narration audio — play/stop on page change
  useEffect(() => {
    if (narrationRef.current) { narrationRef.current.pause(); narrationRef.current.src = '' }
    const nar = page?.narration
    if (nar?.file) {
      try {
        const url = /^(https?:|data:|blob:|app-media:)/i.test(nar.file) ? nar.file : makeAppMediaUrl(nar.file)
        const audio = new Audio(url)
        narrationRef.current = audio
        if (nar.autoPlay !== false) audio.play().catch(() => {})
      } catch { /* ignore */ }
    }
    return () => { if (narrationRef.current) { narrationRef.current.pause(); narrationRef.current.src = '' } }
  }, [idx, page])
  useEffect(() => {
    // Helper to apply trim/offset/rate to an audio element
    const applyAudioClipSettings = (audio, pa) => {
      if (!audio || !pa) return
      audio.playbackRate   = pa.playbackRate   ?? 1
      audio.currentTime    = pa.trimStart      ?? 0
      const trimEnd        = pa.trimEnd
      if (trimEnd != null && trimEnd > 0) {
        const onTimeUpdate = () => {
          if (audio.currentTime >= trimEnd) {
            if (pa.loop !== false) { audio.currentTime = pa.trimStart ?? 0 }
            else { try { audio.pause() } catch { /* noop */ } }
          }
        }
        audio.addEventListener('timeupdate', onTimeUpdate)
        // Return cleanup fn
        return () => audio.removeEventListener('timeupdate', onTimeUpdate)
      }
      return () => {}
    }

    // If the parent pre-started audio synchronously in the user gesture handler
    // (to satisfy browser autoplay policy), adopt that element instead of creating a new one.
    if (preCreatedAudioRef?.current) {
      if (presAudioRef.current && presAudioRef.current !== preCreatedAudioRef.current) {
        try { presAudioRef.current.pause() } catch { /* noop */ }
      }
      presAudioRef.current = preCreatedAudioRef.current
      // Sync volume/loop in case they changed
      if (presentationAudio?.volume != null) presAudioRef.current.volume = presentationAudio.volume
      presAudioRef.current.loop = presentationAudio?.loop !== false
      const cleanTrim = applyAudioClipSettings(presAudioRef.current, presentationAudio)
      const offset = presentationAudio?.offset ?? 0
      const audioEl = presAudioRef.current
      const startPlay = () => audioEl.play().catch((err) => { console.error('[FluxAura Studio] Audio adoption play failed:', err) })
      let timerId
      if (offset > 0) { timerId = setTimeout(startPlay, offset * 1000) } else { startPlay() }
      return () => { clearTimeout(timerId); cleanTrim?.(); if (presAudioRef.current) { try { presAudioRef.current.pause() } catch { /* noop */ } }; presAudioRef.current = null }
    }
    // Fallback path (Electron, or browser with autoplay already granted)
    if (presAudioRef.current) { try { presAudioRef.current.pause() } catch { /* noop */ } presAudioRef.current = null }
    const pa = presentationAudio
    if (!pa?.file) return
    let timerId
    let cleanTrim = () => {}
    try {
      const url   = /^(https?:|data:|blob:|app-media:)/i.test(pa.file) ? pa.file : makeAppMediaUrl(pa.file)
      const audio = new Audio(url)
      audio.loop   = pa.loop !== false
      audio.volume = pa.volume ?? 1
      cleanTrim    = applyAudioClipSettings(audio, pa) ?? (() => {})
      presAudioRef.current = audio
      const doPlay = () => audio.play().catch(() => {})
      if ((pa.offset ?? 0) > 0) { timerId = setTimeout(doPlay, pa.offset * 1000) } else { doPlay() }
    } catch { /* ignore */ }
    return () => { clearTimeout(timerId); cleanTrim(); if (presAudioRef.current) { try { presAudioRef.current.pause() } catch { /* noop */ } presAudioRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally tracking individual properties
  }, [presentationAudio?.file, presentationAudio?.volume, presentationAudio?.loop, presentationAudio?.trimStart, presentationAudio?.trimEnd, presentationAudio?.offset, presentationAudio?.playbackRate])

  // Stop ALL audio/video when player unmounts (user hits Stop or Escape)
  useEffect(() => {
    return () => {
      if (soundRef.current) { try { soundRef.current.pause() } catch { /* noop */ } soundRef.current = null }
      if (presAudioRef.current) { try { presAudioRef.current.pause() } catch { /* noop */ } presAudioRef.current = null }
      if (narrationRef.current) { try { narrationRef.current.pause() } catch { /* noop */ } narrationRef.current = null }
      stopAllAudio()
    }
  }, [])

  // Notify parent of initial page and track elapsed time for progress bar
  useEffect(() => {
    onNavigateRef.current?.(idx)
  // Only run once on mount — navigate() handles subsequent page changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const timedDur = (page?.timing?.mode === 'pause' || page?.timing?.mode === 'auto') ? (Number(page?.timing?.duration) || 0) : 0
  useEffect(() => {
    pageStartRef.current = Date.now()
    setElapsed(0)
    if (timedDur <= 0) return
    const id = setInterval(() => setElapsed(Date.now() - pageStartRef.current), 200)
    return () => clearInterval(id)
  }, [idx, timedDur])

  const navigate = useCallback(
    (nextIdx) => {
      if (nextIdx < 0) return
      if (nextIdx >= pages.length) {
        if (loop) { setPrevIdx(idx); setIdx(0); setPageKey((k) => k + 1); onNavigateRef.current?.(0); return }
        onClose(); return
      }
      // Stop all playing audio/video when leaving a page, unless this page has persistAudio enabled
      if (!pages[idx]?.persistAudio) stopAllAudio()
      setPrevIdx(idx)
      setIdx(nextIdx)
      setPageKey((k) => k + 1)
      onNavigateRef.current?.(nextIdx)
    },
    [pages, onClose, idx, loop],
  )

  // Resolve onEnd target index
  function resolveOnEnd(action, target) {
    if (action === 'next') navigate(idx + 1)
    else if (action === 'prev') navigate(idx - 1)
    else if (action === 'quit') onClose()
    else if (action === 'goto') {
      const tl = (target || '').toLowerCase()
      let i = pages.findIndex((p) => p.name === target || p.id === target)
      if (i < 0) {
        const m = String(target || '').match(/^Page\s+(\d+)/i)
        if (m) i = parseInt(m[1], 10) - 1
      }
      if (i < 0) i = pages.findIndex((p) => p.name?.toLowerCase() === tl)
      if (i < 0) i = pages.findIndex((p) => p.name?.toLowerCase().startsWith(tl + ' '))
      if (i >= 0 && i < pages.length) navigate(i)
      else navigate(idx + 1)
    } else {
      navigate(idx + 1)
    }
  }

  // Page auto-advance
  useEffect(() => {
    if (!page) return
    if (timerRef.current) clearTimeout(timerRef.current)

    // Increment visit count for this page
    const pid = page.id || String(idx)
    visitCounts.current[pid] = (visitCounts.current[pid] || 0) + 1
    const visits = visitCounts.current[pid]

    // Inject system variables for this page
    injectSystemVars(idx)
    // Reset element overrides on each new page
    setElOverrides({})

    // Execute page onStartScript blocks
    if (page.onStartScript?.length) {
      const navigateFromScript = (target) => {
        if (target === 'next') navigate(idx + 1)
        else if (target === 'prev') navigate(idx - 1)
        else {
          const tl = (target || '').toLowerCase()
          let ti = pages.findIndex(p => p.id === target || p.name === target)
          if (ti < 0) ti = pages.findIndex(p => p.name?.toLowerCase() === tl)
          if (ti < 0) ti = pages.findIndex(p => p.name?.toLowerCase().startsWith(tl + ' '))
          if (ti >= 0) navigate(ti)
        }
      }
      executeScript(page.onStartScript, scriptVars.current, pages, navigateFromScript, elCtrlFn, bookmarkRef)
        .catch(console.error)
        .finally(() => setDbgVarSnapshot({ ...scriptVars.current }))
    }

    // Run page-level JS script (inline or external file) + data source
    if (page.pageScript?.enabled) {
      const doRunPageScript = async () => {
        try {
          // 1. Load & apply data source first
          if (page.dataSource?.enabled && page.dataSource.file) {
            try {
              let rawText = ''
              if (window.smmDesktop?.readTextFile) {
                rawText = await window.smmDesktop.readTextFile(page.dataSource.file)
              }
              if (rawText) {
                const fmt = page.dataSource.type || 'json'
                let data = {}
                if (fmt === 'json') {
                  const parsed = JSON.parse(rawText)
                  const root = page.dataSource.rootPath || ''
                  data = root ? root.split('.').reduce((o, k) => o?.[k], parsed) ?? {} : parsed
                } else if (fmt === 'csv') {
                  const lines = rawText.trim().split('\n')
                  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
                  const row = (lines[1]?.split(',') || []).map(v => v.trim().replace(/"/g, ''))
                  headers.forEach((h, i) => { data[h] = row[i] ?? '' })
                } else if (fmt === 'xml') {
                  const doc = new DOMParser().parseFromString(rawText, 'text/xml')
                  doc.querySelectorAll('*').forEach(xmlEl => {
                    if (!xmlEl.children.length) data[xmlEl.tagName] = xmlEl.textContent
                  })
                }
                for (const m of (page.dataSource.mappings ?? [])) {
                  if (m.field && m.varName && data[m.field] !== undefined) {
                    scriptVars.current[m.varName] = data[m.field]
                  }
                }
              }
            } catch (e) { console.warn('PageScript data source error:', e) }
          }
          // 2. Build vars context from sharedVars
          const sharedVars = page.pageScript.sharedVars ?? []
          const ctx = {}
          for (const sv of sharedVars) {
            const alias = sv.alias || sv.varName
            ctx[alias] = scriptVars.current[sv.varName] ?? ''
          }
          // 3. Load and run code
          let code = ''
          if (page.pageScript.mode === 'inline') {
            code = page.pageScript.code ?? ''
          } else if (page.pageScript.mode === 'file' && page.pageScript.file) {
            if (window.smmDesktop?.readTextFile) {
              code = await window.smmDesktop.readTextFile(page.pageScript.file)
            }
          }
          if (code) {
            const fn = new Function('vars', code)
            fn(ctx)
            // Sync modified aliases back to scriptVars
            for (const sv of sharedVars) {
              const alias = sv.alias || sv.varName
              if (ctx[alias] !== undefined) {
                scriptVars.current[sv.varName] = ctx[alias]
              }
            }
            setDbgVarSnapshot({ ...scriptVars.current })
          }
        } catch (e) { console.warn('PageScript execution error:', e) }
      }
      doRunPageScript()
    }

    // Evaluate condition
    const tm = page.timing || {}
    const ifMode = tm.ifMode || 'always'
    let conditionMet = true
    if (ifMode === 'count') {
      conditionMet = visits <= (tm.ifCount ?? 1)
    } else if (ifMode === 'var') {
      const varVal = String(scriptVars.current[tm.ifVar] ?? '')
      const cmpVal = String(tm.ifVal ?? '')
      const op = tm.ifOp || '=='
      if (op === '==') conditionMet = varVal === cmpVal
      else if (op === '!=') conditionMet = varVal !== cmpVal
      else if (op === '>') conditionMet = Number(varVal) > Number(cmpVal)
      else if (op === '<') conditionMet = Number(varVal) < Number(cmpVal)
      else if (op === '>=') conditionMet = Number(varVal) >= Number(cmpVal)
      else if (op === '<=') conditionMet = Number(varVal) <= Number(cmpVal)
    }

    if ((tm.mode === 'pause' || tm.mode === 'auto') && (tm.duration || 0) > 0) {
      timerRef.current = setTimeout(() => {
        if (conditionMet) {
          const onEnd = tm.onEnd || 'continue'
          resolveOnEnd(onEnd === 'continue' ? 'next' : onEnd, tm.onEndTarget)
        } else {
          const elseDo = tm.elseDo || 'none'
          if (elseDo === 'none') navigate(idx + 1)
          else resolveOnEnd(elseDo, tm.elseTarget)
        }
      }, tm.duration * 1000)
    }
    // Loop mode — advance to next page, wrapping back to start at end
    if (tm.mode === 'loop' && (tm.duration || 0) > 0) {
      timerRef.current = setTimeout(() => {
        const next = idx + 1 >= pages.length ? 0 : idx + 1
        navigate(next)
      }, tm.duration * 1000)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- injectSystemVars/resolveOnEnd/pages are recreated each render; including them would cause infinite loops
  }, [idx, page, navigate])

  // Keep idxRef in sync with React idx state (used by lyric-sync loop below)
  useEffect(() => { idxRef.current = idx }, [idx])

  // ── Lyric video sync — advance pages driven by presentation audio position ──
  // When any page has `lyricStart`/`lyricEnd`, we abandon timer-based advances and
  // instead poll the audio element every animation frame, navigating to whichever
  // page matches the current audio time.  This eliminates drift entirely.
  useEffect(() => {
    if (!pages.some(p => p.lyricEnd != null)) return  // not a lyric video

    let rafId
    const sync = () => {
      // Fall back to preCreatedAudioRef when presAudioRef hasn't been adopted yet
      // (e.g. first RAF tick before the audio-adoption useEffect has run, or after
      // React StrictMode's simulated unmount temporarily sets presAudioRef to null)
      const audio = presAudioRef.current ?? preCreatedAudioRef?.current
      if (audio) {
        // Ensure presAudioRef is always in sync so other effects work correctly
        if (!presAudioRef.current) presAudioRef.current = audio

        // Auto-restart if paused unexpectedly (React StrictMode dev-mode unmount
        // calls pause on the element; the adoption effect calls play() again, but
        // as a safety net we restart here too if the audio is still paused)
        if (audio.paused && !audio.ended) {
          audio.play().catch(() => {})
        }

        const t = audio.currentTime

        // Find the page whose lyricStart is the largest value <= t.
        // After user edits in LyricTimingEditor, applyLinesToPages preserves the original
        // page ARRAY ORDER but updates lyricStart values — so lyricStart is no longer
        // guaranteed to be monotonically ascending in the array.
        // We therefore scan ALL pages and track the best match (highest lyricStart <= t).
        // "else break" is intentionally absent here.
        let target = 0
        let bestLs = -1
        for (let i = 0; i < pages.length; i++) {
          const ls = pages[i].lyricStart ?? 0
          if (t >= ls && ls > bestLs) {
            target = i
            bestLs = ls
          }
        }

        if (target !== idxRef.current) {
          // Navigate without stopping audio (all lyric pages have persistAudio=true)
          setPrevIdx(idxRef.current)
          setIdx(target)
          setPageKey(k => k + 1)
          onNavigateRef.current?.(target)
          idxRef.current = target
        }
      }
      rafId = requestAnimationFrame(sync)
    }
    rafId = requestAnimationFrame(sync)
    return () => { if (rafId != null) cancelAnimationFrame(rafId) }
    // preCreatedAudioRef is a stable ref — intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Escape') { onClose(); return }
      _lastKeyEvent.current = e
      // Fire all key-triggered show/hide and waitToPlay resolvers first
      resolveWaitToPlay('key', e.key)
      processTriggers('key', e.key)
      // If any elements are waiting for a key trigger, fire them first
      if (outWaiters.current.length > 0) {
        triggerOutWaiters('key', e.key)
        return  // consume keypress for animation, don't navigate yet
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') navigate(idx + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') navigate(idx - 1)
      if (e.key === ' ') { e.preventDefault(); navigate(idx + 1) }
      // Handle wait-input-goto mode keyboard trigger
      const tm = page?.timing || {}
      if (tm.mode === 'wait-input-goto') {
        const trigger = tm.waitInputTrigger || 'click'
        if (trigger === 'key' || trigger === 'both') {
          const keyFilter = tm.waitInputKey || ''
          const keyMatches = !keyFilter || keyFilter.split(',').map(k => k.trim()).some(k => e.key === k || e.code === k)
          if (keyMatches) {
            const target = tm.waitInputGoto || ''
            if (target) resolveOnEnd('goto', target)
            else navigate(idx + 1)
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- triggerOutWaiters only reads from a stable ref, no need to re-subscribe
  }, [idx, navigate, onClose])

  function handleBgClick() {
    // Trigger click-triggered show/hide and waitToPlay
    resolveWaitToPlay('click', null)
    processTriggers('click', null)
    // Trigger click-triggered fly-outs
    if (outWaiters.current.length > 0) {
      triggerOutWaiters('click')
      return
    }
    const tm = page?.timing || {}
    if (tm.mode === 'wait') {
      const onEnd = tm.onEnd || 'continue'
      resolveOnEnd(onEnd === 'continue' ? 'next' : onEnd, tm.onEndTarget)
    }
    if (tm.mode === 'wait-input-goto') {
      const trigger = tm.waitInputTrigger || 'click'
      if (trigger === 'click' || trigger === 'both') {
        const target = tm.waitInputGoto || ''
        if (target) resolveOnEnd('goto', target)
        else navigate(idx + 1)
      }
    }
  }

  function handleElClick(e, el) {
    e.stopPropagation()
    if (el.audioEvent) {
      playAudio(el.audioEvent, 'ev-' + el.id)
    }
    // Play click sound (all interactive element types)
    if (el.clickSoundFile) {
      const sndUrl = isUnresolvedMediaPath(el.clickSoundFile) ? makeAppMediaUrl(el.clickSoundFile) : el.clickSoundFile
      playAudio(sndUrl, 'click-snd-' + el.id)
    }
    // Click fullscreen lightbox — opens the click media (or element media) fullscreen
    if (el.clickFullscreen) {
      const src = el.clickMediaFile
        ? (isUnresolvedMediaPath(el.clickMediaFile) ? makeAppMediaUrl(el.clickMediaFile) : el.clickMediaFile)
        : (el.file && !isUnresolvedMediaPath(el.file) ? el.file : (el.mediaSourcePath ? makeAppMediaUrl(el.mediaSourcePath) : null))
      if (src) {
        const kind = el.clickMediaFile ? detectMediaKind(el.clickMediaName || el.clickMediaFile) : (el.mediaKind || detectMediaKind(el.mediaName || ''))
        setLightbox({ src, kind, title: el.clickMediaName || el.mediaName || '' })
        return // don't navigate — lightbox is the action
      }
    }
    // Show click media overlay (all interactive element types).
    // If click media is set, wrap the rest of the action in a delayed callback so
    // the video can play before navigating away (auto-duration = playCount * 3s fallback).
    if (el.clickMediaFile) {
      setClickedElId(el.id)
      const plays = el.clickMediaPlayCount || 1
      // Estimate duration — videos fire onEnded which clears clickedElId; this is the fallback
      const delay = plays * 3000
      clearTimeout(/** @type {ReturnType<typeof setTimeout>} */ (window['_smm_click_tmr_' + el.id]))
      // After the media plays, run the navigation action
      const runAction = () => {
        setClickedElId(null)
        handleElClickAction(e, el)
      }
      window['_smm_click_tmr_' + el.id] = setTimeout(runAction, delay)
      // Store runAction so onEnded can fire it early
      window['_smm_click_done_' + el.id] = runAction
      return // navigation happens after media plays
    }
    // Normal state play-then-goto: play element's own media then fire action on ended
    if (el.normalStatePlayThenGoto && el.file) {
      const presEl = document.getElementById(`presenter-el-${el.id}`)
      const mediaEl = /** @type {HTMLMediaElement|null} */ (presEl?.querySelector('video,audio'))
      if (mediaEl && mediaEl.paused) {
        mediaEl.play().catch(() => {})
        return // onEnded will fire handleElClickAction
      }
    }
    handleElClickAction(e, el)
  }

  function handleElClickAction(e, el) {
    if (el.onClickScript?.length) {
      const nav = (target) => {
        if (target === 'next') navigate(idx + 1)
        else if (target === 'prev') navigate(idx - 1)
        else { const ti = pages.findIndex(p => p.id === target || p.name === target); if (ti >= 0) navigate(ti) }
      }
      executeScript(el.onClickScript, scriptVars.current, pages, nav, elCtrlFn, bookmarkRef)
        .catch(console.error)
        .finally(() => setDbgVarSnapshot({ ...scriptVars.current }))
      // Only return early if there's no legacy action to also run
      if (el.type !== 'button') return
    }
    if (el.type === 'button') {
      const act = el.action || 'next'
      if (act === 'quit') { onClose(); return }
      if (act === 'prev') { navigate(idx - 1); return }
      if (act === 'goto') {
        const t = el.target || el.linkTarget || ''
        // Match: exact name → stored page ID → page number prefix → partial case-insensitive
        let i = pages.findIndex((p) => p.name === t || p.id === t)
        if (i < 0) {
          const m = String(t).match(/^Page\s+(\d+)/i)
          if (m) i = parseInt(m[1], 10) - 1
        }
        if (i < 0) i = pages.findIndex((p) => p.name?.toLowerCase() === t.toLowerCase())
        // Also try: page name starts with target (e.g. target='Home' matches 'Home MENU BAR TOP')
        if (i < 0) i = pages.findIndex((p) => p.name?.toLowerCase().startsWith(t.toLowerCase() + ' ') || p.name?.toLowerCase() === t.toLowerCase())
        if (i >= 0 && i < pages.length) {
          navigate(i)
          if (el.gotoObjectId) {
            setTimeout(() => {
              const node = document.getElementById(`presenter-el-${el.gotoObjectId}`)
              if (node) {
                node.classList.add('presenter-el-highlight')
                setTimeout(() => node.classList.remove('presenter-el-highlight'), 1500)
              }
            }, 80)
          }
        }
        return  // always return — never fall through to navigate(idx+1)
      }
      if (act === 'url') {
        const url = el.urlTarget || el.linkTarget || ''
        if (url) window.open(url, '_blank', 'noopener,noreferrer')
        return
      }
      if (act === 'play-media') {
        if (el.mediaFile) playAudio(el.mediaFile, 'pm-' + el.id)
        return  // never fall through to page navigation regardless of mediaFile presence
      }
      if (act === 'event') {
        if (el.elLabel === 'narration-btn' && narrationRef.current) {
          if (narrationRef.current.paused) narrationRef.current.play().catch(() => {})
          else narrationRef.current.pause()
        }
        return
      }
      if (act === 'goto-if') {
        const varVal = String(scriptVars.current[el.gotoIfVar ?? ''] ?? '')
        const cmpVal = String(el.gotoIfVal ?? '')
        const op = el.gotoIfOp || '=='
        let cond = false
        if (op === '==') cond = varVal === cmpVal
        else if (op === '!=') cond = varVal !== cmpVal
        else if (op === '>') cond = Number(varVal) > Number(cmpVal)
        else if (op === '<') cond = Number(varVal) < Number(cmpVal)
        else if (op === '>=') cond = Number(varVal) >= Number(cmpVal)
        else if (op === '<=') cond = Number(varVal) <= Number(cmpVal)
        const tgt = cond ? (el.target || el.linkTarget || '') : (el.gotoIfElse || '')
        if (tgt) {
          let i = pages.findIndex((p) => p.name === tgt || p.id === tgt)
          if (i < 0) {
            const m = String(tgt).match(/^Page\s+(\d+)/i)
            if (m) i = parseInt(m[1], 10) - 1
          }
          if (i < 0) i = pages.findIndex((p) => p.name?.toLowerCase() === tgt.toLowerCase())
          if (i >= 0 && i < pages.length) { navigate(i); return }
        }
        navigate(idx + 1); return
      }
      if (act === 'set-var') {
        if (el.varName) { scriptVars.current[el.varName] = el.varValue ?? ''; setDbgVarSnapshot({ ...scriptVars.current }) }
        return
      }
      if (act === 'script' && el.script?.length) {
        const nav = (target) => {
          if (target === 'next') navigate(idx + 1)
          else if (target === 'prev') navigate(idx - 1)
          else { const ti = pages.findIndex(p => p.id === target || p.name === target); if (ti >= 0) navigate(ti) }
        }
        executeScript(el.script, scriptVars.current, pages, nav)
        setDbgVarSnapshot({ ...scriptVars.current })
        return
      }
      navigate(idx + 1)
      return
    }

    /* ── Hotspot click actions ── */
    if (el.type === 'hotspot') {
      const act = el.action || 'none'
      if (act === 'next') { navigate(idx + 1); return }
      if (act === 'prev') { navigate(idx - 1); return }
      if (act === 'goto-page') {
        // Try: exact name → stored ID → page number embedded in name ("Page 6 …" → idx 5)
        let i = pages.findIndex((p) => p.name === el.gotoPageName || p.id === el.gotoPageId || p.id === el.gotoPageName)
        if (i < 0) {
          const m = String(el.gotoPageName || '').match(/^Page\s+(\d+)/i)
          if (m) i = parseInt(m[1], 10) - 1
        }
        if (i >= 0 && i < pages.length) navigate(i)
        return
      }
      if (act === 'goto-element') {
        const node = document.getElementById(`presenter-el-${el.gotoObjectId}`)
        if (node) {
          node.classList.add('presenter-el-highlight')
          setTimeout(() => node.classList.remove('presenter-el-highlight'), 1500)
        }
        return
      }
      if (act === 'hyperlink') {
        const url = el.linkTarget || ''
        if (url) window.open(url, '_blank', 'noopener,noreferrer')
        return
      }
      if (act === 'script' && el.scriptContent) {
        try {
          const fn = new Function('navigate', 'pages', 'idx', 'vars', el.scriptContent)
          fn(
            (t) => { const i = pages.findIndex((p) => p.name === t || p.id === t); if (i >= 0) navigate(i) },
            pages, idx, scriptVars.current
          )
        } catch (err) { console.error('Hotspot script error:', err) }
        return
      }
      // act === 'none' or unhandled — fall through to actionChain below
    }

    /* ── Universal interaction action chain ── */
    // Run action chain if one exists — regardless of interactive/media flags
    if (el.actionChain?.length) {
      // Check condition gate first
      if (el.ifCondVar) {
        const actual = String(scriptVars.current[el.ifCondVar] ?? '')
        const cmpVal = String(el.ifCondVal ?? '')
        const op = el.ifCondOp || '=='
        let cond = false
        if (op === '==') cond = actual === cmpVal
        else if (op === '!=') cond = actual !== cmpVal
        else if (op === '>') cond = Number(actual) > Number(cmpVal)
        else if (op === '<') cond = Number(actual) < Number(cmpVal)
        else if (op === '>=') cond = Number(actual) >= Number(cmpVal)
        else if (op === '<=') cond = Number(actual) <= Number(cmpVal)
        else if (op === 'contains') cond = actual.includes(cmpVal)
        if (!cond && el.ifCondElse?.length) {
          runActionChain(el.ifCondElse)
          return
        }
        if (!cond) return
      }
      runActionChain(el.actionChain)
      return
    }

    if (el.afterPlay === 'goto' && el.afterPlayTarget) {
      let i = pages.findIndex((p) => p.name === el.afterPlayTarget || p.id === el.afterPlayTarget)
      if (i < 0) {
        const m = String(el.afterPlayTarget).match(/^Page\s+(\d+)/i)
        if (m) i = parseInt(m[1], 10) - 1
      }
      if (i < 0) i = pages.findIndex((p) => p.name?.toLowerCase() === el.afterPlayTarget.toLowerCase())
      if (i >= 0 && i < pages.length) { navigate(i); return }
    }
    if (el.afterPlay === 'goto-if') {
      const varVal = String(scriptVars.current[el.gotoIfVar ?? ''] ?? '')
      const cmpVal = String(el.gotoIfVal ?? '')
      const op = el.gotoIfOp || '=='
      let cond = false
      if (op === '==') cond = varVal === cmpVal
      else if (op === '!=') cond = varVal !== cmpVal
      else if (op === '>') cond = Number(varVal) > Number(cmpVal)
      else if (op === '<') cond = Number(varVal) < Number(cmpVal)
      else if (op === '>=') cond = Number(varVal) >= Number(cmpVal)
      else if (op === '<=') cond = Number(varVal) <= Number(cmpVal)
      const tgt = cond ? (el.afterPlayTarget || '') : (el.gotoIfElse || '')
      if (tgt) {
        let i = pages.findIndex((p) => p.name === tgt || p.id === tgt)
        if (i < 0) {
          const m = String(tgt).match(/^Page\s+(\d+)/i)
          if (m) i = parseInt(m[1], 10) - 1
        }
        if (i < 0) i = pages.findIndex((p) => p.name?.toLowerCase() === tgt.toLowerCase())
        if (i >= 0 && i < pages.length) { navigate(i); return }
      }
      navigate(idx + 1); return
    }
    if (el.afterPlay === 'set-var') {
      if (el.varName) scriptVars.current[el.varName] = el.varValue ?? ''
      return
    }
    if (el.afterPlay === 'url' && el.afterPlayTarget) {
      window.open(el.afterPlayTarget, '_blank', 'noopener,noreferrer')
      return
    }
    if (page?.timing?.mode === 'wait') navigate(idx + 1)
  }

  function renderElements(pg, animateIn) {
    const sorted = [...(pg?.elements || [])].sort((a, b) => a.z - b.z)
    return sorted.map((el) => {
      if (el.visible === false) return null
      // Hide lyric text elements if lyricsVisible is off
      if (el.elLabel === 'lyric' && !lyricsVisible) return null

      // Apply per-element overrides from script SHOW-EL/HIDE-EL/SET-TEXT/SET-OPACITY
      const ov = elOverrides[el.elLabel] || {}
      if (ov.visible === false) return null

      // Evaluate show condition (Show IF variable = value)
      if (el.showCondition?.condVar) {
        const { condVar, condOp = '==', condVal = '' } = el.showCondition
        const actual = String(scriptVars.current[condVar] ?? '')
        const cmpVal = String(condVal)
        let shown = false
        if (condOp === '==')  shown = actual === cmpVal
        else if (condOp === '!=') shown = actual !== cmpVal
        else if (condOp === '>')  shown = Number(actual) > Number(cmpVal)
        else if (condOp === '<')  shown = Number(actual) < Number(cmpVal)
        else if (condOp === '>=') shown = Number(actual) >= Number(cmpVal)
        else if (condOp === '<=') shown = Number(actual) <= Number(cmpVal)
        if (!shown) return null
      }

      /** @type {import('react').CSSProperties} */
      const elStyle = {
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        zIndex: el.z + 1,
        boxSizing: 'border-box',
        ...(ov.opacity != null ? { opacity: ov.opacity / 100 } : {}),
      }
      /** @type {import('react').CSSProperties} */
      const ws = animateIn ? elemWipeStyle(el.wipe, el.wipeSpeed, el.wipeDir, el.z) : {}

      // Compute animation style for an element
      /** @returns {import('react').CSSProperties} */
      function getAnimStyle(el) {
        const phase = elAnimPhase.current[el.id]
        // mediaInTransition overrides animIn for clip/mpeg elements
        const effectiveAnimIn = (el.type === 'clip' || el.type === 'mpeg') && el.mediaInTransition && el.mediaInTransition !== 'none'
          ? el.mediaInTransition
          : el.animIn
        const effectiveAnimInDuration = (el.type === 'clip' || el.type === 'mpeg') && el.mediaInTransition && el.mediaInTransition !== 'none'
          ? (el.mediaInDuration || 500)
          : (el.animInDuration || 600)
        const hasAnimIn = !!(effectiveAnimIn && effectiveAnimIn !== 'none')
        const hasLoop = !!(el.animLoop && el.animLoop !== 'none')
        const loopDef = hasLoop ? ANIM_LOOP_TYPES.find(a => a.key === el.animLoop) : null
        const loopDur = loopDef?.css ? `${(1.5 / (el.animLoopSpeed || 1)).toFixed(2)}s` : null
        if (phase === 'gone') return { opacity: 0, pointerEvents: 'none', visibility: 'hidden' }
        if (!hasAnimIn) {
          // No enter anim — apply continuous loop if present
          if (!loopDef?.css) return {}
          return { animation: `${loopDef.css} ${loopDur} ease-in-out infinite`, willChange: 'transform' }
        }
        const inDef = ANIM_IN_TYPES.find(a => a.key === effectiveAnimIn)
        const outDef = ANIM_OUT_TYPES.find(a => a.key === el.animOut)
        if (phase === 'in' || phase === undefined) {
          if (!inDef?.css) return {}
          // Credits-scroll: element starts off-canvas via CSS, never opacity-hidden
          const isScrollCredits = effectiveAnimIn === 'scroll-up-credits' || effectiveAnimIn === 'scroll-down-credits'
          const repeatCount = el.animInRepeat === 0 ? 'infinite' : (el.animInRepeat && el.animInRepeat > 1 ? String(el.animInRepeat) : '1')
          if (isScrollCredits) {
            return {
              animation: `${inDef.css} ${effectiveAnimInDuration}ms linear ${el.animInDelay || 0}ms both`,
              overflow: 'visible',
              willChange: 'transform',
            }
          }
          return {
            animation: `${inDef.css} ${effectiveAnimInDuration}ms ${el.animInEasing || 'ease-out'} ${el.animInDelay || 0}ms ${repeatCount} both`,
            opacity: 0,
            willChange: 'transform, opacity',
          }
        }
        if (phase === 'visible') {
          if (loopDef?.css) {
            return { animation: `${loopDef.css} ${loopDur} ease-in-out infinite`, willChange: 'transform' }
          }
          return {}
        }
        if (phase === 'out') {
          if (!outDef?.css) return { opacity: 0, pointerEvents: 'none' }
          return {
            animation: `${outDef.css} ${el.animOutDuration || 600}ms ease-in forwards`,
            willChange: 'transform, opacity',
          }
        }
        return {}
      }

      // Merge text override
      const effectiveContent = ov.text != null ? ov.text : el.content

      if (el.type === 'text') {
        const isCreditsScroll = el.animIn === 'scroll-up-credits' || el.animIn === 'scroll-down-credits'

        // Karaoke mode: when the current page has word timestamps and this is the lyric element
        const karaokeWords = (el.elLabel === 'lyric' && pg.wordTimestamps?.length > 0)
          ? pg.wordTimestamps
          : null

        const textCommonStyle = /** @type {import('react').CSSProperties} */ ({
          ...elStyle, ...ws, ...getAnimStyle(el),
          display: 'flex',
          alignItems: isCreditsScroll ? 'flex-start' : ({ top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.vAlign] || 'center'),
          overflow: isCreditsScroll ? 'visible' : (el.textScrollable ? 'auto' : 'hidden'),
          wordBreak: 'break-word',
          scrollbarWidth: el.textScrollable ? /** @type {'thin'} */ ('thin') : undefined,
          fontFamily: `${el.font || 'Rajdhani'}, sans-serif`,
          fontSize: el.size, fontWeight: el.weight,
          color: el.color || '#e8a020', textAlign: el.align || 'center',
          fontStyle: el.italic ? 'italic' : 'normal',
          textDecoration: el.underline ? 'underline' : 'none',
          textShadow: el.shadow ? '2px 2px 4px rgba(0,0,0,.7)' : 'none',
          background: el.bgOn ? el.bgColor : 'transparent',
          cursor: (el.audioEvent || el.afterPlay !== 'none') ? 'pointer' : (el.textScrollable ? 'default' : 'default'),
          userSelect: el.textScrollable ? /** @type {'text'} */ ('text') : /** @type {'none'} */ ('none'),
          ...getTextStyleProps(el),
        })

        if (karaokeWords) {
          return (
            <div
              key={el.id}
              id={`presenter-el-${el.id}`}
              style={textCommonStyle}
              onClick={(e) => handleElClick(e, el)}
            >
              <KaraokeText
                words={karaokeWords}
                audioRef={presAudioRef}
                activeColor='#f59e0b'
              />
            </div>
          )
        }

        return (
          <div
            key={el.id}
            id={`presenter-el-${el.id}`}
            style={textCommonStyle}
            onClick={(e) => handleElClick(e, el)}
            dangerouslySetInnerHTML={{ __html: esc(effectiveContent || '').replaceAll('\n', '<br/>') }}
          />
        )
      }

      if (el.type === 'clip') {
        const kind = el.mediaKind || detectMediaKind(el.file || '')

        // ── Shape Button (transparent PNG with alpha hit-test + bevel) ──
        if (el.shapeButton && el.file && kind === 'image') {
          return (
            <div
              key={el.id}
              id={`presenter-el-${el.id}`}
              style={{ ...elStyle, ...ws, ...getAnimStyle(el), overflow: 'visible' }}
            >
              <ShapeButton
                src={el.file}
                width={el.w}
                height={el.h}
                onPressed={(e) => handleElClick(e, el)}
                hoverScale={el.sbHoverScale ?? 1.06}
                bevel={!!el.sbBevel}
                bevelIntensity={el.sbBevelIntensity ?? 3}
                colorOverlay={el.sbOverlayOn ? (el.sbOverlayColor || null) : null}
                colorOverlayOpacity={el.sbOverlayOpacity ?? 0.35}
                alphaThreshold={el.sbAlphaThreshold ?? 10}
                lightDirection={el.sbLightDir ?? [0.55, 0.70, 0.80]}
                opacity={(el.opacity ?? 100) / 100}
                disabled={false}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          )
        }

        // When media fails to load in presenter, execute afterPlay so the script chain isn't broken
        const handleMediaError = () => {
          if (el.afterPlay && el.afterPlay !== 'none') handleElClick({ stopPropagation: () => {} }, el)
        }
        // When media finishes playing (and is not looping), execute afterPlay
        const handleMediaEnded = () => {
          if (!el.loop) handleElClick({ stopPropagation: () => {} }, el)
        }
        return (
          <div
            key={el.id}
            id={`presenter-el-${el.id}`}
            style={{ ...elStyle, ...ws, ...getAnimStyle(el), ...getMediaShadowStyle(el), overflow: el.mediaShadow && !el.mediaShadowInner ? 'visible' : 'hidden', cursor: (el.audioEvent || el.afterPlay !== 'none' || el.interactive || el.hoverMediaFile || el.hoverSoundFile || el.clickMediaFile || el.clickSoundFile || el.actionChain?.length) ? 'pointer' : 'default',
              // audioHidden: outer div is invisible, but audio child plays normally
              ...(el.audioHidden && kind === 'audio' ? { visibility: 'hidden', pointerEvents: 'none', width: 0, height: 0, overflow: 'visible' } : {})
            }}
            onClick={(e) => handleElClick(e, el)}
            onMouseEnter={() => {
              setHoveredElId(el.id)
              if (el.hoverSoundFile) playAudio(isUnresolvedMediaPath(el.hoverSoundFile) ? makeAppMediaUrl(el.hoverSoundFile) : el.hoverSoundFile, 'hover-snd-' + el.id)
              if (el.hoverFullscreen && el.hoverMediaFile) {
                const src = isUnresolvedMediaPath(el.hoverMediaFile) ? makeAppMediaUrl(el.hoverMediaFile) : el.hoverMediaFile
                setLightbox({ src, kind: detectMediaKind(el.hoverMediaName || el.hoverMediaFile), title: el.hoverMediaName || '' })
              }
            }}
            onMouseLeave={() => {
              setHoveredElId(null)
            }}
          >
            {el.file && kind === 'image' && !isUnresolvedMediaPath(ov.imageSrc ?? el.file) && (
              <img src={ov.imageSrc ?? el.file} alt="" onError={handleMediaError} style={{ width: '100%', height: '100%', objectFit: el.fit || 'contain', opacity: (el.opacity || 100) / 100 }} />
            )}
            {el.file && kind === 'image' && isUnresolvedMediaPath(ov.imageSrc ?? el.file) && (
              <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: 'rgba(232,160,32,.5)', fontSize: 11, textAlign: 'center', padding: 4, background: 'rgba(0,0,0,.25)', border: '1px dashed rgba(232,160,32,.3)' }}>
                🔍 {el.mediaName || el.file.split(/[/\\]/).pop() || 'Unresolved media'}<br /><span style={{ fontSize: 9, opacity: 0.7 }}>Use Resolve Media to locate file</span>
              </div>
            )}
            {el.file && kind === 'video' && (el.chromaColor || el.chromaMaskShape) && (
              /* Chroma key / shape mask — rendered via VideoChromaCanvas (real-time CPU per-pixel) */
              <VideoChromaCanvas
                key={el.file}
                src={el.file}
                chromaColor={el.chromaColor || null}
                tolerance={el.chromaTolerance != null ? el.chromaTolerance : 30}
                softness={el.chromaSoftness  != null ? el.chromaSoftness  : 8}
                maskShape={el.chromaMaskShape || null}
                loop={el.playCount ? false : !!el.loop}
                muted={el.mediaMuted || el.replaceAudio || !el.unmuted}
                volume={el.mediaVolume != null ? el.mediaVolume : 1.0}
                style={{ objectFit: el.fit || 'contain' }}
              />
            )}
            {el.file && kind === 'video' && !(el.chromaColor || el.chromaMaskShape) && (
              <>
              <video key={el.file} src={el.file} autoPlay={
                el.onPlayMode !== 'click' && el.onPlayMode !== 'click-next' && el.onPlayMode !== 'hover' && el.onPlayMode !== 'after-element' && el.onPlayMode !== 'delay' &&
                el.normalStatePlayTrigger !== 'click' && el.normalStatePlayTrigger !== 'hover' &&
                (!el.waitToPlay || el.waitToPlay === 'none' || waitToPlayEls.current[el.id]?.resolved)
              } muted={el.mediaMuted || el.replaceAudio || !el.unmuted}
                loop={el.playCount ? false : (el.playDurationMs ? false : !!el.loop)}
                playsInline controls={!hideMediaCtrls && el.showMediaControls !== false}
                ref={(vid) => {
                  if (vid && el.mediaVolume != null) vid.volume = el.mediaVolume
                }}
                onLoadedMetadata={(ev) => {
                  const vid = /** @type {HTMLVideoElement} */(ev.target)
                  if (el.mediaVolume != null) vid.volume = el.mediaVolume
                  const seekTo = el.normalStatePauseMs != null && el.normalStatePauseMs > 0
                    ? el.normalStatePauseMs / 1000
                    : (el.mediaStartTime || 0)
                  if (seekTo > 0) {
                    vid.currentTime = seekTo
                    vid._smm_paused_at = false
                  }
                }}
                onPlay={(ev) => {
                  if (el.playDurationMs > 0) {
                    clearTimeout(playDurationTimers.current[el.id])
                    const vid = /** @type {HTMLVideoElement} */(ev.target)
                    playDurationTimers.current[el.id] = setTimeout(() => { try { vid.pause() } catch { /* ignore */ } }, el.playDurationMs)
                  }
                }}
                onTimeUpdate={(ev) => {
                  const v = /** @type {HTMLVideoElement} */(ev.target)
                  if (el.mediaPauseTime != null && v.currentTime >= el.mediaPauseTime && !v._smm_paused_at) {
                    v._smm_paused_at = true
                    v.pause()
                    const act = el.mediaPauseAction || 'none'
                    if (act === 'loop') {
                      v.currentTime = el.mediaStartTime || 0
                      v._smm_paused_at = false
                      v.play().catch(() => {})
                    } else if (act === 'stop') {
                      // stay frozen
                    } else if (act !== 'none') {
                      handleElClick({ stopPropagation: () => {} }, {
                        ...el,
                        type: 'hotspot',
                        action: act,
                        linkTarget: el.mediaPauseTarget,
                        gotoPageName: el.mediaPauseTarget,
                        gotoObjectId: el.mediaPauseTarget,
                        scriptContent: el.mediaPauseScript,
                      })
                    }
                  }
                  if (el.mediaEndTime != null && v.currentTime >= el.mediaEndTime) {
                    v.pause()
                    v.currentTime = el.mediaEndTime
                    handleElClick({ stopPropagation: () => {} }, el)
                  }
                }}
                onError={handleMediaError}
                onEnded={(ev) => {
                  clearTimeout(playDurationTimers.current[el.id])
                  const med = /** @type {HTMLVideoElement} */(ev.target)
                  if (el.playCount && el.playCount > 1) {
                    const cnt = (elPlayCounts.current[el.id] || 0) + 1
                    elPlayCounts.current[el.id] = cnt
                    if (cnt < el.playCount) { med.currentTime = el.mediaStartTime || 0; med.play().catch(() => {}) }
                    else if (el.normalStatePlayThenGoto) { handleElClickAction({ stopPropagation: () => {} }, el) }
                    else { handleElClick({ stopPropagation: () => {} }, el) }
                  } else if (el.normalStatePlayThenGoto) {
                    handleElClickAction({ stopPropagation: () => {} }, el)
                  } else { handleMediaEnded() }
                }}
                onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', height: '100%', objectFit: el.fit || 'contain' }} />
              {el.replaceAudio && el.replacedAudioFile && (
                <audio
                  key={`ra-${el.id}-${el.replacedAudioFile}`}
                  src={el.replacedAudioFile}
                  autoPlay loop={!!el.loop}
                  muted={!!el.mediaMuted}
                  ref={(a) => { if (a && el.replacedAudioVolume != null) a.volume = el.replacedAudioVolume }}
                  style={{ display: 'none' }}
                />
              )}
              </>
            )}
            {el.file && kind === 'audio' && !isMidiMedia(el.mediaName || el.file) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: (!hideMediaCtrls && el.showMediaControls !== false) ? 8 : 0, boxSizing: 'border-box' }}>
                {(!hideMediaCtrls && el.showMediaControls !== false) ? (
                  /* Controls visible — render full-width audio player */
                  <audio src={el.file} autoPlay={el.onPlayMode !== 'click' && el.onPlayMode !== 'click-next' && el.onPlayMode !== 'hover' && el.onPlayMode !== 'after-element' && el.onPlayMode !== 'delay' && el.normalStatePlayTrigger !== 'click' && el.normalStatePlayTrigger !== 'hover'}
                    loop={el.playCount ? false : (el.playDurationMs ? false : !!el.loop)}
                    muted={!!el.mediaMuted}
                    controls
                    ref={(a) => { if (a && el.mediaVolume != null) a.volume = el.mediaVolume }}
                    onLoadedMetadata={(ev) => { if (el.mediaVolume != null) (/** @type {HTMLAudioElement} */(ev.target)).volume = el.mediaVolume }}
                    onPlay={(ev) => {
                      if (el.playDurationMs > 0) {
                        clearTimeout(playDurationTimers.current[el.id])
                        const aud = /** @type {HTMLAudioElement} */(ev.target)
                        playDurationTimers.current[el.id] = setTimeout(() => { try { aud.pause() } catch { /* ignore */ } }, el.playDurationMs)
                      }
                    }}
                    onError={handleMediaError}
                    onEnded={(ev) => {
                      clearTimeout(playDurationTimers.current[el.id])
                      const aud = /** @type {HTMLAudioElement} */(ev.target)
                      if (el.playCount && el.playCount > 1) {
                        const cnt = (elPlayCounts.current[el.id] || 0) + 1
                        elPlayCounts.current[el.id] = cnt
                        if (cnt < el.playCount) { aud.currentTime = 0; aud.play().catch(() => {}) }
                        else if (el.normalStatePlayThenGoto) { handleElClickAction({ stopPropagation: () => {} }, el) }
                        else { handleElClick({ stopPropagation: () => {} }, el) }
                      } else if (el.normalStatePlayThenGoto) {
                        handleElClickAction({ stopPropagation: () => {} }, el)
                      } else { handleMediaEnded() }
                    }}
                    onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%' }} />
                ) : (
                  /* Controls hidden — invisible audio + clean icon frame */
                  <>
                    <audio src={el.file} autoPlay={el.onPlayMode !== 'click' && el.onPlayMode !== 'click-next' && el.onPlayMode !== 'hover' && el.onPlayMode !== 'after-element' && el.onPlayMode !== 'delay' && el.normalStatePlayTrigger !== 'click' && el.normalStatePlayTrigger !== 'hover'}
                      loop={el.playCount ? false : (el.playDurationMs ? false : !!el.loop)}
                      muted={!!el.mediaMuted}
                      ref={(a) => { if (a && el.mediaVolume != null) a.volume = el.mediaVolume }}
                      onLoadedMetadata={(ev) => { if (el.mediaVolume != null) (/** @type {HTMLAudioElement} */(ev.target)).volume = el.mediaVolume }}
                      onPlay={(ev) => {
                        if (el.playDurationMs > 0) {
                          clearTimeout(playDurationTimers.current[el.id])
                          const aud = /** @type {HTMLAudioElement} */(ev.target)
                          playDurationTimers.current[el.id] = setTimeout(() => { try { aud.pause() } catch { /* ignore */ } }, el.playDurationMs)
                        }
                      }}
                      onError={handleMediaError}
                      onEnded={(ev) => {
                        clearTimeout(playDurationTimers.current[el.id])
                        const aud = /** @type {HTMLAudioElement} */(ev.target)
                        if (el.playCount && el.playCount > 1) {
                          const cnt = (elPlayCounts.current[el.id] || 0) + 1
                          elPlayCounts.current[el.id] = cnt
                          if (cnt < el.playCount) { aud.currentTime = 0; aud.play().catch(() => {}) }
                          else if (el.normalStatePlayThenGoto) { handleElClickAction({ stopPropagation: () => {} }, el) }
                          else { handleElClick({ stopPropagation: () => {} }, el) }
                        } else if (el.normalStatePlayThenGoto) {
                          handleElClickAction({ stopPropagation: () => {} }, el)
                        } else { handleMediaEnded() }
                      }}
                      style={{ width: 0, height: 0, position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                    <div className="media-frame-icon">
                      <span className="media-frame-note">♪</span>
                      <span className="media-frame-label" title={el.mediaName}>{el.mediaName || 'Audio'}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            {el.file && kind === 'audio' && isMidiMedia(el.mediaName || el.file) && (
              <MidiClipPlayer
                src={el.file}
                label={el.mediaName || 'MIDI'}
                onError={handleMediaError}
                showControls={!hideMediaCtrls && el.showMediaControls !== false}
                autoPlay={hideMediaCtrls || el.showMediaControls === false || el.onPlayMode !== 'click'}
              />
            )}
            {el.file && kind === 'pdf' && (
              <iframe
                key={el.file}
                src={`${el.file}${el.pdfPage ? `#page=${el.pdfPage}` : ''}`}
                title={el.mediaName || 'PDF'}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                onError={handleMediaError}
              />
            )}
            {(!el.file || (kind !== 'image' && kind !== 'video' && kind !== 'audio' && kind !== 'pdf' && isUnresolvedMediaPath(el.file))) && (
              <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: 'rgba(232,160,32,.3)', fontSize: 11, textAlign: 'center', padding: 4 }}>
                ⚠ {el.mediaName || 'Media missing'}
              </div>
            )}
            {/* Hover media overlay — plays video/GIF/webp on mouse-enter */}
            {hoveredElId === el.id && el.hoverMediaFile && (() => {
              const hovUrl = isUnresolvedMediaPath(el.hoverMediaFile) ? makeAppMediaUrl(el.hoverMediaFile) : el.hoverMediaFile
              const hovKind = detectMediaKind(el.hoverMediaName || el.hoverMediaFile)
              return (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
                  {hovKind === 'video'
                    ? <video key={hovUrl} src={hovUrl} autoPlay muted={true} loop={el.hoverMediaLoop !== false} playsInline
                        onLoadedMetadata={(ev) => {
                          const v = /** @type {HTMLVideoElement} */(ev.target)
                          if (el.hoverMediaFromMs) v.currentTime = el.hoverMediaFromMs / 1000
                        }}
                        onTimeUpdate={(ev) => {
                          if (el.hoverMediaToMs) {
                            const v = /** @type {HTMLVideoElement} */(ev.target)
                            if (v.currentTime >= el.hoverMediaToMs / 1000) { v.pause(); v.currentTime = (el.hoverMediaFromMs || 0) / 1000 }
                          }
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={hovUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  }
                </div>
              )
            })()}
            {/* Click/Select media overlay — plays on click, then fires navigation */}
            {clickedElId === el.id && el.clickMediaFile && (() => {
              const clkUrl = isUnresolvedMediaPath(el.clickMediaFile) ? makeAppMediaUrl(el.clickMediaFile) : el.clickMediaFile
              const clkKind = detectMediaKind(el.clickMediaName || el.clickMediaFile)
              const onDone = () => {
                clearTimeout(/** @type {ReturnType<typeof setTimeout>} */ (window['_smm_click_tmr_' + el.id]))
                const cb = /** @type {Function|undefined} */ (window['_smm_click_done_' + el.id])
                delete window['_smm_click_done_' + el.id]
                if (cb) cb(); else setClickedElId(null)
              }
              return (
                <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
                  {clkKind === 'video'
                    ? <video key={clkUrl} src={clkUrl} autoPlay muted={false} loop={!!el.clickMediaLoop} playsInline
                        onLoadedMetadata={(ev) => {
                          const v = /** @type {HTMLVideoElement} */(ev.target)
                          if (el.clickMediaFromMs) v.currentTime = el.clickMediaFromMs / 1000
                        }}
                        onTimeUpdate={(ev) => {
                          if (el.clickMediaToMs) {
                            const v = /** @type {HTMLVideoElement} */(ev.target)
                            if (v.currentTime >= el.clickMediaToMs / 1000) { v.pause(); onDone() }
                          }
                        }}
                        onEnded={onDone} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={clkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  }
                </div>
              )
            })()}
            {el.frameBorder?.enabled && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20, ...getFrameCSS(el.frameBorder) }} />
            )}
          </div>
        )
      }

      if (el.type === 'button') {
        const animStyle = getAnimStyle(el)
        return <ButtonEl key={el.id} el={el} elStyle={{...elStyle, ...animStyle}} ws={ws} onClick={(e) => handleElClick(e, el)} />
      }

      if (el.type === 'mpeg') {
        const handleMpegError = () => {
          if (el.afterPlay && el.afterPlay !== 'none') handleElClick({ stopPropagation: () => {} }, el)
        }
        const handleMpegEnded = () => {
          if (!el.loop) handleElClick({ stopPropagation: () => {} }, el)
        }
        return (
          <div
            key={el.id}
            id={`presenter-el-${el.id}`}
            style={{ ...elStyle, ...ws, ...getAnimStyle(el), background: '#000', overflow: 'hidden' }}
            onClick={(e) => handleElClick(e, el)}
            onMouseEnter={(e) => {
              if (el.normalStatePlayTrigger === 'hover') {
                const mediaEl = /** @type {HTMLMediaElement|null} */ (e.currentTarget.querySelector('video,audio'))
                if (mediaEl?.paused) mediaEl.play().catch(() => {})
              }
            }}
          >
            {el.file
              ? <video key={el.file} src={el.file} autoPlay={el.onPlayMode !== 'click' && el.onPlayMode !== 'click-next' && el.onPlayMode !== 'hover' && el.onPlayMode !== 'after-element' && el.onPlayMode !== 'delay' && el.normalStatePlayTrigger !== 'click' && el.normalStatePlayTrigger !== 'hover'} muted={!el.unmuted}
                  loop={el.playCount ? false : !!el.loop}
                  playsInline controls={!hideMediaCtrls && el.showMediaControls !== false}
                  onLoadedMetadata={(ev) => {
                    const vid = /** @type {HTMLVideoElement} */(ev.target)
                    const seekTo = el.normalStatePauseMs != null && el.normalStatePauseMs > 0
                      ? el.normalStatePauseMs / 1000
                      : (el.mediaStartTime || 0)
                    if (seekTo > 0) {
                      vid.currentTime = seekTo
                      vid._smm_paused_at = false
                    }
                  }}
                  onTimeUpdate={(ev) => {
                    const v = /** @type {HTMLVideoElement} */(ev.target)
                    if (el.mediaPauseTime != null && v.currentTime >= el.mediaPauseTime && !v._smm_paused_at) {
                      v._smm_paused_at = true
                      v.pause()
                      const act = el.mediaPauseAction || 'none'
                      if (act === 'loop') {
                        v.currentTime = el.mediaStartTime || 0
                        v._smm_paused_at = false
                        v.play().catch(() => {})
                      } else if (act === 'stop') {
                        // stay frozen
                      } else if (act !== 'none') {
                        handleElClick({ stopPropagation: () => {} }, {
                          ...el,
                          type: 'hotspot',
                          action: act,
                          linkTarget: el.mediaPauseTarget,
                          gotoPageName: el.mediaPauseTarget,
                          gotoObjectId: el.mediaPauseTarget,
                          scriptContent: el.mediaPauseScript,
                        })
                      }
                    }
                    if (el.mediaEndTime != null && v.currentTime >= el.mediaEndTime) {
                      v.pause()
                      v.currentTime = el.mediaEndTime
                      handleElClick({ stopPropagation: () => {} }, el)
                    }
                  }}
                  onError={handleMpegError}
                  onEnded={(ev) => {
                    const med = /** @type {HTMLVideoElement} */(ev.target)
                    if (el.playCount && el.playCount > 1) {
                      const cnt = (elPlayCounts.current[el.id] || 0) + 1
                      elPlayCounts.current[el.id] = cnt
                      if (cnt < el.playCount) { med.currentTime = el.mediaStartTime || 0; med.play().catch(() => {}) }
                      else if (el.normalStatePlayThenGoto) { handleElClickAction({ stopPropagation: () => {} }, el) }
                      else { handleElClick({ stopPropagation: () => {} }, el) }
                    } else if (el.normalStatePlayThenGoto) {
                      handleElClickAction({ stopPropagation: () => {} }, el)
                    } else { handleMpegEnded() }
                  }}
                  onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', height: '100%', objectFit: el.fit || 'contain' }} />
              : <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: 'rgba(232,160,32,.3)', fontSize: 11, textAlign: 'center', padding: 4 }}>⚠ {el.mediaName || 'Video missing'}</div>
            }
            {el.frameBorder?.enabled && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20, ...getFrameCSS(el.frameBorder) }} />
            )}
          </div>
        )
      }

      /* ── Hotspot element — in presenter: invisible click area ── */
      if (el.type === 'hotspot') {
        const hasInteraction = (el.action && el.action !== 'none') || !!el.clickMediaFile || !!el.clickSoundFile || !!el.hoverMediaFile || !!el.hoverSoundFile
        const isClickable = hasInteraction
        const bw = el.borderOn ? (el.borderWidth ?? 2) : 0
        const w = el.w, h = el.h
        const cx = w / 2, cy = h / 2, rx = w / 2 - bw / 2, ry = h / 2 - bw / 2
        const bc = el.borderColor || '#3cb8be'
        const isSolid = el.borderStyle === 'solid'
        const bs = isSolid ? undefined : (el.borderStyle === 'dotted' ? `${bw * 3},${bw * 2}` : `${bw * 4},${bw * 3}`)
        const ngon = (n, startAngle = -Math.PI / 2) =>
          Array.from({ length: n }, (_, i) => {
            const a = startAngle + (2 * Math.PI * i) / n
            return `${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`
          }).join(' ')
        const star = () =>
          Array.from({ length: 10 }, (_, i) => {
            const a = -Math.PI / 2 + (Math.PI * i) / 5
            const r = i % 2 === 0 ? Math.min(rx, ry) : Math.min(rx, ry) * 0.42
            return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
          }).join(' ')
        const shape = el.hotspotShape || 'rect'
        const pts = el.points || []
        const svgFill = el.fillOpacity > 0 ? el.fillColor || '#ffffff' : 'transparent'
        const svgFillOp = el.fillOpacity || 0
        const sp = { fill: svgFill, fillOpacity: svgFillOp, stroke: bw > 0 ? bc : 'none', strokeWidth: bw, strokeDasharray: bs }

        let svgShape = null
        if (shape === 'oval' || shape === 'circle') svgShape = <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...sp} />
        else if (shape === 'hexagon') svgShape = <polygon points={ngon(6, 0)} {...sp} />
        else if (shape === 'pentagon') svgShape = <polygon points={ngon(5)} {...sp} />
        else if (shape === 'octagon') svgShape = <polygon points={ngon(8, 0)} {...sp} />
        else if (shape === 'triangle') svgShape = <polygon points={ngon(3)} {...sp} />
        else if (shape === 'diamond') svgShape = <polygon points={`${cx},${bw / 2} ${w - bw / 2},${cy} ${cx},${h - bw / 2} ${bw / 2},${cy}`} {...sp} />
        else if (shape === 'star') svgShape = <polygon points={star()} {...sp} />
        else if (shape === 'freehand' && pts.length >= 3) svgShape = <polygon points={pts.map((p) => `${p.x * w},${p.y * h}`).join(' ')} {...sp} />
        else {
          const rtl = el.hotspotRadiusTL ?? 0, rtr = el.hotspotRadiusTR ?? 0
          const rbl = el.hotspotRadiusBL ?? 0, rbr = el.hotspotRadiusBR ?? 0
          const anyR = rtl || rtr || rbl || rbr
          const x0 = bw/2, y0 = bw/2, rw = w - bw, rh = h - bw
          svgShape = anyR
            ? <path d={`M${x0+rtl},${y0} L${x0+rw-rtr},${y0} Q${x0+rw},${y0} ${x0+rw},${y0+rtr} L${x0+rw},${y0+rh-rbr} Q${x0+rw},${y0+rh} ${x0+rw-rbr},${y0+rh} L${x0+rbl},${y0+rh} Q${x0},${y0+rh} ${x0},${y0+rh-rbl} L${x0},${y0+rtl} Q${x0},${y0} ${x0+rtl},${y0} Z`} {...sp} />
            : <rect x={x0} y={y0} width={rw} height={rh} rx={2} {...sp} />
        }

        return (
          <div
            key={el.id}
            id={`presenter-el-${el.id}`}
            title={el.tooltip || el.label || undefined}
            style={{
              ...elStyle, ...getAnimStyle(el),
              cursor: isClickable ? 'pointer' : 'default',
              overflow: 'hidden',
              // Hover visual feedback via CSS transitions on SVG shapes handled by CSS
            }}
            onClick={(e) => isClickable && handleElClick(e, el)}
            onMouseEnter={() => {
              setHoveredElId(el.id)
              if (el.hoverSoundFile) {
                const sndUrl = isUnresolvedMediaPath(el.hoverSoundFile) ? makeAppMediaUrl(el.hoverSoundFile) : el.hoverSoundFile
                playAudio(sndUrl, 'hover-snd-' + el.id)
              }
              if (el.hoverFullscreen && el.hoverMediaFile) {
                const src = isUnresolvedMediaPath(el.hoverMediaFile) ? makeAppMediaUrl(el.hoverMediaFile) : el.hoverMediaFile
                setLightbox({ src, kind: detectMediaKind(el.hoverMediaName || el.hoverMediaFile), title: el.hoverMediaName || '' })
              }
            }}
            onMouseLeave={() => setHoveredElId(null)}
          >
            <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
              {svgShape}
            </svg>
            {/* Hover media overlay for hotspot */}
            {hoveredElId === el.id && el.hoverMediaFile && (() => {
              const hovUrl = isUnresolvedMediaPath(el.hoverMediaFile) ? makeAppMediaUrl(el.hoverMediaFile) : el.hoverMediaFile
              const hovKind = detectMediaKind(el.hoverMediaName || el.hoverMediaFile)
              return (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
                  {hovKind === 'video'
                    ? <video key={hovUrl} src={hovUrl} autoPlay muted={true} loop={el.hoverMediaLoop !== false} playsInline
                        onLoadedMetadata={(ev) => {
                          const v = /** @type {HTMLVideoElement} */(ev.target)
                          if (el.hoverMediaFromMs) v.currentTime = el.hoverMediaFromMs / 1000
                        }}
                        onTimeUpdate={(ev) => {
                          if (el.hoverMediaToMs) {
                            const v = /** @type {HTMLVideoElement} */(ev.target)
                            if (v.currentTime >= el.hoverMediaToMs / 1000) { v.pause(); v.currentTime = (el.hoverMediaFromMs || 0) / 1000 }
                          }
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={hovUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  }
                </div>
              )
            })()}
            {/* Click media overlay for hotspot — plays, then fires navigation */}
            {clickedElId === el.id && el.clickMediaFile && (() => {
              const clkUrl = isUnresolvedMediaPath(el.clickMediaFile) ? makeAppMediaUrl(el.clickMediaFile) : el.clickMediaFile
              const clkKind = detectMediaKind(el.clickMediaName || el.clickMediaFile)
              const onDone = () => {
                clearTimeout(/** @type {ReturnType<typeof setTimeout>} */ (window['_smm_click_tmr_' + el.id]))
                const cb = /** @type {Function|undefined} */ (window['_smm_click_done_' + el.id])
                delete window['_smm_click_done_' + el.id]
                if (cb) cb(); else setClickedElId(null)
              }
              return (
                <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
                  {clkKind === 'video'
                    ? <video key={clkUrl} src={clkUrl} autoPlay muted={false} loop={!!el.clickMediaLoop} playsInline
                        onLoadedMetadata={(ev) => {
                          const v = /** @type {HTMLVideoElement} */(ev.target)
                          if (el.clickMediaFromMs) v.currentTime = el.clickMediaFromMs / 1000
                        }}
                        onTimeUpdate={(ev) => {
                          if (el.clickMediaToMs) {
                            const v = /** @type {HTMLVideoElement} */(ev.target)
                            if (v.currentTime >= el.clickMediaToMs / 1000) { v.pause(); onDone() }
                          }
                        }}
                        onEnded={onDone}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={clkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  }
                </div>
              )
            })()}
          </div>
        )
      }

      // ── MenuBar element in presenter ──────────────────────────────────────────
      if (el.type === 'menubar') {
        return (
          <MenuBarElement
            key={el.id}
            el={el}
            isEditor={false}
            stageWidth={stageWidth}
            stageHeight={stageHeight}
            onNavigate={(target) => {
              if (!target || target === 'none') return
              if (target === 'next') { navigate(idx + 1); return }
              if (target === 'prev') { navigate(idx - 1); return }
              if (target === 'quit') { onClose(); return }
              if (/^https?:\/\//i.test(target)) { window.open(target, '_blank', 'noopener,noreferrer'); return }
              const tl = target.toLowerCase()
              let ti = pages.findIndex((p) => p.name === target || p.id === target)
              if (ti < 0) ti = pages.findIndex((p) => p.name?.toLowerCase() === tl)
              if (ti < 0) ti = pages.findIndex((p) => p.name?.toLowerCase().startsWith(tl + ' '))
              if (ti >= 0) navigate(ti)
            }}
            zoom={1}
          />
        )
      }

      // ── Group element in presenter ──────────────────────────────────────────
      if (el.type === 'group') {
        return (
          <div
            key={el.id}
            id={`presenter-el-${el.id}`}
            style={{ ...elStyle, ...ws, ...getAnimStyle(el), overflow: 'hidden' }}
          >
            {(el.children || []).map((child) => {
              const childStyle = /** @type {import('react').CSSProperties} */ ({
                position: 'absolute',
                left: child.x, top: child.y, width: child.w, height: child.h,
                visibility: child.visible === false ? 'hidden' : 'visible',
                overflow: 'hidden',
                boxSizing: 'border-box',
              })
              if (child.type === 'text') {
                return (
                  <div key={child.id} style={{ ...childStyle, ...getAnimStyle(child) }}>
                    <div style={{
                      fontFamily: `${child.font || 'Rajdhani'}, sans-serif`,
                      fontSize: child.size, fontWeight: child.weight,
                      color: child.color, textAlign: child.align,
                      display: 'flex',
                      alignItems: ({ top: 'flex-start', middle: 'center', bottom: 'flex-end' }[child.vAlign] || 'center'),
                      background: child.bgOn ? child.bgColor : 'transparent',
                      width: '100%', height: '100%', wordBreak: 'break-word',
                    }}
                      dangerouslySetInnerHTML={{ __html: esc(child.content).replaceAll('\n', '<br/>') }}
                    />
                  </div>
                )
              }
              if (child.type === 'clip' || child.type === 'mpeg') {
                return (
                  <div key={child.id} style={{ ...childStyle, ...getAnimStyle(child) }}>
                    {child.file && <img src={child.file} alt="" style={{ width: '100%', height: '100%', objectFit: child.fit || 'contain', opacity: (child.opacity ?? 100) / 100 }} />}
                  </div>
                )
              }
              if (child.type === 'button') {
                return (
                  <div key={child.id} style={{ ...childStyle, ...getAnimStyle(child) }}>
                    <div style={{
                      background: child.bgColor || '#1a3a5c', color: child.fgColor || '#e8a020',
                      border: `${child.borderWidth || 2}px solid ${child.borderColor || '#4a8fc0'}`,
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: child.size || 14, fontWeight: 600, boxSizing: 'border-box',
                    }}>
                      {child.label || 'Button'}
                    </div>
                  </div>
                )
              }
              return null
            })}
          </div>
        )
      }

      return null
    })
  }

  if (!page) return null
  const prevPage = prevIdx >= 0 ? pages[prevIdx] : null

  return (
    <div className="presenter-overlay" ref={overlayRef}>
      <div className="presenter-stage-area" ref={stageAreaRef}>
      <div
        className="presenter-stage-wrap"
        style={{
          width: Math.round(stageWidth * layout.scale),
          height: Math.round(stageHeight * layout.scale),
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
      <div
        className="presenter-stage"
        style={{
          position: 'absolute', top: 0, left: 0,
          width: stageWidth, height: stageHeight,
          overflow: 'hidden',
          transform: `scale(${layout.scale})`,
          transformOrigin: 'top left',
          '--smm-stage-h': `${stageHeight}px`,
        }}
      >
        {/* Previous page — static backdrop visible through the incoming wipe */}
        {prevPage && (
          <div className="presenter-page-layer" style={{ background: pageBgCss(prevPage), zIndex: 1 }}>
            {prevPage.bgMediaSrc && prevPage.bgMediaKind === 'video' ? (
              <video src={prevPage.bgMediaSrc} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            ) : prevPage.bgMediaSrc ? (
              <img src={prevPage.bgMediaSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            ) : prevPage.bgImage ? (
              <img src={prevPage.bgImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            ) : null}
            {renderElements(prevPage, false)}
          </div>
        )}

        {/* Current page background — stable layer keyed to page.id, persists across pageKey animation resets */}
        <div
          key={page.id + '_bg'}
          style={{ position: 'absolute', inset: 0, background: page.pageType === 'url' ? '#000' : pageBgCss(page), zIndex: 2, pointerEvents: page.pageType === 'url' ? 'auto' : 'none', ...pageWipeStyle(page.wipeIn, 5) }}
        >
          {page.pageType === 'url' && page.iframeUrl ? (
            <iframe
              src={page.iframeUrl}
              title={page.name}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: '#fff' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : page.bgMediaSrc && page.bgMediaKind === 'video' ? (
            <video src={page.bgMediaSrc} autoPlay muted loop playsInline className={bgMediaTransitionClass(page)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          ) : page.bgMediaSrc ? (
            <img src={page.bgMediaSrc} alt="" className={bgMediaTransitionClass(page)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          ) : page.bgImage ? (
            <img src={page.bgImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          ) : null}
        </div>
        {/* Current page elements — keyed to pageKey so CSS animations reset on each visit */}
        <div
          key={pageKey}
          className="presenter-page-layer"
          style={{ background: 'transparent', zIndex: 3, ...pageWipeStyle(page.wipeIn, 5) }}
          onClick={handleBgClick}
          onAnimationEnd={() => setPrevIdx(-1)}
        >
          {renderElements(page, true)}
        </div>
      </div>
      </div>
      </div>

      {timedDur > 0 && (
        <div className="player-progress-track">
          <div
            className="player-progress-fill"
            style={{ width: `${Math.min(100, (elapsed / (timedDur * 1000)) * 100)}%` }}
          />
        </div>
      )}

      {(showControls !== false && !interactive) && (
        <div className="presenter-controls" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => navigate(idx - 1)} disabled={idx <= 0}>‹ Prev</button>
          <span className="presenter-info">
            {idx + 1} / {pages.length} — {page.name}
            {timedDur > 0 && (
              <span className="presenter-countdown">
                {' '}{Math.max(0, Math.ceil(timedDur - elapsed / 1000))}s
              </span>
            )}
            {loop ? ' 🔁' : ''}
          </span>
          <button onClick={() => navigate(idx + 1)} disabled={idx >= pages.length - 1 && !loop}>Next ›</button>
          <button
            title={hideMediaCtrls ? 'Show media controls' : 'Hide media controls'}
            onClick={() => setHideMediaCtrls(v => !v)}
            style={{ opacity: hideMediaCtrls ? 0.5 : 1 }}
          >{hideMediaCtrls ? '🎬 ✗' : '🎬 ✓'}</button>
          {pages.some((pg) => pg.elements?.some((el) => el.elLabel === 'lyric')) && (
            <button
              title={lyricsVisible ? 'Hide lyrics overlay' : 'Show lyrics overlay'}
              onClick={() => setLyricsVisible((v) => !v)}
              style={{ opacity: lyricsVisible ? 1 : 0.45 }}
            >🎤 Lyrics</button>
          )}
          {pages.some((pg) => pg.lyricStart != null) && onUpdatePages && (
            <button
              title="Open visual timeline editor to sync page timings to audio"
              onClick={() => setLyricTimingOpen(true)}
              style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
            >⏱ Edit Timings</button>
          )}
          <button className="presenter-stop" onClick={onClose}>■ Stop</button>
        </div>
      )}
      {devMode && (
        <div className={`pres-debug${dbgOpen ? '' : ' pres-debug-collapsed'}`}>
          <div className="pres-debug-header" onClick={() => setDbgOpen((v) => !v)}>
            <span>🛠 Dev</span>
            <span className="pres-debug-toggle">{dbgOpen ? '▾' : '▸'}</span>
          </div>
          {dbgOpen && (
            <div className="pres-debug-body">
              <div className="pres-debug-row">
                <span className="pres-debug-lbl">Page</span>
                <span className="pres-debug-val">{idx + 1}/{pages.length} — {page?.name || ''}</span>
              </div>
              <div className="pres-debug-row">
                <span className="pres-debug-lbl">Visits</span>
                <span className="pres-debug-val">{visitCounts.current[page?.id] || 0}×</span>
              </div>
              {projectVars.length > 0
                ? <VarInspector vars={projectVars} snapshot={dbgVarSnapshot} />
                : <>
                    <div className="pres-debug-section">Variables</div>
                    {Object.keys(dbgVarSnapshot).length === 0
                      ? <div className="pres-debug-empty">— none set —</div>
                      : Object.entries(dbgVarSnapshot).map(([k, v]) => (
                          <div key={k} className="pres-debug-row">
                            <span className="pres-debug-lbl">{k}</span>
                            <span className="pres-debug-val">{String(v)}</span>
                          </div>
                        ))
                    }
                  </>
              }
            </div>
          )}
        </div>
      )}
      {/* ── Fullscreen Lightbox Overlay ── */}
      {lightbox && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.93)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}
        >
          {lightbox.title && (
            <div style={{ color: '#fff', fontSize: 14, marginBottom: 8, opacity: 0.8, userSelect: 'none' }}>{lightbox.title}</div>
          )}
          {lightbox.kind === 'video' ? (
            <video
              src={lightbox.src}
              autoPlay
              controls
              style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 6, boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}
              onClick={(e) => e.stopPropagation()}
              onEnded={() => setLightbox(null)}
            />
          ) : lightbox.kind === 'audio' ? (
            <div style={{ padding: 32, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
              <audio src={lightbox.src} autoPlay controls style={{ width: 320 }} onEnded={() => setLightbox(null)} />
            </div>
          ) : (
            <img
              src={lightbox.src}
              alt={lightbox.title}
              style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 6, boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div style={{ color: '#aaa', fontSize: 12, marginTop: 10, userSelect: 'none' }}>Click anywhere to close  ✕</div>
        </div>
      )}

      {/* ── Lyric Timing Editor overlay ── */}
      {lyricTimingOpen && (
        <LyricTimingEditor
          pages={pages}
          presentationAudio={presentationAudio}
          onSave={(updatedPages) => { onUpdatePages?.(updatedPages) }}
          onClose={() => setLyricTimingOpen(false)}
        />
      )}
    </div>
  )
}

/* ─── Spread view ghost page (read-only, side-by-side preview) ─────────── */
function SpreadGhostElement({ el }) {
  if (el.visible === false) return null
  const base = /** @type {import('react').CSSProperties} */ ({
    position: 'absolute',
    left: el.x, top: el.y, width: el.w, height: el.h,
    zIndex: (el.z || 0) + 3,
    pointerEvents: 'none',
    overflow: 'hidden',
  })
  if (el.type === 'text') {
    return (
      <div style={/** @type {import('react').CSSProperties} */ ({
        ...base,
        fontFamily: `${el.font || 'Rajdhani'}, sans-serif`,
        fontSize: el.size, fontWeight: el.weight, color: el.color, textAlign: el.align,
        display: 'flex',
        alignItems: ({ top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.vAlign] || 'center'),
        fontStyle: el.italic ? 'italic' : 'normal',
        textDecoration: el.underline ? 'underline' : 'none',
        textShadow: el.shadow ? '2px 2px 4px rgba(0,0,0,.7)' : 'none',
        background: el.bgOn ? el.bgColor : 'transparent',
        wordBreak: 'break-word',
        lineHeight: el.lineHeight ? String(el.lineHeight) : '1.35',
      })}
        dangerouslySetInnerHTML={{ __html: esc(el.content).replaceAll('\n', '<br/>') }}
      />
    )
  }
  if (el.type === 'clip') {
    const kind = el.mediaKind || (el.file && /\.(mp4|webm|mov)$/i.test(el.file) ? 'video' : 'image')
    if (el.file && kind === 'image') return <img src={el.file} alt="" style={/** @type {import('react').CSSProperties} */ ({ ...base, objectFit: el.fit || 'contain', opacity: (el.opacity ?? 100) / 100 })} />
    if (el.file && kind === 'video') return <video key={el.file} src={el.file} muted playsInline loop style={/** @type {import('react').CSSProperties} */ ({ ...base, objectFit: el.fit || 'contain', opacity: (el.opacity ?? 100) / 100 })} />
    return <div style={/** @type {import('react').CSSProperties} */ ({ ...base, border: '1px dashed rgba(60,184,190,.3)', display: 'grid', placeItems: 'center', color: 'rgba(60,184,190,.4)', fontSize: 10 })}>Clip</div>
  }
  if (el.type === 'mpeg') {
    return el.file ? <video key={el.file} src={el.file} muted playsInline loop style={/** @type {import('react').CSSProperties} */ ({ ...base, objectFit: el.fit || 'contain' })} /> : null
  }
  if (el.type === 'button') {
    return (
      <div style={/** @type {import('react').CSSProperties} */ ({
        ...base,
        background: el.btnGrad || el.bgColor || '#1a3a5c',
        color: el.fgColor || '#e8a020',
        border: `${el.borderWidth ?? 2}px solid ${el.borderColor || '#4a8fc0'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: el.fontSize || 14,
        fontFamily: `${el.font || 'Rajdhani'}, sans-serif`,
        fontWeight: el.fontWeight || '600',
        boxSizing: 'border-box',
      })}>
        {el.label || 'Button'}
      </div>
    )
  }
  if (el.type === 'group') {
    return (
      <div style={/** @type {import('react').CSSProperties} */ ({ ...base, outline: '1px dashed rgba(232,160,32,.3)' })}>
        {(el.children || []).map(child => <SpreadGhostElement key={child.id} el={child} />)}
      </div>
    )
  }
  if (el.type === 'hotspot') {
    return <div style={/** @type {import('react').CSSProperties} */ ({ ...base, background: el.fillOpacity > 0 ? el.fillColor : 'transparent', border: el.borderOn ? `${el.borderWidth ?? 2}px solid ${el.borderColor || '#3cb8be'}` : 'none', borderRadius: el.hotspotShape === 'oval' || el.hotspotShape === 'circle' ? '50%' : undefined })} />
  }
  return <div style={/** @type {import('react').CSSProperties} */ ({ ...base, background: 'rgba(60,184,190,.06)', border: '1px dashed rgba(60,184,190,.15)' })} />
}

function SpreadGhostStage({ page, pageNum, stageWidth, stageHeight, zoom, onClick }) {
  const bgStyle = /** @type {import('react').CSSProperties} */ ({
    width: stageWidth,
    height: stageHeight,
    zoom,
    position: 'relative',
    background: pageBgCss(page),
    flexShrink: 0,
    overflow: 'hidden',
  })
  if (page?.bgMediaSrc && /\.(jpe?g|png|gif|webp|svg)$/i.test(page.bgMediaSrc)) {
    bgStyle.backgroundImage = `url(${page.bgMediaSrc})`
    bgStyle.backgroundSize = 'cover'
    bgStyle.backgroundPosition = 'center'
  }
  return (
    <div className="stage spread-ghost" style={bgStyle} onClick={page ? onClick : undefined} title={page ? `Page ${pageNum} — click to navigate` : 'No next page'}>
      {page ? (
        <>
          {page.bgMediaSrc && /\.(mp4|webm|mov)$/i.test(page.bgMediaSrc) && (
            <video key={page.bgMediaSrc} src={page.bgMediaSrc} autoPlay muted loop playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 2, pointerEvents: 'none' }} />
          )}
          {page.elements?.slice().sort((a, b) => a.z - b.z).map(el => <SpreadGhostElement key={el.id} el={el} />)}
          <div className="spread-ghost-label">↳ Page {pageNum}</div>
        </>
      ) : (
        <div className="spread-no-page"><span>No next page</span></div>
      )}
    </div>
  )
}

/* ─── App ──────────────────────────────────────────────────────────────── */
function App() {
  const [pages, setPages] = /** @type {[import('./types/desktop-api').SmmPage[], import('react').Dispatch<import('react').SetStateAction<import('./types/desktop-api').SmmPage[]>>]} */ (useState(seedPages))
  const [stagePreset, setStagePreset] = useState(STAGE_PRESETS[0].key)
  const [customStageW, setCustomStageW] = useState(640)
  const [customStageH, setCustomStageH] = useState(480)
  const [showCustomStageDlg, setShowCustomStageDlg] = useState(false)
  const [cur, setCur] = useState(0)
  const [selectedPageIds, setSelectedPageIds] = useState(/** @type {number[]} */([]))  // multi-page selection (indices)
  const [pageDragOverIdx, setPageDragOverIdx] = useState(-1)  // drag-over indicator index
  const [selId, setSelId] = useState(null)
  const [selIds, setSelIds] = useState([])  // multi-select
  const [tool, setTool] = useState('sel')
  const [openSections, setOpenSections] = useState(() => {
    try { const s = localStorage.getItem('mme_openSections'); return s ? JSON.parse(s) : {} } catch { return {} }
  })
  const DEFAULT_PRES_AUDIO = { file: '', name: '', volume: 1, loop: true, sourcePath: '', trimStart: 0, trimEnd: null, offset: 0, playbackRate: 1 }
  const [presentationAudio, setPresentationAudio] = useState(DEFAULT_PRES_AUDIO)
  const [showPiperTTS, setShowPiperTTS] = useState(false)
  const [showWhisper, setShowWhisper] = useState(false)
  const [showKaraokeResync, setShowKaraokeResync] = useState(false)
  const [showHFSettings, setShowHFSettings] = useState(false)
  const [showLyricWizard, setShowLyricWizard] = useState(false)
  const [showScriptExportModal, setShowScriptExportModal] = useState(false)
  const [lastUsedColor, setLastUsedColor] = useState('#3cb8be')
  const [hotspotShape, setHotspotShape] = useState('rect')  // active shape for hotspot draw tool
  const [hsDrawing, setHsDrawing] = useState(null)          // {x0,y0,x1,y1} live drag rect
  const [hsFreehandPts, setHsFreehandPts] = useState([])    // [{x,y}] for freehand polygon
  const [, setHsFreehandActive] = useState(false)
  const [hotspotSnapBusy, setHotspotSnapBusy] = useState(false) // true while snapshot-to-clip is rendering
  const [collapsedGroups, setCollapsedGroups] = useState(/** @type {Set<string>} */(new Set()))
  const [renamingGroup, setRenamingGroup] = useState(/** @type {{id:string,val:string}|null} */(null))
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const [filename, setFilename] = useState('Untitled.mme')
  const [mediaResolver, setMediaResolver] = useState(null)
  // null = no unresolved media; { unresolvedEls, resolvedPages, open } = has unresolved
  const [status, setStatus] = useState('Ready')
  const [inspectorTab, setInspectorTab] = useState('props')
  // Animation in-editor preview
  const [animPreviewId, setAnimPreviewId] = useState(null)
  const [animPreviewKey, setAnimPreviewKey] = useState(0)
  const [wipePanelCat, setWipePanelCat] = useState('all')
  const [wipeSync, setWipeSync] = useState(false)
  const [scriptMode, setScriptMode] = useState(false)
  const [scriptText, setScriptText] = useState('')
  const [showVarEditor, setShowVarEditor] = useState(false)
  const [projectVars, setProjectVars] = useState([])
  const [playIdx, setPlayIdx] = useState(-1)
  const [mediaBackends, setMediaBackends] = useState(null)
  const [mediaCacheInfo, setMediaCacheInfo] = useState(null)
  const [mediaCacheBusy, setMediaCacheBusy] = useState(false)
  const [mediaEvents, setMediaEvents] = useState([])
  const [btnEditor, setBtnEditor] = useState({ open: false, elId: null, data: null })
  const [menuBarEditEl, setMenuBarEditEl] = useState(/** @type {{pageIdx:number,elId:string,el:object}|null} */(null))
  const [memGameEditorOpen, setMemGameEditorOpen] = useState(false)
  const [chromaKeyModalEl, setChromaKeyModalEl] = useState(null)
  const [showScriptFlow, setShowScriptFlow] = useState(false)     // visual flow chart editor
  const [frameBorderEl, setFrameBorderEl] = useState(null)        // element being frame-edited
  const [showPublishDlg, setShowPublishDlg] = useState(false)     // publish dialog
  const [importPagesData, setImportPagesData] = useState(null)    // parsed import data
  const [presentationLoop, setPresentationLoop] = useState(false)
  const [presentationShowControls, setPresentationShowControls] = useState(true)
  const [presentationInteractive, setPresentationInteractive] = useState(false)
  const [presentationFullscreen, setPresentationFullscreen] = useState(true)
  const [presentationDevMode, setPresentationDevMode] = useState(false)
  const [presentationHideMediaControls, setPresentationHideMediaControls] = useState(false)
  const [snapGuides, setSnapGuides] = useState([])   // [{axis:'x'|'y', pos:number}]
  const [showMediaLib, setShowMediaLib] = useState(true)
  const [mediaLibFilter, setMediaLibFilter] = useState('')
  const [recentMedia, setRecentMedia] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mme_recentMedia') || '[]') } catch { return [] }
  })
  const [panelVisible, setPanelVisible] = useState(() => {
    try { const s = localStorage.getItem('mme_panelVis'); if (s) return JSON.parse(s) } catch { /* noop */ }
    return { left: true, right: true, bottom: true }
  })
  const [panelSizes, setPanelSizes] = useState(() => {
    try { const s = localStorage.getItem('mme_panelSizes'); if (s) return JSON.parse(s) } catch { /* noop */ }
    return { left: 230, right: 300, bottom: 56 }
  })
  const [panelCollapsed, setPanelCollapsed] = useState({ left: false, right: false })
  const panelSizesRef = useRef({ left: 230, right: 300, bottom: 56 })
  const panelResizeRef = useRef(null)
  const [innerSplitSizes, setInnerSplitSizes] = useState(() => {
    try { const s = localStorage.getItem('mme_innerSplits'); if (s) return JSON.parse(s) } catch { /* noop */ }
    return { leftPagesH: 180, leftElemH: 140, rightPagesH: 112 }
  })
  const innerSplitSizesRef = useRef({ leftPagesH: 180, leftElemH: 140, rightPagesH: 112 })
  const [autoSaveInterval, setAutoSaveIntervalState] = useState(() => {
    try { const v = parseInt(localStorage.getItem('mme_autoSaveInterval') || '', 10); if ([1,5,10].includes(v)) return v } catch { /* noop */ }
    return 5 // default: 5 minutes
  })
  const [collapsedInspPages, setCollapsedInspPages] = useState(new Set())
  const [spreadView, setSpreadView] = useState(false)
  const [projectType, setProjectType] = useState('general') // 'general' | 'storybook'
  const [pdfImportProgress, setPdfImportProgress] = useState(null) // null | { page, total, msg }
  const [sbPasswordDlg, setSbPasswordDlg] = useState(false)
  const setAutoSaveInterval = (minutes) => {
    const v = [1, 5, 10].includes(Number(minutes)) ? Number(minutes) : 5
    setAutoSaveIntervalState(v)
    try { localStorage.setItem('mme_autoSaveInterval', String(v)) } catch { /* noop */ }
  }
  const setShowTimeline = (v) => setPanelVisible(p => {
    const next = { ...p, bottom: typeof v === 'function' ? v(p.bottom) : v }
    try { localStorage.setItem('mme_panelVis', JSON.stringify(next)) } catch { /* noop */ }
    return next
  })
  const [playerCurIdx, setPlayerCurIdx] = useState(-1) // page index PresentationPlayer is on
  const [newProjectDlg, setNewProjectDlg] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [inlineEditId, setInlineEditId] = useState(null)
  const preClickSelRef = useRef(null)  // tracks selection state before mousedown (for click-to-edit)
  const [interactionEditorEl, setInteractionEditorEl] = useState(null) // element being edited in InteractionEditor
  const [showPrintDlg, setShowPrintDlg] = useState(false)
  const [showPageScriptEditor, setShowPageScriptEditor] = useState(false)

  const historyRef = useRef({ past: [], future: [] })
  const lastHistoryPushRef = useRef(0)
  const clipboardRef = useRef([])

  const bgRef = useRef(null)
  const playRef = useRef(null)
  const stageRef = useRef(null)
  const scrollRef = useRef(null)
  const playTimerRef = useRef(null)
  const outerPresAudioRef = useRef(null) // pre-started in gesture handler to satisfy browser autoplay policy
  const presAudioOffsetTimerRef = useRef(null) // tracks the offset-delay timer so stopPlay can cancel it
  const dragRef = useRef(null)
  const fileRef = useRef(null)
  /** @type {React.MutableRefObject<HTMLInputElement|null>} */
  const imgRef = useRef(null)
  const executeCommandRef = useRef(null)
  const pagesRef = useRef(pages)
  const desktopApi = typeof window !== 'undefined' ? window.smmDesktop : null

  const refreshMediaCacheInfo = useCallback(async () => {
    if (!desktopApi?.mediaCacheStats) {
      setMediaCacheInfo({ ok: false, files: 0, bytes: 0, reason: 'Desktop cache API unavailable' })
      return
    }
    try {
      const info = await desktopApi.mediaCacheStats()
      setMediaCacheInfo(info || { ok: false, files: 0, bytes: 0, reason: 'No cache info returned' })
    } catch (error) {
      setMediaCacheInfo({ ok: false, files: 0, bytes: 0, reason: error?.message || String(error) })
    }
  }, [desktopApi])

  useEffect(() => {
    void refreshMediaCacheInfo()
  }, [refreshMediaCacheInfo])

  const clearMediaCache = useCallback(async () => {
    if (!desktopApi?.clearMediaCache) {
      setStatus('Media cache API unavailable')
      return
    }
    const ok = window.confirm('Clear the transcoded media cache? Original project media will not be deleted.')
    if (!ok) return
    setMediaCacheBusy(true)
    try {
      const result = await desktopApi.clearMediaCache()
      setMediaCacheInfo(result || { ok: false, files: 0, bytes: 0, reason: 'No clear result returned' })
      if (result?.ok) {
        setStatus(`Media cache cleared: ${result.clearedFiles || 0} files, ${formatBytes(result.clearedBytes || 0)}`)
      } else {
        setStatus(`Media cache clear failed: ${result?.reason || 'unknown error'}`)
      }
    } catch (error) {
      setStatus(`Media cache clear failed: ${error?.message || String(error)}`)
    } finally {
      setMediaCacheBusy(false)
      void refreshMediaCacheInfo()
    }
  }, [desktopApi, refreshMediaCacheInfo])

  // Safety-net: if the sync port read in the module body returned 0 (e.g., web-only
  // mode with no smmDesktop), try the async IPC path. In normal Electron operation
  // the module-level init already has the correct port and this is a no-op.
  useEffect(() => {
    if (_mediaServerPort > 0) return  // already set synchronously
    if (!desktopApi?.getMediaServerPort) return
    desktopApi.getMediaServerPort().then((port) => {
      if (port > 0) _mediaServerPort = port
    }).catch(() => {})
  // desktopApi is stable after mount; mount-only fallback for async port init
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On first mount, load the last saved project from localStorage (production)
  // or from the persistent disk auto-save (dev mode, where localStorage is ephemeral).
  const _startupDoneRef = useRef(false)
  useEffect(() => {
    if (_startupDoneRef.current) return
    _startupDoneRef.current = true

    // Dev mode: try disk auto-save first (localStorage is per-PID ephemeral in dev)
    if (desktopApi?.restoreAutoSave) {
      desktopApi.restoreAutoSave().then((result) => {
        if (result?.ok && result.text) {
          const mtime = result.mtime ? new Date(result.mtime).toLocaleString() : 'unknown time'
          const name = result.name || 'Untitled.mme'
          console.info(`[FluxAura Studio] Restored dev auto-save from ${result.path} (saved ${mtime})`)
          void applyParsedScript(result.text, name)
        } else {
          // Fallback to localStorage (works in production)
          _loadFromLocalStorage()
        }
      }).catch(() => _loadFromLocalStorage())
    } else {
      _loadFromLocalStorage()
    }

    function _loadFromLocalStorage() {
      try {
        // Prefer the explicitly-saved checkpoint (mme_lastSave) over the last-opened
        // file (mme_lastOpened). This ensures that opening an older project via File→Open
        // never clobbers the saved state that should be restored on the next app launch.
        const savedContent = localStorage.getItem('mme_lastSave')
        const openedContent = localStorage.getItem('mme_lastOpened')
        const content = savedContent || openedContent
        const name = savedContent
          ? (localStorage.getItem('mme_lastSaveName') || 'Untitled.mme')
          : (localStorage.getItem('mme_lastOpenedName') || localStorage.getItem('mme_lastSaveName') || 'Untitled.mme')
        if (content) void applyParsedScript(content, name)
      } catch { /* ignore storage errors */ }
    }
  // applyParsedScript is stable; intentionally runs once on mount to restore last session
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Initialize HuggingFace token for onnx-community model access
  useEffect(() => {
    if (desktopApi?.whisper?.setHFToken && typeof window !== 'undefined') {
      // Try to load from localStorage
      const savedToken = typeof localStorage !== 'undefined' 
        ? localStorage.getItem('hf-api-token') 
        : null
      
      if (savedToken) {
        console.log('[App] Initializing HuggingFace token from storage')
        desktopApi.whisper.setHFToken({ token: savedToken }).catch(err => {
          console.warn('[App] Failed to set HF token:', err.message)
        })
      }
    }
  // desktopApi is stable; intentionally runs once on mount to restore saved HF token
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    panelSizesRef.current = panelSizes
    try { localStorage.setItem('mme_panelSizes', JSON.stringify(panelSizes)) } catch { /* noop */ }
  }, [panelSizes])

  // Declared here (before the auto-save useEffect) to avoid TDZ — stage is used in the dep array below
  const stage = useMemo(
    () => stagePreset === 'custom'
      ? { key: 'custom', cat: 'Custom', label: `Custom ${customStageW} × ${customStageH}`, width: customStageW, height: customStageH, custom: true }
      : STAGE_PRESETS.find((preset) => preset.key === stagePreset) || STAGE_PRESETS[0],
    [stagePreset, customStageW, customStageH],
  )
  const stageWidth = stage.width
  const stageHeight = stage.height

  // Dev-mode disk auto-save at the user-selected interval so work survives crashes.
  // In production, localStorage already handles this; the IPC call is a no-op there.
  useEffect(() => {
    if (!desktopApi?.autoSaveMme) return
    const ms = autoSaveInterval * 60_000
    const id = setInterval(() => {
      try {
        const mmeText = genMME(pages, stage, { presentationAudio, projectVars })
        desktopApi.autoSaveMme(mmeText, filename || 'Untitled.mme').catch(() => {})
      } catch { /* ignore serialisation errors */ }
    }, ms)
    return () => clearInterval(id)
  }, [pages, stage, desktopApi, autoSaveInterval, filename, presentationAudio, projectVars])

  // Persist inner split sizes when they change
  useEffect(() => {
    innerSplitSizesRef.current = innerSplitSizes
    try { localStorage.setItem('mme_innerSplits', JSON.stringify(innerSplitSizes)) } catch { /* noop */ }
  }, [innerSplitSizes])

  // Persist panel visibility when it changes
  useEffect(() => {
    try { localStorage.setItem('mme_panelVis', JSON.stringify(panelVisible)) } catch { /* noop */ }
  }, [panelVisible])


  const pickFile = useCallback((category) => new Promise((resolve) => {
    if (!imgRef.current) { resolve(null); return }
    imgRef.current.value = ''
    imgRef.current.accept =
      category === 'image' ? 'image/*,.bmp,.gif,.png,.jpg,.jpeg,.webp,.avif,.svg,.tif,.tiff,.ico,.pdf'
      : category === 'audio' ? 'audio/*,.mid,.midi,.wav,.mp3,.ogg,.flac,.aac,.m4a,.opus'
      : 'image/*,audio/*,video/*,.bmp,.mid,.midi,.wav,.flc,.fli,.avi,.pdf'
    imgRef.current.onchange = async (ev) => {
      const inp = /** @type {HTMLInputElement} */(ev.target)
      const f = inp.files?.[0]
      if (!f) { resolve(null); return }
      const rawPath = typeof f.path === 'string' ? f.path : ''
      const kind = detectMediaKind(f.name)
      let url = ''
      if (rawPath && desktopApi?.readMediaDataUrl && kind !== 'video') {
        try {
          const loaded = await desktopApi.readMediaDataUrl({ filePath: rawPath, category: kind })
          if (loaded?.ok && loaded.dataUrl) url = internDataUrl(loaded.dataUrl, rawPath)
        } catch { /* ignore */ }
      }
      if (!url) {
        try { url = internDataUrl(await readBrowserFileAsDataUrl(f)) } catch { url = URL.createObjectURL(f) }
      }
      inp.value = ''
      resolve(url ? { url, name: f.name, sourcePath: rawPath || '' } : null)
    }
    imgRef.current.click()
  }), [desktopApi])

  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

  const currentPage = pages[cur] || null
  const selectedEl = useMemo(
    () => currentPage?.elements.find((el) => el.id === selId) || null,
    [currentPage, selId],
  )

  const logMediaEvent = useCallback((message) => {
    const line = `${new Date().toISOString()} ${message}`
    setMediaEvents((prev) => {
      const next = [...prev, line]
      if (next.length > 50) {
        return next.slice(next.length - 50)
      }
      return next
    })
  }, [])

  useEffect(() => {
    let active = true
    if (!desktopApi?.mediaBackends) return () => {
      active = false
    }

    desktopApi
      .mediaBackends()
      .then((result) => {
        if (!active) return
        setMediaBackends(result || null)
      })
      .catch(() => {
        if (!active) return
        setMediaBackends({
          ffmpeg: { available: false, detail: 'ffmpeg probe failed' },
          timidity: { available: false, detail: 'timidity probe failed' },
        })
      })

    return () => {
      active = false
    }
  }, [desktopApi])

  useEffect(() => {
    if (!bgRef.current || !currentPage) return
    const ctx = bgRef.current.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, stageWidth, stageHeight)

    if (currentPage.bgGradientEnabled) {
      const angle = ((currentPage.bgGradientAngle ?? 135) * Math.PI) / 180
      const cx = stageWidth / 2, cy = stageHeight / 2
      const r = Math.sqrt(cx * cx + cy * cy)
      const grad = ctx.createLinearGradient(
        cx - Math.cos(angle) * r, cy - Math.sin(angle) * r,
        cx + Math.cos(angle) * r, cy + Math.sin(angle) * r,
      )
      grad.addColorStop(0, currentPage.bgGradientFrom || '#0a1a2a')
      grad.addColorStop(1, currentPage.bgGradientTo || '#1a3a5c')
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = currentPage.bgColor || '#000'
    }
    ctx.fillRect(0, 0, stageWidth, stageHeight)

    // Static image backgrounds drawn on canvas (legacy bgImage + new bgMediaSrc for images)
    const imgSrc = currentPage.bgMediaKind !== 'video'
      ? (currentPage.bgMediaSrc || currentPage.bgImage || '')
      : (currentPage.bgImage || '')
    if (imgSrc) {
      const img = new Image()
      img.src = imgSrc
      img.onload = () => {
        ctx.drawImage(img, 0, 0, stageWidth, stageHeight)
        if (showGrid) drawGridCanvas(ctx, stageWidth, stageHeight)
      }
    } else if (showGrid) {
      drawGridCanvas(ctx, stageWidth, stageHeight)
    }
  }, [currentPage, showGrid, stageWidth, stageHeight])

  useEffect(() => {
    const SNAP_THRESH = 6  // pixels

    function computeSnapGuides(dragged, others, sw, sh) {
      const guides = []
      const dl = dragged.x, dr = dragged.x + dragged.w, dmx = dragged.x + dragged.w / 2
      const dt = dragged.y, db = dragged.y + dragged.h, dmy = dragged.y + dragged.h / 2
      const xCands = [0, sw / 2, sw]
      const yCands = [0, sh / 2, sh]
      others.forEach((el) => {
        xCands.push(el.x, el.x + el.w / 2, el.x + el.w)
        yCands.push(el.y, el.y + el.h / 2, el.y + el.h)
      })
      xCands.forEach((cx) => {
        if (Math.abs(dl - cx) < SNAP_THRESH || Math.abs(dr - cx) < SNAP_THRESH || Math.abs(dmx - cx) < SNAP_THRESH)
          guides.push({ axis: 'x', pos: cx })
      })
      yCands.forEach((cy) => {
        if (Math.abs(dt - cy) < SNAP_THRESH || Math.abs(db - cy) < SNAP_THRESH || Math.abs(dmy - cy) < SNAP_THRESH)
          guides.push({ axis: 'y', pos: cy })
      })
      return guides
    }

    function onMove(ev) {
      if (!dragRef.current) return
      const { id, startX, startY, origX, origY, origW, origH, mode, handle, origPositions, isMulti } = dragRef.current
      const dx = Math.round((ev.clientX - startX) / zoom)
      const dy = Math.round((ev.clientY - startY) / zoom)

      if (isMulti && mode === 'move' && origPositions) {
        // Move all selected elements together
        setPages((prev) =>
          prev.map((pg, i) => {
            if (i !== cur) return pg
            return {
              ...pg,
              elements: pg.elements.map((el) => {
                const orig = origPositions[el.id]
                if (!orig) return el
                return { ...el, x: orig.x + dx, y: orig.y + dy }
              }),
            }
          }),
        )
        setSnapGuides([])
      } else {
        setPages((prev) =>
          prev.map((pg, i) => {
            if (i !== cur) return pg
            const newElements = pg.elements.map((el) =>
              el.id === id
                ? moveOrResizeElementHelper(el, mode, handle, origX, origY, origW, origH, dx, dy, stageWidth, stageHeight)
                : el,
            )
            if (mode === 'move') {
              const movedEl = newElements.find((el) => el.id === id)
              if (movedEl) {
                const others = newElements.filter((el) => el.id !== id)
                setSnapGuides(computeSnapGuides(movedEl, others, stageWidth, stageHeight))
              }
            }
            return { ...pg, elements: newElements }
          }),
        )
      }
    }

    function onUp() {
      dragRef.current = null
      setSnapGuides([])
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [cur, stageHeight, stageWidth, zoom])

  /**
   * Remap wordTimestamps to match newly edited lyric text.
   * - Same word count: keep exact timing, just update word strings.
   * - Different count: proportionally redistribute timing across new words.
   * Karaoke highlighting keeps working after any text edit.
   */
  function realignWordTimestamps(wordTimestamps, newText) {
    if (!wordTimestamps?.length || !newText?.trim()) return []
    const newWords = newText.trim().split(/\s+/)
    if (!newWords.length) return []
    if (newWords.length === wordTimestamps.length) {
      return wordTimestamps.map((ts, i) => ({ ...ts, word: newWords[i] }))
    }
    const totalStart = wordTimestamps[0].start
    const totalEnd = wordTimestamps[wordTimestamps.length - 1].end
    const totalDuration = totalEnd - totalStart
    const n = newWords.length
    return newWords.map((word, i) => ({
      word,
      start: totalStart + (i / n) * totalDuration,
      end: totalStart + ((i + 1) / n) * totalDuration,
    }))
  }

  function updateElement(patch) {
    if (!selectedEl) return
    pushHistory()
    const isLyricContentEdit = 'content' in patch && selectedEl.elLabel === 'lyric'
    setPages((prev) =>
      prev.map((pg, i) => {
        if (i !== cur) return pg
        const realigned = isLyricContentEdit && pg.wordTimestamps?.length > 0
          ? realignWordTimestamps(pg.wordTimestamps, patch.content)
          : undefined
        return {
          ...pg,
          ...(realigned !== undefined ? { wordTimestamps: realigned } : {}),
          elements: pg.elements.map((el) => (el.id === selectedEl.id ? { ...el, ...patch } : el)),
        }
      }),
    )
  }

  /** Patch any element by id without requiring it to be selected (no history push). */
  function patchElemById(id, patch) {
    setPages((prev) => prev.map((pg, i) => i !== cur ? pg : {
      ...pg,
      elements: pg.elements.map((el) => el.id === id ? { ...el, ...patch } : el),
    }))
  }

  /** Patch all elements sharing a groupId (no history push). */
  function patchGroupById(gid, patch) {
    setPages((prev) => prev.map((pg, i) => i !== cur ? pg : {
      ...pg,
      elements: pg.elements.map((el) => el.groupId === gid ? { ...el, ...patch } : el),
    }))
  }

  /** Save or update the user-assigned name for a group on the current page. */
  function setPageGroupName(gid, name) {
    setPages((prev) => prev.map((pg, i) => i !== cur ? pg : {
      ...pg,
      groupNames: { ...(pg.groupNames || {}), [gid]: name },
    }))
  }

  // ── Snapshot helpers ─────────────────────────────────────────────────────
  /** Returns next sequential snapshot name e.g. "snapshot-003.png" */
  function nextSnapName() {
    const existing = new Set(
      (pages || []).flatMap((pg) => (pg.elements || []).map((el) => el.mediaName || ''))
    )
    for (let i = 1; i <= 999; i++) {
      const name = `snapshot-${String(i).padStart(3, '0')}.png`
      if (!existing.has(name)) return name
    }
    return `snapshot-${Date.now()}.png`
  }

  /**
   * Renders a rectangular region of the current page onto a Canvas and returns a PNG data URL.
   * @param {number} ox  Origin X on stage
   * @param {number} oy  Origin Y on stage
   * @param {number} rw  Region width
   * @param {number} rh  Region height
   * @param {Set<string>} [excludeIds]  Element IDs to skip
   * @returns {Promise<string>} PNG data URL
   */
  async function renderRegionToDataUrl(ox, oy, rw, rh, excludeIds = new Set()) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(rw))
    canvas.height = Math.max(1, Math.round(rh))
    const ctx = /** @type {CanvasRenderingContext2D} */(canvas.getContext('2d'))
    const NON_IMAGE_EXTS = /\.(mp4|mov|avi|webm|mkv|m4v|flv|wmv|mp3|wav|ogg|aac|m4a|mid|midi|pdf)$/i

    // Render background: image (cover) or flat colour
    if (currentPage.bgMediaSrc && !NON_IMAGE_EXTS.test(currentPage.bgMediaSrc)) {
      await new Promise((resolve) => {
        const img = new window.Image()
        if (/^https?:\/\//i.test(currentPage.bgMediaSrc)) img.crossOrigin = 'anonymous'
        img.onload = () => {
          // Replicate background canvas: drawImage(img, 0, 0, stageWidth, stageHeight) = fill/stretch.
          // Build a full-stage intermediate canvas then crop the requested region from it.
          const stageCvs = document.createElement('canvas')
          stageCvs.width = stageWidth; stageCvs.height = stageHeight
          const sCtx = /** @type {CanvasRenderingContext2D} */(stageCvs.getContext('2d'))
          sCtx.fillStyle = currentPage.bgColor || '#000000'
          sCtx.fillRect(0, 0, stageWidth, stageHeight)
          sCtx.drawImage(img, 0, 0, stageWidth, stageHeight)
          ctx.drawImage(stageCvs, Math.round(ox), Math.round(oy), Math.round(rw), Math.round(rh), 0, 0, canvas.width, canvas.height)
          resolve(undefined)
        }
        img.onerror = () => {
          ctx.fillStyle = currentPage.bgColor || '#000000'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          resolve(undefined)
        }
        img.src = currentPage.bgMediaSrc
      })
    } else {
      ctx.fillStyle = currentPage.bgColor || '#000000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    const inRegion = (currentPage.elements || [])
      .filter((el) =>
        el.visible !== false &&
        !excludeIds.has(el.id) &&
        el.type !== 'hotspot' && el.type !== 'menubar' &&
        el.x < ox + rw && el.x + el.w > ox &&
        el.y < oy + rh && el.y + el.h > oy,
      )
      .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    for (const el of inRegion) {
      const dx = Math.round(el.x - ox)
      const dy = Math.round(el.y - oy)
      if ((el.type === 'clip' || el.type === 'mpeg') && el.file && !NON_IMAGE_EXTS.test(el.file)) {
        await new Promise((resolve) => {
          const img = new window.Image()
          if (/^https?:\/\//i.test(el.file)) img.crossOrigin = 'anonymous'
          img.onload = () => {
            const fit = el.fit || 'fill'
            const nw = img.naturalWidth, nh = img.naturalHeight
            let renderX = el.x, renderY = el.y, renderW = el.w, renderH = el.h
            if ((fit === 'contain' || fit === 'cover') && nw && nh) {
              const imgRatio = nw / nh, elRatio = el.w / el.h
              if (fit === 'contain') {
                if (imgRatio > elRatio) { renderW = el.w; renderH = el.w / imgRatio }
                else { renderH = el.h; renderW = el.h * imgRatio }
              } else { // cover — scale to fill, may exceed element bounds
                if (imgRatio > elRatio) { renderH = el.h; renderW = el.h * imgRatio }
                else { renderW = el.w; renderH = el.w / imgRatio }
              }
              renderX = el.x + (el.w - renderW) / 2
              renderY = el.y + (el.h - renderH) / 2
            }
            const rdx = Math.round(renderX - ox)
            const rdy = Math.round(renderY - oy)
            ctx.save()
            ctx.globalAlpha = (el.opacity ?? 100) / 100
            if (fit === 'cover') {
              // Clip to element rectangle so overflow is hidden (matches CSS cover behaviour)
              ctx.beginPath(); ctx.rect(dx, dy, Math.round(el.w), Math.round(el.h)); ctx.clip()
            }
            ctx.drawImage(img, rdx, rdy, Math.round(renderW), Math.round(renderH))
            ctx.restore()
            resolve(undefined)
          }
          img.onerror = () => resolve(undefined)
          img.src = el.file
        })
      } else if (el.type === 'text') {
        const sz = el.size || 36
        ctx.save()
        ctx.font = `${el.fontWeight || '700'} ${sz}px "${el.font || 'Rajdhani'}", sans-serif`
        ctx.fillStyle = el.color || '#e8a020'
        ctx.textBaseline = 'top'
        String(el.content || '').split('\n').forEach((line, li) => {
          ctx.fillText(line, dx + 4, dy + 4 + li * (sz * 1.2))
        })
        ctx.restore()
      }
    }
    return canvas.toDataURL('image/png')
  }

  /**
   * Renders any page object to a full-stage PNG data URL (used by print).
   * Handles images, text, buttons and shows a placeholder for video/audio.
   */
  async function renderPageToDataUrl(pg) {
    const w = stageWidth, h = stageHeight
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = /** @type {CanvasRenderingContext2D} */(canvas.getContext('2d'))
    const VIDEO_EXTS = /\.(mp4|mov|avi|webm|mkv|m4v|flv|wmv)$/i
    const AUDIO_EXTS = /\.(mp3|wav|ogg|aac|m4a|mid|midi)$/i
    // Background
    if (pg.bgMediaSrc && (pg.bgMediaKind === 'image' || !pg.bgMediaKind)) {
      await new Promise((resolve) => {
        const img = new window.Image(); img.crossOrigin = 'anonymous'
        img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve() }
        img.onerror = () => resolve()
        img.src = pg.bgMediaSrc
      })
    } else {
      ctx.fillStyle = pg.bgColor || '#000000'
      ctx.fillRect(0, 0, w, h)
    }
    // Elements
    const els = (pg.elements || []).filter(el => el.visible !== false && el.type !== 'hotspot' && el.type !== 'menubar').sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    for (const el of els) {
      if ((el.type === 'clip' || el.type === 'mpeg') && el.file) {
        if (VIDEO_EXTS.test(el.file) || el.mediaKind === 'video') {
          // Capture first frame of video by loading it offscreen
          const drawn = await new Promise((resolve) => {
            const vid = document.createElement('video')
            vid.crossOrigin = 'anonymous'
            vid.muted = true
            vid.preload = 'metadata'
            const cleanup = () => { try { vid.src = '' } catch { void 0 } }
            const drawFrame = () => {
              try {
                ctx.save(); ctx.globalAlpha = (el.opacity ?? 100) / 100
                ctx.drawImage(vid, el.x, el.y, el.w, el.h)
                ctx.restore()
              } catch { void 0 }
              cleanup(); resolve(true)
            }
            vid.onseeked = drawFrame
            vid.onerror = () => { cleanup(); resolve(false) }
            vid.onloadedmetadata = () => { vid.currentTime = 0.001 }
            const timeout = setTimeout(() => { cleanup(); resolve(false) }, 5000)
            vid.addEventListener('onseeked', () => clearTimeout(timeout), { once: true })
            vid.src = el.file
          })
          if (!drawn) {
            // Fallback placeholder
            ctx.save(); ctx.globalAlpha = (el.opacity ?? 100) / 100
            ctx.fillStyle = '#111'; ctx.fillRect(el.x, el.y, el.w, el.h)
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = `bold ${Math.min(el.w, el.h) * 0.3}px sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText('▶', el.x + el.w / 2, el.y + el.h / 2)
            ctx.restore()
          }
        } else if (!AUDIO_EXTS.test(el.file) && el.mediaKind !== 'audio') {
          await new Promise((resolve) => {
            const img = new window.Image(); img.crossOrigin = 'anonymous'
            img.onload = () => {
              ctx.save(); ctx.globalAlpha = (el.opacity ?? 100) / 100
              ctx.drawImage(img, el.x, el.y, el.w, el.h)
              ctx.restore(); resolve()
            }
            img.onerror = () => resolve()
            img.src = el.file
          })
        }
      } else if (el.type === 'text') {
        const sz = el.size || 36
        ctx.save()
        ctx.font = `${el.fontWeight || '700'} ${sz}px "${el.font || 'Rajdhani'}", sans-serif`
        ctx.fillStyle = el.color || '#e8a020'; ctx.textBaseline = 'top'
        String(el.content || '').split('\n').forEach((line, li) => ctx.fillText(line, el.x + 4, el.y + 4 + li * sz * 1.2))
        ctx.restore()
      } else if (el.type === 'button') {
        ctx.save()
        ctx.fillStyle = el.bgColor || '#1a3a5c'; ctx.strokeStyle = el.borderColor || '#4a8fc0'
        ctx.lineWidth = el.borderWidth || 2
        const r = Math.min(parseFloat(el.radius) || 4, el.w / 2, el.h / 2)
        ctx.beginPath(); ctx.roundRect(el.x, el.y, el.w, el.h, r); ctx.fill(); ctx.stroke()
        ctx.fillStyle = el.fgColor || '#e8a020'; ctx.font = `bold ${el.fontSize || 14}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(el.label || '', el.x + el.w / 2, el.y + el.h / 2)
        ctx.restore()
      }
    }
    return canvas.toDataURL('image/png')
  }

  /**
   * Returns a CSS clip-path string for the given hotspot shape.
   * Returns null for 'rect' (no clip needed).
   * @param {string} shape
   * @param {Array<{x:number,y:number}>} [points] - normalized 0–1 (freehand only)
   * @returns {string|null}
   */
  function hotspotShapeToClipPath(shape, points = []) {
    const ngon = (n, startAngle = -Math.PI / 2) =>
      Array.from({ length: n }, (_, i) => {
        const a = startAngle + (2 * Math.PI * i) / n
        return `${((0.5 + 0.5 * Math.cos(a)) * 100).toFixed(2)}% ${((0.5 + 0.5 * Math.sin(a)) * 100).toFixed(2)}%`
      }).join(', ')
    const starPoly = () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (Math.PI * i) / 5
        const r = i % 2 === 0 ? 0.5 : 0.5 * 0.42
        return `${((0.5 + r * Math.cos(a)) * 100).toFixed(2)}% ${((0.5 + r * Math.sin(a)) * 100).toFixed(2)}%`
      }).join(', ')
    switch (shape) {
      case 'freehand':
        return points.length >= 3
          ? `polygon(${points.map(p => `${(p.x * 100).toFixed(2)}% ${(p.y * 100).toFixed(2)}%`).join(', ')})`
          : null
      case 'oval':
      case 'circle':
        return 'ellipse(50% 50% at 50% 50%)'
      case 'hexagon':
        return `polygon(${ngon(6, 0)})`
      case 'pentagon':
        return `polygon(${ngon(5)})`
      case 'octagon':
        return `polygon(${ngon(8, 0)})`
      case 'triangle':
        return `polygon(${ngon(3)})`
      case 'diamond':
        return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
      case 'star':
        return `polygon(${starPoly()})`
      default:
        return null
    }
  }

  /**
   * Applies the hotspot's actual shape as a canvas clip mask over a rectangular data URL.
   * Returns a new data URL with transparent pixels outside the shape.
   * @param {string} rectDataUrl
   * @param {import('./types/desktop-api').SmmElement} hs
   * @returns {Promise<string>}
   */
  function applyHotspotShapeMask(rectDataUrl, hs) {
    return new Promise((resolve) => {
      const w = Math.max(1, Math.round(hs.w))
      const h = Math.max(1, Math.round(hs.h))
      const cvs = document.createElement('canvas')
      cvs.width = w; cvs.height = h
      const ctx = /** @type {CanvasRenderingContext2D} */(cvs.getContext('2d'))
      const shape = hs.hotspotShape || 'rect'
      const pts = hs.points || []
      console.log('[capture] applyHotspotShapeMask shape=', shape, 'pts.length=', pts.length, 'w=', w, 'h=', h, 'first pts=', pts.slice(0, 3))
      const cx = w / 2, cy = h / 2
      const rx = w / 2, ry = h / 2
      const ngon = (n, startAngle = -Math.PI / 2) =>
        Array.from({ length: n }, (_, i) => {
          const a = startAngle + (2 * Math.PI * i) / n
          return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
        })
      const starPts = () =>
        Array.from({ length: 10 }, (_, i) => {
          const a = -Math.PI / 2 + (Math.PI * i) / 5
          const r = i % 2 === 0 ? Math.min(rx, ry) : Math.min(rx, ry) * 0.42
          return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
        })
      const polyPath = (polyPts) => {
        ctx.moveTo(polyPts[0].x, polyPts[0].y)
        polyPts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
        ctx.closePath()
      }
      ctx.beginPath()
      if (shape === 'oval' || shape === 'circle') {
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      } else if (shape === 'hexagon') {
        polyPath(ngon(6, 0))
      } else if (shape === 'pentagon') {
        polyPath(ngon(5))
      } else if (shape === 'octagon') {
        polyPath(ngon(8, 0))
      } else if (shape === 'triangle') {
        polyPath(ngon(3))
      } else if (shape === 'diamond') {
        ctx.moveTo(cx, 0); ctx.lineTo(w, cy); ctx.lineTo(cx, h); ctx.lineTo(0, cy); ctx.closePath()
      } else if (shape === 'star') {
        polyPath(starPts())
      } else if (shape === 'freehand' && pts.length >= 3) {
        ctx.moveTo(pts[0].x * w, pts[0].y * h)
        pts.slice(1).forEach((p) => ctx.lineTo(p.x * w, p.y * h))
        ctx.closePath()
      } else {
        // rect (possibly rounded corners)
        const rtl = hs.hotspotRadiusTL ?? 0, rtr = hs.hotspotRadiusTR ?? 0
        const rbl = hs.hotspotRadiusBL ?? 0, rbr = hs.hotspotRadiusBR ?? 0
        if (rtl || rtr || rbl || rbr) {
          ctx.roundRect(0, 0, w, h, [rtl, rtr, rbr, rbl])
        } else {
          ctx.rect(0, 0, w, h)
        }
      }
      ctx.clip()
      const img = new window.Image()
      img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve(cvs.toDataURL('image/png')) }
      img.onerror = () => resolve(rectDataUrl)
      img.src = rectDataUrl
    })
  }

  /**
   * Snapshot a hotspot region → new Clip element.
   * @param {import('./types/desktop-api').SmmElement} hs
   * @param {{ saveToFile?: boolean }} [opts]
   */
  async function snapshotHotspotToClip(hs, opts = {}) {
    if (!currentPage || hotspotSnapBusy) return
    setHotspotSnapBusy(true)
    setStatus('📸 Capturing region…')
    try {
      const rectDataUrl = await renderRegionToDataUrl(hs.x, hs.y, hs.w, hs.h, new Set([hs.id]))
      const dataUrl = await applyHotspotShapeMask(rectDataUrl, hs)
      const snapName = nextSnapName()
      let file = dataUrl
      let mediaName = snapName
      if (opts.saveToFile && window.smmDesktop?.savePng) {
        const result = await window.smmDesktop.savePng(dataUrl, { defaultName: snapName, title: 'Save Snapshot PNG' })
        if (result.canceled) { setStatus('📸 Save cancelled'); return }
        if (result.ok && result.filePath) { file = result.filePath; mediaName = result.filePath.split(/[/\\]/).pop() || snapName }
      }
      pushHistory(true)
      const newEl = {
        ...makeElem('clip', hs.x, hs.y, hs.w, hs.h),
        file, mediaKind: 'image', mediaName, fit: 'fill',
        snapshotShape: hs.hotspotShape || 'rect',
        snapshotPoints: hs.points || [],
      }
      setPages((prev) =>
        prev.map((pg, i) => i === cur ? { ...pg, elements: [...pg.elements, { ...newEl, z: pg.elements.length }] } : pg),
      )
      setSelId(newEl.id)
      setStatus(opts.saveToFile ? `📸 Snapshot saved: ${mediaName}` : '📸 Snapshot → Clip element created')
    } catch (err) {
      setStatus(`Snapshot failed: ${String(/** @type {any} */(err).message || err)}`)
    } finally {
      setHotspotSnapBusy(false)
    }
  }

  /**
   * Snapshot the bounding box of the current element selection → new Clip element.
   * Works on any selected element(s), not just hotspots.
   * @param {{ saveToFile?: boolean }} [opts]
   */
  async function snapshotSelectionToClip(opts = {}) {
    if (!currentPage || hotspotSnapBusy) return
    const ids = selIds.length > 0 ? selIds : (selId ? [selId] : [])
    if (ids.length === 0) { setStatus('Select one or more elements to snapshot'); return }
    const els = (currentPage.elements || []).filter((el) => ids.includes(el.id))
    if (els.length === 0) return
    // Single hotspot → use shape-aware capture so the clip matches the drawn shape
    if (els.length === 1 && els[0].type === 'hotspot') {
      return snapshotHotspotToClip(els[0], opts)
    }
    const ox = Math.min(...els.map((el) => el.x))
    const oy = Math.min(...els.map((el) => el.y))
    const x2 = Math.max(...els.map((el) => el.x + el.w))
    const y2 = Math.max(...els.map((el) => el.y + el.h))
    setHotspotSnapBusy(true)
    setStatus('📸 Capturing selection…')
    try {
      const dataUrl = await renderRegionToDataUrl(ox, oy, x2 - ox, y2 - oy)
      const snapName = nextSnapName()
      let file = dataUrl
      let mediaName = snapName
      if (opts.saveToFile && window.smmDesktop?.savePng) {
        const result = await window.smmDesktop.savePng(dataUrl, { defaultName: snapName, title: 'Save Snapshot PNG' })
        if (result.canceled) { setStatus('📸 Save cancelled'); return }
        if (result.ok && result.filePath) { file = result.filePath; mediaName = result.filePath.split(/[/\\]/).pop() || snapName }
      }
      pushHistory(true)
      const newEl = { ...makeElem('clip', ox, oy, x2 - ox, y2 - oy), file, mediaKind: 'image', mediaName }
      setPages((prev) =>
        prev.map((pg, i) => i === cur ? { ...pg, elements: [...pg.elements, { ...newEl, z: pg.elements.length }] } : pg),
      )
      setSelId(newEl.id)
      setStatus(opts.saveToFile ? `📸 Snapshot saved: ${mediaName}` : '📸 Selection → Clip element created')
    } catch (err) {
      setStatus(`Snapshot failed: ${String(/** @type {any} */(err).message || err)}`)
    } finally {
      setHotspotSnapBusy(false)
    }
  }

  function placeNew(type, px, py) {
    if (!currentPage) return
    pushHistory(true)
    const D = {
      text: { w: 200, h: 60 },
      clip: { w: 200, h: 150 },
      button: { w: 140, h: 40 },
      mpeg: { w: 320, h: 240 },
      hotspot: { w: 160, h: 120 },
      menubar: { w: stageWidth, h: 60 },
    }
    const map = { img: 'clip', btn: 'button' }
    const rt = map[type] || type
    const d = D[rt] || D.text
    const el = makeElem(
      rt,
      Math.max(0, Math.min(px - d.w / 2, stageWidth - d.w)),
      Math.max(0, Math.min(py - d.h / 2, stageHeight - d.h)),
      d.w,
      d.h,
    )

    setPages((prev) =>
      prev.map((pg, i) =>
        i === cur ? { ...pg, elements: [...pg.elements, { ...el, z: pg.elements.length }] } : pg,
      ),
    )
    setSelId(el.id)
    setTool('sel')
    setStatus(`${rt} element added`)

    if (rt === 'clip') {
      void chooseMedia('el', 'all', el.id, true)
    }
    if (rt === 'mpeg') {
      void chooseMedia('el', 'video', el.id, true)
    }
    if (rt === 'menubar') {
      setMenuBarEditEl({ pageIdx: cur, elId: el.id, el })
    }
  }

  function onPanelDividerMouseDown(e, panel) {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startSize = panelSizesRef.current[panel]
    document.body.style.cursor = panel === 'bottom' ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev) {
      let newSize
      if (panel === 'left')   newSize = Math.max(160, Math.min(520, startSize + (ev.clientX - startX)))
      if (panel === 'right')  newSize = Math.max(220, Math.min(580, startSize - (ev.clientX - startX)))
      if (panel === 'bottom') newSize = Math.max(32,  Math.min(260, startSize - (ev.clientY - startY)))
      if (newSize !== undefined) setPanelSizes((p) => ({ ...p, [panel]: newSize }))
    }
    function onUp() {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      panelResizeRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    panelResizeRef.current = { panel }
  }

  function onInnerDividerMouseDown(e, which) {
    e.preventDefault()
    const startY = e.clientY
    const startSize = innerSplitSizesRef.current[which]
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    function onMove(ev) {
      const diff = ev.clientY - startY
      let newSize
      if (which === 'leftPagesH') newSize = Math.max(60, Math.min(600, startSize + diff))
      if (which === 'leftElemH')  newSize = Math.max(50, Math.min(500, startSize + diff))
      if (which === 'rightPagesH') newSize = Math.max(56, Math.min(500, startSize + diff))
      if (newSize !== undefined) setInnerSplitSizes((p) => ({ ...p, [which]: newSize }))
    }
    function onUp() {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function togglePanel(panel) {
    setPanelVisible((p) => {
      const next = { ...p, [panel]: !p[panel] }
      try { localStorage.setItem('mme_panelVis', JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  function collapsePanel(panel) {
    setPanelCollapsed((p) => ({ ...p, [panel]: !p[panel] }))
  }

  function applyTemplate(templateId) {
    const tpl = PROJECT_TEMPLATES.find(t => t.id === templateId)
    if (!tpl) return
    stopPlay()
    setScriptMode(false)
    setSelId(null)
    setSelIds([])
    setFilename('Untitled.mme')
    setStagePreset(tpl.preset || STAGE_PRESETS[0].key)
    setPages(generateTemplatePages(tpl))
    if (templateId === 'memory-game') {
      setProjectVars(generateMemoryGameVars())
    }
    const isBook = templateId === 'storybook'
    setProjectType(templateId === 'memory-game' ? 'memory-game' : (isBook ? 'storybook' : 'general'))
    setSpreadView(false)
    setCur(0)
    setStatus(`New project: ${tpl.label}`)
    setNewProjectDlg(false)
    setPresentationAudio(DEFAULT_PRES_AUDIO)
    requestAnimationFrame(() => fitToWindow())
  }


  function clearChromaKey(elId) {
    setPages(prev => prev.map(pg => ({
      ...pg,
      elements: pg.elements.map(e => e.id !== elId ? e : {
        ...e,
        file: e.chromaOrigFile || e.file,
        chromaKey: null,
        chromaOrigFile: undefined,
        chromaColor: null,
        chromaTolerance: null,
        chromaSoftness: null,
        chromaMaskShape: null,
      }),
    })))
    setStatus('Chroma key removed')
  }

  function regenerateMemoryGame(config) {
    const newPages = generateMemoryGamePages(config)
    setPages(prev => {
      const mgIdxs = []
      prev.forEach((p, i) => { if (p.templateId === 'memory-game') mgIdxs.push(i) })
      if (mgIdxs.length === 0) return [...prev, ...newPages]
      return [...prev.slice(0, mgIdxs[0]), ...newPages, ...prev.slice(mgIdxs[mgIdxs.length - 1] + 1)]
    })
    setProjectType('memory-game')
    setMemGameEditorOpen(false)
  }

  function projectHasContent() {
    if (pages.length > 1) return true
    const fp = pages[0]
    return !!(fp?.elements?.length || (fp?.name && fp.name !== 'Page 1') || filename !== 'Untitled.mme')
  }

  function recordRecentMedia(item) {
    setRecentMedia(prev => {
      const next = [item, ...prev.filter(r => r.file !== item.file)].slice(0, 10)
      try { localStorage.setItem('mme_recentMedia', JSON.stringify(next)) } catch (err) { void err }
      return next
    })
  }

  function addMediaItemToPage(item, dropX, dropY) {
    if (!currentPage) return
    const type = item.kind === 'video' ? 'mpeg' : 'clip'
    const dims = type === 'mpeg' ? { w: 320, h: 240 } : { w: 200, h: 150 }
    const ex = dropX != null
      ? Math.round(Math.max(0, Math.min(dropX - dims.w / 2, stageWidth - dims.w)))
      : Math.round((stageWidth - dims.w) / 2)
    const ey = dropY != null
      ? Math.round(Math.max(0, Math.min(dropY - dims.h / 2, stageHeight - dims.h)))
      : Math.round((stageHeight - dims.h) / 2)
    const el = makeElem(type, ex, ey, dims.w, dims.h)
    const patched = { ...el, file: item.file, mediaKind: item.kind, mediaName: item.name, mediaSourcePath: item.sourcePath || null, z: currentPage.elements.length }
    pushHistory()
    setPages(prev => prev.map((pg, i) => i === cur ? { ...pg, elements: [...pg.elements, patched] } : pg))
    setSelId(el.id)
    setSelIds([el.id])
    recordRecentMedia(item)
    setStatus('Added: ' + item.name)
  }

  // ── History ────────────────────────────────────────────────
  function pushHistory(force = false) {
    const now = Date.now()
    if (!force && now - lastHistoryPushRef.current < 600) return
    lastHistoryPushRef.current = now
    const snapshot = JSON.parse(JSON.stringify(pagesRef.current))
    const h = historyRef.current
    h.past.push(snapshot)
    if (h.past.length > 60) h.past.shift()
    h.future = []
  }

  function undo() {
    const h = historyRef.current
    if (!h.past.length) { setStatus('Nothing to undo'); return }
    h.future.push(JSON.parse(JSON.stringify(pagesRef.current)))
    const prev = h.past.pop()
    setPages(prev)
    setStatus(`Undo  (${h.past.length} left)`)
  }

  function redo() {
    const h = historyRef.current
    if (!h.future.length) { setStatus('Nothing to redo'); return }
    h.past.push(JSON.parse(JSON.stringify(pagesRef.current)))
    const next = h.future.pop()
    setPages(next)
    setStatus(`Redo  (${h.future.length} left)`)
  }

  // ── Clipboard / Copy / Paste / Duplicate ──────────────────
  function copySelected() {
    const ids = selIds.length > 0 ? selIds : (selId ? [selId] : [])
    if (!ids.length) { setStatus('Select an element first'); return }
    const els = (currentPage?.elements ?? []).filter((e) => ids.includes(e.id))
    clipboardRef.current = JSON.parse(JSON.stringify(els))
    setStatus(`Copied ${els.length} element${els.length > 1 ? 's' : ''}`)
  }

  function pasteElements(targetPageIdx = cur) {
    if (!clipboardRef.current.length) { setStatus('Clipboard is empty'); return }
    pushHistory(true)
    const offset = targetPageIdx === cur ? 15 : 0
    const newEls = clipboardRef.current.map((el) => ({
      ...JSON.parse(JSON.stringify(el)),
      id: uid(),
      x: el.x + offset,
      y: el.y + offset,
    }))
    setPages((prev) =>
      prev.map((pg, i) =>
        i === targetPageIdx
          ? { ...pg, elements: [...pg.elements, ...newEls.map((e, ei) => ({ ...e, z: pg.elements.length + ei }))] }
          : pg,
      ),
    )
    setSelId(newEls[newEls.length - 1].id)
    setSelIds(newEls.map((e) => e.id))
    if (targetPageIdx !== cur) setCur(targetPageIdx)
    setStatus(`Pasted ${newEls.length} element${newEls.length > 1 ? 's' : ''}`)
  }

  const toggleScriptView = useCallback(() => {
    setShowScriptFlow(prev => !prev)
  }, [])

  function onStageMouseDown(e) {
    if (!stageRef.current || scriptMode || playIdx >= 0) return
    if (e.target !== stageRef.current && e.target !== bgRef.current) return

    if (tool === 'sel') {
      setSelId(null)
      setSelIds([])
      setInspectorTab('page')
      return
    }

    const rect = stageRef.current.getBoundingClientRect()
    const px = Math.round((e.clientX - rect.left) / zoom)
    const py = Math.round((e.clientY - rect.top) / zoom)

    // ── Hotspot freehand mode: click adds points, double-click closes ──
    if (tool === 'hotspot' && hotspotShape === 'freehand') {
      if (e.detail === 2 && hsFreehandPts.length >= 3) {
        // Double-click: close polygon and create element
        const xs = hsFreehandPts.map((p) => p.x)
        const ys = hsFreehandPts.map((p) => p.y)
        const minX = Math.min(...xs), minY = Math.min(...ys)
        const maxX = Math.max(...xs), maxY = Math.max(...ys)
        const bw = Math.max(20, maxX - minX)
        const bh = Math.max(20, maxY - minY)
        // Normalize points to 0-1 relative to bounding box
        const normPts = hsFreehandPts.map((p) => ({
          x: (p.x - minX) / bw,
          y: (p.y - minY) / bh,
        }))
        pushHistory(true)
        const el = { ...makeElem('hotspot', minX, minY, bw, bh), hotspotShape: 'freehand', points: normPts }
        setPages((prev) =>
          prev.map((pg, i) =>
            i === cur ? { ...pg, elements: [...pg.elements, { ...el, z: pg.elements.length }] } : pg,
          ),
        )
        setSelId(el.id)
        setSelIds([el.id])
        setInspectorTab('props')
        setHsFreehandPts([])
        setHsFreehandActive(false)
        setTool('sel')
        setStatus('Hotspot created')
      } else {
        // Single click: add point
        setHsFreehandPts((prev) => [...prev, { x: px, y: py }])
        setHsFreehandActive(true)
      }
      return
    }

    // ── Hotspot geometric shape: drag to draw ──
    if (tool === 'hotspot') {
      setHsDrawing({ x0: px, y0: py, x1: px, y1: py })
      const onMove = (mv) => {
        const r2 = stageRef.current?.getBoundingClientRect()
        if (!r2) return
        const mx = Math.round((mv.clientX - r2.left) / zoom)
        const my = Math.round((mv.clientY - r2.top) / zoom)
        setHsDrawing((d) => d ? { ...d, x1: mx, y1: my } : d)
      }
      const onUp = (uv) => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        const r2 = stageRef.current?.getBoundingClientRect()
        if (!r2) { setHsDrawing(null); return }
        const ux = Math.round((uv.clientX - r2.left) / zoom)
        const uy = Math.round((uv.clientY - r2.top) / zoom)
        const ex = Math.min(px, ux), ey = Math.min(py, uy)
        const ew = Math.max(10, Math.abs(ux - px))
        const eh = Math.max(10, Math.abs(uy - py))
        pushHistory(true)
        const el = { ...makeElem('hotspot', ex, ey, ew, eh), hotspotShape }
        setPages((prev) =>
          prev.map((pg, i) =>
            i === cur ? { ...pg, elements: [...pg.elements, { ...el, z: pg.elements.length }] } : pg,
          ),
        )
        setSelId(el.id)
        setSelIds([el.id])
        setInspectorTab('props')
        setHsDrawing(null)
        setTool('sel')
        setStatus(`Hotspot (${hotspotShape}) created`)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      return
    }

    placeNew(tool, px, py)
  }

  function onElemMouseDown(e, el) {
    e.stopPropagation()
    if (el.locked) return  // locked elements cannot be selected or moved
    // Capture current selection BEFORE this click changes it (used for click-to-edit text)
    preClickSelRef.current = [...selIds]
    const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey

    // Group-aware: clicking a grouped element selects all group members
    const groupedIds = el.groupId
      ? (currentPage?.elements ?? []).filter((x) => x.groupId === el.groupId).map((x) => x.id)
      : [el.id]

    let nextSelIds
    if (isMultiKey) {
      const alreadyAllSelected = groupedIds.every((id) => selIds.includes(id))
      if (alreadyAllSelected) {
        nextSelIds = selIds.filter((id) => !groupedIds.includes(id))
      } else {
        nextSelIds = [...new Set([...selIds, ...groupedIds])]
      }
    } else {
      nextSelIds = [...new Set(groupedIds)]
    }

    const primaryId = nextSelIds.includes(el.id) ? el.id : (nextSelIds[0] || el.id)
    setSelId(primaryId)
    setSelIds(nextSelIds)
    setInspectorTab('props')

    if (e.target && (e.target.tagName === 'AUDIO' || e.target.tagName === 'VIDEO')) return

    // Store original positions of ALL selected elements for group drag
    const origPositions = {}
    ;(currentPage?.elements ?? []).forEach((elem) => {
      if (nextSelIds.includes(elem.id)) origPositions[elem.id] = { x: elem.x, y: elem.y }
    })

    pushHistory(true)
    dragRef.current = {
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.w,
      origH: el.h,
      mode: 'move',
      handle: '',
      origPositions,
      isMulti: nextSelIds.length > 1,
    }
  }

  function onResizeHandleMouseDown(e, el, handle) {
    e.stopPropagation()
    setSelId(el.id)
    pushHistory(true)
    dragRef.current = {
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.w,
      origH: el.h,
      mode: 'resize',
      handle,
    }
  }

  function onElemDoubleClick(e, el) {
    e.stopPropagation()
    if (el.type !== 'text') return
    pushHistory(true)
    setInlineEditId(el.id)
  }

  const layerOp = useCallback((op) => {
    if (!selId) {
      setStatus('Select an element first')
      return
    }
    let outcome = 'none'
    setPages((prev) =>
      prev.map((pg, i) => {
        if (i !== cur) return pg
        const sorted = [...pg.elements].sort((a, b) => a.z - b.z)
        const idx = sorted.findIndex((el) => el.id === selId)
        if (idx < 0) {
          outcome = 'missing'
          return pg
        }

        if (sorted.length <= 1) {
          outcome = 'boundary'
          return pg
        }

        if (op === 'top') {
          if (idx >= sorted.length - 1) {
            outcome = 'boundary'
            return pg
          }
          const [target] = sorted.splice(idx, 1)
          sorted.push(target)
          outcome = 'moved'
          return { ...pg, elements: reindexZByCurrentOrder(sorted) }
        }

        if (op === 'bot') {
          if (idx <= 0) {
            outcome = 'boundary'
            return pg
          }
          const [target] = sorted.splice(idx, 1)
          sorted.unshift(target)
          outcome = 'moved'
          return { ...pg, elements: reindexZByCurrentOrder(sorted) }
        }

        if (op === 'up') {
          if (idx >= sorted.length - 1) {
            outcome = 'boundary'
            return pg
          }
          ;[sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]]
          outcome = 'moved'
          return { ...pg, elements: reindexZByCurrentOrder(sorted) }
        }

        if (op === 'dn') {
          if (idx <= 0) {
            outcome = 'boundary'
            return pg
          }
          ;[sorted[idx], sorted[idx - 1]] = [sorted[idx - 1], sorted[idx]]
          outcome = 'moved'
          return { ...pg, elements: reindexZByCurrentOrder(sorted) }
        }

        return pg
      }),
    )
    const labels = {
      top: 'front',
      up: 'up',
      dn: 'down',
      bot: 'back',
    }
    if (outcome === 'moved') {
      setStatus(`Layer moved ${labels[op]}`)
      return
    }
    if (outcome === 'boundary') {
      setStatus(`Layer already at ${labels[op]}`)
      return
    }
    if (outcome === 'missing') {
      setStatus('Selected element not found')
    }
  }, [cur, selId])

  const deleteSelected = useCallback(() => {
    const idsToDelete = selIds.length > 0 ? selIds : (selId ? [selId] : [])
    if (idsToDelete.length === 0) {
      setStatus('Select an element first')
      return false
    }
    pushHistory(true)
    setPages((prev) =>
      prev.map((pg, i) =>
        i === cur ? { ...pg, elements: pg.elements.filter((el) => !idsToDelete.includes(el.id)) } : pg,
      ),
    )
    setSelId(null)
    setSelIds([])
    setStatus(idsToDelete.length > 1 ? `${idsToDelete.length} elements deleted` : 'Element deleted')
    return true
  }, [cur, selId, selIds])

  function duplicateSelected() {
    const ids = selIds.length > 0 ? selIds : (selId ? [selId] : [])
    if (!ids.length || !currentPage) { setStatus('Select an element first'); return false }
    pushHistory(true)
    const els = (currentPage.elements ?? []).filter((e) => ids.includes(e.id))
    const dups = els.map((el) => ({
      ...JSON.parse(JSON.stringify(el)),
      id: uid(),
      x: el.x + 20,
      y: el.y + 20,
    }))
    setPages((prev) =>
      prev.map((pg, i) =>
        i === cur
          ? { ...pg, elements: [...pg.elements, ...dups.map((d, di) => ({ ...d, z: pg.elements.length + di }))] }
          : pg,
      ),
    )
    setSelId(dups[0].id)
    setSelIds(dups.map((d) => d.id))
    setStatus(`Duplicated ${dups.length} element${dups.length > 1 ? 's' : ''}`)
    return true
  }

  function movePageUp() {
    if (cur <= 0) { setStatus('Already at first page'); return }
    pushHistory(true)
    setPages((prev) => {
      const next = [...prev]
      ;[next[cur - 1], next[cur]] = [next[cur], next[cur - 1]]
      return next
    })
    setCur((v) => v - 1)
    setStatus('Page moved up')
  }

  function movePageDown() {
    if (cur >= pages.length - 1) { setStatus('Already at last page'); return }
    pushHistory(true)
    setPages((prev) => {
      const next = [...prev]
      ;[next[cur], next[cur + 1]] = [next[cur + 1], next[cur]]
      return next
    })
    setCur((v) => v + 1)
    setStatus('Page moved down')
  }

  /** Reorder pages: move `selectedIndices` pages as a group to just before `targetIdx`.
   *  Returns the new pages array, or null if no change needed. */
  function movePagesTo(pagesArr, selectedIndices, targetIdx) {
    const sel = new Set(selectedIndices)
    if (sel.has(targetIdx)) return null
    const sorted = [...selectedIndices].sort((a, b) => a - b)
    const selPages = sorted.map((i) => pagesArr[i])
    const remaining = pagesArr.filter((_, i) => !sel.has(i))
    const before = sorted.filter((i) => i < targetIdx).length
    const insertAt = Math.min(targetIdx - before, remaining.length)
    return [...remaining.slice(0, insertAt), ...selPages, ...remaining.slice(insertAt)]
  }

  const handlePageDragStart = useCallback((e, i) => {
    e.dataTransfer.setData('dragType', 'page')
    e.dataTransfer.setData('pageIdx', String(i))
    e.dataTransfer.effectAllowed = 'move'
    // if dragging a page not in the current multi-select, treat it as a solo drag
    if (!selectedPageIds.includes(i)) {
      setSelectedPageIds([i])
    }
  }, [selectedPageIds])

  const handlePageDropAt = useCallback((e, dropIdx) => {
    e.preventDefault()
    setPageDragOverIdx(-1)
    if (e.dataTransfer.getData('dragType') !== 'page') return
    const srcIdx = parseInt(e.dataTransfer.getData('pageIdx'), 10)
    if (isNaN(srcIdx)) return
    const moving = selectedPageIds.includes(srcIdx) && selectedPageIds.length > 1
      ? selectedPageIds
      : [srcIdx]
    if (moving.includes(dropIdx)) return
    const newPages = movePagesTo(pages, moving, dropIdx)
    if (!newPages) return
    pushHistory(true)
    const sorted = [...moving].sort((a, b) => a - b)
    const before = sorted.filter((i) => i < dropIdx).length
    const newCur = dropIdx - before
    setPages(newPages)
    setCur(newCur)
    setSelectedPageIds([])
    setStatus(`Moved ${moving.length} page${moving.length > 1 ? 's' : ''} to position ${newCur + 1}`)
  }, [pages, selectedPageIds])

  function alignElement(dir) {
    const selected = (currentPage?.elements ?? []).filter((el) => selIds.includes(el.id))
    if (selected.length === 0) { setStatus('Select an element first'); return }
    const patches = {}
    selected.forEach((el) => {
      let x = el.x, y = el.y
      if (dir === 'left')    x = 0
      if (dir === 'hcenter') x = Math.round((stageWidth - el.w) / 2)
      if (dir === 'right')   x = stageWidth - el.w
      if (dir === 'top')     y = 0
      if (dir === 'vcenter') y = Math.round((stageHeight - el.h) / 2)
      if (dir === 'bottom')  y = stageHeight - el.h
      patches[el.id] = { x, y }
    })
    setPages((prev) => prev.map((pg, i) =>
      i !== cur ? pg : { ...pg, elements: pg.elements.map((el) => patches[el.id] ? { ...el, ...patches[el.id] } : el) }
    ))
    setStatus(`Aligned: ${dir}`)
  }

  function nudgeElement(dx, dy) {
    const selected = (currentPage?.elements ?? []).filter((el) => selIds.includes(el.id))
    if (selected.length === 0) return
    setPages((prev) => prev.map((pg, i) =>
      i !== cur ? pg : {
        ...pg,
        elements: pg.elements.map((el) =>
          selIds.includes(el.id) ? { ...el, x: Math.round(el.x + dx), y: Math.round(el.y + dy) } : el
        ),
      }
    ))
  }

  function spaceEvenlyH() {
    const selected = (currentPage?.elements ?? []).filter((el) => selIds.includes(el.id))
    if (selected.length < 3) { setStatus('Select 3+ elements to space evenly'); return }
    const sorted = [...selected].sort((a, b) => a.x - b.x)
    const totalSpan = (sorted[sorted.length - 1].x + sorted[sorted.length - 1].w) - sorted[0].x
    const totalW = sorted.reduce((s, el) => s + el.w, 0)
    const gap = (totalSpan - totalW) / (sorted.length - 1)
    let cursor = sorted[0].x
    const newX = {}
    sorted.forEach((el) => { newX[el.id] = Math.round(cursor); cursor += el.w + gap })
    setPages((prev) => prev.map((pg, i) =>
      i !== cur ? pg : { ...pg, elements: pg.elements.map((el) => newX[el.id] !== undefined ? { ...el, x: newX[el.id] } : el) }
    ))
    setStatus('Spaced evenly horizontal')
  }

  function spaceEvenlyV() {
    const selected = (currentPage?.elements ?? []).filter((el) => selIds.includes(el.id))
    if (selected.length < 3) { setStatus('Select 3+ elements to space evenly'); return }
    const sorted = [...selected].sort((a, b) => a.y - b.y)
    const totalSpan = (sorted[sorted.length - 1].y + sorted[sorted.length - 1].h) - sorted[0].y
    const totalH = sorted.reduce((s, el) => s + el.h, 0)
    const gap = (totalSpan - totalH) / (sorted.length - 1)
    let cursor = sorted[0].y
    const newY = {}
    sorted.forEach((el) => { newY[el.id] = Math.round(cursor); cursor += el.h + gap })
    setPages((prev) => prev.map((pg, i) =>
      i !== cur ? pg : { ...pg, elements: pg.elements.map((el) => newY[el.id] !== undefined ? { ...el, y: newY[el.id] } : el) }
    ))
    setStatus('Spaced evenly vertical')
  }

  function groupSelected() {
    if (selIds.length < 2) { setStatus('Select 2+ elements to group'); return }
    const pg = currentPage
    if (!pg) return
    const els = pg.elements.filter((e) => selIds.includes(e.id))
    if (els.some((e) => e.type === 'group')) { setStatus('Cannot nest group inside a group'); return }
    const minX = Math.min(...els.map((e) => e.x))
    const minY = Math.min(...els.map((e) => e.y))
    const maxX = Math.max(...els.map((e) => e.x + e.w))
    const maxY = Math.max(...els.map((e) => e.y + e.h))
    const zMin = Math.min(...els.map((e) => e.z ?? 0))
    const existingGroupCount = pg.elements.filter((e) => e.type === 'group').length
    const groupEl = {
      id: uid(),
      type: 'group',
      name: `Group ${existingGroupCount + 1}`,
      x: minX, y: minY,
      w: maxX - minX, h: maxY - minY,
      z: zMin,
      visible: true, locked: false,
      opacity: 100,
      animIn: 'none', animInDuration: 600, animInDelay: 0, animInEasing: 'ease-out',
      animOut: 'none', animOutDuration: 600, animOutTrigger: 'never',
      animLoop: 'none',
      wipe: '', wipeSpeed: 5, wipeDir: 0,
      elLabel: '', groupId: '',
      children: els.map((e) => ({ ...e, x: e.x - minX, y: e.y - minY })),
    }
    pushHistory()
    setPages((prev) => prev.map((pgr, i) => i !== cur ? pgr : {
      ...pgr,
      elements: [...pgr.elements.filter((e) => !selIds.includes(e.id)), groupEl],
    }))
    setSelId(groupEl.id)
    setSelIds([groupEl.id])
    setStatus(`Grouped ${els.length} elements → "${groupEl.name}"`)
  }

  function ungroupSelected() {
    const pg = currentPage
    const compositeGroups = (pg?.elements ?? []).filter((e) => selIds.includes(e.id) && e.type === 'group')
    const legacyGroupIds = new Set(
      (pg?.elements ?? []).filter((e) => selIds.includes(e.id) && e.groupId).map((e) => e.groupId)
    )
    if (compositeGroups.length === 0 && legacyGroupIds.size === 0) { setStatus('No grouped elements selected'); return }
    pushHistory()
    const newIds = []
    setPages((prev) => prev.map((pgr, i) => {
      if (i !== cur) return pgr
      let elements = pgr.elements.filter((e) => !compositeGroups.some((g) => g.id === e.id))
      for (const g of compositeGroups) {
        const maxZ = elements.reduce((mx, e) => Math.max(mx, e.z ?? 0), 0)
        const restored = (g.children || []).map((child, ci) => ({
          ...child, id: uid(), x: g.x + child.x, y: g.y + child.y, z: maxZ + ci + 1,
        }))
        newIds.push(...restored.map((e) => e.id))
        elements = [...elements, ...restored]
      }
      if (legacyGroupIds.size > 0) {
        elements = elements.map((e) => legacyGroupIds.has(e.groupId) ? { ...e, groupId: '' } : e)
      }
      return { ...pgr, elements }
    }))
    if (newIds.length) { setSelIds(newIds); setSelId(newIds[0]) }
    setStatus('Ungrouped')
  }

  function addPage() {
    setPages((prev) => {
      const next = makePage('', prev.length)
      const n = [...prev]
      n.splice(cur + 1, 0, next)
      return n
    })
    setCur((v) => v + 1)
    setSelId(null)
    setStatus('Page added')
  }

  function deletePage() {
    if (pages.length <= 1) {
      setStatus('Cannot delete last page')
      return
    }
    const removedName = pages[cur]?.name || `Page ${cur + 1}`
    const nextPages = pages.filter((_, i) => i !== cur)
    const nextIndex = Math.min(cur, nextPages.length - 1)
    setPages(nextPages)
    setCur(nextIndex)
    setSelId(null)
    setStatus(`Page deleted: ${removedName}`)
  }

  function duplicatePage() {
    if (!currentPage) return
    const copy = structuredClone(currentPage)
    copy.id = uid()
    copy.name = `${copy.name} (copy)`
    copy.elements.forEach((el, i) => {
      el.id = uid()
      el.z = i
    })

    setPages((prev) => {
      const n = [...prev]
      n.splice(cur + 1, 0, copy)
      return n
    })
    setCur((v) => v + 1)
    setSelId(null)
    setStatus('Page duplicated')
  }

  function applyStagePreset(nextPresetKey) {
    if (nextPresetKey === 'custom') {
      setShowCustomStageDlg(true)
      return
    }
    setStagePreset(nextPresetKey)
    const preset = STAGE_PRESETS.find((item) => item.key === nextPresetKey) || STAGE_PRESETS[0]
    setPages((prev) => prev.map((pg) => clampPageToStage(pg)))
    setStatus(`Stage set: ${preset.width} x ${preset.height}`)
  }

  function applyCustomStage(w, h) {
    const cw = Math.max(100, Math.min(8000, Math.round(w)))
    const ch = Math.max(100, Math.min(8000, Math.round(h)))
    setCustomStageW(cw)
    setCustomStageH(ch)
    setStagePreset('custom')
    setPages((prev) => prev.map((pg) => clampPageToStage(pg)))
    setStatus(`Stage set: ${cw} x ${ch} (custom)`)
    setShowCustomStageDlg(false)
  }

  const goToPage = useCallback((index) => {
    const nextIndex = Math.max(0, Math.min(index, pages.length - 1))
    setCur(nextIndex)
    setSelId(null)
    return nextIndex
  }, [pages.length])

  /** Handle page panel click with optional modifier keys for multi-selection.
   *  - Plain click:      navigate to page, clear multi-selection
   *  - Ctrl/Meta+click:  toggle page in/out of multi-selection (don't navigate)
   *  - Shift+click:      range-select from cur to i, navigate to i
   */
  const handlePageSelect = useCallback((i, e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const next = selectedPageIds.includes(i)
        ? selectedPageIds.filter((x) => x !== i)
        : [...selectedPageIds, i]
      setSelectedPageIds(next)
      setStatus(next.length > 0
        ? `Multi-select: pages ${next.map((x) => x + 1).sort((a, b) => a - b).join(', ')}`
        : 'Multi-select cleared')
    } else if (e.shiftKey) {
      e.preventDefault()
      const lo = Math.min(cur, i)
      const hi = Math.max(cur, i)
      const range = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k)
      const combined = Array.from(new Set([...selectedPageIds, ...range]))
      setSelectedPageIds(combined)
      setStatus(`Multi-select: pages ${combined.map((x) => x + 1).sort((a, b) => a - b).join(', ')}`)
      setCur(i)
      setSelId(null)
    } else {
      setSelectedPageIds([])
      goToPage(i)
    }
  }, [cur, goToPage, selectedPageIds])

  function selectTool(nextTool) {
    setTool(nextTool)
  }

  function openBtnEditorNew() {
    const template = makeElem('button', 0, 0, 160, 44)
    setBtnEditor({ open: true, elId: null, data: template })
  }

  function openBtnEditorExisting(el) {
    setBtnEditor({ open: true, elId: el.id, data: { ...el } })
  }

  function onBtnEditorConfirm(data) {
    const { elId } = btnEditor
    setBtnEditor({ open: false, elId: null, data: null })
    if (elId) {
      setPages((prev) =>
        prev.map((pg, i) => {
          if (i !== cur) return pg
          return {
            ...pg,
            elements: pg.elements.map((el) =>
              el.id === elId ? { ...el, ...data, id: el.id, x: el.x, y: el.y, z: el.z } : el,
            ),
          }
        }),
      )
      setSelId(elId)
      setStatus('Button updated')
    } else {
      const bw = data.w || 160
      const bh = data.h || 44
      const el = {
        ...data,
        id: uid(),
        x: Math.max(0, Math.min(Math.round((stageWidth - bw) / 2), stageWidth - bw)),
        y: Math.max(0, Math.min(Math.round((stageHeight - bh) / 2), stageHeight - bh)),
        z: currentPage?.elements?.length || 0,
      }
      setPages((prev) =>
        prev.map((pg, i) =>
          i === cur ? { ...pg, elements: [...pg.elements, el] } : pg,
        ),
      )
      setSelId(el.id)
      setStatus('Button placed')
    }
  }

  /**
   * Parse and apply an SCA script, replacing all pages and stage config.
   * In dev mode also persists to disk auto-save. In prod also persists to localStorage.
   * @param {string} txt - Raw SCA content
   * @param {string} name - Display filename (e.g. "project.mme")
   * @returns {Promise<boolean>} true on success
   */
  async function applyParsedScript(txt, name) {
    const parsed = parseMME(txt)
    if (!parsed.pages.length) {
      setStatus('Parse error - no pages found')
      return false
    }
    // Restore project variables if saved
    if (parsed.projectVars?.length) setProjectVars(parsed.projectVars)
    const parsedPresetKey = parsed.stage
      ? getPresetKey(parsed.stage.width, parsed.stage.height)
      : STAGE_PRESETS[0].key
    let resolvedPages = parsed.pages.map((pg) => clampPageToStage(pg))

    // Post-load media resolution: attempt to reload media from stored native source paths
    const missingMedia = []
    if (desktopApi?.readMediaDataUrl) {
      resolvedPages = await Promise.all(resolvedPages.map(async (pg) => ({
        ...pg,
        elements: await Promise.all(pg.elements.map(async (el) => {
          const srcPath = el.mediaSourcePath
          const kind = el.mediaKind || 'image'

          // Video elements: always prefer HTTP media server URL from native path (range-request capable, seeking works)
          // Even if a data URL is embedded, use the path when available
          if (kind === 'video' && srcPath && typeof srcPath === 'string') {
            const isRealPath = srcPath.includes('/') || srcPath.includes('\\') || /^[a-zA-Z]:/.test(srcPath)
            if (isRealPath) {
              const fresh = inferMediaCapability(el.mediaName || srcPath, 'video')
              return {
                ...el,
                file: makeAppMediaUrl(srcPath),
                mediaSupport: fresh.support !== 'unknown' ? fresh.support : el.mediaSupport,
                mediaReason: el.mediaReason || (fresh.support !== 'unknown' ? fresh.reason : ''),
                mediaExt: fresh.extension || el.mediaExt,
              }
            }
          }

          // Non-video: if media is already a valid data URL (embedded in mme:clip), it's self-contained
          if (el.file && el.file.startsWith('data:')) {
            const fresh = inferMediaCapability(el.mediaName || srcPath || '', kind)
            return fresh.support !== 'unknown'
              ? { ...el, mediaExt: fresh.extension || el.mediaExt, mediaSupport: fresh.support, mediaReason: el.mediaReason || fresh.reason || '' }
              : el
          }

          if (!srcPath || typeof srcPath !== 'string') {
            // Auto-resolve button background images from btnImageSourcePath
            if (el.type === 'button' && el.btnImageSourcePath) {
              const bPath = el.btnImageSourcePath
              const isRealBPath = bPath.includes('/') || bPath.includes('\\') || /^[a-zA-Z]:/.test(bPath)
              if (isRealBPath) {
                try {
                  const loaded = await desktopApi.readMediaDataUrl({ filePath: bPath, category: 'image' })
                  if (loaded?.ok && loaded.dataUrl) return { ...el, btnImage: internDataUrl(loaded.dataUrl, bPath) }
                } catch { /* fall through */ }
              }
            }
            return el
          }
          // Only attempt to re-read if the path looks like a real native path
          const isRealPath = srcPath.includes('/') || srcPath.includes('\\') || /^[a-zA-Z]:/.test(srcPath)
          if (!isRealPath) {
            missingMedia.push(el.mediaName || srcPath)
            return el
          }
          // Audio with real native path: serve via HTTP media server.
          // For partial-support audio (WAV — may use ADPCM codec not supported by Chromium),
          // transcode to MP3 via ffmpeg for guaranteed compatibility.
          if (kind === 'audio') {
            const fresh = inferMediaCapability(el.mediaName || srcPath, kind)
            if (fresh.support === 'partial' && desktopApi?.transcodeMedia) {
              try {
                const transcode = await desktopApi.transcodeMedia({
                  filePath: srcPath,
                  category: 'audio',
                  support: 'partial',
                  extension: fresh.extension,
                })
                if (transcode?.ok && transcode.convertedPath) {
                  return {
                    ...el,
                    file: makeAppMediaUrl(transcode.convertedPath),
                    mediaSupport: 'native',
                    mediaReason: `Transcoded to ${transcode.outputHint || 'MP3'} for Chromium compatibility`,
                    mediaExt: getMediaExtension(transcode.convertedPath),
                  }
                }
              } catch { /* fall through to direct serve */ }
            }
            return {
              ...el,
              file: makeAppMediaUrl(srcPath),
              mediaSupport: fresh.support !== 'unknown' ? fresh.support : el.mediaSupport,
              mediaReason: fresh.support !== 'unknown' ? (fresh.reason || '') : el.mediaReason,
              mediaExt: fresh.extension || el.mediaExt,
            }
          }
          try {
            // Image: read as data URL for inline display
            const loaded = await desktopApi.readMediaDataUrl({ filePath: srcPath, category: kind })
            if (loaded?.ok && loaded.dataUrl) {
              const fresh = inferMediaCapability(el.mediaName || srcPath, kind)
              return {
                ...el,
                file: internDataUrl(loaded.dataUrl, srcPath),
                mediaSupport: fresh.support !== 'unknown' ? fresh.support : el.mediaSupport,
                mediaReason: fresh.support !== 'unknown' ? (fresh.reason || '') : el.mediaReason,
                mediaExt: fresh.extension || el.mediaExt,
                // Restore chroma key original image if saved
                ...(el.chromaOrigDataUrl ? { chromaOrigFile: internDataUrl(el.chromaOrigDataUrl) } : {}),
              }
            }
            missingMedia.push(el.mediaName || srcPath)
          } catch { missingMedia.push(el.mediaName || srcPath) }
          return el
        })),
      })))
    } else {
      // No desktop API — fix capability metadata from mediaName for already-embedded data URLs
      resolvedPages = resolvedPages.map((pg) => ({
        ...pg,
        elements: pg.elements.map((el) => {
          if ((el.type === 'clip' || el.type === 'mpeg') && el.mediaName) {
            const fresh = inferMediaCapability(el.mediaName, el.mediaKind || 'image')
            const chromaRestore = el.chromaOrigDataUrl ? { chromaOrigFile: internDataUrl(el.chromaOrigDataUrl) } : {}
            if (fresh.support !== 'unknown') {
              return { ...el, mediaExt: fresh.extension || el.mediaExt, mediaSupport: fresh.support, mediaReason: el.mediaReason || fresh.reason || '', ...chromaRestore }
            }
            if (el.chromaOrigDataUrl) return { ...el, ...chromaRestore }
          }
          return el
        }),
      }))
    }

    // Interaction media fields (hoverSoundFile, hoverMediaFile, clickSoundFile, clickMediaFile)
    // are stored as native filesystem paths in the SCA file. Playback code already resolves
    // them on-the-fly via isUnresolvedMediaPath() + makeAppMediaUrl(). We must NOT pre-resolve
    // them here, because that would overwrite native paths with temp HTTP URLs, causing
    // those fields to be silently dropped on the next save (isTempUrl check in genMME).

    // Detect any clip/mpeg elements (or image-backed buttons) with unresolved file paths
    const unresolvedEls = []

    // Re-resolve background media: check bgMediaSourcePath first, then bgImage as fallback (for old SCA files)
    const bgResolvedPages = await Promise.all(resolvedPages.map(async (pg) => {
      // Determine source path — prefer bgMediaSourcePath, fall back to bgImage if it's a native path
      const srcPath = pg.bgMediaSourcePath && isUnresolvedMediaPath(pg.bgMediaSourcePath)
        ? pg.bgMediaSourcePath
        : (pg.bgImage && isUnresolvedMediaPath(pg.bgImage) ? pg.bgImage : null)
      if (!srcPath) return pg // already a URL, data URL, or empty — nothing to do
      try {
        const kind = pg.bgMediaKind || 'image'
        let url = null
        if ((kind === 'video' || kind === 'audio') && desktopApi) {
          url = makeAppMediaUrl(srcPath)
        } else if (kind === 'image' && desktopApi?.readMediaDataUrl) {
          const loaded = await desktopApi.readMediaDataUrl({ filePath: srcPath, category: 'image' })
          if (loaded?.ok && loaded.dataUrl) url = internDataUrl(loaded.dataUrl, srcPath)
          else url = makeAppMediaUrl(srcPath) // fallback
        } else if (desktopApi) {
          url = makeAppMediaUrl(srcPath)
        }
        if (url) {
          logMediaEvent(`bg media re-resolved: ${pg.bgMediaName || srcPath} for page "${pg.name}"`)
          return { ...pg, bgMediaSrc: url, bgImage: url, bgMediaSourcePath: srcPath }
        }
      } catch (e) {
        logMediaEvent(`bg media re-resolve failed: ${pg.bgMediaName} — ${e?.message || e}`)
      }
      // Could not resolve — mark for user attention
      unresolvedEls.push({
        pageIdx: resolvedPages.indexOf(pg), elIdx: -1,
        field: 'bgMedia',
        filename: pg.bgMediaName || srcPath.split(/[/\\]/).pop() || srcPath,
        fullRef: srcPath,
      })
      return pg
    }))

    // Scan elements for unresolved file paths
    bgResolvedPages.forEach((pg, pi) => {
      ;(pg.elements || []).forEach((el, ei) => {
        if (el.type === 'clip' || el.type === 'mpeg') {
          const f = String(el.file || '')
          if (f && isUnresolvedMediaPath(f)) {
            unresolvedEls.push({
              pageIdx: pi, elIdx: ei,
              field: 'file',
              filename: el.mediaName || f.split(/[/\\]/).pop() || f,
              fullRef: f,
            })
          }
        } else if (el.type === 'button' && el.btnImage && isUnresolvedMediaPath(el.btnImage)) {
          const f = String(el.btnImage)
          unresolvedEls.push({
            pageIdx: pi, elIdx: ei,
            field: 'btnImage',
            filename: el.mediaName || f.split(/[/\\]/).pop() || f,
            fullRef: f,
          })
        }
      })
    })

    // Re-resolve page background sound from native sourcePath
    const soundResolvedPages = bgResolvedPages.map((pg) => {
      const snd = pg.sound
      if (!snd) return pg
      const srcPath = snd.sourcePath || snd.file || ''
      if (!srcPath) return pg
      const isRealPath = srcPath.includes('/') || srcPath.includes('\\') || /^[a-zA-Z]:/.test(srcPath)
      if (!isRealPath) return pg
      return { ...pg, sound: { ...snd, file: makeAppMediaUrl(srcPath), sourcePath: srcPath } }
    })

    // Re-resolve narration from native sourcePath (saved in mme:pgext)
    const narrationResolvedPages = soundResolvedPages.map((pg) => {
      const narr = pg.narration
      if (!narr) return pg
      // If it's an embedded data URL (TTS without native path) — already playable
      if (narr.file && narr.file.startsWith('data:')) return pg
      const srcPath = narr.sourcePath || ''
      if (!srcPath) return pg
      const isRealPath = srcPath.includes('/') || srcPath.includes('\\') || /^[a-zA-Z]:/.test(srcPath)
      if (!isRealPath) return pg
      return { ...pg, narration: { ...narr, file: makeAppMediaUrl(srcPath) } }
    })

    // Hydrate missing timing objects — old projects may not have timing field
    const hydratedPages = narrationResolvedPages.map((pg) => ({
      ...pg,
      timing: pg.timing
        ? { mode: 'wait', duration: 5, ms: 0, ...pg.timing }
        : { mode: 'wait', duration: 5, ms: 0 },
    }))
    setPages(hydratedPages)
    setStagePreset(parsedPresetKey)
    setCur(0)
    setSelId(null)
    setFilename(name)
    // Restore presentation audio — re-resolve from native source path
    if (parsed.presentationAudio?.sourcePath) {
      const pa = parsed.presentationAudio
      const url = makeAppMediaUrl(pa.sourcePath)
      setPresentationAudio({ file: url, name: pa.name || '', volume: pa.volume ?? 1, loop: pa.loop !== false, sourcePath: pa.sourcePath, trimStart: 0, trimEnd: null, offset: 0, playbackRate: 1 })
    } else {
      setPresentationAudio({ file: '', name: '', volume: 1, loop: true, sourcePath: '', trimStart: 0, trimEnd: null, offset: 0, playbackRate: 1 })
    }

    // Persist as "last opened" — separate key from the explicitly-saved state so
    // a File→Open of an older project never clobbers the last save checkpoint.
    try {
      localStorage.setItem('mme_lastOpened', txt)
      localStorage.setItem('mme_lastOpenedName', name)
    } catch { /* storage quota exceeded — ignore */ }

    if (unresolvedEls.length > 0) {
      setStatus(`Opened: ${name} — ⚠ ${unresolvedEls.length} media file(s) not found — click "Resolve Media" to locate them`)
      setMediaResolver({ unresolvedEls, resolvedPages: bgResolvedPages, open: true })
    } else {
      setStatus(`Opened: ${name} (${parsed.pages.length} pages)`)
    }
    requestAnimationFrame(() => fitToWindow())
    return true
  }

  function centreCanvas(newZoom) {
    const container = scrollRef.current
    if (!container) return
    // Double-rAF: first rAF lets React/CSS zoom update layout, second reads true dimensions
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const scaledW = stageWidth * newZoom
      const scaledH = stageHeight * newZoom
      container.scrollLeft = Math.max(0, (scaledW - container.clientWidth) / 2)
      container.scrollTop  = Math.max(0, (scaledH - container.clientHeight) / 2)
    }))
  }

  // Centre viewport on a specific canvas coordinate (used for selection-centred zoom)
  function centreOnPoint(canvasX, canvasY, newZoom) {
    const container = scrollRef.current
    if (!container) return
    requestAnimationFrame(() => requestAnimationFrame(() => {
      container.scrollLeft = Math.max(0, canvasX * newZoom - container.clientWidth / 2)
      container.scrollTop  = Math.max(0, canvasY * newZoom - container.clientHeight / 2)
    }))
  }

  function fitToWindow() {
    const container = scrollRef.current
    if (!container) return
    const pad = 32
    const availW = container.clientWidth - pad
    const availH = container.clientHeight - pad
    const fitZoom = Math.max(0.1, Math.min(3, Math.min(availW / stageWidth, availH / stageHeight)))
    const snapped = Math.round(fitZoom * 10) / 10
    setZoom(snapped)
    setStatus(`Zoom ${Math.round(snapped * 100)}% (fit)`)
    centreCanvas(snapped)
  }

  async function openMmeDesktop() {
    if (!desktopApi?.openMme) {
      setStatus('Choose a .mme file to open')
      fileRef.current?.click()
      return true
    }
    const result = await desktopApi.openMme()
    if (result?.canceled) {
      setStatus('Open canceled')
      return false
    }
    return await applyParsedScript(result.content || '', result.fileName || 'Untitled.mme')
  }

  function onOpenFile(ev) {
    const inp = /** @type {HTMLInputElement} */(ev.target)
    const file = inp.files?.[0]
    if (!file) {
      setStatus('Open canceled')
      return
    }
    const r = new FileReader()
    r.onload = (event) => {
      const txt = String(event.target?.result || '')
      void applyParsedScript(txt, file.name)
    }
    r.readAsText(file)
    inp.value = ''
  }

  /**
   * Save the current project to disk via OS save dialog (desktop) or blob download (web).
   * Writes both mme_lastSave and mme_lastOpened in localStorage for recovery.
   * @returns {Promise<boolean>}
   */
  async function onSave() {
    // Warn about media that cannot be preserved: blob URLs (temp) and large audio/video with no native path
    const lostMedia = []
    pages.forEach((pg) => (pg.elements || []).forEach((el) => {
      const f = String(el.file || '')
      if (f.startsWith('blob:') && !el.mediaSourcePath) {
        lostMedia.push(el.mediaName || 'unknown')
      } else if (f.startsWith('data:') && !el.mediaSourcePath && f.length >= 8388608) {
        // Audio/video data URL too large to embed and no native path
        lostMedia.push(`${el.mediaName || 'media'} (too large to embed — re-import after opening)`)
      }
    }))
    if (lostMedia.length) setStatus(`⚠ ${lostMedia.length} media file(s) will not be preserved: ${lostMedia.slice(0, 2).join(', ')}`)
    const mmeText = genMME(pages, stage, { presentationAudio, projectVars })
    if (desktopApi?.saveMme) {
      const result = await desktopApi.saveMme({
        defaultName: filename.endsWith('.mme') ? filename : 'script.mme',
        text: mmeText,
      })
      if (!result?.canceled) {
        const savedName = result.fileName || filename
        setFilename(savedName)
        setStatus(`Saved: ${savedName}`)
        try {
          localStorage.setItem('mme_lastSave', mmeText)
          localStorage.setItem('mme_lastSaveName', savedName)
          // Keep lastOpened in sync with the latest explicit save so restarts always
          // load this version regardless of which file was last opened via Open dialog.
          localStorage.setItem('mme_lastOpened', mmeText)
          localStorage.setItem('mme_lastOpenedName', savedName)
        } catch { /* quota exceeded — skip */ }
        return true
      }
      setStatus('Save canceled')
      return false
    }

    toBlobDownload(mmeText, filename.endsWith('.mme') ? filename : 'script.mme')
    try {
      const blobSaveName = filename.endsWith('.mme') ? filename : 'script.mme'
      localStorage.setItem('mme_lastSave', mmeText)
      localStorage.setItem('mme_lastSaveName', blobSaveName)
      localStorage.setItem('mme_lastOpened', mmeText)
      localStorage.setItem('mme_lastOpenedName', blobSaveName)
    } catch { /* quota exceeded — skip */ }
    setStatus('Saved')
    return true
  }

  async function onExportScreenPng() {
    const isDesktop = typeof window.smmDesktop !== 'undefined'
    if (isDesktop) {
      const r = await window.smmDesktop.capturePage({ title: 'Save Screen Snapshot', defaultName: 'screen-snapshot.png' })
      if (r?.ok) setStatus(`Screenshot saved: ${r.filePath}`)
      else if (!r?.canceled) setStatus(`Screenshot failed: ${r?.error || 'unknown'}`)
    } else {
      setStatus('Screen capture requires the desktop app')
    }
  }

  async function onExportPagePng() {
    const page = pages[cur]
    if (!page) return
    try {
      // Render canvas-only (no toolbars) at full stage resolution
      const dataUrl = await renderRegionToDataUrl(0, 0, stageWidth, stageHeight)
      const defaultName = `page-${cur + 1}-${page.name || 'untitled'}.png`.replace(/[^\w.-]/g, '_')
      if (window.smmDesktop?.savePng) {
        const r = await window.smmDesktop.savePng(dataUrl, { title: `Save Page ${cur + 1} as PNG`, defaultName })
        if (r?.ok) setStatus(`Page PNG saved: ${r.filePath}`)
        else if (!r?.canceled) setStatus(`Export failed: ${r?.error || 'unknown'}`)
      } else {
        // Browser fallback — trigger download
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = defaultName
        a.click()
      }
    } catch (err) {
      setStatus(`Export error: ${err.message}`)
    }
  }

  function onExportScript() {
    void onSave()
    setStatus('Script exported')
  }

  function onExportHtml() {
    if (!pages.length) {
      setStatus('Nothing to export')
      return false
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>SMM Presentation</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#000;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}#s{position:relative;width:${stageWidth}px;height:${stageHeight}px;overflow:hidden;transform-origin:center center;transform:scale(var(--sc,1))}.p{position:absolute;inset:0;opacity:0;pointer-events:none}.p.on{opacity:1;pointer-events:auto}.e{position:absolute}.t{display:flex;align-items:center}.b{display:flex;align-items:center;justify-content:center;cursor:pointer}</style></head><body><div id="s"></div><script>const SW=${stageWidth},SH=${stageHeight};function scaleStage(){const sc=Math.min(window.innerWidth/SW,window.innerHeight/SH);document.documentElement.style.setProperty('--sc',sc)}window.addEventListener('resize',scaleStage);scaleStage();const pages=${JSON.stringify(
      pages,
    )};const s=document.getElementById('s');let cur=0;function esc(x){return String(x||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}function draw(){s.innerHTML='';pages.forEach((p,i)=>{const d=document.createElement('div');d.className='p'+(i===cur?' on':'');d.style.background=p.bgColor||'#000';(p.elements||[]).sort((a,b)=>a.z-b.z).forEach(el=>{if(el.visible===false)return;const n=document.createElement(el.type==='button'?'button':'div');n.className='e '+(el.type==='text'?'t':el.type==='button'?'b':'');n.style.left=el.x+'px';n.style.top=el.y+'px';n.style.width=el.w+'px';n.style.height=el.h+'px';if(el.type==='text'){n.style.font='700 '+(el.size||36)+'px Rajdhani,sans-serif';n.style.color=el.color||'#e8a020';n.textContent=el.content||''}if(el.type==='clip'||el.type==='mpeg'){const mf=el.file&&!/^blob:/i.test(el.file)?el.file:'';const mk=el.mediaKind||'image';if(mf){if(mk==='video'||el.type==='mpeg'){const v=document.createElement('video');v.src=mf;v.style.width='100%';v.style.height='100%';v.style.objectFit='contain';v.autoplay=true;v.loop=true;v.muted=true;n.appendChild(v)}else if(mk==='audio'){const a=document.createElement('audio');a.src=mf;a.autoplay=true;a.loop=true;n.appendChild(a)}else{const img=document.createElement('img');img.src=mf;img.style.width='100%';img.style.height='100%';img.style.objectFit='contain';img.style.opacity=((el.opacity||100)/100).toString();n.appendChild(img)}}else{n.style.border='1px dashed rgba(74,143,192,.35)'}}if(el.type==='button'){n.textContent=el.label||'Button';n.style.background=el.bgColor||'#1a3a5c';n.style.color=el.fgColor||'#e8a020';n.style.border=(el.borderWidth||2)+'px solid '+(el.borderColor||'#4a8fc0');n.onclick=()=>{if(el.action==='next')cur=Math.min(cur+1,pages.length-1);if(el.action==='goto'){const idx=pages.findIndex(x=>x.name===el.target);if(idx>=0)cur=idx}if(el.action==='quit')cur=pages.length;draw()}}d.appendChild(n)});s.appendChild(d)});if(cur>=pages.length){document.body.innerHTML='<div style="color:#aaa;font:14px monospace">Presentation ended</div>'}}draw();document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){cur=Math.min(cur+1,pages.length-1);draw()}if(e.key==='ArrowLeft'){cur=Math.max(cur-1,0);draw()}});</script></body></html>`
    toBlobDownload(html, 'presentation.html', 'text/html')
    setStatus('Exported presentation.html')
    return true
  }

  /* ── PDF → Storybook import ───────────────────────────────────────────── */
  async function importPdfAsStorybook(pdfFile, password = '') {
    setStatus('Loading PDF library…')
    setPdfImportProgress({ page: 0, total: 0, msg: 'Loading PDF…' })
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()

      const arrayBuffer = await pdfFile.arrayBuffer()
      const loadParams = { data: arrayBuffer }
      if (password) loadParams.password = password

      const pdf = await pdfjsLib.getDocument(loadParams).promise
      const totalPages = pdf.numPages
      setPdfImportProgress({ page: 0, total: totalPages, msg: `Rendering ${totalPages} pages…` })

      const scale = 2.0 // render at 2× for crisp output
      const newPages = /** @type {import('./types/desktop-api').SmmPage[]} */ ([])

      for (let i = 1; i <= totalPages; i++) {
        setPdfImportProgress({ page: i, total: totalPages, msg: `Rendering page ${i} of ${totalPages}…` })
        const pdfPage = await pdf.getPage(i)
        const viewport = pdfPage.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const ctx = canvas.getContext('2d')
        await pdfPage.render({ canvasContext: ctx, viewport }).promise
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88)

        // Each PDF page becomes a storybook spread with the page as the BG image
        const pageName = totalPages === 1 ? 'Cover' : i === 1 ? 'Cover' : `Spread ${i - 1}`
        const pg = {
          ...makePage(pageName),
          bgMediaSrc: dataUrl,
          bgMediaName: `page_${i}.jpg`,
          bgMediaKind: 'image',
          bgMediaTransition: 'none',
          wipeIn: 'PageFlip',
          wipeOut: 'PageFlip',
          narration: { file: '', name: '', autoPlay: true },
          elements: [],
        }

        // Add nav buttons on all but single-page docs
        if (totalPages > 1) {
          const navL = {
            ...makeElem('button', 20, stageHeight - 70, 140, 50),
            label: '‹ Back', action: 'prev',
            bgColor: 'rgba(0,0,0,0.5)', fgColor: '#fff',
            borderColor: 'rgba(255,255,255,0.3)', borderWidth: 2,
            radius: '25px', fontSize: 15, font: 'Baloo 2', fontWeight: '700',
          }
          const navR = {
            ...makeElem('button', stageWidth - 160, stageHeight - 70, 140, 50),
            label: i < totalPages ? 'Next ›' : '⟳ Start', action: i < totalPages ? 'next' : 'goto', target: pageName === 'Cover' ? '' : 'Cover',
            bgColor: 'rgba(0,0,0,0.5)', fgColor: '#fff',
            borderColor: 'rgba(255,255,255,0.3)', borderWidth: 2,
            radius: '25px', fontSize: 15, font: 'Baloo 2', fontWeight: '700',
          }
          if (i > 1) pg.elements.push(navL)
          pg.elements.push(navR)
        }

        newPages.push(pg)
      }

      // Append PDF pages after the last existing page (preserve current script)
      setPages(prev => {
        const insertAt = prev.length
        // If starting from scratch (no pages), also set stage preset to match PDF aspect ratio
        if (insertAt === 0) {
          pdf.getPage(1).then(firstPdfPage => {
            const vp = firstPdfPage.getViewport({ scale: 1 })
            const ar = vp.width / vp.height
            setStagePreset(ar > 1.3 ? 'book_lt_1700x1100' : 'book_a4_1684x1190')
            setProjectType('storybook')
          })
          setCur(0)
        } else {
          setCur(insertAt)
        }
        return [...prev, ...newPages]
      })
      setPdfImportProgress(null)
      setStatus(`📖 Imported PDF: ${totalPages} page${totalPages !== 1 ? 's' : ''} appended as storybook spreads`)
      requestAnimationFrame(() => fitToWindow())
    } catch (err) {
      setPdfImportProgress(null)
      setStatus(`PDF import failed: ${err.message}`)
      console.error('PDF import error:', err)
    }
  }

  /* ── Storybook PWA export ────────────────────────────────────────────── */
  async function exportStorybookPwa(password = '') {
    if (!pages.length) { setStatus('Nothing to export'); return }
    setStatus('Building storybook export…')

    try {
      const JSZip = (await import('jszip')).default
      // Resolve all HTTP/blob media server URLs → data: before building the ZIP
      const resolvedPages = await resolveMediaForExport(pages, (d, t) => setStatus(`Resolving media ${d}/${t}…`))
      const zip = new JSZip()
      const bookTitle = filename.replace(/\.mme$/i, '') || 'My Storybook'

      // Build pages data (strip large data URLs into separate asset files)
      const assets = {}
      const exportPages = resolvedPages.map((pg, pi) => {
        const pgOut = { ...pg }
        // Extract BG media to separate asset
        if (pg.bgMediaSrc && pg.bgMediaSrc.startsWith('data:')) {
          const assetKey = `assets/bg_${pi}.jpg`
          assets[assetKey] = pg.bgMediaSrc
          pgOut.bgMediaSrc = assetKey
        }
        // Extract narration audio (use correct extension from filename)
        if (pg.narration?.file && pg.narration.file.startsWith('data:')) {
          const narExt = pg.narration.name?.match(/\.(\w+)$/i)?.[1]?.toLowerCase() || 'mp3'
          const assetKey = `assets/narration_${pi}.${narExt}`
          assets[assetKey] = pg.narration.file
          pgOut.narration = { ...pg.narration, file: assetKey }
        }
        // Extract element media
        pgOut.elements = (pg.elements || []).map((el, ei) => {
          const elOut = { ...el }
          if (el.file && el.file.startsWith('data:')) {
            const ext = el.mediaKind === 'video' ? 'mp4' : el.mediaKind === 'audio' ? 'mp3' : 'jpg'
            const assetKey = `assets/el_${pi}_${ei}.${ext}`
            assets[assetKey] = el.file
            elOut.file = assetKey
          }
          return elOut
        })
        return pgOut
      })

      // Convert data URLs to binary for zip
      function dataUrlToUint8(dataUrl) {
        const base64 = dataUrl.split(',')[1]
        const bin = atob(base64)
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        return arr
      }

      Object.entries(assets).forEach(([key, dataUrl]) => {
        zip.file(key, dataUrlToUint8(dataUrl))
      })

      const bookData = { title: bookTitle, width: stageWidth, height: stageHeight, pages: exportPages }
      let bookJson = JSON.stringify(bookData)

      // Encrypt if password provided
      let encrypted = false
      if (password) {
        const enc = new TextEncoder()
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false, ['encrypt'],
        )
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(bookJson))
        // Pack: 16 salt + 12 iv + ciphertext
        const packed = new Uint8Array(16 + 12 + ciphertext.byteLength)
        packed.set(salt, 0); packed.set(iv, 16); packed.set(new Uint8Array(ciphertext), 28)
        bookJson = btoa(String.fromCharCode(...packed))
        encrypted = true
      }

      zip.file('book.json', bookJson)

      // Generate the HTML player
      const playerHtml = buildStorybookPlayerHtml(bookTitle, stageWidth, stageHeight, encrypted, bookJson)
      zip.file('index.html', playerHtml)

      // PWA manifest
      zip.file('manifest.json', JSON.stringify({
        name: bookTitle,
        short_name: bookTitle.slice(0, 12),
        display: 'standalone',
        orientation: 'landscape',
        start_url: './index.html',
        background_color: '#0a1a2a',
        theme_color: '#1a3a6c',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      }, null, 2))

      // Service worker
      zip.file('sw.js', buildServiceWorker())

      // Simple placeholder icons (blue square — user can replace)
      zip.file('icon-192.png', dataUrlToUint8(buildPlaceholderIcon(192)))
      zip.file('icon-512.png', dataUrlToUint8(buildPlaceholderIcon(512)))

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      const outName = `${bookTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_storybook.zip`
      const _zipHref = URL.createObjectURL(blob)
      const _zipA = document.createElement('a'); _zipA.href = _zipHref; _zipA.download = outName; _zipA.click()
      URL.revokeObjectURL(_zipHref)
      setStatus(`📖 Exported: ${outName}  (${(blob.size / 1048576).toFixed(1)} MB)`)
    } catch (err) {
      setStatus(`Export failed: ${err.message}`)
      console.error('Storybook export error:', err)
    }
  }

  function buildPlaceholderIcon(size) {
    const c = document.createElement('canvas'); c.width = size; c.height = size
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#1a3a6c'; ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#ffe080'; ctx.font = `bold ${size * 0.4}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('📖', size / 2, size / 2)
    return c.toDataURL('image/png')
  }

  function buildServiceWorker() {
    return `const CACHE='sb-v1';const ASSETS=['./','./index.html','./book.json','./manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));`
  }

  function buildStorybookPlayerHtml(title, sw, sh, encrypted, bookDataStr) {
    // Encode book data for safe inline embedding — avoids fetch() failing on file:// protocol
    const encodeForEmbed = (str) => {
      const bytes = new TextEncoder().encode(str)
      let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      return btoa(bin)
    }
    const inlineB64 = encrypted ? bookDataStr : encodeForEmbed(bookDataStr)
    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>${title}</title>
<link rel="manifest" href="manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0a;display:flex;flex-direction:column;height:100vh;overflow:hidden;font-family:'Baloo 2',Segoe UI,sans-serif;touch-action:none}
#pw-gate{position:fixed;inset:0;background:#0a1a2a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;z-index:999}
#pw-gate h2{color:#ffe080;font-size:28px}
#pw-gate input{padding:12px 20px;font-size:18px;border-radius:30px;border:2px solid #ffe080;background:#0f2540;color:#fff;width:260px;text-align:center;outline:none}
#pw-gate button{padding:12px 36px;font-size:18px;border-radius:30px;border:none;background:#ffe080;color:#0a1a2a;cursor:pointer;font-weight:700}
#pw-gate .err{color:#ff6060;font-size:14px}
#book-wrap{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;perspective:2400px}
#stage{position:relative;flex-shrink:0;transform-origin:center center;transform:scale(var(--sc,1));transition:none;width:${sw}px;height:${sh}px}
.pg{position:absolute;inset:0;display:none;backface-visibility:hidden;transform-origin:center center}
.pg.active{display:block}
.pg.flip-out{display:block;animation:flipOut 0.5s ease-in forwards}
.pg.flip-in{display:block;animation:flipIn 0.5s ease-out forwards}
@keyframes flipOut{from{transform:rotateY(0)}to{transform:rotateY(-90deg)}}
@keyframes flipIn{from{transform:rotateY(90deg)}to{transform:rotateY(0)}}
.el{position:absolute}
.el-text{display:flex;align-items:center;white-space:pre-wrap;word-break:break-word}
.el-btn{display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;transition:opacity 0.12s,transform 0.1s}
.el-btn:hover{opacity:0.85;transform:scale(1.04)}
.el-btn:active{transform:scale(0.97)}
.el-img img{width:100%;height:100%;object-fit:contain}
#controls{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:14px;z-index:50;align-items:center}
#controls button{background:rgba(0,0,0,0.55);color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:22px;padding:8px 22px;font-size:15px;cursor:pointer;backdrop-filter:blur(6px)}
#controls button:hover{background:rgba(255,255,255,0.18)}
#pg-indicator{color:rgba(255,255,255,0.55);font-size:13px;min-width:48px;text-align:center}
#narration-bar{position:fixed;bottom:68px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);border-radius:30px;padding:6px 18px;display:flex;align-items:center;gap:10px;color:#fff;font-size:14px;backdrop-filter:blur(8px);opacity:0;transition:opacity 0.3s;pointer-events:none}
#narration-bar.visible{opacity:1;pointer-events:auto}
#narration-bar button{background:none;border:none;color:#ffe080;font-size:18px;cursor:pointer;padding:4px}
</style>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;700&display=swap" rel="stylesheet">
</head><body>
${encrypted ? `<div id="pw-gate"><h2>📖 ${title}</h2><p style="color:#c0d8f0">Enter password to open</p><input id="pw-inp" type="password" placeholder="Password…" autofocus><button onclick="unlockBook()">Open Book</button><div class="err" id="pw-err"></div></div>` : ''}
<div id="book-wrap"><div id="stage"></div></div>
<div id="narration-bar"><button id="nar-btn" title="Play/Pause narration">🔊</button><span id="nar-name">Narration</span></div>
<div id="controls">
  <button onclick="navigate(-1)">‹</button>
  <span id="pg-indicator">1/1</span>
  <button onclick="navigate(1)">›</button>
</div>
<audio id="narration-audio" preload="auto"></audio>
<script>
const IS_ENC=${encrypted};
const BOOK_B64='${inlineB64}';
let BOOK=null,cur=0;
const stage=document.getElementById('stage');
const narAudio=document.getElementById('narration-audio');
const narBar=document.getElementById('narration-bar');
const narBtn=document.getElementById('nar-btn');
const narName=document.getElementById('nar-name');

function scaleStage(){const sw=${sw},sh=${sh};const bw=document.getElementById('book-wrap');const s=Math.min((bw?bw.clientWidth:window.innerWidth)/sw,(bw?bw.clientHeight:window.innerHeight)/sh);document.documentElement.style.setProperty('--sc',s)}
window.addEventListener('resize',scaleStage);scaleStage();

async function unlockBook(){
  const pw=document.getElementById('pw-inp').value;
  const err=document.getElementById('pw-err');
  err.textContent='';
  try{
    const b64=BOOK_B64;
    const bin=atob(b64);const buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    const salt=buf.slice(0,16),iv=buf.slice(16,28),ct=buf.slice(28);
    const enc=new TextEncoder();
    const km=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
    BOOK=JSON.parse(new TextDecoder().decode(plain));
    document.getElementById('pw-gate').remove();
    initBook();
  }catch(e){err.textContent='Incorrect password. Try again.'}
}

function loadBook(){
  if(IS_ENC)return;
  const bytes=Uint8Array.from(atob(BOOK_B64),c=>c.charCodeAt(0));
  BOOK=JSON.parse(new TextDecoder().decode(bytes));initBook();
}

function initBook(){cur=0;drawPage(0,null);}

function drawPage(idx,dir){
  const pg=BOOK.pages[idx];if(!pg)return;
  const old=stage.querySelector('.pg.active');
  const div=document.createElement('div');div.className='pg';
  div.style.background=pg.bgColor||'#000';
  if(pg.bgMediaSrc){const im=document.createElement('img');im.src=pg.bgMediaSrc;im.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover';div.appendChild(im)}
  (pg.elements||[]).sort((a,b)=>a.z-b.z).forEach(el=>{if(el.visible===false)return;renderEl(el,div,pg)});
  stage.appendChild(div);
  if(old&&dir){
    old.classList.add('flip-out');div.classList.add('flip-in');
    setTimeout(()=>{old.remove();div.classList.remove('flip-in');div.classList.add('active')},520);
  }else{if(old)old.remove();div.classList.add('active')}
  document.getElementById('pg-indicator').textContent=(idx+1)+'/'+BOOK.pages.length;
  playNarration(pg);
  cur=idx;
  // Touch/swipe
  let tx=null;
  div.addEventListener('touchstart',e=>{tx=e.touches[0].clientX},{passive:true});
  div.addEventListener('touchend',e=>{if(tx===null)return;const dx=e.changedTouches[0].clientX-tx;if(Math.abs(dx)>40)navigate(dx<0?1:-1);tx=null;});
}

function renderEl(el,parent,pg){
  let n;
  if(el.type==='button'){n=document.createElement('button');n.className='el el-btn';n.textContent=el.label||'';n.style.cssText=\`left:\${el.x}px;top:\${el.y}px;width:\${el.w}px;height:\${el.h}px;font-size:\${el.fontSize||16}px;font-family:'\${el.font||"Baloo 2"}',sans-serif;font-weight:\${el.fontWeight||'700'};background:\${el.bgColor||'transparent'};color:\${el.fgColor||'#fff'};border:\${el.borderWidth||0}px solid \${el.borderColor||'transparent'};border-radius:\${el.radius||'0'}\`;
    n.addEventListener('click',()=>handleAction(el,pg));
  }else if(el.type==='text'){n=document.createElement('div');n.className='el el-text';n.style.cssText=\`left:\${el.x}px;top:\${el.y}px;width:\${el.w}px;height:\${el.h}px;font-size:\${el.size||24}px;font-family:'\${el.font||"Baloo 2"}',sans-serif;font-weight:\${el.weight||'400'};color:\${el.color||'#fff'};text-align:\${el.align||'left'};white-space:pre-wrap\`;n.textContent=el.content||'';
  }else if(el.type==='clip'&&el.file){n=document.createElement('div');n.className='el el-img';n.style.cssText=\`left:\${el.x}px;top:\${el.y}px;width:\${el.w}px;height:\${el.h}px\`;const im=document.createElement('img');im.src=el.file;im.style.cssText='width:100%;height:100%;object-fit:contain';n.appendChild(im);
  }else return;
  parent.appendChild(n);
}

function handleAction(el,pg){
  if(el.action==='next')navigate(1);
  else if(el.action==='prev')navigate(-1);
  else if(el.action==='goto'){const i=BOOK.pages.findIndex(p=>p.name===el.target);if(i>=0)drawPage(i,'next')}
  else if(el.action==='event'&&el.elLabel==='narration-btn'){toggleNarration()}
  if(el.audioEvent){const a=new Audio(el.audioEvent);a.play().catch(()=>{})}
}

function navigate(dir){const next=Math.max(0,Math.min(BOOK.pages.length-1,cur+dir));if(next!==cur)drawPage(next,dir>0?'next':'prev')}

function playNarration(pg){
  if(!pg.narration||!pg.narration.file){narBar.classList.remove('visible');narAudio.src='';return}
  narAudio.src=pg.narration.file;narName.textContent=pg.narration.name||'Narration';narBar.classList.add('visible');
  if(pg.narration.autoPlay!==false){narAudio.play().catch(()=>{})}
}
function toggleNarration(){narAudio.paused?narAudio.play().catch(()=>{}):narAudio.pause();narBtn.textContent=narAudio.paused?'🔊':'⏸'}
narBtn.addEventListener('click',toggleNarration);

document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')navigate(1);if(e.key==='ArrowLeft')navigate(-1)});

if(IS_ENC){document.getElementById('pw-inp').addEventListener('keydown',e=>{if(e.key==='Enter')unlockBook()})}
else{loadBook()}

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
</script>
</body></html>`
  }

  function importFromScriptView() {
    void applyParsedScript(scriptText, filename).then((ok) => {
      if (ok) setScriptMode(false)
    })
  }

  async function chooseMedia(target, category = 'image', elementId = null, cleanupOnFailure = false) {
    const pageIndexAtInvoke = cur
    const selectedIdAtInvoke = elementId || selectedEl?.id || selId || null

    const removeElementIfNeeded = (id) => {
      if (!cleanupOnFailure || !id) return
      setPages((prev) =>
        prev.map((pg, i) =>
          i === pageIndexAtInvoke ? { ...pg, elements: pg.elements.filter((el) => el.id !== id) } : pg,
        ),
      )
      setSelId(null)
    }

    const bindElementMedia = (fileUrl, fileName, mediaKindHint = null, capability = null, sourcePath = null) => {
      const id = selectedIdAtInvoke
      if (!id) {
        setStatus('Select an element first')
        logMediaEvent('bind failed: no selected element')
        removeElementIfNeeded(elementId)
        return false
      }

      const detectedKind = mediaKindHint || (category === 'all' ? detectMediaKind(fileName || fileUrl) : category)
      const capabilityInfo = capability || inferMediaCapability(fileName || fileUrl, detectedKind)
      const extension = capabilityInfo?.extension || getMediaExtension(fileName || fileUrl) || ''
      // Only store native filesystem paths as source — not blob/data/app-media URLs
      const resolvedSourcePath = sourcePath && !isTempUrl(sourcePath) && !String(sourcePath).startsWith('data:')
        ? sourcePath
        : null

      const sourcePages = Array.isArray(pagesRef.current) ? pagesRef.current : []
      let found = false
      const nextPages = sourcePages.map((pg, i) => {
        if (i !== pageIndexAtInvoke) return pg
        return {
          ...pg,
          elements: (pg.elements || []).map((el) => {
            if (el.id !== id) return el
            found = true
            return {
              ...el,
              file: fileUrl,
              mediaName: fileName || el.mediaName || '',
              mediaSourcePath: resolvedSourcePath ?? el.mediaSourcePath ?? null,
              mediaKind: detectedKind,
              mediaExt: extension,
              mediaSupport: capabilityInfo?.support || 'unknown',
              mediaReason: capabilityInfo?.reason || '',
              mediaOutputHint: capabilityInfo?.outputHint || '',
            }
          }),
        }
      })

      if (!found) {
        setStatus('Selected element not found')
        logMediaEvent(`bind failed: element not found (${id})`)
        removeElementIfNeeded(id)
        return false
      }

      pagesRef.current = nextPages
      setPages(nextPages)
      setSelId(id)
      if (capabilityInfo?.support === 'native') {
        setStatus(`Media linked: ${fileName || 'file'}`)
      } else if (capabilityInfo?.support === 'convert-required' || capabilityInfo?.support === 'partial') {
        const hint = capabilityInfo?.outputHint ? ` Convert to ${capabilityInfo.outputHint}.` : ''
        setStatus(`Media linked with warning: ${fileName || 'file'} (${capabilityInfo.support}).${hint}`)
      } else {
        setStatus(`Media linked but unsupported format: ${fileName || 'file'}`)
      }
      logMediaEvent(`media linked: ${fileName || 'file'} support=${capabilityInfo?.support || 'unknown'}`)
      return true
    }

    const resolveCapability = async (filePath, fileName, kindHint) => {
      if (desktopApi?.mediaCapability && (filePath || fileName)) {
        try {
          const cap = await desktopApi.mediaCapability({ filePath, fileName })
          if (cap) return cap
        } catch {
          return inferMediaCapability(fileName || filePath, kindHint)
        }
      }
      return inferMediaCapability(fileName || filePath, kindHint)
    }

    // processNativePath: given a known native filesystem path + filename, build the URL
    // and transcode if needed. Used by both native-dialog and browser-input code paths.
    const processNativePath = async (rawPath, sourceName, resolve) => {
      const kind = category === 'all' ? detectMediaKind(sourceName || rawPath) : category
      let capability = await resolveCapability(rawPath, sourceName, kind)
      let sourcePath = rawPath
      let url = ''

      if (
        desktopApi?.transcodeMedia &&
        (capability?.support === 'convert-required' || capability?.support === 'partial')
      ) {
        setStatus(`Converting: ${sourceName}…`)
        const transcode = await desktopApi.transcodeMedia({
          filePath: rawPath,
          category: capability.category || kind,
          support: capability.support,
          extension: capability.extension,
        })

        if (transcode?.ok && transcode.convertedPath) {
          const convertedPath = transcode.convertedPath
          const convertedKind = detectMediaKind(convertedPath)
          sourcePath = convertedPath
          sourceName = convertedPath.split(/[/\\]/).pop() || sourceName
          capability = {
            ...capability,
            support: 'native',
            reason: `Converted to ${transcode.outputHint || 'runtime format'}`,
            outputHint: transcode.outputHint || null,
            extension: getMediaExtension(convertedPath),
            category: convertedKind,
          }
          logMediaEvent(`transcode success: ${rawPath.split(/[/\\]/).pop()} -> ${sourceName}`)
          url = makeAppMediaUrl(convertedPath)
        } else if (capability?.support === 'convert-required') {
          setStatus(`Media conversion failed: ${sourceName}. ${transcode?.reason || ''}`)
          logMediaEvent(`conversion failed: ${sourceName} reason=${transcode?.reason || 'unknown'}`)
          removeElementIfNeeded(elementId)
          resolve(false)
          return null
        } else {
          logMediaEvent(`transcode warning: ${sourceName} reason=${transcode?.reason || 'unknown'}`)
        }
      }

      const inlineCategory = capability?.category || kind

      // Video, audio and PDF: serve via local HTTP media server (range-request capable, survives save/reload)
      if (!url && sourcePath && (inlineCategory === 'video' || inlineCategory === 'audio' || inlineCategory === 'pdf')) {
        url = makeAppMediaUrl(sourcePath)
      }

      // Images: read as data URL for inline display (no dependency on external file at runtime)
      if (!url && sourcePath && desktopApi?.readMediaDataUrl && inlineCategory === 'image') {
        const loaded = await desktopApi.readMediaDataUrl({ filePath: sourcePath, category: inlineCategory })
        if (loaded?.ok && loaded.dataUrl) url = loaded.dataUrl
      }

      return { url, sourceName, sourcePath, capability, inlineCategory }
    }

    // Apply a resolved media URL to the appropriate target (page bg, audio event, or element).
    const resolveTarget = (url, finalName, inlineCategory, capability, sourcePath, resolve) => {
      if (target === 'bg') {
        // Store native source path for SCA persistence; bgMediaSrc = the playable URL
        const bgSourcePath = sourcePath && !isTempUrl(sourcePath) ? sourcePath : null
        setPages((prev) => prev.map((pg, i) => i === pageIndexAtInvoke ? {
          ...pg,
          bgImage: url,
          bgMediaSrc: url,
          bgMediaName: finalName,
          bgMediaKind: inlineCategory || 'image',
          bgMediaSourcePath: bgSourcePath || pg.bgMediaSourcePath || '',
        } : pg))
        setStatus(`Background set: ${finalName}`)
        logMediaEvent(`background media linked: ${finalName}`)
        resolve(true)
        return
      }

      if (target === 'audioEvent') {
        const id = selectedIdAtInvoke
        if (!id) { setStatus('Select an element first'); resolve(false); return }
        const sourcePages = Array.isArray(pagesRef.current) ? pagesRef.current : []
        let found = false
        const nextPages = sourcePages.map((pg, i) => {
          if (i !== pageIndexAtInvoke) return pg
          return {
            ...pg,
            elements: (pg.elements || []).map((el) => {
              if (el.id !== id) return el
              found = true
              return { ...el, audioEvent: url, audioEventName: finalName }
            }),
          }
        })
        if (!found) { setStatus('Element not found'); resolve(false); return }
        pagesRef.current = nextPages
        setPages(nextPages)
        setSelId(id)
        setStatus(`Audio event set: ${finalName}`)
        logMediaEvent(`audio event attached: ${finalName}`)
        resolve(true)
        return
      }

      resolve(bindElementMedia(url, finalName, inlineCategory, capability, sourcePath))
    }


    // Fall back to the browser <input type="file"> only when the desktop API is not available (web mode).
    const chooseViaInput = () =>
      new Promise((resolve) => {
        if (desktopApi?.selectMedia) {
          // Native dialog path — single dialog, path always available
          const dialogCategory = category === 'all' ? 'all' : category
          desktopApi.selectMedia({ category: dialogCategory }).then(async (pick) => {
            if (pick?.canceled || !pick?.filePath) {
              setStatus('Media selection canceled')
              logMediaEvent('media picker canceled')
              removeElementIfNeeded(elementId)
              resolve(false)
              return
            }

            const rawPath = String(pick.filePath)
            const sourceName = pick.fileName || rawPath.split(/[/\\]/).pop() || 'media'
            const result = await processNativePath(rawPath, sourceName, resolve)
            if (!result) return  // processNativePath already called resolve(false)

            const { url, sourceName: finalName, sourcePath, capability, inlineCategory } = result
            if (!url) {
              setStatus(`Media import failed: ${finalName}`)
              logMediaEvent(`media import failed: no URL for ${finalName}`)
              removeElementIfNeeded(elementId)
              resolve(false)
              return
            }
            resolveTarget(url, finalName, inlineCategory, capability, sourcePath, resolve)
          }).catch((err) => {
            setStatus(`Media import error: ${err?.message || err}`)
            logMediaEvent(`media import exception: ${err?.message || err}`)
            removeElementIfNeeded(elementId)
            resolve(false)
          })
          return
        }

        // Browser file input fallback (non-Electron / web mode)
        if (!imgRef.current) {
          setStatus('Media picker unavailable')
          logMediaEvent('media picker unavailable')
          resolve(false)
          return
        }

        imgRef.current.value = ''
        imgRef.current.onchange = async (e) => {
          const inp = /** @type {HTMLInputElement} */(e.target)
          const f = inp.files?.[0]
          if (!f) {
            setStatus('Media selection canceled')
            logMediaEvent('media picker canceled')
            removeElementIfNeeded(elementId)
            resolve(false)
            return
          }

          const rawPath = typeof f.path === 'string' ? f.path : ''
          const sourceName = f.name
          let url = ''

          if (rawPath) {
            // Has native path (packaged Electron or Electron with file:// origin)
            const result = await processNativePath(rawPath, sourceName, resolve)
            if (!result) return
            if (!result.url) {
              setStatus(`Media import failed: ${sourceName}`)
              logMediaEvent(`media import failed: no URL for ${sourceName}`)
              removeElementIfNeeded(elementId)
              resolve(false)
              return
            }
            resolveTarget(result.url, result.sourceName, result.inlineCategory, result.capability, result.sourcePath, resolve)
            return
          }

          // No native path: use blob URL as last resort (session-only, will not persist after save/reload)
          const kind = category === 'all' ? detectMediaKind(f.name) : category
          const capability = inferMediaCapability(f.name, kind)
          logMediaEvent(`browser-only import (no native path): ${f.name}`)
          try {
            url = URL.createObjectURL(f)
          } catch {
            setStatus(`Media import failed: ${f.name}`)
            resolve(false)
            return
          }

          const inlineCategory = kind
          const sourcePath = null

          if (!url) {
            setStatus(`Media import failed: ${f.name}`)
            logMediaEvent(`media import failed: no URL for ${f.name}`)
            removeElementIfNeeded(elementId)
            resolve(false)
            return
          }

          resolveTarget(url, sourceName, inlineCategory, capability, sourcePath, resolve)
        }

        imgRef.current.accept =
          category === 'all'
            ? '.bmp,.gif,.jpg,.jpeg,.png,.webp,.avif,.svg,.tif,.tiff,.ico,.pdf,.flc,.fli,.wav,.mid,.midi,.mp3,.ogg,.flac,.aac,.m4a,.opus,.mp4,.m4v,.webm,.mov,.avi,.mkv,.wmv,.mpeg,.mpg,.ts,.m2ts'
            : category === 'video'
              ? 'video/*,.flc,.fli,.avi,.mkv,.wmv,.mpeg,.mpg,.ts,.m2ts'
              : category === 'audio'
                ? 'audio/*,.mid,.midi'
                : 'image/*,.pdf'
        imgRef.current.click()
      })

    const picked = await chooseViaInput()
    if (!picked) {
      removeElementIfNeeded(elementId)
    }
    return picked
  }

  async function exportMediaDiagnosticsReport() {
    const lines = []
    lines.push('FluxAura Studio Media Diagnostics')
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push(`Stage preset: ${stagePreset}`)
    lines.push(`Total pages: ${pages.length}`)
    lines.push('')
    lines.push('Backends:')
    lines.push(`- ffmpeg-static: ${mediaBackends?.ffmpegStatic?.available ? 'available' : 'missing'}`)
    lines.push(`  detail: ${mediaBackends?.ffmpegStatic?.detail || 'n/a'}`)
    lines.push(`- ffmpeg: ${mediaBackends?.ffmpeg?.available ? 'available' : 'missing'}`)
    lines.push(`  detail: ${mediaBackends?.ffmpeg?.detail || 'n/a'}`)
    lines.push(`- timidity: ${mediaBackends?.timidity?.available ? 'available' : 'missing'}`)
    lines.push(`  detail: ${mediaBackends?.timidity?.detail || 'n/a'}`)
    lines.push('')
    lines.push('Media cache:')
    lines.push(`- status: ${mediaCacheInfo?.ok ? 'available' : 'unavailable'}`)
    lines.push(`- files: ${mediaCacheInfo?.files ?? 0}`)
    lines.push(`- size: ${formatBytes(mediaCacheInfo?.bytes || 0)}`)
    if (mediaCacheInfo?.cachePath) lines.push(`- path: ${mediaCacheInfo.cachePath}`)
    if (mediaCacheInfo?.reason) lines.push(`- reason: ${mediaCacheInfo.reason}`)
    lines.push('')
    lines.push('Recent media events:')
    if (!mediaEvents.length) {
      lines.push('- none')
    } else {
      mediaEvents.forEach((entry) => lines.push(`- ${entry}`))
    }
    lines.push('')

    pages.forEach((pg, pageIndex) => {
      lines.push(`Page ${pageIndex + 1}: ${pg.name}`)
      // Show page-level background media
      if (pg.bgMediaName || pg.bgMediaSrc || pg.bgMediaSourcePath) {
        const bgSrc = String(pg.bgMediaSrc || '')
        const bgSrcType = !bgSrc ? 'none'
          : bgSrc.startsWith('data:') ? `data-url(${bgSrc.length}b)`
          : /^http:\/\/127\.0\.0\.1:\d+\//.test(bgSrc) ? `http-server(${bgSrc.length}b)`
          : bgSrc.startsWith('blob:') ? 'blob-url(session-only)'
          : `path(${bgSrc.length}b)`
        const spRaw = pg.bgMediaSourcePath || ''
        const spShort = spRaw.length > 45 ? '…' + spRaw.slice(-44) : spRaw
        lines.push(`- [bg] name=${pg.bgMediaName || '—'} kind=${pg.bgMediaKind || 'image'} src=${bgSrcType} sourcePath=${spShort || 'none'}`)
      }
      const sorted = [...(pg.elements || [])].sort((a, b) => a.z - b.z)
      if (!sorted.length) {
        lines.push('- No elements')
        lines.push('')
        return
      }

      sorted.forEach((el) => {
        lines.push(`- ${el.type} id=${el.id} z=${el.z} pos=(${Math.round(el.x)},${Math.round(el.y)}) size=${Math.round(el.w)}x${Math.round(el.h)}`)
        if (el.type === 'button') {
          lines.push(`  action=${el.action || 'next'} linkType=${el.linkType || 'page'} linkTarget=${el.linkTarget || el.target || ''}`)
          if (el.action === 'play-media') {
            const mf = String(el.mediaFile || '')
            const mfType = !mf ? 'none'
              : mf.startsWith('data:') ? `data-url(${mf.length}b)`
              : mf.startsWith('blob:') ? 'blob-url(session-only)'
              : mf.startsWith('app-media://') ? `app-media(${mf.length}b)`
              : /^http:\/\/127\.0\.0\.1:\d+\//.test(mf) ? `http-server(${mf.length}b)`
              : `path(${mf.length}b)`
            lines.push(`  mediaFile=${mfType}`)
            if (el.mediaFileName) lines.push(`  mediaFileName=${el.mediaFileName}`)
          }
          if (el.action === 'url') {
            const urlVal = el.urlTarget || el.linkTarget || ''
            lines.push(`  url=${urlVal.slice(0, 80) || 'none'}`)
          }
        }
        if (el.type === 'clip' || el.type === 'mpeg') {
          lines.push(`  mediaName=${el.mediaName || ''}`)
          lines.push(`  mediaExt=${el.mediaExt || getMediaExtension(el.file || '')}`)
          lines.push(`  mediaKind=${el.mediaKind || detectMediaKind(el.file || '')}`)
          lines.push(`  mediaSupport=${el.mediaSupport || 'unknown'}`)
          lines.push(`  mediaReason=${el.mediaReason || ''}`)
          lines.push(`  mediaOutputHint=${el.mediaOutputHint || ''}`)
          // Show the type of URL/path stored (for debugging reload issues)
          const f = String(el.file || '')
          const fileType = !f ? 'none' : f.startsWith('data:') ? `data-url(${f.length}b)` : f.startsWith('blob:') ? 'blob-url(session-only)' : f.startsWith('app-media://') ? `app-media(${f.length}b)` : /^http:\/\/127\.0\.0\.1:\d+\//.test(f) ? `http-server(${f.length}b)` : `path(${f.length}b)`
          lines.push(`  mediaFile=${fileType}`)
          const sp = el.mediaSourcePath ? String(el.mediaSourcePath) : ''
          const spTail = sp.length > 45 ? '…' + sp.slice(-44) : sp
          lines.push(`  mediaSourcePath=${sp ? spTail : 'none'}`)
        }
        if (el.type === 'hotspot') {
          lines.push(`  shape=${el.hotspotShape || 'rect'} action=${el.action || 'none'}`)
          if (el.gotoPageName) lines.push(`  gotoPage=${el.gotoPageName}`)
          if (el.hoverSoundFile) lines.push(`  hoverSound=${el.hoverSoundName || el.hoverSoundFile}`)
          if (el.hoverMediaFile) lines.push(`  hoverMedia=${el.hoverMediaName || el.hoverMediaFile}`)
          if (el.clickSoundFile) lines.push(`  clickSound=${el.clickSoundName || el.clickSoundFile}`)
          if (el.clickMediaFile) lines.push(`  clickMedia=${el.clickMediaName || el.clickMediaFile}`)
        }
      })

      lines.push('')
    })

    const reportText = lines.join('\n')
    if (desktopApi?.exportMediaDiagnostics) {
      const result = await desktopApi.exportMediaDiagnostics({
        defaultName: `media-diagnostics-${Date.now()}.txt`,
        reportText,
      })
      if (result?.canceled) {
        setStatus('Diagnostics export canceled')
        return false
      }
      setStatus(`Diagnostics exported: ${result?.fileName || 'media-diagnostics.txt'}`)
      return true
    }

    toBlobDownload(reportText, 'media-diagnostics.txt', 'text/plain')
    setStatus('Diagnostics downloaded: media-diagnostics.txt')
    return true
  }

  const drawPlayFrame = useCallback((index) => {
    if (!playRef.current) return
    const pg = pages[index]
    if (!pg) return
    const ctx = playRef.current.getContext('2d')
    if (!ctx) return

    const cw = playRef.current.width
    const ch = playRef.current.height
    const scale = cw / stageWidth

    ctx.clearRect(0, 0, cw, ch)
    ctx.save()
    ctx.scale(scale, ch / stageHeight)
    ctx.fillStyle = pg.bgColor || '#000'
    ctx.fillRect(0, 0, stageWidth, stageHeight)

    for (const el of [...pg.elements].sort((a, b) => a.z - b.z)) {
      if (el.visible === false) continue
      if (el.type === 'text') {
        ctx.font = `${el.italic ? 'italic' : 'normal'} ${el.weight || 700} ${el.size || 36}px ${el.font || 'Rajdhani'}`
        ctx.fillStyle = el.color || '#e8a020'
        ctx.textAlign = el.align || 'center'
        ctx.textBaseline = 'middle'
        const tx = el.align === 'left' ? el.x + 4 : el.align === 'right' ? el.x + el.w - 4 : el.x + el.w / 2
        ctx.fillText(el.content || '', tx, el.y + el.h / 2)
      }
      if (el.type === 'clip') {
        if (el.file) {
          const img = new Image()
          img.src = el.file
          img.onload = () => ctx.drawImage(img, el.x, el.y, el.w, el.h)
        } else {
          ctx.fillStyle = 'rgba(74,143,192,.2)'
          ctx.fillRect(el.x, el.y, el.w, el.h)
        }
      }
      if (el.type === 'button') {
        ctx.fillStyle = el.bgColor || '#1a3a5c'
        ctx.fillRect(el.x, el.y, el.w, el.h)
        ctx.strokeStyle = el.borderColor || '#4a8fc0'
        ctx.lineWidth = el.borderWidth || 2
        ctx.strokeRect(el.x, el.y, el.w, el.h)
        ctx.fillStyle = el.fgColor || '#e8a020'
        ctx.font = `600 ${el.fontSize || 14}px Rajdhani`
        ctx.textAlign = 'center'
        ctx.fillText(el.label || 'Button', el.x + el.w / 2, el.y + el.h / 2)
      }
      if (el.type === 'mpeg') {
        ctx.fillStyle = '#0a0a1a'
        ctx.fillRect(el.x, el.y, el.w, el.h)
        ctx.fillStyle = 'rgba(232,160,32,.35)'
        ctx.font = '26px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('▶', el.x + el.w / 2, el.y + el.h / 2)
      }
    }
    ctx.restore()
  }, [pages, stageHeight, stageWidth])

  const startPlay = useCallback((mode = 'page') => {
    if (playIdx >= 0) {
      setStatus('Playback already running')
      return false
    }
    if (!pages.length) {
      setStatus('Cannot start playback — no pages')
      return false
    }
    const isScript = mode === 'script'
    if (isScript || presentationFullscreen) {
      try { document.documentElement.requestFullscreen?.() } catch { /* noop */ }
    }
    // Start presentation audio synchronously here, inside the user gesture handler.
    // audio.play() called from useEffect (async) is blocked by browser autoplay policy.
    if (outerPresAudioRef.current) { try { outerPresAudioRef.current.pause() } catch { /* noop */ } outerPresAudioRef.current = null }
    if (presentationAudio?.file) {
      try {
        const pa    = presentationAudio
        const paUrl = /^(https?:|data:|blob:|app-media:)/i.test(pa.file) ? pa.file : makeAppMediaUrl(pa.file)
        const paAudio       = new Audio(paUrl)
        paAudio.loop        = pa.loop !== false
        paAudio.volume      = pa.volume ?? 1
        paAudio.playbackRate= pa.playbackRate ?? 1
        paAudio.currentTime = pa.trimStart ?? 0
        if ((pa.trimEnd ?? null) != null) {
          const trimEnd     = pa.trimEnd
          const trimStart   = pa.trimStart ?? 0
          paAudio.addEventListener('timeupdate', function onTU() {
            if (paAudio.currentTime >= trimEnd) {
              if (pa.loop !== false) { paAudio.currentTime = trimStart }
              else { try { paAudio.pause() } catch { /* noop */ } }
            }
          })
        }
        const offset = pa.offset ?? 0
        const doPlay = () => paAudio.play().catch((err) => {
          console.error('[FluxAura Studio] Presentation audio play rejected:', err)
          setStatus(`⚠ Audio blocked by browser: ${err?.name || err} — click PLAY again`)
        })
        if (offset > 0) { presAudioOffsetTimerRef.current = setTimeout(doPlay, offset * 1000) } else { doPlay() }
        outerPresAudioRef.current = paAudio
      } catch { /* ignore */ }
    }
    const startPageIdx = isScript ? 0 : cur
    setPlayIdx(startPageIdx)
    setStatus(`${isScript ? 'Presenting' : 'Preview'} started: Page ${startPageIdx + 1} / ${pages.length}`)
    return true
  }, [cur, pages, playIdx, presentationFullscreen, presentationAudio])

  const stopPlay = useCallback(() => {
    if (playIdx < 0) {
      setStatus('Playback already stopped')
      return false
    }
    if (playTimerRef.current) clearTimeout(playTimerRef.current)
    // Cancel any pending audio-offset delay timer
    if (presAudioOffsetTimerRef.current) { clearTimeout(presAudioOffsetTimerRef.current); presAudioOffsetTimerRef.current = null }
    // Stop the outer pre-started audio (browser autoplay workaround)
    if (outerPresAudioRef.current) { try { outerPresAudioRef.current.pause() } catch { /* noop */ } outerPresAudioRef.current = null }
    stopAllAudio()
    if (document.fullscreenElement) {
      try { document.exitFullscreen?.() } catch { /* noop */ }
    }
    setPlayIdx(-1)
    setPlayerCurIdx(-1)
    setStatus('Playback stopped')
    return true
  }, [playIdx])


  useEffect(() => {
    if (playIdx < 0) return
    if (playRef.current) drawPlayFrame(playIdx)
    // Timing and navigation are now handled inside PresentationPlayer
  }, [playIdx, drawPlayFrame])

  const toolbarSections = [
    [
      { id: 'tool-select',  label: <><MousePointer2 size={13}/> Sel</>,     title: 'Select  [V]', active: tool === 'sel' },
      { id: 'tool-text',    label: <><Type size={13}/> Text</>,             title: 'Add Text  [T]', active: tool === 'text' },
      { id: 'tool-image',   label: <><ImageIcon size={13}/> Img</>,         title: 'Add Image/Media  [I]', active: tool === 'img' },
      { id: 'tool-button',  label: <><Square size={13}/> Btn</>,            title: 'Add Button  [B]', active: btnEditor.open },
      { id: 'tool-wipe',    label: <><Wand2 size={13}/> Wipe</>,            title: 'Wipe / Transitions', active: inspectorTab === 'wipe' },
      { id: 'tool-mpeg',    label: <><Video size={13}/> Vid</>,             title: 'Add Video  [M]', active: tool === 'mpeg' },
      { id: 'tool-hotspot', label: <><Target size={13}/> Hotspot</>,        title: 'Draw Hotspot Button  [H]', active: tool === 'hotspot' },
      { id: 'tool-menubar', label: <><Menu size={13}/> Menu Bar</>,         title: 'Add Menu Bar', active: tool === 'menubar' },
    ],
    [
      { id: 'edit-button', label: 'Edit Btn', title: 'Edit selected button' },
      { id: 'view-bg-image', label: 'BG',  title: 'Set background image/video' },
      { id: 'view-panel-left',   label: `${panelVisible.left   ? '✓' : '  '} Pages Panel` },
      { id: 'view-panel-right',  label: `${panelVisible.right  ? '✓' : '  '} Properties Panel` },
      { id: 'view-panel-bottom', label: `${panelVisible.bottom ? '✓' : '  '} Timeline` },
      { id: 'view-media-lib',    label: `${showMediaLib        ? '✓' : '  '} Media Library` },
      { id: 'view-sep', label: '─', disabled: true },
      { id: 'view-grid-toggle',       label: <LayoutGrid size={13}/>,          title: 'Toggle grid  [Ctrl+G]',        active: showGrid },
      { id: 'play-start',             label: <><Play size={13}/> Play</>,        title: 'Play from current page  [F5]' },
      { id: 'present-start',          label: <><Maximize size={13}/> Present</>,  title: 'Present fullscreen from page 1  [F11]' },
      { id: 'play-prev',              label: <SkipBack size={13}/>,            title: 'Previous playback page' },
      { id: 'play-next',              label: <SkipForward size={13}/>,         title: 'Next playback page' },
      { id: 'play-stop',              label: <><StopCircle size={13}/> Stop</>, title: 'Stop playback  [Esc]' },
      { id: 'play-loop-toggle',       label: <Repeat size={13}/>,              title: 'Toggle loop',              active: presentationLoop },
      { id: 'play-ctrl-toggle',       label: <SlidersHorizontal size={13}/>,   title: 'Show player controls bar', active: presentationShowControls },
      { id: 'play-interactive',       label: <Hand size={13}/>,                title: 'Interactive mode',         active: presentationInteractive },
      { id: 'play-fullscreen-toggle', label: <Maximize size={13}/>,            title: 'Launch fullscreen',        active: presentationFullscreen },
      { id: 'play-dev-mode',          label: <Code2 size={13}/>,               title: 'Developer mode overlay',   active: presentationDevMode },
    ],
    [
      { id: 'align-left',       label: <AlignLeft size={13}/>,           title: 'Align Left' },
      { id: 'align-hcenter',    label: <AlignCenter size={13}/>,         title: 'Align Center H' },
      { id: 'align-right',      label: <AlignRight size={13}/>,          title: 'Align Right' },
      { id: 'align-top',        label: <AlignStartVertical size={13}/>,  title: 'Align Top' },
      { id: 'align-vcenter',    label: <AlignCenterVertical size={13}/>, title: 'Align Center V' },
      { id: 'align-bottom',     label: <AlignEndVertical size={13}/>,    title: 'Align Bottom' },
      { id: 'space-h',          label: <ArrowLeftRight size={13}/>,      title: 'Space Evenly Horizontal', disabled: selIds.length < 3 },
      { id: 'space-v',          label: <ArrowUpDown size={13}/>,         title: 'Space Evenly Vertical',   disabled: selIds.length < 3 },
      { id: 'group-selected',   label: <Group size={13}/>,               title: 'Group  [2+ elements]',    disabled: selIds.length < 2 },
      { id: 'ungroup-selected', label: <Ungroup size={13}/>,             title: 'Ungroup selection',       disabled: selIds.length === 0 },
    ],
  ]

  // Inspector tab icons — swap these emoji for custom SVG/Unicode later
  const TAB_ICONS = { props: <Settings size={14}/>, anim: <Play size={14}/>, page: <FileText size={14}/>, wipe: <RefreshCw size={14}/>, script: <Zap size={14}/>, diag: <Stethoscope size={14}/> }
  const TAB_TIPS  = { props: 'Properties', anim: 'Animations', page: 'Page Settings', wipe: 'Transitions / Wipes', script: 'Scripting', diag: 'Diagnostics' }

  // Accordion section helpers
  const sOpen = (id, def = true) => (id in openSections ? openSections[id] : def)
  function toggleSection(id, def = true) {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !( id in prev ? prev[id] : def ) }
      try { localStorage.setItem('mme_openSections', JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  function executeCommand(commandId) {
    if (commandId === 'edit-undo') { undo(); return }
    if (commandId === 'edit-redo') { redo(); return }
    if (commandId === 'edit-copy') { copySelected(); return }
    if (commandId === 'edit-paste') { pasteElements(); return }
    if (commandId === 'edit-duplicate') { duplicateSelected(); return }
    if (commandId === 'file-new') {
      setNewProjectDlg(true)
      return
    }
    if (commandId === 'file-open') {
      void openMmeDesktop()
      return
    }
    if (commandId === 'file-save') {
      void onSave()
      return
    }
    if (commandId === 'file-export-html') {
      onExportHtml()
      return
    }
    if (commandId === 'file-publish') {
      setShowPublishDlg(true)
      return
    }
    if (commandId === 'file-import-pages') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.mme,.sca'
      input.onchange = async (e) => {
        const file = /** @type {HTMLInputElement} */(e.target).files?.[0]
        if (!file) return
        try {
          setStatus('Parsing project file…')
          const data = await importProjectPages(file)
          if (!data.pages.length) { setStatus('No pages found in file'); return }
          setImportPagesData(data)
        } catch (err) {
          setStatus(`Import failed: ${err.message}`)
        }
      }
      input.click()
      return
    }
    if (commandId === 'file-import-pdf') {
      // Open a file picker for PDF files
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.pdf'
      input.onchange = (e) => {
        const file = /** @type {HTMLInputElement} */(e.target).files?.[0]
        if (!file) return
        void importPdfAsStorybook(file)
      }
      input.click()
      return
    }
    if (commandId === 'file-export-storybook') {
      setSbPasswordDlg(true)
      return
    }
    if (commandId === 'file-export-screen-png') {
      void onExportScreenPng()
      return
    }
    if (commandId === 'file-export-page-png') {
      void onExportPagePng()
      return
    }
    if (commandId === 'file-export-script') {
      onExportScript()
      return
    }
    if (commandId === 'file-print') {
      setShowPrintDlg(true)
      return
    }
    if (commandId === 'view-spread') {
      setSpreadView(v => !v)
      return
    }
    if (commandId === 'page-new') {
      addPage()
      return
    }
    if (commandId === 'page-duplicate') {
      duplicatePage()
      return
    }
    if (commandId === 'page-delete') {
      deletePage()
      return
    }
    if (commandId === 'page-prev') {
      if (cur <= 0) {
        setStatus('Already at first page')
        return
      }
      const nextIndex = goToPage(cur - 1)
      setStatus(`Page ${nextIndex + 1} / ${pages.length}`)
      return
    }
    if (commandId === 'page-next') {
      if (cur >= pages.length - 1) {
        setStatus('Already at last page')
        return
      }
      const nextIndex = goToPage(cur + 1)
      setStatus(`Page ${nextIndex + 1} / ${pages.length}`)
      return
    }
    if (commandId === 'selection-delete') {
      const deleted = deleteSelected()
      if (!deleted) deletePage()
      return
    }
    if (commandId === 'selection-duplicate') {
      duplicateSelected()
      return
    }
    if (commandId === 'layer-front') {
      layerOp('top')
      return
    }
    if (commandId === 'layer-up') {
      layerOp('up')
      return
    }
    if (commandId === 'layer-down') {
      layerOp('dn')
      return
    }
    if (commandId === 'layer-back') {
      layerOp('bot')
      return
    }
    if (commandId === 'view-script') {
      toggleScriptView()
      setStatus(showScriptFlow ? 'Script Flow closed' : 'Script Flow opened')
      return
    }
    if (commandId === 'view-variables') {
      setShowVarEditor(v => !v)
      setStatus(showVarEditor ? 'Variable editor closed' : 'Variable editor opened')
      return
    }
    if (commandId === 'view-script-close') {
      setShowScriptFlow(false)
      setStatus('Script Flow closed')
      return
    }
    if (commandId === 'view-close-overlays') {
      stopAllAudio()
      const hadPlayback = playIdx >= 0
      const hadScriptView = showScriptFlow
      const hadVarEditor = showVarEditor
      if (hadPlayback) stopPlay()
      if (hadScriptView) setShowScriptFlow(false)
      if (hadVarEditor) setShowVarEditor(false)
      if (!hadPlayback && !hadScriptView && !hadVarEditor) {
        setStatus('Audio stopped')
        return
      }
      setStatus([hadPlayback && 'Playback stopped', hadScriptView && 'Script Flow closed', hadVarEditor && 'Variable editor closed'].filter(Boolean).join(', '))
      return
    }
    if (commandId === 'view-shortcuts') { setShowShortcuts((v) => !v); return }
    if (commandId === 'view-panel-left')   { togglePanel('left');   return }
    if (commandId === 'view-panel-right')  { togglePanel('right');  return }
    if (commandId === 'view-panel-bottom') { togglePanel('bottom'); return }
    if (commandId === 'view-media-lib')    { setShowMediaLib((v) => !v); return }
    if (commandId === 'view-grid-toggle') {
      setShowGrid((value) => {
        const next = !value
        setStatus(`Grid ${next ? 'on' : 'off'}`)
        return next
      })
      return
    }
    if (commandId === 'view-zoom-in') {
      if (zoom >= 3) {
        setStatus('Zoom already at maximum')
        return
      }
      const next = Math.max(0.1, Math.min(3, Math.round((zoom + 0.1) * 10) / 10))
      setZoom(next)
      setStatus(`Zoom ${Math.round(next * 100)}%`)
      const zSel = selId && pages[cur]?.elements.find(e => e.id === selId)
      if (zSel) centreOnPoint(zSel.x + zSel.w / 2, zSel.y + zSel.h / 2, next)
      else centreCanvas(next)
      return
    }
    if (commandId === 'view-zoom-out') {
      if (zoom <= 0.1) {
        setStatus('Zoom already at minimum')
        return
      }
      const next = Math.max(0.1, Math.min(3, Math.round((zoom - 0.1) * 10) / 10))
      setZoom(next)
      setStatus(`Zoom ${Math.round(next * 100)}%`)
      const zSel = selId && pages[cur]?.elements.find(e => e.id === selId)
      if (zSel) centreOnPoint(zSel.x + zSel.w / 2, zSel.y + zSel.h / 2, next)
      else centreCanvas(next)
      return
    }
    if (commandId === 'view-zoom-fit') {
      fitToWindow()
      return
    }
    if (commandId === 'view-bg-image') {
      void chooseMedia('bg', 'image')
      return
    }
    if (commandId === 'play-start') {
      startPlay('page')
      return
    }
    if (commandId === 'present-start') {
      startPlay('script')
      return
    }
    if (commandId === 'play-stop') {
      stopPlay()
      return
    }
    if (commandId === 'play-prev') {
      if (playIdx < 0) {
        setStatus('Start playback first')
        return
      }
      if (playIdx <= 0) {
        setStatus('Already at first play page')
        return
      }
      setPlayIdx((value) => {
        const next = Math.max(0, value - 1)
        setStatus(`Playback page ${next + 1} / ${pages.length}`)
        return next
      })
      return
    }
    if (commandId === 'play-next') {
      if (playIdx < 0) {
        setStatus('Start playback first')
        return
      }
      if (playIdx >= pages.length - 1) {
        setStatus('Already at last play page')
        return
      }
      setPlayIdx((value) => {
        const next = Math.min(pages.length - 1, value + 1)
        setStatus(`Playback page ${next + 1} / ${pages.length}`)
        return next
      })
      return
    }
    if (commandId === 'tool-select') {
      if (tool === 'sel') {
        setStatus('Tool already: SEL')
        return
      }
      selectTool('sel')
      setStatus('Tool: SEL')
      return
    }
    if (commandId === 'tool-text') {
      if (tool === 'text') {
        setStatus('Tool already: TEXT')
        return
      }
      selectTool('text')
      setStatus('Tool: TEXT')
      return
    }
    if (commandId === 'tool-image') {
      if (tool === 'img') {
        setStatus('Tool already: IMAGE')
        return
      }
      selectTool('img')
      setStatus('Tool: IMAGE')
      return
    }
    if (commandId === 'tool-button') {
      openBtnEditorNew()
      setStatus('Button editor opened')
      return
    }
    if (commandId === 'tool-wipe') {
      setInspectorTab('wipe')
      setStatus('Wipe/Transition settings')
      return
    }
    if (commandId === 'edit-button') {
      const btn = currentPage?.elements?.find((el) => el.id === selId && el.type === 'button')
      if (btn) openBtnEditorExisting(btn)
      else setStatus('Select a button element first')
      return
    }
    if (commandId === 'tool-mpeg') {
      if (tool === 'mpeg') {
        setStatus('Tool already: MPEG')
        return
      }
      selectTool('mpeg')
      setStatus('Tool: MPEG')
      return
    }
    if (commandId === 'tool-hotspot') {
      selectTool('hotspot')
      setHsFreehandPts([])
      setHsFreehandActive(false)
      setHsDrawing(null)
      setStatus(`Tool: HOTSPOT (${hotspotShape}) — drag to draw, or select Freehand to click points`)
      return
    }
    if (commandId === 'tool-menubar') {
      selectTool('menubar')
      setStatus('Tool: MENU BAR — click canvas to add')
      return
    }
    if (commandId === 'page-move-up') { movePageUp(); return }
    if (commandId === 'page-move-down') { movePageDown(); return }
    if (commandId === 'align-left')    { alignElement('left'); return }
    if (commandId === 'align-hcenter') { alignElement('hcenter'); return }
    if (commandId === 'align-right')   { alignElement('right'); return }
    if (commandId === 'align-top')     { alignElement('top'); return }
    if (commandId === 'align-vcenter') { alignElement('vcenter'); return }
    if (commandId === 'align-bottom')  { alignElement('bottom'); return }
    if (commandId.startsWith('nudge-')) {
      const parts = commandId.split('-')  // nudge, dir, amount
      const dir = parts[1]; const px = Number(parts[2]) || 1
      if (dir === 'left')  { nudgeElement(-px, 0); return }
      if (dir === 'right') { nudgeElement(px, 0); return }
      if (dir === 'up')    { nudgeElement(0, -px); return }
      if (dir === 'down')  { nudgeElement(0, px); return }
    }
    if (commandId === 'play-loop-toggle') {
      setPresentationLoop((v) => { setStatus(`Presentation loop: ${!v ? 'ON' : 'OFF'}`); return !v })
      return
    }
    if (commandId === 'play-ctrl-toggle') {
      setPresentationShowControls((v) => { setStatus(`Player controls: ${!v ? 'visible' : 'hidden'}`); return !v })
      return
    }
    if (commandId === 'play-interactive') {
      setPresentationInteractive((v) => { setStatus(`Interactive mode: ${!v ? 'ON' : 'OFF'}`); return !v })
      return
    }
    if (commandId === 'play-fullscreen-toggle') {
      setPresentationFullscreen((v) => { setStatus(`Fullscreen launch: ${!v ? 'ON' : 'OFF'}`); return !v })
      return
    }
    if (commandId === 'play-dev-mode') {
      setPresentationDevMode((v) => { setStatus(`Dev mode: ${!v ? 'ON' : 'OFF'}`); return !v })
      return
    }
    if (commandId === 'space-h') { spaceEvenlyH(); return }
    if (commandId === 'space-v') { spaceEvenlyV(); return }
    if (commandId === 'group-selected') { groupSelected(); return }
    if (commandId === 'ungroup-selected') { ungroupSelected(); return }
    if (commandId === 'select-all') {
      const allIds = (currentPage?.elements ?? []).map((el) => el.id)
      setSelIds(allIds)
      if (allIds.length > 0) setSelId(allIds[allIds.length - 1])
      setStatus(`Selected all ${allIds.length} elements`)
      return
    }
    if (commandId === 'select-none') {
      setSelIds([]); setSelId(null); return
    }

    setStatus(`Unknown command: ${commandId}`)
  }

  useEffect(() => {
    executeCommandRef.current = executeCommand
  })

  useEffect(() => {
    function onKeyDown(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      const ctrl = e.ctrlKey || e.metaKey
      const runCommand = executeCommandRef.current
      if (!runCommand) return

      if (e.key === 'F5') {
        e.preventDefault()
        runCommand('play-start')
      }
      if (e.key === 'F11') {
        e.preventDefault()
        runCommand('present-start')
      }
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); runCommand('edit-undo'); return }
      if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); runCommand('edit-redo'); return }
      if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); runCommand('edit-copy'); return }
      if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); runCommand('edit-paste'); return }
      if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); runCommand('edit-duplicate'); return }
      if (e.key === 'Escape') {
        runCommand('view-close-overlays')
        runCommand('select-none')
      }
      if (e.key === 'F9') {
        e.preventDefault()
        runCommand('view-script')
      }
      if (ctrl && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        runCommand('view-grid-toggle')
      }
      if (ctrl && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setShowTimeline((v) => !v)
      }
      if (ctrl && e.key === '1') { e.preventDefault(); togglePanel('left') }
      if (ctrl && e.key === '2') { e.preventDefault(); togglePanel('right') }
      if (ctrl && e.key === '3') { e.preventDefault(); togglePanel('bottom') }
      if (ctrl && (e.key === '?' || e.key === '/')) { e.preventDefault(); runCommand('view-shortcuts') }
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        runCommand('view-zoom-in')
      }
      if (ctrl && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        runCommand('select-all')
      }
      if (ctrl && e.key === '-') {
        e.preventDefault()
        runCommand('view-zoom-out')
      }
      if (ctrl && e.key === '0') {
        e.preventDefault()
        runCommand('view-zoom-fit')
      }
      if (ctrl && (e.code === 'BracketRight' || e.key === ']')) {
        e.preventDefault()
        runCommand(e.shiftKey ? 'layer-front' : 'layer-up')
      }
      if (ctrl && (e.code === 'BracketLeft' || e.key === '[')) {
        e.preventDefault()
        runCommand(e.shiftKey ? 'layer-back' : 'layer-down')
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        runCommand('selection-delete')
        e.preventDefault()
      }
      if (e.key === 'PageUp') runCommand('page-prev')
      if (e.key === 'PageDown') runCommand('page-next')
      if (e.key.toLowerCase() === 'v') runCommand('tool-select')
      if (e.key.toLowerCase() === 't') runCommand('tool-text')
      if (e.key.toLowerCase() === 'i') runCommand('tool-image')
      if (e.key.toLowerCase() === 'b') runCommand('tool-button')
      if (e.key.toLowerCase() === 'm') runCommand('tool-mpeg')
      if (e.key.toLowerCase() === 'h') runCommand('tool-hotspot')

      // Arrow key nudging for selected element
      if (!ctrl && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault()
        const amt = e.shiftKey ? 10 : 1
        const dirMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
        runCommand(`nudge-${dirMap[e.key]}-${amt}`)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="smm-root">
      <input ref={fileRef} type="file" accept=".mme,.txt" hidden onChange={onOpenFile} />
      <input ref={imgRef} type="file" hidden />

      <header className="titlebar">
        <div className="logo">FluxAura Studio</div>
        <div className="version">v0.1.0 · Interactive Edition</div>
        <div className="filename">{filename}</div>
      </header>

      <nav className="menubar">
        {/* ── Row A: File / Save / Publish ──────────────────── */}
        <div className="mbar-row mbar-file-row">
          <button onClick={() => executeCommand('file-new')} title="New project  [Ctrl+N]">New</button>
          <button onClick={() => executeCommand('file-open')} title="Open .mme file  [Ctrl+O]">Open</button>
          <button onClick={() => executeCommand('file-save')} title="Save  [Ctrl+S]">Save</button>
          <span className="sep" />
          <button onClick={() => executeCommand('file-import-pages')} title="Import pages from another .mme file"><Import size={13}/> Import Pages…</button>
          <button onClick={() => executeCommand('file-import-pdf')} title="Import a PDF as page backgrounds"><FileText size={13}/> Import PDF</button>
          <span className="sep" />
          <button onClick={() => executeCommand('file-publish')} title="Publish / Export — all output formats"><Upload size={13}/> Publish…</button>
          <span className="sep" />
          <button onClick={() => setShowLyricWizard(true)} title="Create a music lyric video from an audio track"><Music size={13}/> Lyric Video…</button>
          {/* Stage preset selector */}
          <select className="stage-sel" value={stagePreset} onChange={(e) => applyStagePreset(e.target.value)} title="Stage size / resolution">
            {Array.from(new Map(STAGE_PRESETS.map(p => [p.cat, p.cat])).keys()).map(cat => (
              <optgroup key={cat} label={cat}>
                {STAGE_PRESETS.filter(p => p.cat === cat).map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {stagePreset.startsWith('sq_book') && (
            <select className="stage-sel" title="Square Book DPI" value={stagePreset} onChange={(e) => applyStagePreset(e.target.value)}>
              {SQUARE_BOOK_DPI_OPTIONS.map(opt => {
                const key = STAGE_PRESETS.find(p => p.cat === 'Square Book' && p.width === opt.px)?.key
                return key ? <option key={key} value={key}>{opt.label}</option> : null
              })}
            </select>
          )}
          {showCustomStageDlg && (
            <div className="modal-overlay" onClick={() => setShowCustomStageDlg(false)}>
              <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ minWidth: 320, padding: '1.2rem' }}>
                <h3 style={{ marginTop: 0 }}><Pencil size={14} style={{verticalAlign:'middle', marginRight:4}}/> Custom Stage Size</h3>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  Width (px)
                  <input type="number" min={100} max={8000} defaultValue={customStageW} id="custom-stage-w" className="num-input" style={{ width: '100%' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  Height (px)
                  <input type="number" min={100} max={8000} defaultValue={customStageH} id="custom-stage-h" className="num-input" style={{ width: '100%' }} />
                </label>
                <p style={{ fontSize: '0.78rem', color: '#aaa', margin: '0 0 12px' }}>
                  For 8.5×8.5 in at 300 DPI enter 2551 × 2551. Maximum 8000 × 8000 px.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowCustomStageDlg(false)}>Cancel</button>
                  <button className="btn-primary" onClick={() => {
                    const w = parseInt((/** @type {HTMLInputElement|null} */(document.getElementById('custom-stage-w')))?.value || String(customStageW), 10)
                    const h = parseInt((/** @type {HTMLInputElement|null} */(document.getElementById('custom-stage-h')))?.value || String(customStageH), 10)
                    applyCustomStage(w, h)
                  }}>Apply</button>
                </div>
              </div>
            </div>
          )}
          <span className="sep" />
          <button onClick={() => executeCommand('file-print')} title="Print current page">Print…</button>
          <button onClick={() => executeCommand('file-export-html')} title="Quick-export as standalone HTML presentation  [Ctrl+E]">HTML…</button>
          <button onClick={() => executeCommand('file-export-storybook')} title="Export interactive storybook package">Storybook…</button>
          <button onClick={() => executeCommand('file-export-script')} title="Export .sca script file">Script…</button>
          <button onClick={() => executeCommand('file-export-screen-png')} title="Export full-screen screenshot as PNG">Screen PNG</button>
          <button onClick={() => executeCommand('file-export-page-png')} title="Export current page as PNG">Page PNG</button>
          <button className={spreadView ? 'on' : ''} onClick={() => executeCommand('view-spread')} title="Toggle spread/two-page view" style={{ marginLeft: 4 }}>
            {spreadView ? <><BookOpen size={13}/> Spread</> : <><FileText size={13}/> Single</>}
          </button>
        </div>
      </nav>

      <div className="toolbar">
        {/* ── Row C: Drawing Tools + Edit shortcuts + Script/Vars ── */}
        <div className="toolbar-row toolbar-row-1">
          {toolbarSections[0].map((cmd) => (
            <button key={cmd.id} title={cmd.title} className={cmd.active ? 'on' : ''} onClick={() => executeCommand(cmd.id)}>{cmd.label}</button>
          ))}
          <span className="sep" />
          {/* Edit selected button + Set BG shortcut */}
          {toolbarSections[1].slice(0, 2).map((cmd) => (
            <button key={cmd.id} title={cmd.title} className={cmd.active ? 'on' : ''} onClick={() => executeCommand(cmd.id)}>{cmd.label}</button>
          ))}
          {/* Hotspot shape selector — visible only when hotspot tool active */}
          {tool === 'hotspot' && (
            <>
              <span className="sep" />
              <select
                className="stage-sel"
                style={{ fontSize: 10, height: 22, maxWidth: 110, color: 'var(--mme-teal)', borderColor: 'rgba(60,184,190,.5)' }}
                title="Hotspot shape"
                value={hotspotShape}
                onChange={(e) => { setHotspotShape(e.target.value); setHsFreehandPts([]); setHsFreehandActive(false) }}
              >
                <option value="rect">▬ Rectangle</option>
                <option value="oval">⬭ Oval / Ellipse</option>
                <option value="circle">⭕ Circle</option>
                <option value="star">★ Star</option>
                <option value="hexagon">⬡ Hexagon</option>
                <option value="pentagon">⬠ Pentagon</option>
                <option value="octagon">⯃ Octagon</option>
                <option value="triangle">△ Triangle</option>
                <option value="diamond">◇ Diamond</option>
                <option value="freehand">✏ Freehand</option>
              </select>
              {hotspotShape === 'freehand' && hsFreehandPts.length > 0 && (
                <>
                  <span style={{ fontSize: 10, color: 'var(--mme-teal)', padding: '0 4px' }}>
                    {hsFreehandPts.length} pts • dbl-click to close
                  </span>
                  <button title="Cancel freehand" style={{ fontSize: 10 }} onClick={() => { setHsFreehandPts([]); setHsFreehandActive(false) }}>✕ Cancel</button>
                </>
              )}
              {hotspotShape !== 'freehand' && (
                <span style={{ fontSize: 10, color: 'var(--mme-teal)', padding: '0 4px' }}>drag to draw</span>
              )}
            </>
          )}
          <span className="sep" />
          {/* Script Flow + Variables */}
          <button
            className={showScriptFlow ? 'on' : ''}
            title="Script Flow Chart  [Ctrl+F]"
            onClick={() => executeCommand('view-script')}
          >{showScriptFlow ? <><X size={13}/> Script Flow</> : <><GitBranch size={13}/> Script Flow</>}</button>
          <button
            className={`toolbar-btn-vars${showVarEditor ? ' on' : ''}`}
            title="Variable &amp; Script Editor"
            onClick={() => executeCommand('view-variables')}
          ><Zap size={13}/> Variables</button>
          <span className="sep" />
          {/* Presentation settings: Show Player Controls, Interactive, Fullscreen, Dev Mode */}
          {toolbarSections[1].slice(14).map((cmd) => (
            <button key={cmd.id} title={cmd.title}
              className={`${cmd.active ? 'on' : ''}${cmd.disabled ? ' disabled' : ''}`}
              disabled={cmd.disabled} onClick={() => executeCommand(cmd.id)}>{cmd.label}</button>
          ))}
          <span className="sep" />
          {/* Panel toggles */}
          <button title="Pages & Elements panel  [left]" className={panelVisible.left ? 'on' : ''} onClick={() => togglePanel('left')}><PanelLeft size={14}/></button>
          <button title="Toggle Media Library" className={showMediaLib ? 'on' : ''} onClick={() => setShowMediaLib((v) => !v)}><FolderOpen size={14}/></button>
          <button title="Timeline  [Ctrl+T]" className={panelVisible.bottom ? 'on' : ''} onClick={() => togglePanel('bottom')}><Film size={14}/></button>
          <button title="Properties panel  [right]" className={panelVisible.right ? 'on' : ''} onClick={() => togglePanel('right')}><PanelRight size={14}/></button>
          <button title="Keyboard Shortcuts  [Ctrl+?]" onClick={() => executeCommand('view-shortcuts')}><Keyboard size={14}/></button>
          <span className="sep" />
          {/* Auto-save interval */}
          <select
            className="stage-sel"
            title="Auto-save interval — how often unsaved work is backed up to disk"
            value={autoSaveInterval}
            onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
            style={{ fontSize: 11, height: 26, maxWidth: 80 }}
          >
            <option value={1}>💾 1 min</option>
            <option value={5}>💾 5 min</option>
            <option value={10}>💾 10 min</option>
          </select>
          {/* Resolve Media — shown only when there are unresolved media files */}
          {mediaResolver && !mediaResolver.open && (
            <button
              className="toolbar-resolve-media-btn"
              onClick={() => setMediaResolver(prev => prev ? { ...prev, open: true } : null)}
              title="Locate missing media files"
            >
              <Search size={13}/> Resolve Media ({mediaResolver.unresolvedEls.length})
            </button>
          )}
        </div>

        {/* ── Row 2: Page Nav + Edit + Grid + Zoom + Play→Loop + Alignment ── */}
        <div className="toolbar-row toolbar-row-2">
          {/* Page navigation */}
          <button title="Add new page  [Ctrl+Shift+N]" onClick={() => executeCommand('page-new')}><Plus size={12}/>Pg</button>
          <button title="Duplicate current page" onClick={() => executeCommand('page-duplicate')}><CopyPlus size={12}/>Pg</button>
          <button title="Delete current page" disabled={pages.length <= 1} onClick={() => executeCommand('page-delete')}><Minus size={12}/>Pg</button>
          <button title="Move page up" disabled={cur <= 0} onClick={() => executeCommand('page-move-up')}><ArrowUp size={12}/>Pg</button>
          <button title="Move page down" disabled={cur >= pages.length - 1} onClick={() => executeCommand('page-move-down')}><ArrowDown size={12}/>Pg</button>
          <span className="sep" />
          {/* Undo / Redo */}
          <button title="Undo  [Ctrl+Z]" onClick={() => executeCommand('edit-undo')}><Undo2 size={14}/></button>
          <button title="Redo  [Ctrl+Y]" onClick={() => executeCommand('edit-redo')}><Redo2 size={14}/></button>
          <span className="sep" />
          {/* Clipboard */}
          <button title="Copy  [Ctrl+C]" disabled={!selId && selIds.length === 0} onClick={() => executeCommand('edit-copy')}><Copy size={14}/></button>
          <button title="Paste  [Ctrl+V]" onClick={() => executeCommand('edit-paste')}><Clipboard size={14}/></button>
          <button title="Duplicate  [Ctrl+D]" disabled={!selId && selIds.length === 0} onClick={() => executeCommand('edit-duplicate')}><FilePlus size={14}/></button>
          {(selId || selIds.length > 0) && (
            <button title="Select None  [Esc]" onClick={() => executeCommand('select-none')}><X size={14}/></button>
          )}
          {/* Capture selection → inline PNG Clip */}
          {(selId || selIds.length > 0) && (
            <button
              title="Capture selection → new Clip image  (📸 inline; use inspector 💾 to save to disk)"
              disabled={hotspotSnapBusy}
              onClick={() => snapshotSelectionToClip()}
            ><Camera size={13}/></button>
          )}
          <span className="sep" />
          {/* Grid toggle */}
          {toolbarSections[1].slice(7, 8).map((cmd) => (
            <button key={cmd.id} title={cmd.title} className={cmd.active ? 'on' : ''} onClick={() => executeCommand(cmd.id)}>{cmd.label}</button>
          ))}
          <span className="sep" />
          {/* Zoom controls */}
          <button onClick={() => executeCommand('view-zoom-out')} title="Zoom out  [Ctrl+−]">−</button>
          <span className="zoomlbl" title="Click to fit canvas to window  [Ctrl+0]" style={{cursor:'pointer'}} onClick={() => executeCommand('view-zoom-fit')}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => executeCommand('view-zoom-in')} title="Zoom in  [Ctrl++]">＋</button>
          <button onClick={() => executeCommand('view-zoom-fit')} title="Fit canvas to window  [Ctrl+0]"><Expand size={14}/></button>
          <span className="sep" />
          {/* Play controls: Play → Toggle Loop only */}
          {toolbarSections[1].slice(8, 14).map((cmd) => (
            <button key={cmd.id} title={cmd.title}
              className={`${cmd.active ? 'on' : ''}${cmd.disabled ? ' disabled' : ''}`}
              disabled={cmd.disabled} onClick={() => executeCommand(cmd.id)}>{cmd.label}</button>
          ))}
          {/* Alignment / Distribute / Group — shown to the right of Toggle Loop when 2+ selected */}
          {selIds.length >= 2 && (
            <>
              <span className="sep" />
              {toolbarSections[2].map((cmd) => (
                <button key={cmd.id} title={cmd.title} style={{ fontSize: 11 }}
                  className={`${cmd.active ? 'on' : ''}${cmd.disabled ? ' disabled' : ''}`}
                  disabled={cmd.disabled} onClick={() => executeCommand(cmd.id)}>{cmd.label}</button>
              ))}
            </>
          )}
        </div>
      </div>
      <div className="mme-accent-line" />

      <main className="workspace">
        {panelVisible.left && (
          <aside
            className={`pagestrip${panelCollapsed.left ? ' panel-collapsed' : ''}`}
            style={{ width: panelCollapsed.left ? 28 : panelSizes.left, transition: 'width .15s' }}
          >
            <div className="panel-header">
              <span className="panel-title">{panelCollapsed.left ? '' : <><Layers size={12}/> Pages &amp; Elements</>}</span>
              <button className="panel-btn" title={panelCollapsed.left ? 'Expand panel' : 'Collapse panel'} onClick={() => collapsePanel('left')}>{panelCollapsed.left ? '›' : '‹'}</button>
              <button className="panel-btn" title="Hide panel" onClick={() => togglePanel('left')}>✕</button>
            </div>
            {!panelCollapsed.left && <>
          <div className="pane-title">Pages ({pages.length})</div>
          <div className="pagelist" style={{ height: innerSplitSizes.leftPagesH, flex: 'none', overflow: 'auto' }}>
            {pages.map((pg, i) => (
              <button
                key={pg.id}
                className={`pageitem pageitem-thumb ${i === cur ? 'sel' : ''} ${selectedPageIds.includes(i) ? 'multi-sel' : ''} ${pageDragOverIdx === i ? 'page-drag-over' : ''}`}
                onClick={(e) => handlePageSelect(i, e)}
                draggable
                onDragStart={(e) => handlePageDragStart(e, i)}
                onDragOver={(e) => { e.preventDefault(); setPageDragOverIdx(i) }}
                onDrop={(e) => handlePageDropAt(e, i)}
                onDragEnd={() => setPageDragOverIdx(-1)}
              >
                <PageThumb
                  page={pg}
                  stageWidth={stageWidth}
                  stageHeight={stageHeight}
                  thumbWidth={Math.max(120, (panelSizes.left || 230) - 22)}
                />
                <div className="pageitem-label">
                  <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="name">{pg.name}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="panel-divider panel-divider-h" onMouseDown={(e) => onInnerDividerMouseDown(e, 'leftPagesH')} title="Drag to resize Pages / Elements" />
          <div className="pane-title pane-title-sep">Elements ({currentPage?.elements?.length ?? 0})</div>
          <div className="pagelist elemlist" style={{ height: innerSplitSizes.leftElemH, flex: 'none', overflow: 'auto' }}>
            {/* ── Grouped layer panel ── */}
            {(() => {
              const elems = currentPage?.elements ?? []
              if (!elems.length) return <p className="muted list-empty">No elements</p>
              const sorted = [...elems].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
              /** @type {Record<string, import('./types/desktop-api').SmmElement[]>} */
              const groupMap = {}
              for (const el of sorted) {
                if (el.groupId) {
                  if (!groupMap[el.groupId]) groupMap[el.groupId] = []
                  groupMap[el.groupId].push(el)
                }
              }
              const seenGroups = new Set()
              const rows = []
              const elLabel = (el) => el.elLabel || (el.type.toUpperCase() +
                (el.mediaName ? ` · ${el.mediaName}` :
                  el.type === 'text' ? ` · ${String(el.content || '').slice(0, 12)}` :
                    el.type === 'button' ? ` · ${el.label || ''}` : ''))

              for (const el of sorted) {
                if (el.type === 'group') {
                  // ── Composite group row ──
                  const gid = el.id
                  const isCollapsed = collapsedGroups.has(gid)
                  const gName = el.name || 'Group'
                  const members = el.children || []
                  const isSel = selIds.includes(el.id)
                  rows.push(
                    <div key={`cgh-${gid}`} className={`layer-group-header${isSel ? ' layer-group-header-sel' : ''}`}>
                      <button
                        className="layer-group-toggle"
                        onClick={() => setCollapsedGroups((prev) => { const n = new Set(prev); n.has(gid) ? n.delete(gid) : n.add(gid); return n })}
                        title={isCollapsed ? 'Expand group' : 'Collapse group'}
                      >{isCollapsed ? '▸' : '▾'}</button>
                      {renamingGroup?.id === gid ? (
                        <input
                          className="layer-group-rename"
                          autoFocus
                          value={renamingGroup.val}
                          onChange={(e) => setRenamingGroup({ id: gid, val: e.target.value })}
                          onBlur={() => { patchElemById(gid, { name: renamingGroup.val || gName }); setRenamingGroup(null) }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { patchElemById(gid, { name: renamingGroup.val || gName }); setRenamingGroup(null) } }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="layer-group-name"
                          title="Click to select · Double-click to rename"
                          onClick={() => { setSelId(el.id); setSelIds([el.id]); setInspectorTab('props') }}
                          onDoubleClick={() => setRenamingGroup({ id: gid, val: gName })}
                        >⬚ {gName}</span>
                      )}
                      <span className="layer-group-count">{members.length}</span>
                      <button
                        className={`layer-icon-btn layer-icon-inline${el.visible === false ? ' layer-icon-dim' : ''}`}
                        title={el.visible !== false ? 'Hide group' : 'Show group'}
                        onClick={(e) => { e.stopPropagation(); patchElemById(el.id, { visible: el.visible !== false ? false : true }) }}
                      >{el.visible !== false ? '👁' : '🙈'}</button>
                      <button
                        className={`layer-icon-btn layer-icon-inline${el.locked ? ' layer-icon-locked' : ''}`}
                        title={el.locked ? 'Unlock group' : 'Lock group'}
                        onClick={(e) => { e.stopPropagation(); patchElemById(el.id, { locked: !el.locked }) }}
                      >{el.locked ? '🔒' : '🔓'}</button>
                    </div>
                  )
                  if (!isCollapsed) {
                    for (const child of members) {
                      rows.push(
                        <div key={`cgc-${child.id}`} className="pageitem layer-group-member layer-group-child">
                          <span className="num">↳</span>
                          <span className="name">{elLabel(child)}</span>
                        </div>
                      )
                    }
                  }
                } else if (el.groupId && !seenGroups.has(el.groupId)) {
                  // ── Group header row ──
                  seenGroups.add(el.groupId)
                  const gid = el.groupId
                  const members = groupMap[gid] || []
                  const isCollapsed = collapsedGroups.has(gid)
                  const gName = (currentPage?.groupNames || {})[gid] || gid.slice(0, 6)
                  const allVis = members.every((m) => m.visible !== false)
                  const anyVis = members.some((m) => m.visible !== false)
                  const allLocked = members.every((m) => m.locked)
                  const allSel = members.length > 0 && members.every((m) => selIds.includes(m.id))
                  rows.push(
                    <div key={`gh-${gid}`} className={`layer-group-header${allSel ? ' layer-group-header-sel' : ''}`}>
                      <button
                        className="layer-group-toggle"
                        onClick={() => setCollapsedGroups((prev) => { const n = new Set(prev); n.has(gid) ? n.delete(gid) : n.add(gid); return n })}
                        title={isCollapsed ? 'Expand group' : 'Collapse group'}
                      >{isCollapsed ? '▸' : '▾'}</button>
                      {renamingGroup?.id === gid ? (
                        <input
                          className="layer-group-rename"
                          autoFocus
                          value={renamingGroup.val}
                          onChange={(e) => setRenamingGroup({ id: gid, val: e.target.value })}
                          onBlur={() => { setPageGroupName(gid, renamingGroup.val || gName); setRenamingGroup(null) }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { setPageGroupName(gid, renamingGroup.val || gName); setRenamingGroup(null) } }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="layer-group-name"
                          title="Click to select all · Double-click to rename"
                          onClick={() => { setSelIds(members.map((m) => m.id)); setSelId(members[0]?.id || null); setInspectorTab('props') }}
                          onDoubleClick={() => setRenamingGroup({ id: gid, val: gName })}
                        >{gName}</span>
                      )}
                      <span className="layer-group-count">{members.length}</span>
                      <button
                        className={`layer-icon-btn${!anyVis ? ' layer-icon-dim' : ''}`}
                        title={allVis ? 'Hide group' : 'Show group'}
                        onClick={() => patchGroupById(gid, { visible: !allVis })}
                      >{anyVis ? '👁' : '🙈'}</button>
                      <button
                        className={`layer-icon-btn${allLocked ? ' layer-icon-locked' : ''}`}
                        title={allLocked ? 'Unlock group' : 'Lock group'}
                        onClick={() => patchGroupById(gid, { locked: !allLocked })}
                      >{allLocked ? '🔒' : '🔓'}</button>
                    </div>
                  )
                  if (!isCollapsed) {
                    // ── Group member rows ──
                    for (const mem of members) {
                      const isSel = selIds.includes(mem.id)
                      rows.push(
                        <div
                          key={mem.id}
                          className={`pageitem layer-group-member${isSel ? ' sel' : ''}${mem.locked ? ' layer-locked' : ''}`}
                          onClick={(e) => {
                            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                              setSelIds((prev) => prev.includes(mem.id) ? prev.filter((id) => id !== mem.id) : [...prev, mem.id])
                              setSelId(mem.id)
                            } else { setSelId(mem.id); setSelIds([mem.id]) }
                            setInspectorTab('props')
                          }}
                        >
                          <span className="num">{String(mem.z ?? 0).padStart(2, '0')}</span>
                          <span className="name">{elLabel(mem)}</span>
                          <button
                            className={`layer-icon-btn layer-icon-inline${mem.visible === false ? ' layer-icon-dim' : ''}`}
                            onClick={(e) => { e.stopPropagation(); patchElemById(mem.id, { visible: mem.visible !== false ? false : true }) }}
                            title={mem.visible !== false ? 'Hide' : 'Show'}
                          >{mem.visible !== false ? '👁' : '🙈'}</button>
                          <button
                            className={`layer-icon-btn layer-icon-inline${mem.locked ? ' layer-icon-locked' : ''}`}
                            onClick={(e) => { e.stopPropagation(); patchElemById(mem.id, { locked: !mem.locked }) }}
                            title={mem.locked ? 'Unlock' : 'Lock'}
                          >{mem.locked ? '🔒' : '🔓'}</button>
                        </div>
                      )
                    }
                  }
                } else if (!el.groupId) {
                  // ── Ungrouped element row ──
                  const isSel = selIds.includes(el.id)
                  rows.push(
                    <div
                      key={el.id}
                      className={`pageitem${isSel ? ' sel' : ''}${el.locked ? ' layer-locked' : ''}`}
                      onClick={(e) => {
                        if (e.shiftKey || e.ctrlKey || e.metaKey) {
                          setSelIds((prev) => prev.includes(el.id) ? prev.filter((id) => id !== el.id) : [...prev, el.id])
                          setSelId(el.id)
                        } else { setSelId(el.id); setSelIds([el.id]) }
                        setInspectorTab('props')
                      }}
                    >
                      <span className="num">{String(el.z ?? 0).padStart(2, '0')}</span>
                      <span className="name">{elLabel(el)}</span>
                      <button
                        className={`layer-icon-btn layer-icon-inline${el.visible === false ? ' layer-icon-dim' : ''}`}
                        onClick={(e) => { e.stopPropagation(); patchElemById(el.id, { visible: el.visible !== false ? false : true }) }}
                        title={el.visible !== false ? 'Hide' : 'Show'}
                      >{el.visible !== false ? '👁' : '🙈'}</button>
                      <button
                        className={`layer-icon-btn layer-icon-inline${el.locked ? ' layer-icon-locked' : ''}`}
                        onClick={(e) => { e.stopPropagation(); patchElemById(el.id, { locked: !el.locked }) }}
                        title={el.locked ? 'Unlock' : 'Lock'}
                      >{el.locked ? '🔒' : '🔓'}</button>
                    </div>
                  )
                }
              }
              return rows
            })()}
          </div>
          <div className="panel-divider panel-divider-h" onMouseDown={(e) => onInnerDividerMouseDown(e, 'leftElemH')} title="Drag to resize Elements / Media Library" />

          {/* Media Library — all unique media across the whole document */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div className="pane-title pane-title-sep media-lib-title">
            <span>Media Library</span>
            <button
              className="media-lib-toggle"
              title={showMediaLib ? 'Collapse' : 'Expand'}
              onClick={() => setShowMediaLib((v) => !v)}
            >{showMediaLib ? '▾' : '▸'}</button>
          </div>
          {showMediaLib && (() => {
            const seen = new Set()
            const items = []
            pages.forEach((pg) => {
              if (pg.bgMediaSrc && !seen.has(pg.bgMediaSrc)) {
                seen.add(pg.bgMediaSrc)
                items.push({ file: pg.bgMediaSrc, kind: pg.bgMediaKind || 'image', name: 'BG', sourcePath: null })
              }
              ;(pg.elements || []).forEach((el) => {
                if (el.file && !seen.has(el.file)) {
                  seen.add(el.file)
                  items.push({ file: el.file, kind: el.mediaKind || 'image', name: el.mediaName || el.elLabel || el.type, sourcePath: el.mediaSourcePath || null })
                }
              })
            })
            const filterLc = mediaLibFilter.toLowerCase()
            const filtered = filterLc ? items.filter(it => it.name.toLowerCase().includes(filterLc) || it.kind.toLowerCase().includes(filterLc)) : items
            const recentFiltered = filterLc ? recentMedia.filter(it => it.name.toLowerCase().includes(filterLc) || it.kind.toLowerCase().includes(filterLc)) : recentMedia
            const mkItem = (item, key) => (
              <button
                key={key}
                className="media-lib-item"
                draggable="true"
                title={item.name + ' (' + item.kind + ')\nClick or drag to canvas'}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('application/smm-media', JSON.stringify(item)) }}
                onClick={() => addMediaItemToPage(item, null, null)}
              >
                {item.kind === 'image' && item.file && item.file.startsWith('data:')
                  ? <img src={item.file} className="media-lib-thumb" alt={item.name} />
                  : <span className="media-lib-icon">{item.kind === 'video' ? '🎬' : item.kind === 'audio' ? '🎵' : '🖼'}</span>
                }
                <span className="media-lib-name">{item.name}</span>
              </button>
            )
            return (
              <>
                <div className="media-lib-search-wrap">
                  <input className="media-lib-search" type="search" placeholder="Filter media…" value={mediaLibFilter} onChange={e => setMediaLibFilter(e.target.value)} />
                  {mediaLibFilter && <button className="media-lib-search-clear" onClick={() => setMediaLibFilter('')} title="Clear filter">✕</button>}
                </div>
                {recentFiltered.length > 0 && (
                  <>
                    <div className="media-lib-section-label">Recent</div>
                    <div className="media-lib-grid">{recentFiltered.map((it, i) => mkItem(it, 'r' + i))}</div>
                  </>
                )}
                <div className="media-lib-section-label">All Media</div>
                <div className="media-lib-grid">
                  {filtered.length === 0 && <p className="muted list-empty">{items.length === 0 ? 'No media' : 'No matches'}</p>}
                  {filtered.map((it, i) => mkItem(it, 'a' + i))}
                </div>
              </>
            )
          })()}
          </div>
            </>}
          </aside>
        )}
        {panelVisible.left && !panelCollapsed.left && (
          <div className="panel-divider panel-divider-v" onMouseDown={(e) => onPanelDividerMouseDown(e, 'left')} title="Drag to resize" />
        )}

        <section className="stage-area">
          <div className="stage-top">
            <span className="top-label">
              {stageWidth} x {stageHeight} | Tool: {tool.toUpperCase()}
            </span>
            <div className="layer-tools">
              <button onClick={() => executeCommand('layer-front')} disabled={!selectedEl}>Front</button>
              <button onClick={() => executeCommand('layer-up')} disabled={!selectedEl}>Up</button>
              <button onClick={() => executeCommand('layer-down')} disabled={!selectedEl}>Down</button>
              <button onClick={() => executeCommand('layer-back')} disabled={!selectedEl}>Back</button>
            </div>
          </div>

          {/* ── Floating Text Format Bar ──────────────────── */}
          {selectedEl?.type === 'text' && (
            <TextFormatBar el={selectedEl} onChange={updateElement} />
          )}
          <div className="scroll" ref={scrollRef}>
            <div className={spreadView ? 'spread-pair' : ''}>
            <div
              ref={stageRef}
              className={`stage tool-${tool}`}
              style={{ width: stageWidth, height: stageHeight, zoom: zoom, '--smm-stage-h': `${stageHeight}px` }}
              onMouseDown={onStageMouseDown}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
              onDrop={(e) => {
                e.preventDefault()
                const raw = e.dataTransfer.getData('application/smm-media')
                if (!raw || !currentPage) return
                try {
                  const item = JSON.parse(raw)
                  const rect = stageRef.current.getBoundingClientRect()
                  addMediaItemToPage(item, (e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom)
                  setStatus('Dropped: ' + item.name)
                } catch (err) { void err }
              }}
            >
              <canvas ref={bgRef} width={stageWidth} height={stageHeight} className="bg" />

              {/* Video background overlay in editor (images are drawn on canvas) */}
              {currentPage?.bgMediaSrc && currentPage.bgMediaKind === 'video' && (
                <video
                  key={currentPage.bgMediaSrc}
                  src={currentPage.bgMediaSrc}
                  autoPlay muted loop playsInline
                  onCanPlay={e => { e.currentTarget.style.opacity = '1' }}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 2, pointerEvents: 'none', opacity: 0, transition: 'opacity 0.2s' }}
                />
              )}

              {currentPage?.elements
                ?.slice()
                .sort((a, b) => a.z - b.z)
                .map((el) => {
                  const isPreviewing = animPreviewId === el.id
                  /** @type {import('react').CSSProperties} */
                  const elemStyle = {
                    left: el.x,
                    top: el.y,
                    width: el.w,
                    height: el.h,
                    zIndex: el.z + 3,
                    visibility: el.visible === false ? 'hidden' : 'visible',
                  }
                  if (isPreviewing) {
                    const pd = ANIM_IN_TYPES.find(a => a.key === el.animIn)
                    if (pd?.css) {
                      const isScroll = el.animIn === 'scroll-up-credits' || el.animIn === 'scroll-down-credits'
                      elemStyle.animation = `${pd.css} ${el.animInDuration || 600}ms ${el.animInEasing || 'ease-out'} both`
                      if (!isScroll) elemStyle.opacity = 0
                    }
                  }
                  /* ── Composite group element — early return ── */
                  if (el.type === 'group') {
                    const isGroupSel = selIds.includes(el.id)
                    return (
                      <div
                        key={el.id}
                        className={`elem elem-group${isGroupSel ? ' elem-sel' : ''}${el.locked ? ' elem-locked' : ''}`}
                        style={elemStyle}
                        onMouseDown={(e) => onElemMouseDown(e, el)}
                        onDoubleClick={() => setRenamingGroup({ id: el.id, val: el.name || 'Group' })}
                      >
                        {(el.children || []).map((child) => (
                          <div
                            key={child.id}
                            className={`elem-group-child elem-gc-${child.type}`}
                            style={{
                              position: 'absolute',
                              left: child.x, top: child.y, width: child.w, height: child.h,
                              visibility: child.visible === false ? 'hidden' : 'visible',
                              overflow: 'hidden',
                              boxSizing: 'border-box',
                            }}
                          >
                            {child.type === 'text' && (
                              <div style={{
                                fontFamily: `${child.font || 'Rajdhani'}, sans-serif`,
                                fontSize: child.size,
                                fontWeight: child.weight || 700,
                                color: child.color || '#e8a020',
                                textAlign: child.align || 'left',
                                width: '100%', height: '100%',
                                display: 'flex',
                                alignItems: ({ top: 'flex-start', middle: 'center', bottom: 'flex-end' }[child.vAlign] || 'center'),
                                overflow: 'hidden',
                                wordBreak: 'break-word',
                                background: child.bgOn ? child.bgColor : 'transparent',
                              }}
                                dangerouslySetInnerHTML={{ __html: esc(child.content).replaceAll('\n', '<br/>') }}
                              />
                            )}
                            {(child.type === 'clip' || child.type === 'mpeg') && child.file && (
                              <img src={child.file} alt="" style={{ width: '100%', height: '100%', objectFit: child.fit || 'contain', opacity: (child.opacity ?? 100) / 100 }} />
                            )}
                            {(child.type === 'clip' || child.type === 'mpeg') && !child.file && (
                              <div style={{ width: '100%', height: '100%', border: '1px dashed rgba(74,143,192,.35)', display: 'grid', placeItems: 'center', color: 'rgba(74,143,192,.4)', fontSize: 10 }}>
                                {child.type.toUpperCase()}
                              </div>
                            )}
                            {child.type === 'button' && (
                              <div style={{
                                background: child.bgColor || '#1a3a5c',
                                color: child.fgColor || '#e8a020',
                                border: `${child.borderWidth || 2}px solid ${child.borderColor || '#4a8fc0'}`,
                                width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: child.size || 14, fontWeight: 600,
                                boxSizing: 'border-box',
                              }}>
                                {child.label || 'Button'}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="group-name-badge">⬚ {el.name || 'Group'}</div>
                        {isGroupSel && <div className="selring" />}
                        {selId === el.id && (
                          <>
                            {['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'].map((h) => (
                              <button key={h} className={`resize-handle ${h}`} onMouseDown={(evt) => onResizeHandleMouseDown(evt, el, h)} tabIndex={-1} aria-label={`Resize ${h}`} />
                            ))}
                          </>
                        )}
                      </div>
                    )
                  }
                  return (
                  <div
                    key={isPreviewing ? `${el.id}-p${animPreviewKey}` : el.id}
                    className={`elem elem-${el.type}${selIds.includes(el.id) ? ' elem-sel' : ''}${el.groupId ? ' elem-grouped' : ''}${el.interactive ? ' elem-interactive' : ''}`}
                    style={elemStyle}
                    onMouseDown={(e) => onElemMouseDown(e, el)}
                    onDoubleClick={(e) => {
                      if (el.type === 'text') { onElemDoubleClick(e, el); return }
                      if (el.type === 'clip') chooseMedia('el', 'all')
                      if (el.type === 'mpeg') chooseMedia('el', 'video')
                      if (el.type === 'button') openBtnEditorExisting(el)
                    }}
                  >
                    {el.type === 'text' && (
                      <div
                        className={`ei text${el.textScrollable ? ' text-scrollable' : ''}`}
                        style={{
                          fontFamily: `${el.font || 'Rajdhani'}, sans-serif`,
                          fontSize: el.size,
                          fontWeight: el.weight,
                          color: el.color,
                          textAlign: el.align,
                          display: 'flex',
                          alignItems: ({ top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.vAlign] || 'center'),
                          fontStyle: el.italic ? 'italic' : 'normal',
                          textDecoration: el.underline ? 'underline' : 'none',
                          textShadow: el.shadow ? '2px 2px 4px rgba(0,0,0,.7)' : 'none',
                          WebkitTextStroke: el.outline ? `1px ${el.outlineColor || 'rgba(0,0,0,0.7)'}` : '0',
                          background: el.bgOn ? el.bgColor : 'transparent',
                          overflow: (el.animIn === 'scroll-up-credits' || el.animIn === 'scroll-down-credits') ? 'visible' : undefined,
                          ...getTextStyleProps(el),
                          cursor: selIds.includes(el.id) ? 'text' : 'default',
                          // Hide display while editing so only the textarea is visible
                          visibility: inlineEditId === el.id ? 'hidden' : 'visible',
                        }}
                        onClick={(e) => {
                          // Second click on already-selected text → open inline edit
                          if (preClickSelRef.current?.includes(el.id) && inlineEditId !== el.id) {
                            e.stopPropagation()
                            setInlineEditId(el.id)
                          }
                        }}
                        dangerouslySetInnerHTML={{ __html: esc(el.content).replaceAll('\n', '<br/>') }}
                      />
                    )}

                    {el.type === 'clip' && (
                      <div className={`ei clip${el.shapeButton ? ' shape-btn-el' : ''}`} style={getMediaShadowStyle(el)}>
                        {/* Shape Button preview badge */}
                        {el.shapeButton && <span className="shape-btn-badge">🎯 Shape</span>}

                        {(el.file && (el.mediaKind || detectMediaKind(el.file)) === 'image') && (
                          el.shapeButton ? (
                            <ShapeButton
                              src={el.file}
                              width={el.w}
                              height={el.h}
                              bevel={!!el.sbBevel}
                              bevelIntensity={el.sbBevelIntensity ?? 3}
                              colorOverlay={el.sbOverlayOn ? (el.sbOverlayColor || null) : null}
                              colorOverlayOpacity={el.sbOverlayOpacity ?? 0.35}
                              lightDirection={el.sbLightDir ?? [0.55, 0.70, 0.80]}
                              opacity={(el.opacity ?? 100) / 100}
                              style={{ width: '100%', height: '100%' }}
                              previewOnly
                            />
                          ) : (
                            <img
                              src={el.file}
                              alt=""
                              onError={() => setStatus(`Media decode failed: ${el.mediaName || el.mediaExt || 'image'}`)}
                              style={{
                                objectFit: el.fit,
                                opacity: (el.opacity || 100) / 100,
                                clipPath: el.snapshotShape ? (hotspotShapeToClipPath(el.snapshotShape, el.snapshotPoints || []) || undefined) : undefined,
                              }}
                            />
                          )
                        )}
                        {(el.file && (el.mediaKind || detectMediaKind(el.file)) === 'video') && (
                          <video
                            key={el.file}
                            src={el.file}
                            autoPlay
                            muted
                            playsInline
                            loop
                            controls={el.showMediaControls !== false}
                            onCanPlay={e => { e.currentTarget.style.opacity = String((el.opacity || 100) / 100) }}
                            onError={() => setStatus(`Media decode failed: ${el.mediaName || el.mediaExt || 'video'}`)}
                            style={{ width: '100%', height: '100%', objectFit: el.fit || 'contain', opacity: 0, transition: 'opacity 0.15s' }}
                          />
                        )}
                        {(el.file && (el.mediaKind || detectMediaKind(el.file)) === 'audio') && (
                          <div className="clip-audio">
                            {el.audioHidden ? (
                              <div className="media-frame-icon">
                                <span className="media-frame-note">🎵</span>
                                <span className="media-frame-label" title={el.mediaName}>{el.mediaName || 'Audio'}</span>
                                <span className="media-frame-hint" style={{ color: '#e8a020' }}>Hidden in presentation — audio still plays</span>
                              </div>
                            ) : isMidiMedia(el.mediaName || el.file) ? (
                              <MidiClipPlayer
                                src={el.file}
                                label={el.mediaName || 'MIDI clip'}
                                onError={(message) => setStatus(`Media decode failed: ${message}`)}
                              />
                            ) : el.showMediaControls === false ? (
                              <div className="media-frame-icon">
                                <span className="media-frame-note">♪</span>
                                <span className="media-frame-label" title={el.mediaName}>{el.mediaName || 'Audio'}</span>
                                <span className="media-frame-hint">Controls hidden in presentation</span>
                              </div>
                            ) : (
                              <AudioClipPlayer
                                src={el.file}
                                label={el.mediaName || 'Audio clip'}
                                loop={el.loop || false}
                                onError={(message) => setStatus(`Media decode failed: ${message}`)}
                              />
                            )}
                          </div>
                        )}
                        {!el.file && <span>Clip</span>}
                        {el.frameBorder?.enabled && (
                          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, ...getFrameCSS(el.frameBorder) }} />
                        )}
                      </div>
                    )}

                    {el.type === 'button' && (() => {
                      const edShape = BTN_SHAPES.find((s) => s.key === el.btnShape)
                      const edBw = el.borderWidth ?? 2
                      const edFillBg = el.btnImage
                        ? `url(${el.btnImage}) center/cover no-repeat`
                        : (el.btnGrad || el.bgColor || '#1a3a5c')
                      const edCommon = {
                        fontSize: el.fontSize || 14,
                        fontFamily: `${el.font || 'Rajdhani'}, sans-serif`,
                        fontWeight: el.fontWeight || '600',
                        textShadow: el.textShadow ? '1px 1px 3px rgba(0,0,0,.8)' : 'none',
                        boxShadow: el.bevel ? 'inset 2px 2px 4px rgba(255,255,255,.2), inset -2px -2px 4px rgba(0,0,0,.4)' : 'none',
                        filter: el.btnShadow ? 'drop-shadow(2px 3px 5px rgba(0,0,0,.6))' : undefined,
                      }
                      if (edShape?.clipPath) {
                        return (
                          <>
                            {/* Border ring layer: full area clipped to shape, filled with borderColor */}
                            <div style={{
                              position: 'absolute', inset: 0,
                              background: el.borderColor || '#4a8fc0',
                              clipPath: edShape.clipPath,
                              pointerEvents: 'none', zIndex: 0,
                            }} />
                            {/* Fill layer: inset by borderWidth, same clip-path */}
                            <button
                              className={`ei btn${el.bevel ? ' bevel' : ''}`}
                              style={{
                                position: 'absolute',
                                top: edBw, left: edBw, right: edBw, bottom: edBw,
                                width: 'auto', height: 'auto',
                                background: edFillBg,
                                color: el.fgColor || '#e8a020',
                                border: 'none', borderRadius: '0px',
                                clipPath: edShape.clipPath,
                                zIndex: 1,
                                ...edCommon,
                              }}
                              tabIndex={-1}
                            >
                              {!el.btnImage && el.label}
                            </button>
                          </>
                        )
                      }
                      return (
                        <button
                          className={`ei btn${el.bevel ? ' bevel' : ''}`}
                          style={{
                            background: edFillBg,
                            color: el.fgColor || '#e8a020',
                            borderColor: el.borderColor || '#4a8fc0',
                            borderWidth: edBw,
                            borderRadius: edShape?.radius || el.radius || '0px',
                            ...edCommon,
                          }}
                          tabIndex={-1}
                        >
                          {!el.btnImage && el.label}
                        </button>
                      )
                    })()}

                    {el.type === 'mpeg' && (
                      <div className="ei mpeg">
                        {el.file ? (
                          <video
                            key={el.file}
                            src={el.file}
                            autoPlay
                            muted
                            playsInline
                            loop
                            controls={el.showMediaControls !== false}
                            onError={() => setStatus(`Media decode failed: ${el.mediaName || el.mediaExt || 'video'}`)}
                            style={{ width: '100%', height: '100%', objectFit: el.fit || 'contain' }}
                          />
                        ) : (
                          '▶'
                        )}
                        {el.frameBorder?.enabled && (
                          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, ...getFrameCSS(el.frameBorder) }} />
                        )}
                      </div>
                    )}

                    {/* ── Hotspot element rendering ── */}
                    {el.type === 'hotspot' && (() => {
                      const w = el.w, h = el.h
                      const bw = el.borderOn ? (el.borderWidth ?? 2) : 0
                      const bc = el.borderColor || '#3cb8be'
                      const bs = el.borderStyle === 'none' ? '0' : (el.borderStyle === 'dotted' ? `${bw*3},${bw*2}` : bw > 0 ? `${bw*4},${bw*3}` : '0')
                      const isSolid = el.borderStyle === 'solid'
                      // Generate SVG shape path/element
                      const shape = el.hotspotShape || 'rect'
                      const pts = el.points || []
                      const cx = w / 2, cy = h / 2, rx = w / 2 - bw/2, ry = h / 2 - bw/2

                      // Helper: polygon points for regular n-gon
                      const ngon = (n, startAngle = -Math.PI/2) => Array.from({ length: n }, (_, i) => {
                        const a = startAngle + (2 * Math.PI * i) / n
                        return `${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`
                      }).join(' ')

                      // Star polygon
                      const star = (n = 5) => Array.from({ length: n * 2 }, (_, i) => {
                        const a = -Math.PI / 2 + (Math.PI * i) / n
                        const r = i % 2 === 0 ? Math.min(rx, ry) : Math.min(rx, ry) * 0.42
                        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
                      }).join(' ')

                      /** @type {import('react').SVGAttributes<SVGElement>} */
                      const strokeProps = {
                        fill: el.fillOpacity > 0 ? el.fillColor || '#ffffff' : 'transparent',
                        fillOpacity: el.fillOpacity || 0,
                        stroke: bw > 0 ? bc : 'none',
                        strokeWidth: bw,
                        strokeDasharray: isSolid ? undefined : bs,
                        strokeLinecap: /** @type {'round'} */('round'),
                        pointerEvents: 'all',
                      }

                      let svgShape = null
                      if (shape === 'rect') {
                        const rtl = el.hotspotRadiusTL ?? 0, rtr = el.hotspotRadiusTR ?? 0
                        const rbl = el.hotspotRadiusBL ?? 0, rbr = el.hotspotRadiusBR ?? 0
                        const anyR = rtl || rtr || rbl || rbr
                        const x0 = bw/2, y0 = bw/2, rw = w - bw, rh = h - bw
                        svgShape = anyR
                          ? <path d={`M${x0+rtl},${y0} L${x0+rw-rtr},${y0} Q${x0+rw},${y0} ${x0+rw},${y0+rtr} L${x0+rw},${y0+rh-rbr} Q${x0+rw},${y0+rh} ${x0+rw-rbr},${y0+rh} L${x0+rbl},${y0+rh} Q${x0},${y0+rh} ${x0},${y0+rh-rbl} L${x0},${y0+rtl} Q${x0},${y0} ${x0+rtl},${y0} Z`} {...strokeProps} />
                          : <rect x={x0} y={y0} width={rw} height={rh} {...strokeProps} />
                      } else if (shape === 'oval' || shape === 'circle') {
                        svgShape = <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...strokeProps} />
                      } else if (shape === 'hexagon') {
                        svgShape = <polygon points={ngon(6, 0)} {...strokeProps} />
                      } else if (shape === 'pentagon') {
                        svgShape = <polygon points={ngon(5)} {...strokeProps} />
                      } else if (shape === 'octagon') {
                        svgShape = <polygon points={ngon(8, 0)} {...strokeProps} />
                      } else if (shape === 'triangle') {
                        svgShape = <polygon points={ngon(3)} {...strokeProps} />
                      } else if (shape === 'diamond') {
                        svgShape = <polygon points={`${cx},${bw/2} ${w - bw/2},${cy} ${cx},${h - bw/2} ${bw/2},${cy}`} {...strokeProps} />
                      } else if (shape === 'star') {
                        svgShape = <polygon points={star(5)} {...strokeProps} />
                      } else if (shape === 'freehand' && pts.length >= 3) {
                        const polyPts = pts.map((p) => `${p.x * w},${p.y * h}`).join(' ')
                        svgShape = <polygon points={polyPts} {...strokeProps} />
                      } else {
                        svgShape = <rect x={bw/2} y={bw/2} width={w - bw} height={h - bw} {...strokeProps} />
                      }

                      return (
                        <div className="ei hotspot-el" style={{ position: 'absolute', inset: 0 }}>
                          <svg
                            width="100%"
                            height="100%"
                            viewBox={`0 0 ${w} ${h}`}
                            style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
                          >
                            {svgShape}
                          </svg>
                          {/* Editor-only label badge */}
                          {(el.label || el.action !== 'none') && (
                            <div className="hotspot-badge">
                              🎯 {el.label || el.action}
                            </div>
                          )}
                          {/* Action indicator */}
                          {!el.label && el.action === 'none' && (
                            <div className="hotspot-badge hotspot-badge-unset">
                              🎯 Hotspot
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* ── MenuBar element rendering ── */}
                    {el.type === 'menubar' && (
                      <div
                        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                        onDoubleClick={(e) => { e.stopPropagation(); setMenuBarEditEl({ pageIdx: cur, elId: el.id, el }) }}
                      >
                        <MenuBarElement
                          el={el}
                          isEditor={true}
                          stageWidth={stageWidth}
                          stageHeight={stageHeight}
                          zoom={zoom}
                        />
                      </div>
                    )}
                    {(el.animIn && el.animIn !== 'none') && (
                      <div className="anim-badge" title={`Fly in: ${el.animIn}${el.animOut && el.animOut !== 'none' ? ' → ' + el.animOut : ''}`}>
                        ▶ {el.animIn}{el.animOut && el.animOut !== 'none' ? ' →' : ''}
                      </div>
                    )}

                    {/* Selection ring — shows for all selected elements */}
                    {selIds.includes(el.id) && (
                      <div className={`selring${el.groupId ? ' selring-grouped' : ''}`} />
                    )}
                    {/* Resize handles — only for the primary selected element */}
                    {selId === el.id && (
                      <>
                        {['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'].map((h) => (
                          <button
                            key={h}
                            className={`resize-handle ${h}`}
                            onMouseDown={(evt) => onResizeHandleMouseDown(evt, el, h)}
                            tabIndex={-1}
                            aria-label={`Resize ${h}`}
                          />
                        ))}
                      </>
                    )}
                    {/* Group badge */}
                    {el.groupId && selIds.includes(el.id) && (
                      <div className="group-badge" title={`Group: ${el.groupId.slice(0, 8)}`}>⬚</div>
                    )}
                  </div>
                  )
                })}

              {/* Snap alignment guides */}
              {snapGuides.map((g, i) =>
                g.axis === 'x' ? (
                  <div key={i} className="snap-guide snap-guide-x" style={{ left: g.pos }} />
                ) : (
                  <div key={i} className="snap-guide snap-guide-y" style={{ top: g.pos }} />
                )
              )}

              {/* ── Hotspot live draw preview ── */}
              {tool === 'hotspot' && hsDrawing && (() => {
                const px = Math.min(hsDrawing.x0, hsDrawing.x1)
                const py = Math.min(hsDrawing.y0, hsDrawing.y1)
                const pw = Math.abs(hsDrawing.x1 - hsDrawing.x0)
                const ph = Math.abs(hsDrawing.y1 - hsDrawing.y0)
                if (pw < 2 && ph < 2) return null
                return (
                  <div className="hs-draw-preview" style={{ left: px, top: py, width: pw, height: ph, pointerEvents: 'none', zIndex: 200 }}>
                    <svg width="100%" height="100%" viewBox={`0 0 ${pw} ${ph}`} style={{ position: 'absolute', inset: 0 }}>
                      {(hotspotShape === 'oval' || hotspotShape === 'circle') ? (
                        <ellipse cx={pw/2} cy={ph/2} rx={pw/2-1} ry={ph/2-1} fill="rgba(60,184,190,0.08)" stroke="#3cb8be" strokeWidth={1.5} strokeDasharray="5,4" />
                      ) : hotspotShape === 'star' ? (
                        <polygon points={(() => {
                          const cx2=pw/2, cy2=ph/2
                          const rx2=pw/2-1, ry2=ph/2-1
                          return Array.from({length:10},(_,i)=>{const a=-Math.PI/2+(Math.PI*i)/5;const r=i%2===0?Math.min(rx2,ry2):Math.min(rx2,ry2)*0.42;return `${cx2+r*Math.cos(a)},${cy2+r*Math.sin(a)}`}).join(' ')
                        })()} fill="rgba(60,184,190,0.08)" stroke="#3cb8be" strokeWidth={1.5} strokeDasharray="5,4" />
                      ) : (
                        <rect x={1} y={1} width={pw-2} height={ph-2} fill="rgba(60,184,190,0.08)" stroke="#3cb8be" strokeWidth={1.5} strokeDasharray="5,4" />
                      )}
                    </svg>
                  </div>
                )
              })()}

              {/* ── Freehand polygon live preview ── */}
              {tool === 'hotspot' && hotspotShape === 'freehand' && hsFreehandPts.length > 0 && (
                <svg style={{ position: 'absolute', inset: 0, width: stageWidth, height: stageHeight, zIndex: 200, pointerEvents: 'none' }}>
                  {hsFreehandPts.map((pt, i) => (
                    <circle key={i} cx={pt.x} cy={pt.y} r={4} fill="#3cb8be" stroke="#fff" strokeWidth={1} />
                  ))}
                  {hsFreehandPts.length > 1 && (
                    <polyline
                      points={hsFreehandPts.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(60,184,190,0.08)"
                      stroke="#3cb8be"
                      strokeWidth={1.5}
                      strokeDasharray="5,3"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              )}

              {/* Inline text editor — activated by double-click or second-click on selected text */}
              {/* Rendered INSIDE the CSS-zoomed .stage div — do NOT multiply coords by zoom */}
              {inlineEditId && (() => {
                const itel = currentPage?.elements.find((e) => e.id === inlineEditId)
                if (!itel) return null
                return (
                  <textarea
                    key={inlineEditId}
                    autoFocus
                    className="inline-text-edit"
                    style={{
                      left: itel.x,
                      top: itel.y,
                      width: itel.w,
                      height: itel.h,
                      fontSize: itel.size || 36,
                      fontFamily: `'${itel.font || 'Rajdhani'}', sans-serif`,
                      fontWeight: itel.weight || '700',
                      color: itel.color || '#e8a020',
                      textAlign: itel.align || 'left',
                      fontStyle: itel.italic ? 'italic' : 'normal',
                      textDecoration: itel.underline ? 'underline' : 'none',
                      background: itel.bgOn ? itel.bgColor : 'transparent',
                      lineHeight: itel.lineHeight ? `${itel.lineHeight}` : '1.35',
                      letterSpacing: itel.letterSpacing ? `${itel.letterSpacing}px` : undefined,
                      padding: '4px 8px',
                      verticalAlign: itel.verticalAlign || 'middle',
                    }}
                    value={itel.content || ''}
                    onChange={(e) => updateElement({ content: e.target.value })}
                    onBlur={() => setInlineEditId(null)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Escape') { ev.preventDefault(); setInlineEditId(null) }
                      ev.stopPropagation()
                    }}
                  />
                )
              })()}

            </div>{/* end stage */}
            {spreadView && (
              <SpreadGhostStage
                page={pages[cur + 1]}
                pageNum={cur + 2}
                stageWidth={stageWidth}
                stageHeight={stageHeight}
                zoom={zoom}
                onClick={() => goToPage(cur + 1)}
              />
            )}
            </div>{/* spread-pair */}
          </div>{/* scroll */}

          {playIdx >= 0 && (
            <PresentationPlayer
              pages={pages}
              stage={stage}
              startIdx={playIdx}
              onClose={stopPlay}
              loop={presentationLoop}
              onNavigate={(newIdx) => { setPlayerCurIdx(newIdx) }}
              showControls={presentationShowControls}
              interactive={presentationInteractive}
              hideMediaControls={presentationHideMediaControls || presentationInteractive}
              devMode={presentationDevMode}
              projectVars={projectVars}
              presentationAudio={presentationAudio}
              preCreatedAudioRef={outerPresAudioRef}
              onUpdatePages={(newPages) => { setPages(newPages) }}
            />
          )}

          {btnEditor.open && (
            <ButtonEditorModal
              initial={btnEditor.data}
              pages={pages}
              pickFile={pickFile}
              onConfirm={onBtnEditorConfirm}
              onCancel={() => setBtnEditor({ open: false, elId: null, data: null })}
            />
          )}

          {chromaKeyModalEl && (() => {
            // Resolve the actual playable src — el.file may be null for http-served clips
            const _el = chromaKeyModalEl
            const _resolvedSrc = (_el.chromaOrigFile)
              || (_el.file && !isUnresolvedMediaPath(_el.file) ? _el.file : null)
              || (_el.mediaSourcePath ? makeAppMediaUrl(_el.mediaSourcePath) : null)
              || _el.file
            return (
              <ChromaKeyModal
                src={_resolvedSrc}
                origSrc={_el.chromaOrigFile || _resolvedSrc}
                mediaKind={_el.mediaKind || 'image'}
                onApply={(resultDataUrl, _meta) => {
                  const elId = _el.id
                  const origFile = _el.chromaOrigFile || _resolvedSrc

                  if (_meta?.wasVideo) {
                    // Video chroma key — store parameters, keep video playing via VideoChromaCanvas
                    setPages(prev => prev.map(pg => ({
                      ...pg,
                      elements: pg.elements.map(e => e.id !== elId ? e : {
                        ...e,
                        // Restore original video src if it was previously baked to PNG
                        file: origFile || e.file,
                        chromaOrigFile: origFile,
                        chromaColor:     _meta.chromaColor     || null,
                        chromaTolerance: _meta.tolerance       != null ? _meta.tolerance  : 30,
                        chromaSoftness:  _meta.softness        != null ? _meta.softness   : 8,
                        chromaMaskShape: _meta.liveMaskShape   || null,
                      }),
                    })))
                    setChromaKeyModalEl(null)
                    setStatus('Chroma key applied to video')
                    return
                  }

                  // Image sources — bake PNG
                  if (!resultDataUrl) { setChromaKeyModalEl(null); return }
                  const blobUrl = internDataUrl(resultDataUrl)
                  setPages(prev => prev.map(pg => ({
                    ...pg,
                    elements: pg.elements.map(e => e.id !== elId ? e : {
                      ...e,
                      file: blobUrl,
                      chromaOrigFile: origFile,
                    }),
                  })))
                  setChromaKeyModalEl(null)
                  setStatus('Background removal applied')
                }}
                onCancel={() => setChromaKeyModalEl(null)}
              />
            )
          })()}

      {frameBorderEl && (
        <FrameBorderEditor
          el={frameBorderEl}
          onApply={(frameData) => {
            const elId = frameBorderEl.id
            setPages(prev => prev.map(pg => ({
              ...pg,
              elements: pg.elements.map(e => e.id !== elId ? e : { ...e, frameBorder: frameData }),
            })))
            setFrameBorderEl(null)
            setStatus('Frame/border applied')
          }}
          onCancel={() => setFrameBorderEl(null)}
        />
      )}
      {memGameEditorOpen && (
            <MemoryGameEditorModal
              initial={pages.find(p => p.templateId === 'memory-game')?.mgConfig ?? DEFAULT_MEM_GAME_CONFIG}
              pickFile={pickFile}
              onConfirm={cfg => regenerateMemoryGame(cfg)}
              onCancel={() => setMemGameEditorOpen(false)}
            />
          )}

          {menuBarEditEl && (
            <MenuBarEditorModal
              el={menuBarEditEl.el}
              pages={pages}
              onApply={(updatedEl) => {
                // Auto-wire empty goto targets: use item label as page name
                function wireItems(items) {
                  return (items || []).map(item => {
                    let ni = { ...item }
                    if (ni.action === 'goto' && !ni.target && ni.label)
                      ni = { ...ni, target: ni.label.trim() }
                    if (ni.children?.length) {
                      ni = { ...ni, children: ni.children.map(grp => ({
                        ...grp,
                        items: (grp.items || []).map(si =>
                          si.action === 'goto' && !si.target && si.label
                            ? { ...si, target: si.label.trim() }
                            : si
                        )
                      }))}
                    }
                    return ni
                  })
                }
                // Collect all goto targets from wired items
                function collectTargets(items) {
                  const out = new Set()
                  for (const it of (items || [])) {
                    if (it.action === 'goto' && it.target) out.add(it.target)
                    for (const grp of (it.children || []))
                      for (const si of (grp.items || []))
                        if (si.action === 'goto' && si.target) out.add(si.target)
                  }
                  return [...out]
                }
                const wiredItems = wireItems(updatedEl.items)
                const wiredEl = { ...updatedEl, items: wiredItems }
                const targetNames = collectTargets(wiredItems)
                setPages(prev => {
                  const existing = new Set(prev.map(p => p.name))
                  const toCreate = targetNames.filter(n => !existing.has(n))
                  const newPages = toCreate.map(n => makePage(n, prev.length))
                  const updated = prev.map((pg, i) =>
                    i === menuBarEditEl.pageIdx
                      ? { ...pg, elements: pg.elements.map(e => e.id === menuBarEditEl.elId ? wiredEl : e) }
                      : pg
                  )
                  return [...updated, ...newPages]
                })
                setMenuBarEditEl(null)
              }}
              onClose={() => setMenuBarEditEl(null)}
            />
          )}

          {showLyricWizard && (
            <LyricVideoWizard
              stageWidth={stage.width}
              stageHeight={stage.height}
              mediaServerPort={window.smmDesktop?.mediaServerPort || 0}
              onGenerate={({ pages: lyricPages, presentationAudio: lyricAudio }) => {
                setPages(lyricPages)
                setPresentationAudio(lyricAudio)
                setCur(0)
                setSelId(null)
                setFilename('Lyric Video.mme')
                setShowLyricWizard(false)
                setStatus(`Lyric video created — ${lyricPages.length} pages`)
              }}
              onClose={() => setShowLyricWizard(false)}
            />
          )}

          {showScriptExportModal && (
            <ScriptExportModal
              pages={pages}
              stageWidth={stage.width}
              stageHeight={stage.height}
              presentationAudio={presentationAudio}
              onClose={() => setShowScriptExportModal(false)}
            />
          )}

          {scriptMode && (
            <section className="script-overlay">
              <div className="script-head">
                <span>SMMScript View</span>
                <div>
                  <button onClick={importFromScriptView}>Import</button>
                  <button onClick={() => executeCommand('view-script-close')}>Close</button>
                </div>
              </div>
              <textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)} />
            </section>
          )}

          {showScriptFlow && (
            <ScriptFlowEditor
              pages={pages}
              onClose={() => setShowScriptFlow(false)}
              onNavigatePage={(i) => { setCur(i); setShowScriptFlow(false) }}
            />
          )}
        </section>

        {showVarEditor && (
          <VariableEditor
            pages={pages}
            setPages={setPages}
            projectVars={projectVars}
            setProjectVars={setProjectVars}
            curPageIdx={cur}
            onClose={() => setShowVarEditor(false)}
          />
        )}

        {panelVisible.right && !panelCollapsed.right && (
          <div className="panel-divider panel-divider-v" onMouseDown={(e) => onPanelDividerMouseDown(e, 'right')} title="Drag to resize" />
        )}
        {panelVisible.right && (
          <aside
            className={`inspector${panelCollapsed.right ? ' panel-collapsed' : ''}`}
            style={{ width: panelCollapsed.right ? 28 : panelSizes.right, transition: 'width .15s' }}
          >
            <div className="panel-header panel-header-right">
              <button className="panel-btn" title="Hide panel" onClick={() => togglePanel('right')}>✕</button>
              <button className="panel-btn" title={panelCollapsed.right ? 'Expand panel' : 'Collapse panel'} onClick={() => collapsePanel('right')}>{panelCollapsed.right ? '‹' : '›'}</button>
              <span className="panel-title">{panelCollapsed.right ? '' : '⚙ Properties'}</span>
            </div>
            {!panelCollapsed.right && <>
          <div className="pane-title inspector-pages-title">
            <span>Pages</span>
            <div className="page-ops">
              <button title="New page" onClick={() => executeCommand('page-new')}>＋</button>
              <button title="Duplicate page" onClick={() => executeCommand('page-duplicate')}>⊕</button>
              <button title="Delete page" onClick={() => executeCommand('page-delete')}>✕</button>
            </div>
          </div>
          <div className="insp-pagelist" style={{ maxHeight: 'none', height: innerSplitSizes.rightPagesH, overflow: 'auto', flexShrink: 0 }}>
            {pages.map((pg, i) => (
              <div
                key={pg.id}
                className={`insp-pagerow ${i === cur ? 'sel' : ''} ${selectedPageIds.includes(i) ? 'multi-sel' : ''} ${pageDragOverIdx === i ? 'page-drag-over' : ''}`}
                draggable
                onDragStart={(e) => handlePageDragStart(e, i)}
                onDragOver={(ev) => { ev.preventDefault(); setPageDragOverIdx(i) }}
                onDragEnd={() => setPageDragOverIdx(-1)}
                onDrop={(ev) => {
                  ev.preventDefault()
                  setPageDragOverIdx(-1)
                  if (ev.dataTransfer.getData('dragType') === 'page') {
                    handlePageDropAt(ev, i)
                    return
                  }
                  const elId = ev.dataTransfer.getData('elId')
                  const fromPage = parseInt(ev.dataTransfer.getData('fromPage'), 10)
                  if (!elId || fromPage === i) return
                  const srcEl = pages[fromPage]?.elements.find((e) => e.id === elId)
                  if (!srcEl) return
                  pushHistory(true)
                  const movedEl = { ...JSON.parse(JSON.stringify(srcEl)), id: uid() }
                  setPages((prev) =>
                    prev.map((pg2, pi) => {
                      if (pi === fromPage) return { ...pg2, elements: pg2.elements.filter((e) => e.id !== elId) }
                      if (pi === i) return { ...pg2, elements: [...pg2.elements, { ...movedEl, z: pg2.elements.length }] }
                      return pg2
                    }),
                  )
                  setStatus(`Element moved to page ${i + 1}`)
                }}
              >
                <div
                  className="insp-pagerow-header"
                  onDoubleClick={() => setCollapsedInspPages((prev) => { const n = new Set(prev); if (n.has(pg.id)) n.delete(pg.id); else n.add(pg.id); return n })}
                  title="Double-click to minimize/expand"
                >
                  <button className="insp-page-num" onClick={(e) => handlePageSelect(i, e)}>{String(i + 1).padStart(2, '0')}</button>
                  <input
                    className="insp-page-name"
                    value={pg.name}
                    onChange={(e) => setPages((prev) => prev.map((p, pi) => pi === i ? { ...p, name: e.target.value } : p))}
                    onClick={(e) => handlePageSelect(i, e)}
                  />
                  <span className="insp-page-collapse-icon">{collapsedInspPages.has(pg.id) ? '▸' : '▾'}</span>
                </div>
                {i === cur && !collapsedInspPages.has(pg.id) && (
                  <div className="insp-page-elements">
                    {(pg.elements ?? []).slice().sort((a, b) => a.z - b.z).map((el) => (
                      <div
                        key={el.id}
                        className={`insp-el-row ${selId === el.id ? 'sel' : ''}`}
                        onClick={() => setSelId(el.id)}
                        draggable
                        onDragStart={(ev) => {
                          ev.dataTransfer.setData('elId', el.id)
                          ev.dataTransfer.setData('fromPage', String(i))
                          ev.dataTransfer.effectAllowed = 'move'
                        }}
                      >
                        <span className="insp-el-type">{el.type.toUpperCase()}</span>
                        <span className="insp-el-name">
                          {el.elLabel || el.mediaName || (el.type === 'text' ? String(el.content || '').slice(0, 18) : el.type === 'button' ? (el.label || '') : '')}
                        </span>
                      </div>
                    ))}
                    {!pg.elements?.length && <div className="insp-el-empty">no elements</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="panel-divider panel-divider-h" onMouseDown={(e) => onInnerDividerMouseDown(e, 'rightPagesH')} title="Drag to resize Pages / Properties" />
          <div className="tabs">
            {(['props','anim','page','wipe','script','diag']).map((tab) => (
              <button key={tab}
                className={inspectorTab === tab ? 'on' : ''}
                title={TAB_TIPS[tab]}
                onClick={() => setInspectorTab(tab)}
              >{TAB_ICONS[tab]}</button>
            ))}
          </div>

          {inspectorTab === 'props' && (
            <div className="insp-body">
              {!selectedEl && <p className="muted">No selection</p>}

              {selectedEl && (
                <>
                  <label>
                    Label
                    <input
                      value={selectedEl.elLabel || ''}
                      onChange={(e) => updateElement({ elLabel: e.target.value })}
                      placeholder="Element name…"
                    />
                  </label>
                  {/* ── Choose Media (universal, between Label and XYWH) ── */}
                  {(selectedEl.type === 'clip' || selectedEl.type === 'mpeg') && (
                    <div className="choose-media-row">
                      <button
                        className="choose-media-btn"
                        onClick={() => selectedEl.type === 'mpeg' ? chooseMedia('el', 'video') : chooseMedia('el', 'all')}
                      >
                        {selectedEl.mediaName
                          ? `📎 ${selectedEl.mediaName}`
                          : selectedEl.type === 'mpeg' ? '🎬 Choose Video…' : '🖼 Choose Media…'}
                      </button>
                      {selectedEl.mediaName && (
                        <span className="choose-media-name" title={selectedEl.mediaName}>
                          {selectedEl.mediaSupport ? `(${selectedEl.mediaSupport})` : ''}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="xywh-row">
                    <label className="xywh-lbl">
                      <span>X</span>
                      <input type="number" value={selectedEl.x} onChange={(e) => updateElement({ x: Number(e.target.value) })} />
                    </label>
                    <label className="xywh-lbl">
                      <span>Y</span>
                      <input type="number" value={selectedEl.y} onChange={(e) => updateElement({ y: Number(e.target.value) })} />
                    </label>
                  </div>
                  <div className="xywh-row">
                    <label className="xywh-lbl">
                      <span>W</span>
                      <input type="number" value={selectedEl.w} onChange={(e) => updateElement({ w: Math.max(4, Number(e.target.value)) })} />
                    </label>
                    <label className="xywh-lbl">
                      <span>H</span>
                      <input type="number" value={selectedEl.h} onChange={(e) => updateElement({ h: Math.max(4, Number(e.target.value)) })} />
                    </label>
                  </div>

                  {/* Universal Interaction Editor button — all element types */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button
                      className={selectedEl.interactive ? 'on' : ''}
                      style={{ flex: 1, fontSize: 10, padding: '3px 6px' }}
                      title="Open the Interaction Editor to set up button behavior, hover states, action chains, IF/THEN logic"
                      onClick={() => setInteractionEditorEl(selectedEl)}
                    >
                      🖱 {selectedEl.interactive ? '✦ Interactions active' : 'Edit Interactions…'}
                    </button>
                  </div>

                  {/* ── Group inspector section ── */}
                  {selectedEl.type === 'group' && (
                    <div className="acc-section">
                      <button className={`acc-hdr${sOpen('group-props') ? ' open' : ''}`} onClick={() => toggleSection('group-props')}>
                        <span className="acc-icon">⬚</span><span className="acc-label">Group</span><span className="acc-chevron">{sOpen('group-props') ? '▼' : '►'}</span>
                      </button>
                      {sOpen('group-props') && (
                        <div className="acc-body">
                          <label>
                            Name
                            <input
                              value={selectedEl.name || ''}
                              onChange={(e) => updateElement({ name: e.target.value })}
                              placeholder="Group name…"
                            />
                          </label>
                          <div style={{ marginTop: 6, fontSize: 10, color: '#888' }}>
                            {(selectedEl.children || []).length} child elements
                          </div>
                          <div style={{ marginTop: 6, maxHeight: 120, overflowY: 'auto' }}>
                            {(selectedEl.children || []).map((child, ci) => (
                              <div key={child.id || ci} style={{ fontSize: 10, padding: '2px 4px', background: 'rgba(255,255,255,.04)', borderRadius: 3, marginBottom: 2, color: '#aaa' }}>
                                {ci + 1}. {child.elLabel || child.type.toUpperCase()}{child.type === 'text' ? ` · ${String(child.content || '').slice(0, 16)}` : child.type === 'button' ? ` · ${child.label || ''}` : ''}
                              </div>
                            ))}
                          </div>
                          <button
                            style={{ marginTop: 8, fontSize: 10, padding: '4px 8px', width: '100%' }}
                            onClick={() => ungroupSelected()}
                          >↩ Ungroup</button>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedEl.type === 'text' && (
                    <>
                      {/* ── Content ── */}
                      <div className="acc-section">
                        <button className={`acc-hdr${sOpen('text-content') ? ' open' : ''}`} onClick={() => toggleSection('text-content')}>
                          <span className="acc-icon">✏</span><span className="acc-label">Content</span><span className="acc-chevron">{sOpen('text-content') ? '▼' : '►'}</span>
                        </button>
                        {sOpen('text-content') && (
                          <div className="acc-body">
                            {inlineEditId === selectedEl.id ? (
                              <div style={{ fontSize: 11, color: '#62c2ff', background: 'rgba(74,175,255,.1)', padding: '8px 10px', borderRadius: 4, border: '1px solid rgba(74,175,255,.35)', lineHeight: 1.5 }}>
                                ✏ Editing on canvas — click away or press <kbd style={{ background: 'rgba(255,255,255,.12)', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>Esc</kbd> to finish
                              </div>
                            ) : (
                              <>
                                <button
                                  style={{ fontSize: 12, padding: '7px 10px', background: 'rgba(74,175,255,.18)', border: '1px solid rgba(74,175,255,.5)', borderRadius: 4, color: '#8de', cursor: 'pointer', width: '100%', fontWeight: 600, marginBottom: 6 }}
                                  onClick={() => setInlineEditId(selectedEl.id)}
                                >✏ Edit text on canvas</button>
                                <div style={{ fontSize: 10, color: '#666', marginBottom: 6, textAlign: 'center' }}>or double-click the text element</div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    style={{ fontSize: 10, flex: 1 }}
                                    title="Preview text as speech (Web Speech API)"
                                    onClick={() => {
                                      import('./utils/ttsUtils.js').then(({ speak, isTTSAvailable }) => {
                                        if (!isTTSAvailable()) { alert('Web Speech API not available in this environment'); return }
                                        speak(selectedEl?.content || '', undefined, 1, 1, 0.9)
                                      })
                                    }}
                                  >🔊 Speak</button>
                                  <button
                                    style={{ fontSize: 10, flex: 1 }}
                                    title="Stop speech preview"
                                    onClick={() => import('./utils/ttsUtils.js').then(({ stopSpeech }) => stopSpeech())}
                                  >⏹ Stop</button>
                                  <button
                                    style={{ fontSize: 10, flex: 1 }}
                                    title="Neural TTS — generate speech using Piper (offline, downloadable voices)"
                                    onClick={() => setShowPiperTTS((v) => !v)}
                                  >🤖 {showPiperTTS ? 'Hide' : 'Neural'}</button>
                                </div>
                                {showPiperTTS && (
                                  <div style={{ marginTop: 6 }}>
                                    <PiperTTSPanel
                                      initialText={selectedEl?.content || ''}
                                      compact={false}
                                      onClose={() => setShowPiperTTS(false)}
                                      onSynthesized={async ({ path: wavPath, name: wavName }) => {
                                        const port = window.smmDesktop?.mediaServerPort || 0
                                        if (port) {
                                          const url = `http://127.0.0.1:${port}/?p=${encodeURIComponent(wavPath)}`
                                          setPages((prev) => prev.map((pg, i) =>
                                            i === cur
                                              ? { ...pg, narration: { file: url, name: wavName, sourcePath: wavPath, autoPlay: true } }
                                              : pg
                                          ))
                                          setStatus(`Narration set: ${wavName}`)
                                        }
                                      }}
                                    />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Typography ── */}
                      <div className="acc-section">
                        <button className={`acc-hdr${sOpen('text-typography') ? ' open' : ''}`} onClick={() => toggleSection('text-typography')}>
                          <span className="acc-icon">🔤</span><span className="acc-label">Typography</span><span className="acc-chevron">{sOpen('text-typography') ? '▼' : '►'}</span>
                        </button>
                        {sOpen('text-typography') && (
                          <div className="acc-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, color: 'var(--t3)', letterSpacing: '.02em' }}>Font<FontPicker value={selectedEl.font || 'Rajdhani'} onChange={(f) => updateElement({ font: f })} /></div>
                            <label>Size (px)<input type="number" value={selectedEl.size} onChange={(e) => updateElement({ size: Number(e.target.value) || 1 })} /></label>
                            <label>Weight
                              <select value={String(selectedEl.weight || '700')} onChange={(e) => updateElement({ weight: e.target.value })}>
                                <option value="400">Normal (400)</option>
                                <option value="600">Semi-Bold (600)</option>
                                <option value="700">Bold (700)</option>
                                <option value="900">Black (900)</option>
                              </select>
                            </label>
                            <label>H-Align
                              <select value={selectedEl.align || 'center'} onChange={(e) => updateElement({ align: e.target.value })}>
                                <option value="left">⬛ Left</option>
                                <option value="center">⇔ Center</option>
                                <option value="right">Right ⬛</option>
                              </select>
                            </label>
                            <label>V-Align
                              <select value={selectedEl.vAlign || 'middle'} onChange={(e) => updateElement({ vAlign: e.target.value })}>
                                <option value="top">↑ Top</option>
                                <option value="middle">⇕ Middle</option>
                                <option value="bottom">↓ Bottom</option>
                              </select>
                            </label>
                            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4, fontStyle: 'italic' }}>
                              💡 Use the format bar above the canvas for quick text editing.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Colour & Style ── */}
                      <div className="acc-section">
                        <button className={`acc-hdr${sOpen('text-colour') ? ' open' : ''}`} onClick={() => toggleSection('text-colour')}>
                          <span className="acc-icon">🎨</span><span className="acc-label">Colour &amp; Style</span><span className="acc-chevron">{sOpen('text-colour') ? '▼' : '►'}</span>
                        </button>
                        {sOpen('text-colour') && (
                          <div className="acc-body">
                            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <span style={{ flex: 1 }}>Text colour</span>
                              <SmartColorPicker value={selectedEl.color || '#e2e6ea'} onChange={(v) => updateElement({ color: v })} />
                            </label>
                            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <span style={{ flex: 1 }}>Bg colour</span>
                              <SmartColorPicker value={selectedEl.bgColor || '#000000'} onChange={(v) => updateElement({ bgColor: v })} />
                            </label>
                            <div className="inline-actions" style={{ flexWrap: 'wrap', marginTop: 6 }}>
                              <button className={selectedEl.italic ? 'on' : ''} title="Italic" onClick={() => updateElement({ italic: !selectedEl.italic })}><i>I</i></button>
                              <button className={selectedEl.underline ? 'on' : ''} title="Underline" onClick={() => updateElement({ underline: !selectedEl.underline })}><u>U</u></button>
                              <button className={selectedEl.shadow ? 'on' : ''} title="Drop shadow" onClick={() => updateElement({ shadow: !selectedEl.shadow })}>Shadow</button>
                              <button className={selectedEl.outline ? 'on' : ''} title="Text outline" onClick={() => updateElement({ outline: !selectedEl.outline })}>Outline</button>
                              <button className={selectedEl.bgOn ? 'on' : ''} title="Show background" onClick={() => updateElement({ bgOn: !selectedEl.bgOn })}>Bg On</button>
                            </div>
                            {selectedEl.outline && (
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <span style={{ flex: 1 }}>Outline colour</span>
                                <SmartColorPicker value={selectedEl.outlineColor || '#000000'} onChange={(v) => updateElement({ outlineColor: v })} />
                              </label>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Text Effects (F4) ── */}
                      <div className="acc-section">
                        <button className={`acc-hdr${sOpen('text-fx') ? ' open' : ''}`} onClick={() => toggleSection('text-fx')}>
                          <span className="acc-icon">✨</span><span className="acc-label">Text Effects</span><span className="acc-chevron">{sOpen('text-fx') ? '▼' : '►'}</span>
                        </button>
                        {sOpen('text-fx') && (
                          <div className="acc-body">
                            <label className="insp-lbl">Effect Style</label>
                            <select
                              className="insp-select"
                              value={selectedEl.textStyle || 'none'}
                              onChange={e => updateElement({ textStyle: e.target.value })}
                            >
                              <option value="none">— None —</option>
                              <option value="gradient-h">🌈 Gradient Horizontal</option>
                              <option value="gradient-v">🌈 Gradient Vertical</option>
                              <option value="gradient-diag">🌈 Gradient Diagonal</option>
                              <option value="neon-glow">💡 Neon Glow</option>
                              <option value="outline-stroke">⬜ Outline / Hollow</option>
                              <option value="shadow-3d">🧊 3D Shadow</option>
                              <option value="image-fill">🖼 Image Fill</option>
                            </select>
                            {selectedEl.textStyle && selectedEl.textStyle !== 'none' && selectedEl.textStyle !== 'image-fill' && (
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                <span style={{ flex: 1 }}>Colour 1</span>
                                <SmartColorPicker value={selectedEl.textStyleColor1 || '#e8a020'} onChange={v => updateElement({ textStyleColor1: v })} />
                              </label>
                            )}
                            {['gradient-h', 'gradient-v', 'gradient-diag', 'shadow-3d'].includes(selectedEl.textStyle || '') && (
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <span style={{ flex: 1 }}>Colour 2</span>
                                <SmartColorPicker value={selectedEl.textStyleColor2 || '#62c2ff'} onChange={v => updateElement({ textStyleColor2: v })} />
                              </label>
                            )}
                            {selectedEl.textStyle === 'image-fill' && (
                              <label style={{ flexDirection: 'column', gap: 4, marginTop: 8 }}>
                                <span>Image URL or path</span>
                                <input
                                  className="insp-input"
                                  type="text"
                                  placeholder="https://... or local path"
                                  value={selectedEl.textStyleImage || ''}
                                  onChange={e => updateElement({ textStyleImage: e.target.value })}
                                />
                                <p className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                                  💡 Enter an image URL to fill the text shape with that image.
                                </p>
                              </label>
                            )}
                            {selectedEl.textStyle && selectedEl.textStyle !== 'none' && (
                              <button
                                className="btn-sm"
                                style={{ marginTop: 8, width: '100%' }}
                                onClick={() => updateElement({ textStyle: 'none', textStyleColor1: undefined, textStyleColor2: undefined, textStyleImage: undefined })}
                              >
                                ✕ Remove Effect
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Overflow / Scroll ── */}
                      <div className="acc-section">
                        <button className={`acc-hdr${sOpen('text-overflow', false) ? ' open' : ''}`} onClick={() => toggleSection('text-overflow', false)}>
                          <span className="acc-icon">📜</span><span className="acc-label">Overflow / Scroll</span><span className="acc-chevron">{sOpen('text-overflow', false) ? '▼' : '►'}</span>
                        </button>
                        {sOpen('text-overflow', false) && (
                          <div className="acc-body">
                            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <input type="checkbox" checked={!!selectedEl.textScrollable} onChange={(e) => updateElement({ textScrollable: e.target.checked })} />
                              Scrollable text box
                            </label>
                            {selectedEl.textScrollable && (
                              <>
                                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <input type="checkbox" checked={!!selectedEl.creditsScroll} onChange={(e) => updateElement({ creditsScroll: e.target.checked })} />
                                  Auto-scroll (credits mode)
                                </label>
                                {selectedEl.creditsScroll && (
                                  <label>
                                    Scroll speed
                                    <input type="number" min={1} max={20} value={selectedEl.creditsSpeed ?? 2} onChange={(e) => updateElement({ creditsSpeed: Number(e.target.value) })} style={{ width: 60 }} />
                                    <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>px/frame</span>
                                  </label>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {selectedEl.type === 'clip' && (
                    <>
                      {/* ── Media ── */}
                      <div className="acc-section">
                        <button className={`acc-hdr${sOpen('clip-media') ? ' open' : ''}`} onClick={() => toggleSection('clip-media')}>
                          <span className="acc-icon">📹</span><span className="acc-label">Media</span><span className="acc-chevron">{sOpen('clip-media') ? '▼' : '►'}</span>
                        </button>
                        {sOpen('clip-media') && (
                          <div className="acc-body">
                            {(selectedEl.mediaName || selectedEl.mediaExt) && (
                              <p className="muted">
                                Media: {selectedEl.mediaName || selectedEl.mediaExt}
                                {selectedEl.mediaSupport ? ` (${selectedEl.mediaSupport})` : ''}
                              </p>
                            )}
                            {selectedEl.mediaReason && <p className="muted">{selectedEl.mediaReason}</p>}
                            {selectedEl.mediaOutputHint && <p className="muted">Recommended: {selectedEl.mediaOutputHint}</p>}
                            <label>
                              Fit
                              <select value={selectedEl.fit || 'contain'} onChange={(e) => updateElement({ fit: e.target.value })}>
                                <option value="contain">Contain</option>
                                <option value="cover">Cover</option>
                                <option value="fill">Fill</option>
                                <option value="none">None</option>
                              </select>
                            </label>
                            <label>
                              Opacity {selectedEl.opacity || 100}%
                              <input
                                type="range"
                                min="1"
                                max="100"
                                value={selectedEl.opacity || 100}
                                onChange={(e) => updateElement({ opacity: Number(e.target.value) })}
                              />
                            </label>
                            {(selectedEl.mediaKind || detectMediaKind(selectedEl.file || '')) === 'video' && (
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={!!selectedEl.unmuted} onChange={(e) => updateElement({ unmuted: e.target.checked })} />
                                Play with sound (presenter)
                              </label>
                            )}
                            {(selectedEl.mediaKind || detectMediaKind(selectedEl.file || '')) === 'audio' && (
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="checkbox"
                                  checked={!!selectedEl.audioHidden}
                                  onChange={(e) => updateElement({ audioHidden: e.target.checked })}
                                />
                                🎵 Hide in presentation (audio plays, element invisible)
                              </label>
                            )}
                            {(selectedEl.mediaKind === 'pdf' || detectMediaKind(selectedEl.file || '') === 'pdf') && (
                              <label>
                                Open at page #
                                <input
                                  type="number"
                                  min="1"
                                  value={selectedEl.pdfPage || 1}
                                  onChange={(e) => updateElement({ pdfPage: Math.max(1, Number(e.target.value) || 1) })}
                                  style={{ width: 64 }}
                                />
                                <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>PDF page to jump to on load</span>
                              </label>
                            )}
                            {(selectedEl.mediaKind === 'image' || detectMediaKind(selectedEl.file || '') === 'image') && (
                              <ShapeButtonInspector el={selectedEl} onUpdate={updateElement} />
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Effects ── */}
                      <div className="acc-section">
                        <button className={`acc-hdr${sOpen('clip-effects') ? ' open' : ''}`} onClick={() => toggleSection('clip-effects')}>
                          <span className="acc-icon">✨</span><span className="acc-label">Effects</span><span className="acc-chevron">{sOpen('clip-effects') ? '▼' : '►'}</span>
                        </button>
                        {sOpen('clip-effects') && (
                          <div className="acc-body">
                            {(selectedEl.type === 'clip' || selectedEl.type === 'mpeg') && (
                              <>
                                <div className="behavior-title" style={{ marginTop: 4 }}>🎨 Background Removal</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <button
                                    className="be-btn"
                                    onClick={() => setChromaKeyModalEl(selectedEl)}
                                    style={selectedEl.chromaOrigFile ? { background: '#1a4a2a', borderColor: '#2a7a3a', color: '#80e080' } : {}}
                                  >
                                    {selectedEl.chromaOrigFile ? '↺ Edit Background Removal…' : '🎨 Open Background Removal…'}
                                  </button>
                                  {selectedEl.chromaOrigFile && (
                                    <button className="be-btn" style={{ color: '#ff8080' }}
                                      onClick={() => clearChromaKey(selectedEl.id)}>
                                      ✕ Remove
                                    </button>
                                  )}
                                </div>
                                {selectedEl.chromaOrigFile && (
                                  <p className="muted" style={{ fontSize: 10, color: 'var(--mme-teal)', margin: '2px 0' }}>
                                    ✔ Background removal active — original image preserved
                                  </p>
                                )}
                                <div className="behavior-title" style={{ marginTop: 8 }}>🖼 Frame / Border</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <button
                                    className="be-btn"
                                    onClick={() => setFrameBorderEl(selectedEl)}
                                    style={selectedEl.frameBorder?.enabled ? { background: '#1a3a5a', borderColor: '#2a6a9a', color: '#80c8f0' } : {}}
                                  >
                                    {selectedEl.frameBorder?.enabled ? '↺ Edit Frame/Border…' : '🖼 Add Frame/Border…'}
                                  </button>
                                  {selectedEl.frameBorder?.enabled && (
                                    <button className="be-btn" style={{ color: '#ff8080' }}
                                      onClick={() => {
                                        const elId = selectedEl.id
                                        setPages(prev => prev.map(pg => ({
                                          ...pg,
                                          elements: pg.elements.map(e => e.id !== elId ? e : { ...e, frameBorder: { ...DEFAULT_FRAME, enabled: false } }),
                                        })))
                                        setStatus('Frame removed')
                                      }}>
                                      ✕ Remove
                                    </button>
                                  )}
                                </div>
                                {selectedEl.frameBorder?.enabled && (
                                  <p className="muted" style={{ fontSize: 10, color: 'var(--mme-teal)', margin: '2px 0' }}>
                                    ✔ Frame/Border active — style: {selectedEl.frameBorder.style || 'solid'}
                                  </p>
                                )}
                                <div className="behavior-title" style={{ marginTop: 8 }}>🌑 Drop Shadow</div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <button
                                    className={selectedEl.mediaShadow ? 'on' : ''}
                                    style={{ flex: 1, fontSize: 11, padding: '3px 8px' }}
                                    onClick={() => updateElement({ mediaShadow: !selectedEl.mediaShadow })}
                                  >
                                    {selectedEl.mediaShadow ? '✔ Shadow On' : '+ Add Shadow'}
                                  </button>
                                  {selectedEl.mediaShadow && (
                                    <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                      <input
                                        type="checkbox"
                                        checked={!!selectedEl.mediaShadowInner}
                                        onChange={(e) => updateElement({ mediaShadowInner: e.target.checked })}
                                      />
                                      Inner glow
                                    </label>
                                  )}
                                </div>
                                {selectedEl.mediaShadow && (
                                  <>
                                    <label>
                                      Offset X (px)
                                      <input
                                        type="range" min={-60} max={60} step={1}
                                        value={selectedEl.mediaShadowX ?? 4}
                                        onChange={(e) => updateElement({ mediaShadowX: Number(e.target.value) })}
                                      />
                                      <span style={{ fontSize: 10, color: '#888', minWidth: 28 }}>{selectedEl.mediaShadowX ?? 4}</span>
                                    </label>
                                    <label>
                                      Offset Y (px)
                                      <input
                                        type="range" min={-60} max={60} step={1}
                                        value={selectedEl.mediaShadowY ?? 6}
                                        onChange={(e) => updateElement({ mediaShadowY: Number(e.target.value) })}
                                      />
                                      <span style={{ fontSize: 10, color: '#888', minWidth: 28 }}>{selectedEl.mediaShadowY ?? 6}</span>
                                    </label>
                                    <label>
                                      Blur (px)
                                      <input
                                        type="range" min={0} max={80} step={1}
                                        value={selectedEl.mediaShadowBlur ?? 12}
                                        onChange={(e) => updateElement({ mediaShadowBlur: Number(e.target.value) })}
                                      />
                                      <span style={{ fontSize: 10, color: '#888', minWidth: 28 }}>{selectedEl.mediaShadowBlur ?? 12}</span>
                                    </label>
                                    {selectedEl.mediaShadowInner && (
                                      <label>
                                        Spread (px)
                                        <input
                                          type="range" min={0} max={40} step={1}
                                          value={selectedEl.mediaShadowSpread ?? 0}
                                          onChange={(e) => updateElement({ mediaShadowSpread: Number(e.target.value) })}
                                        />
                                        <span style={{ fontSize: 10, color: '#888', minWidth: 28 }}>{selectedEl.mediaShadowSpread ?? 0}</span>
                                      </label>
                                    )}
                                    <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                      <span style={{ flex: 1 }}>Shadow colour</span>
                                      <SmartColorPicker
                                        value={selectedEl.mediaShadowColor || 'rgba(0,0,0,0.6)'}
                                        onChange={(v) => updateElement({ mediaShadowColor: v })}
                                      />
                                    </label>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                                      {[
                                        { label: 'Soft', x:2, y:4, blur:16, color:'rgba(0,0,0,0.45)' },
                                        { label: 'Hard', x:4, y:4, blur:0, color:'rgba(0,0,0,0.8)' },
                                        { label: 'Float', x:0, y:12, blur:24, color:'rgba(0,0,0,0.5)' },
                                        { label: 'Glow', x:0, y:0, blur:20, color:'rgba(255,200,0,0.7)' },
                                        { label: 'Neon', x:0, y:0, blur:18, color:'rgba(0,220,255,0.8)' },
                                        { label: 'Deep', x:6, y:8, blur:20, color:'rgba(0,0,0,0.85)' },
                                      ].map(p => (
                                        <button
                                          key={p.label}
                                          style={{ fontSize: 10, padding: '2px 7px', background: '#2a2a2a', border: '1px solid #555', borderRadius: 3, color: '#ccc', cursor: 'pointer' }}
                                          onClick={() => updateElement({ mediaShadowX: p.x, mediaShadowY: p.y, mediaShadowBlur: p.blur, mediaShadowColor: p.color, mediaShadowInner: false })}
                                        >
                                          {p.label}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Trim / Range ── */}
                      <div className="acc-section">
                        <button className={`acc-hdr${sOpen('clip-trim', false) ? ' open' : ''}`} onClick={() => toggleSection('clip-trim', false)}>
                          <span className="acc-icon">✂</span><span className="acc-label">Trim / Range</span><span className="acc-chevron">{sOpen('clip-trim', false) ? '▼' : '►'}</span>
                        </button>
                        {sOpen('clip-trim', false) && (
                          <div className="acc-body">
                            {(selectedEl.mediaKind === 'video' || selectedEl.mediaKind === 'audio' ||
                              detectMediaKind(selectedEl.file || '') === 'video' ||
                              detectMediaKind(selectedEl.file || '') === 'audio') && (
                              <MediaTimeline el={selectedEl} pages={pages} onUpdate={updateElement} />
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {selectedEl.type === 'button' && (
                    <p className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                      {BTN_ACTIONS.find((a) => a.value === selectedEl.action)?.label || selectedEl.action}
                      {(selectedEl.action === 'goto' || selectedEl.action === 'url') && (selectedEl.linkTarget || selectedEl.urlTarget || selectedEl.target)
                        ? ` → ${(selectedEl.linkTarget || selectedEl.urlTarget || selectedEl.target).slice(0, 32)}`
                        : ''}
                    </p>
                  )}

                  {selectedEl.type === 'mpeg' && (
                    <>
                      {/* Media moved to top of inspector */}
                      {(selectedEl.mediaName || selectedEl.mediaExt) && (
                        <p className="muted">
                          Media: {selectedEl.mediaName || selectedEl.mediaExt}
                          {selectedEl.mediaSupport ? ` (${selectedEl.mediaSupport})` : ''}
                        </p>
                      )}
                      {selectedEl.mediaReason && <p className="muted">{selectedEl.mediaReason}</p>}
                      {selectedEl.mediaOutputHint && <p className="muted">Recommended: {selectedEl.mediaOutputHint}</p>}
                      <label>
                        Fit
                        <select value={selectedEl.fit || 'contain'} onChange={(e) => updateElement({ fit: e.target.value })}>
                          <option value="contain">Contain</option>
                          <option value="cover">Cover</option>
                          <option value="fill">Fill</option>
                        </select>
                      </label>
                      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={!!selectedEl.unmuted} onChange={(e) => updateElement({ unmuted: e.target.checked })} />
                        Play with sound (presenter)
                      </label>
                      {/* Media Timeline for mpeg */}
                      <MediaTimeline el={selectedEl} pages={pages} onUpdate={updateElement} />
                    </>
                  )}

                  {/* ── Hotspot Inspector ─────────────────────────── */}
                  {selectedEl.type === 'hotspot' && (<>
                    <div className="behavior-title" style={{ color: 'var(--mme-teal)', marginBottom: 4 }}>🎯 Hotspot</div>

                    {/* Shape row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#aaa', minWidth: 38 }}>Shape</span>
                      <select style={{ flex: 1, fontSize: 10 }} value={selectedEl.hotspotShape || 'rect'} onChange={(e) => updateElement({ hotspotShape: e.target.value, points: [] })}>
                        <option value="rect">▬ Rectangle</option>
                        <option value="oval">⬭ Oval</option>
                        <option value="circle">⭕ Circle</option>
                        <option value="star">★ Star</option>
                        <option value="hexagon">⬡ Hexagon</option>
                        <option value="pentagon">⬠ Pentagon</option>
                        <option value="octagon">⯃ Octagon</option>
                        <option value="triangle">△ Triangle</option>
                        <option value="diamond">◇ Diamond</option>
                        <option value="freehand">✏ Freehand</option>
                      </select>
                    </div>

                    {/* Border row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#aaa', minWidth: 38 }}>Border</span>
                      <input type="checkbox" checked={!!selectedEl.borderOn} onChange={(e) => updateElement({ borderOn: e.target.checked })} title="Show border" />
                      {selectedEl.borderOn && (<>
                        <SmartColorPicker value={selectedEl.borderColor || lastUsedColor} onChange={(v) => { updateElement({ borderColor: v }); setLastUsedColor(v) }} />
                        <input type="number" min={1} max={20} value={selectedEl.borderWidth ?? 2} onChange={(e) => updateElement({ borderWidth: Math.max(1, Number(e.target.value)) })} style={{ width: 38, fontSize: 10 }} title="Width px" />
                        <select style={{ flex: 1, fontSize: 10 }} value={selectedEl.borderStyle || 'dashed'} onChange={(e) => updateElement({ borderStyle: e.target.value })}>
                          <option value="solid">—</option>
                          <option value="dashed">- -</option>
                          <option value="dotted">···</option>
                        </select>
                      </>)}
                    </div>

                    {/* Fill/Tint row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#aaa', minWidth: 38 }}>Fill</span>
                      <input type="range" min={0} max={100} step={5} value={Math.round((selectedEl.fillOpacity || 0) * 100)} onChange={(e) => updateElement({ fillOpacity: Number(e.target.value) / 100 })} style={{ flex: 1 }} title="Fill opacity" />
                      <span style={{ fontSize: 9, color: '#888', minWidth: 26, textAlign: 'right' }}>{Math.round((selectedEl.fillOpacity || 0) * 100)}%</span>
                      {(selectedEl.fillOpacity || 0) > 0 && (
                        <SmartColorPicker value={selectedEl.fillColor || '#ffffff'} onChange={(v) => { updateElement({ fillColor: v }); setLastUsedColor(v) }} />
                      )}
                    </div>

                    {/* Corner radius — only for rect/square shapes */}
                    {(!selectedEl.hotspotShape || selectedEl.hotspotShape === 'rect') && (<>
                      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2, marginTop: 2 }}>╭ Corner radius (px)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 4 }}>
                        {[['TL','hotspotRadiusTL'],['TR','hotspotRadiusTR'],['BL','hotspotRadiusBL'],['BR','hotspotRadiusBR']].map(([lbl, key]) => (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: 9, color: '#888', minWidth: 14 }}>{lbl}</span>
                            <input type="number" min={0} max={200} value={selectedEl[key] ?? 0} onChange={(e) => updateElement({ [key]: Math.max(0, Number(e.target.value)) })} style={{ flex: 1, fontSize: 10, width: 0 }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        <button style={{ flex: 1, fontSize: 9 }} onClick={() => { const v = selectedEl.hotspotRadiusTL ?? 0; updateElement({ hotspotRadiusTR: v, hotspotRadiusBL: v, hotspotRadiusBR: v }) }} title="Copy TL to all corners">= All</button>
                        <button style={{ flex: 1, fontSize: 9 }} onClick={() => updateElement({ hotspotRadiusTL: 0, hotspotRadiusTR: 0, hotspotRadiusBL: 0, hotspotRadiusBR: 0 })}>Reset</button>
                      </div>
                    </>)}

                    {/* Hover/Press */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#aaa', minWidth: 38 }}>Hover</span>
                      <select style={{ flex: 1, fontSize: 10 }} value={selectedEl.hoverEffect || 'tint'} onChange={(e) => updateElement({ hoverEffect: e.target.value })}>
                        <option value="none">None</option>
                        <option value="tint">Light tint</option>
                        <option value="glow">Glow</option>
                        <option value="invert">Invert</option>
                      </select>
                      <span style={{ fontSize: 10, color: '#aaa', marginLeft: 4 }}>Press</span>
                      <select style={{ flex: 1, fontSize: 10 }} value={selectedEl.pressedEffect || 'darken'} onChange={(e) => updateElement({ pressedEffect: e.target.value })}>
                        <option value="none">None</option>
                        <option value="darken">Darken</option>
                        <option value="tint">Tint</option>
                      </select>
                    </div>

                    {/* Tooltip */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#aaa', minWidth: 38 }}>Label</span>
                      <input style={{ flex: 1, fontSize: 10 }} value={selectedEl.tooltip || ''} onChange={(e) => updateElement({ tooltip: e.target.value })} placeholder="Tooltip on hover…" />
                    </div>

                    {/* Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#aaa', minWidth: 38 }}>Action</span>
                      <select style={{ flex: 1, fontSize: 10 }} value={selectedEl.action || 'none'} onChange={(e) => updateElement({ action: e.target.value })}>
                        <option value="none">— None —</option>
                        <option value="next">▶ Next</option>
                        <option value="prev">◀ Prev</option>
                        <option value="goto-page">↗ Goto page…</option>
                        <option value="goto-element">🔗 Goto element…</option>
                        <option value="hyperlink">🌐 URL…</option>
                        <option value="script">⚡ Script…</option>
                      </select>
                    </div>
                    {selectedEl.action === 'goto-page' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: '#aaa', minWidth: 38 }}>Page</span>
                        <select style={{ flex: 1, fontSize: 10 }} value={selectedEl.gotoPageName || ''} onChange={(e) => updateElement({ gotoPageName: e.target.value })}>
                          <option value="">— choose —</option>
                          {pages.map((pg, i) => <option key={pg.id} value={pg.name}>{i + 1}. {pg.name}</option>)}
                        </select>
                      </div>
                    )}
                    {selectedEl.action === 'goto-element' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: '#aaa', minWidth: 38 }}>Elem</span>
                        <select style={{ flex: 1, fontSize: 10 }} value={selectedEl.gotoObjectId || ''} onChange={(e) => {
                          const el = currentPage?.elements.find((x) => x.id === e.target.value)
                          updateElement({ gotoObjectId: e.target.value, gotoObjectLabel: el?.elLabel || el?.label || '' })
                        }}>
                          <option value="">— choose —</option>
                          {(currentPage?.elements || []).filter((x) => x.id !== selectedEl.id).map((x) => (
                            <option key={x.id} value={x.id}>{x.elLabel || x.label || x.type.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {selectedEl.action === 'hyperlink' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: '#aaa', minWidth: 38 }}>URL</span>
                        <input type="url" style={{ flex: 1, fontSize: 10 }} value={selectedEl.linkTarget || ''} onChange={(e) => updateElement({ linkTarget: e.target.value })} placeholder="https://…" />
                      </div>
                    )}
                    {selectedEl.action === 'script' && (
                      <textarea rows={3} value={selectedEl.scriptContent || ''} onChange={(e) => updateElement({ scriptContent: e.target.value })} placeholder="JS on click…" style={{ fontFamily: 'monospace', fontSize: 10, width: '100%', marginBottom: 3 }} />
                    )}
                    <p className="muted" style={{ fontSize: 9, marginTop: 2, lineHeight: 1.4 }}>
                      💡 Invisible by default — set border/fill opacity to see shape.
                    </p>
                    {/* Snapshot the canvas region under this hotspot */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      <button
                        style={{ flex: 1, fontSize: 10, padding: '4px 0', background: '#1a2e3f', color: '#3cb8be', border: '1px solid #2a4a5f', borderRadius: 3, cursor: hotspotSnapBusy ? 'wait' : 'pointer', opacity: hotspotSnapBusy ? 0.6 : 1 }}
                        disabled={hotspotSnapBusy}
                        title="Capture region → embed as inline Clip element"
                        onClick={() => snapshotHotspotToClip(selectedEl)}
                      >
                        {hotspotSnapBusy ? '⏳ …' : '📸 → Clip'}
                      </button>
                      <button
                        style={{ flex: 1, fontSize: 10, padding: '4px 0', background: '#1a2e3f', color: '#7ee', border: '1px solid #2a4a5f', borderRadius: 3, cursor: hotspotSnapBusy ? 'wait' : 'pointer', opacity: hotspotSnapBusy ? 0.6 : 1 }}
                        disabled={hotspotSnapBusy}
                        title="Capture region → save PNG to disk, then add as Clip element"
                        onClick={() => snapshotHotspotToClip(selectedEl, { saveToFile: true })}
                      >
                        {hotspotSnapBusy ? '⏳ …' : '💾 Save PNG'}
                      </button>
                    </div>
                  </>)}

                  {/* ── MenuBar Inspector ─────────────────────────── */}
                  {selectedEl.type === 'menubar' && (
                    <>
                      <div className="behavior-title" style={{ color: '#e94560', marginBottom: 4 }}>☰ Menu Bar</div>
                      <label>
                        Position
                        <select
                          value={selectedEl.position || 'top'}
                          onChange={(e) => updateElement({ position: e.target.value })}
                        >
                          <option value="top">▲ Top</option>
                          <option value="bottom">▼ Bottom</option>
                          <option value="left">◀ Left</option>
                          <option value="right">▶ Right</option>
                        </select>
                      </label>
                      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1 }}>Bar Color</span>
                        <SmartColorPicker value={selectedEl.style?.bgColor || '#1a1a2e'} onChange={(v) => updateElement({ style: { ...selectedEl.style, bgColor: v } })} />
                      </label>
                      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1 }}>Item Color</span>
                        <SmartColorPicker value={selectedEl.style?.itemColor || '#ffffff'} onChange={(v) => updateElement({ style: { ...selectedEl.style, itemColor: v } })} />
                      </label>
                      <label>
                        Font Size
                        <input
                          type="number" min={8} max={32} step={1}
                          value={selectedEl.style?.fontSize || 14}
                          onChange={(e) => updateElement({ style: { ...selectedEl.style, fontSize: Number(e.target.value) } })}
                        />
                      </label>
                      <button
                        style={{ marginTop: 8, padding: '6px 12px', background: '#e94560', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', width: '100%' }}
                        onClick={() => setMenuBarEditEl({ pageIdx: cur, elId: selectedEl.id, el: selectedEl })}
                      >
                        ✏ Edit Menu Bar…
                      </button>
                    </>
                  )}

                  {/* ── Animation Inspector ─────────────────────────── */}
                  <details className="anim-details">
                    <summary className="behavior-title anim-summary">
                      {(selectedEl.animIn && selectedEl.animIn !== 'none') || (selectedEl.animOut && selectedEl.animOut !== 'none')
                        ? `▶ Animations ✦ ${selectedEl.animIn !== 'none' ? 'In: ' + selectedEl.animIn : ''}${selectedEl.animOut !== 'none' ? '  Out: ' + selectedEl.animOut : ''}`
                        : '▶ Animations'}
                    </summary>
                    <div className="anim-inspector">
                      <div className="behavior-title" style={{ color: 'var(--mme-teal)', marginTop: 0 }}>Fly In</div>
                      <label>
                        Animation
                        <select value={selectedEl.animIn || 'none'} onChange={(e) => updateElement({ animIn: e.target.value })}>
                          {ANIM_IN_TYPES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                        </select>
                      </label>
                      {selectedEl.animIn && selectedEl.animIn !== 'none' && (
                        <>
                          <label>
                            Duration (ms)
                            <input type="number" min={100} max={5000} step={100} value={selectedEl.animInDuration ?? 600}
                              onChange={(e) => updateElement({ animInDuration: Math.max(100, Number(e.target.value)) })} />
                          </label>
                          <label>
                            Delay (ms)
                            <input type="number" min={0} max={10000} step={100} value={selectedEl.animInDelay ?? 0}
                              onChange={(e) => updateElement({ animInDelay: Math.max(0, Number(e.target.value)) })} />
                          </label>
                          <label>
                            Easing
                            <select value={selectedEl.animInEasing || 'ease-out'} onChange={(e) => updateElement({ animInEasing: e.target.value })}>
                              <option value="ease-out">Ease Out (smooth decel)</option>
                              <option value="ease-in">Ease In (slow start)</option>
                              <option value="ease-in-out">Ease In-Out</option>
                              <option value="linear">Linear</option>
                              <option value="cubic-bezier(0.34,1.56,0.64,1)">Spring (overshoot)</option>
                              <option value="cubic-bezier(0.68,-0.55,0.265,1.55)">Elastic</option>
                            </select>
                          </label>
                        </>
                      )}

                      <div className="behavior-title" style={{ color: 'var(--mme-teal)', marginTop: 8 }}>Fly Out</div>
                      <label>
                        Animation
                        <select value={selectedEl.animOut || 'none'} onChange={(e) => updateElement({ animOut: e.target.value })}>
                          {ANIM_OUT_TYPES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                        </select>
                      </label>
                      {selectedEl.animOut && selectedEl.animOut !== 'none' && (
                        <>
                          <label>
                            Duration (ms)
                            <input type="number" min={100} max={5000} step={100} value={selectedEl.animOutDuration ?? 600}
                              onChange={(e) => updateElement({ animOutDuration: Math.max(100, Number(e.target.value)) })} />
                          </label>
                          <label>
                            Trigger
                            <select value={selectedEl.animOutTrigger || 'never'} onChange={(e) => updateElement({ animOutTrigger: e.target.value })}>
                              <option value="never">Never (stay visible)</option>
                              <option value="auto">Auto (after delay)</option>
                              <option value="click">On Click / Tap</option>
                              <option value="key">On Key Press</option>
                            </select>
                          </label>
                          {selectedEl.animOutTrigger === 'auto' && (
                            <label>
                              Dwell before fly-out (ms)
                              <input type="number" min={0} max={30000} step={250} value={selectedEl.animOutDelay ?? 0}
                                onChange={(e) => updateElement({ animOutDelay: Math.max(0, Number(e.target.value)) })} />
                            </label>
                          )}
                        </>
                      )}

                      <p className="muted" style={{ fontSize: 9, marginTop: 4, lineHeight: 1.5 }}>
                        💡 Animations play when the page is shown in Presentation mode. Use Delay to stagger multiple objects.
                      </p>
                    </div>
                  </details>

                  {/* ── Behavior section ─────────────────────────── */}
                  <details className="event-details" open>
                    <summary className="behavior-title event-summary">⬇ EVENT IN</summary>
                    <div className="event-body">

                    {/* Show/hide native media controls in presentation */}
                    {(selectedEl.type === 'clip' || selectedEl.type === 'mpeg') && selectedEl.file && (
                      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={selectedEl.showMediaControls !== false}
                          onChange={(e) => updateElement({ showMediaControls: e.target.checked })}
                        />
                        Show controls in presentation
                      </label>
                    )}

                    {/* Loop — media elements only */}
                    {(selectedEl.type === 'clip' || selectedEl.type === 'mpeg') && selectedEl.file && (
                      <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={!!selectedEl.loop}
                          onChange={(e) => updateElement({ loop: e.target.checked })}
                        />
                        Loop media
                      </label>
                    )}

                    {(selectedEl.type === 'clip' || selectedEl.type === 'mpeg') && (
                      <label>
                        Play count
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={selectedEl.playCount ?? 1}
                          onChange={(e) => updateElement({ playCount: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </label>
                    )}

                    <label>
                      Trigger
                      <select
                        value={selectedEl.onPlayMode || 'auto'}
                        onChange={(e) => updateElement({ onPlayMode: e.target.value })}
                      >
                        <option value="auto">▶ Auto — on page load</option>
                        <option value="click">🖱 On click / tap</option>
                        <option value="click-next">⏭ On next click (sequence)</option>
                        <option value="key">⌨ On key press</option>
                        <option value="hover">🖱 On hover</option>
                        <option value="after-element">⏩ After element completes…</option>
                        <option value="delay">⏱ After delay (ms)…</option>
                      </select>
                    </label>
                    {selectedEl.onPlayMode === 'after-element' && (
                      <label>
                        After element label
                        <input
                          value={selectedEl.afterElementLabel || ''}
                          onChange={(e) => updateElement({ afterElementLabel: e.target.value })}
                          placeholder="Element name (Label)…"
                        />
                      </label>
                    )}
                    {selectedEl.onPlayMode === 'delay' && (
                      <label>
                        Delay (ms)
                        <input
                          type="number" min={0} max={60000} step={100}
                          value={selectedEl.onPlayDelay ?? 0}
                          onChange={(e) => updateElement({ onPlayDelay: Number(e.target.value) })}
                        />
                      </label>
                    )}

                    {/* ── Wait to Play ─────────────────────────────── */}
                    <label>
                      ⏸ Wait to Play
                      <select
                        value={selectedEl.waitToPlay || 'none'}
                        onChange={(e) => updateElement({ waitToPlay: e.target.value })}
                        title="Hold media playback until a trigger fires"
                      >
                        <option value="none">▶ Play immediately</option>
                        <option value="click">🖱 On Mouse Click</option>
                        <option value="key">⌨ On Keyboard Input</option>
                      </select>
                    </label>
                    {selectedEl.waitToPlay === 'key' && (
                      <label>
                        Key / Combo
                        <input
                          value={selectedEl.waitToPlayKey || ''}
                          onChange={(e) => updateElement({ waitToPlayKey: e.target.value })}
                          placeholder="e.g. Enter, Space, Ctrl+Enter, ArrowRight"
                          title="Key name or combo — e.g. Enter · Space · ArrowRight · Ctrl+Enter · Shift+F1"
                        />
                      </label>
                    )}

                    {/* ── Show / Hide on Trigger ───────────────────── */}
                    <label>
                      👁 Show on Trigger
                      <select
                        value={selectedEl.showOnTrigger || 'none'}
                        onChange={(e) => updateElement({ showOnTrigger: e.target.value })}
                        title="Make this element visible when a trigger fires"
                      >
                        <option value="none">— None</option>
                        <option value="click">🖱 On Mouse Click (anywhere)</option>
                        <option value="key">⌨ On Keyboard Input</option>
                      </select>
                    </label>
                    {selectedEl.showOnTrigger === 'key' && (
                      <label>
                        Show Key / Combo
                        <input
                          value={selectedEl.showOnTriggerKey || ''}
                          onChange={(e) => updateElement({ showOnTriggerKey: e.target.value })}
                          placeholder="e.g. Space, F1, Ctrl+Shift+S"
                        />
                      </label>
                    )}
                    <label>
                      🙈 Hide on Trigger
                      <select
                        value={selectedEl.hideOnTrigger || 'none'}
                        onChange={(e) => updateElement({ hideOnTrigger: e.target.value })}
                        title="Hide this element when a trigger fires"
                      >
                        <option value="none">— None</option>
                        <option value="click">🖱 On Mouse Click (anywhere)</option>
                        <option value="key">⌨ On Keyboard Input</option>
                      </select>
                    </label>
                    {selectedEl.hideOnTrigger === 'key' && (
                      <label>
                        Hide Key / Combo
                        <input
                          value={selectedEl.hideOnTriggerKey || ''}
                          onChange={(e) => updateElement({ hideOnTriggerKey: e.target.value })}
                          placeholder="e.g. Escape, F2, Ctrl+H"
                        />
                      </label>
                    )}

                    {/* In-transition for this element */}
                    <label>
                      IN Transition
                      <select value={selectedEl.animIn || 'none'} onChange={(e) => updateElement({ animIn: e.target.value })}>
                        {ANIM_IN_TYPES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                      </select>
                    </label>
                    {selectedEl.animIn && selectedEl.animIn !== 'none' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <label style={{ flex: 1 }}>
                          Duration (ms)
                          <input type="number" min={100} max={5000} step={100} value={selectedEl.animInDuration ?? 600}
                            onChange={(e) => updateElement({ animInDuration: Math.max(100, Number(e.target.value)) })} />
                        </label>
                        <label style={{ flex: 1 }}>
                          Delay (ms)
                          <input type="number" min={0} max={10000} step={100} value={selectedEl.animInDelay ?? 0}
                            onChange={(e) => updateElement({ animInDelay: Math.max(0, Number(e.target.value)) })} />
                        </label>
                      </div>
                    )}
                    </div>
                  </details>

                  <details className="event-details">
                    <summary className="behavior-title event-summary">⬆ EVENT OUT</summary>
                    <div className="event-body">

                    {/* Out-transition */}
                    <label>
                      OUT Transition
                      <select value={selectedEl.animOut || 'none'} onChange={(e) => updateElement({ animOut: e.target.value })}>
                        {ANIM_OUT_TYPES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                      </select>
                    </label>
                    {selectedEl.animOut && selectedEl.animOut !== 'none' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <label style={{ flex: 1 }}>
                          Duration (ms)
                          <input type="number" min={100} max={5000} step={100} value={selectedEl.animOutDuration ?? 600}
                            onChange={(e) => updateElement({ animOutDuration: Math.max(100, Number(e.target.value)) })} />
                        </label>
                        <label style={{ flex: 1 }}>
                          Trigger
                          <select value={selectedEl.animOutTrigger || 'auto'} onChange={(e) => updateElement({ animOutTrigger: e.target.value })}>
                            <option value="auto">Auto</option>
                            <option value="click">On Click</option>
                            <option value="key">On Key</option>
                            <option value="never">Never</option>
                          </select>
                        </label>
                      </div>
                    )}
                    <label>
                      After play / out
                      <select
                        value={selectedEl.afterPlay || 'none'}
                        onChange={(e) => updateElement({ afterPlay: e.target.value })}
                      >
                        <option value="none">Nothing (stay)</option>
                        <option value="next">▶ Next page</option>
                        <option value="prev">◀ Prev page</option>
                        <option value="goto">↗ Go to page…</option>
                        <option value="goto-if">🔀 Go to page (if variable)…</option>
                        <option value="goto-element">🔗 Go to element…</option>
                        <option value="play-next">⏭ Play next element in sequence</option>
                        <option value="set-var">📝 Set variable</option>
                        <option value="loop">🔁 Loop (play again)</option>
                        <option value="wait-click">⏸ Wait for click then advance</option>
                        <option value="hide-self">🙈 Hide this element</option>
                        <option value="quit">✖ Quit</option>
                        <option value="url">🌐 Open URL…</option>
                      </select>
                    </label>

                    {selectedEl.afterPlay === 'goto-element' && (
                      <label>
                        Element label
                        <input
                          value={selectedEl.afterPlayTarget || ''}
                          onChange={(e) => updateElement({ afterPlayTarget: e.target.value })}
                          placeholder="Element name (Label)…"
                        />
                      </label>
                    )}
                    {selectedEl.afterPlay === 'goto' && (
                      <label>
                        Target page
                        <select
                          value={selectedEl.afterPlayTarget || ''}
                          onChange={(e) => updateElement({ afterPlayTarget: e.target.value })}
                        >
                          <option value="">(choose page)</option>
                          {pages.map((pg) => (
                            <option key={pg.id} value={pg.name}>{pg.name}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    {selectedEl.afterPlay === 'set-var' && (
                      <>
                        <label>
                          Variable name
                          <input
                            value={selectedEl.varName || ''}
                            onChange={(e) => updateElement({ varName: e.target.value })}
                            placeholder="myVar"
                          />
                        </label>
                        <label>
                          Value to set
                          <input
                            value={selectedEl.varValue ?? ''}
                            onChange={(e) => updateElement({ varValue: e.target.value })}
                            placeholder="e.g. 1 or true"
                          />
                        </label>
                      </>
                    )}
                    {selectedEl.afterPlay === 'goto-if' && (
                      <>
                        <label>
                          Variable name
                          <input
                            value={selectedEl.gotoIfVar || ''}
                            onChange={(e) => updateElement({ gotoIfVar: e.target.value })}
                            placeholder="myVar"
                          />
                        </label>
                        <label>
                          Operator
                          <select
                            value={selectedEl.gotoIfOp || '=='}
                            onChange={(e) => updateElement({ gotoIfOp: e.target.value })}
                          >
                            <option value="==">== equals</option>
                            <option value="!=">!= not equals</option>
                            <option value=">">&gt; greater than</option>
                            <option value="<">&lt; less than</option>
                            <option value=">=">&gt;= ≥</option>
                            <option value="<=">&lt;= ≤</option>
                          </select>
                        </label>
                        <label>
                          Compare value
                          <input
                            value={selectedEl.gotoIfVal ?? ''}
                            onChange={(e) => updateElement({ gotoIfVal: e.target.value })}
                            placeholder="e.g. 1"
                          />
                        </label>
                        <label>
                          If TRUE → go to page
                          <select
                            value={selectedEl.afterPlayTarget || ''}
                            onChange={(e) => updateElement({ afterPlayTarget: e.target.value })}
                          >
                            <option value="">(choose page)</option>
                            {pages.map((pg) => (
                              <option key={pg.id} value={pg.name}>{pg.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          If FALSE → go to page
                          <select
                            value={selectedEl.gotoIfElse || ''}
                            onChange={(e) => updateElement({ gotoIfElse: e.target.value })}
                          >
                            <option value="">(next page)</option>
                            {pages.map((pg) => (
                              <option key={pg.id} value={pg.name}>{pg.name}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    {selectedEl.afterPlay === 'url' && (
                      <label>
                        URL
                        <input
                          value={selectedEl.afterPlayTarget || ''}
                          onChange={(e) => updateElement({ afterPlayTarget: e.target.value })}
                          placeholder="https://…"
                        />
                      </label>
                    )}

                    {/* Audio event — for image/text/button/mpeg (not audio clips) */}
                    {(selectedEl.type === 'text' ||
                      selectedEl.type === 'button' ||
                      selectedEl.type === 'mpeg' ||
                      (selectedEl.type === 'clip' &&
                        (selectedEl.mediaKind || detectMediaKind(selectedEl.file || '')) !== 'audio')) && (
                      <>
                        <div className="behavior-title" style={{ marginTop: 6 }}>Audio Event</div>
                        <button onClick={() => void chooseMedia('audioEvent', 'audio', null, false)}>
                          {selectedEl.audioEventName ? `♪ ${selectedEl.audioEventName}` : 'Attach audio…'}
                        </button>
                        {selectedEl.audioEventName && (
                          <button onClick={() => updateElement({ audioEvent: '', audioEventName: '' })}>
                            Remove audio
                          </button>
                        )}
                      </>
                    )}

                    {/* ── Scripting / Condition ─────────────────── */}
                    {(selectedEl.type === 'clip' || selectedEl.type === 'mpeg') && (
                      <>
                        <div className="behavior-title" style={{ marginTop: 6 }}>Condition</div>
                        <label>
                          Play IF
                          <select
                            value={selectedEl.playCondition || 'always'}
                            onChange={(e) => updateElement({ playCondition: e.target.value })}
                          >
                            <option value="always">✅ Always</option>
                            <option value="click-next">🖱 Only on next click</option>
                            <option value="count">🔢 Visit count &lt;= N</option>
                            <option value="var">📊 Variable equals</option>
                            <option value="after-element">⏩ After element completes</option>
                            <option value="sequence">🔗 Play in sequence order</option>
                            <option value="first-visit">1️⃣ First visit only</option>
                            <option value="not-first-visit">🔄 All visits except first</option>
                          </select>
                        </label>
                        {selectedEl.playCondition === 'after-element' && (
                          <label>
                            After element (label name)
                            <input
                              value={selectedEl.playConditionAfterEl || ''}
                              onChange={(e) => updateElement({ playConditionAfterEl: e.target.value })}
                              placeholder="Element label name…"
                            />
                          </label>
                        )}
                        {selectedEl.playCondition === 'sequence' && (
                          <label>
                            Sequence order #
                            <input
                              type="number" min={1} max={99}
                              value={selectedEl.playConditionSeqOrder ?? 1}
                              onChange={(e) => updateElement({ playConditionSeqOrder: Number(e.target.value) })}
                            />
                          </label>
                        )}
                        {selectedEl.playCondition === 'count' && (
                          <label>
                            Max visits
                            <input
                              type="number" min="1" max="999"
                              value={selectedEl.playConditionCount ?? 1}
                              onChange={(e) => updateElement({ playConditionCount: Math.max(1, Number(e.target.value)) })}
                            />
                          </label>
                        )}
                        {selectedEl.playCondition === 'var' && (
                          <>
                            <label>
                              Variable
                              <input
                                value={selectedEl.playConditionVar || ''}
                                onChange={(e) => updateElement({ playConditionVar: e.target.value })}
                                placeholder="varName"
                              />
                            </label>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <select
                                value={selectedEl.playConditionOp || '=='}
                                onChange={(e) => updateElement({ playConditionOp: e.target.value })}
                                style={{ flex: '0 0 auto' }}
                              >
                                <option value="==">==</option>
                                <option value="!=">!=</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value=">=">&gt;=</option>
                                <option value="<=">&lt;=</option>
                              </select>
                              <input
                                value={selectedEl.playConditionVal || ''}
                                onChange={(e) => updateElement({ playConditionVal: e.target.value })}
                                placeholder="value"
                              />
                            </div>
                          </>
                        )}
                        {(selectedEl.playCondition === 'count' || selectedEl.playCondition === 'var') && (
                          <>
                            <label>
                              Else action
                              <select
                                value={selectedEl.playConditionElse || 'none'}
                                onChange={(e) => updateElement({ playConditionElse: e.target.value })}
                              >
                                <option value="none">Skip / nothing</option>
                                <option value="next">Next page</option>
                                <option value="prev">Previous page</option>
                                <option value="goto">Go to page</option>
                                <option value="quit">Quit</option>
                              </select>
                            </label>
                            {selectedEl.playConditionElse === 'goto' && (
                              <label>
                                Else → page
                                <select
                                  value={selectedEl.playConditionElseTarget || ''}
                                  onChange={(e) => updateElement({ playConditionElseTarget: e.target.value })}
                                >
                                  <option value="">(choose page)</option>
                                  {pages.map((pg) => (
                                    <option key={pg.id} value={pg.name}>{pg.name}</option>
                                  ))}
                                </select>
                              </label>
                            )}
                          </>
                        )}
                      </>
                    )}
                    </div>
                  </details>

                  {/* ── Entry Animation ───────────────── */}
                  <div className="behavior-section">
                    <div className="behavior-title">Entry Animation</div>
                    <div className="wipe-thumb-grid">
                      {FLYIN_META.map((m) => (
                        <button
                          key={m.value}
                          title={m.desc}
                          data-tip={m.desc || m.value || 'None'}
                          className={`wipe-thumb-btn${(selectedEl.wipe || '') === m.value ? ' on' : ''}`}
                          onClick={() => updateElement({ wipe: m.value })}
                        >
                          <FlyInThumbnail value={m.value} />
                          <span className="wipe-thumb-label">{m.value || 'None'}</span>
                        </button>
                      ))}
                    </div>
                    {selectedEl.wipe && (
                      <label>
                        Speed {selectedEl.wipeSpeed || 5}
                        <input
                          type="range" min="1" max="10"
                          value={selectedEl.wipeSpeed || 5}
                          onChange={(e) => updateElement({ wipeSpeed: Number(e.target.value) })}
                        />
                      </label>
                    )}
                  </div>

                  <div className="inline-actions">
                    <button onClick={() => executeCommand('layer-front')}>Front</button>
                    <button onClick={() => executeCommand('layer-back')}>Back</button>
                  </div>
                  <div className="inline-actions">
                    <button onClick={() => executeCommand('layer-up')}>Up</button>
                    <button onClick={() => executeCommand('layer-down')}>Down</button>
                  </div>
                  <div className="inline-actions">
                    <button onClick={() => executeCommand('selection-duplicate')}>Duplicate</button>
                    <button onClick={() => executeCommand('selection-delete')}>Delete</button>
                  </div>
                </>
              )}
            </div>
          )}

          {inspectorTab === 'anim' && selectedEl && (
            <div className="insp-body">
              {/* ── Preview Bar ── */}
              <div className="anim-preview-bar">
                <button
                  className="anim-preview-btn"
                  title="Preview enter animation in editor"
                  onClick={() => {
                    setAnimPreviewId(selectedEl.id)
                    setAnimPreviewKey(k => k + 1)
                    setTimeout(() => setAnimPreviewId(null), (selectedEl.animInDuration || 600) + (selectedEl.animInDelay || 0) + 200)
                  }}
                >▶ Preview Enter</button>
                <span className="muted" style={{ fontSize: 10 }}>Plays animation on canvas once</span>
              </div>

              {/* ── Enter Animation ── */}
              <div className="acc-section">
                <button className={`acc-hdr${sOpen('anim-enter') ? ' open' : ''}`} onClick={() => toggleSection('anim-enter')}>
                  ▶ Enter Animation
                </button>
                {sOpen('anim-enter') && (
                  <div className="acc-body">
                    <label className="insp-lbl">Type</label>
                    <select
                      className="insp-select"
                      value={selectedEl.animIn || 'none'}
                      onChange={e => updateElement({ animIn: e.target.value })}
                    >
                      <option value="none">— None —</option>
                      {ANIM_IN_TYPES.filter(a => a.key !== 'none').map(a => (
                        <option key={a.key} value={a.key}>{a.label || a.key}</option>
                      ))}
                    </select>

                    <label className="insp-lbl">Duration (ms)</label>
                    <input
                      type="number" min={100} max={5000} step={50}
                      className="insp-input"
                      value={selectedEl.animInDuration ?? 600}
                      onChange={e => updateElement({ animInDuration: Number(e.target.value) })}
                    />

                    <label className="insp-lbl">Delay (ms)</label>
                    <input
                      type="number" min={0} max={10000} step={50}
                      className="insp-input"
                      value={selectedEl.animInDelay ?? 0}
                      onChange={e => updateElement({ animInDelay: Number(e.target.value) })}
                    />

                    <label className="insp-lbl">Easing</label>
                    <select
                      className="insp-select"
                      value={selectedEl.animInEasing || 'ease-out'}
                      onChange={e => updateElement({ animInEasing: e.target.value })}
                    >
                      {['ease-out','ease-in','ease-in-out','ease','linear','cubic-bezier(0.34,1.56,0.64,1)'].map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>

                    <label className="insp-lbl">Repeat Count</label>
                    <select
                      className="insp-select"
                      value={String(selectedEl.animInRepeat ?? 1)}
                      onChange={e => updateElement({ animInRepeat: Number(e.target.value) })}
                    >
                      <option value="1">Once</option>
                      <option value="2">2×</option>
                      <option value="3">3×</option>
                      <option value="5">5×</option>
                      <option value="0">∞ Infinite</option>
                    </select>
                  </div>
                )}
              </div>

              {/* ── Loop / Idle Animation ── */}
              <div className="acc-section">
                <button className={`acc-hdr${sOpen('anim-loop') ? ' open' : ''}`} onClick={() => toggleSection('anim-loop')}>
                  🔄 Loop / Idle Animation
                </button>
                {sOpen('anim-loop') && (
                  <div className="acc-body">
                    <label className="insp-lbl">Loop Type</label>
                    <select
                      className="insp-select"
                      value={selectedEl.animLoop || 'none'}
                      onChange={e => updateElement({ animLoop: e.target.value })}
                    >
                      {ANIM_LOOP_TYPES.map(a => (
                        <option key={a.key} value={a.key}>{a.label || a.key}</option>
                      ))}
                    </select>

                    <label className="insp-lbl">Speed</label>
                    <select
                      className="insp-select"
                      value={String(selectedEl.animLoopSpeed ?? 1)}
                      onChange={e => updateElement({ animLoopSpeed: Number(e.target.value) })}
                    >
                      <option value="0.4">Very Slow (0.4×)</option>
                      <option value="0.7">Slow (0.7×)</option>
                      <option value="1">Normal (1×)</option>
                      <option value="1.5">Fast (1.5×)</option>
                      <option value="2.5">Very Fast (2.5×)</option>
                    </select>
                    {selectedEl.animLoop && selectedEl.animLoop !== 'none' && (
                      <p className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                        Loop plays continuously while element is visible on stage.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Exit Animation ── */}
              <div className="acc-section">
                <button className={`acc-hdr${sOpen('anim-exit') ? ' open' : ''}`} onClick={() => toggleSection('anim-exit')}>
                  ◀ Exit Animation
                </button>
                {sOpen('anim-exit') && (
                  <div className="acc-body">
                    <label className="insp-lbl">Type</label>
                    <select
                      className="insp-select"
                      value={selectedEl.animOut || 'none'}
                      onChange={e => updateElement({ animOut: e.target.value })}
                    >
                      <option value="none">— None —</option>
                      {ANIM_OUT_TYPES.filter(a => a.key !== 'none').map(a => (
                        <option key={a.key} value={a.key}>{a.label || a.key}</option>
                      ))}
                    </select>

                    <label className="insp-lbl">Duration (ms)</label>
                    <input
                      type="number" min={100} max={5000} step={50}
                      className="insp-input"
                      value={selectedEl.animOutDuration ?? 600}
                      onChange={e => updateElement({ animOutDuration: Number(e.target.value) })}
                    />

                    <label className="insp-lbl">Delay (ms)</label>
                    <input
                      type="number" min={0} max={10000} step={50}
                      className="insp-input"
                      value={selectedEl.animOutDelay ?? 0}
                      onChange={e => updateElement({ animOutDelay: Number(e.target.value) })}
                    />

                    <label className="insp-lbl">Trigger</label>
                    <select
                      className="insp-select"
                      value={selectedEl.animOutTrigger || 'auto'}
                      onChange={e => updateElement({ animOutTrigger: e.target.value })}
                    >
                      {[
                        { k:'auto', l:'Auto (after enter)' },
                        { k:'click', l:'On Click' },
                        { k:'key', l:'On Key Press' },
                        { k:'never', l:'Never' },
                      ].map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {inspectorTab === 'anim' && !selectedEl && (
            <div className="insp-body">
              <p className="muted" style={{ padding: 12 }}>Select an element to configure its animations.</p>
            </div>
          )}

          {inspectorTab === 'script' && (
            <div className="insp-body" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bg5)' }}>
                <button
                  className="script-btn"
                  style={{ width: '100%' }}
                  onClick={() => setShowPageScriptEditor(true)}
                >🖥 Page Script (JS + Data Source)</button>
              </div>
              {!selectedEl ? (
                <p className="muted" style={{ padding: 12 }}>Select an element to add per-element scripts</p>
              ) : (
                <ElementScriptPanel
                  el={selectedEl}
                  pages={pages}
                  projectVars={projectVars}
                  allPageElements={currentPage?.elements || []}
                  onChange={patch => updateElement(patch)}
                />
              )}
            </div>
          )}

          {inspectorTab === 'diag' && (
            <div className="insp-body">
              <div className="element-row">
                <p className="muted">Media backends</p>
                <p className="muted">
                  ffmpeg-static: {mediaBackends?.ffmpegStatic?.available ? 'available' : 'missing'}
                </p>
                <p className="muted">
                  ffmpeg: {mediaBackends?.ffmpeg?.available ? 'available' : 'missing'}
                </p>
                <p className="muted">
                  timidity: {mediaBackends?.timidity?.available ? 'available' : 'missing'}
                </p>
                <p className="muted">Legacy .flc/.mid use built-in synth/transcode.</p>
                <p className="muted" style={{ marginTop: 8 }}>Transcoded media cache</p>
                <p className="muted">
                  {mediaCacheInfo?.ok
                    ? `${mediaCacheInfo.files || 0} files · ${formatBytes(mediaCacheInfo.bytes || 0)}`
                    : `Unavailable${mediaCacheInfo?.reason ? `: ${mediaCacheInfo.reason}` : ''}`}
                </p>
                {mediaCacheInfo?.cachePath && (
                  <p className="muted" title={mediaCacheInfo.cachePath}>
                    {mediaCacheInfo.cachePath.length > 44 ? `…${mediaCacheInfo.cachePath.slice(-43)}` : mediaCacheInfo.cachePath}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => void refreshMediaCacheInfo()} disabled={mediaCacheBusy}>Refresh cache</button>
                  <button onClick={() => void clearMediaCache()} disabled={mediaCacheBusy || !desktopApi?.clearMediaCache}>Clear cache</button>
                </div>
                <button onClick={exportMediaDiagnosticsReport}>Export diagnostics report</button>
              </div>
            </div>
          )}

          {inspectorTab === 'page' && currentPage && (
            <div className="insp-body">

              {/* ── Identity ── */}
              <div className="acc-section">
                <button className={`acc-hdr${sOpen('page-identity') ? ' open' : ''}`} onClick={() => toggleSection('page-identity')}>
                  <span className="acc-icon">📋</span><span className="acc-label">Identity</span><span className="acc-chevron">{sOpen('page-identity') ? '▼' : '►'}</span>
                </button>
                {sOpen('page-identity') && (
                  <div className="acc-body">
                    <label>
                      Name
                      <input
                        value={currentPage.name}
                        onChange={(e) =>
                          setPages((prev) =>
                            prev.map((pg, i) => (i === cur ? { ...pg, name: e.target.value } : pg)),
                          )
                        }
                      />
                    </label>
                    {(projectType === 'memory-game' || pages.some(p => p.templateId === 'memory-game')) && (
                      <button
                        className="be-btn"
                        style={{ width: '100%', marginTop: 4, marginBottom: 2 }}
                        onClick={() => setMemGameEditorOpen(true)}
                      >
                        🧠 Edit Memory Game…
                      </button>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: '#aaa', minWidth: 60 }}>Page type</span>
                      <select style={{ flex: 1, fontSize: 10 }}
                        value={currentPage.pageType || 'standard'}
                        onChange={(e) => setPages((prev) => prev.map((pg, i) => i === cur ? { ...pg, pageType: /** @type {'standard'|'url'} */ (e.target.value) } : pg))}
                      >
                        <option value="standard">🖼 Standard</option>
                        <option value="url">🌐 URL / Web page</option>
                      </select>
                    </div>
                    {(currentPage.pageType === 'url') && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: '#aaa', minWidth: 60 }}>URL</span>
                          <input
                            type="url"
                            style={{ flex: 1, fontSize: 10 }}
                            placeholder="https://example.com"
                            value={currentPage.iframeUrl || ''}
                            onChange={(e) => setPages((prev) => prev.map((pg, i) => i === cur ? { ...pg, iframeUrl: e.target.value } : pg))}
                          />
                        </div>
                        <p style={{ fontSize: 9, color: '#888', margin: '2px 0 0', lineHeight: 1.4 }}>
                          💡 URL loads in an embedded frame. Add button elements on top for navigation overlays.
                          Note: some sites block iframe embedding (X-Frame-Options).
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Background ── */}
              <div className="acc-section">
                <button className={`acc-hdr${sOpen('page-background') ? ' open' : ''}`} onClick={() => toggleSection('page-background')}>
                  <span className="acc-icon">🌅</span><span className="acc-label">Background</span><span className="acc-chevron">{sOpen('page-background') ? '▼' : '►'}</span>
                </button>
                {sOpen('page-background') && (
                  <div className="acc-body">
                    <div className="pg-bg-section">
                      <div className="pg-bg-mode-row">
                        <span className="pg-bg-mode-label">BG</span>
                        <button
                          className={!currentPage.bgGradientEnabled ? 'on' : ''}
                          onClick={() => setPages((prev) => prev.map((pg, i) => i === cur ? { ...pg, bgGradientEnabled: false } : pg))}
                        >Solid</button>
                        <button
                          className={currentPage.bgGradientEnabled ? 'on' : ''}
                          onClick={() => setPages((prev) => prev.map((pg, i) => i === cur ? { ...pg, bgGradientEnabled: true } : pg))}
                        >Gradient</button>
                      </div>
                      {!currentPage.bgGradientEnabled ? (
                        <label>
                          Color
                          <SmartColorPicker
                            value={currentPage.bgColor || '#0a1a2a'}
                            onChange={(v) =>
                              setPages((prev) =>
                                prev.map((pg, i) => (i === cur ? { ...pg, bgColor: v } : pg)),
                              )
                            }
                          />
                        </label>
                      ) : (
                        <>
                          <div className="pg-gradient-row">
                            <label>
                              From
                              <SmartColorPicker
                                value={currentPage.bgGradientFrom || '#0a1a2a'}
                                onChange={(v) =>
                                  setPages((prev) =>
                                    prev.map((pg, i) => (i === cur ? { ...pg, bgGradientFrom: v } : pg)),
                                  )
                                }
                              />
                            </label>
                            <button
                              className="pg-swap-btn"
                              title="Swap gradient colors"
                              onClick={() =>
                                setPages((prev) =>
                                  prev.map((pg, i) =>
                                    i === cur
                                      ? { ...pg, bgGradientFrom: pg.bgGradientTo || '#1a3a5c', bgGradientTo: pg.bgGradientFrom || '#0a1a2a' }
                                      : pg,
                                  ),
                                )
                              }
                            >⇄</button>
                            <label>
                              To
                              <SmartColorPicker
                                value={currentPage.bgGradientTo || '#1a3a5c'}
                                onChange={(v) =>
                                  setPages((prev) =>
                                    prev.map((pg, i) => (i === cur ? { ...pg, bgGradientTo: v } : pg)),
                                  )
                                }
                              />
                            </label>
                          </div>
                          <label>
                            Angle ({currentPage.bgGradientAngle ?? 135}°)
                            <input
                              type="range"
                              min="0"
                              max="360"
                              value={currentPage.bgGradientAngle ?? 135}
                              onChange={(e) =>
                                setPages((prev) =>
                                  prev.map((pg, i) => (i === cur ? { ...pg, bgGradientAngle: Number(e.target.value) } : pg)),
                                )
                              }
                            />
                          </label>
                        </>
                      )}
                    </div>
                    <div className="pg-media-section">
                      <div className="pg-media-row">
                        <button
                          onClick={() => void chooseMedia('bg', 'all')}
                        >📁 Load Image/Video</button>
                        {currentPage.bgMediaSrc && (
                          <button
                            className="pg-media-clear"
                            title="Remove background media"
                            onClick={() =>
                              setPages((prev) =>
                                prev.map((pg, i) =>
                                  i === cur ? { ...pg, bgMediaSrc: '', bgMediaName: '', bgMediaKind: '', bgMediaSourcePath: '', bgImage: '' } : pg,
                                ),
                              )
                            }
                          >✕</button>
                        )}
                      </div>
                      {currentPage.bgMediaName && (
                        <div className="pg-media-name">
                          {currentPage.bgMediaKind === 'video' ? '🎬' : '🖼'} {currentPage.bgMediaName}
                        </div>
                      )}
                      {currentPage.bgMediaSrc && (
                        <label>
                          Transition
                          <select
                            value={currentPage.bgMediaTransition || 'fade'}
                            onChange={(e) =>
                              setPages((prev) =>
                                prev.map((pg, i) =>
                                  i === cur ? { ...pg, bgMediaTransition: e.target.value } : pg,
                                ),
                              )
                            }
                          >
                            <option value="none">Cut (no transition)</option>
                            <option value="fade">Fade</option>
                            <option value="zoom-in">Zoom In</option>
                            <option value="slide-up">Slide Up</option>
                            <option value="slide-right">Slide Right</option>
                          </select>
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Timing ── */}
              <div className="acc-section">
                <button className={`acc-hdr${sOpen('page-timing') ? ' open' : ''}`} onClick={() => toggleSection('page-timing')}>
                  <span className="acc-icon">⏱</span><span className="acc-label">Timing</span><span className="acc-chevron">{sOpen('page-timing') ? '▼' : '►'}</span>
                </button>
                {sOpen('page-timing') && (
                  <div className="acc-body">
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                      <button
                        className="inspector-btn"
                        title="Set ALL pages to this page's timing mode and duration"
                        style={{ fontSize: 10 }}
                        onClick={() => {
                          const tm = currentPage.timing || {}
                          setPages((prev) => prev.map((pg) => ({ ...pg, timing: { ...pg.timing,
                            mode: /** @type {any} */ (tm).mode,
                            duration: /** @type {any} */ (tm).duration,
                            waitInputTrigger: /** @type {any} */ (tm).waitInputTrigger,
                            waitInputKey: /** @type {any} */ (tm).waitInputKey,
                            waitInputGoto: /** @type {any} */ (tm).waitInputGoto } })))
                        }}
                      >Set ALL pages</button>
                      <button
                        className="inspector-btn"
                        title={`Set SELECTED pages — Ctrl+click or Shift+click pages in either panel first. Selected: ${selectedPageIds.length > 0 ? selectedPageIds.map(i => i + 1).join(', ') : 'none'}`}
                        style={{ fontSize: 10 }}
                        onClick={() => {
                          if (!selectedPageIds.length) { alert('No pages selected. Ctrl+click or Shift+click pages in the page panel first.'); return }
                          const tm = /** @type {any} */ (currentPage.timing || {})
                          setPages((prev) => prev.map((pg, i) =>
                            selectedPageIds.includes(i)
                              ? { ...pg, timing: { ...pg.timing, mode: tm.mode, duration: tm.duration,
                                  waitInputTrigger: tm.waitInputTrigger, waitInputKey: tm.waitInputKey, waitInputGoto: tm.waitInputGoto } }
                              : pg
                          ))
                        }}
                      >Set selected pages</button>
                    </div>
                    <label>
                      Timing
                      <select
                        value={(currentPage.timing || {}).mode}
                        onChange={(e) =>
                          setPages((prev) =>
                            prev.map((pg, i) =>
                              i === cur ? { ...pg, timing: { ...pg.timing, mode: e.target.value } } : pg,
                            ),
                          )
                        }
                      >
                        <option value="pause">⏱ Pause (timed)</option>
                        <option value="wait">⏸ Wait for click</option>
                        <option value="none">— None (no advance)</option>
                        <option value="loop">🔁 Loop (timed, wrap to first)</option>
                        <option value="wait-input-goto">⌨ Wait for input → Go to…</option>
                        <option value="auto">▶ Auto (timed advance)</option>
                      </select>
                    </label>
                    {((currentPage.timing || {}).mode === 'pause' || (currentPage.timing || {}).mode === 'loop' || (currentPage.timing || {}).mode === 'auto') && (
                      <label>
                        Duration (s)
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={(currentPage.timing || {}).duration}
                          onChange={(e) =>
                            setPages((prev) =>
                              prev.map((pg, i) =>
                                i === cur
                                  ? { ...pg, timing: { ...pg.timing, duration: Number(e.target.value) || 0 } }
                                  : pg,
                              ),
                            )
                          }
                        />
                      </label>
                    )}
                    <label title="Override this page's duration in MP4 export (0 = use audio length or default). Does not affect presentation playback.">
                      MP4 Export dur. (s)
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={(currentPage.timing || {}).exportDuration || ''}
                        placeholder="auto"
                        onChange={(e) =>
                          setPages((prev) =>
                            prev.map((pg, i) =>
                              i === cur
                                ? { ...pg, timing: { ...pg.timing, exportDuration: Number(e.target.value) || 0 } }
                                : pg,
                            ),
                          )
                        }
                      />
                    </label>
                    {(currentPage.timing || {}).mode === 'wait-input-goto' && (
                      <>
                        <label>
                          Trigger
                          <select
                            value={(currentPage.timing || {}).waitInputTrigger || 'click'}
                            onChange={(e) =>
                              setPages((prev) =>
                                prev.map((pg, i) =>
                                  i === cur ? { ...pg, timing: { ...pg.timing, waitInputTrigger: e.target.value } } : pg,
                                ),
                              )
                            }
                          >
                            <option value="click">Mouse Click</option>
                            <option value="key">Keyboard Key</option>
                            <option value="both">Click or Key</option>
                          </select>
                        </label>
                        {((currentPage.timing || {}).waitInputTrigger === 'key' || (currentPage.timing || {}).waitInputTrigger === 'both') && (
                          <label>
                            Key(s) (comma-separated, e.g. Enter,Space)
                            <input
                              value={(currentPage.timing || {}).waitInputKey || ''}
                              placeholder="Enter, ArrowRight, …"
                              onChange={(e) =>
                                setPages((prev) =>
                                  prev.map((pg, i) =>
                                    i === cur ? { ...pg, timing: { ...pg.timing, waitInputKey: e.target.value } } : pg,
                                  ),
                                )
                              }
                            />
                          </label>
                        )}
                        <label>
                          Go to page
                          <select
                            value={(currentPage.timing || {}).waitInputGoto || ''}
                            onChange={(e) =>
                              setPages((prev) =>
                                prev.map((pg, i) =>
                                  i === cur ? { ...pg, timing: { ...pg.timing, waitInputGoto: e.target.value } } : pg,
                                ),
                              )
                            }
                          >
                            <option value="">(next page)</option>
                            <option value="next">▶ Next</option>
                            <option value="prev">◀ Previous</option>
                            {pages.map((pg) => (
                              <option key={pg.id} value={pg.name}>{pg.name}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                    <label>
                      Condition
                      <select
                        value={(currentPage.timing || {}).ifMode || 'always'}
                        onChange={(e) =>
                          setPages((prev) =>
                            prev.map((pg, i) =>
                              i === cur ? { ...pg, timing: { ...pg.timing, ifMode: e.target.value } } : pg,
                            ),
                          )
                        }
                      >
                        <option value="always">Always</option>
                        <option value="count">IF visit count &lt;= N</option>
                        <option value="var">IF variable</option>
                      </select>
                    </label>
                    {(currentPage.timing || {}).ifMode === 'count' && (
                      <label>
                        Max visits
                        <input
                          type="number" min="1" max="999"
                          value={(currentPage.timing || {}).ifCount ?? 1}
                          onChange={(e) =>
                            setPages((prev) =>
                              prev.map((pg, i) =>
                                i === cur ? { ...pg, timing: { ...pg.timing, ifCount: Math.max(1, Number(e.target.value)) } } : pg,
                              ),
                            )
                          }
                        />
                      </label>
                    )}
                    {(currentPage.timing || {}).ifMode === 'var' && (
                      <>
                        <label>
                          Variable
                          <input
                            value={(currentPage.timing || {}).ifVar || ''}
                            onChange={(e) =>
                              setPages((prev) =>
                                prev.map((pg, i) =>
                                  i === cur ? { ...pg, timing: { ...pg.timing, ifVar: e.target.value } } : pg,
                                ),
                              )
                            }
                            placeholder="varName"
                          />
                        </label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <select
                            value={(currentPage.timing || {}).ifOp || '=='}
                            onChange={(e) =>
                              setPages((prev) =>
                                prev.map((pg, i) =>
                                  i === cur ? { ...pg, timing: { ...pg.timing, ifOp: e.target.value } } : pg,
                                ),
                              )
                            }
                            style={{ flex: '0 0 auto' }}
                          >
                            <option value="==">==</option>
                            <option value="!=">!=</option>
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                            <option value=">=">&gt;=</option>
                            <option value="<=">&lt;=</option>
                          </select>
                          <input
                            value={(currentPage.timing || {}).ifVal || ''}
                            onChange={(e) =>
                              setPages((prev) =>
                                prev.map((pg, i) =>
                                  i === cur ? { ...pg, timing: { ...pg.timing, ifVal: e.target.value } } : pg,
                                ),
                              )
                            }
                            placeholder="value"
                          />
                        </div>
                      </>
                    )}
                    <label>
                      THEN (after timing)
                      <select
                        value={(currentPage.timing || {}).onEnd || 'continue'}
                        onChange={(e) =>
                          setPages((prev) =>
                            prev.map((pg, i) =>
                              i === cur ? { ...pg, timing: { ...pg.timing, onEnd: e.target.value } } : pg,
                            ),
                          )
                        }
                      >
                        <option value="continue">Continue (normal)</option>
                        <option value="next">GOTO Next page</option>
                        <option value="prev">GOTO Previous page</option>
                        <option value="goto">GOTO Page →</option>
                        <option value="quit">Quit presentation</option>
                      </select>
                    </label>
                    {(currentPage.timing || {}).onEnd === 'goto' && (
                      <label>
                        GOTO page
                        <select
                          value={(currentPage.timing || {}).onEndTarget || ''}
                          onChange={(e) =>
                            setPages((prev) =>
                              prev.map((pg, i) =>
                                i === cur ? { ...pg, timing: { ...pg.timing, onEndTarget: e.target.value } } : pg,
                              ),
                            )
                          }
                        >
                          <option value="">(choose page)</option>
                          {pages.map((pg) => (
                            <option key={pg.id} value={pg.name}>{pg.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {((currentPage.timing || {}).ifMode === 'count' || (currentPage.timing || {}).ifMode === 'var') && (
                      <>
                        <label>
                          ELSE (if condition false)
                          <select
                            value={(currentPage.timing || {}).elseDo || 'none'}
                            onChange={(e) =>
                              setPages((prev) =>
                                prev.map((pg, i) =>
                                  i === cur ? { ...pg, timing: { ...pg.timing, elseDo: e.target.value } } : pg,
                                ),
                              )
                            }
                          >
                            <option value="none">Nothing</option>
                            <option value="next">GOTO Next page</option>
                            <option value="prev">GOTO Previous page</option>
                            <option value="goto">GOTO Page →</option>
                            <option value="quit">Quit presentation</option>
                          </select>
                        </label>
                        {(currentPage.timing || {}).elseDo === 'goto' && (
                          <label>
                            ELSE GOTO page
                            <select
                              value={(currentPage.timing || {}).elseTarget || ''}
                              onChange={(e) =>
                                setPages((prev) =>
                                  prev.map((pg, i) =>
                                    i === cur ? { ...pg, timing: { ...pg.timing, elseTarget: e.target.value } } : pg,
                                  ),
                                )
                              }
                            >
                              <option value="">(choose page)</option>
                              {pages.map((pg) => (
                                <option key={pg.id} value={pg.name}>{pg.name}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </>
                    )}
                    {currentPage.lyricStart != null && (
                      <div style={{ borderTop: '1px solid var(--border,#2c3a52)', marginTop: 8, paddingTop: 8 }}>
                        <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, marginBottom: 4 }}>🎤 Lyric Timing</div>
                        <label>
                          Start (s)
                          <input
                            type="number" min="0" step="0.1"
                            value={typeof currentPage.lyricStart === 'number' ? +currentPage.lyricStart.toFixed(3) : 0}
                            onChange={(e) => setPages((prev) => prev.map((pg, i) => i === cur ? { ...pg, lyricStart: Math.max(0, parseFloat(e.target.value) || 0) } : pg))}
                          />
                        </label>
                        <label>
                          End (s)
                          <input
                            type="number" min="0" step="0.1"
                            value={typeof currentPage.lyricEnd === 'number' ? +currentPage.lyricEnd.toFixed(3) : 4}
                            onChange={(e) => setPages((prev) => prev.map((pg, i) => i === cur ? { ...pg, lyricEnd: Math.max(0, parseFloat(e.target.value) || 0) } : pg))}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Audio ── */}
              <div className="acc-section">
                <button className={`acc-hdr${sOpen('page-audio', false) ? ' open' : ''}`} onClick={() => toggleSection('page-audio', false)}>
                  <span className="acc-icon">🔊</span><span className="acc-label">Audio</span><span className="acc-chevron">{sOpen('page-audio', false) ? '▼' : '►'}</span>
                </button>
                {sOpen('page-audio', false) && (
                  <div className="acc-body">
                    <div className="behavior-title narration-title" style={{ marginBottom: 4 }}>🎙 Narration</div>
                    <div className="narration-inspector">
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          className="narration-load-btn"
                          onClick={async () => {
                            const r = await pickFile('audio')
                            if (!r) return
                            setPages((prev) =>
                              prev.map((pg, i) =>
                                i === cur
                                  ? { ...pg, narration: { ...(pg.narration || {}), file: r.url, name: r.name } }
                                  : pg,
                              ),
                            )
                            setStatus(`Narration: ${r.name}`)
                          }}
                        >🎙 Load Narration</button>
                        {currentPage.narration?.file && (
                          <button
                            onClick={() =>
                              setPages((prev) =>
                                prev.map((pg, i) =>
                                  i === cur ? { ...pg, narration: { ...(pg.narration || {}), file: '', name: '' } } : pg,
                                ),
                              )
                            }
                          >✕ Clear</button>
                        )}
                      </div>
                      {currentPage.narration?.name && (
                        <div className="pg-media-name narration-name">🎙 {currentPage.narration.name}</div>
                      )}
                      {currentPage.narration?.file && (
                        <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <input
                            type="checkbox"
                            checked={currentPage.narration?.autoPlay !== false}
                            onChange={(e) =>
                              setPages((prev) =>
                                prev.map((pg, i) =>
                                  i === cur ? { ...pg, narration: { ...(pg.narration || {}), autoPlay: e.target.checked } } : pg,
                                ),
                              )
                            }
                          />
                          Auto-play on page enter
                        </label>
                      )}
                      {!currentPage.narration?.file && (
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>
                          Load an audio file to narrate this page. Plays when reader opens the spread.
                        </div>
                      )}
                      {/* Piper TTS — generate narration from page text */}
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border, #333)' }}>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>
                          Or generate narration from page text using offline neural TTS:
                        </div>
                        <PiperTTSPanel
                          compact
                          initialText={currentPage.elements?.filter((e) => e.type === 'text').map((e) => e.content || '').join(' ') || ''}
                          onClose={() => {}}
                          onSynthesized={({ path: wavPath, name: wavName }) => {
                            const port = window.smmDesktop?.mediaServerPort || 0
                            if (!port) return
                            const url = `http://127.0.0.1:${port}/?p=${encodeURIComponent(wavPath)}`
                            setPages((prev) => prev.map((pg, i) =>
                              i === cur
                                ? { ...pg, narration: { file: url, name: wavName, sourcePath: wavPath, autoPlay: true } }
                                : pg
                            ))
                            setStatus(`Narration set: ${wavName}`)
                          }}
                        />
                      </div>
                    </div>
                    {/* ── Whisper STT — transcribe narration/sound to text ── */}
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border, #333)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div className="behavior-title" style={{ margin: 0 }}>📝 Transcribe Audio → Text</div>
                        <button
                          onClick={() => setShowWhisper((v) => !v)}
                          style={{ fontSize: 10, padding: '1px 6px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--t2)', cursor: 'pointer' }}
                        >
                          {showWhisper ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {showWhisper && (
                        <WhisperPanel
                          audioUrl={currentPage.narration?.file || currentPage.sound?.file || ''}
                          audioName={currentPage.narration?.name || currentPage.sound?.name || ''}
                          onInsertText={(text) => {
                            // Add a new text element to the page with the transcript
                            const newEl = makeElem('text', 40, currentPage.elements?.length ? 200 : 100, (currentPage.width || 800), 80)
                            newEl.content = text
                            newEl.size = 18
                            setPages((prev) => prev.map((pg, i) =>
                              i === cur ? { ...pg, elements: [...(pg.elements || []), newEl] } : pg
                            ))
                            setStatus('Transcript inserted as text element')
                            setShowWhisper(false)
                          }}
                          onCreateLyricPages={(lines) => {
                            // Create lyric pages from transcribed segments
                            const lyricPages = lines.map((line, idx) => ({
                              id: `lyric-${Date.now()}-${idx}`,
                              name: `Lyric ${idx + 1}`,
                              type: 'lyric',
                              width: currentPage?.width || 1280,
                              height: currentPage?.height || 720,
                              background: currentPage?.background || { type: 'solid', color: '#000000' },
                              elements: [
                                Object.assign(
                                  makeElem('text', 50, currentPage?.height ? currentPage.height / 2 - 40 : 320, (currentPage?.width || 1280) - 100, 80),
                                  { content: line.text, size: 32, font: 'Arial', color: '#FFFFFF', align: 'center', weight: 'bold', elLabel: 'lyric' }
                                )
                              ],
                              sound: currentPage?.sound || null,
                              narration: currentPage?.narration || null,
                              lyricStart: line.start,
                              lyricEnd: line.end
                            }))
                            setPages((prev) => [...prev, ...lyricPages])
                            setCur(pages.length)
                            setStatus(`Created ${lyricPages.length} lyric pages`)
                            setShowWhisper(false)
                          }}
                          onClose={() => setShowWhisper(false)}
                        />
                      )}
                    </div>
                    {/* ── Karaoke Re-sync — re-run Whisper to restore word-by-word timing ── */}
                    {currentPage.wordTimestamps?.length > 0 && currentPage.elements?.some((e) => e.elLabel === 'lyric') && (
                      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border, #333)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div className="behavior-title" style={{ margin: 0 }}>🎤 Karaoke Word-Sync ({currentPage.wordTimestamps.length} words)</div>
                          <button
                            onClick={() => setShowKaraokeResync((v) => !v)}
                            style={{ fontSize: 10, padding: '1px 6px', background: 'var(--accent, #3cb8be)', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer' }}
                          >
                            {showKaraokeResync ? 'Hide' : '🔄 Re-sync'}
                          </button>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>
                          After editing lyric text, Re-sync re-runs Whisper on this page&apos;s audio to restore accurate word-by-word highlighting.
                        </div>
                        {showKaraokeResync && (
                          <WhisperPanel
                            compact
                            audioUrl={presentationAudio?.file || currentPage.narration?.file || currentPage.sound?.file || ''}
                            audioName={presentationAudio?.name || currentPage.narration?.name || currentPage.sound?.name || ''}
                            onTranscribeComplete={(res) => {
                              const freshWords = res.wordTimestamps?.length > 0
                                ? res.wordTimestamps
                                : (res.segments || []).flatMap((seg) =>
                                    seg.text.trim().split(/\s+/).map((word, wi, arr) => {
                                      const dur = (seg.end - seg.start) / arr.length
                                      return { word, start: seg.start + wi * dur, end: seg.start + (wi + 1) * dur }
                                    })
                                  )
                              if (freshWords.length > 0) {
                                setPages((prev) => prev.map((pg, i) => {
                                  if (i !== cur) return pg
                                  const lyricEl = pg.elements?.find((e) => e.elLabel === 'lyric')
                                  return {
                                    ...pg,
                                    wordTimestamps: freshWords,
                                    elements: lyricEl && res.text
                                      ? pg.elements.map((el) => el.id === lyricEl.id ? { ...el, content: res.text.trim() } : el)
                                      : pg.elements,
                                  }
                                }))
                                setStatus(`🎤 Karaoke re-synced — ${freshWords.length} words updated`)
                                setShowKaraokeResync(false)
                              }
                            }}
                            onClose={() => setShowKaraokeResync(false)}
                          />
                        )}
                      </div>
                    )}
                    {/* ── HuggingFace Token Settings ── */}
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border, #333)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div className="behavior-title" style={{ margin: 0 }}>🔑 HuggingFace Token (Professional Mode)</div>
                        <button
                          onClick={() => setShowHFSettings((v) => !v)}
                          style={{ fontSize: 10, padding: '1px 6px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--t2)', cursor: 'pointer' }}
                        >
                          {showHFSettings ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {showHFSettings && (
                        <HFTokenSettings onClose={() => setShowHFSettings(false)} />
                      )}
                    </div>
                    <div className="behavior-title" style={{ marginBottom: 4 }}>🎵 Presentation Track</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>
                      Plays continuously through ALL pages. Perfect for background music.
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button
                        onClick={async () => {
                          const r = await pickFile('audio')
                          if (!r) return
                          setPresentationAudio(prev => ({ ...prev, file: r.url, name: r.name, sourcePath: r.sourcePath || '' }))
                          setStatus(`Presentation track: ${r.name}`)
                        }}
                      >🎵 Load Track</button>
                      {presentationAudio?.file && (
                        <button onClick={() => setPresentationAudio({ file: '', name: '', volume: 1, loop: true, sourcePath: '', trimStart: 0, trimEnd: null, offset: 0, playbackRate: 1 })}>✕ Clear</button>
                      )}
                    </div>
                    {presentationAudio?.name && (
                      <div className="pg-media-name">🎵 {presentationAudio.name}</div>
                    )}
                    {presentationAudio?.file && (
                      <>
                        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <input type="checkbox" checked={presentationAudio?.loop !== false}
                            onChange={(e) => setPresentationAudio(prev => ({ ...prev, loop: e.target.checked }))} />
                          {' '}Loop track
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: 10, minWidth: 44 }}>Volume</span>
                          <input type="range" min={0} max={1} step={0.05}
                            value={presentationAudio?.volume ?? 1}
                            style={{ flex: 1 }}
                            onChange={(e) => setPresentationAudio(prev => ({ ...prev, volume: Number(e.target.value) }))} />
                          <span style={{ fontSize: 10, minWidth: 28 }}>{Math.round((presentationAudio?.volume ?? 1) * 100)}%</span>
                        </label>
                      </>
                    )}
                    <div style={{ borderTop: '1px solid var(--bg5)', marginTop: 8, marginBottom: 4 }} />
                    <div className="behavior-title" style={{ marginTop: 8, marginBottom: 4 }}>Background Sound</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button
                        onClick={async () => {
                          const r = await pickFile('audio')
                          if (!r) return
                          setPages((prev) =>
                            prev.map((pg, i) =>
                              i === cur
                                ? { ...pg, sound: { ...pg.sound, file: r.url, name: r.name, sourcePath: r.sourcePath || '' } }
                                : pg,
                            ),
                          )
                          setStatus(`Page sound: ${r.name}`)
                        }}
                      >♪ Load Sound</button>
                      {currentPage.sound?.file && (
                        <button
                          onClick={() =>
                            setPages((prev) =>
                              prev.map((pg, i) =>
                                i === cur ? { ...pg, sound: { ...pg.sound, file: '', name: '' } } : pg,
                              ),
                            )
                          }
                        >✕ Clear</button>
                      )}
                    </div>
                    {currentPage.sound?.name && (
                      <div className="pg-media-name">♪ {currentPage.sound.name}</div>
                    )}
                    {currentPage.sound?.file && (
                      <label>
                        <input
                          type="checkbox"
                          checked={!!currentPage.sound?.loops}
                          onChange={(e) =>
                            setPages((prev) =>
                              prev.map((pg, i) =>
                                i === cur ? { ...pg, sound: { ...pg.sound, loops: e.target.checked } } : pg,
                              ),
                            )
                          }
                        />
                        {' '}Loop sound
                      </label>
                    )}
                    {/* Persist audio across page navigation */}
                    <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--bg5)' }}>
                      <input
                        type="checkbox"
                        checked={!!currentPage.persistAudio}
                        onChange={(e) =>
                          setPages((prev) =>
                            prev.map((pg, i) =>
                              i === cur ? { ...pg, persistAudio: e.target.checked } : pg,
                            ),
                          )
                        }
                      />
                      {' '}🔊 Keep audio playing on next page
                    </label>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, paddingLeft: 20 }}>
                      When enabled, any audio/video playing on this page continues into the next instead of stopping.
                    </div>
                  </div>
                )}
              </div>

              {/* ── Presentation ── */}
              <div className="acc-section">
                <button className={`acc-hdr${sOpen('page-presentation', false) ? ' open' : ''}`} onClick={() => toggleSection('page-presentation', false)}>
                  <span className="acc-icon">⚙</span><span className="acc-label">Presentation</span><span className="acc-chevron">{sOpen('page-presentation', false) ? '▼' : '►'}</span>
                </button>
                {sOpen('page-presentation', false) && (
                  <div className="acc-body">
                    <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={presentationLoop} onChange={(e) => setPresentationLoop(e.target.checked)} />
                      {' '}Loop entire presentation
                    </label>
                    <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={presentationFullscreen} onChange={(e) => setPresentationFullscreen(e.target.checked)} />
                      {' '}Launch fullscreen (F5)
                    </label>
                    <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={presentationShowControls} onChange={(e) => setPresentationShowControls(e.target.checked)} />
                      {' '}Show controls bar
                    </label>
                    <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={presentationInteractive} onChange={(e) => setPresentationInteractive(e.target.checked)} />
                      {' '}Interactive mode (no controls)
                    </label>
                    <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={presentationHideMediaControls} onChange={(e) => setPresentationHideMediaControls(e.target.checked)} />
                      {' '}Hide media controls
                    </label>
                  </div>
                )}
              </div>

            </div>
          )}

          {inspectorTab === 'wipe' && currentPage && (
            <div className="insp-body">
              {/* ── Category filter ── */}
              <div className="wipe-cat-tabs">
                {WIPE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    className={`wipe-cat-tab${wipePanelCat === cat.key ? ' on' : ''}`}
                    onClick={() => setWipePanelCat(cat.key)}
                  >{cat.label}</button>
                ))}
              </div>

              {/* ── Sync toggle ── */}
              <div className="wipe-sync-row">
                <label style={{display:'flex',alignItems:'center',gap:5,fontSize:'11px',cursor:'pointer'}}>
                  <input type="checkbox" checked={wipeSync} onChange={(e) => setWipeSync(e.target.checked)} />
                  Sync In &amp; Out
                </label>
                <button
                  className="wipe-apply-all"
                  title="Apply current In/Out transitions to every page"
                  onClick={() => {
                    const wIn = currentPage.wipeIn
                    const wOut = currentPage.wipeOut
                    const sIn = currentPage.wipeInSpeed || 5
                    const sOut = currentPage.wipeOutSpeed || 5
                    setPages((prev) => prev.map((pg) => ({ ...pg, wipeIn: wIn, wipeOut: wOut, wipeInSpeed: sIn, wipeOutSpeed: sOut })))
                    setStatus('Transition applied to all pages')
                  }}
                >Apply to All Pages</button>
              </div>

              {/* ── Wipe In / Anim ── */}
              {wipePanelCat === 'anim' ? (
                // ── Animation mode: show ANIM_IN_TYPES and ANIM_OUT_TYPES ──
                selectedEl ? (
                  <div className="anim-inspector" style={{ padding: '4px 0' }}>
                    <div className="behavior-title" style={{ color: 'var(--mme-teal)', marginTop: 0 }}>🎬 Fly IN — Selected Element</div>
                    <label>
                      Animation In
                      <select value={selectedEl.animIn || 'none'} onChange={(e) => updateElement({ animIn: e.target.value })}>
                        {ANIM_IN_TYPES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                      </select>
                    </label>
                    {selectedEl.animIn && selectedEl.animIn !== 'none' && (
                      <>
                        <label>
                          Duration (ms)
                          <input type="number" min={100} max={5000} step={100} value={selectedEl.animInDuration ?? 600}
                            onChange={(e) => updateElement({ animInDuration: Math.max(100, Number(e.target.value)) })} />
                        </label>
                        <label>
                          Delay (ms)
                          <input type="number" min={0} max={10000} step={100} value={selectedEl.animInDelay ?? 0}
                            onChange={(e) => updateElement({ animInDelay: Math.max(0, Number(e.target.value)) })} />
                        </label>
                        <label>
                          Easing
                          <select value={selectedEl.animInEasing || 'ease-out'} onChange={(e) => updateElement({ animInEasing: e.target.value })}>
                            <option value="ease-out">Ease Out (smooth decel)</option>
                            <option value="ease-in">Ease In (slow start)</option>
                            <option value="ease-in-out">Ease In-Out</option>
                            <option value="linear">Linear</option>
                            <option value="cubic-bezier(0.34,1.56,0.64,1)">Spring (overshoot)</option>
                            <option value="cubic-bezier(0.68,-0.55,0.265,1.55)">Elastic</option>
                          </select>
                        </label>
                      </>
                    )}
                    <div className="behavior-title" style={{ color: 'var(--mme-teal)', marginTop: 10 }}>🎬 Fly OUT — Selected Element</div>
                    <label>
                      Animation Out
                      <select value={selectedEl.animOut || 'none'} onChange={(e) => updateElement({ animOut: e.target.value })}>
                        {ANIM_OUT_TYPES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                      </select>
                    </label>
                    {selectedEl.animOut && selectedEl.animOut !== 'none' && (
                      <>
                        <label>
                          Duration (ms)
                          <input type="number" min={100} max={5000} step={100} value={selectedEl.animOutDuration ?? 600}
                            onChange={(e) => updateElement({ animOutDuration: Math.max(100, Number(e.target.value)) })} />
                        </label>
                        <label>
                          Trigger
                          <select value={selectedEl.animOutTrigger || 'never'} onChange={(e) => updateElement({ animOutTrigger: e.target.value })}>
                            <option value="never">Never (stay visible)</option>
                            <option value="auto">Auto (after delay)</option>
                            <option value="click">On Click / Tap</option>
                            <option value="key">On Key Press</option>
                          </select>
                        </label>
                        {selectedEl.animOutTrigger === 'auto' && (
                          <label>
                            Dwell before fly-out (ms)
                            <input type="number" min={0} max={30000} step={250} value={selectedEl.animOutDelay ?? 0}
                              onChange={(e) => updateElement({ animOutDelay: Math.max(0, Number(e.target.value)) })} />
                          </label>
                        )}
                      </>
                    )}
                    <p className="muted" style={{ fontSize: 9, marginTop: 6 }}>💡 Select an element then set its IN and OUT animations here. Changes also visible in Props &gt; Event In/Out.</p>
                  </div>
                ) : (
                  <p className="muted" style={{ padding: 12 }}>Select an element on the canvas to set its animations.</p>
                )
              ) : (
                // ── Normal wipe thumbnail picker ──
                (() => {
                  const cat = WIPE_CATEGORIES.find((c) => c.key === wipePanelCat)
                  const visibleWipes = cat?.wipes ? WIPES.filter((w) => cat.wipes.includes(w)) : WIPES
                  const updateWipeIn = (w) => setPages((prev) => prev.map((pg, i) => i === cur
                    ? { ...pg, wipeIn: w, ...(wipeSync ? { wipeOut: w } : {}) }
                    : pg))
                  const updateWipeOut = (w) => setPages((prev) => prev.map((pg, i) => i === cur
                    ? { ...pg, wipeOut: w, ...(wipeSync ? { wipeIn: w } : {}) }
                    : pg))
                  return (
                    <>
                      <div className="behavior-title">
                        Wipe In
                        <span className="wipe-current-label">{currentPage.wipeIn || 'Fade'}</span>
                      </div>
                      <div className="wipe-thumb-grid wipe-thumb-grid-4">
                        {visibleWipes.map((w) => (
                          <button
                            key={w}
                            title={`${w} — ${WIPE_META[w]?.desc || ''}`}
                            data-tip={WIPE_META[w]?.desc ? `${w}: ${WIPE_META[w].desc}` : w}
                            className={`wipe-thumb-btn${currentPage.wipeIn === w ? ' on' : ''}`}
                            onClick={() => updateWipeIn(w)}
                          >
                            <WipeThumbnail wipe={w} />
                            <span className="wipe-thumb-label">{w}</span>
                          </button>
                        ))}
                      </div>
                      <label className="wipe-speed-row">
                        Speed&nbsp;<b>{currentPage.wipeInSpeed || 5}</b>
                        <input type="range" min="1" max="10"
                          value={currentPage.wipeInSpeed || 5}
                          onChange={(e) => setPages((prev) => prev.map((pg, i) => i === cur
                            ? { ...pg, wipeInSpeed: Number(e.target.value), ...(wipeSync ? { wipeOutSpeed: Number(e.target.value) } : {}) }
                            : pg))}
                        />
                      </label>
                      {!wipeSync && (
                        <>
                          <div className="behavior-title" style={{ marginTop: 6 }}>
                            Wipe Out
                            <span className="wipe-current-label">{currentPage.wipeOut || 'Fade'}</span>
                          </div>
                          <div className="wipe-thumb-grid wipe-thumb-grid-4">
                            {visibleWipes.map((w) => (
                              <button
                                key={w}
                                title={`${w} — ${WIPE_META[w]?.desc || ''}`}
                                data-tip={WIPE_META[w]?.desc ? `${w}: ${WIPE_META[w].desc}` : w}
                                className={`wipe-thumb-btn${currentPage.wipeOut === w ? ' on' : ''}`}
                                onClick={() => updateWipeOut(w)}
                              >
                                <WipeThumbnail wipe={w} />
                                <span className="wipe-thumb-label">{w}</span>
                              </button>
                            ))}
                          </div>
                          <label className="wipe-speed-row">
                            Speed&nbsp;<b>{currentPage.wipeOutSpeed || 5}</b>
                            <input type="range" min="1" max="10"
                              value={currentPage.wipeOutSpeed || 5}
                              onChange={(e) => setPages((prev) => prev.map((pg, i) => i === cur
                                ? { ...pg, wipeOutSpeed: Number(e.target.value) }
                                : pg))}
                            />
                          </label>
                        </>
                      )}
                    </>
                  )
                })()
              )}
            </div>
          )}
            </>}
          </aside>
        )}

      </main>

      {/* ── Timeline strip ─────────────────────────────────────── */}
      {panelVisible.bottom && (
        <div
          className="panel-divider panel-divider-h"
          onMouseDown={(e) => onPanelDividerMouseDown(e, 'bottom')}
          title="Drag to resize timeline"
        />
      )}
      {panelVisible.bottom && (
        <div className="timeline-strip" style={{ height: panelSizes.bottom, minHeight: panelSizes.bottom, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PresentationTimeline
            pages={pages}
            currentIdx={playIdx >= 0 ? playerCurIdx : cur}
            onPagesChange={setPages}
            onPagesReorder={playIdx < 0 ? (newPgs) => { pushHistory(true); setPages(newPgs) } : undefined}
            onPageClick={(i) => { if (playIdx < 0) goToPage(i) }}
            onPageSelect={playIdx < 0 ? handlePageSelect : undefined}
            selectedPageIds={selectedPageIds}
            presentationAudio={presentationAudio?.file ? presentationAudio : null}
            presAudioEl={outerPresAudioRef.current}
            onPageAdd={playIdx < 0 ? () => executeCommand('page-new') : undefined}
            onPageDelete={playIdx < 0 ? () => executeCommand('page-delete') : undefined}
            onAudioChange={playIdx < 0 ? (updates) => setPresentationAudio(prev => ({ ...prev, ...updates })) : undefined}
            onResyncAudio={playIdx < 0 ? () => setShowKaraokeResync(true) : undefined}
          />
        </div>
      )}

      <footer className="statusbar">
        <span>{playIdx >= 0 ? 'Mode: Play' : 'Mode: Edit'}</span>
        <span>File: {filename}</span>
        <span>Page: {cur + 1}/{pages.length}</span>
        {selectedEl && (
          <span className="statusel">
            {selectedEl.type.toUpperCase()}
            {selectedEl.mediaName ? ` · ${selectedEl.mediaName}` : selectedEl.type === 'text' ? ` · ${String(selectedEl.content || '').slice(0, 20)}` : ''}
            {' '}@ {selectedEl.x},{selectedEl.y} · {selectedEl.w}×{selectedEl.h}
          </span>
        )}
        <span className="statusmsg">{status}</span>
      </footer>

      {showShortcuts && <ShortcutsPanel onClose={() => setShowShortcuts(false)} />}
      {mediaResolver?.open && (
        <MediaResolveDialog
          state={mediaResolver}
          desktopApi={desktopApi}
          onApply={(updatedPages) => {
            setPages(updatedPages)
            setMediaResolver(null)
            setStatus(`Media resolved — ${updatedPages.flatMap(pg => pg.elements).filter(el => (el.type === 'clip' || el.type === 'mpeg') && el.file?.startsWith('data:')).length} files loaded`)
          }}
          onDismiss={() => setMediaResolver(prev => prev ? { ...prev, open: false } : null)}
        />
      )}
      {newProjectDlg && (
        <NewProjectDialog
          hasUnsaved={projectHasContent()}
          onApply={applyTemplate}
          onCancel={() => setNewProjectDlg(false)}
          onSaveFirst={onSave}
        />
      )}

      {/* ── PDF Import Progress Overlay ──────────── */}
      {pdfImportProgress && (
        <div className="sb-overlay">
          <div className="sb-overlay-box">
            <div className="sb-overlay-icon">📄</div>
            <div className="sb-overlay-title">Importing PDF…</div>
            <div className="sb-overlay-msg">{pdfImportProgress.msg}</div>
            {pdfImportProgress.total > 0 && (
              <div className="sb-progress-bar-wrap">
                <div
                  className="sb-progress-bar"
                  style={{ width: `${Math.round((pdfImportProgress.page / pdfImportProgress.total) * 100)}%` }}
                />
              </div>
            )}
            <div className="sb-overlay-sub">{pdfImportProgress.page > 0 ? `${pdfImportProgress.page} / ${pdfImportProgress.total} pages` : ''}</div>
          </div>
        </div>
      )}

      {/* ── Storybook Export Password Dialog ─────── */}
      {sbPasswordDlg && (
        <div className="sb-overlay">
          <div className="sb-overlay-box sb-pw-box">
            <div className="sb-overlay-icon">📖</div>
            <div className="sb-overlay-title">Export Storybook (PWA)</div>
            <div className="sb-overlay-msg">
              Exports a self-contained ZIP file that works as a website, installable app (PWA) on iOS, Android and desktop — viewable offline.
            </div>
            <StorybookPasswordForm
              onExport={(pw) => { setSbPasswordDlg(false); void exportStorybookPwa(pw) }}
              onCancel={() => setSbPasswordDlg(false)}
            />
          </div>
        </div>
      )}

      {/* ── Print Dialog ── */}
      {showPrintDlg && (
        <PrintDialog
          pages={pages}
          currentPage={cur}
          stageWidth={stageWidth}
          stageHeight={stageHeight}
          renderPage={renderPageToDataUrl}
          onClose={() => setShowPrintDlg(false)}
        />
      )}

      {/* ── Interaction Editor modal ── */}
      {interactionEditorEl && (() => {
        // Always use fresh element data from pages
        const freshEl = pages.flatMap(pg => pg.elements || []).find(e => e.id === interactionEditorEl.id) || interactionEditorEl
        return (
          <InteractionEditor
            el={freshEl}
            pages={pages}
            projectVars={projectVars}
            onUpdate={(patch) => {
              updateElement(patch)
              // keep modal open with same element
            }}
            onClose={() => setInteractionEditorEl(null)}
          />
        )
      })()}

      {/* ── Page Script Editor modal ── */}
      {showPageScriptEditor && currentPage && (
        <PageScriptEditor
          page={currentPage}
          projectVars={projectVars}
          onChange={(fields) => setPages(prev => prev.map((pg, i) => i === cur ? { ...pg, ...fields } : pg))}
          onClose={() => setShowPageScriptEditor(false)}
        />
      )}

      {/* ── Publish Dialog ── */}
      {showPublishDlg && (
        <PublishDialog
          pages={pages}
          stage={{ width: stageWidth, height: stageHeight }}
          projectVars={projectVars}
          filename={filename}
          presentationAudio={presentationAudio?.file ? presentationAudio : undefined}
          onClose={() => setShowPublishDlg(false)}
          onStatus={setStatus}
          onExportScript={() => { setShowPublishDlg(false); onExportScript() }}
          onExportBook={() => { setShowPublishDlg(false); setSbPasswordDlg(true) }}
          onExportMp4={() => { setShowPublishDlg(false); setShowScriptExportModal(true) }}
        />
      )}

      {/* ── Import Pages Dialog ── */}
      {importPagesData && (
        <ImportPagesDialog
          importedData={importPagesData}
          onCancel={() => setImportPagesData(null)}
          onImport={(selectedPages, insertMode) => {
            const newPages = selectedPages.map(pg => ({
              ...pg,
              id: uid(),
              elements: (pg.elements || []).map(el => ({ ...el, id: uid() })),
            }))

            // ── 1. Merge imported projectVars (skip duplicates by name) ──
            if (importPagesData?.projectVars?.length) {
              setProjectVars(prev => {
                const existingNames = new Set(prev.map(v => v.name))
                const toAdd = (importPagesData.projectVars || []).filter(v => !existingNames.has(v.name))
                return toAdd.length ? [...prev, ...toAdd] : prev
              })
            }

            // ── 2. Compute the full merged pages array ──
            let insertOffset
            const fullPages = (() => {
              if (insertMode === 'start') { insertOffset = 0; return [...newPages, ...pages] }
              if (insertMode === 'after-current') {
                insertOffset = cur + 1
                const next = [...pages]; next.splice(cur + 1, 0, ...newPages); return next
              }
              insertOffset = pages.length; return [...pages, ...newPages]
            })()

            // ── 3. Scan imported pages for unresolved media ──
            const unresolvedEls = []
            newPages.forEach((pg, localIdx) => {
              const pageIdx = insertOffset + localIdx
              const bgPath = pg.bgMediaSourcePath || (pg.bgImage && isUnresolvedMediaPath(pg.bgImage) ? pg.bgImage : null)
              if (bgPath && isUnresolvedMediaPath(bgPath)) {
                const bgName = pg.bgMediaName || bgPath.split(/[/\\]/).pop() || bgPath
                unresolvedEls.push({
                  pageIdx,
                  elIdx: -1,
                  field: 'bgMedia',
                  srcPath: bgPath,
                  mediaName: bgName,
                  filename: bgName,
                  fullRef: bgPath,
                })
              }
              ;(pg.elements || []).forEach((el, elIdx) => {
                if ((el.type === 'clip' || el.type === 'mpeg') && el.file && isUnresolvedMediaPath(el.file)) {
                  const fileName = el.mediaName || el.file.split(/[/\\]/).pop() || el.file
                  unresolvedEls.push({
                    pageIdx,
                    elIdx,
                    field: 'file',
                    srcPath: el.file,
                    mediaName: fileName,
                    filename: fileName,
                    fullRef: el.file,
                  })
                } else if (el.type === 'button' && el.btnImage && isUnresolvedMediaPath(el.btnImage)) {
                  const btnName = el.mediaName || el.btnImage.split(/[/\\]/).pop() || el.btnImage
                  unresolvedEls.push({
                    pageIdx,
                    elIdx,
                    field: 'btnImage',
                    srcPath: el.btnImage,
                    mediaName: btnName,
                    filename: btnName,
                    fullRef: el.btnImage,
                  })
                }
              })
            })

            // ── 4. Apply pages and close dialog ──
            setPages(fullPages)
            setImportPagesData(null)

            if (unresolvedEls.length > 0) {
              setStatus(`✅ Imported ${newPages.length} page(s) — ⚠ ${unresolvedEls.length} media file(s) not found — click "Resolve Media" to locate`)
              setMediaResolver({ unresolvedEls, resolvedPages: fullPages, open: true })
            } else {
              setStatus(`✅ Imported ${newPages.length} page${newPages.length !== 1 ? 's' : ''}`)
            }
          }}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// TextFormatBar — floating text-element formatting toolbar
// ──────────────────────────────────────────────────────────────
function TextFormatBar({ el, onChange }) {
  // Common font sizes for quick picker
  const SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 60, 72, 96]

  return (
    <div className="tfb">
      {/* Font family */}
      <FontPicker
        value={el.font || 'Rajdhani'}
        onChange={(f) => onChange({ font: f })}
        style={{ minWidth: 140 }}
      />

      {/* Font size — type or pick */}
      <input
        className="tfb-size-input"
        type="number"
        min={1} max={500}
        value={el.size}
        onChange={(e) => onChange({ size: Number(e.target.value) || 1 })}
        title="Font size (px)"
      />
      <select
        className="tfb-size-sel"
        value={SIZES.includes(el.size) ? el.size : ''}
        onChange={(e) => e.target.value && onChange({ size: Number(e.target.value) })}
        title="Quick size"
      >
        <option value="">─</option>
        {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <span className="tfb-sep" />

      {/* Bold / Italic / Underline */}
      <button
        className={`tfb-btn tfb-bold${Number(el.weight) >= 700 ? ' tfb-on' : ''}`}
        title="Bold"
        onClick={() => onChange({ weight: Number(el.weight) >= 700 ? 400 : 700 })}
      ><b>B</b></button>
      <button
        className={`tfb-btn tfb-italic${el.italic ? ' tfb-on' : ''}`}
        title="Italic"
        onClick={() => onChange({ italic: !el.italic })}
      ><i>I</i></button>
      <button
        className={`tfb-btn tfb-underline${el.underline ? ' tfb-on' : ''}`}
        title="Underline"
        onClick={() => onChange({ underline: !el.underline })}
      ><u>U</u></button>
      <button
        className={`tfb-btn${el.shadow ? ' tfb-on' : ''}`}
        title="Text shadow"
        onClick={() => onChange({ shadow: !el.shadow })}
      >Shd</button>
      <button
        className={`tfb-btn${el.outline ? ' tfb-on' : ''}`}
        title="Text outline"
        onClick={() => onChange({ outline: !el.outline })}
      >Otl</button>
      {el.outline && (
        <span className="tfb-color-wrap" title="Outline colour">
          <SmartColorPicker
            value={el.outlineColor || '#000000'}
            onChange={(v) => onChange({ outlineColor: v })}
          />
        </span>
      )}

      <span className="tfb-sep" />

      {/* Alignment */}
      {['left', 'center', 'right'].map((a) => (
        <button
          key={a}
          className={`tfb-btn tfb-align${el.align === a ? ' tfb-on' : ''}`}
          title={`Align ${a}`}
          onClick={() => onChange({ align: a })}
        >
          {a === 'left' ? '⬛▭▭' : a === 'center' ? '▭⬛▭' : '▭▭⬛'}
        </button>
      ))}

      <span className="tfb-sep" />

      {/* Text colour */}
      <span className="tfb-color-wrap" title="Text colour">
        <span className="tfb-color-icon">A</span>
        <SmartColorPicker value={el.color || '#e2e6ea'} onChange={(v) => onChange({ color: v })} />
      </span>

      {/* Background colour toggle + picker */}
      <button
        className={`tfb-btn${el.bgOn ? ' tfb-on' : ''}`}
        title="Text background"
        onClick={() => onChange({ bgOn: !el.bgOn })}
      >Bg</button>
      {el.bgOn && (
        <span className="tfb-color-wrap" title="Background colour">
          <SmartColorPicker value={el.bgColor || '#000000'} onChange={(v) => onChange({ bgColor: v })} />
        </span>
      )}

      <span className="tfb-sep" />

      {/* V-align */}
      <select
        className="tfb-valign-sel"
        value={el.vAlign || 'middle'}
        onChange={(e) => onChange({ vAlign: e.target.value })}
        title="Vertical align"
      >
        <option value="top">↑ Top</option>
        <option value="middle">⇕ Mid</option>
        <option value="bottom">↓ Bot</option>
      </select>
    </div>
  )
}

function StorybookPasswordForm({ onExport, onCancel }) {
  const [pw, setPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [err, setErr] = useState('')

  function submit() {
    if (usePassword) {
      if (!pw) { setErr('Enter a password or disable password protection.'); return }
      if (pw !== confirmPw) { setErr('Passwords do not match.'); return }
    }
    onExport(usePassword ? pw : '')
  }

  return (
    <div className="sb-pw-form">
      <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={usePassword} onChange={e => { setUsePassword(e.target.checked); setErr('') }} />
        Password-protect this book
      </label>
      {usePassword && (
        <>
          <input
            type="password"
            className="sb-pw-input"
            placeholder="Enter password…"
            value={pw}
            onChange={e => { setPw(e.target.value); setErr('') }}
            autoFocus
          />
          <input
            type="password"
            className="sb-pw-input"
            placeholder="Confirm password…"
            value={confirmPw}
            onChange={e => { setConfirmPw(e.target.value); setErr('') }}
          />
        </>
      )}
      {!usePassword && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>
          Book will be open to anyone. Enable the checkbox above to add a password.
        </div>
      )}
      {err && <div style={{ color: '#ff6060', fontSize: 12 }}>{err}</div>}
      <div className="sb-pw-actions">
        <button className="sb-pw-cancel" onClick={onCancel}>Cancel</button>
        <button className="sb-pw-export" onClick={submit}>📦 Export ZIP</button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// MediaTimeline — inspector panel for clip/mpeg media timing
// ──────────────────────────────────────────────────────────────
function MediaTimeline({ el, pages, onUpdate }) {
  const isVideo = el.type === 'mpeg' || el.mediaKind === 'video' || (el.file && /\.(mp4|mov|avi|webm|mkv|m4v|flv|wmv)$/i.test(el.file))
  const isAudio = el.mediaKind === 'audio' || (el.file && /\.(mp3|wav|ogg|flac|aac|m4a|wma|mid|midi)$/i.test(el.file))
  const hasTime = isVideo || isAudio

  const WIPE_OPTIONS = [
    { key: 'none', label: '— None (instant) —' },
    { key: 'fade', label: '✨ Fade' },
    { key: 'cut',  label: '✂ Cut (hard)' },
    { key: 'smm-fly-left',   label: '← Fly from Left' },
    { key: 'smm-fly-right',  label: '→ Fly from Right' },
    { key: 'smm-fly-top',    label: '↑ Fly from Top' },
    { key: 'smm-fly-bottom', label: '↓ Fly from Bottom' },
    { key: 'smm-zoom-in',    label: '🔍 Zoom In' },
    { key: 'smm-zoom-big',   label: '🔎 Zoom from Big' },
    { key: 'smm-spiral-in',  label: '🌀 Spiral In' },
    { key: 'smm-bounce-in',  label: '🏀 Bounce In' },
    { key: 'smm-flip-x',     label: '↕ Flip (3D Vert)' },
    { key: 'smm-flip-y',     label: '↔ Flip (3D Horiz)' },
    { key: 'smm-rotate-in',  label: '🔄 Rotate In' },
    { key: 'smm-drop-in',    label: '⬇ Drop + Bounce' },
    { key: 'Fade',            label: '⧗ Fade' },
    { key: 'PageFlip',        label: '📖 Page Flip' },
    { key: 'Wipe',            label: '▶ Wipe' },
    { key: 'ZoomUp',          label: '🔭 Zoom Up' },
    { key: 'ZoomInOut',       label: '🔭 Zoom In-Out' },
    { key: 'SpiralIris',      label: '🌀 Spiral Iris' },
    { key: 'Vortex',          label: '🌀 Vortex' },
    { key: 'BouncingBlinds',  label: '🎪 Bouncing Blinds' },
    { key: 'SmallBlinds',     label: '🎪 Small Blinds' },
    { key: 'Cascade',         label: '🌊 Cascade' },
    { key: 'Stacker',         label: '📦 Stacker' },
  ]

  const WIPE_OUT_OPTIONS = [
    { key: 'none', label: '— None (instant) —' },
    { key: 'fade', label: '✨ Fade Out' },
    { key: 'cut',  label: '✂ Cut (hard)' },
    { key: 'smm-fly-left-out',   label: '← Fly to Left' },
    { key: 'smm-fly-right-out',  label: '→ Fly to Right' },
    { key: 'smm-fly-top-out',    label: '↑ Fly to Top' },
    { key: 'smm-fly-bottom-out', label: '↓ Fly to Bottom' },
    { key: 'smm-zoom-out',       label: '🔍 Zoom Out' },
    { key: 'smm-zoom-big-out',   label: '🔎 Zoom to Big' },
    { key: 'smm-spiral-out',     label: '🌀 Spiral Out' },
    { key: 'smm-flip-x-out',     label: '↕ Flip Out (3D)' },
    { key: 'smm-rotate-out',     label: '🔄 Rotate Out' },
    { key: 'smm-fade-out',       label: '✨ Fade Out (anim)' },
    { key: 'Fade',               label: '⧗ Fade' },
    { key: 'Wipe',               label: '▶ Wipe Out' },
    { key: 'Vortex',             label: '🌀 Vortex Out' },
  ]

  function fmtTime(sec) {
    if (sec == null) return '—'
    if (el.mediaTimeMode === 'frames') return `${Math.round(sec * (el.mediaFPS || 25))} fr`
    const m = Math.floor(sec / 60)
    const s = (sec % 60).toFixed(1)
    return m > 0 ? `${m}:${s.padStart(4, '0')}` : `${s}s`
  }

  function parseInput(val, mode, fps) {
    if (val === '' || val == null) return null
    const n = parseFloat(val)
    if (isNaN(n)) return null
    return mode === 'frames' ? n / (fps || 25) : n
  }

  const mode = el.mediaTimeMode || 'seconds'
  const fps  = el.mediaFPS || 25

  const PAUSE_ACTIONS = [
    { value: 'none',         label: '— Do nothing (resume) —' },
    { value: 'loop',         label: '🔁 Loop back to start' },
    { value: 'stop',         label: '⏹ Stop (freeze frame)' },
    { value: 'next',         label: '▶ Go to next page' },
    { value: 'prev',         label: '◀ Go to previous page' },
    { value: 'goto-page',    label: '↗ Go to page…' },
    { value: 'goto-element', label: '🔗 Highlight element…' },
    { value: 'hyperlink',    label: '🌐 Open URL…' },
    { value: 'script',       label: '⚡ Run script…' },
  ]

  return (
    <div className="media-tl">
      {/* ── Time mode toggle ── */}
      <div className="media-tl-header">
        <span className="behavior-title" style={{ flex: 1, marginBottom: 0 }}>🎬 Media Timeline</span>
        <div className="media-tl-mode-btns">
          <button className={mode === 'seconds' ? 'on' : ''} onClick={() => onUpdate({ mediaTimeMode: 'seconds' })}>sec</button>
          <button className={mode === 'frames' ? 'on' : ''} onClick={() => onUpdate({ mediaTimeMode: 'frames' })}>
            fr
          </button>
          {mode === 'frames' && (
            <input
              type="number"
              className="media-tl-fps"
              title="Frames per second"
              value={fps}
              min={1} max={120}
              onChange={(e) => onUpdate({ mediaFPS: Math.max(1, Number(e.target.value)) })}
            />
          )}
        </div>
      </div>

      {/* ── Visual timeline bar ── */}
      <div className="media-tl-bar" title="Timeline (not to scale)">
        <div className="media-tl-segment media-tl-seg-in"
          style={{ width: '12%' }}
          title={`In: ${el.mediaInTransition || 'none'}`}>
          <span>IN</span>
        </div>
        <div className="media-tl-segment media-tl-seg-play" style={{ flex: 1 }}
          title="Play region">
          <span>▶ PLAY</span>
          {el.mediaPauseTime != null && (
            <div className="media-tl-pause-marker" title={`Pause at ${fmtTime(el.mediaPauseTime)}`}>⏸</div>
          )}
        </div>
        <div className="media-tl-segment media-tl-seg-out"
          style={{ width: '12%' }}
          title={`Out: ${el.mediaOutTransition || 'none'}`}>
          <span>OUT</span>
        </div>
      </div>

      {/* ── Playback Mode ── */}
      {hasTime && (() => {
        // Derive current mode from stored props (backward compatible)
        const pbMode = el.playDurationMs != null && el.playDurationMs > 0
          ? 'duration'
          : (el.playCount && el.playCount > 0) ? 'count'
          : 'loop'

        // Duration helpers — decompose playDurationMs into D/H/S/MS
        const totalMs  = el.playDurationMs || 0
        const durD     = Math.floor(totalMs / 86400000)
        const durH     = Math.floor((totalMs % 86400000) / 3600000)
        const durS     = Math.floor((totalMs % 3600000)  / 1000)
        const durMs    = totalMs % 1000

        function setDuration(d, h, s, ms) {
          onUpdate({ playDurationMs: d * 86400000 + h * 3600000 + s * 1000 + ms, loop: false, playCount: null })
        }

        const modeBtn = (id, icon, label) => (
          <button
            key={id}
            onClick={() => {
              if (id === 'loop')     onUpdate({ loop: true,  playCount: null, playDurationMs: null })
              if (id === 'count')    onUpdate({ loop: false, playCount: el.playCount || 1, playDurationMs: null })
              if (id === 'duration') onUpdate({ loop: false, playCount: null, playDurationMs: el.playDurationMs || 10000 })
            }}
            style={{
              flex: 1, fontSize: 10, padding: '3px 4px',
              background: pbMode === id ? 'var(--mme-teal)' : 'var(--be-bg2)',
              color: pbMode === id ? '#fff' : 'var(--be-text)',
              border: `1px solid ${pbMode === id ? 'var(--mme-teal)' : 'var(--be-border)'}`,
              borderRadius: 4, cursor: 'pointer',
            }}
            title={label}
          >{icon} {label}</button>
        )

        return (
          <div style={{ marginTop: 8 }}>
            <div className="behavior-title" style={{ marginBottom: 4 }}>▶ Playback Mode</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {modeBtn('loop',     '🔁', 'Loop')}
              {modeBtn('count',    '🔢', 'N Times')}
              {modeBtn('duration', '⏱', 'Duration')}
            </div>

            {pbMode === 'loop' && (
              <p className="muted" style={{ fontSize: 9, margin: '0 0 4px' }}>
                Media plays continuously until an event elsewhere on the page.
              </p>
            )}

            {pbMode === 'count' && (
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#aaa', whiteSpace: 'nowrap' }}>Play</span>
                <input
                  type="number" min={1} max={999} step={1}
                  value={el.playCount || 1}
                  onChange={(e) => onUpdate({ playCount: Math.max(1, Math.min(999, Number(e.target.value))), loop: false, playDurationMs: null })}
                  style={{ width: 52, fontSize: 11 }}
                />
                <span style={{ fontSize: 10, color: '#aaa' }}>time(s) then stop</span>
              </label>
            )}

            {pbMode === 'duration' && (
              <div>
                <div style={{ fontSize: 9, color: '#aaa', marginBottom: 4 }}>
                  Play for this duration (then stop):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
                  {/** @type {Array<[string, number, number, number, (v: number) => void]>} */([
                    ['D', durD, 0, 9999, (v) => setDuration(v, durH, durS, durMs)],
                    ['H', durH, 0, 23,   (v) => setDuration(durD, v, durS, durMs)],
                    ['S', durS, 0, 59,   (v) => setDuration(durD, durH, v, durMs)],
                    ['MS',durMs, 0, 999, (v) => setDuration(durD, durH, durS, v)],
                  ]).map(([unit, val, min, max, cb]) => (
                    <div key={unit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 9, color: '#888' }}>{unit}</span>
                      <input
                        type="number" min={min} max={max} step={1}
                        value={val}
                        onChange={(e) => cb(Math.max(min, Math.min(max, Number(e.target.value))))}
                        style={{ width: '100%', fontSize: 11, textAlign: 'center' }}
                      />
                    </div>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: 9, margin: '4px 0 0' }}>
                  Total: {totalMs >= 86400000 ? `${durD}d ` : ''}{durH > 0 ? `${durH}h ` : ''}{durS}s {durMs}ms = {(totalMs/1000).toFixed(3)}s
                </p>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Start time ── */}
      {hasTime && (
        <label>
          ▶ Start {mode === 'frames' ? '(frame)' : '(seconds)'}
          <input
            type="number"
            min={0}
            step={mode === 'frames' ? 1 : 0.1}
            value={mode === 'frames'
              ? Math.round((el.mediaStartTime || 0) * fps)
              : (el.mediaStartTime || 0)}
            onChange={(e) => {
              const sec = parseInput(e.target.value, mode, fps)
              onUpdate({ mediaStartTime: sec ?? 0 })
            }}
            placeholder="0"
          />
          <span className="media-tl-unit">{mode === 'frames' ? 'fr' : 's'}</span>
        </label>
      )}

      {/* ── Pause point ── */}
      {hasTime && (
        <>
          <div className="behavior-title" style={{ marginTop: 6 }}>⏸ Pause Point</div>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={el.mediaPauseTime != null}
              onChange={(e) => onUpdate({ mediaPauseTime: e.target.checked ? 5 : null })}
            />
            Enable pause at time
          </label>
          {el.mediaPauseTime != null && (
            <>
              <label>
                Pause at {mode === 'frames' ? '(frame)' : '(seconds)'}
                <input
                  type="number"
                  min={0}
                  step={mode === 'frames' ? 1 : 0.1}
                  value={mode === 'frames'
                    ? Math.round(el.mediaPauseTime * fps)
                    : el.mediaPauseTime}
                  onChange={(e) => {
                    const sec = parseInput(e.target.value, mode, fps)
                    if (sec != null) onUpdate({ mediaPauseTime: sec })
                  }}
                />
                <span className="media-tl-unit">{mode === 'frames' ? 'fr' : 's'}</span>
              </label>
              <label>
                Then…
                <select
                  value={el.mediaPauseAction || 'none'}
                  onChange={(e) => onUpdate({ mediaPauseAction: e.target.value })}
                >
                  {PAUSE_ACTIONS.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </label>
              {el.mediaPauseAction === 'goto-page' && (
                <label>
                  Target page
                  <select
                    value={el.mediaPauseTarget || ''}
                    onChange={(e) => onUpdate({ mediaPauseTarget: e.target.value })}
                  >
                    <option value="">— choose page —</option>
                    {pages.map((pg, i) => (
                      <option key={pg.id} value={pg.name}>{i + 1}. {pg.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {el.mediaPauseAction === 'goto-element' && (
                <label>
                  Target element label
                  <input
                    value={el.mediaPauseTarget || ''}
                    onChange={(e) => onUpdate({ mediaPauseTarget: e.target.value })}
                    placeholder="Element label name…"
                  />
                </label>
              )}
              {el.mediaPauseAction === 'hyperlink' && (
                <label>
                  URL
                  <input
                    type="url"
                    value={el.mediaPauseTarget || ''}
                    onChange={(e) => onUpdate({ mediaPauseTarget: e.target.value })}
                    placeholder="https://…"
                  />
                </label>
              )}
              {el.mediaPauseAction === 'script' && (
                <label>
                  Script
                  <textarea
                    rows={3}
                    value={el.mediaPauseScript || ''}
                    onChange={(e) => onUpdate({ mediaPauseScript: e.target.value })}
                    placeholder="// JS to run at pause point…"
                    style={{ fontFamily: 'monospace', fontSize: 10 }}
                  />
                </label>
              )}
            </>
          )}
        </>
      )}

      {/* ── End / Stop time ── */}
      {hasTime && (
        <>
          <div className="behavior-title" style={{ marginTop: 6 }}>⏹ Stop / End Frame</div>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={el.mediaEndTime != null}
              onChange={(e) => onUpdate({ mediaEndTime: e.target.checked ? 10 : null })}
            />
            Stop early at time
          </label>
          {el.mediaEndTime != null && (
            <label>
              Stop at {mode === 'frames' ? '(frame)' : '(seconds)'}
              <input
                type="number"
                min={0}
                step={mode === 'frames' ? 1 : 0.1}
                value={mode === 'frames'
                  ? Math.round(el.mediaEndTime * fps)
                  : el.mediaEndTime}
                onChange={(e) => {
                  const sec = parseInput(e.target.value, mode, fps)
                  if (sec != null) onUpdate({ mediaEndTime: sec })
                }}
              />
              <span className="media-tl-unit">{mode === 'frames' ? 'fr' : 's'}</span>
            </label>
          )}
        </>
      )}

      {/* ── In Transition ── */}
      <div className="behavior-title" style={{ marginTop: 6 }}>▶ In Event / Transition</div>
      <label>
        Transition type
        <select
          value={el.mediaInTransition || 'none'}
          onChange={(e) => onUpdate({ mediaInTransition: e.target.value })}
        >
          {WIPE_OPTIONS.map(w => (
            <option key={w.key} value={w.key}>{w.label}</option>
          ))}
        </select>
      </label>
      {(el.mediaInTransition && el.mediaInTransition !== 'none' && el.mediaInTransition !== 'cut') && (
        <label>
          Duration (ms)
          <input
            type="number"
            min={100} max={5000} step={100}
            value={el.mediaInDuration ?? 500}
            onChange={(e) => onUpdate({ mediaInDuration: Math.max(100, Number(e.target.value)) })}
          />
        </label>
      )}

      {/* ── Out Transition ── */}
      <div className="behavior-title" style={{ marginTop: 6 }}>◀ Out Event / Transition</div>
      <label>
        Transition type
        <select
          value={el.mediaOutTransition || 'none'}
          onChange={(e) => onUpdate({ mediaOutTransition: e.target.value })}
        >
          {WIPE_OUT_OPTIONS.map(w => (
            <option key={w.key} value={w.key}>{w.label}</option>
          ))}
        </select>
      </label>
      {(el.mediaOutTransition && el.mediaOutTransition !== 'none' && el.mediaOutTransition !== 'cut') && (
        <label>
          Duration (ms)
          <input
            type="number"
            min={100} max={5000} step={100}
            value={el.mediaOutDuration ?? 500}
            onChange={(e) => onUpdate({ mediaOutDuration: Math.max(100, Number(e.target.value)) })}
          />
        </label>
      )}

      <p className="muted" style={{ fontSize: 9, marginTop: 6, lineHeight: 1.5 }}>
        💡 Start/Pause/Stop times are applied in Presentation mode. In-transition plays when the element enters; Out-transition plays before it exits.
      </p>

      {/* ── Audio Controls ── */}
      {(isVideo || isAudio) && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--be-border)' }}>
          <div className="behavior-title" style={{ marginBottom: 6 }}>🔊 Audio Controls</div>

          {/* Volume slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: '#aaa', minWidth: 48 }}>Volume</span>
            <input
              type="range" min={0} max={100} step={1}
              value={Math.round((el.mediaVolume != null ? el.mediaVolume : 1.0) * 100)}
              onChange={(e) => onUpdate({ mediaVolume: Number(e.target.value) / 100 })}
              style={{ flex: 1 }}
              title="Playback volume"
            />
            <span style={{ fontSize: 10, color: '#ccc', minWidth: 30, textAlign: 'right' }}>
              {Math.round((el.mediaVolume != null ? el.mediaVolume : 1.0) * 100)}%
            </span>
          </div>

          {/* Mute toggle */}
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <input
              type="checkbox"
              checked={!!el.mediaMuted}
              onChange={(e) => onUpdate({ mediaMuted: e.target.checked })}
            />
            🔇 Mute (silence audio in Presentation)
          </label>

          {/* Replace Audio — video only */}
          {isVideo && (
            <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--be-border)' }}>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={!!el.replaceAudio}
                  onChange={(e) => onUpdate({ replaceAudio: e.target.checked, replacedAudioFile: e.target.checked ? (el.replacedAudioFile || null) : null })}
                />
                🎵 Replace video audio track
              </label>

              {el.replaceAudio && (
                <div style={{ paddingLeft: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <button
                      className="be-btn"
                      style={{ fontSize: 10, flex: 1 }}
                      onClick={async () => {
                        if (window.smmDesktop?.selectMedia) {
                          const r = await window.smmDesktop.selectMedia({ category: 'audio' }).catch(() => null)
                          if (r?.filePath) {
                            const audioUrl = window.smmDesktop?.mediaServerPort
                              ? `http://127.0.0.1:${window.smmDesktop.mediaServerPort}/media?p=${encodeURIComponent(r.filePath)}`
                              : r.filePath
                            onUpdate({ replacedAudioFile: audioUrl, replacedAudioName: r.fileName || r.filePath.split(/[\\/]/).pop() })
                          }
                        }
                      }}
                    >
                      📂 {el.replacedAudioName ? 'Change…' : 'Pick audio file…'}
                    </button>
                    {el.replacedAudioFile && (
                      <button
                        className="be-btn"
                        style={{ fontSize: 10, color: '#ff8080' }}
                        title="Remove replaced audio"
                        onClick={() => onUpdate({ replacedAudioFile: null, replacedAudioName: null })}
                      >✕</button>
                    )}
                  </div>
                  {el.replacedAudioName && (
                    <p className="muted" style={{ fontSize: 9, marginBottom: 4 }}>
                      🎵 {el.replacedAudioName}
                    </p>
                  )}
                  {/* Replaced audio volume */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#aaa', minWidth: 48 }}>Audio Vol</span>
                    <input
                      type="range" min={0} max={100} step={1}
                      value={Math.round((el.replacedAudioVolume != null ? el.replacedAudioVolume : 1.0) * 100)}
                      onChange={(e) => onUpdate({ replacedAudioVolume: Number(e.target.value) / 100 })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 10, color: '#ccc', minWidth: 30, textAlign: 'right' }}>
                      {Math.round((el.replacedAudioVolume != null ? el.replacedAudioVolume : 1.0) * 100)}%
                    </span>
                  </div>
                  <p className="muted" style={{ fontSize: 9, marginTop: 4 }}>
                    💡 Original video audio is silenced. This audio plays instead.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// PrintDialog — print presentation with page range options
// ──────────────────────────────────────────────────────────────
function PrintDialog({ pages, currentPage, stageWidth, stageHeight, renderPage, onClose }) {
  const [mode, setMode] = useState('all')        // 'all'|'current'|'range'
  const [fromPage, setFromPage] = useState(1)
  const [toPage, setToPage] = useState(pages.length)
  const [includeNotes, setIncludeNotes] = useState(false)
  const [orientation, setOrientation] = useState('landscape')
  const [pagesPerSheet, setPagesPerSheet] = useState(1)

  const [rendering, setRendering] = useState(false)

  async function doPrint() {
    let start = 0, end = pages.length - 1
    if (mode === 'current') { start = currentPage; end = currentPage }
    if (mode === 'range') { start = Math.max(0, fromPage - 1); end = Math.min(pages.length - 1, toPage - 1) }
    const printPages = pages.slice(start, end + 1)
    const stageW = stageWidth || 1280
    const stageH = stageHeight || 720

    setRendering(true)
    // Render every page to a canvas PNG snapshot
    const dataUrls = []
    for (const pg of printPages) {
      dataUrls.push(await renderPage(pg))
    }
    setRendering(false)

    const printWin = window.open('', '_blank', 'width=1200,height=800')
    if (!printWin) { alert('Please allow popups to print.'); return }

    // Scale to fit A4/letter width in preview while keeping aspect ratio
    const pagesPerRow = pagesPerSheet === 1 ? 1 : pagesPerSheet === 2 ? 2 : 3
    const previewW = Math.round(800 / pagesPerRow)
    const previewH = Math.round(previewW * stageH / stageW)

    const imgs = dataUrls.map((url, i) => {
      const pageNum = start + i + 1
      const notesHtml = includeNotes && printPages[i]?.notes
        ? `<div style="font:9px sans-serif;color:#555;padding:2px 4px;text-align:left">${printPages[i].notes}</div>` : ''
      return `<div style="display:inline-block;margin:6px;page-break-inside:avoid;vertical-align:top">
        <img src="${url}" style="display:block;width:${previewW}px;height:${previewH}px" />
        <div style="font:9px sans-serif;text-align:right;color:#888;padding:1px 4px">Page ${pageNum}</div>
        ${notesHtml}
      </div>${pagesPerSheet === 1 ? '<div style="page-break-after:always"></div>' : ''}`
    }).join('')

    printWin.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Print — Presentation</title>
    <style>
      @page { size: ${orientation}; margin: 10mm }
      body { margin: 0; background: #fff; font-family: sans-serif }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact } .no-print { display: none } }
    </style></head><body>
    <div class="no-print" style="padding:12px;background:#f5f5f5;border-bottom:1px solid #ddd;display:flex;gap:12px;align-items:center">
      <strong>Print Preview</strong>
      <span>Pages ${start + 1}–${end + 1} of ${pages.length}</span>
      <button onclick="window.print()" style="padding:6px 16px;background:#1a5276;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px">🖨 Print</button>
      <button onclick="window.close()" style="padding:6px 12px;border:1px solid #ccc;border-radius:4px;cursor:pointer">Close</button>
    </div>
    <div style="padding:12px;display:flex;flex-wrap:wrap;gap:4px;justify-content:center">${imgs}</div>
    </body></html>`)
    printWin.document.close()
    onClose()
  }

  return (
    <div className="iae-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="print-dlg">
        <div className="iae-header">
          <span className="iae-title">🖨 Print Presentation</span>
          <button className="iae-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Page range */}
          <div>
            <div className="print-section-label">Page Range</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {[
                { v: 'all', label: `All pages (1–${pages.length})` },
                { v: 'current', label: `Current page (${currentPage + 1})` },
                { v: 'range', label: 'Page range:' },
              ].map(opt => (
                <label key={opt.v} className="print-radio-row">
                  <input type="radio" name="pgmode" value={opt.v} checked={mode === opt.v} onChange={() => setMode(opt.v)} />
                  <span>{opt.label}</span>
                  {opt.v === 'range' && mode === 'range' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                      <span style={{ fontSize: 11 }}>From</span>
                      <input type="number" min={1} max={pages.length} value={fromPage}
                        onChange={(e) => setFromPage(Number(e.target.value))} style={{ width: 50 }} />
                      <span style={{ fontSize: 11 }}>To</span>
                      <input type="number" min={1} max={pages.length} value={toPage}
                        onChange={(e) => setToPage(Number(e.target.value))} style={{ width: 50 }} />
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div>
            <div className="print-section-label">Layout</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span>Orientation</span>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value)} style={{ fontSize: 11 }}>
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span>Pages per sheet</span>
                <select value={pagesPerSheet} onChange={(e) => setPagesPerSheet(Number(e.target.value))} style={{ fontSize: 11 }}>
                  <option value={1}>1 (full size)</option>
                  <option value={2}>2 per sheet</option>
                  <option value={4}>4 per sheet</option>
                  <option value={6}>6 per sheet</option>
                </select>
              </label>
            </div>
          </div>

          {/* Options */}
          <div>
            <div className="print-section-label">Options</div>
            <label className="print-radio-row" style={{ marginTop: 6 }}>
              <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
              <span style={{ fontSize: 11 }}>Include page notes / annotations</span>
            </label>
          </div>

          <p style={{ fontSize: 10, color: 'var(--t3)', margin: 0 }}>
            💡 A print preview window will open. Use your system's printer dialog to select your printer, print to PDF, or adjust paper settings. The browser will auto-detect available printers.
          </p>
        </div>

        <div className="iae-footer">
          <button onClick={onClose} style={{ fontSize: 11, padding: '4px 14px', background: 'var(--bg4)', border: '1px solid var(--bg5)', color: 'var(--t1)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
          <button className="iae-done" onClick={() => void doPrint()} disabled={rendering}>
            {rendering ? '⏳ Rendering…' : '🖨 Open Print Preview'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// PageScriptEditor — FluxAura Studio JS Script Runner + Data Source
// ──────────────────────────────────────────────────────────────
function PageScriptEditor({ page, projectVars, onChange, onClose }) {
  const defaultScript = page.pageScript || { enabled: false, mode: 'inline', code: '', file: '', fileName: '', sharedVars: [], waitForScript: false }
  const defaultDS = page.dataSource || { enabled: false, file: '', fileName: '', type: 'json', rootPath: '', mappings: [] }

  const [script, setScript] = useState({ ...defaultScript, sharedVars: [...(defaultScript.sharedVars || [])] })
  const [ds, setDs] = useState({ ...defaultDS, mappings: [...(defaultDS.mappings || [])] })
  const [selAvail, setSelAvail] = useState('')
  const [selShared, setSelShared] = useState('')
  const fileInputRef = useRef(null)
  const dsFileInputRef = useRef(null)

  const availableVars = (projectVars || []).map(v => v.name)
  const sharedNames = script.sharedVars.map(sv => sv.varName)

  function updScript(patch) { setScript(prev => ({ ...prev, ...patch })) }
  function updDs(patch) { setDs(prev => ({ ...prev, ...patch })) }

  function moveToShared() {
    if (!selAvail || sharedNames.includes(selAvail)) return
    updScript({ sharedVars: [...script.sharedVars, { varName: selAvail, alias: selAvail }] })
    setSelShared(selAvail)
    setSelAvail('')
  }

  function removeFromShared() {
    if (!selShared) return
    updScript({ sharedVars: script.sharedVars.filter(sv => sv.varName !== selShared) })
    setSelShared('')
  }

  function updateAlias(alias) {
    updScript({ sharedVars: script.sharedVars.map(sv => sv.varName === selShared ? { ...sv, alias } : sv) })
  }

  const selectedSharedItem = script.sharedVars.find(sv => sv.varName === selShared)

  async function browseScriptFile() {
    if (window.smmDesktop?.selectMedia) {
      const r = await window.smmDesktop.selectMedia({ category: 'all' }).catch(() => null)
      if (r?.filePath) updScript({ file: r.filePath, fileName: r.fileName || r.filePath.split(/[\\/]/).pop(), mode: 'file' })
    } else if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  async function browseDsFile() {
    if (window.smmDesktop?.selectMedia) {
      const r = await window.smmDesktop.selectMedia({ category: 'all' }).catch(() => null)
      if (r?.filePath) {
        const ext = (r.fileName || r.filePath).split('.').pop().toLowerCase()
        const type = ['json', 'xml', 'csv'].includes(ext) ? ext : 'json'
        updDs({ file: r.filePath, fileName: r.fileName || r.filePath.split(/[\\/]/).pop(), type })
      }
    } else if (dsFileInputRef.current) {
      dsFileInputRef.current.click()
    }
  }

  function handleScriptFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    updScript({ fileName: f.name, file: f.name, mode: 'file' })
    e.target.value = ''
  }

  function handleDsFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    updDs({ fileName: f.name, file: f.name, type: ['json', 'xml', 'csv'].includes(ext) ? ext : 'json' })
    e.target.value = ''
  }

  function addMapping() {
    updDs({ mappings: [...ds.mappings, { field: '', varName: '' }] })
  }

  function updateMapping(i, patch) {
    const m = [...ds.mappings]
    m[i] = { ...m[i], ...patch }
    updDs({ mappings: m })
  }

  function removeMapping(i) {
    const m = [...ds.mappings]
    m.splice(i, 1)
    updDs({ mappings: m })
  }

  function handleSave() {
    onChange({ pageScript: script, dataSource: ds })
    onClose()
  }

  return (
    <div className="pse-overlay">
      <div className="pse-modal">
        <div className="iae-header">
          <span className="iae-title">🖥 Page Script Editor</span>
          <button className="iae-close" onClick={onClose}>✕</button>
        </div>

        <div className="pse-body">
          {/* Enable + Wait */}
          <div className="pse-enable-row">
            <label className="iae-enable-label">
              <input type="checkbox" checked={!!script.enabled} onChange={e => updScript({ enabled: e.target.checked })} />
              Enable Page Script
            </label>
            <label className="iae-enable-label" style={{ marginLeft: 20 }}>
              <input type="checkbox" checked={!!script.waitForScript} onChange={e => updScript({ waitForScript: e.target.checked })} />
              Wait? (pause page until script completes)
            </label>
          </div>

          {/* Script source */}
          <div className="pse-section">
            <div className="iae-section-title">Script Source</div>
            <div className="pse-mode-row">
              <label className="iae-enable-label">
                <input type="radio" name="pse-mode" checked={script.mode === 'inline'} onChange={() => updScript({ mode: 'inline' })} />
                Inline JS
              </label>
              <label className="iae-enable-label" style={{ marginLeft: 12 }}>
                <input type="radio" name="pse-mode" checked={script.mode === 'file'} onChange={() => updScript({ mode: 'file' })} />
                External File
              </label>
            </div>

            {script.mode === 'file' && (
              <div className="pse-file-row">
                <input type="text" className="pse-file-inp" value={script.fileName || script.file || ''} readOnly placeholder="No file selected…" />
                <button className="pse-browse-btn" onClick={browseScriptFile}>Browse</button>
                {script.file && <button className="pse-browse-btn" onClick={() => updScript({ file: '', fileName: '' })}>Clear</button>}
                <input ref={fileInputRef} type="file" accept=".js" style={{ display: 'none' }} onChange={handleScriptFileChange} />
              </div>
            )}

            {script.mode === 'inline' && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>
                  Access shared vars as: <code style={{ color: 'var(--mme-teal)' }}>vars.myVar</code>. Changes write back automatically.
                </div>
                <textarea
                  className="pse-code-area"
                  rows={8}
                  value={script.code || ''}
                  onChange={e => updScript({ code: e.target.value })}
                  placeholder={'// Example:\n// vars.time1 = new Date().getHours() + \':00\';\n// vars.greeting = vars.score > 50 ? \'Great!\' : \'Try again\';'}
                  spellCheck={false}
                />
              </div>
            )}
          </div>

          {/* Variable bridge */}
          <div className="pse-section">
            <div className="iae-section-title">Variable Bridge</div>
            <div className="pse-panels">
              <div className="pse-panel">
                <div className="pse-panel-hdr">Available Variables</div>
                <div className="pse-var-list">
                  {availableVars.length === 0 && <div className="iae-empty">No project variables</div>}
                  {availableVars.map(vn => (
                    <div
                      key={vn}
                      className={`pse-var-item${selAvail === vn ? ' on' : ''}${sharedNames.includes(vn) ? ' shared' : ''}`}
                      onClick={() => setSelAvail(vn)}
                    >{vn}{sharedNames.includes(vn) ? ' ✓' : ''}</div>
                  ))}
                </div>
              </div>

              <div className="pse-transfer-btns">
                <button className="pse-xfer-btn" title="Add to shared" onClick={moveToShared} disabled={!selAvail || sharedNames.includes(selAvail)}>&gt;&gt;</button>
                <button className="pse-xfer-btn" title="Remove from shared" onClick={removeFromShared} disabled={!selShared}>&lt;&lt;</button>
              </div>

              <div className="pse-panel">
                <div className="pse-panel-hdr">Shared with Script</div>
                <div className="pse-var-list">
                  {script.sharedVars.length === 0 && <div className="iae-empty">No shared variables</div>}
                  {script.sharedVars.map(sv => (
                    <div
                      key={sv.varName}
                      className={`pse-var-item${selShared === sv.varName ? ' on' : ''}`}
                      onClick={() => setSelShared(sv.varName)}
                    >
                      <span style={{ color: 'var(--mme-teal)' }}>{sv.alias || sv.varName}</span>
                      {sv.alias && sv.alias !== sv.varName && (
                        <span style={{ color: 'var(--t3)', fontSize: 9 }}> ({sv.varName})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedSharedItem && (
              <div className="pse-alias-row">
                <span style={{ fontSize: 11, color: 'var(--t2)' }}>Alias in script:</span>
                <input
                  className="pse-alias-inp"
                  value={selectedSharedItem.alias || ''}
                  onChange={e => updateAlias(e.target.value)}
                  placeholder={selectedSharedItem.varName}
                />
              </div>
            )}
          </div>

          {/* Data Source */}
          <div className="pse-ds-section">
            <div className="pse-ds-header">
              <span className="iae-section-title" style={{ margin: 0 }}>Data Source</span>
              <label className="iae-enable-label" style={{ marginLeft: 12 }}>
                <input type="checkbox" checked={!!ds.enabled} onChange={e => updDs({ enabled: e.target.checked })} />
                Enable data source
              </label>
            </div>

            {ds.enabled && (
              <>
                <div className="pse-file-row">
                  <input type="text" className="pse-file-inp" value={ds.fileName || ds.file || ''} readOnly placeholder="No file selected…" />
                  <button className="pse-browse-btn" onClick={browseDsFile}>Browse</button>
                  <input ref={dsFileInputRef} type="file" accept=".json,.xml,.csv" style={{ display: 'none' }} onChange={handleDsFileChange} />
                </div>

                <div className="pse-ds-row">
                  <label style={{ fontSize: 11, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Format:
                    <select className="pse-sel" value={ds.type || 'json'} onChange={e => updDs({ type: e.target.value })}>
                      <option value="json">JSON</option>
                      <option value="xml">XML</option>
                      <option value="csv">CSV</option>
                    </select>
                  </label>
                  {(ds.type === 'json' || !ds.type) && (
                    <label style={{ fontSize: 11, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12 }}>
                      Root path:
                      <input
                        className="pse-root-inp"
                        value={ds.rootPath || ''}
                        onChange={e => updDs({ rootPath: e.target.value })}
                        placeholder="e.g. data.items"
                      />
                    </label>
                  )}
                </div>

                <div className="pse-mappings">
                  <div className="pse-map-header">
                    <span style={{ fontSize: 10, color: 'var(--t2)', flex: 1 }}>Source field</span>
                    <span style={{ fontSize: 10, color: 'var(--t2)', flex: 1 }}>→ Variable</span>
                    <span style={{ width: 50 }}></span>
                  </div>
                  {ds.mappings.map((m, i) => (
                    <div key={i} className="pse-map-row">
                      <input
                        className="pse-map-inp"
                        value={m.field || ''}
                        onChange={e => updateMapping(i, { field: e.target.value })}
                        placeholder="field name"
                      />
                      <span style={{ color: 'var(--mme-teal)', margin: '0 4px' }}>→</span>
                      <select
                        className="pse-sel pse-map-sel"
                        value={m.varName || ''}
                        onChange={e => updateMapping(i, { varName: e.target.value })}
                      >
                        <option value="">(choose variable)</option>
                        {availableVars.map(vn => <option key={vn} value={vn}>{vn}</option>)}
                      </select>
                      <button className="pse-rm-btn" onClick={() => removeMapping(i)}>✕</button>
                    </div>
                  ))}
                  <button className="pse-add-mapping" onClick={addMapping}>+ Add mapping</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="iae-footer">
          <button
            style={{ fontSize: 11, padding: '4px 14px', background: 'var(--bg4)', border: '1px solid var(--bg5)', color: 'var(--t1)', borderRadius: 4, cursor: 'pointer' }}
            onClick={onClose}
          >✕ Close</button>
          <button className="iae-done" onClick={handleSave}>💾 Save</button>
        </div>
      </div>
    </div>
  )
}

export default App
