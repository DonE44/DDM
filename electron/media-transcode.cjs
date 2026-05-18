const path = require('path')
const fs = require('fs/promises')
const { spawn } = require('child_process')

// Build an app-media:// URL so the renderer can load local files without
// CORS restrictions regardless of whether it's loading from file:// or http://
// Each path segment is encoded with encodeURIComponent so #, ?, ! etc. in
// file/directory names don't corrupt the URL.
function toAppMediaUrl(absPath) {
  const forward = String(absPath || '').replace(/\\/g, '/')
  const encoded = forward.split('/').map((seg, i) => {
    if (i === 0 && /^[a-zA-Z]:$/.test(seg)) return seg
    return encodeURIComponent(seg)
  }).join('/')
  return `app-media:///${encoded}`
}

let ffmpegPath = null
try {
  ffmpegPath = require('ffmpeg-static')
} catch {
  ffmpegPath = null
}

function toOutputBaseName(filePath) {
  const stamp = Date.now()
  const inputName = path.basename(String(filePath || ''), path.extname(String(filePath || '')))
  return `${inputName || 'media'}-${stamp}`
}

function getExt(filePath) {
  return path.extname(String(filePath || '')).replace('.', '').toLowerCase()
}

function runExecutable(command, args) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { windowsHide: true })
    let stderr = ''

    proc.stderr.on('data', (chunk) => {
      stderr += String(chunk || '')
      if (stderr.length > 6000) {
        stderr = stderr.slice(-6000)
      }
    })

    proc.on('error', (err) => {
      resolve({ ok: false, reason: String(err?.message || err || `Failed to execute ${command}`) })
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true })
        return
      }
      resolve({ ok: false, reason: stderr || `${command} exited with code ${code}` })
    })
  })
}

function runFfmpeg(args) {
  const candidates = ffmpegPath ? [ffmpegPath, 'ffmpeg'] : ['ffmpeg']

  const runCandidate = (index) =>
    new Promise((resolve) => {
      if (index >= candidates.length) {
        resolve({ ok: false, reason: 'No usable ffmpeg binary found (ffmpeg-static or system ffmpeg)' })
        return
      }

      const cmd = candidates[index]
      runExecutable(cmd, args).then((result) => {
        if (result.ok) {
          resolve({ ok: true, command: cmd })
          return
        }

        const retryable = /unknown decoder|invalid data|cannot find a matching stream|unknown format/i.test(result.reason || '')
        if (retryable && index + 1 < candidates.length) {
          resolve(runCandidate(index + 1))
          return
        }

        resolve({ ok: false, reason: `${cmd}: ${result.reason || 'ffmpeg failed'}` })
      })
    })

  return runCandidate(0)
}

async function transcodeVideo(filePath, outputPath) {
  const ext = getExt(filePath)
  const primaryArgs = [
    '-y',
    '-i',
    filePath,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    outputPath,
  ]

  const primary = await runFfmpeg(primaryArgs)
  if (primary.ok) return primary

  if (ext === 'flc' || ext === 'fli') {
    // Some ffmpeg builds require an explicit demuxer hint for Autodesk Animator formats.
    return runFfmpeg([
      '-y',
      '-f',
      'flic',
      '-i',
      filePath,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-movflags',
      '+faststart',
      outputPath,
    ])
  }

  return primary
}

async function transcodeAudio(filePath, mp3Path, wavPath) {
  const ext = getExt(filePath)
  const mp3Result = await runFfmpeg([
    '-y',
    '-i',
    filePath,
    '-vn',
    '-ac',
    '2',
    '-ar',
    '44100',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '192k',
    mp3Path,
  ])

  if (mp3Result.ok) {
    return { ok: true, outputPath: mp3Path, outputHint: 'mp3' }
  }

  if (ext === 'mid' || ext === 'midi') {
    const timidity = await runExecutable('timidity', [filePath, '-Ow', '-o', wavPath])
    if (timidity.ok) {
      return { ok: true, outputPath: wavPath, outputHint: 'wav (timidity)' }
    }
  }

  const wavResult = await runFfmpeg([
    '-y',
    '-i',
    filePath,
    '-vn',
    '-ac',
    '2',
    '-ar',
    '44100',
    '-c:a',
    'pcm_s16le',
    wavPath,
  ])

  if (wavResult.ok) {
    return { ok: true, outputPath: wavPath, outputHint: 'wav' }
  }

  return {
    ok: false,
    reason: `Audio transcode failed. MP3: ${mp3Result.reason}; WAV: ${wavResult.reason}`,
  }
}

async function transcodeImage(filePath, outputPath) {
  // ffmpeg can decode TIFF and encode to PNG natively
  return runFfmpeg([
    '-y',
    '-i',
    filePath,
    '-frames:v', '1',   // first frame only (handles multi-page TIFFs)
    '-vf', 'scale=iw:ih', // preserve size
    outputPath,
  ])
}

async function transcodeMedia(payload) {
  const filePath = String(payload?.filePath || '')
  const category = String(payload?.category || '')
  const support = String(payload?.support || '')
  const force = Boolean(payload?.force)
  const userDataPath = String(payload?.userDataPath || '')

  if (!filePath || !category || !userDataPath) {
    return { ok: false, reason: 'Missing transcode input values' }
  }

  if (!force && support !== 'convert-required' && support !== 'partial') {
    return { ok: false, reason: 'Transcode not required for this media' }
  }

  const cacheDir = path.join(userDataPath, 'media-cache')
  await fs.mkdir(cacheDir, { recursive: true })

  if (category === 'image') {
    // Convert to PNG (handles TIFF and any other non-browser-renderable image formats)
    const outputPath = path.join(cacheDir, `${toOutputBaseName(filePath)}.png`)
    const result = await transcodeImage(filePath, outputPath)

    if (!result.ok) {
      return { ok: false, reason: result.reason }
    }

    return {
      ok: true,
      convertedPath: outputPath,
      convertedUrl: toAppMediaUrl(outputPath),
      outputHint: 'png',
      mode: 'transcoded',
    }
  }

  if (category === 'video') {
    const outputPath = path.join(cacheDir, `${toOutputBaseName(filePath)}.mp4`)
    const result = await transcodeVideo(filePath, outputPath)

    if (!result.ok) {
      return { ok: false, reason: result.reason }
    }

    return {
      ok: true,
      convertedPath: outputPath,
      convertedUrl: toAppMediaUrl(outputPath),
      outputHint: 'mp4 (h264/aac)',
      mode: 'transcoded',
    }
  }

  if (category === 'audio') {
    const mp3Path = path.join(cacheDir, `${toOutputBaseName(filePath)}.mp3`)
    const wavPath = path.join(cacheDir, `${toOutputBaseName(filePath)}.wav`)
    const audioResult = await transcodeAudio(filePath, mp3Path, wavPath)

    if (!audioResult.ok) {
      return { ok: false, reason: audioResult.reason }
    }

    return {
      ok: true,
      convertedPath: audioResult.outputPath,
      convertedUrl: toAppMediaUrl(audioResult.outputPath),
      outputHint: audioResult.outputHint,
      mode: 'transcoded',
    }
  }

  return { ok: false, reason: `Unsupported transcode category: ${category}` }
}

module.exports = {
  transcodeMedia,
}
