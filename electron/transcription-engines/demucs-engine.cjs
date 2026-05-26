const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')
const { getRepoVenvPython } = require('./faster-whisper-engine.cjs')

const STEM_FILE_NAMES = new Set(['vocals.wav', 'vocals.flac', 'vocals.mp3'])

function quoteArg(arg) {
  const text = String(arg ?? '')
  if (!text) return '""'
  if (/^[A-Za-z0-9_./:-]+$/.test(text)) return text
  return `"${text.replace(/"/g, '\\"')}"`
}

function formatCommandLine(command, args) {
  return [quoteArg(command), ...(args || []).map(quoteArg)].join(' ')
}

async function removeDirSafe(dirPath) {
  if (!dirPath) return
  try {
    await fsp.rm(dirPath, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

function scanDemucsStems(outputRoot, inputPath) {
  const baseName = path.parse(inputPath).name.toLowerCase()
  const stack = [outputRoot]
  const discovered = []

  const addDiscovered = (fullPath) => {
    const normalized = path.resolve(fullPath)
    const ext = path.extname(normalized).toLowerCase()
    const relativePath = path.relative(outputRoot, normalized)
    discovered.push({
      path: normalized,
      relativePath,
      ext,
      depth: relativePath.split(path.sep).length,
      matchesInputName: normalized.toLowerCase().includes(baseName),
      exactName: path.basename(normalized).toLowerCase(),
    })
  }

  while (stack.length) {
    const current = stack.pop()
    let entries = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      if (!entry.isFile()) continue
      if (!STEM_FILE_NAMES.has(entry.name.toLowerCase())) continue
      addDiscovered(full)
    }
  }

  const sorted = [...discovered].sort((a, b) => {
    const extPriority = (p) => (p.ext === '.wav' ? 0 : p.ext === '.flac' ? 1 : 2)
    if (extPriority(a) !== extPriority(b)) return extPriority(a) - extPriority(b)
    if (a.matchesInputName !== b.matchesInputName) return a.matchesInputName ? -1 : 1
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.relativePath.length - b.relativePath.length
  })

  const selected = sorted[0] || null
  const layoutRoots = [...new Set(sorted.map((item) => item.relativePath.split(path.sep).slice(0, -1).join(path.sep) || '.'))]
  const layoutShapes = [...new Set(sorted.map((item) => path.dirname(item.relativePath).split(path.sep).join('/')))]

  return {
    discovered,
    selected: selected ? selected.path : null,
    layoutRoots,
    layoutShapes,
    hasStems: discovered.length > 0,
  }
}

async function isolateVocalsDemucs({
  repoRoot,
  audioPath,
  enabled = false,
  timeoutMs = 20 * 60 * 1000,
  stallTimeoutMs = 90 * 1000,
  onProgress = null,
}) {
  if (!enabled) {
    return { ok: true, used: false, vocalPath: audioPath, cleanup: async () => {} }
  }

  const pythonPath = getRepoVenvPython(repoRoot)
  if (!pythonPath) {
    return {
      ok: false,
      error: 'Local Pro venv python not found at .venv-local-pro for Demucs.',
      diagnostics: { pythonPath: null },
    }
  }

  if (!audioPath || !fs.existsSync(audioPath)) {
    return {
      ok: false,
      error: 'Demucs requires a local audio file path.',
      diagnostics: { audioPath },
    }
  }

  const outputRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'fluxaura-demucs-'))
  const args = [
    '-m',
    'demucs.separate',
    '--two-stems=vocals',
    '--no-split',
    '--out',
    outputRoot,
    audioPath,
  ]

  const started = Date.now()
  const commandLine = formatCommandLine(pythonPath, args)
  console.log('[demucs] starting', {
    pythonPath,
    cwd: repoRoot,
    outputRoot,
    commandLine,
    audioPath,
    enabled,
  })
  if (typeof onProgress === 'function') {
    try { onProgress({ stage: 'starting', message: 'Starting Demucs vocal isolation…' }) } catch {}
  }
  const child = spawn(pythonPath, args, {
    windowsHide: true,
    cwd: repoRoot,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  })

  let stdout = ''
  let stderr = ''
  let timeoutHandle = null
  let stallHandle = null
  let timedOut = false
  let stalled = false

  const resetStallTimer = () => {
    if (stallHandle) clearTimeout(stallHandle)
    stallHandle = setTimeout(() => {
      stalled = true
      try { child.kill('SIGTERM') } catch {}
      setTimeout(() => {
        try { child.kill('SIGKILL') } catch {}
      }, 1500)
    }, stallTimeoutMs)
  }

  resetStallTimer()

  const result = await new Promise((resolve) => {
    child.stdout.on('data', (chunk) => {
      const text = String(chunk || '')
      stdout += text
      resetStallTimer()
      if (typeof onProgress === 'function') {
        try { onProgress({ stage: 'processing', message: text.trim().split(/\r?\n/).filter(Boolean).pop() || 'Demucs running…' }) } catch {}
      }
    })
    child.stderr.on('data', (chunk) => {
      const text = String(chunk || '')
      stderr += text
      resetStallTimer()
      if (typeof onProgress === 'function') {
        try { onProgress({ stage: 'processing', message: text.trim().split(/\r?\n/).filter(Boolean).pop() || 'Demucs running…' }) } catch {}
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
    }, timeoutMs)
  })

  if (timeoutHandle) clearTimeout(timeoutHandle)
  if (stallHandle) clearTimeout(stallHandle)

  const durationMs = Date.now() - started
  const stemScan = scanDemucsStems(outputRoot, audioPath)
  const selectedStemPath = stemScan.selected

  console.log('[demucs] completed', {
    pythonPath,
    cwd: repoRoot,
    outputRoot,
    commandLine,
    exitCode: result?.code ?? null,
    timedOut,
    stalled,
    elapsedMs: durationMs,
    stdout: String(stdout || '').trim(),
    stderr: String(stderr || '').trim(),
    hasStems: stemScan.hasStems,
    discoveredStems: stemScan.discovered.map((stem) => stem.path),
    layoutRoots: stemScan.layoutRoots,
    layoutShapes: stemScan.layoutShapes,
    selectedStemPath,
  })

  if (stalled) {
    console.warn('[demucs] stalled without output', {
      pythonPath,
      cwd: repoRoot,
      outputRoot,
      commandLine,
      elapsedMs: durationMs,
      stderr: String(stderr || '').trim(),
    })
    await removeDirSafe(outputRoot)
    return {
      ok: false,
      error: `Demucs stalled with no output for ${Math.round(stallTimeoutMs / 1000)}s`,
      diagnostics: {
        pythonPath,
        cwd: repoRoot,
        outputRoot,
        commandLine,
        exitCode: result?.code ?? null,
        durationMs,
        stdout: String(stdout || '').slice(0, 4000),
        stderr: String(stderr || '').slice(0, 4000),
        hasStems: stemScan.hasStems,
        discoveredStems: stemScan.discovered.map((stem) => stem.path),
        layoutRoots: stemScan.layoutRoots,
        layoutShapes: stemScan.layoutShapes,
        selectedStemPath,
      },
    }
  }

  if (timedOut) {
    console.warn('[demucs] timed out', {
      pythonPath,
      cwd: repoRoot,
      outputRoot,
      commandLine,
      elapsedMs: durationMs,
      stderr: String(stderr || '').trim(),
    })
    await removeDirSafe(outputRoot)
    return {
      ok: false,
      error: `Demucs timed out after ${Math.round(timeoutMs / 1000)}s`,
      diagnostics: {
        pythonPath,
        cwd: repoRoot,
        outputRoot,
        commandLine,
        exitCode: result?.code ?? null,
        durationMs,
        stdout: String(stdout || '').slice(0, 4000),
        stderr: String(stderr || '').slice(0, 4000),
        hasStems: stemScan.hasStems,
        discoveredStems: stemScan.discovered.map((stem) => stem.path),
        layoutRoots: stemScan.layoutRoots,
        layoutShapes: stemScan.layoutShapes,
        selectedStemPath,
      },
    }
  }

  if (result?.err) {
    console.error('[demucs] process launch failed', {
      pythonPath,
      cwd: repoRoot,
      outputRoot,
      commandLine,
      elapsedMs: durationMs,
      error: result.err?.message || String(result.err),
    })
    await removeDirSafe(outputRoot)
    return {
      ok: false,
      error: `Failed to launch Demucs process: ${result.err?.message || result.err}`,
      diagnostics: {
        pythonPath,
        cwd: repoRoot,
        outputRoot,
        commandLine,
        durationMs,
        stdout: String(stdout || '').slice(0, 4000),
        stderr: String(stderr || '').slice(0, 4000),
        hasStems: stemScan.hasStems,
        discoveredStems: stemScan.discovered.map((stem) => stem.path),
        layoutRoots: stemScan.layoutRoots,
        layoutShapes: stemScan.layoutShapes,
        selectedStemPath,
      },
    }
  }

  if (result.code !== 0 && !selectedStemPath) {
    console.warn('[demucs] exit without stem output', {
      pythonPath,
      cwd: repoRoot,
      outputRoot,
      commandLine,
      exitCode: result.code,
      elapsedMs: durationMs,
      stdout: String(stdout || '').trim(),
      stderr: String(stderr || '').trim(),
    })
    await removeDirSafe(outputRoot)
    return {
      ok: false,
      error: `Demucs exited ${result.code} and no vocals stem was found.`,
      diagnostics: {
        pythonPath,
        cwd: repoRoot,
        outputRoot,
        commandLine,
        exitCode: result.code,
        durationMs,
        stdout: String(stdout || '').slice(0, 4000),
        stderr: String(stderr || '').slice(0, 4000),
        hasStems: stemScan.hasStems,
        discoveredStems: stemScan.discovered.map((stem) => stem.path),
        layoutRoots: stemScan.layoutRoots,
        layoutShapes: stemScan.layoutShapes,
        selectedStemPath: null,
      },
    }
  }

  if (selectedStemPath) {
    console.log('[demucs] using vocals stem', {
      selectedStemPath,
      discoveredStems: stemScan.discovered.map((stem) => stem.path),
      layoutRoots: stemScan.layoutRoots,
      layoutShapes: stemScan.layoutShapes,
      exitCode: result.code,
    })
  }

  if (result.code !== 0 && selectedStemPath) {
    console.warn('[demucs] non-zero exit but stem was found; continuing with stem output', {
      exitCode: result.code,
      selectedStemPath,
      stderr: String(stderr || '').trim(),
    })
  }

  return {
    ok: true,
    used: !!selectedStemPath,
    vocalPath: selectedStemPath || audioPath,
    diagnostics: {
      pythonPath,
      cwd: repoRoot,
      outputRoot,
      commandLine,
      exitCode: result.code,
      durationMs,
      stdout: String(stdout || '').slice(0, 4000),
      stderr: String(stderr || '').slice(0, 4000),
      hasStems: stemScan.hasStems,
      discoveredStems: stemScan.discovered.map((stem) => stem.path),
      layoutRoots: stemScan.layoutRoots,
      layoutShapes: stemScan.layoutShapes,
      selectedStemPath,
    },
    cleanup: async () => {
      await removeDirSafe(outputRoot)
    },
  }
}

module.exports = {
  isolateVocalsDemucs,
}
