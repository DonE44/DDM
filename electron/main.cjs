const { app, BrowserWindow, ipcMain, dialog, protocol, session } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')
const fsp = require('fs/promises')
const fs = require('fs')

// ── Launch diagnostics ──────────────────────────────────────────────────────
const _diagLog = path.join(require('os').tmpdir(), 'fluxaura-studio-launch.log')
const _diagWrite = (msg) => { try { fs.appendFileSync(_diagLog, new Date().toISOString() + ' ' + msg + '\n') } catch {} }

function handleFatalError(title, err) {
  const msg = err?.stack || String(err)
  _diagWrite(`FATAL_ERROR: ${title}\n${msg}`)
  console.error(`[FATAL ERROR] ${title}:`, msg)
  
  if (app && app.isReady()) {
    dialog.showErrorBox(title, `A fatal error occurred in the main process:\n\n${msg}\n\nThis error has been logged to:\n${_diagLog}`)
  }
}

_diagWrite('MAIN_START process.argv=' + process.argv.join('|'))
process.on('exit', (code) => _diagWrite('PROCESS_EXIT code=' + code))
process.on('uncaughtException', (err) => handleFatalError('Uncaught Exception', err))
process.on('unhandledRejection', (reason) => handleFatalError('Unhandled Rejection', reason))

const { createReadStream } = require('fs')
const { Readable } = require('stream')
const http = require('http')
const { spawn } = require('child_process')
let ffmpegStaticPath = null
try {
  ffmpegStaticPath = require('ffmpeg-static')
} catch {
  ffmpegStaticPath = null
}
const {
  MEDIA_FILTERS,
  getSupportedMedia,
  getMediaCapability,
  getMediaPipelinePlan,
} = require('./media-capabilities.cjs')
const { transcodeMedia } = require('./media-transcode.cjs')
const { registerPiperIPC } = require('./piper-tts.cjs')
const { registerWhisperTranscribeIPC } = require('./whisper-transcribe.cjs')
const { registerLyricExportIPC } = require('./lyric-export.cjs')
const { registerTranslateIPC } = require('./translate-ipc.cjs')
const { registerZipEncryptIPC } = require('./zip-encrypt.cjs')
const hfAuth = require('./hf-auth.cjs')
_diagWrite('REQUIRES_DONE app=' + (typeof app) + ' isPackaged=' + (app && app.isPackaged))

const APP_TITLE = 'FluxAura Studio'

// Resolve window icon (PNG preferred; ICO used on Windows packaged builds)
const _iconPng = path.join(__dirname, '..', 'resources', 'icon.png')
const _iconIco = path.join(__dirname, '..', 'resources', 'icon.ico')
const _windowIcon = (() => {
  if (process.platform === 'win32' && require('fs').existsSync(_iconIco)) return _iconIco
  if (require('fs').existsSync(_iconPng)) return _iconPng
  return null
})()
const IS_DEV = app && !app.isPackaged
const APP_ARGS = process.argv.map((arg) => String(arg || '').toLowerCase())
const START_KIOSK = APP_ARGS.includes('--kiosk') || APP_ARGS.includes('--player')
const DEV_SERVER_URL = process.env.FLUXAURA_STUDIO_DEV_URL || process.env.SMME_DEV_URL || 'http://127.0.0.1:5173'

let mainWindow = null

// Local HTTP media server — avoids Readable.toWeb() issues with Chromium's media pipeline
let _mediaServer = null
let _mediaServerPort = 0



function startMediaServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // Allow CORS so the renderer at any origin can load media
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      try {
        const urlObj = new URL(req.url, `http://127.0.0.1:${_mediaServerPort}`)
        const searchParams = urlObj.searchParams
        const filePath = searchParams.get('p')

        // ── App static files (index.html, assets, etc.) ──────────────────────────
        // If no ?p= parameter, serve from dist/ (for bundled app loading via HTTP)
        if (!filePath) {
          let reqPath = decodeURIComponent(urlObj.pathname)
          if (reqPath === '/') reqPath = '/index.html'
          
          let distRoot = path.join(__dirname, '..', 'dist')
          let staticPath = path.join(distRoot, reqPath)
          
          // Prevent directory traversal attacks
          const normalized = path.normalize(staticPath)
          if (!normalized.startsWith(path.normalize(distRoot))) {
            res.writeHead(403)
            res.end('Forbidden')
            return
          }

          fsp.stat(staticPath).then((stat) => {
            if (stat.isDirectory()) {
              staticPath = path.join(staticPath, 'index.html')
              return fsp.stat(staticPath)
            }
            return stat
          }).then((stat) => {
            const totalSize = stat.size
            const mimeType = getMimeType(staticPath, 'text')
            const rangeHeader = req.headers['range']

            res.setHeader('Accept-Ranges', 'bytes')
            res.setHeader('Content-Type', mimeType)
            res.setHeader('Cache-Control', 'no-cache')

            let start = 0
            let end = totalSize - 1
            let statusCode = 200

            if (rangeHeader) {
              const rangeMatch = rangeHeader.match(/bytes=(\d*)-(\d*)/)
              const suffixMatch = !rangeMatch && rangeHeader.match(/bytes=-(\d+)/)
              if (suffixMatch) {
                const len = parseInt(suffixMatch[1], 10)
                start = Math.max(0, totalSize - len)
              } else if (rangeMatch) {
                if (rangeMatch[1]) start = parseInt(rangeMatch[1], 10)
                if (rangeMatch[2]) end = Math.min(parseInt(rangeMatch[2], 10), totalSize - 1)
              }
              res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`)
              res.setHeader('Content-Length', String(end - start + 1))
              statusCode = 206
            } else {
              res.setHeader('Content-Length', String(totalSize))
            }

            res.writeHead(statusCode)

            if (req.method === 'HEAD') {
              res.end()
              return
            }

            const stream = createReadStream(staticPath, { start, end })
            stream.pipe(res)
            stream.on('error', (err) => {
              console.error('[media-server] stream error:', err.message)
              try { res.destroy() } catch { /* ignore */ }
            })
          }).catch((err) => {
            console.error('[media-server] file not found:', staticPath, err.message)
            res.writeHead(404)
            res.end('Not found')
          })
          return
        }

        // ── Media files (?p=filepath) ──────────────────────────────────────────
        fsp.stat(filePath).then((stat) => {
          const totalSize = stat.size
          const mimeType = getMimeType(filePath, 'video')
          const rangeHeader = req.headers['range']

          res.setHeader('Accept-Ranges', 'bytes')
          res.setHeader('Content-Type', mimeType)
          res.setHeader('Cache-Control', 'no-cache')

          let start = 0
          let end = totalSize - 1
          let statusCode = 200

          if (rangeHeader) {
            const rangeMatch = rangeHeader.match(/bytes=(\d*)-(\d*)/)
            const suffixMatch = !rangeMatch && rangeHeader.match(/bytes=-(\d+)/)
            if (suffixMatch) {
              const len = parseInt(suffixMatch[1], 10)
              start = Math.max(0, totalSize - len)
            } else if (rangeMatch) {
              if (rangeMatch[1]) start = parseInt(rangeMatch[1], 10)
              if (rangeMatch[2]) end = Math.min(parseInt(rangeMatch[2], 10), totalSize - 1)
            }
            res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`)
            res.setHeader('Content-Length', String(end - start + 1))
            statusCode = 206
          } else {
            res.setHeader('Content-Length', String(totalSize))
          }

          res.writeHead(statusCode)

          if (req.method === 'HEAD') {
            res.end()
            return
          }

          const stream = createReadStream(filePath, { start, end })
          stream.pipe(res)
          stream.on('error', (err) => {
            console.error('[media-server] stream error:', err.message)
            try { res.destroy() } catch { /* ignore */ }
          })
        }).catch((err) => {
          console.error('[media-server] file not found:', filePath, err.message)
          res.writeHead(404)
          res.end('Not found')
        })
      } catch (err) {
        console.error('[media-server] request error:', err.message)
        res.writeHead(500)
        res.end()
      }
    })

    server.listen(0, '127.0.0.1', () => {
      _mediaServerPort = server.address().port
      _mediaServer = server
      console.log(`[media-server] listening on http://127.0.0.1:${_mediaServerPort}`)
      resolve(_mediaServerPort)
    })

    server.on('error', (err) => {
      console.error('[media-server] server error:', err.message)
      resolve(0)
    })
  })
}

function probeBinary(command, args = ['-version']) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { windowsHide: true })
    let stderr = ''
    let stdout = ''

    const killTimer = setTimeout(() => {
      proc.kill()
      resolve({ available: false, detail: `${command} probe timed out` })
    }, 5000)

    proc.stdout.on('data', (chunk) => {
      stdout += String(chunk || '')
      if (stdout.length > 300) stdout = stdout.slice(0, 300)
    })

    proc.stderr.on('data', (chunk) => {
      stderr += String(chunk || '')
      if (stderr.length > 300) stderr = stderr.slice(0, 300)
    })

    proc.on('error', () => {
      clearTimeout(killTimer)
      resolve({ available: false, detail: `${command} not found` })
    })

    proc.on('close', (code) => {
      clearTimeout(killTimer)
      if (code === 0) {
        resolve({ available: true, detail: (stdout || stderr || `${command} available`).trim() })
        return
      }
      resolve({ available: false, detail: (stderr || stdout || `${command} probe failed`).trim() })
    })
  })
}

