// @ts-check
/**
 * whisperUtils.js — Whisper speech-to-text
 *
 * TWO PATHS:
 *   Electron: delegates to main-process IPC (whisper-transcribe.cjs) — fast, no WASM issues
 *   Browser:  runs @xenova/transformers v2 directly in the renderer
 *
 * BROWSER LIBRARY CHOICE — @xenova/transformers v2 (NOT @huggingface/transformers v4):
 *   The app's shared onnxruntime-web is 1.14.0.  @huggingface/transformers v4 requires
 *   ORT 1.20+ and throws qdq_actions.cc errors with ORT 1.14.  @xenova/transformers v2
 *   was built for ORT 1.14 and works correctly with Xenova/* model files.
 *   Large models (onnx-community/*) only work via the Electron IPC path.
 *
 * Usage:
 *   import { transcribe, WHISPER_MODELS, isWhisperAvailable } from './whisperUtils.js'
 *   const { text, segments } = await transcribe(audioUrl, { model: 'Xenova/whisper-tiny', onProgress })
 */

/** @typedef {{ id: string, label: string, size: string, sizeBytes: number, description: string, electronOnly?: boolean, license?: string, commercialUse?: boolean, requiresApiKey?: boolean, service?: string }} WhisperModelInfo */
/** @typedef {{ start: number, end: number, text: string }} WhisperSegment */
/** @typedef {{ text: string, segments: WhisperSegment[], language: string, chunks?: unknown[], wordTimestamps?: WhisperSegment[], engine?: string, method?: string, model?: string, selectedPreset?: string|null, resolvedEngine?: string|null, demucsUsed?: boolean, beamSize?: number|null, vadFilter?: boolean|null, localProTimings?: unknown, transcriptionDurationSec?: number|null, warnings?: string[], gaps?: unknown[], containsGasoline?: boolean, containsFingers?: boolean, containsMatch?: boolean, ok?: boolean, error?: string }} WhisperResult */

/**
 * Xenova's published env type marks these flags readonly, but v2 expects apps to
 * configure them at runtime. Keep the mutability cast local to this boundary.
 * @param {unknown} env
 */
function configureBrowserTransformersEnv(env) {
  const mutableEnv = /** @type {{ allowRemoteModels: boolean, allowLocalModels: boolean }} */ (env)
  mutableEnv.allowRemoteModels = true
  mutableEnv.allowLocalModels = false
}

/**
 * Available Whisper model variants.
 *
 * Browser path only supports Xenova/* models — they use ORT-1.14-compatible INT8
 * quantization.  onnx-community/* models use newer QDQ ops that ORT 1.14 cannot run.
 * Large models are marked with a note — they work in Electron (IPC path) only.
 */
export const WHISPER_MODELS = /** @type {WhisperModelInfo[]} */ ([
  {
    id: 'auto-best',
    label: '★ Auto Best (Xenova + whisper.cpp fallback)',
    size: 'AUTO',
    sizeBytes: 0,
    description: 'Uses Xenova first, then whisper.cpp automatically if local output appears incomplete.',
    electronOnly: true,
  },
  {
    id: 'Xenova/whisper-tiny',
    label: 'Tiny (~75 MB)',
    size: '75MB',
    sizeBytes: 75 * 1024 * 1024,
    description: 'Fastest — usable for clear speech, poor for singing',
    license: 'MIT',
    commercialUse: true,
  },
  {
    id: 'Xenova/whisper-base',
    label: 'Base (~145 MB)',
    size: '145MB',
    sizeBytes: 145 * 1024 * 1024,
    description: 'Balance of speed & accuracy (~70-75% for music)',
    license: 'MIT',
    commercialUse: true,
  },
  {
    id: 'Xenova/whisper-small',
    label: 'Small (~480 MB)',
    size: '480MB',
    sizeBytes: 480 * 1024 * 1024,
    description: 'Higher accuracy (~80%)',
    license: 'MIT',
    commercialUse: true,
  },
  {
    id: 'Xenova/whisper-medium',
    label: '★ Medium (~1.5 GB) — Best for lyrics (90% accuracy)',
    size: '1.5GB',
    sizeBytes: 1500 * 1024 * 1024,
    description: 'Best local lyric option currently wired in the app; downloads/caches on first use',
    license: 'MIT',
    commercialUse: true,
  },
  {
    id: 'whispercpp-medium',
    label: 'whisper.cpp Medium (local binary/model required)',
    size: 'LOCAL',
    sizeBytes: 0,
    description: 'Runs whisper.cpp locally when whisper-cli/main.exe and a medium model are installed.',
    electronOnly: true,
  },
  {
    id: 'whispercpp-large',
    label: 'whisper.cpp Large/Turbo (local binary/model required)',
    size: 'LOCAL',
    sizeBytes: 0,
    description: 'Runs whisper.cpp large/turbo locally when installed.',
    electronOnly: true,
  },
  {
    id: 'openai-api',
    label: '☁ OpenAI Whisper API — cloud service',
    size: 'API',
    sizeBytes: 0,
    description: 'OpenAI paid API service. Requires your own OpenAI API key. Current implementation uses whisper-1.',
    requiresApiKey: true,
    service: 'OpenAI',
  },
])

