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
    description: 'Demucs + Faster-Whisper quality path (gated and setup-dependent).',
    engineIntent: 'quality-local-pro',
    preferredEngine: 'local-pro',
    fallbackEngine: 'fast-local',
    transcriptionMode: 'lyric-vocal-focus',
    requiresApiKey: false,
    requiresLocalTools: true,
    runtimeEnabled: false,
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

export const LOCAL_PRO_PERFORMANCE_PROFILES = [
  {
    id: 'fast',
    label: 'Fast',
    model: 'small',
    beamSize: 3,
    vadFilter: true,
    device: 'cpu',
    computeType: 'int8',
    estimatedRuntime: 'Fastest turnaround',
    estimatedRam: '4-6 GB RAM',
    heavyRisk: false,
    experimental: false,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    model: 'medium',
    beamSize: 5,
    vadFilter: true,
    device: 'cpu',
    computeType: 'int8',
    estimatedRuntime: 'Recommended default',
    estimatedRam: '6-10 GB RAM',
    heavyRisk: false,
    experimental: false,
  },
  {
    id: 'pro',
    label: 'Pro Heavy',
    model: 'large-v3',
    beamSize: 5,
    vadFilter: true,
    device: 'cpu',
    computeType: 'int8_float16',
    estimatedRuntime: 'Longest runtime',
    estimatedRam: '12-18 GB RAM',
    heavyRisk: true,
    experimental: false,
  },
  {
    id: 'gpu',
    label: 'Experimental GPU',
    model: 'large-v3',
    beamSize: 5,
    vadFilter: true,
    device: 'cuda',
    computeType: 'float16',
    estimatedRuntime: 'Potentially fastest when CUDA is healthy',
    estimatedRam: '8+ GB VRAM',
    heavyRisk: true,
    experimental: true,
  },
]

export const DEFAULT_LOCAL_PRO_PROFILE_ID = 'balanced'

export function getLocalProProfileById(profileId) {
  return LOCAL_PRO_PERFORMANCE_PROFILES.find((profile) => profile.id === profileId)
    || LOCAL_PRO_PERFORMANCE_PROFILES.find((profile) => profile.id === DEFAULT_LOCAL_PRO_PROFILE_ID)
    || LOCAL_PRO_PERFORMANCE_PROFILES[0]
}

export const DEFAULT_TRANSCRIPTION_PRESET_ID = 'auto-best'

export function getTranscriptionPresetById(id) {
  return TRANSCRIPTION_PRESETS.find((p) => p.id === id) || TRANSCRIPTION_PRESETS[0]
}

/**
 * @param {{
 *   presetId?: string,
 *   hasWhisperCpp?: boolean,
 *   hasLocalPro?: boolean,
 *   localProRuntimeEnabled?: boolean,
 *   localProSetupState?: string,
 *   localProSetupHint?: string,
 *   hasApiKey?: boolean,
 *   hasElectronIPC?: boolean,
 *   localProOptions?: any,
 * }} [input]
 */
export function resolveTranscriptionPreset({
  presetId,
  hasWhisperCpp = false,
  hasLocalPro = false,
  localProRuntimeEnabled = false,
  localProSetupState = 'Setup required',
  localProSetupHint = 'Local Pro setup required.',
  hasApiKey = false,
  hasElectronIPC = false,
  localProOptions = null,
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
    const selectedProfile = getLocalProProfileById(localProOptions?.profileId)
    const localProReady = hasLocalPro && hasElectronIPC && localProRuntimeEnabled
    const localProFoundationReady = hasLocalPro && hasElectronIPC
    const resolvedLocalProOptions = {
      profileId: selectedProfile.id,
      model: localProOptions?.model || selectedProfile.model,
      useVocalIsolation: !!localProOptions?.useVocalIsolation,
      beamSize: Number.isFinite(localProOptions?.beamSize)
        ? Math.max(1, Math.min(10, localProOptions.beamSize))
        : selectedProfile.beamSize,
      vadFilter: typeof localProOptions?.vadFilter === 'boolean'
        ? localProOptions.vadFilter
        : selectedProfile.vadFilter,
      device: localProOptions?.device || selectedProfile.device,
      computeType: localProOptions?.computeType || selectedProfile.computeType,
      allowFallbackOnFailure: localProOptions?.allowFallbackOnFailure === true,
      languageMode: localProOptions?.languageMode === 'manual' ? 'manual' : 'auto',
      language: String(localProOptions?.language || '').trim(),
      initialPrompt: String(localProOptions?.initialPrompt || ''),
    }

    if (localProReady) {
      return {
        preset,
        transcriptionMode: preset.transcriptionMode,
        selectedPreset: preset.id,
        modelId: 'Xenova/whisper-medium',
        engineIntent: preset.engineIntent,
        resolvedEngine: 'local-pro',
        requiresApiKey: false,
        requiresLocalTools: true,
        available: true,
        warning: '',
        fallbackApplied: false,
        runtimeEnabled: true,
        localProOptions: resolvedLocalProOptions,
        localProProfile: selectedProfile,
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
      warning: localProFoundationReady
        ? 'Local Pro runtime is currently disabled. Using Compatibility fallback.'
        : `${localProSetupState}. ${localProSetupHint} Using Compatibility fallback.`,
      fallbackApplied: true,
      runtimeEnabled: false,
      localProOptions: resolvedLocalProOptions,
      localProProfile: selectedProfile,
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