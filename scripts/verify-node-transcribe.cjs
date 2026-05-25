const os = require('os')
const path = require('path')
const decode = require('../electron/audio-decode.cjs')
const { runXenovaFloat32 } = require('../electron/transcription-engines/xenova-engine.cjs')

function normalize(out) {
  const obj = Array.isArray(out) ? (out[0] || {}) : (out || {})
  const chunks = Array.isArray(obj.chunks) ? obj.chunks : []
  const parsed = chunks.map((c) => {
    const ts = Array.isArray(c?.timestamp) ? c.timestamp : []
    return {
      start: Number.isFinite(ts[0]) ? ts[0] : 0,
      end: Number.isFinite(ts[1]) ? ts[1] : ((Number.isFinite(ts[0]) ? ts[0] : 0) + 0.5),
      text: String(c?.text || '').trim(),
    }
  }).filter((x) => x.text)
  return {
    text: String(obj.text || '').trim(),
    chunks: parsed,
    firstChunkStart: parsed.length ? parsed[0].start : null,
  }
}

function containsTerm(text, chunks, term) {
  const re = new RegExp(`\\b${term}\\b`, 'i')
  if (re.test(text || '')) return true
  return (chunks || []).some((c) => re.test(String(c?.text || '')))
}

async function main() {
  const file = process.argv[2]
  const model = process.argv[3] || 'Xenova/whisper-medium'
  if (!file) {
    console.error('Usage: node scripts/verify-node-transcribe.cjs <audio-path> [model]')
    process.exit(2)
  }

  const cacheDir = path.join(os.homedir(), 'AppData', 'Roaming', 'smme', 'whisper-models')
  const { pipeline, env } = await import('@xenova/transformers')
  env.cacheDir = cacheDir
  env.allowLocalModels = true
  env.allowRemoteModels = true
  env.useBrowserCache = false
  env.useFSCache = true

  const decoded = await decode.decodeAudioToFloat32(file, {
    sampleRate: 16000,
    mono: true,
    normalize: true,
    highpass: 100,
    lowpass: 8000,
    loudnorm: true,
    startSec: 0,
    durationSec: 45,
  })

  try {
    const pipe = await pipeline('automatic-speech-recognition', model, { quantized: true })
    const started = Date.now()
    const raw = await runXenovaFloat32(pipe, decoded.samples, {
      returnTimestamps: 'word',
      chunkLengthS: 30,
      strideLengthS: 5,
    })
    const transcribeMs = Date.now() - started

    const result = normalize(raw)
    const payload = {
      model,
      sampleRate: decoded.sampleRate,
      channels: decoded.channels,
      floatArrayLength: decoded.floatArrayLength,
      durationSec: decoded.durationSec,
      decodeMs: decoded.decodeMs,
      transcribeMs,
      firstChunkStart: result.firstChunkStart,
      containsGasoline: containsTerm(result.text, result.chunks, 'gasoline'),
      containsFingers: containsTerm(result.text, result.chunks, 'fingers'),
      containsMatch: containsTerm(result.text, result.chunks, 'match'),
      firstTenChunks: result.chunks.slice(0, 10),
      textPreview: result.text.slice(0, 1000),
    }

    console.log(JSON.stringify(payload, null, 2))
  } finally {
    await decoded.cleanup()
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