/**
 * Default model — Medium (1.5GB) provides 90%+ accuracy for lyric transcription.
 * Base (145MB) only ~70% accurate for music; Medium is worth the download.
 * In Electron, models are cached after first download.
 */
export const DEFAULT_WHISPER_MODEL = 'Xenova/whisper-medium'

export {
  TRANSCRIPTION_PRESETS,
  DEFAULT_TRANSCRIPTION_PRESET_ID,
  LOCAL_PRO_PERFORMANCE_PROFILES,
  DEFAULT_LOCAL_PRO_PROFILE_ID,
  getLocalProProfileById,
  getTranscriptionPresetById,
  resolveTranscriptionPreset,
} from './transcriptionPresets.js'

// ── Helper: is Electron IPC bridge available? ─────────────────────────────

function hasElectronIPC() {
  return typeof window !== 'undefined' && typeof window.smmDesktop?.whisper?.transcribe === 'function'
}

let _browserPipeline = null
let _browserPipelineModel = null

// ── HuggingFace token management ───────────────────────────────────────────

/**
 * Store and configure HuggingFace token for accessing restricted models.
 * In Electron: passes token to main process via IPC.
 * In browser: stores in localStorage for potential future use.
 */
export async function setHuggingFaceToken(token) {
  if (!token) return
  
  if (hasElectronIPC()) {
    try {
      await window.smmDesktop.whisper.setHFToken({ token })
      console.log('[whisper] HuggingFace token configured via IPC')
    } catch (err) {
      console.error('[whisper] Failed to set HF token:', err.message)
    }
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem('hf-api-token', token)
    console.log('[whisper] HuggingFace token stored in localStorage')
  }
}

/**
 * Retrieve stored HuggingFace token.
 */
export function getHuggingFaceToken() {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('hf-api-token')
  }
  return null
}

// ── Availability check ─────────────────────────────────────────────────────

/**
 * Returns true when Whisper transcription is available.
 * In Electron: always true (handled in main process).
 * In browser: checks if @xenova/transformers is installed.
 */
export async function isWhisperAvailable() {
  if (hasElectronIPC()) return true
  try {
    const mod = await import('@xenova/transformers')
    return typeof mod?.pipeline === 'function'
  } catch {
    return false
  }
}

// ── OpenAI Whisper API path ────────────────────────────────────────────────

/**
 * Transcribe via OpenAI cloud Whisper API (whisper-1 = large-v2 quality).
 * Returns word-level timestamps.
 *
 * @param {string} audioUrl - Blob URL of the audio file
 * @param {string} apiKey - OpenAI API key
 * @param {{ language?: string, onTranscribeProgress?: (pct: number) => void }} [opts]
 * @returns {Promise<WhisperResult>}
 */
