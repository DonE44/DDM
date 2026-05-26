const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const HEARTBEAT_PREFIX = 'FW_PROGRESS '
let _activeRun = null

function runSpawn(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { windowsHide: true, ...options })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk) => { stdout += String(chunk || '') })
    proc.stderr.on('data', (chunk) => { stderr += String(chunk || '') })
    proc.on('error', reject)
    proc.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return []
  return segments
    .map((s) => {
      const start = Number(s?.start)
      const end = Number(s?.end)
      const text = String(s?.text || '').trim()
      if (!Number.isFinite(start) || !Number.isFinite(end) || !text) return null
      return {
        start: Math.round(start * 1000) / 1000,
        end: Math.round(Math.max(end, start + 0.1) * 1000) / 1000,
        text,
      }
    })
    .filter(Boolean)
}

function normalizeWords(words) {
  if (!Array.isArray(words)) return []
  return words
    .map((w) => {
      const start = Number(w?.start)
      const end = Number(w?.end)
      const text = String(w?.text || '').trim()
      if (!Number.isFinite(start) || !Number.isFinite(end) || !text) return null
      return {
        start: Math.round(start * 1000) / 1000,
        end: Math.round(Math.max(end, start + 0.05) * 1000) / 1000,
        text,
      }
    })
    .filter(Boolean)
}

function getRepoVenvPython(repoRoot) {
  const candidates = process.platform === 'win32'
    ? [
      path.join(repoRoot, '.venv-local-pro', 'Scripts', 'python.exe'),
      path.join(repoRoot, '.venv-local-pro', 'Scripts', 'python'),
    ]
    : [
      path.join(repoRoot, '.venv-local-pro', 'bin', 'python3'),
      path.join(repoRoot, '.venv-local-pro', 'bin', 'python'),
    ]
  return candidates.find((p) => fs.existsSync(p)) || null
}

