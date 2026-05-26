const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')
const { findWhisperCppAssets } = require('./whispercpp-engine.cjs')

function runProcess(command, args, options = {}) {
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

async function resolveCommandPath(command) {
  const locator = process.platform === 'win32' ? 'where' : 'which'
  try {
    const result = await runProcess(locator, [command])
    if (result.code !== 0) return null
    return String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null
  } catch {
    return null
  }
}

async function detectPythonCandidate(command, prefixArgs = []) {
  const snippet = [
    'import json, sys',
    "print(json.dumps({'path': sys.executable, 'version': sys.version.split()[0]}))",
  ].join('; ')

  try {
    const result = await runProcess(command, [...prefixArgs, '-c', snippet])
    if (result.code !== 0) return null
    const lastLine = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop()
    if (!lastLine) return null
    const parsed = JSON.parse(lastLine)
    return {
      found: true,
      path: parsed.path || await resolveCommandPath(command),
      version: parsed.version || null,
      _command: command,
      _prefixArgs: prefixArgs,
    }
  } catch {
    return null
  }
}

async function detectPython() {
  const candidates = process.platform === 'win32'
    ? [['py', ['-3']], ['python', []], ['python3', []]]
    : [['python3', []], ['python', []]]

  for (const [command, prefixArgs] of candidates) {
    const hit = await detectPythonCandidate(command, prefixArgs)
    if (hit) return hit
  }

  return {
    found: false,
    path: null,
    version: null,
    _command: null,
    _prefixArgs: [],
  }
}

async function detectPip(pythonInfo) {
  if (pythonInfo?.found && pythonInfo._command) {
    try {
      const result = await runProcess(pythonInfo._command, [...(pythonInfo._prefixArgs || []), '-m', 'pip', '--version'])
      if (result.code === 0) {
        const output = String(result.stdout || result.stderr || '').trim()
        const versionMatch = output.match(/^pip\s+([^\s]+)/i)
        return {
          found: true,
          path: `${pythonInfo.path} -m pip`,
          version: versionMatch ? versionMatch[1] : null,
        }
      }
    } catch {
      // fall through to direct pip detection
    }
  }

  for (const command of process.platform === 'win32' ? ['pip', 'pip3'] : ['pip3', 'pip']) {
    try {
      const result = await runProcess(command, ['--version'])
      if (result.code === 0) {
        const output = String(result.stdout || result.stderr || '').trim()
        const versionMatch = output.match(/^pip\s+([^\s]+)/i)
        return {
          found: true,
          path: await resolveCommandPath(command),
          version: versionMatch ? versionMatch[1] : null,
        }
      }
    } catch {
      // try next command
    }
  }

  return { found: false, path: null, version: null }
}

async function detectPythonPackage(pythonInfo, importName, distName) {
  if (!pythonInfo?.found || !pythonInfo._command) {
    return { found: false, version: null }
  }

  const snippet = [
    'import json, importlib.util',
    'try:',
    ' import importlib.metadata as metadata',
    'except Exception:',
    ' metadata = None',
    `name = ${JSON.stringify(importName)}`,
    `dist = ${JSON.stringify(distName)}`,
    'spec = importlib.util.find_spec(name)',
    'found = spec is not None',
    'version = None',
    'if found and metadata is not None:',
    '  try:',
    '    version = metadata.version(dist)',
    '  except Exception:',
    '    version = None',
    "print(json.dumps({'found': found, 'version': version}))",
  ].join('\n')

  try {
    const result = await runProcess(pythonInfo._command, [...(pythonInfo._prefixArgs || []), '-c', snippet])
    if (result.code !== 0) return { found: false, version: null }
    const lastLine = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop()
    if (!lastLine) return { found: false, version: null }
    const parsed = JSON.parse(lastLine)
    return { found: !!parsed.found, version: parsed.version || null }
  } catch {
    return { found: false, version: null }
  }
}

async function detectCudaGpu() {
  const nvidiaPath = await resolveCommandPath('nvidia-smi')
  if (!nvidiaPath) {
    return {
      available: false,
      provider: null,
      gpus: [],
      message: 'No NVIDIA GPU tooling detected (nvidia-smi not found).',
    }
  }

  try {
    const result = await runProcess('nvidia-smi', ['--query-gpu=name,driver_version,memory.total', '--format=csv,noheader'])
    if (result.code !== 0) {
      return {
        available: false,
        provider: 'nvidia-smi',
        gpus: [],
        message: 'nvidia-smi is installed but GPU query failed.',
      }
    }

    const rows = String(result.stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    const gpus = rows.map((line) => {
      const [name, driver, memory] = line.split(',').map((part) => String(part || '').trim())
      return { name, driverVersion: driver || null, memoryTotal: memory || null }
    })

    return {
      available: gpus.length > 0,
      provider: 'nvidia-smi',
      gpus,
      message: gpus.length > 0
        ? `Detected ${gpus.length} NVIDIA GPU${gpus.length === 1 ? '' : 's'}.`
        : 'nvidia-smi returned no GPUs.',
    }
  } catch {
    return {
      available: false,
      provider: 'nvidia-smi',
      gpus: [],
      message: 'Failed to run nvidia-smi GPU query.',
    }
  }
}

function listModelRoots(repoRoot) {
  return [
    path.join(repoRoot, 'models'),
    path.join(repoRoot, 'electron', 'models'),
    path.join(repoRoot, 'tools'),
    path.join(repoRoot, 'bin'),
    path.join(os.homedir(), '.cache', 'huggingface', 'hub'),
    path.join(os.homedir(), '.cache', 'whisper'),
    path.join(os.homedir(), '.cache', 'torch'),
    path.join(process.env.APPDATA || '', 'fluxaura-studio', 'models'),
    path.join(process.env.APPDATA || '', 'FluxAura-Studio', 'models'),
    path.join(process.env.LOCALAPPDATA || '', 'FluxAura-Studio', 'models'),
  ].filter(Boolean)
}

async function findLikelyModelFolders(repoRoot) {
  const roots = listModelRoots(repoRoot)
  const results = []
  const seen = new Set()
  const fileHintRe = /(gguf|ggml|ctranslate2|model\.bin|config\.json|tokenizer\.json|\.pt$|\.pth$|\.ckpt$)/i
  const dirHintRe = /(model|whisper|demucs|faster|gguf|ggml|ctranslate2)/i

  async function maybeAdd(dirPath, reason) {
    const normalized = path.resolve(dirPath)
    if (seen.has(normalized)) return
    seen.add(normalized)
    let fileCount = 0
    try {
      const entries = await fsp.readdir(normalized, { withFileTypes: true })
      fileCount = entries.length
    } catch {
      return
    }
    results.push({ path: normalized, reason, fileCount })
  }

  async function walk(root, depth = 0) {
    if (depth > 2) return
    let entries = []
    try {
      entries = await fsp.readdir(root, { withFileTypes: true })
    } catch {
      return
    }

    const names = entries.map((entry) => entry.name)
    const hasModelFile = names.some((name) => fileHintRe.test(name))
    if (hasModelFile || dirHintRe.test(path.basename(root))) {
      await maybeAdd(root, hasModelFile ? 'model-files' : 'name-match')
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'release') continue
      await walk(path.join(root, entry.name), depth + 1)
    }
  }

  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    await walk(root, 0)
  }

  return results.slice(0, 25)
}