async function transcribeViaOpenAI(audioUrl, apiKey, opts = {}) {
  const { language, onTranscribeProgress } = opts
  const key = apiKey || (typeof localStorage !== 'undefined' && localStorage.getItem('openai-api-key')) || ''
  if (!key) throw new Error('OpenAI API key required. Enter your key in the model picker.')

  if (onTranscribeProgress) onTranscribeProgress(5)
  const fetchRes = await fetch(audioUrl)
  if (!fetchRes.ok) throw new Error(`Failed to fetch audio: ${fetchRes.status}`)
  const blob = await fetchRes.blob()
  if (onTranscribeProgress) onTranscribeProgress(20)

  const ext = blob.type.includes('mpeg') ? 'mp3'
    : blob.type.includes('wav') ? 'wav'
    : blob.type.includes('ogg') ? 'ogg'
    : blob.type.includes('flac') ? 'flac'
    : 'mp3'

  const formData = new FormData()
  formData.append('file', new File([blob], `audio.${ext}`, { type: blob.type }))
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')
  formData.append('timestamp_granularities[]', 'word')
  if (language && language !== 'auto') formData.append('language', language)

  if (onTranscribeProgress) onTranscribeProgress(30)
  const apiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  })

  if (!apiRes.ok) {
    const errData = await apiRes.json().catch(() => ({}))
    throw new Error(`OpenAI API error ${apiRes.status}: ${errData?.error?.message || apiRes.statusText}`)
  }
  const data = await apiRes.json()
  if (onTranscribeProgress) onTranscribeProgress(100)

  const segments = (data.segments || []).map(seg => ({
    start: Number(seg.start) || 0,
    end: Number(seg.end) || 0,
    text: String(seg.text || '').trim(),
  })).filter(s => s.text)

  const wordTimestamps = (data.words || []).map(w => ({
    start: Number(w.start) || 0,
    end: Number(w.end) || 0,
    text: String(w.word || ''),
  }))

  return {
    text: String(data.text || '').trim(),
    segments,
    language: data.language || language || 'en',
    wordTimestamps,
  }
}

// ── Main transcribe function ───────────────────────────────────────────────

/**
 * Transcribe an audio file using Whisper.
 *
 * In Electron: delegates to whisper-transcribe.cjs running in the main process
 * (Node.js), which uses @xenova/transformers with RUNNING_LOCALLY=true — no
 * WASM, no CSP issues, no Invalid URL errors.
 *
 * In browser: runs @xenova/transformers directly in the renderer (fallback).
 *
 * @param {string} audioUrl
 * @param {{
 *   audioFilePath?: string,
 *   model?: string,
 *   selectedPreset?: string|null,
 *   engineIntent?: string|null,
 *   resolvedEngine?: string|null,
 *   language?: string,
 *   apiKey?: string,
 *   _retryCount?: number,
 *   onModelProgress?: (p: object) => void,
 *   onTranscribeProgress?: (pct: number) => void,
 *   wordTimestamps?: boolean,
 *   transcriptionMode?: string,
 *   openingSectionOnly?: boolean,
 *   sectionStartSec?: number|null,
 *   sectionEndSec?: number|null,
 *   localProOptions?: {
 *     profileId?: string,
 *     model?: string,
 *     useVocalIsolation?: boolean,
 *     beamSize?: number,
 *     vadFilter?: boolean,
 *     device?: string,
 *     computeType?: string,
 *     allowFallbackOnFailure?: boolean,
 *     languageMode?: string,
 *     language?: string,
 *     initialPrompt?: string,
 *   }|null,
 * }} [options]
 * @returns {Promise<WhisperResult>}
 */