function getMimeType(filePath, fallbackCategory = 'image') {
  const ext = path.extname(String(filePath || '')).replace('.', '').toLowerCase()
  const map = {
    bmp: 'image/bmp',
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    ico: 'image/x-icon',
    wav: 'audio/wav',
    mid: 'audio/midi',
    midi: 'audio/midi',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    opus: 'audio/opus',
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    wmv: 'video/x-ms-wmv',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    ts: 'video/mp2t',
    m2ts: 'video/mp2t',
    flc: 'video/x-flic',
    fli: 'video/x-flic',
    pdf: 'application/pdf',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    mjs: 'application/javascript',
    json: 'application/json',
    txt: 'text/plain',
    xml: 'application/xml',
    svg: 'image/svg+xml',
  }
  if (map[ext]) return map[ext]
  if (fallbackCategory === 'video') return 'video/mp4'
  if (fallbackCategory === 'audio') return 'audio/mpeg'
  if (fallbackCategory === 'text') return 'text/plain'
  return 'image/png'
}

// Register app-media:// as a privileged scheme BEFORE app ready so the
// renderer can use fetch() and <video src> against it without CORS issues.
if (protocol) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app-media',
      privileges: {
        standard: true,
        secure: true,
        corsEnabled: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ])
}

// Allow audio/video to autoplay without requiring a prior user gesture (needed in dev+prod)
if (app) {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
  app.commandLine.appendSwitch('disable-gpu-sandbox')
  if (process.platform === 'win32') {
    // Prevent noisy DirectComposition overlay probe errors on some Windows GPU drivers.
    app.commandLine.appendSwitch('disable-direct-composition')
    app.commandLine.appendSwitch('disable-features', 'DirectComposition')
  }
}

if (IS_DEV && app) {
  const devRuntimeRoot = path.join(app.getPath('temp'), 'FluxAura-Studio-dev-runtime', String(process.pid))
  app.setPath('userData', path.join(devRuntimeRoot, 'user-data'))
  app.setPath('sessionData', path.join(devRuntimeRoot, 'session-data'))
  app.commandLine.appendSwitch('disable-http-cache')
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
}

// Stable auto-save path that survives crashes (lives outside the per-PID temp dir)
const DEV_AUTOSAVE_PATH = IS_DEV && app
  ? path.join(app.getPath('temp'), 'FluxAura-Studio-dev-user-data', 'autosave.mme')
  : null
// Sidecar that records the real project name for the autosave
const DEV_AUTOSAVE_META_PATH = IS_DEV && app
  ? path.join(app.getPath('temp'), 'FluxAura-Studio-dev-user-data', 'autosave.meta.json')
  : null

function applyKioskGuard(win) {
  if (!win) return
  win.setMenuBarVisibility(false)
  win.webContents.on('before-input-event', (event, input) => {
    const key = String(input.key || '').toLowerCase()
    const altF4 = input.alt && key === 'f4'
    const ctrlW = input.control && key === 'w'
    const f11 = key === 'f11'
    if (altF4 || ctrlW || f11) {
      event.preventDefault()
    }
  })
}

function setKioskMode(win, enabled) {
  if (!win || win.isDestroyed()) return false
  win.setMenuBarVisibility(false)
  win.setAlwaysOnTop(Boolean(enabled), 'screen-saver')
  win.setFullScreen(Boolean(enabled))
  win.setKiosk(Boolean(enabled))
  return true
}

function createWindow() {
  const win = new BrowserWindow({
    title: APP_TITLE,
    ...(_windowIcon ? { icon: _windowIcon } : {}),
    width: START_KIOSK ? 1920 : 1600,
    height: START_KIOSK ? 1080 : 980,
    minWidth: START_KIOSK ? 1024 : 1200,
    minHeight: START_KIOSK ? 768 : 760,
    kiosk: START_KIOSK,
    fullscreen: START_KIOSK,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      enableRemoteModule: false,
      sandbox: true,
    },
  })

  const showMainWindow = (reason) => {
    if (win.isDestroyed()) return
    _diagWrite(`WINDOW_SHOW reason=${reason} visible=${win.isVisible()} minimized=${win.isMinimized()} bounds=${JSON.stringify(win.getBounds())}`)
    if (!START_KIOSK) {
      win.setBounds({ x: 80, y: 80, width: 1600, height: 980 })
      win.center()
    }
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }

  win.once('ready-to-show', () => showMainWindow('ready-to-show'))
  win.webContents.once('did-finish-load', () => showMainWindow('did-finish-load'))
  win.webContents.on('dom-ready', () => _diagWrite('DOM_READY url=' + win.webContents.getURL()))
  win.webContents.on('did-start-loading', () => _diagWrite('DID_START_LOADING url=' + win.webContents.getURL()))

  if (IS_DEV && (process.env.FLUXAURA_STUDIO_DEV_URL || process.env.SMME_DEV_URL)) {
    win.loadURL(DEV_SERVER_URL)
  } else {
    // Load packaged app from local HTTP server (not file://) to allow Whisper
    // to fetch models from HuggingFace CDN without CORS restrictions
    const distPath = path.join(__dirname, '..', 'dist', 'index.html')
    console.log('[FluxAura Studio] Loading packaged app:', { IS_DEV, distPath, exists: require('fs').existsSync(distPath) })
    win.loadURL(`http://127.0.0.1:${_mediaServerPort}`)
  }

  if (START_KIOSK) {
    applyKioskGuard(win)
    setKioskMode(win, true)
  }

  setTimeout(() => showMainWindow('fallback-timeout'), 3000)

  return win
}

