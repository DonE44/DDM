/**
 * @file desktop-api.d.ts
 * Type declarations for the `window.smmDesktop` API exposed by electron/preload.cjs
 * via contextBridge.  These types are used by Pylance / VS Code for inline error
 * detection in App.jsx (via // @ts-check) without requiring a full TypeScript migration.
 *
 * Keep this file in sync with electron/preload.cjs and electron/main.cjs.
 *
 * File format: .mme (FluxAura Studio project)
 * Internal tag namespace: mme: (formerly smm:)
 */

// ── Element types ────────────────────────────────────────────────────────────

/** A page element (text, clip, button, video, hotspot, etc.) */
interface SmmElement {
  id?: string
  /** Element type ('text', 'clip', 'button', 'mpeg', 'hotspot') */
  type?: string
  /** Legacy kind field — alias for type */
  kind?: string
  x?: number
  y?: number
  z?: number
  w?: number
  h?: number
  visible?: boolean
  wipe?: string
  wipeSpeed?: number
  wipeDir?: number
  // Playback controls
  loop?: boolean
  playCount?: number
  onPlayMode?: string
  afterPlay?: string
  afterPlayTarget?: string
  afterPlayTargetType?: string
  audioEvent?: string
  audioEventName?: string
  elLabel?: string
  groupId?: string
  /** When true, element cannot be selected or moved on the canvas */
  locked?: boolean
  afterElementLabel?: string
  onPlayDelay?: number
  playConditionAfterEl?: string
  playConditionSeqOrder?: number
  // Animation / Fly-in-out
  animIn?: string
  animInDuration?: number
  animInDelay?: number
  animInEasing?: string
  animOut?: string
  animOutDuration?: number
  animOutTrigger?: string
  animOutDelay?: number
  /** Continuous idle animation key from ANIM_LOOP_TYPES — plays while element is visible */
  animLoop?: string
  /** Speed multiplier for animLoop: 0.4=very slow … 2.5=very fast */
  animLoopSpeed?: number
  /** How many times the enter animation repeats (1=once, 0=infinite) */
  animInRepeat?: number
  // Media Timeline
  mediaStartTime?: number
  normalStatePauseMs?: number
  normalStatePlayTrigger?: 'click' | 'hover' | 'auto'
  normalStatePlayThenGoto?: boolean
  hotspotRadiusTL?: number
  hotspotRadiusTR?: number
  hotspotRadiusBL?: number
  hotspotRadiusBR?: number
  hoverMediaFromMs?: number
  hoverMediaToMs?: number
  clickMediaFromMs?: number
  clickMediaToMs?: number
  mediaPauseTime?: number | null
  mediaPauseAction?: string
  mediaPauseTarget?: string
  mediaPauseScript?: string
  mediaEndTime?: number | null
  mediaInTransition?: string
  mediaInDuration?: number
  mediaOutTransition?: string
  mediaOutDuration?: number
  mediaTimeMode?: string
  mediaFPS?: number
  // Media
  text?: string
  file?: string
  mediaKind?: string
  mediaSourcePath?: string
  mediaName?: string
  mediaExt?: string
  audioHidden?: boolean
  showMediaControls?: boolean
  autoPlay?: boolean
  pageAudioLane?: 1 | 2 | number
  pageAudioOffset?: number
  isNarrationClip?: boolean
  sourceTextElementId?: string
  textPreview?: string
  // Interaction
  interactive?: boolean
  waitOnClick?: boolean
  hoverScale?: number
  hoverOpacity?: number
  hoverOverlayOn?: boolean
  hoverColorOverlay?: string
  hoverFullscreen?: boolean
  hoverSoundFile?: string
  hoverSoundName?: string
  hoverMediaFile?: string
  hoverMediaName?: string
  hoverMediaLoop?: boolean
  hoverMediaPlayCount?: number
  hoverMediaPlay?: boolean
  clickScale?: number
  clickFullscreen?: boolean
  clickSoundFile?: string
  clickSoundName?: string
  clickMediaFile?: string
  clickMediaName?: string
  clickMediaLoop?: boolean
  clickMediaPlayCount?: number
  // Actions
  action?: string
  actionChain?: unknown[]
  ifCondVar?: string
  ifCondOp?: string
  ifCondVal?: string | number
  ifCondElse?: unknown[]
  // Text element fields
  content?: string
  font?: string
  size?: number
  weight?: string
  color?: string
  vAlign?: string
  shadow?: boolean | { color?: string; blur?: number; x?: number; y?: number }
  outline?: boolean
  italic?: boolean
  underline?: boolean
  bgColor?: string
  bgOn?: boolean
  // Button element fields
  label?: string
  btnShape?: string
  btnImage?: string
  fgColor?: string
  borderColor?: string
  borderWidth?: number
  radius?: string
  bevel?: boolean
  fontSize?: number
  fontWeight?: string
  textShadow?: boolean
  linkType?: string
  linkTarget?: string
  target?: string
  urlTarget?: string
  mediaFile?: string
  mediaFileName?: string
  scriptContent?: string
  gotoType?: string
  gotoPageName?: string
  gotoObjectId?: string
  gotoObjectLabel?: string
  matchSize?: boolean
  btnShadow?: boolean
  btnGrad?: string
  btnClipPng?: string
  textAnchorX?: string
  textAnchorY?: string
  hoverBg?: string
  hoverFg?: string
  hoverGrad?: string
  hoverBtnImage?: string
  pressedBg?: string
  pressedFg?: string
  pressedGrad?: string
  pressedBtnImage?: string
  // Clip/image element fields
  opacity?: number
  transparent?: boolean
  resizeW?: number
  resizeH?: number
  // Video element fields
  device?: string
  wait?: boolean
  maximize?: boolean
  // Hotspot element fields
  hotspotShape?: string
  points?: Array<{x: number, y: number}>
  borderOn?: boolean
  borderStyle?: string
  fillOpacity?: number
  fillColor?: string
  hoverEffect?: string
  hoverColor?: string
  pressedEffect?: string
  pressedColor?: string
  tooltip?: string
  [key: string]: any
}

