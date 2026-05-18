// @ts-check
/**
 * Piper TTS — Electron main-process module
 *
 * Downloads the Piper binary + voice model to userData/piper/ on demand.
 * Exposes IPC handlers:
 *   tts:piper-voices-catalog  → returns the bundled voice catalog
 *   tts:piper-voice-status    → returns { downloaded, path } for a voice
 *   tts:piper-download-voice  → downloads binary + voice (sends progress events)
 *   tts:piper-synthesize      → synthesizes text → WAV file path
 */

'use strict'

const path = require('path')
const fs = require('fs/promises')
const { createWriteStream, existsSync } = require('fs')
const https = require('https')
const http = require('http')
const { spawn } = require('child_process')
const { app, ipcMain, BrowserWindow } = require('electron')

// ── Voice catalog ──────────────────────────────────────────────────────────
// Each entry: { id, label, language, quality, modelUrl, modelSize, configUrl }
// All URLs point to the official Hugging Face rhasspy/piper-voices repository.

const HF_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main'

const VOICE_CATALOG = [
  {
    id: 'en_US-lessac-medium',
    label: 'Lessac (en-US, Medium)',
    language: 'en-US',
    quality: 'medium',
    modelUrl: `${HF_BASE}/en/en_US/lessac/medium/en_US-lessac-medium.onnx`,
    configUrl: `${HF_BASE}/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json`,
    modelSize: 63,
  },
  {
    id: 'en_US-ryan-high',
    label: 'Ryan (en-US, High)',
    language: 'en-US',
    quality: 'high',
    modelUrl: `${HF_BASE}/en/en_US/ryan/high/en_US-ryan-high.onnx`,
    configUrl: `${HF_BASE}/en/en_US/ryan/high/en_US-ryan-high.onnx.json`,
    modelSize: 80,
  },
  {
    id: 'en_US-amy-medium',
    label: 'Amy (en-US, Medium)',
    language: 'en-US',
    quality: 'medium',
    modelUrl: `${HF_BASE}/en/en_US/amy/medium/en_US-amy-medium.onnx`,
    configUrl: `${HF_BASE}/en/en_US/amy/medium/en_US-amy-medium.onnx.json`,
    modelSize: 63,
  },
  {
    id: 'en_GB-cori-medium',
    label: 'Cori (en-GB, Medium)',
    language: 'en-GB',
    quality: 'medium',
    modelUrl: `${HF_BASE}/en/en_GB/cori/medium/en_GB-cori-medium.onnx`,
    configUrl: `${HF_BASE}/en/en_GB/cori/medium/en_GB-cori-medium.onnx.json`,
    modelSize: 60,
  },
  {
    id: 'en_US-hfc_female-medium',
    label: 'HFC Female (en-US, Medium)',
    language: 'en-US',
    quality: 'medium',
    modelUrl: `${HF_BASE}/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx`,
    configUrl: `${HF_BASE}/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json`,
    modelSize: 62,
  },
  {
    id: 'en_US-hfc_male-medium',
    label: 'HFC Male (en-US, Medium)',
    language: 'en-US',
    quality: 'medium',
    modelUrl: `${HF_BASE}/en/en_US/hfc_male/medium/en_US-hfc_male-medium.onnx`,
    configUrl: `${HF_BASE}/en/en_US/hfc_male/medium/en_US-hfc_male-medium.onnx.json`,
    modelSize: 62,
  },
]

// ── Piper binary download URLs ──────────────────────────────────────────────
// Official release: https://github.com/rhasspy/piper/releases/tag/2023.11.14-2

const PIPER_VERSION = '2023.11.14-2'
const PIPER_BASE = `https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}`

function getPiperDownloadUrl() {
  const p = process.platform
  const a = process.arch
  if (p === 'win32') {
    return { url: `${PIPER_BASE}/piper_windows_amd64.zip`, isZip: true, exe: 'piper/piper.exe' }
  }
  if (p === 'darwin') {
    const suffix = a === 'arm64' ? 'macos_aarch64' : 'macos_x64'
    return { url: `${PIPER_BASE}/piper_${suffix}.tar.gz`, isZip: false, exe: 'piper/piper' }
  }
  // linux
  const suffix = a === 'arm64' ? 'linux_aarch64' : 'linux_x86_64'
  return { url: `${PIPER_BASE}/piper_${suffix}.tar.gz`, isZip: false, exe: 'piper/piper' }
}

// ── Paths ──────────────────────────────────────────────────────────────────

function getPiperDir() {
  return path.join(app.getPath('userData'), 'piper')
}

function getPiperExe() {
  const { exe } = getPiperDownloadUrl()
  return path.join(getPiperDir(), exe)
}

function getVoiceModelPath(voiceId) {
  return path.join(getPiperDir(), 'voices', `${voiceId}.onnx`)
}