async function removeDirSafe(dirPath) {
  if (!dirPath) return
  try {
    await fsp.rm(dirPath, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}

async function transcribeWithFasterWhisper({
  repoRoot,
  audioPath,
  model = 'medium',
  language = 'auto',
  wordTimestamps = true,
  beamSize = 5,
  vadFilter = true,
  initialPrompt = '',
  timeoutMs = null,
  device = 'cpu',
  computeType = 'int8',
  onProgress,
}) {
  const pythonPath = getRepoVenvPython(repoRoot)
  if (!pythonPath) {
    return {
      ok: false,
      error: 'Local Pro venv python not found at .venv-local-pro. Create the venv first.',
      diagnostics: { pythonPath: null },
    }
  }

  if (!audioPath || !fs.existsSync(audioPath)) {
    return {
      ok: false,
      error: 'Local Pro needs a local audio file path to run Faster-Whisper.',
      diagnostics: { pythonPath, audioPath },
    }
  }

  const bridgePath = path.join(repoRoot, 'python', 'local_pro_transcribe.py')
  if (!fs.existsSync(bridgePath)) {
    return {
      ok: false,
      error: 'Python bridge script missing: python/local_pro_transcribe.py',
      diagnostics: { pythonPath, bridgePath },
    }
  }

  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'fluxaura-faster-whisper-'))

  const args = [
    bridgePath,
    '--audio',
    audioPath,
    '--model',
    String(model || 'medium'),
    '--language',
    String(language || 'auto'),
    '--beam-size',
    String(Math.max(1, Number(beamSize) || 5)),
    '--device',
    String(device || 'cpu'),
    '--compute-type',
    String(computeType || 'int8'),
  ]

  if (wordTimestamps) args.push('--word-timestamps')
  if (vadFilter) args.push('--vad-filter')
  if (String(initialPrompt || '').trim()) {
    args.push('--initial-prompt', String(initialPrompt).trim())
  }

  const started = Date.now()
  const safeModel = String(model || 'medium').toLowerCase()
  const resolvedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : (safeModel.includes('large') ? 8 * 60 * 1000 : 15 * 60 * 1000)

  const emitProgress = (payload) => {
    if (typeof onProgress !== 'function') return
    try {
      onProgress(payload)
    } catch {
      // Progress callback errors should never fail transcription.
    }
  }

  emitProgress({ stage: 'boot', message: `Launching Local Pro transcription (${safeModel}).` })

  const child = spawn(pythonPath, args, {
    windowsHide: true,
    cwd: repoRoot,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  })

  let stdout = ''
  let stderr = ''
  let timeoutHandle = null
  let countdownHandle = null
  let timedOut = false
  let canceled = false
  let stderrBuffer = ''

  _activeRun = {
    child,
    started,
    model: safeModel,
    cancel: () => {
      canceled = true
      try { child.kill('SIGTERM') } catch {}
      setTimeout(() => {
        try { child.kill('SIGKILL') } catch {}
      }, 1200)
    },
  }

  const result = await new Promise((resolve) => {
    child.stdout.on('data', (chunk) => { stdout += String(chunk || '') })
    child.stderr.on('data', (chunk) => {
      const text = String(chunk || '')
      stderr += text
      stderrBuffer += text
      const lines = stderrBuffer.split(/\r?\n/)
      stderrBuffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith(HEARTBEAT_PREFIX)) continue
        const raw = line.slice(HEARTBEAT_PREFIX.length)
        try {
          const event = JSON.parse(raw)
          emitProgress(event)
        } catch {
          // Ignore malformed heartbeat lines.
        }
      }
    })
    child.on('error', (err) => resolve({ code: -1, err }))
    child.on('close', (code) => resolve({ code }))

    timeoutHandle = setTimeout(() => {
      timedOut = true
      try { child.kill('SIGTERM') } catch {}
      setTimeout(() => {
        try { child.kill('SIGKILL') } catch {}
      }, 1500)
    }, resolvedTimeoutMs)

    countdownHandle = setInterval(() => {
      const elapsedMs = Date.now() - started
      const remainingSec = Math.max(0, Math.ceil((resolvedTimeoutMs - elapsedMs) / 1000))
      emitProgress({
        stage: 'heartbeat',
        elapsedSec: Math.round(elapsedMs / 1000),
        timeoutRemainingSec: remainingSec,
      })
    }, 5000)
  })

  if (timeoutHandle) clearTimeout(timeoutHandle)
  if (countdownHandle) clearInterval(countdownHandle)
  _activeRun = null
  await removeDirSafe(tempRoot)

  const durationMs = Date.now() - started
  if (timedOut) {
    const largeHint = safeModel.includes('large') ? ' Large-v3 timed out; try Medium or Fast.' : ''
    return {
      ok: false,
      error: `Faster-Whisper timed out after ${Math.round(resolvedTimeoutMs / 1000)}s.${largeHint}`,
      diagnostics: {
        pythonPath,
        stderr: String(stderr || '').slice(0, 2000),
        durationMs,
      },
    }
  }

  if (canceled) {
    return {
      ok: false,
      canceled: true,
      error: 'Local Pro transcription canceled.',
      diagnostics: {
        pythonPath,
        durationMs,
      },
    }
  }

  if (result?.err) {
    return {
      ok: false,
      error: `Failed to launch Faster-Whisper python process: ${result.err?.message || result.err}`,
      diagnostics: { pythonPath, durationMs },
    }
  }

  let parsed = null
  try {
    parsed = JSON.parse(String(stdout || '').trim())
  } catch {
    parsed = null
  }

  if (!parsed || result.code !== 0 || parsed.ok === false) {
    return {
      ok: false,
      error: parsed?.error || `Faster-Whisper bridge failed (exit ${result.code})`,
      diagnostics: {
        pythonPath,
        durationMs,
        stderr: String(stderr || '').slice(0, 2000),
        stdoutPreview: String(stdout || '').slice(0, 800),
      },
    }
  }

  const chunks = normalizeSegments(parsed.segments)
  const wordTimestampsOut = normalizeWords(parsed.words)

  return {
    ok: true,
    text: String(parsed.text || '').trim(),
    chunks,
    wordTimestamps: wordTimestampsOut,
    language: String(parsed.language || 'en'),
    transcriptionDurationSec: Number.isFinite(parsed.duration) ? parsed.duration : null,
    timings: parsed.timings || {},
    diagnostics: {
      pythonPath,
      durationMs,
      stderr: String(stderr || '').slice(0, 2000),
    },
  }
}

module.exports = {
  getRepoVenvPython,
  transcribeWithFasterWhisper,
  cancelActiveFasterWhisper,
}

function cancelActiveFasterWhisper() {
  if (!_activeRun?.cancel) return false
  try {
    _activeRun.cancel()
    return true
  } catch {
    return false
  }
}