/** A single presentation page */
interface SmmPage {
  id?: string
  name?: string
  bgColor?: string
  bgGradientEnabled?: boolean
  bgGradientFrom?: string
  bgGradientTo?: string
  bgGradientAngle?: number
  bgImage?: string
  bgMediaSrc?: string
  bgMediaName?: string
  bgMediaKind?: string
  bgMediaTransition?: string
  bgMediaSourcePath?: string
  /** Legacy top-level bg field */
  bg?: string
  bgSourcePath?: string
  bgVideo?: string | boolean
  wipeIn?: string
  wipeOut?: string
  wipeInSpeed?: number
  wipeOutSpeed?: number
  /** Legacy top-level duration — timing lives in page.timing.duration */
  duration?: number
  timing?: {
    mode: string
    duration?: number
    exportDuration?: number
    ms?: number
    durationMs?: number
    onEnd?: string
    onEndTarget?: string
    ifMode?: string
    ifCount?: number
    ifVar?: string
    ifOp?: string
    ifVal?: string
    elseDo?: string
    elseTarget?: string
    waitInputTrigger?: string
    waitInputKey?: string
    waitInputGoto?: string
    waitInputGotoType?: string
  }
  sound?: {
    file?: string
    name?: string
    rate?: number
    loops?: boolean
    spool?: boolean
    sourcePath?: string
  }
  narration?: {
    file?: string
    name?: string
    sourcePath?: string
    autoPlay?: boolean
    offset?: number
  }
  narration2?: {
    file?: string
    name?: string
    sourcePath?: string
    autoPlay?: boolean
    offset?: number
  }
  pageAudioClips?: Array<{
    id?: string
    lane?: 1 | 2 | number
    file?: string
    name?: string
    sourcePath?: string
    autoPlay?: boolean
    offset?: number
    duration?: number
    trimStart?: number
    textElementId?: string
    textPreview?: string
    wordTimestamps?: Array<{ start?: number, end?: number, text?: string, word?: string }>
  }>
  input?: {
    mouse?: boolean
    keyboard?: boolean
    mouseControls?: boolean
    pso?: boolean
  }
  pageScript?: {
    enabled?: boolean
    mode?: string
    code?: string
    file?: string
    fileName?: string
    sharedVars?: unknown[]
    waitForScript?: boolean
  }
  dataSource?: {
    enabled?: boolean
    file?: string
    fileName?: string
    type?: string
    rootPath?: string
    mappings?: unknown[]
  }
  pageType?: 'standard' | 'url'
  iframeUrl?: string
  /** When true, audio/video playing on this page continues into the next page instead of being stopped. */
  persistAudio?: boolean
  elements?: SmmElement[]
  /** User-assigned group names keyed by groupId */
  groupNames?: Record<string, string>
  [key: string]: any
}

