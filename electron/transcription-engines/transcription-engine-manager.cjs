const path = require('path')
const { findWhisperCppAssets, transcribeWithWhisperCpp } = require('./whispercpp-engine.cjs')
const { detectLocalProTools } = require('./local-pro-tools.cjs')
const { transcribeWithFasterWhisper } = require('./faster-whisper-engine.cjs')
const { isolateVocalsDemucs } = require('./demucs-engine.cjs')

const LOCAL_PRO_PROFILES = {
  fast: {
    id: 'fast',
    label: 'Fast',
    model: 'small',
    beamSize: 3,
    vadFilter: true,
    computeType: 'int8',
    estimatedRuntime: 'Fastest turnaround. Best for rough drafts.',
    estimatedRam: '4-6 GB RAM',
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    model: 'medium',
    beamSize: 5,
    vadFilter: true,
    computeType: 'int8',
    estimatedRuntime: 'Recommended default quality/speed balance.',
    estimatedRam: '6-10 GB RAM',
  },
  pro: {
    id: 'pro',
    label: 'Pro Heavy',
    model: 'large-v3',
    beamSize: 5,
    vadFilter: true,
    computeType: 'int8_float16',
    estimatedRuntime: 'High quality, longest runtime.',
    estimatedRam: '12-18 GB RAM',
    heavyRisk: true,
  },
  gpu: {
    id: 'gpu',
    label: 'Experimental GPU',
    model: 'large-v3',
    beamSize: 5,
    vadFilter: true,
    computeType: 'float16',
    device: 'cuda',
    estimatedRuntime: 'Requires compatible NVIDIA CUDA stack.',
    estimatedRam: '8+ GB VRAM recommended',
    heavyRisk: true,
    experimental: true,
  },
}

function resolveLocalProProfile(options = {}) {
  const id = String(options?.profileId || 'balanced').toLowerCase()
  return LOCAL_PRO_PROFILES[id] || LOCAL_PRO_PROFILES.balanced
}

function normalizeWords(chunks) {
  const out = []
  for (const seg of chunks || []) {
    const text = String(seg?.text || '').trim()
    if (!text) continue
    const words = text.split(/\s+/).filter(Boolean)
    if (!words.length) continue
    const start = Number.isFinite(seg.start) ? seg.start : 0
    const end = Number.isFinite(seg.end) && seg.end > start ? seg.end : start + 0.5
    const span = Math.max(0.1, end - start)
    const step = span / words.length
    for (let i = 0; i < words.length; i += 1) {
      out.push({
        start: Math.round((start + i * step) * 1000) / 1000,
        end: Math.round((start + (i + 1) * step) * 1000) / 1000,
        text: i === 0 ? words[i] : ` ${words[i]}`,
      })
    }
  }
  return out
}

function assessTranscriptQuality(result) {
  const chunks = Array.isArray(result?.chunks) ? result.chunks : []
  const first = chunks.find((c) => Number.isFinite(c?.start) && String(c?.text || '').trim())
  const firstStart = Number.isFinite(first?.start) ? first.start : Number.POSITIVE_INFINITY
  const text = String(result?.text || '').trim()
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0
  const poor = firstStart > 20 || wordCount < 24 || chunks.length < 6
  const reasons = []
  if (firstStart > 20) reasons.push(`first lyric starts late (${firstStart.toFixed(2)}s)`)
  if (wordCount < 24) reasons.push(`low word count (${wordCount})`)
  if (chunks.length < 6) reasons.push(`low segment count (${chunks.length})`)
  return { poor, reasons, firstStart, wordCount, segmentCount: chunks.length }
}

function computeGaps(chunks, minGapSec = 8) {
  const sorted = [...(chunks || [])]
    .filter((seg) => Number.isFinite(seg?.start) && Number.isFinite(seg?.end))
    .sort((a, b) => a.start - b.start)
  const out = []
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]
    const next = sorted[i]
    const gap = next.start - prev.end
    if (gap > minGapSec) {
      out.push({ start: prev.end, end: next.start, gapSec: Math.round(gap * 1000) / 1000 })
    }
  }
  return out
}

