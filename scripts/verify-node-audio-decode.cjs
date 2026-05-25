const fs = require('fs')
const path = require('path')
const decode = require('../electron/audio-decode.cjs')

const CANDIDATE_DIRS = [
  path.join(__dirname, '..', 'test-audio'),
  path.join(__dirname, '..', 'test-projects'),
]

const MEDIA_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.mp4', '.mov', '.webm', '.avi'])

function findFirstMediaFile() {
  for (const dir of CANDIDATE_DIRS) {
    if (!fs.existsSync(dir)) continue
    const stack = [dir]
    while (stack.length) {
      const current = stack.pop()
      const entries = fs.readdirSync(current, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'release') continue
          stack.push(fullPath)
          continue
        }
        if (MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return fullPath
      }
    }
  }
  return null
}

async function main() {
  const file = process.argv[2] || findFirstMediaFile()
  if (!file) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: 'No test media file was provided or found under test-audio/ or test-projects/.',
    }, null, 2))
    return
  }

  const durationSec = await decode.getAudioDuration(file)
  const wav = await decode.decodeAudioToWav(file, { transcriptionMode: 'lyric-vocal-focus' })
  try {
    const loaded = await decode.loadWavToFloat32Array(wav.wavPath)
    const direct = await decode.decodeAudioToFloat32(file, { transcriptionMode: 'lyric-vocal-focus' })
    try {
      console.log(JSON.stringify({
        ok: true,
        input: file,
        durationSec,
        wavPath: wav.wavPath,
        wavSampleRate: loaded.sampleRate,
        wavChannels: loaded.channels,
        wavDurationSec: loaded.durationSec,
        floatArrayLength: loaded.floatArrayLength,
        directDecodeMs: direct.decodeMs,
        directDurationSec: direct.durationSec,
        ffmpegFound: !!decode.getFfmpegPath(),
      }, null, 2))
    } finally {
      await direct.cleanup()
    }
  } finally {
    await wav.cleanup()
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})