const { spawn } = require('child_process')
const path = require('path')

function runProcess(command, args) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk) => { stdout += String(chunk || '') })
    proc.stderr.on('data', (chunk) => { stderr += String(chunk || '') })
    proc.on('error', () => resolve({ code: -1, stdout, stderr }))
    proc.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function parseMajorMinor(version) {
  const match = String(version || '').match(/^(\d+)\.(\d+)/)
  if (!match) return null
  return `${match[1]}.${match[2]}`
}

function parsePyZeroPLine(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed.startsWith('-V:')) return null
  const rest = trimmed.slice(3).trim()
  const firstSpace = rest.indexOf(' ')
  if (firstSpace <= 0) return null
  const selectorRaw = rest.slice(0, firstSpace).replace('*', '').trim()
  const execPath = rest.slice(firstSpace).trim()
  if (!selectorRaw || !execPath) return null
  return { selector: selectorRaw, path: execPath }
}

async function detectPyLauncherEntries() {
  const result = await runProcess('py', ['-0p'])
  if (result.code !== 0) return []
  const text = [String(result.stdout || ''), String(result.stderr || '')].join('\n')
  return text
    .split(/\r?\n/)
    .map(parsePyZeroPLine)
    .filter(Boolean)
}

async function probePythonPath(pythonPath) {
  const snippet = [
    'import json, sys, importlib.util, pathlib',
    'lib_dir = pathlib.Path(sys.prefix) / "Lib"',
    'os_py = lib_dir / "os.py"',
    'pip_spec = importlib.util.find_spec("pip")',
    'print(json.dumps({',
    '  "path": sys.executable,',
    '  "version": sys.version.split()[0],',
    '  "prefix": sys.prefix,',
    '  "stdlibLikelyPresent": bool(os_py.exists()),',
    '  "pipImportable": bool(pip_spec),',
    '}))',
  ].join('; ')

  const run = await runProcess(pythonPath, ['-c', snippet])
  if (run.code !== 0) {
    return {
      path: pythonPath,
      version: null,
      majorMinor: null,
      selector: null,
      healthy: false,
      healthReason: 'python-launch-failed',
      stdlibLikelyPresent: false,
      pipImportable: false,
      pipVersion: null,
      localProRuntimeRecommendation: 'unknown',
      localProRuntimeNote: 'Python executable could not be probed.',
    }
  }

  let parsed = null
  const line = String(run.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop()
  if (line) {
    try {
      parsed = JSON.parse(line)
    } catch {
      parsed = null
    }
  }
  if (!parsed) {
    return {
      path: pythonPath,
      version: null,
      majorMinor: null,
      selector: null,
      healthy: false,
      healthReason: 'probe-parse-failed',
      stdlibLikelyPresent: false,
      pipImportable: false,
      pipVersion: null,
      localProRuntimeRecommendation: 'unknown',
      localProRuntimeNote: 'Python probe output could not be parsed.',
    }
  }

  const majorMinor = parseMajorMinor(parsed.version)
  const pipCheck = await runProcess(pythonPath, ['-m', 'pip', '--version'])
  const pipVersion = pipCheck.code === 0 ? parsePipVersion(pipCheck.stdout || pipCheck.stderr) : null
  const healthy = !!parsed.stdlibLikelyPresent && !!parsed.pipImportable
  let healthReason = 'healthy'
  if (!healthy) {
    if (!parsed.stdlibLikelyPresent && !parsed.pipImportable) healthReason = 'missing-stdlib-and-pip'
    else if (!parsed.stdlibLikelyPresent) healthReason = 'missing-stdlib'
    else healthReason = 'missing-pip'
  }

  let localProRuntimeRecommendation = 'not-recommended'
  let localProRuntimeNote = 'Python version is not the preferred Local Pro runtime target.'
  if (majorMinor === '3.11') {
    localProRuntimeRecommendation = 'recommended'
    localProRuntimeNote = 'Python 3.11 is recommended for Local Pro runtime.'
  } else if (majorMinor === '3.10' || majorMinor === '3.12') {
    localProRuntimeRecommendation = 'supported-with-caveats'
    localProRuntimeNote = `Python ${majorMinor} can work, but 3.11 is preferred for Local Pro runtime stability.`
  } else if (majorMinor === '3.14') {
    localProRuntimeRecommendation = 'not-recommended'
    localProRuntimeNote = 'Python 3.14 is not recommended yet for Faster-Whisper and Demucs production runtime support.'
  }

  return {
    path: parsed.path || pythonPath,
    version: parsed.version || null,
    majorMinor,
    selector: null,
    healthy,
    healthReason,
    stdlibLikelyPresent: !!parsed.stdlibLikelyPresent,
    pipImportable: !!parsed.pipImportable,
    pipVersion,
    localProRuntimeRecommendation,
    localProRuntimeNote,
  }
}

async function detectSpecificVersion(version) {
  const snippet = [
    'import json, sys',
    "print(json.dumps({'path': sys.executable, 'version': sys.version.split()[0]}))",
  ].join('; ')
  const result = await runProcess('py', [`-V:${version}`, '-c', snippet])
  if (result.code !== 0) {
    return { available: false, version, path: null, probe: null }
  }
  const line = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop()
  if (!line) return { available: false, version, path: null, probe: null }
  try {
    const parsed = JSON.parse(line)
    const probe = await probePythonPath(parsed.path)
    return {
      available: true,
      version,
      path: parsed.path || null,
      probe,
    }
  } catch {
    return { available: false, version, path: null, probe: null }
  }
}

function buildSetupCommands() {
  const workspaceVenv = path.join(process.cwd(), '.venv-local-pro')
  return {
    installPython311: [
      'winget install --id Python.Python.3.11 -e --source winget',
      'py -0p',
      'py -V:3.11 --version',
    ],
    createProjectVenv: [
      `py -V:3.11 -m venv "${workspaceVenv}"`,
      `& "${workspaceVenv}\\Scripts\\Activate.ps1"`,
      'python -m pip install --upgrade pip setuptools wheel',
      'python -m pip --version',
    ],
  }
}

async function detectPythonRunner() {
  const candidates = [
    { command: 'py', prefixArgs: [] },
    { command: 'python', prefixArgs: [] },
    { command: 'python3', prefixArgs: [] },
  ]

  const probeSnippet = [
    'import json, sys',
    "print(json.dumps({'path': sys.executable, 'version': sys.version.split()[0]}))",
  ].join('; ')

  for (const candidate of candidates) {
    const result = await runProcess(candidate.command, [...candidate.prefixArgs, '-c', probeSnippet])
    if (result.code !== 0) continue
    const line = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop()
    if (!line) continue
    try {
      const parsed = JSON.parse(line)
      return {
        command: candidate.command,
        prefixArgs: candidate.prefixArgs,
        path: parsed.path || null,
        version: parsed.version || null,
      }
    } catch {
      // continue
    }
  }

  return { command: null, prefixArgs: [], path: null, version: null }
}

function parsePipVersion(output) {
  const text = String(output || '').trim()
  const match = text.match(/^pip\s+([^\s]+)/im)
  return match ? match[1] : null
}

async function detectPip(pythonRunner) {
  if (pythonRunner.command) {
    const viaPython = await runProcess(
      pythonRunner.command,
      [...pythonRunner.prefixArgs, '-m', 'pip', '--version']
    )
    if (viaPython.code === 0) {
      return {
        pip: `${pythonRunner.command} -m pip`,
        pipVersion: parsePipVersion(viaPython.stdout || viaPython.stderr),
      }
    }
  }

  const direct = await runProcess('pip', ['--version'])
  if (direct.code === 0) {
    return {
      pip: 'pip',
      pipVersion: parsePipVersion(direct.stdout || direct.stderr),
    }
  }

  return { pip: null, pipVersion: null }
}

async function detectPythonPackage(pythonRunner, importName) {
  if (!pythonRunner.command) return false
  const snippet = [
    'import importlib.util, json',
    `spec = importlib.util.find_spec(${JSON.stringify(importName)})`,
    "print(json.dumps({'found': bool(spec)}))",
  ].join('; ')
  const result = await runProcess(pythonRunner.command, [...pythonRunner.prefixArgs, '-c', snippet])
  if (result.code !== 0) return false
  const line = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop()
  if (!line) return false
  try {
    const parsed = JSON.parse(line)
    return !!parsed.found
  } catch {
    return false
  }
}

async function main() {
  const pythonRunner = await detectPythonRunner()
  const explicitChecks = {
    '3.10': await detectSpecificVersion('3.10'),
    '3.11': await detectSpecificVersion('3.11'),
    '3.12': await detectSpecificVersion('3.12'),
    '3.14': await detectSpecificVersion('3.14'),
  }

  const byVersion = {
    '3.10': explicitChecks['3.10'].available && explicitChecks['3.10'].probe ? [explicitChecks['3.10'].probe] : [],
    '3.11': explicitChecks['3.11'].available && explicitChecks['3.11'].probe ? [explicitChecks['3.11'].probe] : [],
    '3.12': explicitChecks['3.12'].available && explicitChecks['3.12'].probe ? [explicitChecks['3.12'].probe] : [],
    '3.14': explicitChecks['3.14'].available && explicitChecks['3.14'].probe ? [explicitChecks['3.14'].probe] : [],
  }

  const brokenPython314Probe = await probePythonPath('C:\\Python314\\python.exe')
  const brokenPython314 = String(brokenPython314Probe.path || '').toLowerCase() === 'c:\\python314\\python.exe' &&
    (!brokenPython314Probe.healthy || !brokenPython314Probe.stdlibLikelyPresent || !brokenPython314Probe.pipImportable)
    ? brokenPython314Probe
    : null

  const pip = await detectPip(pythonRunner)
  const fasterWhisperInstalled = await detectPythonPackage(pythonRunner, 'faster_whisper')
  const demucsInstalled = await detectPythonPackage(pythonRunner, 'demucs')
  const activeMajorMinor = parseMajorMinor(pythonRunner.version)

  const compatibility = {
    recommendedLocalProRuntime: '3.11',
    warning: 'Python 3.14 is not recommended yet for Faster-Whisper and Demucs production runtime support.',
    python311Detected: explicitChecks['3.11'].available,
    python310Detected: explicitChecks['3.10'].available,
    python312Detected: explicitChecks['3.12'].available,
    python314Detected: explicitChecks['3.14'].available,
  }

  const installationHealth = {
    brokenPython314: brokenPython314 ? {
      path: brokenPython314.path,
      healthReason: brokenPython314.healthReason,
      stdlibLikelyPresent: brokenPython314.stdlibLikelyPresent,
      pipImportable: brokenPython314.pipImportable,
      note: 'Detected unhealthy C:\\Python314 install.',
    } : null,
    healthyUvManaged314: String(pythonRunner.path || '').toLowerCase().includes('\\appdata\\roaming\\uv\\python\\') &&
      activeMajorMinor === '3.14' &&
      !!pip.pipVersion
      ? {
      path: pythonRunner.path,
      healthy: true,
      localProRuntimeRecommendation: 'not-recommended',
      note: 'uv-managed Python 3.14 is healthy, but not recommended for Local Pro production runtime.',
    }
      : null,
  }

  const nextStepCommands = buildSetupCommands()

  const result = {
    python: pythonRunner.path,
    pythonVersion: pythonRunner.version,
    pip: pip.pip,
    pipVersion: pip.pipVersion,
    venvRecommended: !process.env.VIRTUAL_ENV,
    fasterWhisperInstalled,
    demucsInstalled,
    compatibility,
    detectedVersions: byVersion,
    installationHealth,
    nextStepCommands,
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
