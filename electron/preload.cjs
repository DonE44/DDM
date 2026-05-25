const { contextBridge, ipcRenderer } = require('electron')

// Read the media server port synchronously so it's available before any
// page scripts run — eliminates the async race condition when media is
// imported immediately after startup.
console.log('[preload] Starting preload script in context isolation')
const _mediaServerPort = ipcRenderer.sendSync('media:get-server-port-sync') || 0
console.log('[preload] Got media server port:', _mediaServerPort)

console.log('[preload] About to expose smmDesktop to window')

const LEGACY_INVOKE_CHANNELS = new Set([
  'whisper:getTokenStatus',
  'whisper:setHFToken',
  'whisper:clearHFToken',
])

contextBridge.exposeInMainWorld('smmDesktop', {
  invoke: (channel, ...args) => {
    if (!LEGACY_INVOKE_CHANNELS.has(channel)) {
      throw new Error(`Unsupported desktop invoke channel: ${channel}`)
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  openMme: () => ipcRenderer.invoke('dialog:open-sca'),
  saveMme: (payload) => ipcRenderer.invoke('dialog:save-sca', payload),
  selectMedia: (payload) => ipcRenderer.invoke('dialog:select-media', payload),
  readMediaDataUrl: (payload) => ipcRenderer.invoke('media:read-data-url', payload),
  mediaExists: (payload) => ipcRenderer.invoke('media:exists', payload),
  transcodeMedia: (payload) => ipcRenderer.invoke('media:transcode', payload),
  exportMediaDiagnostics: (payload) => ipcRenderer.invoke('media:export-diagnostics', payload),
  supportedMedia: () => ipcRenderer.invoke('app:supported-media'),
  mediaCapability: (payload) => ipcRenderer.invoke('app:media-capability', payload),
  mediaPipelinePlan: () => ipcRenderer.invoke('app:media-pipeline-plan'),
  mediaBackends: () => ipcRenderer.invoke('app:media-backends'),
  mediaCacheStats: () => ipcRenderer.invoke('media:cache-stats'),
  clearMediaCache: () => ipcRenderer.invoke('media:cache-clear'),
  getRuntimeMode: () => ipcRenderer.invoke('app:get-runtime-mode'),
  setKioskMode: (payload) => ipcRenderer.invoke('app:set-kiosk-mode', payload),
  getMediaServerPort: () => ipcRenderer.invoke('media:get-server-port'),
  mediaServerPort: _mediaServerPort,
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  saveExportFile: (payload) => ipcRenderer.invoke('export:save-file', payload),
  saveZipEncrypted: (payload) => ipcRenderer.invoke('export:save-zip-encrypted', payload),
  capturePage: (opts) => ipcRenderer.invoke('app:capture-page', opts),
  savePng: (dataUrl, opts) => ipcRenderer.invoke('app:save-png', dataUrl, opts),
  listFolderFiles: (payload) => ipcRenderer.invoke('fs:list-folder-files', payload),
  listSystemFonts: () => ipcRenderer.invoke('fonts:list-system'),
  readTextFile: (filePath) => ipcRenderer.invoke('app:read-text-file', filePath),
  autoSaveMme: (text, name) => ipcRenderer.invoke('mme:autosave', text, name),
  restoreAutoSave: () => ipcRenderer.invoke('mme:restore-autosave'),
  logError: (payload) => ipcRenderer.send('renderer:log-error', {
    message: String(payload?.message || 'Unknown renderer error'),
    stack: payload?.stack ? String(payload.stack) : '',
    type: String(payload?.type || 'Renderer Error'),
    url: payload?.url ? String(payload.url) : '',
    line: payload?.line ?? '',
    col: payload?.col ?? '',
  }),
  // ── Piper TTS ──────────────────────────────────────────────────────────
  tts: {
    voicesCatalog: () => ipcRenderer.invoke('tts:piper-voices-catalog'),
    voiceStatus: (voiceId) => ipcRenderer.invoke('tts:piper-voice-status', voiceId),
    downloadVoice: (voiceId) => ipcRenderer.invoke('tts:piper-download-voice', voiceId),
    installBinary: () => ipcRenderer.invoke('tts:piper-install-binary'),
    synthesize: (payload) => ipcRenderer.invoke('tts:piper-synthesize', payload),
    listCached: () => ipcRenderer.invoke('tts:piper-list-cached'),
    onDownloadProgress: (cb) => {
      const handler = (_event, data) => cb(data)
      ipcRenderer.on('tts:piper-download-progress', handler)
      return () => ipcRenderer.removeListener('tts:piper-download-progress', handler)
    },
  },
  // ── Whisper transcription (runs entirely in main/Node.js process) ─────────
  whisper: {
    transcribe:    (payload) => ipcRenderer.invoke('whisper:transcribe', payload),
    setHFToken:    (payload) => ipcRenderer.invoke('whisper:set-hf-token', payload),
    cancel:        ()        => ipcRenderer.invoke('whisper:cancel'),
    modelStatus:   (payload) => ipcRenderer.invoke('whisper:model-status', payload),
    clearModel:    (payload) => ipcRenderer.invoke('whisper:clear-model', payload),
    engineStatus:  ()        => ipcRenderer.invoke('whisper:engine-status'),
    exportDebug:   (payload) => ipcRenderer.invoke('whisper:export-debug', payload),
    onProgress: (cb) => {
      const handler = (_event, data) => cb(data)
      ipcRenderer.on('whisper:progress', handler)
      return () => ipcRenderer.removeListener('whisper:progress', handler)
    },
  },
  // ── Lyric video MP4 export ────────────────────────────────────────────────
  lyricExport: {
    saveDialog:   (payload) => ipcRenderer.invoke('lyric:save-dialog', payload),
    exportVideo:  (payload) => ipcRenderer.invoke('lyric:export-video', payload),
    // Streaming multi-frame export (used by ScriptExportModal for karaoke/video rendering)
    exportInit:   ()        => ipcRenderer.invoke('lyric:export-init'),
    pushBatch:    (payload) => ipcRenderer.invoke('lyric:export-push-batch', payload),
    encode:       (payload) => ipcRenderer.invoke('lyric:export-encode', payload),
    onProgress: (cb) => {
      const handler = (_event, data) => cb(data)
      ipcRenderer.on('lyric:export-progress', handler)
      return () => ipcRenderer.removeListener('lyric:export-progress', handler)
    },
  },
  // ── Offline translation (NLLB-200, 200+ languages) ────────────────────────
  translate: {
    translate:    (payload) => ipcRenderer.invoke('translate:start', payload),
    cancel:       ()        => ipcRenderer.invoke('translate:cancel'),
    modelStatus:  ()        => ipcRenderer.invoke('translate:status'),
    onProgress: (cb) => {
      const handler = (_event, data) => cb(data)
      ipcRenderer.on('translate:progress', handler)
      return () => ipcRenderer.removeListener('translate:progress', handler)
    },
  },
})

console.log('[preload] smmDesktop exposed successfully', {
  hasWhisper: typeof window.smmDesktop?.whisper === 'object',
  hasTranscribe: typeof window.smmDesktop?.whisper?.transcribe === 'function',
})
