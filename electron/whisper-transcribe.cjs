// @ts-check
/**
 * whisper-transcribe.cjs
 *
 * Runs Whisper speech-to-text ENTIRELY in the Electron main process (Node.js).
 *
 * Why main process?
 *  - @xenova/transformers detects RUNNING_LOCALLY=true → uses Node.js fs, real file paths,
 *    native ONNX runtime (not WASM). No CSP issues, no Invalid URL errors.
 *  - Audio decoded via ffmpeg-static → Float32Array at 16 kHz.
 *  - Large model files downloaded via Node.js https, zero renderer network restrictions.
 *
 * IPC channels:
 *   whisper:transcribe       → runs full pipeline, returns { ok, text, chunks }
 *   whisper:cancel           → aborts in-progress transcription
 *   whisper:model-status     → { allCached, files[] }
 *   whisper:clear-model      → delete cached model files
 *
 * Progress events (sent back to renderer):
 *   whisper:progress   { type: 'model'|'audio'|'inference'|'status', ...fields }
 */

const { ipcMain, app } = require('electron')
const path = require('path')
const fs  = require('fs')
const fsp = require('fs/promises')
const os  = require('os')
const https = require('https')
const http = require('http')
const { createTranscriptionEngineManager } = require('./transcription-engines/transcription-engine-manager.cjs')
const audioDecode = require('./audio-decode.cjs')
const { runXenovaFloat32 } = require('./transcription-engines/xenova-engine.cjs')
const hfAuth = require('./hf-auth.cjs')

const REPO_ROOT = path.resolve(__dirname, '..')
const ffmpegPath = audioDecode.getFfmpegPath()
if (!ffmpegPath) {
  console.warn('[whisper] ffmpeg-static not found — local transcription decode will fail')
}

// ── HuggingFace token (read from environment or stored in user data) ─────────
let _hfToken = process.env.HF_TOKEN || null

function setHFToken(token) {
  _hfToken = token
  if (token) {
    console.log('[whisper] HuggingFace token configured')
    process.env.HF_TOKEN = token  // Also set env var for transformers.js
  }
}

// ── Custom Node.js fetch that bypasses Electron's fetch restrictions ─────────
/**
 * Wrap Node.js https.request to provide a fetch-compatible interface.
 * This ensures @xenova/transformers uses real Node.js networking, not Electron's
 * restricted fetch which inherits file:// CORS restrictions.
 * 
 * Includes support for HuggingFace authentication token for onnx-community models.
 */
async function nodeFetch(url, options = {}) {
  console.log('[nodeFetch] Attempting to fetch:', url.substring(0, 80))
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    }
    
    // Add HuggingFace token if available and fetching from huggingface.co
    if (_hfToken && urlObj.hostname.includes('huggingface.co')) {
      requestOptions.headers['Authorization'] = `Bearer ${_hfToken}`
      console.log('[nodeFetch] Added HuggingFace Authorization header')
    }
    
    console.log('[nodeFetch] Request options:', { hostname: requestOptions.hostname, method: requestOptions.method, hasAuth: !!requestOptions.headers['Authorization'] })
    
    const req = protocol.request(requestOptions, (res) => {
      let data = Buffer.alloc(0)
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk])
      })
      res.on('end', () => {
        console.log('[nodeFetch] Response received, status:', res.statusCode)
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          text: () => Promise.resolve(data.toString('utf-8')),
          json: () => Promise.resolve(JSON.parse(data.toString('utf-8'))),
          buffer: () => Promise.resolve(data),
          arrayBuffer: () => Promise.resolve(data.buffer),
          headers: {
            get: (name) => res.headers[name.toLowerCase()],
          },
        })
      })
    })
    
    req.on('error', (err) => {
      console.error('[nodeFetch] Request error:', err.message)
      reject(err)
    })
    if (options.body) req.write(options.body)
    req.end()
  })
}

// ── Cache dir ─────────────────────────────────────────────────────────────

function getCacheDir() {
  return path.join(app.getPath('userData'), 'whisper-models')
}

function getModelCacheDir(modelId) {
  if (typeof modelId !== 'string' || !modelId.trim()) {
    throw new Error('Invalid Whisper model id')
  }
  const cacheRoot = path.resolve(getCacheDir())
  const safeName = modelId.replace(/[^A-Za-z0-9._-]+/g, '--')
  const dir = path.resolve(cacheRoot, safeName)
  const relative = path.relative(cacheRoot, dir)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Unsafe Whisper model cache path')
  }
  return dir
}

