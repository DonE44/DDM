const path = require('path')
const fs = require('fs')
const fsp = require('fs/promises')
const os = require('os')
const { spawn } = require('child_process')

const TEMP_WAV_SUFFIX = '.tmp.wav'

function getFfmpegPath() {
  let bin = null
  try {
    bin = require('ffmpeg-static')
    if (bin && bin.includes('app.asar')) {
      bin = bin.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
    }
  } catch {
    return null
  }
  if (!bin || !fs.existsSync(bin)) return null
  return bin
}

function runFfmpeg(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg-static not found'))
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', (chunk) => {
      stderr += String(chunk || '')
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
      }
      resolve(stderr)
    })
  })
}

function createTempWavPath(prefix = 'fluxaura-decoded') {
  return path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}${TEMP_WAV_SUFFIX}`
  )
}

function applyLyricVocalFocusOptions(options = {}) {
  const lyricFocus = options.lyricVocalFocus === true || options.transcriptionMode === 'lyric-vocal-focus'
  return {
    sampleRate: 16000,
    mono: true,
    normalize: lyricFocus,
    highpass: lyricFocus ? 100 : null,
    lowpass: lyricFocus ? 8000 : null,
    loudnorm: lyricFocus,
    ...options,
  }
}

function parseDurationText(stderr) {
  const match = String(stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i)
  if (!match) return null
  const hours = Number(match[1]) || 0
  const minutes = Number(match[2]) || 0
  const seconds = Number(match[3]) || 0
  return hours * 3600 + minutes * 60 + seconds
}

function buildAudioFilter(options = {}) {
  const filters = []
  if (options.normalize) filters.push('dynaudnorm')
  if (Number.isFinite(options.highpass) && options.highpass > 0) {
    filters.push(`highpass=f=${options.highpass}`)
  }
  if (Number.isFinite(options.lowpass) && options.lowpass > 0) {
    filters.push(`lowpass=f=${options.lowpass}`)
  }
  if (options.loudnorm) filters.push('loudnorm')
  return filters.join(',')
}

function parseWav(buffer) {
  if (buffer.length < 44) throw new Error('WAV too small')
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Invalid WAV header')
  }

  let offset = 12
  let fmt = null
  let dataOffset = -1
  let dataSize = 0

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const chunkStart = offset + 8

    if (chunkId === 'fmt ') {
      if (chunkSize < 16 || chunkStart + chunkSize > buffer.length) {
        throw new Error('Invalid WAV fmt chunk')
      }
      fmt = {
        format: buffer.readUInt16LE(chunkStart),
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
      }
    } else if (chunkId === 'data') {
      dataOffset = chunkStart
      dataSize = Math.min(chunkSize, Math.max(0, buffer.length - chunkStart))
      break
    }

    offset = chunkStart + chunkSize + (chunkSize % 2)
  }

  if (!fmt) throw new Error('Missing WAV fmt chunk')
  if (dataOffset < 0 || dataSize <= 0) throw new Error('Missing WAV data chunk')
  return { fmt, dataOffset, dataSize }
}

function wavDataToFloat32(buffer, wav) {
  const { fmt, dataOffset, dataSize } = wav
  const channels = Math.max(1, fmt.channels)
  const bytesPerSample = Math.max(1, Math.floor(fmt.bitsPerSample / 8))
  const frameBytes = bytesPerSample * channels
  if (frameBytes <= 0) throw new Error('Invalid WAV frame size')
  const frameCount = Math.floor(dataSize / frameBytes)
  const mono = new Float32Array(frameCount)

  let ptr = dataOffset
  for (let i = 0; i < frameCount; i += 1) {
    let sum = 0
    for (let ch = 0; ch < channels; ch += 1) {
      const p = ptr + ch * bytesPerSample
      let sample = 0
      if ((fmt.format === 3 || fmt.format === 65534) && fmt.bitsPerSample === 32) {
        sample = buffer.readFloatLE(p)
      } else if (fmt.format === 1 && fmt.bitsPerSample === 16) {
        sample = buffer.readInt16LE(p) / 32768
      } else if (fmt.format === 1 && fmt.bitsPerSample === 24) {
        const b0 = buffer[p]
        const b1 = buffer[p + 1]
        const b2 = buffer[p + 2]
        let value = b0 | (b1 << 8) | (b2 << 16)
        if (value & 0x800000) value |= 0xff000000
        sample = value / 8388608
      } else if (fmt.format === 1 && fmt.bitsPerSample === 32) {
        sample = buffer.readInt32LE(p) / 2147483648
      } else {
        throw new Error(`Unsupported WAV encoding format=${fmt.format} bits=${fmt.bitsPerSample}`)
      }
      sum += sample
    }
    mono[i] = Math.max(-1, Math.min(1, sum / channels))
    ptr += frameBytes
  }

  return {
    samples: mono,
    sampleRate: fmt.sampleRate,
    channels,
    durationSec: mono.length / Math.max(1, fmt.sampleRate),
  }
}

async function decodeAudioToWav(inputPath, options = {}) {
  const ffmpegPath = getFfmpegPath()
  if (!ffmpegPath) throw new Error('ffmpeg-static not found')
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    throw new Error('decodeAudioToWav requires an input file path')
  }
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input media file not found: ${inputPath}`)
  }

  const merged = applyLyricVocalFocusOptions(options)

  const sampleRate = Number.isFinite(merged.sampleRate) ? merged.sampleRate : 16000
  const mono = merged.mono !== false
  const outPath = options.outputPath || createTempWavPath('fluxaura-decoded')
  const filter = buildAudioFilter(merged)

  const args = ['-y', '-i', inputPath]
  if (Number.isFinite(merged.startSec) && merged.startSec > 0) {
    args.push('-ss', String(merged.startSec))
  }
  if (Number.isFinite(merged.durationSec) && merged.durationSec > 0) {
    args.push('-t', String(merged.durationSec))
  }
  args.push('-vn')
  args.push('-ac', mono ? '1' : '2')
  args.push('-ar', String(sampleRate))
  args.push('-c:a', 'pcm_f32le')
  if (filter) args.push('-af', filter)
  args.push(outPath)

  const started = Date.now()
  await runFfmpeg(ffmpegPath, args)
  const decodeMs = Date.now() - started

  return {
    wavPath: outPath,
    sampleRate,
    channels: mono ? 1 : 2,
    decodeMs,
    cleanup: async () => {
      await fsp.unlink(outPath).catch(() => {})
    },
  }
}