if (app) {
  app.on('before-quit', () => _diagWrite('BEFORE_QUIT stack=' + new Error().stack.split('\n').slice(1,4).join('|')))
  app.on('quit', (_, code) => _diagWrite('APP_QUIT exitCode=' + code))
  app.whenReady().then(async () => {
    _diagWrite('APP_READY')
    // Start local HTTP media server before creating the window so media is
    // ready to serve as soon as the renderer requests it.
    await startMediaServer()
    _diagWrite('MEDIA_SERVER_STARTED port=' + _mediaServerPort)

    // ── HuggingFace token authentication setup ──────────────────────────────────
    const userDataPath = app.getPath('userData')
    hfAuth.init(userDataPath)
    
    // Load token if available and set HF_TOKEN env var
    const token = await hfAuth.getToken()
    if (token) {
      console.log('[hf-auth] Token loaded from config, HF_TOKEN set')
    }
    _diagWrite('HF_AUTH_DONE')

    // Keep app-media:// registered as a fallback (for edge cases / future use)
    protocol.handle('app-media', async (request) => {
      // Handle CORS pre-flight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Type',
          },
      })
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url).pathname)
      // On Windows the pathname starts with an extra '/' before the drive letter
      const filePath = process.platform === 'win32' ? pathname.replace(/^\//, '') : pathname

      const stat = await fsp.stat(filePath)
      const totalSize = stat.size
      const mimeType = getMimeType(filePath, 'video')

      const rangeHeader = request.headers.get('Range')
      const rangeMatch = rangeHeader?.match(/bytes=(\d*)-(\d*)/)
      // Handle suffix range (bytes=-N) — serve last N bytes
      const suffixMatch = !rangeMatch && rangeHeader?.match(/bytes=-(\d+)/)
      let start, end, isPartial
      if (suffixMatch) {
        const suffixLen = parseInt(suffixMatch[1], 10)
        start = Math.max(0, totalSize - suffixLen)
        end = totalSize - 1
        isPartial = true
      } else {
        start = rangeMatch?.[1] ? parseInt(rangeMatch[1], 10) : 0
        end = rangeMatch?.[2]
          ? Math.min(parseInt(rangeMatch[2], 10), totalSize - 1)
          : totalSize - 1
        isPartial = Boolean(rangeMatch)
      }
      const chunkSize = end - start + 1

      const nodeStream = createReadStream(filePath, { start, end })
      const webStream = Readable.toWeb(nodeStream)

      return new Response(webStream, {
        status: isPartial ? 206 : 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(chunkSize),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Cache-Control': 'no-cache',
          ...(isPartial
            ? { 'Content-Range': `bytes ${start}-${end}/${totalSize}` }
            : {}),
        },
      })
    } catch (err) {
      console.error('[app-media] protocol error:', err?.message || err, 'url:', request.url)
      return new Response('Not found', { status: 404 })
    }
  })

  mainWindow = createWindow()
  _diagWrite('WINDOW_CREATED')
  mainWindow.webContents.on('render-process-gone', (_, details) => _diagWrite('RENDERER_GONE reason=' + details.reason + ' exitCode=' + details.exitCode))
  mainWindow.webContents.on('did-fail-load', (_, code, desc, url) => _diagWrite('DID_FAIL_LOAD ' + code + ' ' + desc + ' ' + url))

  // ── Piper TTS IPC handlers ─────────────────────────────────────────────────
  registerPiperIPC()

  // ── Whisper transcription IPC handlers (runs in main/Node.js process) ──────
  registerWhisperTranscribeIPC()

  // ── Lyric video export IPC handlers ─────────────────────────────────────────
  registerLyricExportIPC()

  // ── Offline translation IPC handlers (NLLB-200) ──────────────────────────────
  registerTranslateIPC()

  // ── Encrypted ZIP export IPC handler ─────────────────────────────────────────
  registerZipEncryptIPC()

  // ── HuggingFace token authentication IPC handlers ────────────────────────────
  ipcMain.handle('whisper:setHFToken', async (_, token) => {
    console.log('[ipc] whisper:setHFToken called')
    return await hfAuth.setToken(token)
  })

  ipcMain.handle('whisper:getTokenStatus', async () => {
    console.log('[ipc] whisper:getTokenStatus called')
    return await hfAuth.getStatus()
  })

  ipcMain.handle('whisper:clearHFToken', async () => {
    console.log('[ipc] whisper:clearHFToken called')
    return await hfAuth.clearToken()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})
}