/** Stage dimensions */
interface SmmStage {
  width: number
  height: number
  key?: string
  label?: string
}

// ── Parsed MME result ────────────────────────────────────────────────────────

interface ParsedMME {
  pages: SmmPage[]
  stage: SmmStage | null
  presentationAudio?: {
    name?: string
    volume?: number
    loop?: boolean
    sourcePath?: string
  } | null
  projectVars?: unknown[] | null
}

/** @deprecated Use ParsedMME */
type ParsedSCA = ParsedMME

// ── IPC result shapes ────────────────────────────────────────────────────────

interface OpenMmeResult {
  canceled: boolean
  filePath?: string
  fileName?: string
  content?: string
}

/** @deprecated Use OpenMmeResult */
type OpenScaResult = OpenMmeResult

interface SaveMmeResult {
  canceled: boolean
  filePath?: string
  fileName?: string
}

/** @deprecated Use SaveMmeResult */
type SaveScaResult = SaveMmeResult

interface SaveMmePayload {
  defaultName?: string
  text: string
}

/** @deprecated Use SaveMmePayload */
type SaveScaPayload = SaveMmePayload

interface SelectMediaResult {
  canceled: boolean
  filePath?: string
  fileName?: string
  dataUrl?: string
}

interface ReadMediaDataUrlResult {
  ok: boolean
  dataUrl?: string
  error?: string
}

interface TranscodeResult {
  ok: boolean
  /** Primary output path for transcoded file (images/video) */
  convertedPath?: string
  /** Human-readable hint about the output format (e.g. 'mp4 (h264/aac)') */
  outputHint?: string
  /** Legacy alias for convertedPath — may be present in older handlers */
  outputPath?: string
  /** Error reason string when ok is false */
  reason?: string
  /** Generic error message */
  error?: string
}

interface ExportDiagnosticsResult {
  ok?: boolean
  canceled?: boolean
  filePath?: string
  fileName?: string
}

interface MediaCapabilityResult {
  supported: boolean
  backend?: string
  support?: string
  category?: string
  extension?: string
  strategy?: string
  reason?: string
  outputHint?: string
}

interface RuntimeModeResult {
  isDev: boolean
  isPackaged: boolean
}

