const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const EXECUTABLE_NAMES = process.platform === 'win32'
  ? ['whisper-cli.exe', 'main.exe', 'whisper.exe']
  : ['whisper-cli', 'main', 'whisper']

function toSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parts = value.trim().split(':').map((v) => Number(v))
  if (parts.some((v) => !Number.isFinite(v))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return null
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function parseWhisperCppJson(jsonData) {
  const segments = []
  const words = []

  const addSegment = (start, end, text) => {
    const t = normalizeText(text)
    if (!t) return
    const s = Number.isFinite(start) ? start : 0
    const e = Number.isFinite(end) && end > s ? end : s + 0.5
    segments.push({ start: Math.round(s * 1000) / 1000, end: Math.round(e * 1000) / 1000, text: t })
  }

  const addWord = (start, end, text) => {
    const t = normalizeText(text)
    if (!t) return
    const s = Number.isFinite(start) ? start : 0
    const e = Number.isFinite(end) && end > s ? end : s + 0.2
    words.push({ start: Math.round(s * 1000) / 1000, end: Math.round(e * 1000) / 1000, text: t })
  }

  const arr = Array.isArray(jsonData?.transcription)
    ? jsonData.transcription
    : Array.isArray(jsonData?.segments)
      ? jsonData.segments
      : []

  for (const seg of arr) {
    const tsObj = seg?.timestamps || {}
    const start = toSeconds(tsObj.from) ?? toSeconds(seg?.start) ?? (typeof seg?.t0 === 'number' ? seg.t0 / 100 : null)
    const end = toSeconds(tsObj.to) ?? toSeconds(seg?.end) ?? (typeof seg?.t1 === 'number' ? seg.t1 / 100 : null)
    addSegment(start, end, seg?.text)

    const tokenWords = Array.isArray(seg?.words) ? seg.words : Array.isArray(seg?.tokens) ? seg.tokens : []
    for (const w of tokenWords) {
      const ws = toSeconds(w?.start) ?? toSeconds(w?.from) ?? (typeof w?.t0 === 'number' ? w.t0 / 100 : null)
      const we = toSeconds(w?.end) ?? toSeconds(w?.to) ?? (typeof w?.t1 === 'number' ? w.t1 / 100 : null)
      addWord(ws, we, w?.text || w?.token || w?.word)
    }
  }

  const fullText = segments.map((s) => s.text).join(' ').trim()
  return { text: fullText, chunks: segments, wordTimestamps: words }
}

function listSearchRoots(repoRoot) {
  const roots = [
    path.join(repoRoot, 'tools', 'whisper.cpp'),
    path.join(repoRoot, 'tools'),
    path.join(repoRoot, 'bin', 'whisper.cpp'),
    path.join(repoRoot, 'bin'),
    path.join(repoRoot, 'models'),
    path.join(repoRoot, 'test-projects'),
    path.join(repoRoot, 'Multimedia Editor.worktrees'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
    path.join(process.env.APPDATA || '', 'fluxaura-studio'),
    path.join(process.env.LOCALAPPDATA || '', 'FluxAura-Studio'),
  ]
  return roots.filter(Boolean)
}

async function findWhisperCppAssets(repoRoot) {
  const roots = listSearchRoots(repoRoot)
  const executableCandidates = []
  const modelCandidates = []

  async function walk(dir, depth = 0) {
    if (depth > 4) return
    let entries = []
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const lname = entry.name.toLowerCase()
        if (lname === 'node_modules' || lname === '.git' || lname === 'dist' || lname === 'release') continue
        await walk(entryPath, depth + 1)
        continue
      }
      const lower = entry.name.toLowerCase()
      if (EXECUTABLE_NAMES.includes(lower)) executableCandidates.push(entryPath)
      if (/^ggml-.*\.(bin|gguf)$/i.test(entry.name) || /\.(gguf)$/i.test(entry.name)) {
        modelCandidates.push(entryPath)
      }
    }
  }

  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    await walk(root, 0)
  }

  return {
    roots,
    executablePath: executableCandidates[0] || null,
    executableCandidates,
    modelCandidates,
    available: Boolean(executableCandidates[0] && modelCandidates.length > 0),
  }
}