if (app) {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

// Expose the local HTTP media server port to the renderer process early so
// preload can read it synchronously before React code starts.
if (ipcMain) {
  ipcMain.handle('media:get-server-port', () => _mediaServerPort)
  ipcMain.on('media:get-server-port-sync', (event) => {
    event.returnValue = _mediaServerPort
  })
}

ipcMain.handle('dialog:open-sca', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open MME Script',
    filters: [
      { name: 'MME Script', extensions: ['mme', 'txt'] },
      { name: 'All files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  const filePath = result.filePaths[0]
  const content = await fsp.readFile(filePath, 'utf8')
  return {
    canceled: false,
    filePath,
    fileName: path.basename(filePath),
    content,
  }
})

ipcMain.handle('dialog:save-sca', async (_event, payload) => {
  const defaultName = payload?.defaultName || 'script.mme'
  let text = payload?.text || ''
  const projectAssetPaths = Array.isArray(payload?.projectAssetPaths) ? payload.projectAssetPaths : []

  const result = await dialog.showSaveDialog({
    title: 'Save MME Script',
    defaultPath: defaultName,
    filters: [{ name: 'MME Script', extensions: ['mme'] }],
  })

  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }

  const replacements = []
  if (projectAssetPaths.length > 0) {
    const projectBase = path.basename(result.filePath, path.extname(result.filePath)) || 'project'
    const assetDir = path.join(path.dirname(result.filePath), `${projectBase}_assets`, 'media')
    await fsp.mkdir(assetDir, { recursive: true })

    const usedNames = new Set()
    for (const srcRaw of projectAssetPaths) {
      const src = String(srcRaw || '')
      if (!src) continue
      try {
        const stat = await fsp.stat(src)
        if (!stat.isFile()) continue
        const parsed = path.parse(src)
        const safeBase = (parsed.name || 'media')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 80) || 'media'
        const ext = parsed.ext || ''
        let fileName = `${safeBase}${ext}`
        let n = 2
        while (usedNames.has(fileName.toLowerCase())) {
          fileName = `${safeBase}-${n}${ext}`
          n += 1
        }
        usedNames.add(fileName.toLowerCase())
        const dest = path.join(assetDir, fileName)
        if (path.resolve(src) !== path.resolve(dest)) {
          await fsp.copyFile(src, dest)
        }
        replacements.push({ from: src, to: dest })
      } catch {
        // Leave the original path in the script; the resolver can still help on reopen.
      }
    }
  }

  for (const { from, to } of replacements) {
    text = text.split(from).join(to)
    text = text.split(from.replace(/\\/g, '\\\\')).join(to.replace(/\\/g, '\\\\'))
  }

  await fsp.writeFile(result.filePath, text, 'utf8')
  return {
    canceled: false,
    filePath: result.filePath,
    fileName: path.basename(result.filePath),
    assetCopies: replacements,
  }
})

// ── Screenshot / Page capture ──────────────────────────────────────────
ipcMain.handle('app:capture-page', async (_evt, opts = {}) => {
  if (!mainWindow) return { ok: false, error: 'No window' }
  try {
    const image = await mainWindow.webContents.capturePage()
    const pngBuffer = image.toPNG()
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: opts.title || 'Save Screenshot',
      defaultPath: opts.defaultName || 'screenshot.png',
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    })
    if (canceled || !filePath) return { ok: false, canceled: true }
    await fsp.writeFile(filePath, pngBuffer)
    return { ok: true, filePath }
  } catch (err) {
    return { ok: false, error: String(err.message || err) }
  }
})

ipcMain.handle('app:save-png', async (_evt, dataUrl, opts = {}) => {
  if (!dataUrl || !dataUrl.startsWith('data:')) return { ok: false, error: 'Invalid data URL' }
  try {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: opts.title || 'Save Image',
      defaultPath: opts.defaultName || 'export.png',
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    })
    if (canceled || !filePath) return { ok: false, canceled: true }
    await fsp.writeFile(filePath, buffer)
    return { ok: true, filePath }
  } catch (err) {
    return { ok: false, error: String(err.message || err) }
  }
})