async function getFolderStats(dir) {
  const stats = { fileCount: 0, sizeBytes: 0 }
  async function walk(currentDir) {
    let entries = []
    try {
      entries = await fsp.readdir(currentDir, { withFileTypes: true })
    } catch {
      return
    }
    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(entryPath)
      } else if (entry.isFile()) {
        const fileStat = await fsp.stat(entryPath)
        stats.fileCount += 1
        stats.sizeBytes += fileStat.size
      }
    }))
  }
  await walk(dir)
  return stats
}

// ── Pipeline singleton ────────────────────────────────────────────────────

let _loadedPipeline = null
let _loadedModelId  = null

function toCallablePipeline(loaded) {
  return typeof loaded === 'function'
    ? loaded
    : typeof loaded?.call === 'function'
      ? loaded.call.bind(loaded)
      : typeof loaded?._call === 'function'
        ? loaded._call.bind(loaded)
        : null
}

// ── Audio decode (ffmpeg → Float32Array at 16 kHz) ───────────────────────

async function decodeForTranscription(inputPath, {
  startSec = null,
  durationSec = null,
  transcriptionMode = 'normal',
} = {}) {
  const lyricFocus = transcriptionMode === 'lyric-vocal-focus'
  const decodeOpts = {
    sampleRate: 16000,
    mono: true,
    normalize: true,
    highpass: lyricFocus ? 100 : null,
    lowpass: lyricFocus ? 8000 : null,
    loudnorm: lyricFocus,
  }
  if (Number.isFinite(startSec) && startSec >= 0) decodeOpts.startSec = startSec
  if (Number.isFinite(durationSec) && durationSec > 0) decodeOpts.durationSec = durationSec

  const started = Date.now()
  const decoded = await audioDecode.decodeAudioToFloat32(inputPath, decodeOpts)
  const totalMs = Date.now() - started

  return {
    ...decoded,
    totalDecodeMs: totalMs,
  }
}

/**
 * Download a URL to a temp file so we can pass a file path to ffmpeg.
 * Follows redirects.
 */
