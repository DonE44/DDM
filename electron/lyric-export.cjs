// @ts-check
/**
 * lyric-export.cjs — Export lyric video as MP4 from the Electron main process.
 *
 * Flow:
 *  1. Renderer renders each lyric page to a JPEG (canvas) and sends base64 frames.
 *  2. This module saves the frames to a temp dir.
 *  3. Runs ffmpeg concat-demuxer + audio input → MP4 with H.264 + AAC.
 *  4. Cleans up temp files.
 *  5. Streams progress events back to the renderer.
 *
 * IPC channels:
 *   lyric:save-dialog     → opens Save As dialog, returns { outputPath } or { canceled }
 *   lyric:export-video    → receives frames + audio + outputPath, runs ffmpeg
 *
 * Progress events (renderer listens on 'lyric:export-progress'):
 *   { status: string, progress: number (0-100) }
 */

const { ipcMain, app, dialog } = require('electron')
const path = require('path')
const fs   = require('fs/promises')
const os   = require('os')
const { spawn } = require('child_process')

// Resolve ffmpeg binary path robustly across dev and packed-asar Electron contexts.
// In a packed app, require('ffmpeg-static') returns the virtual asar path, not the
// real app.asar.unpacked path. We try several strategies and pick the first that exists.
function resolveFFmpegPath() {
  const fsSync = require('fs')
  const ext = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

  // Strategy 1: explicit resourcesPath construction (most reliable in packed app)
  try {
    const rp = process.resourcesPath
    if (rp) {
      const p = path.join(rp, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', ext)
      if (fsSync.existsSync(p)) return p
    }
  } catch {}

  // Strategy 2: execPath-relative construction
  try {
    const rp = path.join(path.dirname(process.execPath), 'resources')
    const p = path.join(rp, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', ext)
    if (fsSync.existsSync(p)) return p
  } catch {}

  // Strategy 3: require('ffmpeg-static') with asar→asar.unpacked fix
  try {
    let p = /** @type {string | null} */ (/** @type {unknown} */ (require('ffmpeg-static')))
    if (typeof p === 'string' && p) {
      if (p.includes('app.asar') && !p.includes('app.asar.unpacked')) {
        p = p.replace(/app\.asar([/\\])/g, 'app.asar.unpacked$1')
      }
      if (path.isAbsolute(p) && fsSync.existsSync(p)) return p
    }
  } catch {}

  return null
}
let ffmpegPath = resolveFFmpegPath()

// ── Save dialog ───────────────────────────────────────────────────────────────

function registerSaveDialogIPC() {
  ipcMain.handle('lyric:save-dialog', async (_event, { defaultName = 'lyric-video.mp4' } = {}) => {
    const result = await dialog.showSaveDialog({
      title: 'Export Lyric Video',
      defaultPath: path.join(app.getPath('videos'), defaultName),
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: [],
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    return { outputPath: result.filePath }
  })

  // ── Export video ────────────────────────────────────────────────────────────

  ipcMain.handle('lyric:export-video', async (event, payload) => {
    const { frames, audioSourcePath, outputPath, width = 1280, height = 720, crf = 22 } = payload || {}
    const send = (data) => { try { event.sender.send('lyric:export-progress', data) } catch {} }

    if (!ffmpegPath) return { ok: false, error: 'ffmpeg-static not available. Please reinstall the app.' }
    if (!Array.isArray(frames) || frames.length === 0) return { ok: false, error: 'No frames provided.' }
    // audioSourcePath is optional — omit for silent video

    const tmpDir = path.join(os.tmpdir(), `fluxaura-studio-lyric-${Date.now()}`)
    await fs.mkdir(tmpDir, { recursive: true })

    try {
      // ── Step 1: Save JPEG frames to temp dir ─────────────────────────────────
      send({ status: 'Saving frames…', progress: 0 })

      const concatLines = []
      for (let i = 0; i < frames.length; i++) {
        const { imageBase64, durationSec } = frames[i]
        const frameName = `frame_${String(i).padStart(5, '0')}.jpg`
        const framePath = path.join(tmpDir, frameName)
        await fs.writeFile(framePath, Buffer.from(imageBase64, 'base64'))
        // ffmpeg concat demuxer requires forward-slash paths on all platforms
        concatLines.push(`file '${framePath.replace(/\\/g, '/')}'`)
        const safeDur = (typeof durationSec === 'number' && isFinite(durationSec)) ? durationSec : 4
        concatLines.push(`duration ${Math.max(0.1, safeDur).toFixed(4)}`)
        send({ status: `Saving frames… (${i + 1}/${frames.length})`, progress: Math.round((i + 1) / frames.length * 35) })
      }
      // Repeat last frame (required by concat demuxer to avoid truncation)
      const lastFrameName = `frame_${String(frames.length - 1).padStart(5, '0')}.jpg`
      concatLines.push(`file '${path.join(tmpDir, lastFrameName).replace(/\\/g, '/')}'`)

      const concatFile = path.join(tmpDir, 'frames.txt')
      await fs.writeFile(concatFile, concatLines.join('\n'))

      // ── Step 2: Run ffmpeg ───────────────────────────────────────────────────
      send({ status: 'Encoding video…', progress: 35 })

      const totalDurationSec = frames.reduce((s, f) => s + (isFinite(f.durationSec) ? Math.max(0.1, f.durationSec) : 4), 0)

      await new Promise((resolve, reject) => {
        const args = [
          '-y',
          '-f', 'concat', '-safe', '0', '-i', concatFile,
        ]
        if (audioSourcePath) {
          args.push('-i', audioSourcePath)
        }

        // Explicit stream mapping: without this, MP3s with embedded album art (a
        // hidden video stream) cause ffmpeg to auto-map the wrong stream and fail
        // with AVERROR(EINVAL).
        if (audioSourcePath) {
          args.push('-map', '0:v:0', '-map', '1:a:0')
        } else {
          args.push('-map', '0:v:0')
        }

        // Scale to even dimensions — libx264 yuv420p requires width+height divisible by 2
        args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2')
        // -r 25: normalise to constant 25 fps so libx264 gets monotonically-spaced
        // timestamps; without this, variable-duration concat frames occasionally
        // produce non-monotonic DTS that triggers AVERROR(EINVAL) in the encoder.
        args.push(
          '-r', '25',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', String(crf ?? 22),
          '-pix_fmt', 'yuv420p',
        )
        if (audioSourcePath) {
          args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
                    '-t', totalDurationSec.toFixed(3))
        } else {
          args.push('-an', '-t', totalDurationSec.toFixed(3))
        }
        args.push('-movflags', '+faststart', outputPath)

        const proc = spawn(/** @type {string} */ (ffmpegPath), args)
        let lastPct = 35
        let stderrBuf = ''

        if (proc.stderr) proc.stderr.on('data', (chunk) => {
          const line = chunk.toString()
          stderrBuf += line
          // Parse ffmpeg time progress: "time=HH:MM:SS.ms"
          const m = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
          if (m) {
            const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100
            const pct = Math.min(98, 35 + Math.round((secs / totalDurationSec) * 63))
            if (pct > lastPct) {
              lastPct = pct
              send({ status: `Encoding… ${pct}%`, progress: pct })
            }
          }
        })

        proc.on('error', (err) => reject(err))
        proc.on('close', async (code) => {
          if (code === 0) { resolve(); return }
          const detail = stderrBuf.trim()
          const logPath = path.join(os.tmpdir(), 'fluxaura-studio-ffmpeg-debug.log')
          const logContent = [
            `=== FluxAura Studio ffmpeg debug log ===`,
            `Exit code: ${code}`,
            `Frames: ${frames.length}  TotalDuration: ${totalDurationSec.toFixed(3)}s`,
            `Command: ${ffmpegPath}`,
            `Args: ${args.join(' ')}`,
            ``,
            `--- stderr ---`,
            detail || '(empty)',
          ].join('\n')
          try { await fs.writeFile(logPath, logContent) } catch {}
          const snippet = detail.split('\n').filter(l => l.includes('Error') || l.includes('Invalid') || l.includes('error')).slice(-5).join('\n') || detail.slice(-800)
          reject(new Error(
            `ffmpeg exited with code ${code}\n\nKey errors:\n${snippet}\n\nFull log: ${logPath}`
          ))
        })
      })

      send({ status: `✅ Export complete!`, progress: 100 })
      return { ok: true, outputPath }

    } catch (err) {
      const msg = err?.message || String(err)
      console.error('[lyric-export] Error:', msg)
      return { ok: false, error: msg }
    } finally {
      // Clean up temp files
      try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
    }
  })
}

// ── Streaming multi-frame export (called from ScriptExportModal) ──────────────
//
// Flow:
//   1. Renderer calls lyric:export-init → gets tmpId + empty tmpDir
//   2. Renderer renders pages in batches and calls lyric:export-push-batch for
//      each batch (50 frames). Main process writes JPEGs + appends frames.txt.
//   3. Renderer calls lyric:export-encode → ffmpeg runs on the pre-written files.
//
// This avoids sending all frames in one huge IPC payload (memory cliff risk).

const exportSessions = new Map()

function registerStreamingExportIPC() {
  ipcMain.handle('lyric:export-init', async () => {
    const tmpId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const tmpDir = path.join(os.tmpdir(), `fluxaura-studio-export-${tmpId}`)
    await fs.mkdir(tmpDir, { recursive: true })
    await fs.writeFile(path.join(tmpDir, 'frames.txt'), '')
    exportSessions.set(tmpId, { tmpDir, frameCount: 0 })
    return { tmpId }
  })

  ipcMain.handle('lyric:export-push-batch', async (_event, { tmpId, batch, startIndex }) => {
    const session = exportSessions.get(tmpId)
    if (!session) return { ok: false, error: 'Unknown export session' }
    try {
      let concatAppend = ''
      for (let i = 0; i < batch.length; i++) {
        const { imageBase64, durationSec } = batch[i]
        const frameIdx = startIndex + i
        const frameName = `frame_${String(frameIdx).padStart(6, '0')}.jpg`
        const framePath = path.join(session.tmpDir, frameName)
        await fs.writeFile(framePath, Buffer.from(imageBase64, 'base64'))
        concatAppend += `file '${framePath.replace(/\\/g, '/')}'\n`
        const safeDur = (typeof durationSec === 'number' && isFinite(durationSec)) ? durationSec : 4
        concatAppend += `duration ${Math.max(0.04, safeDur).toFixed(6)}\n`
      }
      await fs.appendFile(path.join(session.tmpDir, 'frames.txt'), concatAppend)
      session.frameCount += batch.length
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('lyric:export-encode', async (event, { tmpId, totalFrames, audioSourcePath, audioClips, outputPath, width = 1280, height = 720, crf = 22 }) => {
    const session = exportSessions.get(tmpId)
    if (!session) return { ok: false, error: 'Unknown export session' }
    const send = (data) => { try { event.sender.send('lyric:export-progress', data) } catch {} }

    if (!ffmpegPath) return { ok: false, error: 'ffmpeg-static not available. Please reinstall the app.' }

    const { tmpDir } = session
    try {
      // Repeat last frame (concat demuxer requires final entry without duration)
      const lastFrameName = `frame_${String(totalFrames - 1).padStart(6, '0')}.jpg`
      const lastFramePath = path.join(tmpDir, lastFrameName)
      await fs.appendFile(path.join(tmpDir, 'frames.txt'), `file '${lastFramePath.replace(/\\/g, '/')}'\n`)

      // Calculate total duration by summing duration lines in frames.txt
      const framesContent = await fs.readFile(path.join(tmpDir, 'frames.txt'), 'utf8')
      const durMatches = [...framesContent.matchAll(/^duration (.+)$/gm)]
      const totalDurationSec = durMatches.reduce((s, m) => {
        const n = parseFloat(m[1])
        return s + (isFinite(n) ? n : 0)
      }, 0) || 10

      send({ status: 'Encoding video…', progress: 35 })

      const concatFile = path.join(tmpDir, 'frames.txt')

      await new Promise((resolve, reject) => {
        const args = ['-y', '-f', 'concat', '-safe', '0', '-i', concatFile]
        const hasClips = Array.isArray(audioClips) && audioClips.length > 0

        if (hasClips) {
          // Per-page narration clips: add each as a separate input, then mix with adelay
          for (const clip of audioClips) args.push('-i', clip.path)

          // Build filter_complex: delay each clip to its page start time, then amix
          const filterParts = audioClips.map((clip, i) => {
            const delayMs = Math.round(clip.startSec * 1000)
            return `[${i + 1}:a]adelay=${delayMs}|${delayMs}[a${i}]`
          })
          const mixInputs = audioClips.map((_, i) => `[a${i}]`).join('')
          filterParts.push(`${mixInputs}amix=inputs=${audioClips.length}:normalize=0:dropout_transition=0[aout]`)

          args.push('-filter_complex', filterParts.join(';'))
          args.push('-map', '0:v:0', '-map', '[aout]')
        } else if (audioSourcePath) {
          args.push('-i', audioSourcePath)
          args.push('-map', '0:v:0', '-map', '1:a:0')
        } else {
          args.push('-map', '0:v:0')
        }

        args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2')
        args.push('-r', '25', '-c:v', 'libx264', '-preset', 'fast', '-crf', String(crf ?? 22), '-pix_fmt', 'yuv420p')
        if (hasClips || audioSourcePath) {
          args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-t', totalDurationSec.toFixed(3))
        } else {
          args.push('-an', '-t', totalDurationSec.toFixed(3))
        }
        args.push('-movflags', '+faststart', outputPath)

        const proc = spawn(/** @type {string} */ (ffmpegPath), args)
        let lastPct = 35
        let stderrBuf = ''

        if (proc.stderr) proc.stderr.on('data', (chunk) => {
          const line = chunk.toString()
          stderrBuf += line
          const m = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
          if (m) {
            const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100
            const pct = Math.min(98, 35 + Math.round((secs / totalDurationSec) * 63))
            if (pct > lastPct) { lastPct = pct; send({ status: `Encoding… ${pct}%`, progress: pct }) }
          }
        })

        proc.on('error', (err) => reject(err))
        proc.on('close', async (code) => {
          if (code === 0) { resolve(); return }
          const detail = stderrBuf.trim()
          const logPath = path.join(os.tmpdir(), 'fluxaura-studio-ffmpeg-debug.log')
          const logContent = [
            `=== FluxAura Studio ffmpeg debug log (streaming encode) ===`,
            `Exit code: ${code}`,
            `TotalFrames: ${totalFrames}  TotalDuration: ${totalDurationSec.toFixed(3)}s`,
            `Command: ${ffmpegPath}`,
            `Args: ${args.join(' ')}`,
            ``,
            `--- stderr ---`,
            detail || '(empty)',
          ].join('\n')
          try { await fs.writeFile(logPath, logContent) } catch {}
          const snippet = detail.split('\n').filter(l => l.includes('Error') || l.includes('Invalid') || l.includes('error')).slice(-5).join('\n') || detail.slice(-800)
          reject(new Error(`ffmpeg exited with code ${code}\n\nKey errors:\n${snippet}\n\nFull log: ${logPath}`))
        })
      })

      send({ status: '✅ Export complete!', progress: 100 })
      return { ok: true, outputPath }
    } catch (err) {
      return { ok: false, error: err?.message || String(err) }
    } finally {
      exportSessions.delete(tmpId)
      try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
    }
  })
}

function registerLyricExportIPC() {
  registerSaveDialogIPC()
  registerStreamingExportIPC()
}

module.exports = { registerLyricExportIPC }