ipcMain.handle('dialog:select-media', async (_event, payload) => {
  const category = payload?.category || 'image'
  const extraFilters = []
  const supportedExtensions = [
    ...MEDIA_FILTERS.image.extensions,
    ...MEDIA_FILTERS.pdf.extensions,
    ...MEDIA_FILTERS.audio.extensions,
    ...MEDIA_FILTERS.video.extensions,
  ]

  if (category === 'all') {
    extraFilters.push(
      { name: 'Supported media (all)', extensions: supportedExtensions },
      MEDIA_FILTERS.image,
      MEDIA_FILTERS.pdf,
      MEDIA_FILTERS.audio,
      MEDIA_FILTERS.video,
    )
  } else if (MEDIA_FILTERS[category]) {
    extraFilters.push(MEDIA_FILTERS[category])
  } else {
    extraFilters.push(MEDIA_FILTERS.image)
  }

  const result = await dialog.showOpenDialog({
    title: 'Select Media',
    filters: extraFilters,
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  const filePath = result.filePaths[0]
  return {
    canceled: false,
    filePath,
    fileName: path.basename(filePath),
    fileUrl: pathToFileURL(filePath).href,
  }
})

ipcMain.handle('media:read-data-url', async (_event, payload) => {
  const filePath = String(payload?.filePath || '')
  const category = String(payload?.category || 'image')
  if (!filePath) {
    return { ok: false, reason: 'Missing filePath' }
  }

  try {
    const bytes = await fsp.readFile(filePath)
    const mimeType = getMimeType(filePath, category)
    const dataUrl = `data:${mimeType};base64,${bytes.toString('base64')}`
    return {
      ok: true,
      mimeType,
      dataUrl,
    }
  } catch (error) {
    return {
      ok: false,
      reason: String(error?.message || error || 'Unknown media read error'),
    }
  }
})

ipcMain.handle('media:exists', async (_event, payload = {}) => {
  try {
    const filePath = String(payload.filePath || '')
    if (!filePath) return { ok: true, exists: false, reason: 'No file path supplied' }
    if (/^(data:|blob:|app-media:|https?:)/i.test(filePath)) return { ok: true, exists: true, size: 0 }
    const stat = await fs.promises.stat(filePath).catch(() => null)
    return { ok: true, exists: !!stat && stat.isFile(), size: stat?.size || 0 }
  } catch (err) {
    return { ok: false, exists: false, reason: err?.message || String(err) }
  }
})

ipcMain.handle('media:transcode', async (_event, payload) => {
  // Use a stable media-cache root so transcoded files survive dev-mode restarts.
  // In dev mode, userData includes the process PID and changes on every restart — use a
  // shared path under the FluxAura Studio dev-runtime temp dir instead (no PID component).
  const mediaCacheRoot = IS_DEV
    ? path.join(app.getPath('temp'), 'FluxAura-Studio-dev-runtime')
    : app.getPath('userData')
  try {
    return await transcodeMedia({
      ...payload,
      userDataPath: mediaCacheRoot,
    })
  } catch (error) {
    return {
      ok: false,
      reason: String(error?.message || error || 'Unknown transcode error'),
    }
  }
})

function getMediaCacheRoot() {
  const mediaCacheRoot = IS_DEV
    ? path.join(app.getPath('temp'), 'FluxAura-Studio-dev-runtime')
    : app.getPath('userData')
  return path.join(mediaCacheRoot, 'media-cache')
}

async function getDirectoryStats(dir) {
  let files = 0
  let bytes = 0
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const nested = await getDirectoryStats(full)
        files += nested.files
        bytes += nested.bytes
      } else if (entry.isFile()) {
        files += 1
        const stat = await fsp.stat(full)
        bytes += stat.size
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  return { files, bytes }
}

ipcMain.handle('media:cache-stats', async () => {
  const cachePath = getMediaCacheRoot()
  try {
    const stats = await getDirectoryStats(cachePath)
    return { ok: true, cachePath, ...stats }
  } catch (error) {
    return { ok: false, cachePath, files: 0, bytes: 0, reason: String(error?.message || error) }
  }
})

ipcMain.handle('media:cache-clear', async () => {
  const cachePath = getMediaCacheRoot()
  const resolved = path.resolve(cachePath)
  const allowedRoot = path.resolve(IS_DEV ? path.join(app.getPath('temp'), 'FluxAura-Studio-dev-runtime') : app.getPath('userData'))
  if (!resolved.startsWith(allowedRoot + path.sep)) {
    return { ok: false, reason: 'Refusing to clear cache outside FluxAura Studio data folder' }
  }
  try {
    const before = await getDirectoryStats(cachePath)
    await fsp.rm(cachePath, { recursive: true, force: true })
    await fsp.mkdir(cachePath, { recursive: true })
    return { ok: true, cachePath, clearedFiles: before.files, clearedBytes: before.bytes, files: 0, bytes: 0 }
  } catch (error) {
    return { ok: false, cachePath, reason: String(error?.message || error) }
  }
})

ipcMain.handle('media:export-diagnostics', async (_event, payload) => {
  const defaultName = String(payload?.defaultName || `media-diagnostics-${Date.now()}.txt`)
  const reportText = String(payload?.reportText || '')

  const result = await dialog.showSaveDialog({
    title: 'Export Media Diagnostics',
    defaultPath: defaultName,
    filters: [{ name: 'Text', extensions: ['txt'] }],
  })

  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }

  await fsp.writeFile(result.filePath, reportText, 'utf8')
  return {
    canceled: false,
    filePath: result.filePath,
    fileName: path.basename(result.filePath),
  }
})

ipcMain.handle('app:supported-media', async () => {
  return getSupportedMedia()
})

ipcMain.handle('app:media-capability', async (_event, payload) => {
  return getMediaCapability(payload?.filePath || payload?.fileName || '')
})

ipcMain.handle('app:media-pipeline-plan', async () => {
  return getMediaPipelinePlan()
})

ipcMain.handle('app:media-backends', async () => {
  const ffmpegStatic = ffmpegStaticPath
    ? { available: true, detail: `ffmpeg-static: ${ffmpegStaticPath}` }
    : { available: false, detail: 'ffmpeg-static not installed' }
  const ffmpeg = await probeBinary('ffmpeg', ['-version'])
  const timidity = await probeBinary('timidity', ['--version'])
  return {
    ffmpegStatic,
    ffmpeg,
    timidity,
  }
})

ipcMain.handle('app:get-runtime-mode', async () => {
  const activeWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getAllWindows()[0]
  return {
    kiosk: Boolean(activeWindow?.isKiosk()),
    startupKiosk: START_KIOSK,
  }
})

ipcMain.handle('app:set-kiosk-mode', async (_event, payload) => {
  const activeWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getAllWindows()[0]
  const enabled = Boolean(payload?.enabled)
  const ok = setKioskMode(activeWindow, enabled)
  if (enabled) applyKioskGuard(activeWindow)
  return {
    ok,
    kiosk: ok ? Boolean(activeWindow?.isKiosk()) : false,
  }
})

// Select folder dialog — for media auto-resolver
ipcMain.handle('dialog:select-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Media Folder — FluxAura Studio will scan for matching media files',
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return { canceled: true }
  return { canceled: false, folderPath: result.filePaths[0] }
})