function downloadToTemp(url) {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(os.tmpdir(), `fluxaura-studio-audio-${Date.now()}.tmp`)
    const out = fs.createWriteStream(tmpPath)
    const doGet = (reqUrl, hops = 0) => {
      if (hops > 10) return reject(new Error('Too many redirects'))
      const mod = reqUrl.startsWith('https') ? require('https') : require('http')
      mod.get(reqUrl, { timeout: 30000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          doGet(res.headers.location, hops + 1)
          return
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode} downloading audio`))
        }
        res.pipe(out)
        out.on('finish', () => resolve(tmpPath))
        out.on('error', reject)
        res.on('error', reject)
      }).on('error', reject)
    }
    doGet(url)
  })
}

// ── Transcription ─────────────────────────────────────────────────────────

let _cancelFlag = false

const HALLUCINATION_RE = /^\s*(\[.*?\]|\(.*?\)|♪+|♫+|-{3,}|\.{3,}|thank you\.?|thanks\.?|you\.?)\s*$/i
const NON_LYRIC_RE = /^\s*(\[(music|instrumental|applause|laughter|noise|silence).*\]|\((music|instrumental|applause|laughter|noise|silence).*\)|music|instrumental|applause|laughter|noise|silence)\s*$/i

function isLikelyLyricText(text) {
  const t = String(text || '').trim()
  if (!t) return false
  if (HALLUCINATION_RE.test(t)) return false
  if (NON_LYRIC_RE.test(t)) return false
  return /[A-Za-z]/.test(t)
}

function dedupeSegments(segments) {
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  const DEDUPE_START_SEC = 0.25
  const DEDUPE_END_SEC = 0.25
  const deduped = []
  for (const seg of sorted) {
    const isDup = deduped.some((kept) => (
      Math.abs(kept.start - seg.start) < DEDUPE_START_SEC
      && Math.abs(kept.end - seg.end) < DEDUPE_END_SEC
      && String(kept.text || '').trim() === String(seg.text || '').trim()
    ))
    if (!isDup) deduped.push(seg)
  }
  return deduped
}

function computeLargeGaps(chunks, minGapSec = 8) {
  const sorted = [...(chunks || [])]
    .filter((seg) => Number.isFinite(seg?.start) && Number.isFinite(seg?.end))
    .sort((a, b) => a.start - b.start)
  const gaps = []
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]
    const next = sorted[i]
    const gap = next.start - prev.end
    if (gap > minGapSec) {
      gaps.push({ start: Math.round(prev.end * 1000) / 1000, end: Math.round(next.start * 1000) / 1000, gapSec: Math.round(gap * 1000) / 1000 })
    }
  }
  return gaps
}

function containsTerm(result, term) {
  const re = new RegExp(`\\b${term}\\b`, 'i')
  const text = String(result?.text || '')
  const inText = re.test(text)
  const inChunks = (result?.chunks || []).some((seg) => re.test(String(seg?.text || '')))
  return inText || inChunks
}

function validateTranscriptionOutput({ chunks, text, durationSec }) {
  const warnings = []
  const sorted = [...(chunks || [])].sort((a, b) => (a?.start ?? Infinity) - (b?.start ?? Infinity))
  const firstStart = getFirstMeaningfulStart(sorted)
  if (Number.isFinite(firstStart) && firstStart > 15) {
    warnings.push(`First lyric chunk starts late at ${firstStart.toFixed(2)}s`)
  }
  const bigGaps = computeLargeGaps(sorted, 12)
  if (bigGaps.length > 0 && Number.isFinite(firstStart)) {
    warnings.push(`Detected ${bigGaps.length} large lyric timing gap(s) >12s`)
  }
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length
  if (Number.isFinite(durationSec) && durationSec > 120 && words < 55) {
    warnings.push(`Transcript text appears short for duration (${words} words over ${Math.round(durationSec)}s)`)
  }
  const norm = sorted.map((seg) => String(seg?.text || '').trim().toLowerCase()).filter(Boolean)
  if (norm.length >= 6) {
    const uniqueCount = new Set(norm).size
    if (uniqueCount / norm.length < 0.45) {
      warnings.push('Transcript appears repetitive/chorus-heavy; verse coverage may be incomplete')
    }
  }
  if (Number.isFinite(durationSec) && durationSec > 140 && Number.isFinite(firstStart) && firstStart >= 35) {
    warnings.push(`Long-track late-start warning: first chunk at ${firstStart.toFixed(2)}s for ~${Math.round(durationSec)}s audio`)
  }
  return warnings
}

function expandToWordTimestamps(sentenceSegments) {
  const out = []
  for (const seg of sentenceSegments) {
    const text = String(seg?.text || '').trim()
    if (!text) continue
    const words = text.split(/\s+/).filter(Boolean)
    if (!words.length) continue
    const start = Number.isFinite(seg.start) ? seg.start : 0
    const end = Number.isFinite(seg.end) && seg.end > start ? seg.end : start + 0.5
    const span = Math.max(0.1, end - start)
    const secPerWord = span / words.length
    for (let i = 0; i < words.length; i += 1) {
      const ws = start + i * secPerWord
      const we = start + (i + 1) * secPerWord
      out.push({
        start: Math.round(ws * 1000) / 1000,
        end: Math.round(we * 1000) / 1000,
        text: i === 0 ? words[i] : ` ${words[i]}`,
      })
    }
  }
  return out
}

function normalizePipelineOutput(pipeOutput, {
  offsetSec = 0,
  totalSec = Number.POSITIVE_INFINITY,
  languageHint = 'en',
  filterHallucinations = true,
  dropNonLyricMarkers = true,
} = {}) {
  const outObj = Array.isArray(pipeOutput) ? (pipeOutput[0] ?? {}) : (pipeOutput ?? {})
  const fullText = String(outObj.text ?? '').trim()
  const detectedLanguage = outObj.language ? String(outObj.language) : languageHint

  const rawChunks = Array.isArray(outObj.chunks)
    ? outObj.chunks
    : Array.isArray(outObj.segments)
      ? outObj.segments
      : []

  const parsed = []
  for (const c of rawChunks) {
    const text = String(c?.text ?? '').trim()
    if (!text) continue
    if (filterHallucinations && HALLUCINATION_RE.test(text)) continue
    if (dropNonLyricMarkers && NON_LYRIC_RE.test(text)) continue

    const ts = Array.isArray(c?.timestamp) ? c.timestamp : []
    const localStart = typeof ts[0] === 'number' && ts[0] >= 0 ? ts[0] : 0
    const localEnd = typeof ts[1] === 'number' && ts[1] > localStart ? ts[1] : localStart + 4

    const absStart = offsetSec + localStart
    const absEnd = Math.min(offsetSec + localEnd, totalSec)
    if (absStart >= totalSec) continue

    parsed.push({
      start: Math.round(absStart * 1000) / 1000,
      end: Math.round(absEnd * 1000) / 1000,
      text,
    })
  }

  if (
    parsed.length === 0
    && fullText
    && (!filterHallucinations || !HALLUCINATION_RE.test(fullText))
    && (!dropNonLyricMarkers || !NON_LYRIC_RE.test(fullText))
  ) {
    const fallbackEnd = Number.isFinite(totalSec)
      ? Math.min(offsetSec + 30, totalSec)
      : offsetSec + 30
    parsed.push({
      start: Math.round(offsetSec * 1000) / 1000,
      end: Math.round(fallbackEnd * 1000) / 1000,
      text: fullText,
    })
  }

  return {
    text: fullText,
    chunks: parsed,
    language: detectedLanguage,
  }
}

function logTranscriptionSummary(method, result) {
  const preview = String(result?.text || '').slice(0, 1000)
  const chunks = Array.isArray(result?.chunks) ? result.chunks : []
  const firstChunkStart = Number.isFinite(chunks[0]?.start) ? chunks[0].start : null
  const gaps = computeLargeGaps(chunks, 8)
  const containsGasoline = containsTerm(result, 'gasoline')
  const containsFingers = containsTerm(result, 'fingers')
  const containsMatch = containsTerm(result, 'match')
  console.log('[whisper] engine:', result?.engine || 'xenova')
  console.log('[whisper] method:', method)
  console.log('[whisper] model:', result?.model || null)
  console.log('[whisper] full text preview (first 1000 chars):', preview)
  console.log('[whisper] total chunks count:', chunks.length)
  console.log('[whisper] first chunk start:', firstChunkStart)
  console.log('[whisper] first segment:', chunks[0] || null)
  console.log('[whisper] first ten chunks:', chunks.slice(0, 10))
  console.log('[whisper] gaps > 8s:', gaps)
  console.log('[whisper] containsGasoline:', containsGasoline)
  console.log('[whisper] containsFingers:', containsFingers)
  console.log('[whisper] containsMatch:', containsMatch)
  console.log('[whisper] first segment:', chunks[0] || null)
  console.log('[whisper] first five segments:', chunks.slice(0, 5))
}

function getFirstMeaningfulStart(chunks) {
  if (!Array.isArray(chunks)) return Number.POSITIVE_INFINITY
  for (const seg of chunks) {
    const text = String(seg?.text || '').trim()
    if (!text) continue
    if (text.startsWith('[TRANSCRIPTION GAP')) continue
    if (!isLikelyLyricText(text)) continue
    if (Number.isFinite(seg?.start)) return seg.start
  }
  return Number.POSITIVE_INFINITY
}

async function recoverOpeningSegments({ resolvedPath, firstStartSec, language, send, transcriptionMode = 'normal' }) {
  if (!Number.isFinite(firstStartSec) || firstStartSec <= 15) return []
  console.log('[whisper] openingRetryStarted:', { firstStartSec, transcriptionMode })
  send({ type: 'status', message: 'Retrying opening section (0s-45s)…' })

  let openingDecoded = null
  const started = Date.now()
  try {
    openingDecoded = await decodeForTranscription(resolvedPath, {
      startSec: 0,
      durationSec: 45,
      transcriptionMode,
    })
    console.log('[whisper] opening clip duration:', Math.round((openingDecoded.durationSec || 0) * 1000) / 1000)
    console.log('[whisper] opening clip wav temp path:', openingDecoded.wavPath)
    console.log('[whisper] opening clip float array length:', openingDecoded.floatArrayLength)
    console.log('[whisper] opening clip decode time ms:', openingDecoded.totalDecodeMs)

    const inferStarted = Date.now()
    const openingOut = await runXenovaFloat32(_loadedPipeline, openingDecoded.samples, {
      language,
      returnTimestamps: 'word',
      chunkLengthS: 30,
      strideLengthS: 5,
    })
    console.log('[whisper] opening clip transcription time ms:', Date.now() - inferStarted)
    const parsed = normalizePipelineOutput(openingOut, {
      offsetSec: 0,
      totalSec: 45,
      languageHint: language || 'en',
      filterHallucinations: false,
      dropNonLyricMarkers: true,
    })
    const openingChunks = (parsed.chunks || []).filter((seg) => Number.isFinite(seg?.start) && seg.start <= firstStartSec + 0.5)
    console.log('[whisper] openingRetryTextPreview:', String(parsed.text || '').slice(0, 500))
    console.log('[whisper] openingRetryChunkCount:', openingChunks.length)
    console.log('[whisper] openingRetryFirstChunks:', openingChunks.slice(0, 5))
    console.log('[whisper] opening retry total ms:', Date.now() - started)
    return dedupeSegments(openingChunks)
  } catch (err) {
    console.warn('[whisper] opening retry failed:', err?.message)
    return []
  } finally {
    if (openingDecoded?.cleanup) await openingDecoded.cleanup()
  }
}

let _engineManager = null
function getEngineManager() {
  if (!_engineManager) {
    _engineManager = createTranscriptionEngineManager({
      repoRoot: REPO_ROOT,
      ffmpegPath,
      runXenova: runXenovaTranscription,
    })
  }
  return _engineManager
}

async function runXenovaTranscription(event, {
  audioUrl,
  audioFilePath,
  modelId,
  language,
  wordTimestamps = true,
  transcriptionMode = 'normal',
  openingSectionOnly = false,
  sectionStartSec = null,
  sectionEndSec = null,
}) {
  const send = (data) => { try { event.sender.send('whisper:progress', data) } catch {} }
  _cancelFlag = false

  console.log('[whisper] runTranscription starting', { modelId, audioFilePath, audioUrl: audioUrl?.substring(0, 50) })

  // ── Step 1: Load pipeline (downloads model automatically in Node.js context) ──
  if (!_loadedPipeline || _loadedModelId !== modelId) {
    _loadedPipeline = null
    _loadedModelId  = null

    const { pipeline, env } = await import('@xenova/transformers')

    // In Node.js (main process) RUNNING_LOCALLY=true — use file system caching.
    // Override cacheDir so models land in userData (survives app updates).
    env.cacheDir          = getCacheDir()
    env.allowLocalModels  = true
    env.allowRemoteModels = true
    env.useBrowserCache   = false
    env.useFSCache        = true
    
    // CRITICAL: Use Node.js https.request (via nodeFetch) instead of Electron's fetch.
    // Electron's fetch inherits file:// CORS restrictions even in the main process.
    // This custom fetch bypasses those restrictions by using native Node.js networking.
    const envAny = /** @type {Record<string, unknown>} */ (env)
    envAny.fetchFn = nodeFetch
    
    console.log('[whisper] Configured env:', {
      cacheDir: env.cacheDir,
      useFSCache: env.useFSCache,
      hasFetchFn: !!envAny.fetchFn,
    })

    // No WASM needed in Node.js — native ONNX runtime is used automatically.

    send({ type: 'status', message: 'Loading model… (first run downloads ~75 MB)' })

    try {
      const loaded = await pipeline('automatic-speech-recognition', modelId, {
        quantized: true,
        progress_callback: (prog) => {
          send({ type: 'model', ...prog })
        },
      })

      console.log('[whisper] Loaded pipeline typeof:', typeof loaded)
      console.log('[whisper] Loaded pipeline keys:', loaded && typeof loaded === 'object' ? Object.keys(loaded) : [])

      _loadedPipeline = toCallablePipeline(loaded)
      if (typeof _loadedPipeline !== 'function') {
        throw new Error('Whisper pipeline loaded, but it is not callable. Check @xenova/transformers version.')
      }

      _loadedModelId = modelId
    } catch (err) {
      const errMsg = err.message || String(err)
      
      // If 401 Unauthorized when trying to load large model, fall back to base
      if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
        console.warn('[whisper] Model download returned 401 (auth required). Falling back to Xenova/whisper-base')
        send({ type: 'status', message: 'Large model unavailable (auth error). Using base model instead...' })
        
        // Try again with smaller model that doesn't require auth
        if (modelId !== 'Xenova/whisper-base') {
          const loadedFallback = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
            quantized: true,
            progress_callback: (prog) => {
              send({ type: 'model', ...prog })
            },
          })
          _loadedPipeline = toCallablePipeline(loadedFallback)
          if (typeof _loadedPipeline !== 'function') {
            throw new Error('Fallback Whisper pipeline loaded, but it is not callable.')
          }
          _loadedModelId = 'Xenova/whisper-base'
        } else {
          throw err
        }
      } else {
        throw err
      }
    }
  } else {
    send({ type: 'status', message: 'Model already loaded.' })
  }

  if (_cancelFlag) throw new Error('Cancelled')

  // ── Step 2: Resolve audio to a local file path ────────────────────────────
  send({ type: 'status', message: 'Loading audio…' })
  let tmpFile = null
  let resolvedPath = audioFilePath || null

  if (!resolvedPath) {
    // Download from media server URL (http://127.0.0.1:...) to temp file
    try {
      tmpFile = await downloadToTemp(audioUrl)
      resolvedPath = tmpFile
    } catch (e) {
      throw new Error(`Could not fetch audio: ${e.message}`)
    }
  }

  if (_cancelFlag) { if (tmpFile) fsp.unlink(tmpFile).catch(() => {}) ; throw new Error('Cancelled') }

  let methodUsed = 'node-float32-full'
  let finalResult = null
  let decoded = null
  let sectionBaseOffsetSec = 0

  const parsedStart = Number(sectionStartSec)
  const parsedEnd = Number(sectionEndSec)
  const hasSelectedSection = Number.isFinite(parsedStart) && Number.isFinite(parsedEnd) && parsedEnd > parsedStart

  let selectedDurationSec = null
  if (openingSectionOnly) {
    sectionBaseOffsetSec = 0
    selectedDurationSec = 45
    methodUsed = 'node-float32-opening-only'
  } else if (hasSelectedSection) {
    sectionBaseOffsetSec = Math.max(0, parsedStart)
    selectedDurationSec = Math.max(2, parsedEnd - parsedStart)
    methodUsed = 'node-float32-selected-section'
  } else if (transcriptionMode === 'lyric-vocal-focus') {
    methodUsed = 'node-float32-lyric-vocal-focus'
  }

  let probedDuration = null

  try {
    if (_cancelFlag) throw new Error('Cancelled')
    send({ type: 'status', message: 'Decoding audio (Node/ffmpeg)…' })
    decoded = await decodeForTranscription(resolvedPath, {
      startSec: sectionBaseOffsetSec,
      durationSec: selectedDurationSec,
      transcriptionMode,
    })
    probedDuration = Number.isFinite(decoded?.durationSec)
      ? decoded.durationSec + sectionBaseOffsetSec
      : null

    console.log('[whisper] decoded duration sec:', Math.round((decoded.durationSec || 0) * 1000) / 1000)
    console.log('[whisper] sample rate:', decoded.sampleRate)
    console.log('[whisper] channel count:', decoded.channels)
    console.log('[whisper] float array length:', decoded.floatArrayLength)
    console.log('[whisper] wav temp path:', decoded.wavPath)
    console.log('[whisper] decode time ms:', decoded.totalDecodeMs)

    if (_cancelFlag) throw new Error('Cancelled')
    send({ type: 'status', message: 'Transcribing audio…' })

    const transcribeStarted = Date.now()
    const directOut = await runXenovaFloat32(_loadedPipeline, decoded.samples, {
      language,
      returnTimestamps: 'word',
      chunkLengthS: 30,
      strideLengthS: 5,
    })
    console.log('[whisper] transcription time ms:', Date.now() - transcribeStarted)

    finalResult = normalizePipelineOutput(directOut, {
      offsetSec: sectionBaseOffsetSec,
      totalSec: sectionBaseOffsetSec + (decoded.durationSec || Number.POSITIVE_INFINITY),
      languageHint: language || 'en',
    })

    const firstStartDirect = getFirstMeaningfulStart(finalResult.chunks)
    if (!openingSectionOnly && !hasSelectedSection && firstStartDirect > 15) {
      console.warn('[whisper-transcribe] late-start detected in node-float32 mode; attempting opening retry:', firstStartDirect)
      const rescuedOpening = await recoverOpeningSegments({
        resolvedPath,
        firstStartSec: firstStartDirect,
        language,
        send,
        transcriptionMode,
      })
      if (rescuedOpening.length > 0) {
        methodUsed = `${methodUsed}+opening-retry`
        finalResult.chunks = dedupeSegments([...rescuedOpening, ...(finalResult.chunks || [])])
        const mergedText = finalResult.chunks.map((seg) => String(seg.text || '').trim()).filter(Boolean).join(' ').trim()
        if (mergedText) finalResult.text = mergedText
        console.log('[whisper] openingRetryMerged:', true)
        console.log('[whisper-transcribe] opening retry recovered segments:', rescuedOpening.length)
      } else {
        console.log('[whisper] openingRetryMerged:', false)
      }
    }
  } catch (directErr) {
    methodUsed = openingSectionOnly ? 'manual-window-opening-only' : 'manual-window'
    console.warn('[whisper-transcribe] node-float32 full pass failed, falling back to manual windows:', directErr?.message)
    send({ type: 'status', message: 'Primary pass failed. Falling back to manual window mode…' })

    if (!decoded) {
      decoded = await decodeForTranscription(resolvedPath, {
        startSec: sectionBaseOffsetSec,
        durationSec: selectedDurationSec,
        transcriptionMode,
      })
      probedDuration = Number.isFinite(decoded?.durationSec)
        ? decoded.durationSec + sectionBaseOffsetSec
        : null
      console.log('[whisper] decode time ms (fallback):', decoded.totalDecodeMs)
    }

    const audioData = decoded.samples

    if (_cancelFlag) throw new Error('Cancelled')
    send({ type: 'status', message: `Transcribing ${Math.round(audioData.length / 16000)}s of audio…` })

    const SAMPLE_RATE = 16000
    const WINDOW_SEC = 20
    const OVERLAP_SEC = 2
    const WINDOW_SAMPLES = WINDOW_SEC * SAMPLE_RATE
    const STEP_SAMPLES = (WINDOW_SEC - OVERLAP_SEC) * SAMPLE_RATE
    const totalSec = audioData.length / SAMPLE_RATE
    const absoluteTotalSec = sectionBaseOffsetSec + totalSec
    const numWindows = Math.max(1, Math.ceil((audioData.length - OVERLAP_SEC * SAMPLE_RATE) / STEP_SAMPLES))

    const allRaw = []
    const fullTextParts = []
    let detectedLanguage = language || 'en'

    for (let wi = 0; wi < numWindows; wi += 1) {
      if (_cancelFlag) throw new Error('Cancelled')

      const windowOffset = wi * STEP_SAMPLES
      const offsetSec = sectionBaseOffsetSec + windowOffset / SAMPLE_RATE
      const windowSlice = audioData.slice(windowOffset, windowOffset + WINDOW_SAMPLES)

      const pct = Math.round(10 + (wi / numWindows) * 85)
      send({ type: 'inference', progress: pct })

      const inferOpts = {
        task: 'transcribe',
        return_timestamps: true,
      }
      if (language) inferOpts.language = language

      try {
        const windowOut = await _loadedPipeline(windowSlice, inferOpts)
        const parsed = normalizePipelineOutput(windowOut, {
          offsetSec,
          totalSec: absoluteTotalSec,
          languageHint: detectedLanguage,
        })
        if (parsed.language) detectedLanguage = parsed.language
        if (parsed.text) fullTextParts.push(parsed.text)
        allRaw.push(...parsed.chunks)
      } catch (winErr) {
        const failedStart = Math.round(offsetSec * 100) / 100
        const failedEnd = Math.round(Math.min(offsetSec + WINDOW_SEC, absoluteTotalSec) * 100) / 100
        console.warn(
          `[whisper-transcribe] window ${wi} failed (${failedStart}s-${failedEnd}s):`,
          winErr?.message,
        )
        allRaw.push({
          start: failedStart,
          end: failedEnd,
          text: `[TRANSCRIPTION GAP ${failedStart}-${failedEnd}]`,
        })
      }
    }

    send({ type: 'inference', progress: 100 })

    const segments = dedupeSegments(allRaw)
    const fullText = fullTextParts.join(' ').trim()

    if (segments.length === 0 && fullText) {
      const WORDS_PER_PAGE = 8
      const words = fullText.split(/\s+/).filter(Boolean)
      const secPerWord = words.length > 0 ? totalSec / words.length : 0.5
      for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
        const group = words.slice(i, i + WORDS_PER_PAGE)
        segments.push({
          start: Math.round(i * secPerWord * 100) / 100,
          end: Math.round((i + group.length) * secPerWord * 100) / 100,
          text: group.join(' '),
        })
      }
    }

    finalResult = { text: fullText, chunks: segments, language: detectedLanguage }

    const firstStartFallback = getFirstMeaningfulStart(finalResult.chunks)
    if (!openingSectionOnly && !hasSelectedSection && firstStartFallback > 15) {
      console.warn('[whisper-transcribe] late-start detected in manual-window mode; attempting opening retry:', firstStartFallback)
      const rescuedOpening = await recoverOpeningSegments({
        resolvedPath,
        firstStartSec: firstStartFallback,
        language,
        send,
        transcriptionMode,
      })
      if (rescuedOpening.length > 0) {
        methodUsed = `${methodUsed}+opening-retry`
        finalResult.chunks = dedupeSegments([...rescuedOpening, ...(finalResult.chunks || [])])
        const mergedText = finalResult.chunks.map((seg) => String(seg.text || '').trim()).filter(Boolean).join(' ').trim()
        if (mergedText) finalResult.text = mergedText
        console.log('[whisper] openingRetryMerged:', true)
        console.log('[whisper-transcribe] opening retry recovered segments:', rescuedOpening.length)
      } else {
        console.log('[whisper] openingRetryMerged:', false)
      }
    }
  } finally {
    if (tmpFile) {
      fsp.unlink(tmpFile).catch(() => {})
    }
    if (decoded?.cleanup) await decoded.cleanup()
  }

  const orderedChunks = dedupeSegments(Array.isArray(finalResult?.chunks) ? finalResult.chunks : [])
  const textOut = String(finalResult?.text || '').trim() || orderedChunks.map((seg) => seg.text).join(' ').trim()
  const languageOut = finalResult?.language || language || 'en'
  const durationSec = Number.isFinite(probedDuration)
    ? probedDuration
    : (orderedChunks.length ? Math.max(...orderedChunks.map((seg) => Number(seg?.end) || 0)) : null)
  const warningsOut = validateTranscriptionOutput({ chunks: orderedChunks, text: textOut, durationSec })
  const gapsOut = computeLargeGaps(orderedChunks, 8)
  const containsGasoline = containsTerm({ text: textOut, chunks: orderedChunks }, 'gasoline')
  const containsFingers = containsTerm({ text: textOut, chunks: orderedChunks }, 'fingers')
  const containsMatch = containsTerm({ text: textOut, chunks: orderedChunks }, 'match')
  const wordTimestampsOut = wordTimestamps
    ? (methodUsed.startsWith('direct-file')
      ? orderedChunks
      : expandToWordTimestamps(orderedChunks))
    : []

  const resultOut = {
    text: textOut,
    chunks: orderedChunks,
    language: languageOut,
    wordTimestamps: wordTimestampsOut,
    method: methodUsed,
    engine: 'xenova',
    model: _loadedModelId || modelId,
    warnings: warningsOut,
    gaps: gapsOut,
    containsGasoline,
    containsFingers,
    containsMatch,
    firstTenChunks: orderedChunks.slice(0, 10),
  }
  logTranscriptionSummary(methodUsed, resultOut)
  return resultOut
}

async function runTranscription(event, payload) {
  const manager = getEngineManager()
  return manager.transcribe({ event, payload })
}

// ── IPC registration ───────────────────────────────────────────────────────

function registerWhisperTranscribeIPC() {
  ipcMain.handle('whisper:transcribe', async (event, payload) => {
    try {
      await hfAuth.getToken()
      console.log('[whisper:transcribe] IPC handler called', { modelId: payload.modelId, audioUrl: payload.audioUrl?.substring(0, 50) })
      console.log('[whisper:transcribe] audioFilePath:', payload?.audioFilePath || null)
      console.log('[whisper:transcribe] preset:', payload?.selectedPreset || null)
      console.log('[whisper:transcribe] resolvedEngine:', payload?.resolvedEngine || null)
      const output = await runTranscription(event, payload)
      // runTranscription now returns pre-processed { start, end, text } chunks directly
      // (manual windowed chunking + hallucination filter + time-proximity dedup applied)
      console.log('[whisper:transcribe] Success, returning result')
      return {
        ok: true,
        text: output.text || '',
        chunks: output.chunks || [],
        language: output.language || payload.language || 'en',
        wordTimestamps: output.wordTimestamps || [],
        engine: output.engine || 'xenova',
        method: output.method || null,
        model: output.model || payload.modelId || null,
        modelPath: output.modelPath || null,
        demucsUsed: !!output.demucsUsed,
        beamSize: Number.isFinite(output.beamSize) ? output.beamSize : null,
        vadFilter: typeof output.vadFilter === 'boolean' ? output.vadFilter : null,
        localProTimings: output.localProTimings || null,
        transcriptionDurationSec: Number.isFinite(output.transcriptionDurationSec) ? output.transcriptionDurationSec : null,
        warnings: output.warnings || [],
        gaps: output.gaps || [],
        containsGasoline: !!output.containsGasoline,
        containsFingers: !!output.containsFingers,
        containsMatch: !!output.containsMatch,
      }
    } catch (err) {
      const msg = err?.message || String(err)
      if (msg !== 'Cancelled') console.error('[whisper:transcribe] Error:', msg, err.stack)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle('whisper:set-hf-token', (_event, { token }) => {
    setHFToken(token)
    return { ok: true }
  })

  ipcMain.handle('whisper:engine-status', async () => {
    const manager = getEngineManager()
    return manager.getEngineStatus()
  })

  ipcMain.handle('whisper:export-debug', async (_event, payload) => {
    try {
      const manager = getEngineManager()
      const output = payload?.output || {}
      const debugData = await manager.buildDebugPayload({ payload: payload?.request || {}, output })
      const releaseDir = path.join(REPO_ROOT, 'release')
      await fsp.mkdir(releaseDir, { recursive: true })
      const outPath = path.join(releaseDir, `transcription-debug-${Date.now()}.json`)
      await fsp.writeFile(outPath, JSON.stringify(debugData, null, 2), 'utf8')
      return { ok: true, filePath: outPath }
    } catch (err) {
      return { ok: false, error: err?.message || String(err) }
    }
  })

  ipcMain.handle('whisper:cancel', () => {
    _cancelFlag = true
    _loadedPipeline = null
    _loadedModelId  = null
    return { ok: true }
  })

  ipcMain.handle('whisper:model-status', async (_event, { modelId }) => {
    const dir = getModelCacheDir(modelId)
    const exists = fs.existsSync(dir)
    const folderStats = exists ? await getFolderStats(dir) : { fileCount: 0, sizeBytes: 0 }
    return { allCached: exists, dir, ...folderStats }
  })

  ipcMain.handle('whisper:clear-model', async (_event, { modelId }) => {
    try {
      const dir = getModelCacheDir(modelId)
      await fsp.rm(dir, { recursive: true, force: true })
      _loadedPipeline = null
      _loadedModelId  = null
      return { ok: true, dir }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // HuggingFace token lifecycle integration with whisper module
  ipcMain.handle('whisper:setHFTokenInModule', (_, token) => {
    setHFToken(token)
    return { ok: true }
  })
}

module.exports = { registerWhisperTranscribeIPC }
