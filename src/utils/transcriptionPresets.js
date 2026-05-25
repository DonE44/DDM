// @ts-check

export const TRANSCRIPTION_PRESETS = [
  {
    id: 'auto-best',
    label: 'Auto Best',
    description: 'Picks the best local path available, then falls back safely.',
    engineIntent: 'balanced-auto',
    preferredEngine: 'local-pro',
    fallbackEngine: 'compatibility',
    transcriptionMode: 'lyric-vocal-focus',
    requiresApiKey: false,
    requiresLocalTools: false,
  },
  {
    id: 'local-pro',
    label: 'Local Pro',
    description: 'Future Demucs + Faster-Whisper quality path (not installed yet).',
    engineIntent: 'quality-local-pro',
    preferredEngine: 'local-pro',
    fallbackEngine: 'fast-local',
    transcriptionMode: 'lyric-vocal-focus',
    requiresApiKey: false,
    requiresLocalTools: true,
  },
  {
    id: 'fast-local',
    label: 'Fast Local',
    description: 'Local speed-first path (whisper.cpp when available).',
    engineIntent: 'speed-local',
    preferredEngine: 'fast-local',
    fallbackEngine: 'compatibility',
    transcriptionMode: 'lyric-vocal-focus',
    requiresApiKey: false,
    requiresLocalTools: true,
  },
  {
    id: 'cloud-pro',
    label: 'Cloud Pro',
    description: 'Cloud API transcription (OpenAI now, Groq later).',
    engineIntent: 'cloud-quality',
    preferredEngine: 'cloud-pro',
    fallbackEngine: 'compatibility',
    transcriptionMode: 'lyric-vocal-focus',
    requiresApiKey: true,
    requiresLocalTools: false,
  },
  {
    id: 'compatibility',
    label: 'Compatibility',
    description: 'Current stable Xenova/Transformers.js path.',
    engineIntent: 'compatibility',
    preferredEngine: 'compatibility',
    fallbackEngine: 'compatibility',
    transcriptionMode: 'lyric-vocal-focus',
    requiresApiKey: false,
    requiresLocalTools: false,
  },
]

export const DEFAULT_TRANSCRIPTION_PRESET_ID = 'auto-best'

export function getTranscriptionPresetById(id) {
  return TRANSCRIPTION_PRESETS.find((p) => p.id === id) || TRANSCRIPTION_PRESETS[0]
}

export function resolveTranscriptionPreset({
  presetId,
  hasWhisperCpp = false,
  hasLocalPro = false,
  hasApiKey = false,
  hasElectronIPC = false,
} = {}) {
  const preset = getTranscriptionPresetById(presetId)

  if (preset.id === 'cloud-pro') {
    return {
      preset,
      transcriptionMode: preset.transcriptionMode,
      selectedPreset: preset.id,
      modelId: 'openai-api',
      engineIntent: preset.engineIntent,
      resolvedEngine: 'openai',
      requiresApiKey: true,
      requiresLocalTools: false,
      available: hasApiKey,
      warning: hasApiKey ? '' : 'Cloud Pro requires an API key.',
      fallbackApplied: false,
    }
  }

  if (preset.id === 'compatibility') {
    return {
      preset,
      transcriptionMode: preset.transcriptionMode,
      selectedPreset: preset.id,
      modelId: 'Xenova/whisper-medium',
      engineIntent: preset.engineIntent,
      resolvedEngine: 'xenova',
      requiresApiKey: false,
      requiresLocalTools: false,
      available: true,
      warning: '',
      fallbackApplied: false,
    }
  }

  if (preset.id === 'fast-local') {
    if (hasWhisperCpp && hasElectronIPC) {
      return {
        preset,
        transcriptionMode: preset.transcriptionMode,
        selectedPreset: preset.id,
        modelId: 'whispercpp-medium',
        engineIntent: preset.engineIntent,
        resolvedEngine: 'whisper.cpp',
        requiresApiKey: false,
        requiresLocalTools: true,
        available: true,
        warning: '',
        fallbackApplied: false,
      }
    }
    return {
      preset,
      transcriptionMode: preset.transcriptionMode,
      selectedPreset: preset.id,
      modelId: 'Xenova/whisper-medium',
      engineIntent: preset.engineIntent,
      resolvedEngine: 'xenova',
      requiresApiKey: false,
      requiresLocalTools: true,
      available: false,
      warning: 'Fast Local tools not installed. Using Compatibility fallback.',
      fallbackApplied: true,
    }
  }

  if (preset.id === 'local-pro') {
    if (hasLocalPro && hasElectronIPC) {
      return {
        preset,
        transcriptionMode: preset.transcriptionMode,
        selectedPreset: preset.id,
        modelId: 'auto-best',
        engineIntent: preset.engineIntent,
        resolvedEngine: 'local-pro',
        requiresApiKey: false,
        requiresLocalTools: true,
        available: true,
        warning: '',
        fallbackApplied: false,
      }
    }
    if (hasWhisperCpp && hasElectronIPC) {
      return {
        preset,
        transcriptionMode: preset.transcriptionMode,
        selectedPreset: preset.id,
        modelId: 'whispercpp-large',
        engineIntent: preset.engineIntent,
        resolvedEngine: 'whisper.cpp',
        requiresApiKey: false,
        requiresLocalTools: true,
        available: false,
        warning: 'Local Pro tools not installed. Using Fast Local fallback.',
        fallbackApplied: true,
      }
    }
    return {
      preset,
      transcriptionMode: preset.transcriptionMode,
      selectedPreset: preset.id,
      modelId: 'Xenova/whisper-medium',
      engineIntent: preset.engineIntent,
      resolvedEngine: 'xenova',
      requiresApiKey: false,
      requiresLocalTools: true,
      available: false,
      warning: 'Local Pro tools not installed. Using Compatibility fallback.',
      fallbackApplied: true,
    }
  }

  if (hasWhisperCpp && hasElectronIPC) {
    return {
      preset,
      transcriptionMode: preset.transcriptionMode,
      selectedPreset: preset.id,
      modelId: 'auto-best',
      engineIntent: preset.engineIntent,
      resolvedEngine: 'auto-best',
      requiresApiKey: false,
      requiresLocalTools: false,
      available: true,
      warning: '',
      fallbackApplied: false,
    }
  }

  return {
    preset,
    transcriptionMode: preset.transcriptionMode,
    selectedPreset: preset.id,
    modelId: 'Xenova/whisper-medium',
    engineIntent: preset.engineIntent,
    resolvedEngine: 'xenova',
    requiresApiKey: false,
    requiresLocalTools: false,
    available: true,
    warning: hasApiKey
      ? 'Auto Best is using Compatibility on this system. Cloud Pro is available if you select it.'
      : 'Auto Best is using Compatibility on this system.',
    fallbackApplied: true,
  }
}