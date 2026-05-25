const decode = require('../electron/audio-decode.cjs')

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: node scripts/verify-node-decode.cjs <audio-path>')
    process.exit(2)
  }

  const result = await decode.decodeAudioToFloat32(file, {
    sampleRate: 16000,
    mono: true,
    normalize: true,
    highpass: 100,
    lowpass: 8000,
    loudnorm: true,
    startSec: 0,
    durationSec: 45,
  })

  try {
    console.log(JSON.stringify({
      input: file,
      wavPath: result.wavPath,
      sampleRate: result.sampleRate,
      channels: result.channels,
      floatArrayLength: result.floatArrayLength,
      durationSec: result.durationSec,
      decodeMs: result.decodeMs,
      totalDecodeMs: result.totalDecodeMs,
    }, null, 2))
  } finally {
    await result.cleanup()
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err))
  process.exit(1)
})
