// @ts-check
// Extracted from App.jsx — MME script serialisation and parsing
import { SW, SH } from '../constants/index.js'
import { externUrl } from './mediaRegistry.js'
import { makePage, makeElem, getPresetKey } from './stageUtils.js'
import { detectMediaKind, isUnresolvedMediaPath, isTempUrl, inferMediaCapability, getMediaExtension } from './mediaUtils.js'
import { getRecentColors, getSavedColors, getSavedPalettes, setRecentColors, setSavedColors, setSavedPalettes } from './colorUtils.js'

/**
 * Parse SCA script text into pages and stage dimensions.
 * @param {string} text - Raw SCA file content
 * @returns {{ pages: import('../types/desktop-api').SmmPage[], stage: import('../types/desktop-api').SmmStage | null, presentationAudio: object|null, projectVars: unknown[]|null }}
 */
export function parseMME(text) {
  const pages = []
  const lines = text.split('\n')
  let page = null
  let stageWidth = SW
  let stageHeight = SH
  const result = { pages, stage: null, presentationAudio: null, projectVars: null }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Handle smm metadata comments — these patch the last element or the page itself
    if (line.startsWith('// mme:')) {
      // mme:presaudio — project-level persistent audio track
      const smmPresAudio = line.match(/^\/\/ mme:presaudio (.+)$/)
      if (smmPresAudio) {
        try { result.presentationAudio = JSON.parse(smmPresAudio[1]) } catch { /* noop */ }
        continue
      }
      // mme:projectvars — project-level variables array
      const smmProjVars = line.match(/^\/\/ mme:projectvars (.+)$/)
      if (smmProjVars) {
        try { result.projectVars = JSON.parse(smmProjVars[1]) } catch { /* noop */ }
        continue
      }
      // mme:colors — project-level color palette snapshot; restore to localStorage
      const smmColors = line.match(/^\/\/ mme:colors (.+)$/)
      if (smmColors) {
        try {
          const col = JSON.parse(smmColors[1])
          if (Array.isArray(col.recent) && col.recent.length) setRecentColors(col.recent)
          if (Array.isArray(col.saved) && col.saved.length) setSavedColors(col.saved)
          if (Array.isArray(col.palettes) && col.palettes.length) setSavedPalettes(col.palettes)
        } catch { /* noop */ }
        continue
      }
      // mme:page applies to the page object (no element needed)
      const smmPage = line.match(/^\/\/ mme:page (.+)$/)
      if (smmPage && page) {
        try { Object.assign(page.timing, JSON.parse(smmPage[1])) } catch { /* noop */ }
        continue
      }
      // mme:pgext applies page-level extra properties (wipeOut, bgColor, bgGradient, sound, etc.)
      const smmPgext = line.match(/^\/\/ mme:pgext (.+)$/)
      if (smmPgext && page) {
        try {
          const ext = JSON.parse(smmPgext[1])
          if (ext.sound) { page.sound = { ...page.sound, ...ext.sound }; delete ext.sound }
          // Unpack bgMedia object into flat fields (avoids nested object on page)
          if (ext.bgMedia) {
            page.bgMediaName       = ext.bgMedia.name       || ''
            page.bgMediaKind       = ext.bgMedia.kind       || 'image'
            page.bgMediaTransition = ext.bgMedia.transition || 'fade'
            if (ext.bgMedia.src?.startsWith('data:')) {
              // Embedded data URL (e.g. PDF-imported page) — use directly
              page.bgMediaSrc        = ext.bgMedia.src
              page.bgMediaSourcePath = ''
            } else {
              page.bgMediaSourcePath = ext.bgMedia.src || ''
              page.bgMediaSrc        = '' // will be re-resolved in applyParsedScript
            }
            delete ext.bgMedia
          }
          Object.assign(page, ext)
        } catch { /* noop */ }
        continue
      }
      // mme:script — page-level visual script blocks (onStartScript / onEndScript)
      const smmScript = line.match(/^\/\/ mme:script (.+)$/)
      if (smmScript && page) {
        try {
          const s = JSON.parse(smmScript[1])
          if (Array.isArray(s.onStartScript)) page.onStartScript = s.onStartScript
          if (Array.isArray(s.onEndScript)) page.onEndScript = s.onEndScript
        } catch { /* noop */ }
        continue
      }
      // mme:hotspot — standalone self-contained hotspot element (no preceding command line needed)
      const smmHotspot = line.match(/^\/\/ mme:hotspot (.+)$/)
      if (smmHotspot && page) {
        try {
          const meta = JSON.parse(smmHotspot[1])
          const el = makeElem('hotspot', meta.x || 0, meta.y || 0, meta.w || 160, meta.h || 120)
          Object.assign(el, meta)
          el.z = meta.z ?? page.elements.length
          page.elements.push(el)
        } catch { /* noop */ }
        continue
      }
      // mme:menubar — standalone self-contained menubar element
      const smmMenubar = line.match(/^\/\/ mme:menubar (.+)$/)
      if (smmMenubar && page) {
        try {
          const meta = JSON.parse(smmMenubar[1])
          const el = makeElem('menubar', 0, 0, meta.w || stageWidth, meta.h || 60)
          Object.assign(el, meta)
          el.z = meta.z ?? page.elements.length
          if (meta.style) el.style = meta.style
          if (meta.items) el.items = meta.items
          page.elements.push(el)
        } catch { /* noop */ }
        continue
      }
      if (!page || !page.elements.length) continue
      const last = page.elements[page.elements.length - 1]
      const smmTxt = line.match(/^\/\/ mme:txt (.+)$/)
      if (smmTxt && last.type === 'text') {
        try { Object.assign(last, JSON.parse(smmTxt[1])) } catch { /* noop */ }
        continue
      }
      const smmBtn = line.match(/^\/\/ mme:btn (.+)$/)
      if (smmBtn && last.type === 'button') {
        try {
          const meta = JSON.parse(smmBtn[1])
          // Restore image source paths — will be resolved by the media resolver
          if (!meta.btnImage && meta.btnImageSourcePath) meta.btnImage = meta.btnImageSourcePath
          if (!meta.hoverBtnImage && meta.hoverBtnImageSrc) meta.hoverBtnImage = meta.hoverBtnImageSrc
          if (!meta.pressedBtnImage && meta.pressedBtnImageSrc) meta.pressedBtnImage = meta.pressedBtnImageSrc
          Object.assign(last, meta)
        } catch { /* noop */ }
        continue
      }
      const smmClip = line.match(/^\/\/ mme:clip (.+)$/)
      if (smmClip && last.type === 'clip') {
        try {
          const meta = JSON.parse(smmClip[1])
          // Restore embedded data URL as the element's file
          if (meta.dataUrl) {
            last.file = meta.dataUrl
            delete meta.dataUrl
          }
          // Don't let empty-string media fields overwrite correctly-inferred non-empty values
          ;['mediaExt', 'mediaSupport', 'mediaReason', 'mediaOutputHint'].forEach((k) => {
            if (meta[k] === '' || meta[k] == null) delete meta[k]
          })
          Object.assign(last, meta)
          // Re-infer capability from mediaName to correct stale 'unknown' values from old saves
          if (last.mediaName) {
            const fresh = inferMediaCapability(last.mediaName, last.mediaKind || 'image')
            if (fresh.support && fresh.support !== 'unknown') {
              last.mediaExt = fresh.extension || last.mediaExt
              last.mediaSupport = fresh.support
              last.mediaReason = fresh.reason || ''
            }
          }
        } catch { /* noop */ }
        continue
      }
      const smmMpeg = line.match(/^\/\/ mme:mpeg (.+)$/)
      if (smmMpeg && last.type === 'mpeg') {
        try {
          const meta = JSON.parse(smmMpeg[1])
          if (meta.dataUrl) {
            last.file = meta.dataUrl
            delete meta.dataUrl
          }
          ;['mediaExt', 'mediaSupport', 'mediaReason', 'mediaOutputHint'].forEach((k) => {
            if (meta[k] === '' || meta[k] == null) delete meta[k]
          })
          Object.assign(last, meta)
          // Re-infer capability from mediaName to correct stale 'unknown' values from old saves
          if (last.mediaName) {
            const fresh = inferMediaCapability(last.mediaName, last.mediaKind || 'video')
            if (fresh.support && fresh.support !== 'unknown') {
              last.mediaExt = fresh.extension || last.mediaExt
              last.mediaSupport = fresh.support
              last.mediaReason = fresh.reason || ''
            }
          }
        } catch { /* noop */ }
        continue
      }
      continue
    }

    // Skip all other comments, but first check for stage size comment
    if (line.startsWith('//')) {
      const stageComment = line.match(/^\/\/\s*Stage\s+(\d+)x(\d+)/i)
      if (stageComment) {
        stageWidth = Number(stageComment[1])
        stageHeight = Number(stageComment[2])
      }
      continue
    }

    const labelMatch = line.match(/^:"([^"]+)"$/)
    if (labelMatch) {
      if (page) pages.push(page)
      page = makePage(labelMatch[1], pages.length)
      continue
    }

    if (!page) continue

    const displaySize = line.match(/Display\(Face\(Pen\(1\)\),\s*Size\((\d+),\s*(\d+)\)\)/i)
    if (displaySize) {
      stageWidth = Number(displaySize[1])
      stageHeight = Number(displaySize[2])
      continue
    }

    const pic = line.match(/^Picture\("([^"]+)"(?:,\s*Wipe\("([^"]+)"(?:,\s*Speed\((\d+)\))?)?/i)
    if (pic) {
      page.bgImage = pic[1]
      // If the path looks like a native filesystem path, also store as bgMediaSourcePath for resolution
      if (pic[1] && isUnresolvedMediaPath(pic[1])) {
        page.bgMediaSourcePath = page.bgMediaSourcePath || pic[1]
        page.bgMediaName = page.bgMediaName || pic[1].split(/[/\\]/).pop() || pic[1]
        page.bgMediaKind = page.bgMediaKind || 'image'
        page.bgMediaSrc = '' // will be re-resolved
      }
      if (pic[2]) page.wipeIn = pic[2]
      continue
    }

    const pause = line.match(/^Pause\(([0-9.]+)\)/i)
    if (pause) {
      page.timing.mode = 'pause'
      page.timing.duration = Number(pause[1])
      continue
    }

    if (/^Wait\(\)/i.test(line)) {
      page.timing.mode = 'wait'
      continue
    }

    const textMatch = line.match(/^Text\((-?\d+),\s*(-?\d+),\s*"((?:[^"\\]|\\.)*)"/i)
    if (textMatch) {
      const el = makeElem('text', Number(textMatch[1]), Number(textMatch[2]), 300, 60)
      el.content = textMatch[3].replaceAll('\\"', '"').replaceAll('\\n', '\n').replaceAll('\\r', '\r').replaceAll('\\\\', '\\')
      const font = line.match(/Font\("([^"]+)",\s*(\d+)\)/i)
      if (font) {
        el.font = font[1]
        el.size = Number(font[2])
        el.h = Math.max(40, el.size + 10)
      }
      if (/Shadow\(On\)/i.test(line)) el.shadow = true
      if (/Outline\(On\)/i.test(line)) el.outline = true
      if (/Italic\(On\)/i.test(line)) el.italic = true
      const align = line.match(/Align\((\w+),/i)
      if (align) el.align = align[1].toLowerCase()
      const wipe = line.match(/Wipe\("([^"]+)"(?:,\s*Speed\((\d+)\))?/i)
      if (wipe) {
        el.wipe = wipe[1]
        el.wipeSpeed = wipe[2] ? Number(wipe[2]) : 5
      }
      el.z = page.elements.length
      page.elements.push(el)
      continue
    }

    const clipMatch = line.match(/^Clip\((-?\d+),\s*(-?\d+),\s*"([^"]+)"/i)
    if (clipMatch) {
      const el = makeElem('clip', Number(clipMatch[1]), Number(clipMatch[2]), 200, 150)
      const rawFile = clipMatch[3]
      el.file = rawFile
      // Determine if the stored path is a real native path (contains a directory separator or drive letter)
      const isNativePath = rawFile && !rawFile.startsWith('data:') && (rawFile.includes('/') || rawFile.includes('\\') || /^[a-zA-Z]:/.test(rawFile))
      const isPlaceholder = rawFile === 'image.bmp' || rawFile === 'image.png' || rawFile === 'audio.mp3' || rawFile === 'video.avi' || rawFile === 'video.mp4'
      const clipCap = inferMediaCapability(rawFile, detectMediaKind(rawFile))
      el.mediaName = rawFile.split(/[/\\]/).pop() || ''
      el.mediaExt = clipCap.extension || getMediaExtension(rawFile)
      el.mediaKind = clipCap.category || 'image'
      el.mediaSupport = clipCap.support || 'unknown'
      el.mediaReason = clipCap.reason || ''
      el.mediaOutputHint = clipCap.outputHint || ''
      // Store as native source path if it looks like a real path (mme:clip may override this)
      if (isNativePath && !isPlaceholder) {
        el.mediaSourcePath = rawFile
      }
      const resize = line.match(/Resize\((\d+),\s*(\d+)\)/i)
      if (resize) {
        el.w = Number(resize[1])
        el.h = Number(resize[2])
      }
      el.transparent = /Transparent\(On\)|TransparentRGB/i.test(line)
      const wipe = line.match(/Wipe\("([^"]+)"(?:,\s*Speed\((\d+)\))?/i)
      if (wipe) {
        el.wipe = wipe[1]
        el.wipeSpeed = wipe[2] ? Number(wipe[2]) : 5
      }
      el.z = page.elements.length
      page.elements.push(el)
      continue
    }

    if (/^Button\(/i.test(line)) {
      // Position: prefer the content inside Normal() — Text or Clip coords
      const normalPos =
        line.match(/Normal\(.*?Text\((-?\d+),\s*(-?\d+)/i) ||
        line.match(/Normal\(.*?Clip\((-?\d+),\s*(-?\d+)/i)
      const fallbackPos =
        line.match(/Text\((-?\d+),\s*(-?\d+)/i) ||
        line.match(/Clip\((-?\d+),\s*(-?\d+)/i)
      const pos = normalPos || fallbackPos
      const x = pos ? Number(pos[1]) : 100
      const y = pos ? Number(pos[2]) : 100
      const el = makeElem('button', x, y, 140, 40)

      // Label text from Normal(Text(...))
      const label = line.match(/Text\(-?\d+,\s*-?\d+,\s*"((?:[^"\\]|\\.)*)"/i)
      if (label) el.label = label[1].replaceAll('\\"', '"')
      const font = line.match(/Font\("([^"]+)",\s*(\d+)\)/i)
      if (font) el.fontSize = Number(font[2])

      // Clip-based button — extract image from Normal(Clip(..., "path"))
      const normalClip = line.match(/Normal\(Clip\(-?\d+,\s*-?\d+,\s*"([^"]+)"/i)
      if (normalClip) {
        const rawBtnImg = normalClip[1]
        el.btnImage = rawBtnImg          // visual: will be resolved by media resolver
        el.btnImageSourcePath = rawBtnImg // keep original path for round-trip
        el.mediaName = rawBtnImg.split(/[/\\]/).pop() || ''
      }

      // Size: explicit Resize() wins; otherwise 74×74 for Clip-based buttons (FluxAura Studio default)
      const resize = line.match(/Resize\((\d+),\s*(\d+)\)/i)
      if (resize) {
        el.w = Number(resize[1])
        el.h = Number(resize[2])
      } else if (normalClip) {
        el.w = 74
        el.h = 74
      }

      // Action: Use("target") subroutine call — treated as goto in FluxAura Studio
      const useTarget = line.match(/Select\(.*?Use\("([^"]+)"/i)
      if (useTarget) {
        el.action = 'goto'
        el.target = useTarget[1]
        el.linkType = 'page'
        el.linkTarget = useTarget[1]
      }
      // Goto("target") — FluxAura Studio serialized format
      const goto = line.match(/Goto\("([^"]+)"/i)
      if (goto) {
        const gotoTarget = goto[1]
        if (gotoTarget === '__next__') {
          el.action = 'next'
        } else if (gotoTarget === '__prev__') {
          el.action = 'prev'
        } else {
          el.action = 'goto'
          el.target = gotoTarget
          el.linkType = 'page'
          el.linkTarget = gotoTarget
        }
      }
      if (/Quit\(1\)/i.test(line)) el.action = 'quit'

      const wipe = line.match(/Wipe\("([^"]+)"(?:,\s*Speed\((\d+)\))?/i)
      if (wipe) {
        el.wipe = wipe[1]
        el.wipeSpeed = wipe[2] ? Number(wipe[2]) : 5
      }
      el.bevel = /Bevel\(On/i.test(line)
      el.matchSize = /MatchSize\(On/i.test(line)
      el.z = page.elements.length
      page.elements.push(el)
      continue
    }

    const movie = line.match(/^MovieClip\((-?\d+),\s*(-?\d+),\s*"([^"]+)"/i)
    if (movie) {
      const el = makeElem('mpeg', Number(movie[1]), Number(movie[2]), 320, 240)
      const rawFile = movie[3]
      el.file = rawFile
      const isNativePath = rawFile && !rawFile.startsWith('data:') && (rawFile.includes('/') || rawFile.includes('\\') || /^[a-zA-Z]:/.test(rawFile))
      const isPlaceholder = rawFile === 'video.avi' || rawFile === 'video.mp4'
      const movieCap = inferMediaCapability(rawFile, detectMediaKind(rawFile))
      el.mediaName = rawFile.split(/[/\\]/).pop() || ''
      el.mediaExt = movieCap.extension || getMediaExtension(rawFile)
      el.mediaKind = movieCap.category || 'video'
      el.mediaSupport = movieCap.support || 'unknown'
      el.mediaReason = movieCap.reason || ''
      el.mediaOutputHint = movieCap.outputHint || ''
      // Only treat as native source path if it looks like a real filesystem path
      if (isNativePath && !isPlaceholder) {
        el.mediaSourcePath = rawFile
      }
      const resize = line.match(/Resize\((\d+),\s*(\d+)\)/i)
      if (resize) {
        el.w = Number(resize[1])
        el.h = Number(resize[2])
      }
      const wipe = line.match(/Wipe\("([^"]+)"(?:,\s*Speed\((\d+)\))?/i)
      if (wipe) {
        el.wipe = wipe[1]
        el.wipeSpeed = wipe[2] ? Number(wipe[2]) : 5
      }
      el.z = page.elements.length
      page.elements.push(el)
    }
  }

  if (page) pages.push(page)
  result.stage = {
    width: stageWidth,
    height: stageHeight,
    presetKey: getPresetKey(stageWidth, stageHeight),
  }
  return result
}

// ── Interaction meta helper ──────────────────────────────────────────────────
// Extracts all interaction/button-behaviour fields from an element for embedding
// in mme:btn / mme:clip / mme:mpeg / mme:txt / mme:hotspot metadata.
// Only native filesystem paths are saved for media fields — temp/HTTP URLs are
// resolved on-the-fly by the playback engine via isUnresolvedMediaPath().
/**
 * Build the interaction/media metadata object for a single element.
 * Only native filesystem paths are included — temp/blob/data URLs are omitted.
 * @param {import('../types/desktop-api').SmmElement} el
 * @returns {Record<string, unknown>}
 */
export function buildInteractionMeta(el) {
  const m = /** @type {Record<string, unknown>} */ ({})
  if (el.interactive) m.interactive = true
  if (el.waitOnClick) m.waitOnClick = true
  if (el.hoverScale != null && el.hoverScale !== 1.0) m.hoverScale = el.hoverScale
  if (el.hoverOpacity != null && el.hoverOpacity !== 100) m.hoverOpacity = el.hoverOpacity
  if (el.hoverOverlayOn) { m.hoverOverlayOn = true; m.hoverColorOverlay = el.hoverColorOverlay || '' }
  if (el.hoverFullscreen) m.hoverFullscreen = true
  if (el.clickScale != null && el.clickScale !== 0.96) m.clickScale = el.clickScale
  if (el.clickFullscreen) m.clickFullscreen = true
  // Save native source paths only — reject temp HTTP / blob / data URLs
  if (el.hoverSoundFile && !isTempUrl(el.hoverSoundFile)) { m.hoverSoundFile = el.hoverSoundFile; m.hoverSoundName = el.hoverSoundName || '' }
  if (el.hoverMediaFile && !isTempUrl(el.hoverMediaFile)) { m.hoverMediaFile = el.hoverMediaFile; m.hoverMediaName = el.hoverMediaName || ''; m.hoverMediaLoop = el.hoverMediaLoop !== false; m.hoverMediaPlayCount = el.hoverMediaPlayCount ?? 0 }
  if (el.hoverMediaPlay) m.hoverMediaPlay = true
  if (el.hoverMediaPlayFrom != null) m.hoverMediaPlayFrom = el.hoverMediaPlayFrom
  if (el.hoverMediaPlayTo != null) m.hoverMediaPlayTo = el.hoverMediaPlayTo
  if (el.clickSoundFile && !isTempUrl(el.clickSoundFile)) { m.clickSoundFile = el.clickSoundFile; m.clickSoundName = el.clickSoundName || '' }
  if (el.clickMediaFile && !isTempUrl(el.clickMediaFile)) { m.clickMediaFile = el.clickMediaFile; m.clickMediaName = el.clickMediaName || ''; m.clickMediaLoop = !!el.clickMediaLoop; m.clickMediaPlayCount = el.clickMediaPlayCount ?? 1 }
  if (el.clickMediaPlayFrom != null) m.clickMediaPlayFrom = el.clickMediaPlayFrom
  if (el.clickMediaPlayTo != null) m.clickMediaPlayTo = el.clickMediaPlayTo
  if (el.actionChain?.length) m.actionChain = el.actionChain
  if (el.ifCondVar) { m.ifCondVar = el.ifCondVar; m.ifCondOp = el.ifCondOp || '=='; m.ifCondVal = String(el.ifCondVal ?? ''); if (el.ifCondElse?.length) m.ifCondElse = el.ifCondElse }
  return m
}

/**
 * Serialise all pages and stage config to SCA script text.
 * @param {import('../types/desktop-api').SmmPage[]} pages
 * @param {import('../types/desktop-api').SmmStage} stage
 * @returns {string} SCA script text ready to write to disk
 */
export function genMME(pages, stage, projectMeta = {}) {
  const stageWidth = stage?.width || SW
  const stageHeight = stage?.height || SH
  let out = '!SMMScript\n'
  out += '// Generated by FluxAura Studio\n'
  out += `// Stage ${stageWidth}x${stageHeight}\n`
  out += `// ${new Date().toISOString()}\n`
  const _colorSnapshot = { recent: getRecentColors(), saved: getSavedColors(), palettes: getSavedPalettes() }
  if (_colorSnapshot.recent.length || _colorSnapshot.saved.length || _colorSnapshot.palettes.length) {
    out += `// mme:colors ${JSON.stringify(_colorSnapshot)}\n`
  }
  // Presentation audio track — saved as sourcePath (native FS path) so it survives session restarts
  const pa = projectMeta.presentationAudio
  if (pa?.sourcePath) {
    out += `// mme:presaudio ${JSON.stringify({ name: pa.name || '', volume: pa.volume ?? 1, loop: pa.loop !== false, sourcePath: pa.sourcePath })}\n`
  }
  const pv = projectMeta.projectVars
  if (Array.isArray(pv) && pv.length) {
    out += `// mme:projectvars ${JSON.stringify(pv)}\n`
  }
  out += '\n'
  out += 'EVENT\n  Group:\n    Config.SaveOpts();\n  Sequence:\n'

  for (const pg of pages) {
    out += `    :"${pg.name}"\n`
    out += '    EVENT\n'
    out += '      Group:\n'
    // Only write native filesystem paths to Picture(); never embed data/temp URLs
    const bgPicturePath = pg.bgMediaSourcePath && !isTempUrl(pg.bgMediaSourcePath) ? pg.bgMediaSourcePath : null
    if (bgPicturePath) {
      out += `        Picture("${bgPicturePath}", Wipe("${pg.wipeIn || 'Fade'}", Speed(5), Direction(0)));\n`
    } else {
      out += `        Display(Face(Pen(1)), Size(${stageWidth}, ${stageHeight}));\n`
    }

    if (pg.timing.mode === 'wait') out += '        Wait();\n'
    if (pg.timing.mode === 'pause') out += `        Pause(${pg.timing.duration || 5});\n`

    // Write ALL timing metadata as mme:page comment — always written so every mode
    // (including 'none', 'loop', 'wait-input-goto') round-trips correctly.
    const timingMeta = {}
    timingMeta.mode = pg.timing.mode || 'wait'
    if (pg.timing.duration) timingMeta.duration = pg.timing.duration
    if (pg.timing.waitInputTrigger) timingMeta.waitInputTrigger = pg.timing.waitInputTrigger
    if (pg.timing.waitInputKey) timingMeta.waitInputKey = pg.timing.waitInputKey
    if (pg.timing.waitInputGoto) timingMeta.waitInputGoto = pg.timing.waitInputGoto
    if (pg.timing.waitInputGotoType) timingMeta.waitInputGotoType = pg.timing.waitInputGotoType
    if (pg.timing.onEnd && pg.timing.onEnd !== 'continue') timingMeta.onEnd = pg.timing.onEnd
    if (pg.timing.onEndTarget) timingMeta.onEndTarget = pg.timing.onEndTarget
    if (pg.timing.ifMode && pg.timing.ifMode !== 'always') timingMeta.ifMode = pg.timing.ifMode
    if (pg.timing.ifCount !== undefined) timingMeta.ifCount = pg.timing.ifCount
    if (pg.timing.ifVar) timingMeta.ifVar = pg.timing.ifVar
    if (pg.timing.ifOp) timingMeta.ifOp = pg.timing.ifOp
    if (pg.timing.ifVal !== undefined) timingMeta.ifVal = pg.timing.ifVal
    if (pg.timing.elseDo && pg.timing.elseDo !== 'none') timingMeta.elseDo = pg.timing.elseDo
    if (pg.timing.elseTarget) timingMeta.elseTarget = pg.timing.elseTarget
    out += `        // mme:page ${JSON.stringify(timingMeta)}\n`

    const sorted = [...pg.elements].sort((a, b) => a.z - b.z)
    for (const el of sorted) {
      if (el.type === 'text') {
        const _escapedTxt = (el.content || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\r', '\\r')
        out += `        Text(${Math.round(el.x)}, ${Math.round(el.y)}, "${_escapedTxt}", Font("${el.font || 'Rajdhani'}", ${el.size || 36}));\n`
        // Metadata: preserve text box dimensions and all styling/behavior
        const meta = {
          x: Math.round(el.x),
          y: Math.round(el.y),
          w: Math.round(el.w),
          h: Math.round(el.h),
          z: el.z ?? 0,
          color: el.color || '#e8a020',
          weight: el.weight || '700',
          align: el.align || 'center',
        }
        if (el.vAlign && el.vAlign !== 'middle') meta.vAlign = el.vAlign
        if (el.shadow) meta.shadow = true
        if (el.outline) meta.outline = true
        if (el.italic) meta.italic = true
        if (el.underline) meta.underline = true
        if (el.bgOn) { meta.bgOn = true; meta.bgColor = el.bgColor || '#000000' }
        if (el.elLabel) meta.elLabel = el.elLabel
        if (el.wipe) { meta.wipe = el.wipe; meta.wipeSpeed = el.wipeSpeed || 5; if (el.wipeDir) meta.wipeDir = el.wipeDir }
        if (el.audioEvent) { meta.audioEvent = el.audioEvent; meta.audioEventName = el.audioEventName || '' }
        if (el.afterPlay && el.afterPlay !== 'none') { meta.afterPlay = el.afterPlay; meta.afterPlayTarget = el.afterPlayTarget || '' }
        if (el.id) meta.id = el.id
        Object.assign(meta, buildInteractionMeta(el))
        // ── Animation (fly-in / fly-out) ──
        if (el.animIn && el.animIn !== 'none') {
          meta.animIn = el.animIn
          meta.animInDuration = el.animInDuration ?? 600
          meta.animInDelay = el.animInDelay ?? 0
          if (el.animInEasing && el.animInEasing !== 'ease-out') meta.animInEasing = el.animInEasing
        }
        if (el.animOut && el.animOut !== 'none') {
          meta.animOut = el.animOut
          meta.animOutDuration = el.animOutDuration ?? 600
          meta.animOutTrigger = el.animOutTrigger || 'never'
          if (el.animOutDelay) meta.animOutDelay = el.animOutDelay
        }
        // ── Playback timing ──
        if (el.onPlayDelay) meta.onPlayDelay = el.onPlayDelay
        if (el.playCount && el.playCount !== 1) meta.playCount = el.playCount
        if (el.wipeDir) meta.wipeDir = el.wipeDir
        // ── Media timeline ──
        if (el.mediaStartTime) meta.mediaStartTime = el.mediaStartTime
        if (el.mediaEndTime != null) meta.mediaEndTime = el.mediaEndTime
        if (el.mediaInTransition && el.mediaInTransition !== 'none') { meta.mediaInTransition = el.mediaInTransition; meta.mediaInDuration = el.mediaInDuration ?? 500 }
        if (el.mediaOutTransition && el.mediaOutTransition !== 'none') { meta.mediaOutTransition = el.mediaOutTransition; meta.mediaOutDuration = el.mediaOutDuration ?? 500 }
        if (el.mediaPauseTime != null) { meta.mediaPauseTime = el.mediaPauseTime; meta.mediaPauseAction = el.mediaPauseAction || 'none'; if (el.mediaPauseTarget) meta.mediaPauseTarget = el.mediaPauseTarget }
        // ── Wait-to-play / interaction triggers ──
        if (el.waitToPlay && el.waitToPlay !== 'none') { meta.waitToPlay = el.waitToPlay; if (el.waitToPlayKey) meta.waitToPlayKey = el.waitToPlayKey }
        if (el.showOnTrigger && el.showOnTrigger !== 'none') { meta.showOnTrigger = el.showOnTrigger; if (el.showOnTriggerKey) meta.showOnTriggerKey = el.showOnTriggerKey }
        if (el.hideOnTrigger && el.hideOnTrigger !== 'none') { meta.hideOnTrigger = el.hideOnTrigger; if (el.hideOnTriggerKey) meta.hideOnTriggerKey = el.hideOnTriggerKey }
        if (el.onClickScript?.length) meta.onClickScript = el.onClickScript
        if (el.onHoverScript?.length) meta.onHoverScript = el.onHoverScript
        if (el.showCondition?.enabled) meta.showCondition = el.showCondition
        out += `        // mme:txt ${JSON.stringify(meta)}\n`
      }

      if (el.type === 'clip') {
        // Use native source path if available; data:/blob:/app-media: are all "temp" — use mediaName as placeholder
        const f = String(externUrl(el.file || ''))
        const srcPath = el.mediaSourcePath && !isTempUrl(el.mediaSourcePath)
          ? el.mediaSourcePath
          : isTempUrl(f)
            ? (el.mediaName || 'image.bmp')
            : (f || el.mediaName || 'image.bmp')
        let clipLine = `        Clip(${Math.round(el.x)}, ${Math.round(el.y)}, "${srcPath}", Resize(${Math.round(el.w)}, ${Math.round(el.h)}), Operation(On)`
        if (el.transparent) clipLine += ', Transparent(On)'
        if (el.wipe) clipLine += `, Wipe("${el.wipe}", Speed(${el.wipeSpeed || 5}))`
        clipLine += ');\n'
        out += clipLine
        // Metadata: always preserve media identification and capability fields
        const clipMeta = {
          x: Math.round(el.x),
          y: Math.round(el.y),
          z: el.z ?? 0,
          mediaName: el.mediaName || '',
          mediaKind: el.mediaKind || 'image',
        }
        if (el.mediaExt) clipMeta.mediaExt = el.mediaExt
        if (el.mediaSupport) clipMeta.mediaSupport = el.mediaSupport
        if (el.mediaReason) clipMeta.mediaReason = el.mediaReason
        if (el.mediaOutputHint) clipMeta.mediaOutputHint = el.mediaOutputHint
        if (el.opacity !== undefined && el.opacity !== 100) clipMeta.opacity = el.opacity
        if (el.fit) clipMeta.fit = el.fit
        if (el.mediaSourcePath) clipMeta.mediaSourcePath = el.mediaSourcePath
        if (el.chromaKey) clipMeta.chromaKey = el.chromaKey
        if (el.chromaOrigFile) {
          const origF = String(externUrl(el.chromaOrigFile))
          if (origF.startsWith('data:') && origF.length < 8388608) clipMeta.chromaOrigDataUrl = origF
        }
        if (el.elLabel) clipMeta.elLabel = el.elLabel
        if (el.loop) clipMeta.loop = el.loop
        if (el.onPlayMode && el.onPlayMode !== 'auto') clipMeta.onPlayMode = el.onPlayMode
        if (el.afterPlay && el.afterPlay !== 'none') { clipMeta.afterPlay = el.afterPlay; clipMeta.afterPlayTarget = el.afterPlayTarget || '' }
        if (el.audioEvent) { clipMeta.audioEvent = el.audioEvent; clipMeta.audioEventName = el.audioEventName || '' }
        if (el.playCondition && el.playCondition !== 'always') {
          clipMeta.playCondition = el.playCondition
          if (el.playConditionCount !== undefined) clipMeta.playConditionCount = el.playConditionCount
          if (el.playConditionVar) clipMeta.playConditionVar = el.playConditionVar
          if (el.playConditionOp) clipMeta.playConditionOp = el.playConditionOp
          if (el.playConditionVal !== undefined) clipMeta.playConditionVal = el.playConditionVal
          if (el.playConditionElse && el.playConditionElse !== 'none') clipMeta.playConditionElse = el.playConditionElse
          if (el.playConditionElseTarget) clipMeta.playConditionElseTarget = el.playConditionElseTarget
        }
        // Embed data URLs as a self-contained fallback:
        // - Always for files < 512KB (tiny files — always safe to embed)
        // - When there is no native path: embed up to ~8MB base64 (~6MB raw) to cover typical WAV/MP3/MIDI
        clipMeta.id = el.id
        Object.assign(clipMeta, buildInteractionMeta(el))
        {
          const meta = clipMeta
        // ── Animation (fly-in / fly-out) ──
        if (el.animIn && el.animIn !== 'none') {
          meta.animIn = el.animIn
          meta.animInDuration = el.animInDuration ?? 600
          meta.animInDelay = el.animInDelay ?? 0
          if (el.animInEasing && el.animInEasing !== 'ease-out') meta.animInEasing = el.animInEasing
        }
        if (el.animOut && el.animOut !== 'none') {
          meta.animOut = el.animOut
          meta.animOutDuration = el.animOutDuration ?? 600
          meta.animOutTrigger = el.animOutTrigger || 'never'
          if (el.animOutDelay) meta.animOutDelay = el.animOutDelay
        }
        // ── Playback timing ──
        if (el.onPlayDelay) meta.onPlayDelay = el.onPlayDelay
        if (el.playCount && el.playCount !== 1) meta.playCount = el.playCount
        if (el.wipeDir) meta.wipeDir = el.wipeDir
        // ── Media timeline ──
        if (el.mediaStartTime) meta.mediaStartTime = el.mediaStartTime
        if (el.mediaEndTime != null) meta.mediaEndTime = el.mediaEndTime
        if (el.mediaInTransition && el.mediaInTransition !== 'none') { meta.mediaInTransition = el.mediaInTransition; meta.mediaInDuration = el.mediaInDuration ?? 500 }
        if (el.mediaOutTransition && el.mediaOutTransition !== 'none') { meta.mediaOutTransition = el.mediaOutTransition; meta.mediaOutDuration = el.mediaOutDuration ?? 500 }
        if (el.mediaPauseTime != null) { meta.mediaPauseTime = el.mediaPauseTime; meta.mediaPauseAction = el.mediaPauseAction || 'none'; if (el.mediaPauseTarget) meta.mediaPauseTarget = el.mediaPauseTarget }
        // ── Wait-to-play / interaction triggers ──
        if (el.waitToPlay && el.waitToPlay !== 'none') { meta.waitToPlay = el.waitToPlay; if (el.waitToPlayKey) meta.waitToPlayKey = el.waitToPlayKey }
        if (el.showOnTrigger && el.showOnTrigger !== 'none') { meta.showOnTrigger = el.showOnTrigger; if (el.showOnTriggerKey) meta.showOnTriggerKey = el.showOnTriggerKey }
        if (el.hideOnTrigger && el.hideOnTrigger !== 'none') { meta.hideOnTrigger = el.hideOnTrigger; if (el.hideOnTriggerKey) meta.hideOnTriggerKey = el.hideOnTriggerKey }
        if (el.frameBorder?.enabled) meta.frameBorder = el.frameBorder
        if (el.onClickScript?.length) meta.onClickScript = el.onClickScript
        if (el.onHoverScript?.length) meta.onHoverScript = el.onHoverScript
        if (el.showCondition?.enabled) meta.showCondition = el.showCondition
        }
        if (f.startsWith('data:')) {
          const isSmall = f.length < 524288           // < ~384KB raw: always embed
          const noNativePath = !el.mediaSourcePath
          const isRecoverableAudio = noNativePath && f.length < 8388608  // < ~6MB raw: embed audio without path
          if (isSmall || isRecoverableAudio) clipMeta.dataUrl = f
        }
        out += `        // mme:clip ${JSON.stringify(clipMeta)}\n`
      }

      if (el.type === 'button') {
        const action =
          el.action === 'quit'
            ? 'Quit(1)'
            : el.action === 'goto'
              ? `Goto("${el.target || ''}")`
              : el.action === 'prev'
                ? 'Goto("__prev__")'
                : 'Goto("__next__")'
        const lbl = (el.label || 'Button').replaceAll('"', '\\"')
        const bx = Math.round(el.x)
        const by = Math.round(el.y)
        const bFont = el.font || 'SGill'
        const bSize = el.fontSize || 14
        out += `        Button(Normal(Text(${bx}, ${by}, "${lbl}", Font("${bFont}", ${bSize}))), Highlight(Text(${bx}, ${by}, "${lbl}", Font("${bFont}", ${bSize}))), Select(Text(${bx}, ${by}, "${lbl}", Font("${bFont}", ${bSize})), ${action}), MatchSize(${el.matchSize !== false ? 'On' : 'Off'}));\n`
        // Build metadata as an object so all interaction fields can be added before serialising
        const btnMeta = /** @type {Record<string, unknown>} */ ({
          id: el.id,
          x: bx,
          y: by,
          z: el.z ?? 0,
          w: Math.round(el.w),
          h: Math.round(el.h),
          bgColor: el.bgColor || '#1a3a5c',
          fgColor: el.fgColor || '#e8a020',
          borderColor: el.borderColor || '#4a8fc0',
          borderWidth: el.borderWidth ?? 2,
          btnShape: el.btnShape || 'rect',
          radius: el.radius || '0px',
          fontWeight: el.fontWeight || '600',
          textShadow: el.textShadow || false,
          action: el.action || 'next',
          target: el.target || '',
          linkType: el.linkType || 'page',
          linkTarget: el.linkTarget || '',
          urlTarget: el.urlTarget || '',
          mediaFile: el.mediaFile || '',
          mediaFileName: el.mediaFileName || '',
          scriptContent: el.scriptContent || '',
          gotoType: el.gotoType || 'page',
          gotoPageName: el.gotoPageName || '',
          audioEvent: el.audioEvent || '',
          audioEventName: el.audioEventName || '',
          afterPlay: el.afterPlay || 'none',
          afterPlayTarget: el.afterPlayTarget || '',
          elLabel: el.elLabel || '',
          ...(el.btnImage && !externUrl(el.btnImage).startsWith('data:') ? { btnImageSourcePath: el.btnImageSourcePath || el.btnImage } : {}),
          ...(el.btnImage && externUrl(el.btnImage).startsWith('data:') ? { btnImage: externUrl(el.btnImage) } : {}),
        })
        // Hover state visual overrides
        if (el.hoverBg) btnMeta.hoverBg = el.hoverBg
        if (el.hoverFg) btnMeta.hoverFg = el.hoverFg
        if (el.hoverGrad) btnMeta.hoverGrad = el.hoverGrad
        if (el.hoverBtnImage) {
          if (el.hoverBtnImage.startsWith('data:')) btnMeta.hoverBtnImage = el.hoverBtnImage
          else btnMeta.hoverBtnImageSrc = el.hoverBtnImage
        }
        // Pressed/Select state visual overrides
        if (el.pressedBg) btnMeta.pressedBg = el.pressedBg
        if (el.pressedFg) btnMeta.pressedFg = el.pressedFg
        if (el.pressedGrad) btnMeta.pressedGrad = el.pressedGrad
        if (el.pressedBtnImage) {
          if (el.pressedBtnImage.startsWith('data:')) btnMeta.pressedBtnImage = el.pressedBtnImage
          else btnMeta.pressedBtnImageSrc = el.pressedBtnImage
        }
        // All interaction-editor state fields (hover/click media, action chains, conditions)
        Object.assign(btnMeta, buildInteractionMeta(el))
        {
          const meta = btnMeta
        // ── Animation (fly-in / fly-out) ──
        if (el.animIn && el.animIn !== 'none') {
          meta.animIn = el.animIn
          meta.animInDuration = el.animInDuration ?? 600
          meta.animInDelay = el.animInDelay ?? 0
          if (el.animInEasing && el.animInEasing !== 'ease-out') meta.animInEasing = el.animInEasing
        }
        if (el.animOut && el.animOut !== 'none') {
          meta.animOut = el.animOut
          meta.animOutDuration = el.animOutDuration ?? 600
          meta.animOutTrigger = el.animOutTrigger || 'never'
          if (el.animOutDelay) meta.animOutDelay = el.animOutDelay
        }
        // ── Playback timing ──
        if (el.onPlayDelay) meta.onPlayDelay = el.onPlayDelay
        if (el.playCount && el.playCount !== 1) meta.playCount = el.playCount
        if (el.wipeDir) meta.wipeDir = el.wipeDir
        // ── Media timeline ──
        if (el.mediaStartTime) meta.mediaStartTime = el.mediaStartTime
        if (el.mediaEndTime != null) meta.mediaEndTime = el.mediaEndTime
        if (el.mediaInTransition && el.mediaInTransition !== 'none') { meta.mediaInTransition = el.mediaInTransition; meta.mediaInDuration = el.mediaInDuration ?? 500 }
        if (el.mediaOutTransition && el.mediaOutTransition !== 'none') { meta.mediaOutTransition = el.mediaOutTransition; meta.mediaOutDuration = el.mediaOutDuration ?? 500 }
        if (el.mediaPauseTime != null) { meta.mediaPauseTime = el.mediaPauseTime; meta.mediaPauseAction = el.mediaPauseAction || 'none'; if (el.mediaPauseTarget) meta.mediaPauseTarget = el.mediaPauseTarget }
        // ── Wait-to-play / interaction triggers ──
        if (el.waitToPlay && el.waitToPlay !== 'none') { meta.waitToPlay = el.waitToPlay; if (el.waitToPlayKey) meta.waitToPlayKey = el.waitToPlayKey }
        if (el.showOnTrigger && el.showOnTrigger !== 'none') { meta.showOnTrigger = el.showOnTrigger; if (el.showOnTriggerKey) meta.showOnTriggerKey = el.showOnTriggerKey }
        if (el.hideOnTrigger && el.hideOnTrigger !== 'none') { meta.hideOnTrigger = el.hideOnTrigger; if (el.hideOnTriggerKey) meta.hideOnTriggerKey = el.hideOnTriggerKey }
        if (el.frameBorder?.enabled) meta.frameBorder = el.frameBorder
        // ── Normal state / play-from-to ──
        if (el.normalStatePausedAt) meta.normalStatePausedAt = el.normalStatePausedAt
        if (el.normalStateAction && el.normalStateAction !== 'none') meta.normalStateAction = el.normalStateAction
        if (el.mediaPlayFrom) meta.mediaPlayFrom = el.mediaPlayFrom
        if (el.mediaPlayTo) meta.mediaPlayTo = el.mediaPlayTo
        // ── Element scripts ──
        if (el.onClickScript?.length) meta.onClickScript = el.onClickScript
        if (el.onHoverScript?.length) meta.onHoverScript = el.onHoverScript
        if (el.showCondition?.enabled) meta.showCondition = el.showCondition
        }
        out += `        // mme:btn ${JSON.stringify(btnMeta)}\n`
      }

      if (el.type === 'mpeg') {
        const f = String(el.file || '')
        const srcPath = el.mediaSourcePath && !isTempUrl(el.mediaSourcePath)
          ? el.mediaSourcePath
          : isTempUrl(f)
            ? (el.mediaName || 'video.avi')
            : (f || el.mediaName || 'video.avi')
        let mpegLine = `        MovieClip(${Math.round(el.x)}, ${Math.round(el.y)}, "${srcPath}", Resize(${Math.round(el.w)}, ${Math.round(el.h)})`
        if (el.wipe) mpegLine += `, Wipe("${el.wipe}", Speed(${el.wipeSpeed || 5}))`
        mpegLine += ');\n'
        out += mpegLine
        // Metadata: always preserve media identification and capability fields
        const mpegMeta = {
          x: Math.round(el.x),
          y: Math.round(el.y),
          z: el.z ?? 0,
          mediaName: el.mediaName || '',
          mediaKind: el.mediaKind || 'video',
        }
        if (el.mediaExt) mpegMeta.mediaExt = el.mediaExt
        if (el.mediaSupport) mpegMeta.mediaSupport = el.mediaSupport
        if (el.mediaReason) mpegMeta.mediaReason = el.mediaReason
        if (el.mediaOutputHint) mpegMeta.mediaOutputHint = el.mediaOutputHint
        if (el.mediaSourcePath) mpegMeta.mediaSourcePath = el.mediaSourcePath
        if (el.elLabel) mpegMeta.elLabel = el.elLabel
        if (el.loop) mpegMeta.loop = el.loop
        if (el.onPlayMode && el.onPlayMode !== 'auto') mpegMeta.onPlayMode = el.onPlayMode
        if (el.afterPlay && el.afterPlay !== 'none') { mpegMeta.afterPlay = el.afterPlay; mpegMeta.afterPlayTarget = el.afterPlayTarget || '' }
        if (el.audioEvent) { mpegMeta.audioEvent = el.audioEvent; mpegMeta.audioEventName = el.audioEventName || '' }
        // Embed data URL fallback for smaller converted/transcoded video clips
        mpegMeta.id = el.id
        Object.assign(mpegMeta, buildInteractionMeta(el))
        {
          const meta = mpegMeta
        // ── Animation (fly-in / fly-out) ──
        if (el.animIn && el.animIn !== 'none') {
          meta.animIn = el.animIn
          meta.animInDuration = el.animInDuration ?? 600
          meta.animInDelay = el.animInDelay ?? 0
          if (el.animInEasing && el.animInEasing !== 'ease-out') meta.animInEasing = el.animInEasing
        }
        if (el.animOut && el.animOut !== 'none') {
          meta.animOut = el.animOut
          meta.animOutDuration = el.animOutDuration ?? 600
          meta.animOutTrigger = el.animOutTrigger || 'never'
          if (el.animOutDelay) meta.animOutDelay = el.animOutDelay
        }
        // ── Playback timing ──
        if (el.onPlayDelay) meta.onPlayDelay = el.onPlayDelay
        if (el.playCount && el.playCount !== 1) meta.playCount = el.playCount
        if (el.wipeDir) meta.wipeDir = el.wipeDir
        // ── Media timeline ──
        if (el.mediaStartTime) meta.mediaStartTime = el.mediaStartTime
        if (el.mediaEndTime != null) meta.mediaEndTime = el.mediaEndTime
        if (el.mediaInTransition && el.mediaInTransition !== 'none') { meta.mediaInTransition = el.mediaInTransition; meta.mediaInDuration = el.mediaInDuration ?? 500 }
        if (el.mediaOutTransition && el.mediaOutTransition !== 'none') { meta.mediaOutTransition = el.mediaOutTransition; meta.mediaOutDuration = el.mediaOutDuration ?? 500 }
        if (el.mediaPauseTime != null) { meta.mediaPauseTime = el.mediaPauseTime; meta.mediaPauseAction = el.mediaPauseAction || 'none'; if (el.mediaPauseTarget) meta.mediaPauseTarget = el.mediaPauseTarget }
        // ── Wait-to-play / interaction triggers ──
        if (el.waitToPlay && el.waitToPlay !== 'none') { meta.waitToPlay = el.waitToPlay; if (el.waitToPlayKey) meta.waitToPlayKey = el.waitToPlayKey }
        if (el.showOnTrigger && el.showOnTrigger !== 'none') { meta.showOnTrigger = el.showOnTrigger; if (el.showOnTriggerKey) meta.showOnTriggerKey = el.showOnTriggerKey }
        if (el.hideOnTrigger && el.hideOnTrigger !== 'none') { meta.hideOnTrigger = el.hideOnTrigger; if (el.hideOnTriggerKey) meta.hideOnTriggerKey = el.hideOnTriggerKey }
        if (el.frameBorder?.enabled) meta.frameBorder = el.frameBorder
        if (el.onClickScript?.length) meta.onClickScript = el.onClickScript
        if (el.onHoverScript?.length) meta.onHoverScript = el.onHoverScript
        if (el.showCondition?.enabled) meta.showCondition = el.showCondition
        }
        if (f.startsWith('data:')) {
          const isSmall = f.length < 524288
          const noNativePath = !el.mediaSourcePath
          const isRecoverableMedia = noNativePath && f.length < 8388608
          if (isSmall || isRecoverableMedia) mpegMeta.dataUrl = f
        }
        out += `        // mme:mpeg ${JSON.stringify(mpegMeta)}\n`
      }

      if (el.type === 'hotspot') {
        const hotMeta = {
          id: el.id,
          x: Math.round(el.x), y: Math.round(el.y), w: Math.round(el.w), h: Math.round(el.h), z: el.z || 0,
          hotspotShape: el.hotspotShape || 'rect',
          points: el.points || [],
          borderOn: el.borderOn !== false,
          borderColor: el.borderColor || '#3cb8be',
          borderWidth: el.borderWidth ?? 2,
          borderStyle: el.borderStyle || 'dashed',
          fillOpacity: el.fillOpacity || 0,
          fillColor: el.fillColor || '#ffffff',
          hoverEffect: el.hoverEffect || 'tint',
          hoverColor: el.hoverColor || 'rgba(255,255,255,0.18)',
          pressedEffect: el.pressedEffect || 'darken',
          pressedColor: el.pressedColor || 'rgba(0,0,0,0.25)',
          tooltip: el.tooltip || '',
          label: el.label || '',
          elLabel: el.elLabel || '',
          action: el.action || 'none',
          linkTarget: el.linkTarget || '',
          gotoPageName: el.gotoPageName || '',
          gotoPageId: el.gotoPageId || '',
          gotoObjectId: el.gotoObjectId || '',
          gotoObjectLabel: el.gotoObjectLabel || '',
          scriptContent: el.scriptContent || '',
        }
        // Preserve animation fields if set
        if (el.animIn && el.animIn !== 'none') { hotMeta.animIn = el.animIn; hotMeta.animInDuration = el.animInDuration ?? 600; hotMeta.animInDelay = el.animInDelay ?? 0; if (el.animInEasing && el.animInEasing !== 'ease-out') hotMeta.animInEasing = el.animInEasing }
        if (el.animOut && el.animOut !== 'none') { hotMeta.animOut = el.animOut; hotMeta.animOutDuration = el.animOutDuration ?? 600; hotMeta.animOutTrigger = el.animOutTrigger || 'never'; if (el.animOutDelay) hotMeta.animOutDelay = el.animOutDelay }
        if (el.onPlayDelay) hotMeta.onPlayDelay = el.onPlayDelay
        if (el.playCount && el.playCount !== 1) hotMeta.playCount = el.playCount
        if (el.wipeDir) hotMeta.wipeDir = el.wipeDir
        if (el.waitToPlay && el.waitToPlay !== 'none') { hotMeta.waitToPlay = el.waitToPlay; if (el.waitToPlayKey) hotMeta.waitToPlayKey = el.waitToPlayKey }
        if (el.showOnTrigger && el.showOnTrigger !== 'none') { hotMeta.showOnTrigger = el.showOnTrigger; if (el.showOnTriggerKey) hotMeta.showOnTriggerKey = el.showOnTriggerKey }
        if (el.hideOnTrigger && el.hideOnTrigger !== 'none') { hotMeta.hideOnTrigger = el.hideOnTrigger; if (el.hideOnTriggerKey) hotMeta.hideOnTriggerKey = el.hideOnTriggerKey }
        // All interaction/button-state fields (hover media, click media, action chains, conditions)
        Object.assign(hotMeta, buildInteractionMeta(el))
        // ── Media timeline ──
        if (el.loop) hotMeta.loop = el.loop
        if (el.onPlayMode && el.onPlayMode !== 'auto') hotMeta.onPlayMode = el.onPlayMode
        if (el.afterPlay && el.afterPlay !== 'none') { hotMeta.afterPlay = el.afterPlay; hotMeta.afterPlayTarget = el.afterPlayTarget || '' }
        if (el.audioEvent) { hotMeta.audioEvent = el.audioEvent; hotMeta.audioEventName = el.audioEventName || '' }
        if (el.mediaStartTime) hotMeta.mediaStartTime = el.mediaStartTime
        if (el.mediaEndTime != null) hotMeta.mediaEndTime = el.mediaEndTime
        if (el.mediaInTransition && el.mediaInTransition !== 'none') { hotMeta.mediaInTransition = el.mediaInTransition; hotMeta.mediaInDuration = el.mediaInDuration ?? 500 }
        if (el.mediaOutTransition && el.mediaOutTransition !== 'none') { hotMeta.mediaOutTransition = el.mediaOutTransition; hotMeta.mediaOutDuration = el.mediaOutDuration ?? 500 }
        if (el.mediaPauseTime != null) { hotMeta.mediaPauseTime = el.mediaPauseTime; hotMeta.mediaPauseAction = el.mediaPauseAction || 'none'; if (el.mediaPauseTarget) hotMeta.mediaPauseTarget = el.mediaPauseTarget }
        if (el.frameBorder?.enabled) hotMeta.frameBorder = el.frameBorder
        if (el.onClickScript?.length) hotMeta.onClickScript = el.onClickScript
        if (el.onHoverScript?.length) hotMeta.onHoverScript = el.onHoverScript
        if (el.showCondition?.enabled) hotMeta.showCondition = el.showCondition
        out += `        // mme:hotspot ${JSON.stringify(hotMeta)}\n`
      }
      if (el.type === 'menubar') {
        const mbMeta = {
          id: el.id,
          x: Math.round(el.x || 0),
          y: Math.round(el.y || 0),
          w: Math.round(el.w || 1920),
          h: Math.round(el.h || 60),
          z: el.z || 0,
          position: el.position || 'top',
          style: el.style || {},
          items: el.items || [],
          elLabel: el.elLabel || '',
          visible: el.visible !== false,
        }
        if (el.animIn && el.animIn !== 'none') { mbMeta.animIn = el.animIn; mbMeta.animInDuration = el.animInDuration ?? 600; mbMeta.animInDelay = el.animInDelay ?? 0 }
        if (el.animOut && el.animOut !== 'none') { mbMeta.animOut = el.animOut; mbMeta.animOutDuration = el.animOutDuration ?? 600 }
        out += `        // mme:menubar ${JSON.stringify(mbMeta)}\n`
      }
    } // end for (const el of sorted)

    // Write extended page metadata (wipeOut, bgColor, bgGradient, sound, bgMedia, pageType, iframeUrl)
    const pgExtMeta = {}
    pgExtMeta.id = pg.id  // always save page ID so gotoPageId references survive reload
    if (pg.wipeOut && pg.wipeOut !== 'Fade') pgExtMeta.wipeOut = pg.wipeOut
    if (pg.bgColor && pg.bgColor !== '#0a1a2a') pgExtMeta.bgColor = pg.bgColor
    if (pg.bgGradientEnabled) {
      pgExtMeta.bgGradientEnabled = true
      pgExtMeta.bgGradientFrom = pg.bgGradientFrom || '#0a1a2a'
      pgExtMeta.bgGradientTo = pg.bgGradientTo || '#1a3a5c'
      pgExtMeta.bgGradientAngle = pg.bgGradientAngle ?? 135
    }
    if (pg.sound?.file || pg.sound?.sourcePath) {
      const sndSrc = (pg.sound.sourcePath && !isTempUrl(pg.sound.sourcePath)) ? pg.sound.sourcePath : (pg.sound.file && !isTempUrl(pg.sound.file) ? pg.sound.file : '')
      pgExtMeta.sound = { file: sndSrc, name: pg.sound.name || '', loops: !!pg.sound.loops, sourcePath: (pg.sound.sourcePath && !isTempUrl(pg.sound.sourcePath)) ? pg.sound.sourcePath : '' }
    }
    if (pg.bgMediaName) pgExtMeta.bgMedia = {
      name: pg.bgMediaName,
      kind: pg.bgMediaKind || 'image',
      transition: pg.bgMediaTransition || 'fade',
      src: (pg.bgMediaSourcePath && !isTempUrl(pg.bgMediaSourcePath))
        ? pg.bgMediaSourcePath
        : (pg.bgMediaSrc?.startsWith('data:') ? pg.bgMediaSrc : '')
    }
    if (pg.pageType && pg.pageType !== 'standard') pgExtMeta.pageType = pg.pageType
    if (pg.iframeUrl) pgExtMeta.iframeUrl = pg.iframeUrl
    if (pg.persistAudio) pgExtMeta.persistAudio = true
    if (pg.lyricStart != null) pgExtMeta.lyricStart = pg.lyricStart
    if (pg.lyricEnd != null) pgExtMeta.lyricEnd = pg.lyricEnd
    if (pg.wordTimestamps?.length) pgExtMeta.wordTimestamps = pg.wordTimestamps
    // Save narration: store sourcePath (native FS path) so it survives session restart.
    // Never save the ephemeral HTTP media server URL (isTempUrl returns true for those).
    // For TTS synthesis with no native path, embed the data URL directly.
    if (pg.narration) {
      const narr = pg.narration
      const srcPath = narr.sourcePath && !isTempUrl(narr.sourcePath) ? narr.sourcePath : ''
      const dataFile = !srcPath && narr.file && narr.file.startsWith('data:') ? narr.file : ''
      if (srcPath || dataFile) {
        pgExtMeta.narration = {
          ...(srcPath ? { sourcePath: srcPath } : {}),
          ...(dataFile ? { file: dataFile } : {}),
          name: narr.name || '',
          autoPlay: narr.autoPlay !== false,
        }
      }
    }
    if (Object.keys(pgExtMeta).length) out += `        // mme:pgext ${JSON.stringify(pgExtMeta)}\n`

    // Page-level visual script blocks (VariableEditor onStartScript / onEndScript)
    if (pg.onStartScript?.length || pg.onEndScript?.length) {
      const scriptMeta = {}
      if (pg.onStartScript?.length) scriptMeta.onStartScript = pg.onStartScript
      if (pg.onEndScript?.length) scriptMeta.onEndScript = pg.onEndScript
      out += `        // mme:script ${JSON.stringify(scriptMeta)}\n`
    }

    out += '      Sequence:\n    END\n'
  }

  out += 'END\n'
  return out
}