async function loadWavToFloat32Array(wavPath) {
  const buf = await fsp.readFile(wavPath)
  const wav = parseWav(buf)
  const parsed = wavDataToFloat32(buf, wav)
  return {
    ...parsed,
    wavPath,
    floatArrayLength: parsed.samples.length,
  }
}

async function decodeAudioToFloat32(inputPath, options = {}) {
  const wav = await decodeAudioToWav(inputPath, options)
  try {
    const loaded = await loadWavToFloat32Array(wav.wavPath)
    return {
      ...loaded,
      decodeMs: wav.decodeMs,
      cleanup: wav.cleanup,
      wavPath: wav.wavPath,
    }
  } catch (err) {
    await wav.cleanup()
    throw err
  }
}

async function getAudioDuration(inputPath) {
  const ffmpegPath = getFfmpegPath()
  if (!ffmpegPath) throw new Error('ffmpeg-static not found')
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    throw new Error('getAudioDuration requires an input file path')
  }
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input media file not found: ${inputPath}`)
  }

  const stderr = await runFfmpeg(ffmpegPath, ['-hide_banner', '-i', inputPath, '-f', 'null', '-'])
  const durationSec = parseDurationText(stderr)
  if (!Number.isFinite(durationSec)) {
    throw new Error(`Could not determine audio duration for: ${inputPath}`)
  }
  return durationSec
}

module.exports = {
  getFfmpegPath,
  decodeAudioToWav,
  loadWavToFloat32Array,
  decodeAudioToFloat32,
  getAudioDuration,
}