function chooseModel(modelCandidates, desired = 'medium') {
  if (!Array.isArray(modelCandidates) || modelCandidates.length === 0) return null
  const order = desired === 'large'
    ? [/large-v3-turbo/i, /large-v3/i, /large/i, /medium/i]
    : [/medium/i, /large-v3-turbo/i, /large-v3/i, /large/i]
  for (const pattern of order) {
    const hit = modelCandidates.find((m) => pattern.test(path.basename(m)))
    if (hit) return hit
  }
  return modelCandidates[0]
}

function runSpawn(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { windowsHide: true, ...options })
    let stderr = ''
    let stdout = ''

    proc.stdout.on('data', (chunk) => { stdout += String(chunk || '') })
    proc.stderr.on('data', (chunk) => { stderr += String(chunk || '') })
    proc.on('error', reject)
    proc.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

async function transcribeWithWhisperCpp({ repoRoot, audioPath, language, desiredModel = 'medium', ffmpegPath = null }) {
  const status = await findWhisperCppAssets(repoRoot)
  if (!status.available) {
    return {
      ok: false,
      error: 'whisper.cpp not installed. Add whisper-cli/main.exe and GGML/GGUF model file.',
      engine: 'whisper.cpp',
      warnings: ['whisper.cpp assets not found'],
      status,
    }
  }

  const modelPath = chooseModel(status.modelCandidates, desiredModel)
  if (!modelPath) {
    return { ok: false, error: 'No whisper.cpp model file found.', engine: 'whisper.cpp', warnings: ['No GGML/GGUF model found'], status }
  }

  let sourcePath = audioPath
  let tempWav = null
  if (ffmpegPath && sourcePath && !/\.wav$/i.test(sourcePath)) {
    tempWav = path.join(os.tmpdir(), `fluxaura-whispercpp-${Date.now()}.wav`)
    const ffmpegArgs = ['-y', '-i', sourcePath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', tempWav]
    const ff = await runSpawn(ffmpegPath, ffmpegArgs)
    if (ff.code !== 0 || !fs.existsSync(tempWav)) {
      return {
        ok: false,
        error: `ffmpeg conversion failed before whisper.cpp: ${ff.stderr || ff.stdout || 'unknown error'}`,
        engine: 'whisper.cpp',
        warnings: ['audio conversion failed'],
      }
    }
    sourcePath = tempWav
  }

  const outBase = path.join(os.tmpdir(), `fluxaura-whispercpp-${Date.now()}`)
  const args = ['-m', modelPath, '-f', sourcePath, '-oj', '-of', outBase]
  if (language && language !== 'auto') args.push('-l', language)
  args.push('--word_timestamps')

  const execResult = await runSpawn(status.executablePath, args)

  if (tempWav) {
    fsp.unlink(tempWav).catch(() => {})
  }

  if (execResult.code !== 0) {
    return {
      ok: false,
      error: `whisper.cpp failed (${execResult.code}): ${(execResult.stderr || execResult.stdout || '').slice(0, 1000)}`,
      engine: 'whisper.cpp',
      modelPath,
      warnings: ['whisper.cpp execution failed'],
    }
  }

  const jsonPath = `${outBase}.json`
  let parsedJson = null
  try {
    const text = await fsp.readFile(jsonPath, 'utf8')
    parsedJson = JSON.parse(text)
  } catch (err) {
    return {
      ok: false,
      error: `whisper.cpp output parse failed: ${err?.message || err}`,
      engine: 'whisper.cpp',
      modelPath,
      warnings: ['json parse failed'],
    }
  } finally {
    fsp.unlink(jsonPath).catch(() => {})
    fsp.unlink(`${outBase}.txt`).catch(() => {})
    fsp.unlink(`${outBase}.srt`).catch(() => {})
    fsp.unlink(`${outBase}.vtt`).catch(() => {})
  }

  const normalized = parseWhisperCppJson(parsedJson)
  return {
    ok: true,
    engine: 'whisper.cpp',
    modelPath,
    text: normalized.text,
    chunks: normalized.chunks,
    wordTimestamps: normalized.wordTimestamps,
    warnings: normalized.chunks.length === 0 ? ['No segments returned by whisper.cpp'] : [],
    status,
  }
}

module.exports = {
  findWhisperCppAssets,
  transcribeWithWhisperCpp,
}
