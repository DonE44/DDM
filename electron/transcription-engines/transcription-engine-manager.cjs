const path = require('path')
const { findWhisperCppAssets, transcribeWithWhisperCpp } = require('./whispercpp-engine.cjs')

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

function createTranscriptionEngineManager({ repoRoot, ffmpegPath = null, runXenova }) {
  if (typeof runXenova !== 'function') {
    throw new Error('createTranscriptionEngineManager requires runXenova callback')
  }

  async function getEngineStatus() {
    const whisperCpp = await findWhisperCppAssets(repoRoot)
    return {
      defaultEngine: 'xenova',
      availableEngines: [
        { id: 'xenova', available: true, label: 'Xenova Medium' },
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
    const text = output?.text || ''
    const gaps = Array.isArray(output?.gaps) ? output.gaps : computeGaps(chunks, 8)
    const containsGasoline = typeof output?.containsGasoline === 'boolean' ? output.containsGasoline : hasTerm(text, chunks, 'gasoline')
    const containsFingers = typeof output?.containsFingers === 'boolean' ? output.containsFingers : hasTerm(text, chunks, 'fingers')
    const containsMatch = typeof output?.containsMatch === 'boolean' ? output.containsMatch : hasTerm(text, chunks, 'match')
    return {
      engine: output?.engine || 'xenova',
      method: output?.method || null,
      model: output?.model || payload?.modelId || null,
      modelPath: output?.modelPath || null,
      audioFile: payload?.audioFilePath || payload?.audioUrl || null,
      fullTextPreview: String(text).slice(0, 1000),
      fullText: output?.text || '',
      chunks,
      wordTimestamps: Array.isArray(output?.wordTimestamps) ? output.wordTimestamps : [],
      lyricLines: Array.isArray(output?.lyricLines) ? output.lyricLines : [],
      gaps,
      warnings: Array.isArray(output?.warnings) ? output.warnings : [],
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