function hasTerm(text, chunks, term) {
  const re = new RegExp(`\\b${term}\\b`, 'i')
  if (re.test(String(text || ''))) return true
  return (chunks || []).some((seg) => re.test(String(seg?.text || '')))
}

function toLocalProLanguage(options = {}) {
  const languageMode = options?.languageMode === 'manual' ? 'manual' : 'auto'
  const language = String(options?.language || '').trim()
  if (languageMode !== 'manual') return 'auto'
  return language || 'auto'
}

async function runLocalProTranscription({ repoRoot, payload }) {
  const send = typeof payload?.sendProgress === 'function' ? payload.sendProgress : () => {}
  const localProOptions = payload?.localProOptions || {}
  const profile = resolveLocalProProfile(localProOptions)
  const model = String(localProOptions?.model || profile.model || 'medium')
  const beamSize = Number.isFinite(localProOptions?.beamSize)
    ? Math.max(1, Math.min(10, localProOptions.beamSize))
    : Number(profile.beamSize || 5)
  const vadFilter = typeof localProOptions?.vadFilter === 'boolean'
    ? localProOptions.vadFilter
    : profile.vadFilter !== false
  const useVocalIsolation = !!localProOptions?.useVocalIsolation
  const initialPrompt = String(localProOptions?.initialPrompt || '')
  const language = toLocalProLanguage(localProOptions)
  const allowFallbackOnFailure = localProOptions?.allowFallbackOnFailure === true
  const device = String(localProOptions?.device || profile.device || 'cpu').toLowerCase()
  const computeType = String(localProOptions?.computeType || profile.computeType || 'int8').toLowerCase()
  const timeoutMs = Number.isFinite(localProOptions?.timeoutMs)
    ? Math.max(90 * 1000, Number(localProOptions.timeoutMs))
    : (model.includes('large') ? 8 * 60 * 1000 : 15 * 60 * 1000)

  send({ type: 'status', message: `Local Pro profile: ${profile.label} (${model}).` })

  const inputAudioPath = payload?.audioFilePath
  if (!inputAudioPath) {
    return {
      ok: false,
      error: 'Local Pro requires a local audio file path. Re-select the audio from disk first.',
    }
  }

  send({ type: 'status', message: 'Local Pro: preparing audio…' })
  const demucsResult = await isolateVocalsDemucs({
    repoRoot,
    audioPath: inputAudioPath,
    enabled: useVocalIsolation,
    onProgress: (prog) => {
      const msg = String(prog?.message || '').trim()
      if (msg) send({ type: 'status', message: `Local Pro Demucs: ${msg}` })
    },
  })

  const demucsWarnings = []
  const demucsDiagnostics = demucsResult?.diagnostics || null
  const audioForTranscription = demucsResult.ok && demucsResult.vocalPath
    ? demucsResult.vocalPath
    : inputAudioPath
  if (!demucsResult.ok && useVocalIsolation) {
    demucsWarnings.push(`Demucs failed; continuing without vocal isolation: ${demucsResult.error || 'unknown error'}`)
    send({ type: 'status', message: 'Local Pro: Demucs unavailable, continuing with original audio…' })
  }
  send({ type: 'status', message: 'Local Pro: running Faster-Whisper…' })
  const fwResult = await transcribeWithFasterWhisper({
    repoRoot,
    audioPath: audioForTranscription,
    model,
    language,
    wordTimestamps: true,
    beamSize,
    vadFilter,
    initialPrompt,
    timeoutMs,
    device,
    computeType,
    onProgress: (event) => {
      if (!event || typeof event !== 'object') return
      if (event.stage === 'heartbeat') {
        send({ type: 'status', message: `Local Pro: transcribing... ${event.elapsedSec || 0}s elapsed (${event.timeoutRemainingSec || 0}s left before timeout)` })
        return
      }
      const msg = String(event.message || '').trim()
      if (msg) send({ type: 'status', message: `Local Pro: ${msg}` })
    },
  })

  if (demucsResult.cleanup) {
    await demucsResult.cleanup()
  }

  if (!fwResult.ok) {
    return {
      ok: false,
      canceled: fwResult.canceled === true,
      fallbackAllowed: allowFallbackOnFailure,
      error: fwResult.error || 'Faster-Whisper failed.',
      diagnostics: {
        demucs: demucsDiagnostics,
        fasterWhisper: fwResult.diagnostics || null,
      },
    }
  }

  const words = Array.isArray(fwResult.wordTimestamps) ? fwResult.wordTimestamps : []
  return {
    ok: true,
    text: fwResult.text,
    chunks: fwResult.chunks,
    wordTimestamps: words,
    language: fwResult.language || (language === 'auto' ? 'en' : language),
    engine: 'local-pro',
    method: demucsResult.used ? 'local-pro-demucs+faster-whisper' : 'local-pro-faster-whisper',
    model,
    localProProfile: profile.id,
    demucsUsed: !!demucsResult.used,
    beamSize,
    vadFilter,
    device,
    computeType,
    fallbackAllowed: allowFallbackOnFailure,
    localProLanguage: language,
    warnings: demucsWarnings,
    localProTimings: fwResult.timings || null,
    transcriptionDurationSec: fwResult.transcriptionDurationSec || null,
    diagnostics: {
      demucs: demucsDiagnostics,
      fasterWhisper: fwResult.diagnostics || null,
    },
  }
}