function getVoiceConfigPath(voiceId) {
  return path.join(getPiperDir(), 'voices', `${voiceId}.onnx.json`)
}

// ── Download helper ────────────────────────────────────────────────────────

function httpsGetFollow(urlStr, redirects = 10) {
  return new Promise((resolve, reject) => {
    if (redirects <= 0) { reject(new Error('Too many redirects')); return }
    // Validate URL — catches relative paths from misconfigured redirect chains
    let parsedUrl
    try { parsedUrl = new URL(urlStr) } catch { reject(new Error(`Invalid URL: ${urlStr}`)); return }
    const mod = parsedUrl.protocol === 'http:' ? http : https
    mod.get(urlStr, { headers: { 'User-Agent': 'FluxAura/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Resolve relative redirect URLs against the original base URL
        const redirectUrl = new URL(res.headers.location, urlStr).toString()
        httpsGetFollow(redirectUrl, redirects - 1).then(resolve, reject)
        res.resume()
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${urlStr}`))
        res.resume()
        return
      }
      resolve(res)
    }).on('error', reject)
  })
}

async function downloadFile(url, destPath, onProgress) {
  await fs.mkdir(path.dirname(destPath), { recursive: true })
  const res = await httpsGetFollow(url)
  const total = parseInt(res.headers['content-length'] || '0', 10)
  let received = 0
  const tmp = destPath + '.tmp'
  await new Promise((resolve, reject) => {
    const ws = createWriteStream(tmp)
    res.on('data', (chunk) => {
      received += chunk.length
      if (total > 0 && onProgress) onProgress(Math.round((received / total) * 100), received, total)
    })
    res.pipe(ws)
    ws.on('finish', () => resolve())
    ws.on('error', reject)
    res.on('error', reject)
  })
  await fs.rename(tmp, destPath)
}

async function extractZip(zipPath, destDir) {
  // Use PowerShell Expand-Archive on Windows (no npm dep needed)
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destDir}" -Force`,
    ])
    ps.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`powershell exit ${code}`))
    })
    ps.on('error', reject)
  })
}

async function extractTarGz(tarPath, destDir) {
  return new Promise((resolve, reject) => {
    const tar = spawn('tar', ['-xzf', tarPath, '-C', destDir])
    tar.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`tar exit ${code}`))
    })
    tar.on('error', reject)
  })
}

// ── Check if piper binary exists and is executable ─────────────────────────

async function isPiperReady() {
  const exe = getPiperExe()
  if (!existsSync(exe)) return false
  try {
    await fs.access(exe, 0o111) // X_OK
    return true
  } catch {
    // on windows access flags don't matter for .exe
    return process.platform === 'win32'
  }
}

function isVoiceReady(voiceId) {
  return existsSync(getVoiceModelPath(voiceId)) && existsSync(getVoiceConfigPath(voiceId))
}

// ── Send progress to renderer ──────────────────────────────────────────────

function sendProgress(event, stage, percent, detail) {
  try {
    // Try the sender window first, fall back to first focused window
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('tts:piper-download-progress', { stage, percent, detail })
    }
  } catch { /* noop */ }
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