// Save exported file (HTML / MMP / ZIP) via native Save dialog or direct write
ipcMain.handle('export:save-file', async (_evt, { base64, defaultName, filters, outputFolder } = {}) => {
  if (!base64 || !defaultName) return { ok: false, error: 'Missing base64 or defaultName' }
  try {
    let filePath
    if (outputFolder) {
      // User pre-selected a folder — write directly without a dialog
      filePath = path.join(outputFolder, defaultName)
    } else {
      const { filePath: fp, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Published File',
        defaultPath: defaultName,
        filters: filters || [{ name: 'All Files', extensions: ['*'] }],
      })
      if (canceled || !fp) return { ok: false, canceled: true }
      filePath = fp
    }
    await fsp.mkdir(path.dirname(filePath), { recursive: true })
    await fsp.writeFile(filePath, Buffer.from(base64, 'base64'))
    await fsp.access(filePath)
    return { ok: true, filePath, fileName: path.basename(filePath) }
  } catch (err) {
    return { ok: false, error: String(err.message || err) }
  }
})

// Recursively list all files in a folder (up to 3 levels deep)
// Media extensions for background filtering
const BG_IMAGE_EXTS = new Set(['jpg','jpeg','png','webp','avif','gif','bmp','svg','tif','tiff'])
const BG_VIDEO_EXTS = new Set(['mp4','m4v','webm','mov','avi','mkv','wmv','mpeg','mpg'])
const BG_AUDIO_EXTS = new Set(['mp3','wav','ogg','flac','aac','m4a','opus','mid','midi','wma','aif','aiff'])
const BG_MEDIA_EXTS = new Set([...BG_IMAGE_EXTS, ...BG_VIDEO_EXTS, ...BG_AUDIO_EXTS])

async function listFilesRecursive(dir, depth, maxDepth, mediaOnly = true, errors = []) {
  const entries = []
  try {
    const items = await fsp.readdir(dir)
    for (const item of items) {
      const full = path.join(dir, item)
      try {
        const s = await fsp.stat(full)
        if (s.isDirectory() && depth < maxDepth) {
          const sub = await listFilesRecursive(full, depth + 1, maxDepth, mediaOnly, errors)
          entries.push(...sub.entries)
        } else if (s.isFile()) {
          // Filter by extension if mediaOnly is true
          if (mediaOnly) {
            const ext = (item.split('.').pop() || '').toLowerCase()
            if (BG_MEDIA_EXTS.has(ext)) {
              entries.push({ name: item, path: full })
            }
          } else {
            entries.push({ name: item, path: full })
          }
        }
      } catch (e) {
        errors.push({ item, reason: e?.message || String(e) })
      }
    }
  } catch (e) {
    errors.push({ dir, reason: e?.message || String(e) })
  }
  return { entries, errors }
}