export async function transcribe(audioUrl, options = {}) {
  const {
    audioFilePath,
    model = DEFAULT_WHISPER_MODEL,
    selectedPreset = null,
    engineIntent = null,
    resolvedEngine = null,
    language,
    onModelProgress,
    onTranscribeProgress,
    wordTimestamps = true,
    transcriptionMode = 'normal',
    openingSectionOnly = false,
    sectionStartSec = null,
    sectionEndSec = null,
    localProOptions = null,
    apiKey,
    _retryCount = 0,
  } = options

  // ── OpenAI cloud API path ─────────────────────────────────────────────────
  if (model === 'openai-api') {
    return transcribeViaOpenAI(audioUrl, apiKey, { language, onTranscribeProgress })
  }

  const ENGINE_SELECTION_MODELS = ['auto-best', 'whispercpp-medium', 'whispercpp-large']
  const isEngineSelectionModel = ENGINE_SELECTION_MODELS.includes(model)

  // ── Electron IPC path (runs in main/Node.js — no WASM, no CSP issues) ────
  // ONLY use IPC for large models that exceed browser WASM heap limits.
  // Small models work better in browser with @xenova/transformers + Web Audio API.
  const hasIPC = hasElectronIPC()
  const LARGE_MODELS = ['onnx-community/whisper-large-v3', 'onnx-community/whisper-large-v3-turbo', 'Xenova/whisper-medium']
  const isLargeModel = LARGE_MODELS.includes(model)
  const shouldUseIPC = hasIPC && (isLargeModel || isEngineSelectionModel)

  const isLocalProRuntime = String(selectedPreset || '').toLowerCase() === 'local-pro' && String(resolvedEngine || '').toLowerCase() === 'local-pro'
  const engineSelection = isLocalProRuntime
    ? 'local-pro'
    : (isEngineSelectionModel ? model : 'xenova')
  const desiredModel = model === 'whispercpp-large' ? 'large' : 'medium'
  const modelIdForIPC = isEngineSelectionModel ? 'Xenova/whisper-medium' : model
  
  console.log('[whisper] hasElectronIPC:', hasIPC, 'isLargeModel:', isLargeModel, 'shouldUseIPC:', shouldUseIPC)
  
  if (shouldUseIPC) {
    if (onTranscribeProgress) onTranscribeProgress(0)

    let unsub = null
    try {
      console.log('[whisper] Setting up progress listener...')
      unsub = window.smmDesktop.whisper.onProgress((prog) => {
        console.log('[whisper] Progress event:', prog.type)
        if (prog.type === 'model' && onModelProgress) {
          onModelProgress(prog)
        } else if (prog.type === 'inference' && onTranscribeProgress) {
          onTranscribeProgress(prog.progress || 0)
        } else if (prog.type === 'status' && onModelProgress) {
          onModelProgress({ status: 'initiate', file: prog.message })
        }
      })
      console.log('[whisper] Progress listener registered, calling IPC transcribe...')
    } catch (err) {
      console.error('[whisper] Error setting up listener:', err.message)
      throw err
    }

    try {
      console.log('[whisper] Invoking transcribe with:', { model, modelIdForIPC, engineSelection, audioUrl: audioUrl?.substring(0, 50), audioFilePath })
      const result = await window.smmDesktop.whisper.transcribe({
        audioUrl,
        audioFilePath: audioFilePath || null,
        selectedPreset,
        engineIntent,
        resolvedEngine,
        localProOptions,
        modelId: modelIdForIPC,
        engineSelection,
        desiredModel,
        language: language || null,
        wordTimestamps,
        transcriptionMode,
        openingSectionOnly,
        sectionStartSec,
        sectionEndSec,
      })
      console.log('[whisper] IPC returned:', result.ok ? 'success' : 'error', result.error)
      if (!result.ok) {
        const err = new Error(result.error || 'Transcription failed')
        
        // Smart retry: if Medium fails, try Small; if Large V3 fails, try Medium
        if (_retryCount < 2 && model === 'Xenova/whisper-medium') {
          console.warn('[whisper] Medium model failed, retrying with Small:', result.error)
          if (onModelProgress) onModelProgress({ status: 'initiate', file: 'Retrying with smaller model…' })
          return transcribe(audioUrl, {
            ...options,
            model: 'Xenova/whisper-small',
            _retryCount: _retryCount + 1,
          })
        }
        if (_retryCount < 2 && model.includes('large')) {
          console.warn('[whisper] Large model failed, retrying with Medium:', result.error)
          if (onModelProgress) onModelProgress({ status: 'initiate', file: 'Retrying with smaller model…' })
          return transcribe(audioUrl, {
            ...options,
            model: 'Xenova/whisper-medium',
            _retryCount: _retryCount + 1,
          })
        }
        
        throw err
      }
      if (onTranscribeProgress) onTranscribeProgress(100)
      const chunkSegments = /** @type {WhisperSegment[]} */ (result.chunks || [])
      return {
        text: result.text,
        segments: chunkSegments,
        language: result.language || language || 'en',
        wordTimestamps: Array.isArray(result.wordTimestamps) && result.wordTimestamps.length
          ? /** @type {WhisperSegment[]} */ (result.wordTimestamps)
          : expandSentencesToWords(chunkSegments),
        engine: result.engine || 'xenova',
        method: result.method || null,
        model: result.model || modelIdForIPC,
        selectedPreset: (/** @type {any} */ (result))?.selectedPreset || selectedPreset || null,
        resolvedEngine: result.engine || resolvedEngine || null,
        demucsUsed: !!result.demucsUsed,
        beamSize: Number.isFinite(result.beamSize) ? result.beamSize : null,
        vadFilter: typeof result.vadFilter === 'boolean' ? result.vadFilter : null,
        localProTimings: result.localProTimings || null,
        transcriptionDurationSec: Number.isFinite(result.transcriptionDurationSec) ? result.transcriptionDurationSec : null,
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        gaps: Array.isArray(result.gaps) ? result.gaps : [],
        containsGasoline: !!result.containsGasoline,
        containsFingers: !!result.containsFingers,
        containsMatch: !!result.containsMatch,
      }
    } catch (err) {
      console.error('[whisper] IPC transcribe failed:', err.message)
      throw err
    } finally {
      if (unsub) unsub()
    }
  }

  // ── Browser fallback: @xenova/transformers v2 in the renderer ───────────
  // MUST use @xenova/transformers v2 (NOT @huggingface/transformers v4).
  // The shared onnxruntime-web is 1.14.0 — v4 needs ORT 1.20+ and throws
  // qdq_actions.cc errors.  v2 was built for ORT 1.14 and is proven compatible.
  const { env } = await import('@xenova/transformers')
  configureBrowserTransformersEnv(env)

  // Block onnx-community models and medium in browser — they exceed ORT 1.14 WASM limits.
  // medium (~1.5 GB) throws ORT error code 6 (ORT_RUNTIME_EXCEPTION / OOM) in WASM.
  // onnx-community/* models require ORT 1.20+ ops not available in ORT 1.14.
  // All these work via the Electron IPC path above (Node.js, no WASM heap limit).
  const BROWSER_BLOCKED_MODELS = ['onnx-community/', 'Xenova/whisper-medium']
  const isBlocked = isEngineSelectionModel || BROWSER_BLOCKED_MODELS.some(prefix => model.startsWith(prefix))
  if (isBlocked) {
    throw new Error(
      `The "${model}" model cannot run in the browser preview — it exceeds the WebAssembly memory limit or requires a newer runtime. ` +
      'Please use Tiny, Base, or Small. For Medium/Large accuracy, use the Electron desktop app.'
    )
  }

  // Only disable threading if SharedArrayBuffer is unavailable.
  // With COOP/COEP headers set in vite.config.js (credentialless), SharedArrayBuffer
  // should be available and ONNX can use all CPU threads.
  try {
    if (env.backends?.onnx?.wasm && typeof SharedArrayBuffer === 'undefined') {
      env.backends.onnx.wasm.numThreads = 1
    }
  } catch { /* env not available in this build variant — ignore */ }

  if (onTranscribeProgress) onTranscribeProgress(0)

  // NOTE: pipeline() includes the full model download. Large models take time:
  //   Tiny (~75 MB)  → ~10s on fast broadband
  //   Small (~480 MB) → ~1–5 min
  //   Large Turbo (~809 MB) → ~2–10 min
  //   Large V3 (~3 GB) → ~10–40 min
  // Timeout is set to 45 minutes — enough for the largest model on slow internet.
  // The user can always click Cancel to abort early.
  const PIPELINE_TIMEOUT_MS = 45 * 60 * 1000
  const pipelineAbort = new AbortController()
  const pipelineTimeout = setTimeout(() => pipelineAbort.abort(), PIPELINE_TIMEOUT_MS)

  let pipe
  try {
    pipe = await Promise.race([
      loadWhisperPipeline(model, { onModelProgress }),
      new Promise((_, reject) =>
        pipelineAbort.signal.addEventListener('abort', () =>
          reject(new Error('Model load timed out (45 min). Check your internet connection and try again, or choose a smaller model.'))
        )
      ),
    ])
  } finally {
    clearTimeout(pipelineTimeout)
  }

  if (onTranscribeProgress) onTranscribeProgress(10)

  // ── Inference via URL input — the only way chunk_length_s is respected ─────
  //
  // @xenova/transformers v2 ignores chunk_length_s when input is a Float32Array.
  // It only applies chunking when the input is a URL (string).  Passing a URL
  // also lets the library handle stereo→mono mixing internally (same approach
  // as our manual AudioContext decode, but integrated).
  //
  // audioUrl in browser mode is always a blob: URL from URL.createObjectURL(file).
  // fetch() and @xenova/transformers both support blob: URLs in the browser.

  /** Hallucination patterns — non-speech tokens Whisper emits for music/silence */
  const HALLUCINATION_RE = /^\s*(\[.*?\]|\(.*?\)|♪+|♫+|-{3,}|\.{3,}|thank you\.?|thanks\.?|you\.?)\s*$/i

  let chunksDone = 0
  let pipeOutput
  try {
    pipeOutput = await pipe(audioUrl, {
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      language: language || undefined,
      callback_function: () => {
        chunksDone++
        if (onTranscribeProgress) onTranscribeProgress(Math.min(90, 10 + chunksDone * 6))
      },
    })
  } catch (inferErr) {
    throw new Error(`Transcription failed: ${inferErr?.message || inferErr}. Try a different file or model.`)
  }

  if (onTranscribeProgress) onTranscribeProgress(100)

  const outObj  = Array.isArray(pipeOutput) ? (pipeOutput[0] ?? {}) : (pipeOutput ?? {})
  const fullText = String(outObj.text ?? '').trim()
  const detectedLanguage = outObj.language || language || 'en'

  // Build segments from chunks — filter hallucinations, guard null timestamps
  const rawChunks = Array.isArray(outObj.chunks) ? outObj.chunks : []
  let maxEnd = 0
  const allRaw = []
  for (const c of rawChunks) {
    const text = String(c?.text ?? '').trim()
    if (!text || HALLUCINATION_RE.test(text)) continue
    const ts    = Array.isArray(c?.timestamp) ? c.timestamp : []
    const start = typeof ts[0] === 'number' && ts[0] >= 0 ? ts[0] : 0
    const end   = typeof ts[1] === 'number' && ts[1] > start ? ts[1] : start + 4
    maxEnd = Math.max(maxEnd, end)
    allRaw.push({ start, end, text })
  }

  // Time-proximity dedup — the library removes stride overlap but we add an
  // extra pass to handle any remaining duplicates and preserve chorus repetitions
  // (same lyric at 45s and 96s should produce TWO pages, not one).
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

  // Absolute fallback — no timed chunks returned at all (some model/OS combos
  // return text but no chunks when running in single-thread WASM mode)
  if (segments.length === 0 && fullText) {
    const WORDS_PER_PAGE = 8
    const words = fullText.split(/\s+/).filter(Boolean)
    const secPerWord = maxEnd > 0 ? maxEnd / Math.max(words.length, 1) : 0.5
    for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
      const group = words.slice(i, i + WORDS_PER_PAGE)
      segments.push({
        start: Math.round(i * secPerWord * 100) / 100,
        end:   Math.round((i + group.length) * secPerWord * 100) / 100,
        text:  group.join(' '),
      })
    }
  }

  return {
    text: fullText,
    segments,
    language: detectedLanguage,
    wordTimestamps: expandSentencesToWords(segments),
    selectedPreset,
    resolvedEngine: 'xenova-browser',
  }
}