function createTranscriptionEngineManager({ repoRoot, ffmpegPath = null, runXenova }) {
  if (typeof runXenova !== 'function') {
    throw new Error('createTranscriptionEngineManager requires runXenova callback')
  }

  async function getEngineStatus() {
    const whisperCpp = await findWhisperCppAssets(repoRoot)
    const localPro = await detectLocalProTools(repoRoot)
    return {
      defaultEngine: 'xenova',
      availableEngines: [
        { id: 'xenova', available: true, label: 'Xenova Medium' },
        {
          id: 'local-pro',
          available: !!localPro.runtimeEnabled,
          foundationAvailable: !!localPro.foundationAvailable,
          runtimeEnabled: !!localPro.runtimeEnabled,
          label: localPro.runtimeEnabled
            ? 'Local Pro (runtime ready)'
            : (localPro.setupState === 'Available' ? 'Local Pro (foundation ready)' : 'Local Pro (setup required)'),
          setupState: localPro.setupState,
          setupHint: localPro.setupHint,
          gpu: localPro.gpu || null,
          profiles: Object.values(LOCAL_PRO_PROFILES),
          python: localPro.python,
          pip: localPro.pip,
          fasterWhisper: localPro.fasterWhisper,
          demucs: localPro.demucs,
          localProVenv: localPro.localProVenv,
          whisperCpp: localPro.whisperCpp,
          models: localPro.models,
        },
        {
          id: 'whisper.cpp',
          available: whisperCpp.available,
          label: whisperCpp.available ? 'whisper.cpp' : 'whisper.cpp (not installed)',
          executablePath: whisperCpp.executablePath,
          modelCandidates: whisperCpp.modelCandidates,
          searchRoots: whisperCpp.roots,
        },
        { id: 'openai', available: true, label: 'OpenAI Whisper API (renderer path)' },
      ],
    }
  }

  async function transcribe({ event, payload }) {
    const selection = String(payload?.engineSelection || 'auto-best').toLowerCase()
    const desiredModel = String(payload?.desiredModel || '').toLowerCase().includes('large') ? 'large' : 'medium'

    console.log('[transcription-manager] request', {
      selection,
      selectedPreset: payload?.selectedPreset || null,
      resolvedEngine: payload?.resolvedEngine || null,
      audioFilePath: payload?.audioFilePath || null,
    })

    const localProRequested = selection === 'local-pro'
      || String(payload?.resolvedEngine || '').toLowerCase() === 'local-pro'
      || String(payload?.selectedPreset || '').toLowerCase() === 'local-pro'

    if (localProRequested) {
      console.log('[transcription-manager] local-pro requested', {
        selectedPreset: payload?.selectedPreset || null,
        resolvedEngine: payload?.resolvedEngine || null,
        audioFilePath: payload?.audioFilePath || null,
      })
      const status = await detectLocalProTools(repoRoot)
      if (!status.runtimeEnabled) {
        const allowFallback = payload?.localProOptions?.allowFallbackOnFailure === true
        if (!allowFallback) {
          return {
            ok: false,
            engine: 'local-pro',
            error: `Local Pro inactive: ${status.setupState}. ${status.setupHint}`,
            warnings: [],
          }
        }

        const fallback = await runXenova(event, payload)
        return {
          ...fallback,
          engine: 'xenova',
          warnings: [
            ...(Array.isArray(fallback?.warnings) ? fallback.warnings : []),
            `Local Pro inactive: ${status.setupState}. ${status.setupHint}`,
          ],
        }
      }

      const localPro = await runLocalProTranscription({
        repoRoot,
        payload: {
          ...payload,
          sendProgress: (data) => {
            try { event?.sender?.send('whisper:progress', data) } catch {}
          },
        },
      })
      if (localPro.ok) {
        return {
          text: localPro.text,
          chunks: localPro.chunks,
          language: localPro.language,
          wordTimestamps: localPro.wordTimestamps,
          engine: 'local-pro',
          method: localPro.method,
          model: localPro.model,
          localProProfile: localPro.localProProfile || null,
          warnings: localPro.warnings || [],
          quality: assessTranscriptQuality(localPro),
          demucsUsed: !!localPro.demucsUsed,
          beamSize: localPro.beamSize,
          vadFilter: localPro.vadFilter,
          device: localPro.device || null,
          computeType: localPro.computeType || null,
          fallbackAllowed: localPro.fallbackAllowed === true,
          localProLanguage: localPro.localProLanguage,
          localProTimings: localPro.localProTimings,
          transcriptionDurationSec: localPro.transcriptionDurationSec,
          diagnostics: localPro.diagnostics || null,
        }
      }

      if (localPro.canceled) {
        return {
          ok: false,
          engine: 'local-pro',
          error: 'Local Pro transcription canceled.',
          warnings: [],
          diagnostics: localPro.diagnostics || null,
        }
      }

      if (localPro.fallbackAllowed !== true) {
        return {
          ok: false,
          engine: 'local-pro',
          error: localPro.error || 'Local Pro failed.',
          warnings: [],
          diagnostics: localPro.diagnostics || null,
        }
      }

      const fallback = await runXenova(event, payload)
      return {
        ...fallback,
        engine: 'xenova',
        warnings: [
          ...(Array.isArray(fallback?.warnings) ? fallback.warnings : []),
          `Local Pro failed: ${localPro.error || 'unknown error'}. Falling back to Compatibility/Xenova.`,
        ],
      }
    }

    const xenovaRes = await runXenova(event, payload)
    const quality = assessTranscriptQuality(xenovaRes)
    const out = {
      ...xenovaRes,
      engine: 'xenova',
      warnings: Array.isArray(xenovaRes?.warnings) ? [...xenovaRes.warnings] : [],
      quality,
    }

    const shouldTryWhisperCpp = selection === 'whispercpp-medium' || selection === 'whispercpp-large' || (selection === 'auto-best' && quality.poor)
    if (!shouldTryWhisperCpp) {
      if (quality.poor) {
        out.warnings.push(`Transcript may be incomplete: ${quality.reasons.join('; ')}`)
      }
      return out
    }

    const whisperCpp = await transcribeWithWhisperCpp({
      repoRoot,
      audioPath: payload?.audioFilePath,
      language: payload?.language,
      desiredModel: selection === 'whispercpp-large' ? 'large' : desiredModel,
      ffmpegPath,
    })

    if (!whisperCpp.ok) {
      out.warnings.push(whisperCpp.error || 'whisper.cpp unavailable; using Xenova result')
      if (quality.poor) {
        out.warnings.push(`Xenova quality warning: ${quality.reasons.join('; ')}`)
      }
      return out
    }

    const cppQuality = assessTranscriptQuality(whisperCpp)
    const xenovaScore = quality.firstStart + Math.max(0, 40 - quality.wordCount)
    const cppScore = cppQuality.firstStart + Math.max(0, 40 - cppQuality.wordCount)
    const preferCpp = selection.startsWith('whispercpp') || cppScore < xenovaScore

    if (!preferCpp) {
      out.warnings.push('whisper.cpp ran but Xenova result scored better; keeping Xenova output')
      return out
    }

    return {
      text: whisperCpp.text,
      chunks: whisperCpp.chunks,
      language: payload?.language || xenovaRes.language || 'en',
      wordTimestamps: Array.isArray(whisperCpp.wordTimestamps) && whisperCpp.wordTimestamps.length
        ? whisperCpp.wordTimestamps
        : normalizeWords(whisperCpp.chunks),
      engine: 'whisper.cpp',
      modelPath: whisperCpp.modelPath,
      warnings: whisperCpp.warnings || [],
      quality: cppQuality,
    }
  }

  async function buildDebugPayload({ payload, output }) {
    const chunks = Array.isArray(output?.chunks) ? output.chunks : []
    const words = Array.isArray(output?.wordTimestamps) ? output.wordTimestamps : []
    const text = output?.text || ''
    const gaps = Array.isArray(output?.gaps) ? output.gaps : computeGaps(chunks, 8)
    const containsGasoline = typeof output?.containsGasoline === 'boolean' ? output.containsGasoline : hasTerm(text, chunks, 'gasoline')
    const containsFingers = typeof output?.containsFingers === 'boolean' ? output.containsFingers : hasTerm(text, chunks, 'fingers')
    const containsMatch = typeof output?.containsMatch === 'boolean' ? output.containsMatch : hasTerm(text, chunks, 'match')
    return {
      engine: output?.engine || 'xenova',
      selectedPreset: payload?.selectedPreset || null,
      requestedEngine: payload?.engineSelection || null,
      engineIntent: payload?.engineIntent || null,
      resolvedEngine: output?.engine || payload?.resolvedEngine || null,
      desiredModel: payload?.desiredModel || null,
      transcriptionMode: payload?.transcriptionMode || 'normal',
      openingSectionOnly: !!payload?.openingSectionOnly,
      sectionStartSec: Number.isFinite(payload?.sectionStartSec) ? payload.sectionStartSec : null,
      sectionEndSec: Number.isFinite(payload?.sectionEndSec) ? payload.sectionEndSec : null,
      method: output?.method || null,
      modelPath: output?.modelPath || null,
      audioFile: payload?.audioFilePath || payload?.audioUrl || null,
      fullTextPreview: String(text).slice(0, 1000),
      fullText: output?.text || '',
      chunks,
      wordTimestamps: words,
      lyricLines: Array.isArray(output?.lyricLines) ? output.lyricLines : [],
      gaps,
      warnings: Array.isArray(output?.warnings) ? output.warnings : [],
      model: output?.model || payload?.localProOptions?.model || payload?.modelId || null,
      demucsUsed: !!output?.demucsUsed,
      beamSize: Number.isFinite(output?.beamSize) ? output.beamSize : (Number.isFinite(payload?.localProOptions?.beamSize) ? payload.localProOptions.beamSize : null),
      vadFilter: typeof output?.vadFilter === 'boolean' ? output.vadFilter : (typeof payload?.localProOptions?.vadFilter === 'boolean' ? payload.localProOptions.vadFilter : null),
      language: output?.language || payload?.language || payload?.localProOptions?.language || null,
      chunkCount: chunks.length,
      wordCount: words.length,
      timings: output?.localProTimings || null,
      transcriptionDurationSec: output?.transcriptionDurationSec || null,
      firstTenWords: words.slice(0, 10),
      containsGasoline,
      containsFingers,
      containsMatch,
      firstTenChunks: chunks.slice(0, 10),
      firstSegment: chunks[0] || null,
      firstFiveSegments: chunks.slice(0, 5),
      quality: output?.quality || null,
      createdAt: new Date().toISOString(),
    }
  }

  return {
    getEngineStatus,
    transcribe,
    buildDebugPayload,
  }
}

module.exports = { createTranscriptionEngineManager }