function registerPiperIPC() {
  // Return the full voice catalog
  ipcMain.handle('tts:piper-voices-catalog', () => {
    return VOICE_CATALOG.map((v) => ({
      ...v,
      downloaded: isVoiceReady(v.id),
      piperReady: existsSync(getPiperExe()),
    }))
  })

  // Status of a single voice
  ipcMain.handle('tts:piper-voice-status', async (_event, voiceId) => {
    return {
      downloaded: isVoiceReady(String(voiceId || '')),
      piperReady: await isPiperReady(),
    }
  })

  // Download piper binary + a specific voice model
  ipcMain.handle('tts:piper-download-voice', async (event, voiceId) => {
    const voice = VOICE_CATALOG.find((v) => v.id === voiceId)
    if (!voice) return { ok: false, error: `Unknown voice: ${voiceId}` }

    const piperDir = getPiperDir()
    const voiceDir = path.join(piperDir, 'voices')
    await fs.mkdir(voiceDir, { recursive: true })

    // 1. Download Piper binary if needed
    if (!(await isPiperReady())) {
      const { url, isZip, exe } = getPiperDownloadUrl()
      const archiveName = path.basename(url)
      const archiveDest = path.join(piperDir, archiveName)
      sendProgress(event, 'binary', 0, 'Downloading Piper binary…')
      try {
        await downloadFile(url, archiveDest, (pct) => sendProgress(event, 'binary', pct, 'Downloading Piper binary…'))
        sendProgress(event, 'binary', 100, 'Extracting Piper binary…')
        if (isZip) {
          await extractZip(archiveDest, piperDir)
        } else {
          await extractTarGz(archiveDest, piperDir)
        }
        await fs.unlink(archiveDest).catch(() => {})
        // On Unix, make the binary executable
        if (process.platform !== 'win32') {
          const exeFull = path.join(piperDir, exe)
          await fs.chmod(exeFull, 0o755).catch(() => {})
        }
      } catch (err) {
        return { ok: false, error: `Binary download failed: ${err.message}` }
      }
    }

    // 2. Download voice model if needed
    if (!isVoiceReady(voiceId)) {
      const modelDest = getVoiceModelPath(voiceId)
      const configDest = getVoiceConfigPath(voiceId)
      sendProgress(event, 'voice', 0, `Downloading ${voice.label}…`)
      try {
        await downloadFile(voice.modelUrl, modelDest, (pct) => sendProgress(event, 'voice', pct, `Downloading ${voice.label}…`))
        sendProgress(event, 'config', 0, 'Downloading voice config…')
        await downloadFile(voice.configUrl, configDest, (pct) => sendProgress(event, 'config', pct, 'Downloading voice config…'))
      } catch (err) {
        return { ok: false, error: `Voice download failed: ${err.message}` }
      }
    }

    return { ok: true }
  })

  // Synthesize text → WAV file path
  ipcMain.handle('tts:piper-synthesize', async (_event, payload) => {
    const { text, voiceId, outputPath: customOutput, rate } = payload || {}
    if (!text) return { ok: false, error: 'No text provided' }
    if (!voiceId) return { ok: false, error: 'No voiceId provided' }

    if (!(await isPiperReady())) return { ok: false, error: 'Piper binary not installed — download a voice first' }
    if (!isVoiceReady(voiceId)) return { ok: false, error: `Voice "${voiceId}" not downloaded` }

    const modelPath = getVoiceModelPath(voiceId)
    const outFile = customOutput || path.join(app.getPath('temp'), `piper_${Date.now()}.wav`)
    await fs.mkdir(path.dirname(outFile), { recursive: true })

    const piperExe = getPiperExe()
    const args = [
      '--model', modelPath,
      '--output_file', outFile,
    ]
    if (rate && rate !== 1) args.push('--length_scale', String(1 / Number(rate)))

    return new Promise((resolve) => {
      const proc = spawn(piperExe, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      proc.stdin.write(String(text))
      proc.stdin.end()
      let stderr = ''
      proc.stderr.on('data', (d) => { stderr += d.toString() })
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true, path: outFile })
        } else {
          resolve({ ok: false, error: `Piper exited ${code}: ${stderr.slice(0, 300)}` })
        }
      })
      proc.on('error', (err) => resolve({ ok: false, error: err.message }))
      // Timeout: 60 seconds
      const timeout = setTimeout(() => {
        proc.kill()
        resolve({ ok: false, error: 'Synthesis timed out' })
      }, 60_000)
      proc.on('close', () => clearTimeout(timeout))
    })
  })

  // Install only the Piper binary (for when voices exist but binary is missing)
  ipcMain.handle('tts:piper-install-binary', async (event) => {
    const piperDir = getPiperDir()
    await fs.mkdir(piperDir, { recursive: true })
    if (await isPiperReady()) return { ok: true, alreadyInstalled: true }
    const { url, isZip, exe } = getPiperDownloadUrl()
    const archiveName = path.basename(url)
    const archiveDest = path.join(piperDir, archiveName)
    sendProgress(event, 'binary', 0, 'Downloading Piper binary…')
    try {
      await downloadFile(url, archiveDest, (pct) => sendProgress(event, 'binary', pct, 'Downloading Piper binary…'))
      sendProgress(event, 'binary', 100, 'Extracting Piper binary…')
      if (isZip) {
        await extractZip(archiveDest, piperDir)
      } else {
        await extractTarGz(archiveDest, piperDir)
      }
      await fs.unlink(archiveDest).catch(() => {})
      if (process.platform !== 'win32') {
        const exeFull = path.join(piperDir, exe)
        await fs.chmod(exeFull, 0o755).catch(() => {})
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: `Binary install failed: ${err.message}` }
    }
  })

  // Return list of already-downloaded WAV files from temp (for cleanup info)
  ipcMain.handle('tts:piper-list-cached', async () => {
    const voiceDir = path.join(getPiperDir(), 'voices')
    try {
      const files = await fs.readdir(voiceDir)
      const voices = files
        .filter((f) => f.endsWith('.onnx') && !f.endsWith('.json'))
        .map((f) => f.replace(/\.onnx$/, ''))
      return { ok: true, voices }
    } catch {
      return { ok: true, voices: [] }
    }
  })
}

module.exports = { registerPiperIPC, VOICE_CATALOG }
