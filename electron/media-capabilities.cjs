const path = require('path')

const MEDIA_FILTERS = {
  image: {
    name: 'Images (legacy + modern)',
    extensions: [
      'bmp',
      'gif',
      'jpg',
      'jpeg',
      'png',
      'webp',
      'avif',
      'svg',
      'tif',
      'tiff',
      'ico',
    ],
  },
  pdf: {
    name: 'PDF Documents',
    extensions: ['pdf'],
  },
  audio: {
    name: 'Audio (legacy + modern)',
    extensions: [
      'wav',
      'mid',
      'midi',
      'mp3',
      'ogg',
      'flac',
      'aac',
      'm4a',
      'opus',
    ],
  },
  video: {
    name: 'Video / signage media',
    extensions: [
      'mp4',
      'm4v',
      'webm',
      'mov',
      'flc',
      'fli',
      'avi',
      'mkv',
      'wmv',
      'mpeg',
      'mpg',
      'ts',
      'm2ts',
    ],
  },
}

const LEGACY_CONVERT_ONLY = new Set(['flc', 'fli', 'avi', 'wmv', 'mpeg', 'mpg', 'ts', 'm2ts',
  'tif', 'tiff',  // TIFF: not renderable in Chromium — convert to PNG via ffmpeg
])
const MODERN_VIDEO_NATIVE = new Set(['mp4', 'm4v', 'webm'])
// mid/midi: played natively via WebAudioTinySynth (MidiClipPlayer) — no ffmpeg/timidity needed
// flac: natively decoded by Chromium — no conversion needed
// wav: NOT in native — old/ADPCM-encoded WAV files (common in Scala clipart) fail in Chromium.
//       Marked as 'partial' so ffmpeg transcodes to MP3 on import.
const MODERN_AUDIO_NATIVE = new Set(['mp3', 'ogg', 'opus', 'aac', 'm4a', 'flac', 'mid', 'midi'])
const PARTIAL_AUDIO = new Set(['wav'])
const MODERN_IMAGE_NATIVE = new Set(['bmp', 'gif', 'jpg', 'jpeg', 'png', 'webp', 'avif', 'svg', 'ico'])

function getSupportedMedia() {
  return {
    image: MEDIA_FILTERS.image.extensions,
    pdf: MEDIA_FILTERS.pdf.extensions,
    audio: MEDIA_FILTERS.audio.extensions,
    video: MEDIA_FILTERS.video.extensions,
  }
}

function inferCategory(ext) {
  if (ext === 'pdf') return 'pdf'
  if (MEDIA_FILTERS.image.extensions.includes(ext)) return 'image'
  if (MEDIA_FILTERS.audio.extensions.includes(ext)) return 'audio'
  if (MEDIA_FILTERS.video.extensions.includes(ext)) return 'video'
  return 'unknown'
}

function normalizeExt(filePathOrName) {
  const ext = path.extname(String(filePathOrName || '')).replace('.', '').toLowerCase()
  return ext
}

function getMediaCapability(filePathOrName) {
  const ext = normalizeExt(filePathOrName)
  const category = inferCategory(ext)

  if (!ext || category === 'unknown') {
    return {
      extension: ext || null,
      category,
      support: 'unsupported',
      strategy: 'reject',
      reason: 'Unknown extension',
      outputHint: null,
    }
  }

  if (category === 'pdf') {
    return {
      extension: 'pdf',
      category: 'pdf',
      support: 'native',
      strategy: 'iframe-embed',
      reason: 'PDF rendered natively by Chromium/Electron via iframe',
      outputHint: null,
    }
  }

  if (LEGACY_CONVERT_ONLY.has(ext)) {
    const isTiff = ext === 'tif' || ext === 'tiff'
    return {
      extension: ext,
      category,
      support: 'convert-required',
      strategy: 'transcode-at-ingest',
      reason: isTiff
        ? 'TIFF is not renderable in Chromium — will convert to PNG via ffmpeg'
        : 'Legacy format should be transcoded for stable runtime playback',
      outputHint: isTiff ? 'png' : (category === 'audio' ? 'wav or mp3' : 'mp4'),
    }
  }

  if (category === 'image' && MODERN_IMAGE_NATIVE.has(ext)) {
    return {
      extension: ext,
      category,
      support: 'native',
      strategy: 'direct-render',
      reason: 'Directly supported by renderer image pipeline',
      outputHint: null,
    }
  }

  if (category === 'audio' && MODERN_AUDIO_NATIVE.has(ext)) {
    const isMidi = ext === 'mid' || ext === 'midi'
    return {
      extension: ext,
      category,
      support: 'native',
      strategy: isMidi ? 'midi-synth' : 'direct-playback',
      reason: isMidi
        ? 'Played via WebAudioTinySynth MIDI synthesiser (no ffmpeg needed)'
        : 'Directly supported by Chromium audio pipeline',
      outputHint: null,
    }
  }

  if (category === 'audio' && PARTIAL_AUDIO.has(ext)) {
    return {
      extension: ext,
      category,
      support: 'partial',
      strategy: 'transcode-at-ingest',
      reason: 'WAV codec may not be supported by Chromium (ADPCM etc.) — transcodes to MP3 via ffmpeg',
      outputHint: 'mp3',
    }
  }

  if (category === 'video' && MODERN_VIDEO_NATIVE.has(ext)) {
    return {
      extension: ext,
      category,
      support: 'native',
      strategy: 'direct-playback',
      reason: 'Directly supported by Chromium video pipeline',
      outputHint: null,
    }
  }

  return {
    extension: ext,
    category,
    support: 'partial',
    strategy: 'probe-then-fallback',
    reason: 'May require FFmpeg-enabled build or conversion depending on codec',
    outputHint: category === 'video' ? 'mp4 (h264/aac)' : null,
  }
}

function getMediaPipelinePlan() {
  return {
    ingest: {
      nativePath: 'Store source path and use native renderer/media element playback',
      convertPath: 'Queue conversion job to normalized runtime format in project cache',
    },
    outputTargets: {
      image: 'png/webp',
      audio: 'wav/mp3 (MIDI: WebAudioTinySynth direct playback)',
      video: 'mp4 (h264/aac)',
    },
    transcodeTriggers: ['convert-required', 'partial'],
    cacheDirectory: 'userData/media-cache',
  }
}

module.exports = {
  MEDIA_FILTERS,
  getSupportedMedia,
  getMediaCapability,
  getMediaPipelinePlan,
}
