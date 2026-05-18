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
const { spawn } = require('child_process')
const https = require('https')
const http = require('http')

let ffmpegPath = /** @type {string | null} */ (null)
try { 
  ffmpegPath = /** @type {string | null} */ (/** @type {unknown} */ (require('ffmpeg-static')))
  // In packaged app (app.asar), the path might be inside the archive.
  // Convert app.asar paths to app.asar.unpacked equivalents so they can be executed.
  if (ffmpegPath && ffmpegPath.includes('app.asar')) {
    ffmpegPath = ffmpegPath.replace(/app\.asar([\\\/])/, 'app.asar.unpacked$1')
    console.log('[whisper] Resolved ffmpeg path:', ffmpegPath)
  }
} catch {}

// Verify the file exists before using it
if (ffmpegPath && !fs.existsSync(ffmpegPath)) {
  console.warn('[whisper] ffmpeg not found at', ffmpegPath, '— transcription will fail')
  ffmpegPath = null
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

// ── Audio decode (ffmpeg → Float32Array at 16 kHz) ───────────────────────

/**
 * Decode any audio/video file to Float32Array PCM at 16 kHz mono.
 * Uses ffmpeg-static which is already bundled in the project.
 */
function decodeAudioToFloat32(filePath) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg-static not found'))
    const chunks = []
    const proc = spawn(ffmpegPath, [
      '-i', filePath,
      '-ar', '16000',   // 16 kHz sample rate (required by Whisper)
      '-ac', '1',       // mono
      '-f', 'f32le',    // raw 32-bit float little-endian PCM
      'pipe:1',         // output to stdout
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    proc.stdout.on('data', (chunk) => chunks.push(chunk))
    proc.stderr.on('data', () => {}) // suppress ffmpeg log spam
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0 && chunks.length === 0) {
        return reject(new Error(`ffmpeg exited with code ${code}`))
      }
      const total = chunks.reduce((s, c) => s + c.length, 0)
      const buf = Buffer.concat(chunks, total)
      const samples = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
      resolve(samples)
    })
  })
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