function summarizeLocalProStatus(report) {
  if (report.localProVenv?.ready) {
    return {
      setupState: 'Available',
      setupHint: 'Local Pro venv is ready. Runtime can be enabled for Local Pro preset.',
      foundationAvailable: true,
    }
  }
  if (!report.localProVenv?.found) {
    return {
      setupState: 'Setup required',
      setupHint: 'Local Pro requires repo venv at .venv-local-pro with faster-whisper and demucs installed.',
      foundationAvailable: false,
    }
  }
  if (report.localProVenv?.found && !report.localProVenv?.pip?.found) {
    return {
      setupState: 'Setup required',
      setupHint: 'Local Pro venv exists but pip is missing. Repair .venv-local-pro and retry.',
      foundationAvailable: false,
    }
  }
  if (report.localProVenv?.found && !report.localProVenv?.fasterWhisper?.found) {
    return {
      setupState: 'Missing faster-whisper',
      setupHint: 'Install faster-whisper in .venv-local-pro before enabling Local Pro runtime.',
      foundationAvailable: false,
    }
  }
  if (report.localProVenv?.found && !report.localProVenv?.demucs?.found) {
    return {
      setupState: 'Missing Demucs',
      setupHint: 'Install demucs in .venv-local-pro before enabling Local Pro runtime.',
      foundationAvailable: false,
    }
  }
  return {
    setupState: 'Setup required',
    setupHint: 'Local Pro venv is incomplete. Verify .venv-local-pro python + package imports.',
    foundationAvailable: false,
  }
}

