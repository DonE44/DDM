// @ts-check
// Extracted from App.jsx — media detection and file-handling utilities

export function detectMediaKind(fileUrl) {
  const raw = String(fileUrl || '').toLowerCase().split('?')[0]
  const dataMime = raw.match(/^data:(image|audio|video|application)\//)
  if (dataMime) {
    if (dataMime[1] === 'application') return 'pdf'
    return dataMime[1]
  }
  if (/((\.(mp4|webm|ogv|mov|avi|mkv|m4v|wmv|mpeg|mpg|ts|m2ts|flc|fli))$)/i.test(raw)) return 'video'
  if (/(\.(mp3|wav|m4a|aac|flac|oga|opus|mid|midi))$/i.test(raw)) return 'audio'
  if (/\.pdf$/i.test(raw)) return 'pdf'
  return 'image'
}

export function isMidiMedia(nameOrPath) {
  return /\.(mid|midi)([?#].*)?$/i.test(String(nameOrPath || ''))
}

export function readBrowserFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function getMediaExtension(nameOrPath) {
  const value = String(nameOrPath || '')
  // blob: and data: URLs have no meaningful file extension
  if (/^(blob:|data:)/i.test(value)) return ''
  const clean = value.split('?')[0].split('#')[0]
  // Use only the last path segment so IP-address dots (e.g. 127.0.0.1) are ignored
  const lastSlash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'))
  const segment = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean
  const dot = segment.lastIndexOf('.')
  if (dot < 0) return ''
  return segment.slice(dot + 1).toLowerCase()
}

// Returns true if a media file string is a raw filesystem path that can't be loaded by the browser.
// Resolved media is always one of: data:, blob:, app-media://, or http://127.0.0.1:PORT/
export function isUnresolvedMediaPath(s) {
  if (!s) return false
  const str = String(s)
  return str.length > 0
    && !str.startsWith('data:')
    && !str.startsWith('blob:')
    && !str.startsWith('app-media://')
    && !/^https?:\/\//i.test(str)
}

export function isTempUrl(url) {
  const s = String(url || '')
  return s.startsWith('blob:') || s.startsWith('app-media://') || s.startsWith('data:')
    || /^http:\/\/127\.0\.0\.1:\d+\//.test(s)
}

export function inferMediaCapability(nameOrPath, kindHint = 'image') {
  const ext = getMediaExtension(nameOrPath)
  if (!ext) {
    // Images are always natively renderable (img tag handles data:, file:, http:, etc.)
    if (kindHint === 'image') {
      return { extension: null, category: 'image', support: 'native', reason: 'Images are natively rendered', outputHint: null }
    }
    return {
      extension: null,
      category: kindHint,
      support: 'unknown',
      reason: 'No extension found',
      outputHint: null,
    }
  }

  const convertRequired = new Set(['flc', 'fli', 'avi', 'wmv', 'mpeg', 'mpg', 'ts', 'm2ts',
    'tif', 'tiff',  // TIFF: not renderable in Chromium <img> — convert to PNG via ffmpeg
  ])
  // wav is partial: standard PCM may work natively but old/ADPCM-encoded WAVs
  // (legacy MIDI files) fail silently in Chromium's audio pipeline.
  // Marking as partial triggers an ffmpeg transcode to MP3 on import and reload.
  const partial = new Set(['mkv', 'mov', 'wav'])
  const native = new Set([
    'bmp',
    'gif',
    'jpg',
    'jpeg',
    'png',
    'webp',
    'avif',
    'svg',
    'ico',
    'mp3',
    'ogg',
    'opus',
    'aac',
    'm4a',
    'flac',
    // mid/midi: played via WebAudioTinySynth MidiClipPlayer — no ffmpeg conversion needed
    'mid',
    'midi',
    'mp4',
    'm4v',
    'webm',
  ])

  if (ext === 'pdf') {
    return {
      extension: 'pdf',
      category: 'pdf',
      support: 'native',
      strategy: 'iframe-embed',
      reason: 'PDF rendered natively by Chromium/Electron via iframe',
      outputHint: null,
    }
  }

  if (convertRequired.has(ext)) {
    const isTiff = ext === 'tif' || ext === 'tiff'
    if (isTiff) {
      return {
        extension: ext,
        category: 'image',
        support: 'convert-required',
        reason: 'TIFF is not renderable in Chromium — will convert to PNG via ffmpeg',
        outputHint: 'png',
      }
    }
    return {
      extension: ext,
      category: 'video',
      support: 'convert-required',
      reason: 'Legacy format requires conversion for reliable playback',
      outputHint: 'mp4 (h264/aac)',
    }
  }

  if (partial.has(ext)) {
    const cat = detectMediaKind(nameOrPath)
    return {
      extension: ext,
      category: cat,
      support: 'partial',
      reason: cat === 'audio'
        ? 'WAV codec may not be supported by Chromium (ADPCM etc.) — will transcode to MP3'
        : 'Codec/container support varies by runtime',
      outputHint: cat === 'audio' ? 'mp3' : 'mp4 (h264/aac)',
    }
  }

  if (native.has(ext)) {
    const isMidi = ext === 'mid' || ext === 'midi'
    return {
      extension: ext,
      category: detectMediaKind(nameOrPath),
      support: 'native',
      strategy: isMidi ? 'midi-synth' : 'direct-playback',
      reason: isMidi
        ? 'Played via WebAudioTinySynth MIDI synthesiser (no ffmpeg needed)'
        : 'Direct renderer support expected',
      outputHint: null,
    }
  }

  return {
    extension: ext,
    category: detectMediaKind(nameOrPath),
    support: 'unsupported',
    reason: 'Unknown extension support',
    outputHint: null,
  }
}