ipcMain.handle('fs:list-folder-files', async (_event, payload) => {
  const folderPath = String(payload?.folderPath || '')
  if (!folderPath) return { ok: false, files: [], error: 'No folder path provided' }
  
  const mediaOnly = payload?.mediaOnly !== false
  const { entries, errors } = await listFilesRecursive(folderPath, 0, 3, mediaOnly)
  
  if (entries.length === 0) {
    if (errors.length > 0) {
      return { ok: false, files: [], error: `Cannot read folder: ${errors[0].reason}` }
    }
    return { ok: false, files: [], error: 'No images or videos found in that folder.' }
  }
  
  return { ok: true, files: entries, errors: errors.length > 0 ? errors : undefined }
})

ipcMain.handle('app:read-text-file', async (_event, filePath) => {
  const data = await fsp.readFile(String(filePath || ''), 'utf8')
  return data
})

// ── System font enumeration ────────────────────────────────────────────────
ipcMain.handle('fonts:list-system', async () => {
  try {
    const fontsDir =
      process.platform === 'win32'  ? 'C:\\Windows\\Fonts' :
      process.platform === 'darwin' ? '/Library/Fonts' :
                                      '/usr/share/fonts'
    const entries = await fsp.readdir(fontsDir, { withFileTypes: true })
    const fontExts = /\.(ttf|otf)$/i
    const fonts = entries
      .filter(e => e.isFile() && fontExts.test(e.name))
      .map(e => {
        // Derive display name: strip extension, replace separators, title-case
        const name = e.name
          .replace(/\.(ttf|otf)$/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .trim()
        return { name, path: path.join(fontsDir, e.name), file: e.name }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
    return { ok: true, fonts }
  } catch (e) {
    return { ok: false, error: e.message, fonts: [] }
  }
})

// ── Dev-mode persistent auto-save (survives crashes / PID changes) ─────────
ipcMain.handle('mme:autosave', async (_event, text, projectName) => {
  if (!DEV_AUTOSAVE_PATH) return { ok: false, reason: 'not-dev' }
  try {
    await fsp.mkdir(path.dirname(DEV_AUTOSAVE_PATH), { recursive: true })
    await fsp.writeFile(DEV_AUTOSAVE_PATH, String(text || ''), 'utf8')
    // Write name sidecar so restore can report the real project filename
    if (DEV_AUTOSAVE_META_PATH) {
      const safeName = String(projectName || 'Untitled.mme').trim() || 'Untitled.mme'
      await fsp.writeFile(DEV_AUTOSAVE_META_PATH, JSON.stringify({ name: safeName }), 'utf8')
    }
    return { ok: true, path: DEV_AUTOSAVE_PATH }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('mme:restore-autosave', async () => {
  if (!DEV_AUTOSAVE_PATH) return { ok: false, reason: 'not-dev' }
  try {
    const stat = await fsp.stat(DEV_AUTOSAVE_PATH)
    const text = await fsp.readFile(DEV_AUTOSAVE_PATH, 'utf8')
    let name = 'Untitled.mme'
    if (DEV_AUTOSAVE_META_PATH) {
      try {
        const meta = JSON.parse(await fsp.readFile(DEV_AUTOSAVE_META_PATH, 'utf8'))
        if (meta?.name) name = meta.name
      } catch { /* no sidecar yet — first run */ }
    }
    return { ok: true, text, name, mtime: stat.mtime.toISOString(), path: DEV_AUTOSAVE_PATH }
  } catch {
    return { ok: false, reason: 'no-autosave' }
  }
})

// Renderer process error logging
ipcMain.on('renderer:log-error', (_event, payload = {}) => {
  const type = String(payload.type || 'Renderer Error').slice(0, 80)
  const message = String(payload.message || 'Unknown renderer error').slice(0, 2000)
  const stack = payload.stack ? String(payload.stack).slice(0, 8000) : ''
  const url = payload.url ? String(payload.url).slice(0, 1000) : ''
  const line = payload.line != null ? String(payload.line).slice(0, 40) : ''
  const col = payload.col != null ? String(payload.col).slice(0, 40) : ''
  _diagWrite(`RENDERER_ERROR [${type}]: ${message}\n${stack || 'No stack trace'}\nURL: ${url || 'N/A'} Line: ${line || 'N/A'} Col: ${col || 'N/A'}`)
  console.error(`[RENDERER ERROR] ${type}: ${message}\n${stack || 'No stack trace'}`)
})

// EOF