async function detectLocalProTools(repoRoot) {
  const localProVenv = await detectRepoVenv(repoRoot)
  const python = localProVenv?.found
    ? { found: true, path: localProVenv.path || null, version: localProVenv.version || null }
    : { found: false, path: null, version: null }
  const pip = localProVenv?.pip || { found: false, path: null, version: null }
  const fasterWhisper = localProVenv?.fasterWhisper || { found: false, version: null }
  const demucs = localProVenv?.demucs || { found: false, version: null }
  const whisperCppAssets = await findWhisperCppAssets(repoRoot)
  const models = await findLikelyModelFolders(repoRoot)
  const gpu = await detectCudaGpu()

  const report = {
    python: { found: !!python.found, path: python.path || null, version: python.version || null },
    pip,
    fasterWhisper,
    demucs,
    localProVenv,
    whisperCpp: { found: !!whisperCppAssets.executablePath, path: whisperCppAssets.executablePath || null },
    models,
    gpu,
  }

  const summary = summarizeLocalProStatus(report)
  return {
    ...report,
    setupState: summary.setupState,
    setupHint: summary.setupHint,
    foundationAvailable: summary.foundationAvailable,
    runtimeEnabled: !!localProVenv.ready,
  }
}

module.exports = {
  detectLocalProTools,
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
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

function getRepoVenvPip(repoRoot) {
  const candidates = process.platform === 'win32'
    ? [
      path.join(repoRoot, '.venv-local-pro', 'Scripts', 'pip.exe'),
      path.join(repoRoot, '.venv-local-pro', 'Scripts', 'pip3.exe'),
    ]
    : [
      path.join(repoRoot, '.venv-local-pro', 'bin', 'pip3'),
      path.join(repoRoot, '.venv-local-pro', 'bin', 'pip'),
    ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

async function detectRepoVenv(repoRoot) {
  const venvPythonPath = getRepoVenvPython(repoRoot)
  if (!venvPythonPath) {
    return {
      found: false,
      path: null,
      version: null,
      pip: { found: false, path: null, version: null },
      fasterWhisper: { found: false, version: null },
      demucs: { found: false, version: null },
      ready: false,
    }
  }

  const pythonInfo = {
    found: true,
    path: venvPythonPath,
    version: null,
    _command: venvPythonPath,
    _prefixArgs: [],
  }

  const probe = await detectPythonCandidate(venvPythonPath, [])
  const pip = await detectPip(pythonInfo)
  const venvPipPath = getRepoVenvPip(repoRoot)
  const fasterWhisper = await detectPythonPackage(pythonInfo, 'faster_whisper', 'faster-whisper')
  const demucs = await detectPythonPackage(pythonInfo, 'demucs', 'demucs')

  return {
    found: true,
    path: venvPythonPath,
    version: probe?.version || null,
    pip: {
      ...pip,
      path: venvPipPath || pip.path || null,
    },
    fasterWhisper,
    demucs,
    ready: !!pip.found && !!fasterWhisper.found && !!demucs.found,
  }
}