/**
 * Expand sentence-level Whisper chunks into word-sized pseudo-segments
 * with linearly interpolated timing.
 *
 * segmentsToLyricLines is designed for word-level input. When Whisper returns
 * sentence-level chunks (one chunk per sentence, 5-30 words each), we must
 * split each sentence into its individual words and distribute the sentence's
 * time range evenly across those words. This gives segmentsToLyricLines the
 * fine-grained timing it needs to create proper multi-line lyric pages.
 *
 * @param {{ start: number, end: number, text: string }[]} sentenceChunks
 * @returns {{ start: number, end: number, text: string }[]}
 */
export function expandSentencesToWords(sentenceChunks) {
  const wordSegs = []
  for (const chunk of sentenceChunks) {
    const text = chunk.text.trim()
    if (!text) continue
    const words = text.split(/\s+/).filter(Boolean)
    if (!words.length) continue
    const chunkStart = (typeof chunk.start === 'number' && isFinite(chunk.start)) ? chunk.start : 0
    const chunkEnd = (typeof chunk.end === 'number' && isFinite(chunk.end)) ? chunk.end : chunkStart + 4
    const sentDuration = Math.max(0.1, chunkEnd - chunkStart)
    const secPerWord = sentDuration / words.length
    words.forEach((word, i) => {
      wordSegs.push({
        start: chunkStart + i * secPerWord,
        end: chunkStart + (i + 1) * secPerWord,
        text: (i === 0 ? '' : ' ') + word,
      })
    })
  }
  return wordSegs
}