async function runTranscription(event, { audioUrl, audioFilePath, modelId, language, wordTimestamps = true }) {
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
      _loadedPipeline = await pipeline('automatic-speech-recognition', modelId, {
        quantized: true,
        progress_callback: (prog) => {
          send({ type: 'model', ...prog })
        },
      })
      _loadedModelId = modelId
    } catch (err) {
      const errMsg = err.message || String(err)
      
      // If 401 Unauthorized when trying to load large model, fall back to base
      if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
        console.warn('[whisper] Model download returned 401 (auth required). Falling back to Xenova/whisper-base')
        send({ type: 'status', message: 'Large model unavailable (auth error). Using base model instead...' })
        
        // Try again with smaller model that doesn't require auth
        if (modelId !== 'Xenova/whisper-base') {
          _loadedPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
            quantized: true,
            progress_callback: (prog) => {
              send({ type: 'model', ...prog })
            },
          })
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

  // ── Step 3: Decode audio → Float32Array at 16 kHz ────────────────────────
  send({ type: 'status', message: 'Decoding audio…' })
  let audioData
  try {
    audioData = await decodeAudioToFloat32(resolvedPath)
  } catch (e) {
    throw new Error(`Audio decode failed: ${e.message}`)
  } finally {
    if (tmpFile) fsp.unlink(tmpFile).catch(() => {})
  }

  if (_cancelFlag) throw new Error('Cancelled')
  send({ type: 'status', message: `Transcribing ${Math.round(audioData.length / 16000)}s of audio…` })

  // ── Step 4: Inference — manual 30s window chunking ───────────────────────
  //
  // @xenova/transformers v2 ignores chunk_length_s for Float32Array input in
  // both browser and Node.js — the chunking only applies to URL string input.
  // Passing the full audio directly processes only the first ~30s (Whisper's
  // receptive field).  We slice manually, call the pipeline once per window,
  // then reassemble with timestamp offsets — same approach as the browser path.

  const SAMPLE_RATE    = 16000
  const WINDOW_SEC     = 30
  const OVERLAP_SEC    = 3
  const WINDOW_SAMPLES = WINDOW_SEC  * SAMPLE_RATE
  const STEP_SAMPLES   = (WINDOW_SEC - OVERLAP_SEC) * SAMPLE_RATE
  const totalSec       = audioData.length / SAMPLE_RATE
  const numWindows     = Math.max(1, Math.ceil((audioData.length - OVERLAP_SEC * SAMPLE_RATE) / STEP_SAMPLES))

  /** Whisper hallucination patterns — non-speech output to discard */
  const HALLUCINATION_RE = /^\s*(\[.*?\]|\(.*?\)|♪+|♫+|-{3,}|\.{3,}|thank you\.?|thanks\.?|you\.?)\s*$/i

  const allRaw = []
  const fullTextParts = []
  let detectedLanguage = language || 'en'

  for (let wi = 0; wi < numWindows; wi++) {
    if (_cancelFlag) throw new Error('Cancelled')

    const windowOffset  = wi * STEP_SAMPLES
    const offsetSec     = windowOffset / SAMPLE_RATE
    const windowSlice   = audioData.slice(windowOffset, windowOffset + WINDOW_SAMPLES)

    const pct = Math.round(10 + (wi / numWindows) * 85)
    send({ type: 'inference', progress: pct })

    const inferOpts = {
      task: 'transcribe',
      return_timestamps: true,   // sentence-level — reliable for singing, consistent chunk sizes
    }
    if (language) inferOpts.language = language

    let windowOut
    try {
      windowOut = await _loadedPipeline(windowSlice, inferOpts)
    } catch (winErr) {
      console.warn(`[whisper-transcribe] window ${wi} failed:`, winErr?.message)
      continue
    }

    const outObj   = Array.isArray(windowOut) ? (windowOut[0] ?? {}) : (windowOut ?? {})
    const winText  = String(outObj.text ?? '').trim()
    if (outObj.language && detectedLanguage === (language || 'en')) {
      detectedLanguage = String(outObj.language)
    }

    const rawChunks = Array.isArray(outObj.chunks)   ? outObj.chunks
      : Array.isArray(outObj.segments) ? outObj.segments
      : []

    for (const c of rawChunks) {
      const text = String(c?.text ?? '').trim()
      if (!text || HALLUCINATION_RE.test(text)) continue

      const ts   = Array.isArray(c?.timestamp) ? c.timestamp : []
      const cSt  = typeof ts[0] === 'number' && ts[0] >= 0 ? ts[0] : 0
      const cEnd = typeof ts[1] === 'number' && ts[1] > cSt  ? ts[1] : cSt + 4

      const absStart = offsetSec + cSt
      const absEnd   = Math.min(offsetSec + cEnd, totalSec)

      if (absStart >= totalSec) continue
      allRaw.push({ start: absStart, end: absEnd, text })
    }

    // Window produced text but no chunk timestamps — one segment for the window
    if (rawChunks.length === 0 && winText && !HALLUCINATION_RE.test(winText)) {
      fullTextParts.push(winText)
      allRaw.push({ start: offsetSec, end: Math.min(offsetSec + WINDOW_SEC, totalSec), text: winText })
    } else if (winText) {
      fullTextParts.push(winText)
    }
  }

  send({ type: 'inference', progress: 100 })

  // ── Sort by start time ──────────────────────────────────────────────────
  allRaw.sort((a, b) => a.start - b.start)

  // ── Time-proximity dedup — keeps chorus repetitions, drops overlap dupes ─
  const DUP_WINDOW_SEC = 5
  const segments = []
  for (const seg of allRaw) {
    const isDup = segments.some(
      kept =>
        Math.abs(kept.start - seg.start) < DUP_WINDOW_SEC &&
        kept.text.toLowerCase() === seg.text.toLowerCase()
    )
    if (!isDup) segments.push(seg)
  }

  const fullText = fullTextParts.join(' ').trim()

  // Absolute fallback — no timed chunks at all
  if (segments.length === 0 && fullText) {
    const WORDS_PER_PAGE = 8
    const words = fullText.split(/\s+/).filter(Boolean)
    const secPerWord = words.length > 0 ? totalSec / words.length : 0.5
    for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
      const group = words.slice(i, i + WORDS_PER_PAGE)
      segments.push({
        start: Math.round(i * secPerWord * 100) / 100,
        end:   Math.round((i + group.length) * secPerWord * 100) / 100,
        text:  group.join(' '),
      })
    }
  }

  return { text: fullText, chunks: segments, language: detectedLanguage }
}

// ── IPC registration ───────────────────────────────────────────────────────

function registerWhisperTranscribeIPC() {
  ipcMain.handle('whisper:transcribe', async (event, payload) => {
    try {
      console.log('[whisper:transcribe] IPC handler called', { modelId: payload.modelId, audioUrl: payload.audioUrl?.substring(0, 50) })
      const output = await runTranscription(event, payload)
      // runTranscription now returns pre-processed { start, end, text } chunks directly
      // (manual windowed chunking + hallucination filter + time-proximity dedup applied)
      console.log('[whisper:transcribe] Success, returning result')
      return { ok: true, text: output.text || '', chunks: output.chunks || [], language: output.language || payload.language || 'en' }
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