interface CapturePageResult {
  ok: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

interface AutoSaveResult {
  ok: boolean
  path?: string
  reason?: string
  error?: string
}

interface RestoreAutoSaveResult {
  ok: boolean
  text?: string
  name?: string
  mtime?: string
  path?: string
  reason?: string
}

interface ListFolderFileEntry {
  name: string
  path: string
}

interface ListFolderResult {
  ok: boolean
  files: ListFolderFileEntry[]
  error?: string
}

interface ExportFileFilter {
  name: string
  extensions: string[]
}

interface SaveExportFilePayload {
  base64: string
  defaultName: string
  filters?: ExportFileFilter[]
  outputFolder?: string | null
}

interface SaveExportFileResult {
  ok: boolean
  canceled?: boolean
  filePath?: string
  fileName?: string
  error?: string
}

interface ZipExportFile {
  name: string
  base64: string
}

interface SaveZipEncryptedPayload {
  files: ZipExportFile[]
  password: string
  defaultName: string
  filters?: ExportFileFilter[]
  outputFolder?: string | null
}

type SaveZipEncryptedResult = SaveExportFileResult

interface SystemFontEntry {
  name: string
  path: string
  file: string
}

interface ListSystemFontsResult {
  ok: boolean
  fonts: SystemFontEntry[]
  error?: string
}

interface LyricExportFrame {
  imageBase64: string
  durationSec: number
}

interface LyricExportAudioClip {
  path: string
  startSec: number
}

interface LyricExportEncodePayload {
  tmpId: string
  totalFrames: number
  audioSourcePath?: string | null
  audioClips?: LyricExportAudioClip[] | null
  outputPath?: string
  width?: number
  height?: number
  crf?: number
}

/** Progress event from whisper.onProgress */
interface WhisperProgressEvent {
  type?: string
  progress?: number
  message?: string
  status?: string
  file?: string
}

/** Whisper transcription result */
interface WhisperResult {
  text: string
  segments?: unknown[]
  language?: string
  chunks?: unknown[]
  wordTimestamps?: unknown[]
  engine?: string
  method?: string | null
  model?: string | null
  modelPath?: string | null
  warnings?: string[]
  gaps?: unknown[]
  containsGasoline?: boolean
  containsFingers?: boolean
  containsMatch?: boolean
  ok?: boolean
  error?: string
}

interface WhisperEngineStatusResult {
  defaultEngine?: string
  availableEngines?: Array<{
    id: string
    label?: string
    available?: boolean
    executablePath?: string | null
    modelCandidates?: string[]
    searchRoots?: string[]
  }>
}

/** Local Whisper model cache status */
interface WhisperModelStatusResult {
  allCached?: boolean
  dir?: string
  fileCount?: number
  sizeBytes?: number
  modelId?: string
  error?: string
}

/** Result from clearing one local Whisper model cache */
interface WhisperClearModelResult {
  ok: boolean
  dir?: string
  error?: string
}

/** HuggingFace token status returned by legacy token IPC */
interface HFTokenStatusResult {
  hasToken: boolean
  isValid: boolean
  username?: string
  error?: string
}

/** HuggingFace token validation result returned by legacy token IPC */
interface HFSetTokenResult {
  valid: boolean
  username?: string
  error?: string
}

/** HuggingFace token clear result returned by legacy token IPC */
interface HFClearTokenResult {
  success?: boolean
  ok?: boolean
  error?: string
}

// ── smmDesktop API surface ───────────────────────────────────────────────────

interface SmmDesktopApi {
  /**
   * Legacy IPC invoke bridge. Keep this narrow: expose only channels that are
   * explicitly whitelisted in electron/preload.cjs.
   */
  invoke(channel: 'whisper:getTokenStatus'): Promise<HFTokenStatusResult>
  invoke(channel: 'whisper:setHFToken', token: string): Promise<HFSetTokenResult>
  invoke(channel: 'whisper:clearHFToken'): Promise<HFClearTokenResult>
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  /** Show OS open-file dialog for .mme files */
  openMme(): Promise<OpenMmeResult>
  /** Show OS save-file dialog and write MME text to disk */
  saveMme(payload: SaveMmePayload): Promise<SaveMmeResult>
  /** Show OS open-file dialog for media files */
  selectMedia(payload?: { category?: string; title?: string }): Promise<SelectMediaResult>
  /** Read a media file and return it as a data URL (images / audio) */
  readMediaDataUrl(payload: { filePath: string; category?: string }): Promise<ReadMediaDataUrlResult>
  /** Lightweight existence check for native media paths */
  mediaExists(payload: { filePath: string }): Promise<{ ok: boolean; exists: boolean; size?: number; reason?: string }>
  /** Transcode a media file via ffmpeg */
  transcodeMedia(payload: {
    inputPath?: string
    outputPath?: string
    filePath?: string
    category?: string
    support?: string
    extension?: string
    [key: string]: unknown
  }): Promise<TranscodeResult>
  /** Export media diagnostics report to a user-chosen file */
  exportMediaDiagnostics(payload: { reportText: string; defaultName?: string }): Promise<ExportDiagnosticsResult>
  /** Returns the list of supported media types */
  supportedMedia(): Promise<string[]>
  /** Check whether a specific media file/type is supported */
  mediaCapability(payload: { filePath?: string; mimeType?: string; fileName?: string }): Promise<MediaCapabilityResult>
  /** Returns the active media pipeline plan string */
  mediaPipelinePlan(): Promise<string>
  /** Returns available media backend names */
  mediaBackends(): Promise<string[]>
  /** Get transcoded media cache size/count */
  mediaCacheStats(): Promise<{ ok: boolean; cachePath?: string; files: number; bytes: number; reason?: string }>
  /** Clear transcoded media cache */
  clearMediaCache(): Promise<{ ok: boolean; cachePath?: string; files?: number; bytes?: number; clearedFiles?: number; clearedBytes?: number; reason?: string }>
  /** Returns whether the app is running in dev / packaged mode */
  getRuntimeMode(): Promise<RuntimeModeResult>
  /** Enable or disable kiosk mode */
  setKioskMode(payload: { enabled: boolean }): Promise<void>
  /** Synchronously-read media server port (available before React renders) */
  readonly mediaServerPort: number
  /** Async version of mediaServerPort (fallback) */
  getMediaServerPort(): Promise<number>
  /** Show OS folder picker */
  selectFolder(): Promise<{ canceled: boolean; folderPath?: string }>
  /** Save exported HTML / MMP / ZIP data through the native desktop path */
  saveExportFile(payload: SaveExportFilePayload): Promise<SaveExportFileResult>
  /** Save an encrypted ZIP bundle through the native desktop path */
  saveZipEncrypted(payload: SaveZipEncryptedPayload): Promise<SaveZipEncryptedResult>
  /** Capture the current page as a PNG */
  capturePage(opts?: { quality?: number; title?: string; defaultName?: string }): Promise<CapturePageResult>
  /** Save a PNG data URL to a user-chosen file */
  savePng(dataUrl: string, opts?: { defaultName?: string; title?: string }): Promise<CapturePageResult>
  /** List all files in a folder recursively (up to depth 3) */
  listFolderFiles(payload: { folderPath: string; mediaOnly?: boolean }): Promise<ListFolderResult>
  /** List installed system fonts for @font-face injection */
  listSystemFonts(): Promise<ListSystemFontsResult>
  /** Read a text file from disk */
  readTextFile(filePath: string): Promise<string>
  /** Write current MME text to persistent dev auto-save location */
  autoSaveMme(text: string, name?: string): Promise<AutoSaveResult>
  /** Restore the most recent dev auto-save from disk */
  restoreAutoSave(): Promise<RestoreAutoSaveResult>
  /** Send renderer diagnostics to the Electron main-process launch log */
  logError(payload: { message?: string; stack?: string; type?: string; url?: string; line?: number | string; col?: number | string }): void
  /** Offline translation API */
  translate: {
    translate(payload: { texts: string[]; srcLang?: string; tgtLang?: string }): Promise<{ ok: boolean; texts?: string[]; error?: string }>
    cancel(): Promise<{ ok: boolean; error?: string }>
    modelStatus(): Promise<{ ok: boolean; status?: string; modelId?: string; error?: string }>
    onProgress(handler: (data: unknown) => void): () => void
  }
  /** Lyric video export API (electron/lyric-export.cjs) */
  lyricExport: {
    saveDialog(opts?: { defaultName?: string }): Promise<{ canceled: boolean; outputPath?: string }>
    exportVideo(payload: { frames: unknown[]; audioSourcePath: string; outputPath?: string; width?: number; height?: number }): Promise<{ ok: boolean; outputPath?: string; error?: string }>
    exportInit(): Promise<{ tmpId: string }>
    pushBatch(payload: { tmpId: string; batch: LyricExportFrame[]; startIndex: number }): Promise<{ ok: boolean; error?: string }>
    encode(payload: LyricExportEncodePayload): Promise<{ ok: boolean; outputPath?: string; error?: string }>
    onProgress(handler: (data: { progress?: number; status?: string }) => void): () => void
  }
  /** Whisper speech-to-text API (electron/whisper-transcribe.cjs) */
  whisper: {
    transcribe(payload: unknown): Promise<WhisperResult>
    setHFToken(payload: { token: string }): Promise<{ ok: boolean; error?: string }>
    cancel(): Promise<unknown>
    modelStatus(payload: { modelId: string }): Promise<WhisperModelStatusResult>
    clearModel(payload: { modelId: string }): Promise<WhisperClearModelResult>
    engineStatus(): Promise<WhisperEngineStatusResult>
    exportDebug(payload: { request?: unknown; output?: unknown }): Promise<{ ok: boolean; filePath?: string; error?: string }>
    onProgress(handler: (data: WhisperProgressEvent) => void): () => void
  }
  /** Piper TTS API (electron/piper-tts.cjs) */
  tts: {
    voicesCatalog(): Promise<unknown[]>
    voiceStatus(voiceId: string): Promise<unknown>
    downloadVoice(voiceId: string): Promise<{ ok: boolean; error?: string }>
    installBinary(): Promise<{ ok: boolean; alreadyInstalled?: boolean; error?: string }>
    synthesize(payload: { text: string; voiceId: string; rate?: number }): Promise<{ ok: boolean; path?: string; error?: string }>
    listCached(): Promise<unknown[]>
    onDownloadProgress(handler: (data: { stage?: string; percent?: number; detail?: string }) => void): () => void
  }
}

// ── Global augmentation ──────────────────────────────────────────────────────

declare global {
  interface Window {
    /**
     * Desktop API injected by electron/preload.cjs via contextBridge.
     * Only present when running inside Electron — always undefined in a browser.
     */
    smmDesktop?: SmmDesktopApi
    /** Bulk page-selection list for multi-page timing assignment */
    _smmBulkSelPages?: number[]
    [key: string]: unknown
  }

  /** Custom playback tracking property attached to media elements at runtime */
  interface HTMLVideoElement {
    _smm_paused_at?: boolean
  }
  interface HTMLAudioElement {
    _smm_paused_at?: boolean
  }

  /** Electron extends the File API with a native filesystem path */
  interface File {
    readonly path?: string
  }
  /** Non-standard attribute used by the folder-picker input */
  interface HTMLInputElement {
    webkitdirectory: string
  }
}

// Augment React JSX props so <input webkitdirectory="..." /> is accepted
declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string
  }
}

export type {
  SmmElement,
  SmmPage,
  SmmStage,
  ParsedMME,
  ParsedSCA,
  SmmDesktopApi,
  OpenMmeResult,
  OpenScaResult,
  SaveMmeResult,
  SaveScaResult,
  SaveMmePayload,
  SaveScaPayload,
  SelectMediaResult,
  ReadMediaDataUrlResult,
  TranscodeResult,
  AutoSaveResult,
  RestoreAutoSaveResult,
  ListFolderResult,
  ListFolderFileEntry,
  ExportFileFilter,
  SaveExportFilePayload,
  SaveExportFileResult,
  ZipExportFile,
  SaveZipEncryptedPayload,
  SaveZipEncryptedResult,
  SystemFontEntry,
  ListSystemFontsResult,
  LyricExportFrame,
  LyricExportAudioClip,
  LyricExportEncodePayload,
  WhisperResult,
  WhisperModelStatusResult,
  WhisperClearModelResult,
  HFTokenStatusResult,
  HFSetTokenResult,
  HFClearTokenResult,
}