function normalizeLyricWordText(text) {
  return String(text || '').replace(/^\s+/, '')
}

function joinLyricWords(words) {
  return words
    .map((word, index) => {
      const text = normalizeLyricWordText(word?.text)
      if (!text) return ''
      if (index === 0) return text
      return text
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([,.:;!?…])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSentencePunctuation(wordText) {
  return /[,.!?;:…]$/.test(normalizeLyricWordText(wordText))
}

function startsWithCapital(wordText) {
  const text = normalizeLyricWordText(wordText)
  return /^[A-Z]/.test(text)
}

/**
 * Convert word timestamps into lyric-aware lines using pause, punctuation, duration,
 * and capitalization heuristics.
 *
 * @param {{start:number,end:number,text:string}[]} words
 * @param {{ maxChars?: number, maxDurationSec?: number, pauseBreakSec?: number, strongPauseBreakSec?: number, minWordsPerLine?: number }} [options]
 * @returns {{ start: number, end: number, text: string, durationMs: number }[]}
 */
export function buildLyricLinesFromWords(words, options = {}) {
  const {
    maxChars = 42,
    maxDurationSec = 4.5,
    pauseBreakSec = 0.55,
    strongPauseBreakSec = 0.9,
    minWordsPerLine = 2,
  } = options

  const orderedWords = (Array.isArray(words) ? words : [])
    .map((word) => ({
      start: Number(word?.start),
      end: Number(word?.end),
      text: normalizeLyricWordText(word?.text),
    }))
    .filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end) && word.text)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  if (!orderedWords.length) return []

  const lines = []
  let current = []

  const flushCurrent = () => {
    if (!current.length) return
    const text = joinLyricWords(current)
    if (!text) {
      current = []
      return
    }
    const start = current[0].start
    const end = current[current.length - 1].end
    lines.push({
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
      text,
      durationMs: Math.round((end - start) * 1000),
    })
    current = []
  }

  const lineDurationSec = () => {
    if (!current.length) return 0
    return current[current.length - 1].end - current[0].start
  }

  const lineTextLength = () => joinLyricWords(current).length

  for (let i = 0; i < orderedWords.length; i += 1) {
    const word = orderedWords[i]
    const prev = current[current.length - 1]
    const pause = prev ? (word.start - prev.end) : 0
    const strongPause = pause >= strongPauseBreakSec
    const shouldProtectShortPhrase = current.length > 0 && current.length < minWordsPerLine && !strongPause

    if (prev && !shouldProtectShortPhrase) {
      const breakForPause = pause > pauseBreakSec
      const breakForPunctuation = isSentencePunctuation(prev.text)
      const breakForDuration = lineDurationSec() >= maxDurationSec
      const breakForLength = lineTextLength() >= maxChars
      const breakForCapital = startsWithCapital(word.text) && current.length >= 4

      if (strongPause || breakForPause || breakForPunctuation || breakForDuration || breakForLength || breakForCapital) {
        flushCurrent()
      }
    }

    current.push(word)

    if (current.length >= minWordsPerLine) {
      const durationAfterAdd = lineDurationSec()
      const textAfterAdd = lineTextLength()
      if (durationAfterAdd >= maxDurationSec || textAfterAdd >= maxChars) {
        const next = orderedWords[i + 1]
        const nextPause = next ? (next.start - word.end) : 0
        const nextStrongPause = nextPause >= strongPauseBreakSec
        if (!next || nextStrongPause) {
          flushCurrent()
        }
      }
    }
  }

  flushCurrent()
  return lines
}

/**
 * Generate word-level timestamps from line-level timing.
 * Used when user provides pasted lyrics that have been aligned to audio.
 * Interpolates timing within each line to assign word-level start/end.
 * 
 * @param {string} text - The lyric line text
 * @param {number} lineStart - Line start time in seconds
 * @param {number} lineEnd - Line end time in seconds  
 * @returns {{ start: number, end: number, text: string }[]}
 */
export function generateWordTimestamps(text, lineStart, lineEnd) {
  const words = (text || '').split(/\s+/).filter(Boolean)
  if (!words.length) return []
  
  const lineDuration = Math.max(0.1, lineEnd - lineStart)
  const secPerWord = lineDuration / words.length
  
  return words.map((word, i) => ({
    start: lineStart + i * secPerWord,
    end: lineStart + (i + 1) * secPerWord,
    text: (i === 0 ? '' : ' ') + word,
  }))
}

/**
 * Abort any running transcription.
 */
export function abortTranscription() {
  if (hasElectronIPC()) {
    window.smmDesktop.whisper.cancel().catch(() => {})
  }
}

/**
 * Clear a cached Whisper model and release any loaded renderer pipeline.
 * In Electron, deletion is delegated to the main process model cache.
 * In browser preview, Transformers.js owns the persistent browser cache, so
 * this releases the in-memory pipeline for the current session.
 *
 * @param {string} [modelId]
 * @returns {Promise<{ ok: boolean, error?: string, dir?: string }>}
 */
export async function clearWhisperCache(modelId = DEFAULT_WHISPER_MODEL) {
  _browserPipeline = null
  _browserPipelineModel = null

  if (hasElectronIPC() && typeof window.smmDesktop.whisper.clearModel === 'function') {
    return window.smmDesktop.whisper.clearModel({ modelId })
  }

  return { ok: true }
}

/**
 * Preload and return a browser Whisper pipeline.
 * Electron transcription runs in the main process, so this reports the model
 * cache status there instead of creating a renderer pipeline.
 *
 * @param {string} [modelId]
 * @param {{ onModelProgress?: (p: object) => void }} [options]
 * @returns {Promise<unknown>}
 */
export async function loadWhisperPipeline(modelId = DEFAULT_WHISPER_MODEL, options = {}) {
  if (hasElectronIPC()) {
    if (typeof window.smmDesktop.whisper.modelStatus === 'function') {
      return window.smmDesktop.whisper.modelStatus({ modelId })
    }
    return { allCached: false, modelId }
  }

  const BROWSER_BLOCKED_MODELS = ['onnx-community/', 'Xenova/whisper-medium']
  if (BROWSER_BLOCKED_MODELS.some(prefix => modelId.startsWith(prefix))) {
    throw new Error(
      `The "${modelId}" model cannot run in the browser preview. Use Tiny, Base, or Small, or use the Electron desktop app.`
    )
  }

  if (_browserPipeline && _browserPipelineModel === modelId) return _browserPipeline

  const { pipeline, env } = await import('@xenova/transformers')
  configureBrowserTransformersEnv(env)

  try {
    if (env.backends?.onnx?.wasm && typeof SharedArrayBuffer === 'undefined') {
      env.backends.onnx.wasm.numThreads = 1
    }
  } catch { /* env not available in this build variant — ignore */ }

  _browserPipeline = await pipeline('automatic-speech-recognition', modelId, {
    quantized: true,
    progress_callback: options.onModelProgress || null,
  })
  _browserPipelineModel = modelId
  return _browserPipeline
}

// ── SRT export helper ──────────────────────────────────────────────────────

/**
 * Convert Whisper segments to SRT subtitle format.
 * @param {WhisperSegment[]} segments
 * @returns {string}
 */
/**
 * Convert Whisper segments to SRT subtitle format.
 * @param {WhisperSegment[]} segments
 * @returns {string}
 */
export function segmentsToSrt(segments) {
  return segments
    .map((seg, i) => {
      const fmt = (s) => {
        const ms = Math.round((s % 1) * 1000)
        const secs = Math.floor(s % 60)
        const mins = Math.floor((s / 60) % 60)
        const hrs = Math.floor(s / 3600)
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
      }
      return `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.text.trim()}\n`
    })
    .join('\n')
}

/**
 * Split long transcript into lyric-style lines based on Whisper word timestamps.
 * Groups words into chunks using the lyric-aware word builder.
 *
 * @param {WhisperSegment[]} segments - Word-level or sentence-level segments from Whisper
 * @param {{ maxChars?: number, maxDurationSec?: number, pauseBreakSec?: number, strongPauseBreakSec?: number, minWordsPerLine?: number }} [options]
 * @returns {{ start: number, end: number, text: string, durationMs: number }[]}
 */
export function segmentsToLyricLines(segments, options = {}) {
  return buildLyricLinesFromWords(expandSentencesToWords(segments), {
    maxChars: options.maxChars ?? 42,
    maxDurationSec: options.maxDurationSec ?? 4.5,
    pauseBreakSec: options.pauseBreakSec ?? 0.55,
    strongPauseBreakSec: options.strongPauseBreakSec ?? 0.9,
    minWordsPerLine: options.minWordsPerLine ?? 2,
  })
}
