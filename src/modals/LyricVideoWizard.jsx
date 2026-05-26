// @ts-check
/**
 * LyricVideoWizard — 5-step wizard to create a music lyric video project.
 *
 * Step 1 — Import Audio (drag & drop / pick MP3/WAV/FLAC)
 * Step 2 — Transcribe (Whisper model picker + transcribe button)
 * Step 3 — Edit Lyric Lines (editable table: start | end | text)
 * Step 4 — Page Style (font, size, colour, background, text position)
 * Step 5 — Generate (creates pages + presentationAudio + opens project)
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import SmartColorPicker from '../components/SmartColorPicker.tsx'
import WhisperPanel from '../components/WhisperPanel.jsx'
import {
  isWhisperAvailable,
  transcribe,
  DEFAULT_WHISPER_MODEL,
  TRANSCRIPTION_PRESETS,
  DEFAULT_TRANSCRIPTION_PRESET_ID,
  LOCAL_PRO_PERFORMANCE_PROFILES,
  DEFAULT_LOCAL_PRO_PROFILE_ID,
  getLocalProProfileById,
  resolveTranscriptionPreset,
  buildLyricLinesFromWords,
  expandSentencesToWords,
  generateWordTimestamps,
} from '../utils/whisperUtils.js'
import { alignLyricsToAudio } from '../utils/lyricAlignUtils.js'
import { makePage, makeElem } from '../utils/stageUtils.js'
import WordTranscriptEditor from '../components/WordTranscriptEditor.jsx'
import LyricTimeline from '../components/LyricTimeline.jsx'
import FontPicker from '../components/FontPicker.jsx'

/** @typedef {{ id:string, start:number, end:number, text:string, durationMs:number }} LyricLine */

const uid = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

const STEPS = ['Import Audio', 'Transcribe', 'Edit Lyrics', 'Style', 'Generate']

const DEFAULT_STYLE = {
  fontFamily: 'Arial',
  fontSize: 36,
  color: '#ffffff',
  textAlign: 'center',
  position: 'center',   // 'top' | 'center' | 'bottom'
  bgType: 'color',      // 'color' | 'gradient' | 'none'
  bgColor: '#1a0033',
  bgGradientA: '#1a0033',
  bgGradientB: '#0a001a',
  textShadow: true,
}

const FONT_LIST = [] // removed — font selection is now handled by FontPicker component
const LYRIC_LINE_STYLE_PRESETS = {
  balanced: {
    label: 'Balanced',
    maxChars: 48,
    maxDurationSec: 4.5,
    pauseBreakSec: 0.7,
    strongPauseBreakSec: 0.9,
    minWordsPerLine: 2,
  },
  'karaoke-tight': {
    label: 'Karaoke Tight',
    maxChars: 22,
    maxDurationSec: 2.4,
    pauseBreakSec: 0.28,
    strongPauseBreakSec: 0.55,
    minWordsPerLine: 1,
  },
  subtitle: {
    label: 'Subtitle',
    maxChars: 56,
    maxDurationSec: 6.0,
    pauseBreakSec: 0.75,
    strongPauseBreakSec: 1.1,
    minWordsPerLine: 3,
  },
  'word-sync': {
    label: 'Word Sync',
    maxChars: 18,
    maxDurationSec: 1.8,
    pauseBreakSec: 0.25,
    strongPauseBreakSec: 0.45,
    minWordsPerLine: 1,
  },
}

export default function LyricVideoWizard({
  /** Called when user completes the wizard — receives { pages, presentationAudio } */
  onGenerate,
  /** Called when user dismisses the wizard */
  onClose,
  /** Stage dimensions */
  stageWidth = 1280,
  stageHeight = 720,
  /** Existing project's media server port for URL building */
  mediaServerPort = 0,
}) {
  const [step, setStep] = useState(0)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioName, setAudioName] = useState('')
  const [audioSourcePath, setAudioSourcePath] = useState('')
  const [transcribeResult, setTranscribeResult] = useState({ text: '', segments: [], chunks: [], engine: 'xenova', method: null, model: null, warnings: [], gaps: [] })
  const [rawTranscriptDraft, setRawTranscriptDraft] = useState('')
  const [openingLyricsWarning, setOpeningLyricsWarning] = useState('')
  const [editDebugTab, setEditDebugTab] = useState('lyric-lines')
  const [transcribePresetId, setTranscribePresetId] = useState(DEFAULT_TRANSCRIPTION_PRESET_ID)
  const [pasteSyncPresetId, setPasteSyncPresetId] = useState(DEFAULT_TRANSCRIPTION_PRESET_ID)
  const [localProOptions, setLocalProOptions] = useState(() => ({
    profileId: DEFAULT_LOCAL_PRO_PROFILE_ID,
    model: 'medium',
    useVocalIsolation: true,
    beamSize: 5,
    vadFilter: true,
    device: 'cpu',
    computeType: 'int8',
    allowFallbackOnFailure: false,
    languageMode: 'auto',
    language: '',
    initialPrompt: '',
  }))
  const [engineCapabilities, setEngineCapabilities] = useState(() => ({
    hasWhisperCpp: false,
    hasLocalPro: false,
    hasElectronIPC: typeof window !== 'undefined' && typeof window.smmDesktop?.whisper?.engineStatus === 'function',
  }))
  const [localProStatus, setLocalProStatus] = useState(null)
  const [hasApiKey] = useState(() => {
    const apiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('openai-api-key') || '').trim() : ''
    return Boolean(apiKey)
  })
  const [lines, setLines] = useState(/** @type {LyricLine[]} */ ([]))
  const [style, setStyle] = useState(DEFAULT_STYLE)
  // bgMedia: array of { url, name, type: 'image'|'video', sourcePath? }
  const [bgMedia, setBgMedia] = useState(/** @type {{url:string,name:string,type:string,sourcePath?:string}[]} */ ([]))
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState('')
  const [whisperAvailable, setWhisperAvailable] = useState(/** @type {boolean|null} */ (null))
  // Song metadata — used for intro and credit pages
  const [songTitle, setSongTitle] = useState('')
  const [artistName, setArtistName] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [copyrightYear, setCopyrightYear] = useState(String(new Date().getFullYear()))
  // Step 2 tabs: 'transcribe' = Whisper auto | 'paste' = paste text + sync
  const [syncMode, setSyncMode] = useState('transcribe')
  const [pasteText, setPasteText] = useState('')
  const [pasteAligning, setPasteAligning] = useState(false)
  const [pasteAlignStatus, setPasteAlignStatus] = useState('')
  // Step 3 translation
  const NLLB_LANGUAGES = [
    { code: 'eng_Latn', label: 'English' }, { code: 'fra_Latn', label: 'French' },
    { code: 'deu_Latn', label: 'German' },  { code: 'spa_Latn', label: 'Spanish' },
    { code: 'ita_Latn', label: 'Italian' }, { code: 'por_Latn', label: 'Portuguese' },
    { code: 'nld_Latn', label: 'Dutch' },   { code: 'pol_Latn', label: 'Polish' },
    { code: 'swe_Latn', label: 'Swedish' }, { code: 'dan_Latn', label: 'Danish' },
    { code: 'nor_Latn', label: 'Norwegian' },{ code: 'fin_Latn', label: 'Finnish' },
    { code: 'rus_Cyrl', label: 'Russian' }, { code: 'ukr_Cyrl', label: 'Ukrainian' },
    { code: 'ces_Latn', label: 'Czech' },   { code: 'hun_Latn', label: 'Hungarian' },
    { code: 'ron_Latn', label: 'Romanian' },{ code: 'tur_Latn', label: 'Turkish' },
    { code: 'ell_Grek', label: 'Greek' },   { code: 'arb_Arab', label: 'Arabic' },
    { code: 'heb_Hebr', label: 'Hebrew' },  { code: 'hin_Deva', label: 'Hindi' },
    { code: 'ben_Beng', label: 'Bengali' }, { code: 'urd_Arab', label: 'Urdu' },
    { code: 'zho_Hans', label: 'Chinese (Simplified)' }, { code: 'zho_Hant', label: 'Chinese (Traditional)' },
    { code: 'jpn_Jpan', label: 'Japanese' },{ code: 'kor_Hang', label: 'Korean' },
    { code: 'vie_Latn', label: 'Vietnamese' },{ code: 'tha_Thai', label: 'Thai' },
    { code: 'ind_Latn', label: 'Indonesian' },{ code: 'msa_Latn', label: 'Malay' },
    { code: 'swh_Latn', label: 'Swahili' }, { code: 'afr_Latn', label: 'Afrikaans' },
    { code: 'zul_Latn', label: 'Zulu' },    { code: 'xho_Latn', label: 'Xhosa' },
  ]
  const [translateSrc, setTranslateSrc] = useState('eng_Latn')
  const [translateTgt, setTranslateTgt] = useState('fra_Latn')
  const [translating, setTranslating] = useState(false)
  const [translateStatus, setTranslateStatus] = useState('')
  const fileInputRef = useRef(null)
  const bgMediaInputRef = useRef(null)  // HTML file input fallback (multi-select, image+video)
  const step3AudioRef = useRef(/** @type {HTMLAudioElement|null} */ (null))

  // Word-level segments for the interactive transcript editor in Step 3
  const [wordSegments, setWordSegments] = useState(/** @type {{start:number,end:number,text:string}[]} */ ([]))
  const [audioTime, setAudioTime] = useState(0)
  // Step 3 view: 'table' (stamp editor) or 'timeline' (drag timeline)
  const [step3View, setStep3View] = useState(/** @type {'table'|'timeline'} */ ('table'))
  const [lyricLineStyle, setLyricLineStyle] = useState('balanced')
  const [selectedRowIndex, setSelectedRowIndex] = useState(0)
  const [liveTimingMode, setLiveTimingMode] = useState(false)
  const rowRefs = useRef(/** @type {(HTMLTableRowElement | null)[]} */ ([]))

  useEffect(() => {
    isWhisperAvailable().then(setWhisperAvailable)
  }, [])

  useEffect(() => {
    const hasIPC = typeof window !== 'undefined' && typeof window.smmDesktop?.whisper?.engineStatus === 'function'
    if (!hasIPC) return

    window.smmDesktop.whisper.engineStatus()
      .then((info) => {
        const whisperCpp = Array.isArray(info?.availableEngines)
          ? info.availableEngines.find((e) => e.id === 'whisper.cpp')
          : null
        const localPro = Array.isArray(info?.availableEngines)
          ? info.availableEngines.find((e) => e.id === 'local-pro')
          : null
        setLocalProStatus(localPro || null)
        setEngineCapabilities({
          hasWhisperCpp: !!whisperCpp?.available,
          hasLocalPro: !!localPro?.runtimeEnabled,
          hasElectronIPC: true,
        })
      })
      .catch(() => {
        setLocalProStatus(null)
        setEngineCapabilities({ hasWhisperCpp: false, hasLocalPro: false, hasElectronIPC: true })
      })
  }, [])

  const transcribePreset = resolveTranscriptionPreset({
    presetId: transcribePresetId,
    hasWhisperCpp: engineCapabilities.hasWhisperCpp,
    hasLocalPro: engineCapabilities.hasLocalPro,
    localProRuntimeEnabled: !!localProStatus?.runtimeEnabled,
    localProSetupState: localProStatus?.setupState || 'Setup required',
    localProSetupHint: localProStatus?.setupHint || 'Local Pro setup required.',
    hasApiKey,
    hasElectronIPC: engineCapabilities.hasElectronIPC,
    localProOptions,
  })

  const pasteSyncPreset = resolveTranscriptionPreset({
    presetId: pasteSyncPresetId,
    hasWhisperCpp: engineCapabilities.hasWhisperCpp,
    hasLocalPro: engineCapabilities.hasLocalPro,
    localProRuntimeEnabled: !!localProStatus?.runtimeEnabled,
    localProSetupState: localProStatus?.setupState || 'Setup required',
    localProSetupHint: localProStatus?.setupHint || 'Local Pro setup required.',
    hasApiKey,
    hasElectronIPC: engineCapabilities.hasElectronIPC,
    localProOptions,
  })

  const selectedLocalProProfile = useMemo(() => getLocalProProfileById(localProOptions?.profileId), [localProOptions?.profileId])
  const localProPreflight = (() => {
    const profile = selectedLocalProProfile || getLocalProProfileById(DEFAULT_LOCAL_PRO_PROFILE_ID)
    const gpu = localProStatus?.gpu || null
    const gpuText = gpu?.available
      ? `${gpu.gpus?.[0]?.name || 'NVIDIA GPU detected'} (${gpu.gpus?.[0]?.memoryTotal || 'VRAM unknown'})`
      : 'No CUDA GPU detected; CPU mode recommended.'
    const heavyModel = String(localProOptions?.model || '').includes('large')
    return {
      profile,
      gpuText,
      heavyModel,
      warning: heavyModel
        ? 'Large-v3 can lock up on some systems. If it stalls, switch to Balanced or Fast.'
        : '',
    }
  })()

  const renderLocalProDetails = useCallback(() => {
    if (!localProStatus) return null
    const items = [
      ['Status', localProStatus.setupState || 'Unknown'],
      ['Hint', localProStatus.setupHint || ''],
      ['GPU', localProStatus.gpu?.available ? (localProStatus.gpu?.gpus?.[0]?.name || 'CUDA-capable GPU detected') : (localProStatus.gpu?.message || 'No CUDA GPU detected')],
      ['Python', localProStatus.python?.found ? `${localProStatus.python.version || 'found'}${localProStatus.python.path ? ` — ${localProStatus.python.path}` : ''}` : 'Missing'],
      ['pip', localProStatus.pip?.found ? `${localProStatus.pip.version || 'found'}${localProStatus.pip.path ? ` — ${localProStatus.pip.path}` : ''}` : 'Missing'],
      ['Faster-Whisper', localProStatus.fasterWhisper?.found ? (localProStatus.fasterWhisper.version || 'Installed') : 'Missing'],
      ['Demucs', localProStatus.demucs?.found ? (localProStatus.demucs.version || 'Installed') : 'Missing'],
      ['Model folders', Array.isArray(localProStatus.models) && localProStatus.models.length ? `${localProStatus.models.length} detected` : 'None detected'],
    ]
    return (
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map(([label, value]) => (
          <div key={label} style={{ fontSize: 11 }}>
            <strong>{label}:</strong> {value}
          </div>
        ))}
        {Array.isArray(localProStatus.models) && localProStatus.models.length > 0 && (
          <div style={{ fontSize: 11 }}>
            <strong>Detected paths:</strong> {localProStatus.models.slice(0, 3).map((model) => model.path).join(' | ')}
          </div>
        )}
      </div>
    )
  }, [localProStatus])

  const renderLocalProRuntimeControls = useCallback(() => {
    const modelOptions = ['tiny', 'base', 'small', 'medium', 'large-v3']
    return (
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border,#333)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <label style={{ fontSize: 11, color: 'var(--t3,#888)' }}>
          Performance profile
          <select
            value={localProOptions.profileId || DEFAULT_LOCAL_PRO_PROFILE_ID}
            onChange={(e) => {
              const profile = getLocalProProfileById(e.target.value)
              setLocalProOptions((prev) => ({
                ...prev,
                profileId: profile.id,
                model: profile.model,
                beamSize: profile.beamSize,
                vadFilter: profile.vadFilter,
                device: profile.device,
                computeType: profile.computeType,
              }))
            }}
            style={{ ...S.numInput, width: '100%', marginTop: 2 }}
          >
            {LOCAL_PRO_PERFORMANCE_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.label}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: 'var(--t3,#888)' }}>
          Faster-Whisper model
          <select
            value={localProOptions.model}
            onChange={(e) => setLocalProOptions((prev) => ({ ...prev, model: e.target.value }))}
            style={{ ...S.numInput, width: '100%', marginTop: 2 }}
          >
            {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: 'var(--t3,#888)' }}>
          Beam size
          <input
            type="number"
            min={1}
            max={10}
            value={localProOptions.beamSize}
            onChange={(e) => setLocalProOptions((prev) => ({ ...prev, beamSize: Math.max(1, Math.min(10, Number(e.target.value) || 5)) }))}
            style={{ ...S.numInput, width: '100%', marginTop: 2 }}
          />
        </label>
        <label style={{ fontSize: 11, color: 'var(--t3,#888)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={!!localProOptions.useVocalIsolation}
            onChange={(e) => setLocalProOptions((prev) => ({ ...prev, useVocalIsolation: e.target.checked }))}
          />
          Vocal isolation (Demucs)
        </label>
        <label style={{ fontSize: 11, color: 'var(--t3,#888)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={localProOptions.vadFilter !== false}
            onChange={(e) => setLocalProOptions((prev) => ({ ...prev, vadFilter: e.target.checked }))}
          />
          VAD filter
        </label>
        <label style={{ fontSize: 11, color: 'var(--t3,#888)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={localProOptions.allowFallbackOnFailure === true}
            onChange={(e) => setLocalProOptions((prev) => ({ ...prev, allowFallbackOnFailure: e.target.checked }))}
          />
          Allow Compatibility fallback on failure
        </label>
        <label style={{ fontSize: 11, color: 'var(--t3,#888)' }}>
          Language mode
          <select
            value={localProOptions.languageMode}
            onChange={(e) => setLocalProOptions((prev) => ({ ...prev, languageMode: e.target.value }))}
            style={{ ...S.numInput, width: '100%', marginTop: 2 }}
          >
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: 'var(--t3,#888)' }}>
          Manual language
          <input
            type="text"
            placeholder="en"
            disabled={localProOptions.languageMode !== 'manual'}
            value={localProOptions.language}
            onChange={(e) => setLocalProOptions((prev) => ({ ...prev, language: e.target.value }))}
            style={{ ...S.numInput, width: '100%', marginTop: 2, opacity: localProOptions.languageMode === 'manual' ? 1 : 0.6 }}
          />
        </label>
        <div style={{ gridColumn: '1 / -1', marginTop: 4, padding: 6, borderRadius: 6, border: '1px solid var(--border,#333)', background: 'var(--bg3,#1f1f1f)' }}>
          <div style={{ fontSize: 11, color: 'var(--t2,#bbb)' }}>
            Preflight: {localProPreflight.profile.label} | {localProPreflight.profile.estimatedRuntime} | {localProPreflight.profile.estimatedRam}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3,#888)', marginTop: 2 }}>
            Compute path: {String(localProOptions.device || localProPreflight.profile.device || 'cpu').toUpperCase()} / {String(localProOptions.computeType || localProPreflight.profile.computeType || 'int8')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3,#888)', marginTop: 2 }}>
            GPU status: {localProPreflight.gpuText}
          </div>
          {localProPreflight.warning && (
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 3 }}>{localProPreflight.warning}</div>
          )}
          {localProOptions.allowFallbackOnFailure !== true && (
            <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 3 }}>
              Fallback is OFF: Local Pro errors will be shown directly instead of silently switching engines.
            </div>
          )}
        </div>
      </div>
    )
  }, [localProOptions, localProPreflight])

  // Track audio current time while on Step 3 so timing buttons show the live position
  useEffect(() => {
    if (step !== 2) return
    const audio = step3AudioRef.current
    if (!audio) return
    const update = () => setAudioTime(audio.currentTime)
    audio.addEventListener('timeupdate', update)
    audio.addEventListener('seeked', update)
    return () => {
      audio.removeEventListener('timeupdate', update)
      audio.removeEventListener('seeked', update)
    }
  }, [step])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const makeMediaUrl = useCallback((filePath) => {
    if (!filePath) return ''
    if (/^(https?:|blob:|data:)/i.test(filePath)) return filePath
    if (mediaServerPort) return `http://127.0.0.1:${mediaServerPort}/media?p=${encodeURIComponent(filePath)}`
    return `file://${filePath}`
  }, [mediaServerPort])

  const formatTime = (s) => {
    if (s == null || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = (s % 60).toFixed(1)
    return `${m}:${sec.padStart(4, '0')}`
  }

  const getActiveLineStyle = useCallback(() => {
    const selected = LYRIC_LINE_STYLE_PRESETS[lyricLineStyle] ?? LYRIC_LINE_STYLE_PRESETS.balanced
    return {
      presetKey: lyricLineStyle,
      presetLabel: selected.label || 'Balanced',
      options: {
        maxChars: selected.maxChars,
        maxDurationSec: selected.maxDurationSec,
        pauseBreakSec: selected.pauseBreakSec,
        strongPauseBreakSec: selected.strongPauseBreakSec,
        minWordsPerLine: selected.minWordsPerLine,
      },
    }
  }, [lyricLineStyle])

  const rebuildFromWordSegments = useCallback((words, source) => {
    const active = getActiveLineStyle()
    const rebuilt = buildLyricLinesFromWords(words, active.options)
    const normalized = rebuilt.map((line) => ({
      id: uid(),
      start: Number(line.start) || 0,
      end: Number(line.end) || 0,
      text: String(line.text || '').trim(),
      durationMs: Number(line.durationMs) || Math.max(500, Math.round(((Number(line.end) || 0) - (Number(line.start) || 0)) * 1000)),
    }))

    console.log('[LyricWizard] lyric rebuild', {
      source,
      selectedLineStyle: active.presetKey,
      lineStyleLabel: active.presetLabel,
      options: active.options,
      inputWordCount: Array.isArray(words) ? words.length : 0,
      outputLineCount: normalized.length,
      first10GeneratedLines: normalized.slice(0, 10).map((l, i) => ({
        index: i + 1,
        start: l.start,
        end: l.end,
        text: l.text,
      })),
    })

    return normalized
  }, [getActiveLineStyle])

  /** Precomputed line counts per preset, updates when wordSegments changes */
  const previewLineCounts = useMemo(() => {
    if (!wordSegments.length) return {}
    return Object.fromEntries(
      Object.entries(LYRIC_LINE_STYLE_PRESETS).map(([key, preset]) => [
        key,
        buildLyricLinesFromWords(wordSegments, preset).length,
      ])
    )
  }, [wordSegments])

  const reparseRawTranscript = useCallback((rawText) => {
    const txt = String(rawText || '').trim()
    const sentences = txt
      .split(/(?<=[.!?,;])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!sentences.length) return

    const rebuiltSegments = sentences.map((s, idx) => ({
      start: idx * 4,
      end: (idx + 1) * 4,
      text: s,
    }))
    const rebuiltWords = expandSentencesToWords(rebuiltSegments)
    const rebuiltLines = rebuildFromWordSegments(rebuiltWords, 'raw-reparse')

    setWordSegments(rebuiltWords)
    setTranscribeResult((prev) => ({
      ...prev,
      text: txt,
      segments: rebuiltSegments,
      chunks: rebuiltSegments,
    }))
    setRawTranscriptDraft(txt)
    setLines(rebuiltLines.length ? rebuiltLines : sentences.map((s, idx) => ({
      id: uid(),
      start: idx * 4,
      end: (idx + 1) * 4,
      text: s,
      durationMs: 4000,
    })))
  }, [rebuildFromWordSegments])

  const isLyricCandidate = useCallback((txt) => {
    const t = String(txt || '').trim()
    if (!t) return false
    if (/^\[(music|instrumental|silence|noise)/i.test(t)) return false
    if (/^\[TRANSCRIPTION GAP/i.test(t)) return false
    return /[A-Za-z]/.test(t)
  }, [])

  const dedupeMergedSegments = useCallback((segments) => {
    const sorted = [...(segments || [])].sort((a, b) => (a?.start ?? Infinity) - (b?.start ?? Infinity))
    const out = []
    for (const seg of sorted) {
      const text = String(seg?.text || '').trim()
      if (!text) continue
      const start = Number(seg?.start)
      const end = Number(seg?.end)
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue
      const dup = out.some((k) => (
        Math.abs(k.start - start) < 0.25
        && Math.abs(k.end - end) < 0.25
        && String(k.text || '').trim() === text
      ))
      if (!dup) out.push({ start, end, text })
    }
    return out
  }, [])

  const buildLyricLinesFromWordsLocal = useCallback((words, firstTimedSegmentStart) => {
    const lyricLines = rebuildFromWordSegments(words, 'transcribe-result')
    if (firstTimedSegmentStart >= 15 && lyricLines.length > 0 && lyricLines[0].start > 8) {
      lyricLines.unshift({
        id: uid(),
        start: 0,
        end: Math.round(lyricLines[0].start * 1000) / 1000,
        text: `[POSSIBLE MISSING VOCALS 0.0s-${lyricLines[0].start.toFixed(1)}s — retry/opening section/manual edit]`,
        durationMs: Math.round(lyricLines[0].start * 1000),
      })
    }
    return lyricLines
  }, [rebuildFromWordSegments])

  const confirmLocalProHeavyRun = useCallback((preset, contextLabel = 'Local Pro run') => {
    if (String(preset?.resolvedEngine || '').toLowerCase() !== 'local-pro') return true
    const model = String(preset?.localProOptions?.model || '').toLowerCase()
    if (!model.includes('large')) return true
    return window.confirm(
      `${contextLabel}: Large-v3 can lock up or time out on some systems. Continue?\n\n` +
      'Recommendation: use Balanced or Fast profile if this fails.'
    )
  }, [])

  // ── Step 1: Pick audio ────────────────────────────────────────────────────

  const handlePickAudio = async () => {
    if (window.smmDesktop?.selectMedia) {
      const r = await window.smmDesktop.selectMedia({ category: 'audio', title: 'Select music track' })
      if (!r?.canceled && r?.filePath) {
        setAudioUrl(makeMediaUrl(r.filePath))
        setAudioName(r.fileName || r.filePath.split(/[\\/]/).pop() || 'audio')
        setAudioSourcePath(r.filePath)
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleHtmlAudioPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioUrl(URL.createObjectURL(file))
    setAudioName(file.name)
    setAudioSourcePath('')
  }

  // ── Step 2: Transcription results → lines ────────────────────────────────

  /** @param {any} result */
  const handleTranscribeResult = useCallback((result) => {
    const safeResult = /** @type {any} */ (result || {})
    const {
      text,
      segments,
      chunks,
      wordTimestamps = [],
      engine,
      method,
      model,
      warnings = [],
      gaps = [],
    } = safeResult
    try {
      const safeSegments = Array.isArray(segments) ? segments : Array.isArray(chunks) ? chunks : []
      const orderedSegments = [...safeSegments].sort((a, b) => {
        const aStart = Number.isFinite(a?.start) ? a.start : Number.POSITIVE_INFINITY
        const bStart = Number.isFinite(b?.start) ? b.start : Number.POSITIVE_INFINITY
        return aStart - bStart
      })
      setTranscribeResult({
        text: text ?? '',
        segments: orderedSegments,
        chunks: orderedSegments,
        engine: engine || 'xenova',
        method: method || null,
        model: model || DEFAULT_WHISPER_MODEL,
        warnings: Array.isArray(warnings) ? warnings : [],
        gaps: Array.isArray(gaps) ? gaps : [],
      })
      setRawTranscriptDraft(text ?? '')

      // Expand to word-level segments for the interactive editor.
      // ALWAYS start with expanded word list from sentence segments to ensure complete coverage.
      // Only override with real word timestamps if they're available (more accurate).
      let words = expandSentencesToWords(orderedSegments)
      if (Array.isArray(wordTimestamps) && wordTimestamps.length > 0) {
        words = [...wordTimestamps].sort((a, b) => {
          const aStart = Number.isFinite(a?.start) ? a.start : Number.POSITIVE_INFINITY
          const bStart = Number.isFinite(b?.start) ? b.start : Number.POSITIVE_INFINITY
          return aStart - bStart
        })
      }

      setWordSegments(words)

      const firstTimedSegment = orderedSegments.find((seg) => {
        const txt = String(seg?.text || '').trim()
        return txt && isLyricCandidate(txt) && Number.isFinite(seg?.start)
      })
      if (firstTimedSegment && firstTimedSegment.start > 15) {
        setOpeningLyricsWarning(`Possible missing opening lyrics (first lyric at ${firstTimedSegment.start.toFixed(1)}s). Use Retry Opening Section or Paste & Sync.`)
      } else {
        setOpeningLyricsWarning('')
      }

      const firstLyricStart = Number.isFinite(firstTimedSegment?.start) ? firstTimedSegment.start : 0
      const lyricLines = buildLyricLinesFromWordsLocal(words, firstLyricStart)

      // Safety net — if no segments/words were produced at all
      if (lyricLines.filter(l => l.text).length === 0) {
        const rawText = String(text ?? '').trim()
        if (rawText) {
          rawText.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean)
            .forEach((s, idx) => {
              lyricLines.push({ id: uid(), start: idx * 4, end: (idx + 1) * 4, text: s, durationMs: 4000 })
            })
        }
      }
      if (lyricLines.filter(l => l.text).length === 0) {
        lyricLines.push({ id: uid(), start: 0, end: 4, text: 'No lyrics detected — edit manually', durationMs: 4000 })
      }

      setLines(lyricLines)
      setStep(2)
    } catch (err) {
      console.error('[LyricWizard] handleTranscribeResult error:', err)
      setOpeningLyricsWarning('')
      setLines([{ id: uid(), start: 0, end: 4, text: 'Transcription parse error — edit manually', durationMs: 4000 }])
      setStep(2)
    }
  }, [buildLyricLinesFromWordsLocal, isLyricCandidate])

  const handleRetryOpeningSection = useCallback(async () => {
    if (!audioUrl) return
    if (!confirmLocalProHeavyRun(transcribePreset, 'Retry opening section')) return
    try {
      const res = await transcribe(audioUrl, {
        audioFilePath: audioSourcePath || undefined,
        model: transcribePreset.modelId,
        selectedPreset: transcribePreset.selectedPreset,
        engineIntent: transcribePreset.engineIntent,
        resolvedEngine: transcribePreset.resolvedEngine,
        localProOptions: transcribePreset.localProOptions,
        wordTimestamps: true,
        transcriptionMode: transcribePreset.transcriptionMode || 'lyric-vocal-focus',
        openingSectionOnly: true,
      })
      const merged = dedupeMergedSegments([...(transcribeResult.chunks || []), ...(res.segments || [])])
      handleTranscribeResult({ ...res, chunks: merged, segments: merged })
      setOpeningLyricsWarning('Opening retry complete. Review early lines and adjust as needed.')
    } catch (err) {
      setOpeningLyricsWarning(`Opening retry failed: ${err?.message || String(err)}`)
    }
  }, [audioUrl, audioSourcePath, confirmLocalProHeavyRun, dedupeMergedSegments, handleTranscribeResult, transcribePreset, transcribeResult.chunks])

  const handleRetrySelectedSection = useCallback(async () => {
    if (!audioUrl) return
    if (!confirmLocalProHeavyRun(transcribePreset, 'Retry selected section')) return
    const startInput = window.prompt('Retry section start (seconds):', '0')
    const endInput = window.prompt('Retry section end (seconds):', '45')
    const start = Number(startInput)
    const end = Number(endInput)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return
    try {
      const res = await transcribe(audioUrl, {
        audioFilePath: audioSourcePath || undefined,
        model: transcribePreset.modelId,
        selectedPreset: transcribePreset.selectedPreset,
        engineIntent: transcribePreset.engineIntent,
        resolvedEngine: transcribePreset.resolvedEngine,
        localProOptions: transcribePreset.localProOptions,
        wordTimestamps: true,
        transcriptionMode: transcribePreset.transcriptionMode || 'lyric-vocal-focus',
        sectionStartSec: start,
        sectionEndSec: end,
      })
      const merged = dedupeMergedSegments([...(transcribeResult.chunks || []), ...(res.segments || [])])
      handleTranscribeResult({ ...res, chunks: merged, segments: merged })
    } catch (err) {
      setOpeningLyricsWarning(`Section retry failed: ${err?.message || String(err)}`)
    }
  }, [audioUrl, audioSourcePath, confirmLocalProHeavyRun, dedupeMergedSegments, handleTranscribeResult, transcribePreset, transcribeResult.chunks])

  // ── Step 2 "Paste & Sync" — align pasted lyrics to audio ──────────────────

  const handlePasteSync = useCallback(async () => {
    const trimmed = pasteText.trim()
    if (!trimmed) return
    setPasteAligning(true)
    setPasteAlignStatus('Transcribing audio for timing data…')
    try {
      let whisperWords = []
      if (audioUrl) {
        if (!confirmLocalProHeavyRun(pasteSyncPreset, 'Paste & Sync pre-transcription')) {
          setPasteAlignStatus('Cancelled before run. Choose Balanced or Fast for better stability.')
          return
        }
        const res = await transcribe(audioUrl, {
          audioFilePath: audioSourcePath || undefined,
          model: pasteSyncPreset.modelId,
          selectedPreset: pasteSyncPreset.selectedPreset,
          engineIntent: pasteSyncPreset.engineIntent,
          resolvedEngine: pasteSyncPreset.resolvedEngine,
          localProOptions: pasteSyncPreset.localProOptions,
          wordTimestamps: true,
          transcriptionMode: pasteSyncPreset.transcriptionMode || 'lyric-vocal-focus',
          onModelProgress: (p) => {
            if (p.status === 'progress' || p.status === 'download') {
              setPasteAlignStatus(`⬇ Downloading Whisper model: ${Math.round(p.progress || 0)}%`)
            } else if (p.status === 'ready') {
              setPasteAlignStatus('Model ready — transcribing…')
            }
          },
          onTranscribeProgress: (pct) => {
            if (pct > 0) setPasteAlignStatus(`Transcribing audio… ${pct}%`)
          },
        })
        whisperWords = res.wordTimestamps || res.chunks || []
      }
      setPasteAlignStatus('Aligning lyrics to audio timestamps…')
      const aligned = alignLyricsToAudio(trimmed, whisperWords)
      setLines(aligned.map(l => ({ id: uid(), ...l })))
      setPasteAlignStatus(`✅ Synced ${aligned.length} lines`)
      setStep(2)
    } catch (err) {
      setPasteAlignStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setPasteAligning(false)
    }
  }, [audioUrl, audioSourcePath, confirmLocalProHeavyRun, pasteSyncPreset, pasteText])

  // ── Step 3 offline translation ─────────────────────────────────────────────

  const handleTranslate = useCallback(async () => {
    if (!lines.length) return
    if (!window.smmDesktop?.translate?.translate) {
      alert('Translation requires the Electron desktop app.')
      return
    }
    setTranslating(true)
    setTranslateStatus('Connecting to translation engine…')
    const unsub = window.smmDesktop.translate.onProgress((data) => {
      const d = /** @type {{ type?: string; done?: number; total?: number; status?: string } | null} */ (data)
      if (d?.type === 'progress') {
        setTranslateStatus(`Translating line ${d.done} / ${d.total}…`)
      } else if (d?.status) {
        setTranslateStatus(d.status)
      }
    })
    try {
      const result = await window.smmDesktop.translate.translate({
        texts: lines.map(l => l.text),
        srcLang: translateSrc,
        tgtLang: translateTgt,
      })
      if (!result.ok) throw new Error(result.error || 'Translation failed')
      setLines(prev => prev.map((l, i) => ({ ...l, text: result.texts[i] ?? l.text })))
      setTranslateStatus(`✅ Translated ${result.texts.length} lines to ${NLLB_LANGUAGES.find(x => x.code === translateTgt)?.label || translateTgt}`)
    } catch (err) {
      setTranslateStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setTranslating(false)
      unsub()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, translateSrc, translateTgt])

  // ── Step 3: Edit lines ────────────────────────────────────────────────────

  /**
   * Update a single field on a line.
   * ripple=true: adjusting 'start' also nudges the previous line's end;
   *              adjusting 'end' also nudges the next line's start.
   * cascade=true: adjusting 'start' shifts ALL downstream lines by the delta.
   */
  const updateLine = useCallback((idx, field, value, ripple = false, cascade = false) => {
    setLines((prev) => {
      const next = prev.map((l, i) => {
        if (i !== idx) return l
        const updated = { ...l, [field]: value }
        if (field === 'start') updated.durationMs = Math.round((l.end - value) * 1000)
        if (field === 'end')   updated.durationMs = Math.round((value - l.start) * 1000)
        return updated
      })
      
      if (!ripple && !cascade) return next
      
      if (field === 'start') {
        const delta = value - prev[idx].start
        
        // Ripple backward: prev line's end → this line's new start
        if (ripple && idx > 0) {
          const prevL = next[idx - 1]
          next[idx - 1] = { ...prevL, end: value, durationMs: Math.round((value - prevL.start) * 1000) }
        }
        
        // Cascade forward: shift all downstream lines by delta
        if (cascade && idx < next.length - 1) {
          for (let i = idx + 1; i < next.length; i++) {
            next[i] = {
              ...next[i],
              start: next[i].start + delta,
              end: next[i].end + delta,
            }
          }
        }
      } else if (field === 'end') {
        // Ripple forward: next line's start → this line's new end
        if (ripple && idx < next.length - 1) {
          const nextL = next[idx + 1]
          next[idx + 1] = { ...nextL, start: value, durationMs: Math.round((nextL.end - value) * 1000) }
        }
      }
      
      return next
    })
  }, [])

  const deleteLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx))

  // ── Timing helpers (Step 3) ───────────────────────────────────────────────

  /** Seek audio to a given time */
  const seekTo = useCallback((t) => {
    if (step3AudioRef.current) step3AudioRef.current.currentTime = t
  }, [])

  /** Stamp current audio time as a line's start — ripples to previous line's end */
  const setLineStartNow = useCallback((idx) => {
    const t = Math.round((step3AudioRef.current?.currentTime ?? 0) * 100) / 100
    updateLine(idx, 'start', t, true)
  }, [updateLine])

  /** Stamp current audio time as a line's end — ripples to next line's start */
  const setLineEndNow = useCallback((idx) => {
    const t = Math.round((step3AudioRef.current?.currentTime ?? 0) * 100) / 100
    updateLine(idx, 'end', t, true)
  }, [updateLine])

  /** Stamp end time and advance to next row for rapid live timing */
  const setLineEndNowAdvance = useCallback((idx) => {
    const audio = step3AudioRef.current
    const isPlaying = !!audio && !audio.paused
    setLineEndNow(idx)
    const nextIdx = idx + 1
    if (nextIdx < lines.length) {
      setSelectedRowIndex(nextIdx)
    }
    if (isPlaying) audio?.play?.().catch(() => {})
  }, [lines, setLineEndNow])

  /** Split a line at the current audio time, distributing words across both halves */
  const splitLineNow = useCallback((idx) => {
    const t = Math.round((step3AudioRef.current?.currentTime ?? 0) * 100) / 100
    const line = lines[idx]
    if (!line) return
    const words = line.text.trim().split(/\s+/).filter(Boolean)
    const mid = Math.max(1, Math.ceil(words.length / 2))
    const splitT = t > line.start ? t : line.start + (line.end - line.start) / 2
    setLines(prev => {
      const copy = [...prev]
      copy.splice(idx, 1,
        { start: line.start, end: splitT, text: words.slice(0, mid).join(' '), id: uid(), durationMs: Math.round((splitT - line.start) * 1000) },
        { start: splitT, end: line.end, text: words.slice(mid).join(' '), id: uid(), durationMs: Math.round((line.end - splitT) * 1000) },
      )
      return copy
    })
  }, [lines])

  /** Move a line up or down in the list (does NOT re-sort by time — use Sort button for that) */
  const moveLine = (idx, dir) => {
    const other = idx + dir
    if (other < 0 || other >= lines.length) return
    setLines(prev => {
      const copy = [...prev]
      ;[copy[idx], copy[other]] = [copy[other], copy[idx]]
      return copy
    })
  }

  /** Set each line's end = start of the next line (fills gaps automatically) */
  const autoFillEnds = () => {
    setLines(prev => prev.map((l, i) => {
      const nextStart = prev[i + 1]?.start
      if (nextStart != null && nextStart > l.start) {
        return { ...l, end: nextStart, durationMs: Math.round((nextStart - l.start) * 1000) }
      }
      return l
    }))
  }

  const toggleLiveTimingMode = useCallback(() => {
    const next = !liveTimingMode
    setLiveTimingMode(next)
    if (!next) return
    const audio = step3AudioRef.current
    if (!audio) return
    const start = Number(lines[selectedRowIndex]?.start)
    if (Number.isFinite(start)) audio.currentTime = start
    audio.play?.().catch(() => {})
  }, [lines, liveTimingMode, selectedRowIndex])

  // In live mode, keep selected row tracking current playback position.
  useEffect(() => {
    if (step !== 2 || !liveTimingMode || !lines.length) return
    const idx = lines.findIndex((l, i) => {
      const start = Number(l?.start)
      const end = Number(l?.end)
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false
      if (i === lines.length - 1) return audioTime >= start && audioTime <= (end + 0.25)
      return audioTime >= start && audioTime < end
    })
    if (idx >= 0 && idx !== selectedRowIndex) {
      setSelectedRowIndex(idx)
    }
  }, [audioTime, lines, liveTimingMode, selectedRowIndex, step])

  // Follow the selected row in view while live timing.
  useEffect(() => {
    if (step !== 2 || !liveTimingMode) return
    const row = rowRefs.current[selectedRowIndex]
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [liveTimingMode, selectedRowIndex, step])

  // Step 3 keyboard shortcuts for fast timing, ignored while typing in form fields.
  useEffect(() => {
    if (step !== 2) return

    const isTypingTarget = (el) => {
      if (!el || !(el instanceof HTMLElement)) return false
      const tag = el.tagName
      return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON'
    }

    const onKeyDown = (e) => {
      if (isTypingTarget(/** @type {EventTarget|null} */ (e.target))) return
      if (!lines.length) return
      const idx = Math.max(0, Math.min(selectedRowIndex, lines.length - 1))
      const audio = step3AudioRef.current

      if (e.code === 'Space') {
        e.preventDefault()
        if (!audio) return
        if (audio.paused) audio.play?.().catch(() => {})
        else audio.pause?.()
        return
      }

      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        setLineStartNow(idx)
        return
      }
      if (key === 'e') {
        e.preventDefault()
        setLineEndNowAdvance(idx)
        return
      }
      if (key === 'x') {
        e.preventDefault()
        splitLineNow(idx)
        return
      }
      if (key === 'm') {
        e.preventDefault()
        if (idx >= lines.length - 1) return
        const line = lines[idx]
        const next = lines[idx + 1]
        const merged = `${String(line?.text || '').trim()} ${String(next?.text || '').trim()}`.trim()
        setLines((prev) => {
          const out = [...prev]
          out[idx] = {
            ...out[idx],
            text: merged,
            end: out[idx + 1].end,
            durationMs: Math.round((out[idx + 1].end - out[idx].start) * 1000),
          }
          out.splice(idx + 1, 1)
          return out
        })
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedRowIndex((prev) => Math.max(0, prev - 1))
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedRowIndex((prev) => Math.min(lines.length - 1, prev + 1))
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const line = lines[idx]
        if (!line) return
        const start = Math.max(0, Math.round((line.start - 0.1) * 10) / 10)
        const duration = Math.max(0.1, Number(line.end) - Number(line.start))
        updateLine(idx, 'start', start, false)
        updateLine(idx, 'end', Math.max(start + 0.1, Math.round((start + duration) * 10) / 10), false)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const line = lines[idx]
        if (!line) return
        const start = Math.round((line.start + 0.1) * 10) / 10
        const duration = Math.max(0.1, Number(line.end) - Number(line.start))
        updateLine(idx, 'start', start, false)
        updateLine(idx, 'end', Math.round((start + duration) * 10) / 10, false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lines, selectedRowIndex, setLineEndNowAdvance, setLineStartNow, splitLineNow, step, updateLine])

  // ── Step 4: Background media (images + videos) ────────────────────────────

  // Supported extensions for background media
  const BG_IMAGE_EXTS = ['jpg','jpeg','png','webp','avif','gif','bmp','svg','tif','tiff']
  const BG_VIDEO_EXTS = ['mp4','m4v','webm','mov','avi','mkv','wmv','mpeg','mpg']
  const BG_MEDIA_EXTS = [...BG_IMAGE_EXTS, ...BG_VIDEO_EXTS]

  const getMediaType = (name) => {
    const ext = (name.split('.').pop() || '').toLowerCase()
    return BG_VIDEO_EXTS.includes(ext) ? 'video' : 'image'
  }

  const addBgMediaItems = (items) => {
    setBgMedia(prev => [
      ...prev,
      ...items.map(({ url, name, sourcePath }) => ({
        url, name, type: getMediaType(name), sourcePath: sourcePath || null,
      })),
    ])
  }

  // Pick individual file (Electron native dialog — images & videos)
  const handlePickBgFile = async () => {
    if (window.smmDesktop?.selectMedia) {
      const r = await window.smmDesktop.selectMedia({ category: 'all', title: 'Select background image or video' }).catch(() => null)
      if (!r?.canceled && r?.filePath) {
        addBgMediaItems([{ url: makeMediaUrl(r.filePath), name: r.fileName || r.filePath.split(/[\\/]/).pop(), sourcePath: r.filePath }])
      }
    } else {
      bgMediaInputRef.current?.click()
    }
  }

  // Pick entire folder → scan recursively for image/video files
  const handlePickBgFolder = async () => {
    if (!window.smmDesktop?.selectFolder || !window.smmDesktop?.listFolderFiles) {
      alert('Folder import requires the desktop app.')
      return
    }
    const folderRes = await window.smmDesktop.selectFolder()
    if (folderRes?.canceled || !folderRes?.folderPath) return

    const filesRes = await window.smmDesktop.listFolderFiles({ folderPath: folderRes.folderPath, mediaOnly: true })
    if (!filesRes?.ok) {
      alert(`Error: ${filesRes?.error || 'Unable to read folder'}`)
      return
    }

    const matched = filesRes.files || []
    if (matched.length === 0) {
      alert('No images or videos found in that folder.')
      return
    }

    // Sort by name so they come in a predictable order
    matched.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    addBgMediaItems(matched.map(f => ({ url: makeMediaUrl(f.path), name: f.name, sourcePath: f.path })))
  }

  // HTML file input fallback (browser / no Electron)
  const handleBgMediaHtmlPick = (e) => {
    const files = Array.from(e.target.files || [])
    addBgMediaItems(files.map(f => ({ url: URL.createObjectURL(f), name: f.name })))
  }

  const removeBgMedia = (idx) => setBgMedia(prev => prev.filter((_, i) => i !== idx))

  // ── Step 5: Generate pages ────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!lines.length) return
    setGenerating(true)
    try {
      /**
       * Helper: build one presentation page from a lyric line.
       * Blank lines (empty text) get an italic "♪" placeholder.
       */
      const buildLyricPage = (line, pageLabel, bgIdx) => {
        const yPositions = { top: 40, center: Math.round(stageHeight / 2 - 50), bottom: stageHeight - 120 }
        const yPos = yPositions[style.position] ?? yPositions.center

        const textEl = makeElem('text', 40, yPos, stageWidth - 80, 100)
        textEl.content = line.text || '♪'
        textEl.size = line.text ? style.fontSize : Math.round(style.fontSize * 1.5)
        textEl.font = style.fontFamily
        textEl.color = line.text ? style.color : 'rgba(255,255,255,0.35)'
        textEl.align = style.textAlign
        textEl.elLabel = line.text ? 'lyric' : 'instrumental'
        textEl.weight = '400'
        textEl.italic = !line.text
        if (style.textShadow) textEl.shadow = { color: 'rgba(0,0,0,0.8)', blur: 8, x: 2, y: 2 }

        const page = makePage(pageLabel)
        if (bgMedia.length > 0) {
          const m = bgMedia[bgIdx % bgMedia.length]
          if (m.type === 'video') page.bgVideo = m.url
          else page.bgImage = m.url
          // Set canonical bgMedia fields so serializer/publish/re-open all work
          page.bgMediaSrc = m.url
          page.bgMediaName = m.name || ''
          page.bgMediaKind = m.type === 'video' ? 'video' : 'image'
          if (m.sourcePath) page.bgMediaSourcePath = m.sourcePath
        } else if (style.bgType === 'gradient') {
          page.bgGradientEnabled = true
          page.bgGradientFrom = style.bgGradientA
          page.bgGradientTo = style.bgGradientB
          page.bgGradientAngle = 180
        } else if (style.bgType === 'color') {
          page.bgColor = style.bgColor
        }
        page.elements = [textEl]
        page.timing = { mode: 'lyric' }
        page.persistAudio = true
        page.lyricStart = line.start
        page.lyricEnd = line.end
        return page
      }

      /**
       * Helper: build a full-screen title/credit page (no lyric timing).
       * lines: array of { text, fontSize, color?, alpha? }
       */
      const buildTitlePage = (pageLabel, textLines) => {
        const page = makePage(pageLabel)
        if (bgMedia.length > 0) {
          const m = bgMedia[0]
          if (m.type === 'video') page.bgVideo = m.url
          else page.bgImage = m.url
          // Set canonical bgMedia fields so serializer/publish/re-open all work
          page.bgMediaSrc = m.url
          page.bgMediaName = m.name || ''
          page.bgMediaKind = m.type === 'video' ? 'video' : 'image'
          if (m.sourcePath) page.bgMediaSourcePath = m.sourcePath
        } else if (style.bgType === 'gradient') {
          page.bgGradientEnabled = true
          page.bgGradientFrom = style.bgGradientA
          page.bgGradientTo = style.bgGradientB
          page.bgGradientAngle = 180
        } else {
          page.bgColor = style.bgColor || '#1a0033'
        }

        const totalH = textLines.length * (style.fontSize * 1.5 + 8)
        const startY = Math.round((stageHeight - totalH) / 2)
        page.elements = textLines.map((tl, i) => {
          const el = makeElem('text', 40, startY + i * (style.fontSize * 1.5 + 8), stageWidth - 80, Math.round(style.fontSize * 1.8))
          el.content = tl.text
          el.size = tl.fontSize ?? style.fontSize
          el.font = style.fontFamily
          el.color = tl.color ?? style.color
          el.align = 'center'
          el.weight = (tl.bold ?? false) ? 'bold' : '400'
          el.italic = tl.italic ?? false
          if (style.textShadow) el.shadow = { color: 'rgba(0,0,0,0.8)', blur: 8, x: 2, y: 2 }
          return el
        })
        page.timing = { mode: 'fixed', durationMs: 5000 }
        page.persistAudio = true
        return page
      }

      // ── Intro page ──────────────────────────────────────────────────────
      const introLines = []
      if (songTitle) introLines.push({ text: songTitle, fontSize: Math.round(style.fontSize * 1.4), bold: true })
      if (artistName) introLines.push({ text: artistName, fontSize: style.fontSize })
      if (!songTitle && !artistName) introLines.push({ text: audioName || 'Lyric Video', fontSize: style.fontSize, bold: true })

      const introPage = buildTitlePage('Intro', introLines)

      // ── Lyric pages ──────────────────────────────────────────────────────
      const lyricPages = lines.map((line, i) => {
        const page = buildLyricPage(line, `Lyric ${i + 1}`, i)
        // Attach word-level timestamps for karaoke highlighting in the player
        if (line.text && line.start != null && line.end != null) {
          // First try to find pre-existing word-level timestamps from transcription
          let pageWords = []
          if (wordSegments.length > 0) {
            pageWords = wordSegments.filter(w => {
              // Overlap detection (not midpoint!) prevents losing words at boundaries
              // Word overlaps line if word.start < line.end AND word.end > line.start
              return w.start < line.end && w.end > line.start
            })
          }
          // If no word-level timestamps found, generate them by interpolating within the line time range
          if (pageWords.length === 0) {
            pageWords = generateWordTimestamps(line.text, line.start, line.end)
          }
          if (pageWords.length > 0) page.wordTimestamps = pageWords
        }
        return page
      })

      // ── Credit page ──────────────────────────────────────────────────────
      const creditTextLines = []
      if (creatorName || copyrightYear) {
        const creditText = creatorName && copyrightYear
          ? `This was created by ${creatorName}, using FluxAura Studio. · © ${copyrightYear}`
          : creatorName
            ? `This was created by ${creatorName}, using FluxAura Studio.`
            : `© ${copyrightYear}`
        creditTextLines.push({ text: creditText, fontSize: Math.round(style.fontSize * 0.75) })
      }
      if (songTitle) creditTextLines.push({ text: songTitle, fontSize: Math.round(style.fontSize * 0.65), italic: true })

      const creditPage = buildTitlePage('Credits', creditTextLines.length > 0 ? creditTextLines : [{ text: '♪', fontSize: style.fontSize * 2 }])

      // Anchor credit page just after the last lyric so the RAF sync loop
      // doesn't show it prematurely (intro/credit pages default lyricStart to 0
      // which would match at any time ≥ 0 if the loop reaches them).
      const lastLyric = lyricPages[lyricPages.length - 1]
      if (lastLyric) {
        creditPage.lyricStart = (lastLyric.lyricEnd ?? 0) + 0.1
      }

      const pages = [introPage, ...lyricPages, creditPage]

      const presentationAudio = {
        file: audioUrl,
        name: audioName,
        sourcePath: audioSourcePath,
        volume: 1,
        loop: false,
      }

      onGenerate?.({ pages, presentationAudio })
    } finally {
      setGenerating(false)
    }
  }, [lines, style, bgMedia, audioUrl, audioName, audioSourcePath, stageWidth, stageHeight, onGenerate, songTitle, artistName, creatorName, copyrightYear, wordSegments])

  // ── Canvas rendering helpers (for MP4 export) ────────────────────────────

  function wrapCanvasText(ctx, text, maxWidth) {
    const words = text.split(' ')
    const wrapped = []
    let cur = ''
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && cur) { wrapped.push(cur); cur = word }
      else cur = test
    }
    if (cur) wrapped.push(cur)
    return wrapped.length ? wrapped : ['']
  }

  async function renderFramesToJpeg(onFrame) {
    const W = stageWidth, H = stageHeight
    const frames = []

    // Cache for video snapshot elements (reuse across frames for same source)
    const videoSnapCache = {}

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')

      // Background
      if (bgMedia.length > 0) {
        const m = bgMedia[i % bgMedia.length]
        if (m.type === 'video') {
          // Snapshot the first frame of the video
          await new Promise((res) => {
            let settled = false
            const fallback = () => {
              if (settled) return; settled = true
              ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H); res()
            }
            let vid = videoSnapCache[m.url]
            if (vid && vid.readyState >= 2) {
              try { ctx.drawImage(vid, 0, 0, W, H) } catch { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H) }
              res(); return
            }
            vid = document.createElement('video')
            vid.crossOrigin = 'anonymous'
            vid.muted = true
            vid.preload = 'auto'
            vid.src = m.url
            // Draw directly on loadeddata — video is already at time 0.
            // Setting currentTime = 0 when already at 0 does NOT fire 'seeked'.
            vid.addEventListener('loadeddata', () => {
              if (settled) return; settled = true
              try { ctx.drawImage(vid, 0, 0, W, H) } catch { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H) }
              res()
            }, { once: true })
            vid.addEventListener('error', fallback, { once: true })
            setTimeout(fallback, 8000)
            vid.load()
            videoSnapCache[m.url] = vid
          })
        } else {
          await new Promise((res) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload  = () => { ctx.drawImage(img, 0, 0, W, H); res() }
            img.onerror = () => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); res() }
            img.src = m.url
          })
        }
      } else if (style.bgType === 'gradient') {
        const grad = ctx.createLinearGradient(0, 0, 0, H)
        grad.addColorStop(0, style.bgGradientA)
        grad.addColorStop(1, style.bgGradientB)
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
      } else {
        ctx.fillStyle = style.bgType === 'color' ? style.bgColor : '#000'
        ctx.fillRect(0, 0, W, H)
      }

      // Text
      const fontSize = style.fontSize
      if (style.textShadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 10
        ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3
      }
      ctx.font = `${fontSize}px "${style.fontFamily}", Arial, sans-serif`
      ctx.fillStyle = style.color
      ctx.textAlign = /** @type {CanvasTextAlign} */ (style.textAlign || 'center')
      ctx.textBaseline = 'middle'

      const yBase = style.position === 'top' ? H * 0.15 : style.position === 'bottom' ? H * 0.83 : H * 0.5
      const xBase = style.textAlign === 'left' ? 60 : style.textAlign === 'right' ? W - 60 : W / 2
      const maxWidth = W - 120
      const wrapped = wrapCanvasText(ctx, line.text, maxWidth)
      const lineH = fontSize * 1.4
      const startY = yBase - ((wrapped.length - 1) * lineH) / 2
      for (let li = 0; li < wrapped.length; li++) {
        ctx.fillText(wrapped[li], xBase, startY + li * lineH, maxWidth)
      }

      const imageBase64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
      const rawDur = (typeof line.end === 'number' && typeof line.start === 'number' && isFinite(line.end - line.start))
        ? (line.end - line.start)
        : (line.durationMs > 0 ? line.durationMs / 1000 : 4)
      frames.push({ imageBase64, durationSec: Math.max(0.5, rawDur) })
      if (onFrame) onFrame(i + 1, lines.length)
      await new Promise(r => setTimeout(r, 0))  // yield to keep UI responsive
    }
    return frames
  }

  // ── Export video ──────────────────────────────────────────────────────────

  const handleExportVideo = useCallback(async () => {
    if (!window.smmDesktop?.lyricExport) {
      alert('Video export requires the Electron desktop app.')
      return
    }
    if (!audioSourcePath) {
      alert('To export as MP4, the audio file must be selected via the Browse button (native file picker). Blob URLs from drag-and-drop cannot be accessed by ffmpeg.')
      return
    }
    if (!lines.length) return

    // 1. Ask where to save
    const saveRes = await window.smmDesktop.lyricExport.saveDialog({
      defaultName: (audioName.replace(/\.[^.]+$/, '') || 'lyric-video') + '.mp4',
    })
    if (saveRes?.canceled) return

    setExporting(true)
    setExportProgress(0)
    setExportStatus('Rendering frames…')

    const unsub = window.smmDesktop.lyricExport.onProgress((prog) => {
      setExportProgress(prog.progress ?? 0)
      setExportStatus(prog.status || '')
    })

    try {
      // 2. Render each page to a JPEG frame
      const frames = await renderFramesToJpeg((done, total) => {
        setExportProgress(Math.round(done / total * 30))
        setExportStatus(`Rendering frame ${done} / ${total}…`)
      })

      setExportStatus('Sending to encoder…')

      // 3. Export via ffmpeg in main process
      const result = await window.smmDesktop.lyricExport.exportVideo({
        frames,
        audioSourcePath,
        outputPath: saveRes.outputPath,
        width: stageWidth,
        height: stageHeight,
      })

      if (!result.ok) throw new Error(result.error || 'Export failed')
      setExportStatus(`✅ Saved to: ${result.outputPath}`)
      setExportProgress(100)
    } catch (err) {
      setExportStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setExporting(false)
      unsub()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, style, bgMedia, audioSourcePath, audioName, stageWidth, stageHeight])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <span style={{ fontWeight: 700 }}>🎵 New Lyric Video Wizard</span>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {/* Step tabs */}
        <div style={S.stepBar}>
          {STEPS.map((label, i) => (
            <button
              key={i}
              onClick={() => i < step + 1 && setStep(i)}
              style={{
                ...S.stepTab,
                background: i === step ? 'var(--accent, #3cb8be)' : i < step ? 'rgba(60,184,190,.3)' : 'var(--bg3, #222)',
                color: i <= step ? '#fff' : 'var(--t3, #888)',
                cursor: i <= step ? 'pointer' : 'default',
              }}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div style={S.body}>

          {/* ── Step 1: Import Audio ── */}
          {step === 0 && (
            <div style={S.stepBody}>
              <h3 style={S.stepTitle}>Import Music Track</h3>
              <p style={S.hint}>Select your music file. It will play continuously throughout the lyric video.</p>
              <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleHtmlAudioPick} />
              <button onClick={handlePickAudio} style={S.actionBtn}>🎵 Browse for audio…</button>
              {audioName && (
                <div style={{ marginTop: 8 }}>
                  <div style={S.fileLabel}>🎵 {audioName}</div>
                  {audioUrl && <audio src={audioUrl} controls style={{ width: '100%', marginTop: 6 }} />}
                </div>
              )}

              {/* Song metadata — used for intro and credit pages */}
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border,#333)', paddingTop: 12 }}>
                <p style={{ ...S.hint, marginBottom: 8, fontWeight: 600, color: 'var(--t2,#ccc)' }}>
                  🎬 Song info <span style={{ fontWeight: 400 }}>(optional — adds intro &amp; credit pages)</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 10px', alignItems: 'center' }}>
                  <label style={S.formLabel}>Song title</label>
                  <input
                    type="text" placeholder="e.g. Bohemian Rhapsody"
                    value={songTitle} onChange={e => setSongTitle(e.target.value)}
                    style={S.input}
                  />
                  <label style={S.formLabel}>Artist</label>
                  <input
                    type="text" placeholder="e.g. Queen"
                    value={artistName} onChange={e => setArtistName(e.target.value)}
                    style={S.input}
                  />
                  <label style={S.formLabel}>Created by</label>
                  <input
                    type="text" placeholder="Your name or company"
                    value={creatorName} onChange={e => setCreatorName(e.target.value)}
                    style={S.input}
                  />
                  <label style={S.formLabel}>Copyright year</label>
                  <input
                    type="text" placeholder={String(new Date().getFullYear())}
                    value={copyrightYear} onChange={e => setCopyrightYear(e.target.value)}
                    style={{ ...S.input, width: 80 }}
                  />
                </div>
                <p style={{ ...S.hint, marginTop: 6 }}>
                  💡 The first page will show the song title &amp; artist. The last page will show the copyright credit. Leave blank to skip.
                </p>
              </div>

              <div style={S.footer}>
                <button disabled={!audioUrl} onClick={() => setStep(1)} style={{ ...S.actionBtn, opacity: audioUrl ? 1 : 0.5 }}>
                  Next → Transcribe
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Transcribe / Paste & Sync ── */}
          {step === 1 && (
            <div style={S.stepBody}>
              <h3 style={S.stepTitle}>Get Lyrics &amp; Timing</h3>

              {/* Mode tabs */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border,#333)' }}>
                {[['transcribe','🎤 Auto-Transcribe'],['paste','📝 Paste & Sync']].map(([m, label]) => (
                  <button key={m} onClick={() => setSyncMode(m)} style={{
                    flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: syncMode === m ? 'var(--accent,#3cb8be)' : 'var(--bg3,#222)',
                    color: syncMode === m ? '#fff' : 'var(--t2,#aab)',
                  }}>{label}</button>
                ))}
              </div>

              {/* ── Auto-Transcribe tab ── */}
              {syncMode === 'transcribe' && (
                <>
                  <p style={S.hint}>
                    Choose a simple preset and FluxAura handles the engine routing.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    <label style={{ fontSize: 11, color: 'var(--t3,#888)' }}>Transcription preset</label>
                    <select
                      value={transcribePresetId}
                      onChange={(e) => setTranscribePresetId(e.target.value)}
                      style={{ ...S.numInput, width: 320 }}
                    >
                      {TRANSCRIPTION_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: 'var(--t3,#888)' }}>{transcribePreset.preset.description}</div>
                    {transcribePreset.warning && (
                      <div style={{ fontSize: 11, color: '#f59e0b' }}>{transcribePreset.warning}</div>
                    )}
                    <details style={{ fontSize: 11, color: 'var(--t3,#888)' }}>
                      <summary style={{ cursor: 'pointer' }}>Advanced engine details</summary>
                      <div style={{ marginTop: 4 }}>
                        Preset: {transcribePreset.selectedPreset} | Intent: {transcribePreset.engineIntent} | Resolved engine: {transcribePreset.resolvedEngine} | Model: {transcribePreset.modelId}
                      </div>
                      {transcribePreset.selectedPreset === 'local-pro' && renderLocalProDetails()}
                      {transcribePreset.selectedPreset === 'local-pro' && renderLocalProRuntimeControls()}
                    </details>
                  </div>
                  {whisperAvailable === false && (
                    <div style={S.errorBox}>
                      @xenova/transformers not installed. Run <code>npm install @xenova/transformers</code> and restart.
                    </div>
                  )}
                  {whisperAvailable !== false && (
                    <WhisperPanel
                      audioUrl={audioUrl}
                      audioFilePath={audioSourcePath}
                      audioName={audioName}
                      modelIdOverride={transcribePreset.modelId}
                      hideModelSelector={true}
                      selectedPreset={transcribePreset.selectedPreset}
                      engineIntent={transcribePreset.engineIntent}
                      resolvedEngine={transcribePreset.resolvedEngine}
                      localProOptions={transcribePreset.localProOptions}
                      transcriptionMode={transcribePreset.transcriptionMode || 'lyric-vocal-focus'}
                      onTranscribeComplete={handleTranscribeResult}
                      onInsertText={() => {}}
                      onCreateLyricPages={(lyricLines) => {
                        setLines(lyricLines.map(l => ({ id: uid(), ...l })))
                        setStep(2)
                      }}
                      onClose={() => {}}
                    />
                  )}
                </>
              )}

              {/* ── Paste & Sync tab ── */}
              {syncMode === 'paste' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={S.hint}>
                    Already have your lyrics? Paste them below — one lyric line per line.
                    Click <strong>Sync to Audio</strong> to automatically time each line using Whisper.
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    rows={10}
                    placeholder={'Paste your lyrics here…\nOne line per lyric page.\n\nExample:\nWe will rock you\nWe will, we will rock you\nBuddy you\'re a boy make a big noise'}
                    style={{ ...S.textarea, fontSize: 12, lineHeight: 1.6 }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--t3,#888)' }}>Timing preset for Paste & Sync</label>
                    <select
                      value={pasteSyncPresetId}
                      onChange={(e) => setPasteSyncPresetId(e.target.value)}
                      style={{ ...S.numInput, width: 260 }}
                    >
                      {TRANSCRIPTION_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: 'var(--t3,#888)' }}>{pasteSyncPreset.preset.description}</div>
                    {pasteSyncPreset.warning && (
                      <div style={{ fontSize: 11, color: '#f59e0b' }}>{pasteSyncPreset.warning}</div>
                    )}
                    <details style={{ fontSize: 11, color: 'var(--t3,#888)' }}>
                      <summary style={{ cursor: 'pointer' }}>Advanced engine details</summary>
                      <div style={{ marginTop: 4 }}>
                        Preset: {pasteSyncPreset.selectedPreset} | Intent: {pasteSyncPreset.engineIntent} | Resolved engine: {pasteSyncPreset.resolvedEngine} | Model: {pasteSyncPreset.modelId}
                      </div>
                      {pasteSyncPreset.selectedPreset === 'local-pro' && renderLocalProDetails()}
                      {pasteSyncPreset.selectedPreset === 'local-pro' && renderLocalProRuntimeControls()}
                    </details>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={handlePasteSync}
                      disabled={!pasteText.trim() || pasteAligning}
                      style={{ ...S.actionBtn, opacity: pasteText.trim() && !pasteAligning ? 1 : 0.5 }}
                    >
                      {pasteAligning ? '⏳ Syncing…' : '🎯 Sync to Audio'}
                    </button>
                    <button
                      onClick={() => {
                        if (!pasteText.trim()) return
                        const manual = pasteText.split('\n').filter(l => l.trim()).map((text, i) => ({
                          id: uid(), start: i * 4, end: i * 4 + 4, text: text.trim(), durationMs: 4000,
                        }))
                        setLines(manual); setStep(2)
                      }}
                      disabled={!pasteText.trim()}
                      style={{ ...S.secondaryBtn, opacity: pasteText.trim() ? 1 : 0.5 }}
                    >
                      Use without timing
                    </button>
                  </div>
                  {pasteAlignStatus && (
                    <div style={{ fontSize: 11, color: pasteAlignStatus.startsWith('✅') ? '#4ade80' : pasteAlignStatus.startsWith('❌') ? '#f87171' : 'var(--t2,#aab)' }}>
                      {pasteAlignStatus}
                    </div>
                  )}
                  <p style={{ ...S.hint, marginTop: 4 }}>
                    💡 <strong>Sync to Audio</strong> uses the same preset routing as Auto-Transcribe so both flows share timing behavior.
                  </p>
                </div>
              )}

              <div style={S.footer}>
                <button onClick={() => setStep(0)} style={S.secondaryBtn}>← Back</button>
                <div style={{ flex: 1 }} />
                <button onClick={() => {
                  if (!lines.length) setLines([{ id: uid(), start: 0, end: 4, text: 'Add your lyrics here', durationMs: 4000 }])
                  setStep(2)
                }} style={S.secondaryBtn}>Skip / Enter manually</button>
                <button onClick={() => {
                  if (!lines.length) setLines([{ id: uid(), start: 0, end: 4, text: 'Add your lyrics here', durationMs: 4000 }])
                  setStep(2)
                }} style={S.actionBtn}>
                  Next → Edit Lyrics
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Edit Lyric Lines ── */}
          {step === 2 && (
            <div style={S.stepBody}>
              <h3 style={S.stepTitle}>Timing Editor — {lines.length} lyric lines</h3>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => setEditDebugTab('lyric-lines')} style={{ ...S.secondaryBtn, background: editDebugTab === 'lyric-lines' ? 'var(--bg3,#2a2a3e)' : undefined }}>Lyric lines tab</button>
                <button onClick={() => setEditDebugTab('timed-segments')} style={{ ...S.secondaryBtn, background: editDebugTab === 'timed-segments' ? 'var(--bg3,#2a2a3e)' : undefined }}>Timed segments tab</button>
                <button onClick={() => setEditDebugTab('raw-transcript')} style={{ ...S.secondaryBtn, background: editDebugTab === 'raw-transcript' ? 'var(--bg3,#2a2a3e)' : undefined }}>Raw transcript tab</button>
                <span style={{ borderLeft: '1px solid var(--border,#444)', alignSelf: 'stretch', marginLeft: 2 }} />
                <button onClick={handleRetryOpeningSection} style={S.secondaryBtn}>Retry opening section</button>
                <button onClick={handleRetrySelectedSection} style={S.secondaryBtn}>Retry selected section</button>
                <button onClick={() => { setSyncMode('paste'); setStep(1) }} style={S.secondaryBtn}>Paste correct lyrics &amp; sync</button>
                <button onClick={() => setStep3View('table')} style={S.secondaryBtn}>Tap sync manually</button>
              </div>

              {transcribeResult?.warnings?.length > 0 && (
                <div style={{
                  background: 'rgba(220,38,38,.14)',
                  border: '1px solid rgba(220,38,38,.5)',
                  borderRadius: 5,
                  padding: '8px 10px',
                  fontSize: 11,
                  color: 'var(--t1,#eee)',
                }}>
                  <strong>Gap warnings:</strong> {transcribeResult.warnings.join(' | ')}
                </div>
              )}

              {editDebugTab === 'raw-transcript' && (
                <div style={{ border: '1px solid var(--border,#333)', borderRadius: 4, padding: 8, maxHeight: 180, overflow: 'auto', background: 'var(--bg2,#1a1a2e)' }}>
                  <div style={{ fontSize: 11, color: 'var(--t3,#888)', marginBottom: 6 }}>Engine: {transcribeResult.engine || 'xenova'} | Method: {transcribeResult.method || 'unknown'} | Model: {transcribeResult.model || 'unknown'}</div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11 }}>{transcribeResult.text || '(empty transcript)'}</pre>
                </div>
              )}

              {editDebugTab === 'timed-segments' && (
                <div style={{ border: '1px solid var(--border,#333)', borderRadius: 4, padding: 8, maxHeight: 180, overflow: 'auto', background: 'var(--bg2,#1a1a2e)' }}>
                  {(transcribeResult.chunks || []).slice(0, 200).map((seg, idx) => (
                    <div key={idx} style={{ fontSize: 11, borderBottom: '1px solid var(--border,#2c3a52)', padding: '3px 0' }}>
                      <span style={{ color: 'var(--t3,#888)', marginRight: 8 }}>{Number(seg?.start || 0).toFixed(2)}-{Number(seg?.end || 0).toFixed(2)}</span>
                      {String(seg?.text || '').trim()}
                    </div>
                  ))}
                </div>
              )}

              {openingLyricsWarning && (
                <div style={{
                  background: 'rgba(245,158,11,.12)',
                  border: '1px solid rgba(245,158,11,.5)',
                  borderRadius: 5,
                  padding: '8px 10px',
                  fontSize: 11,
                  color: 'var(--t1,#eee)',
                }}>
                  {openingLyricsWarning}
                </div>
              )}

              {/* ── Line style preset selector ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2,#aab)', whiteSpace: 'nowrap' }}>Line style:</span>
                <select
                  value={lyricLineStyle}
                  onChange={e => setLyricLineStyle(e.target.value)}
                  style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg2,#1a1a2e)', color: 'var(--t1,#eee)', border: '1px solid var(--border,#444)', borderRadius: 4, cursor: 'pointer' }}
                >
                  {Object.entries(LYRIC_LINE_STYLE_PRESETS).map(([key, p]) => (
                    <option key={key} value={key}>
                      {p.label}{previewLineCounts[key] != null ? ` (${previewLineCounts[key]} lines)` : ''}
                    </option>
                  ))}
                </select>
                {lines.length > 0 && (
                  <span style={{ fontSize: 10, color: '#7dd3fc', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {lines.length} lines
                  </span>
                )}
                <button
                  onClick={() => {
                    const rebuilt = rebuildFromWordSegments(wordSegments, 'line-style-apply')
                    if (rebuilt.length > 0) setLines(rebuilt)
                  }}
                  disabled={wordSegments.length === 0}
                  style={{ ...S.secondaryBtn, opacity: wordSegments.length ? 1 : 0.5 }}
                >
                  Apply style to lines
                </button>
                <span style={{ fontSize: 10, color: 'var(--t3,#888)', fontStyle: 'italic' }}>
                  Use Karaoke Tight for music lyric videos. Use Subtitle for spoken narration.
                </span>
              </div>

              {/* ── View toggle tabs ── */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {/** @type {('table'|'timeline')[]} */ (['table', 'timeline']).map(v => (
                  <button
                    key={v}
                    onClick={() => setStep3View(v)}
                    style={{
                      padding: '4px 14px',
                      fontSize: 11,
                      cursor: 'pointer',
                      border: '1px solid var(--border,#444)',
                      borderRadius: 4,
                      background: step3View === v ? 'var(--accent,#7c3aed)' : 'var(--bg2,#1a1a2e)',
                      color: step3View === v ? '#fff' : 'var(--t2,#ccc)',
                      fontWeight: step3View === v ? 700 : 400,
                    }}
                  >
                    {v === 'table' ? 'Simple' : 'Timeline'}
                  </button>
                ))}
                <button
                  onClick={toggleLiveTimingMode}
                  style={{
                    ...S.secondaryBtn,
                    background: liveTimingMode ? 'rgba(22,163,74,.28)' : 'var(--bg3,#2a2a3e)',
                    borderColor: liveTimingMode ? 'rgba(74,222,128,.8)' : 'var(--border,#444)',
                    color: liveTimingMode ? '#dcfce7' : 'var(--t2,#ccc)',
                    fontWeight: 700,
                  }}
                  title="Live timing keyboard-first mode"
                >
                  {liveTimingMode ? 'Stop Live Timing' : 'Start Live Timing'}
                </button>
              </div>

              {/* ── Audio timing controller ── */}
              {audioUrl && (
                <div style={{ background: 'var(--bg2,#1a1a2e)', border: '1px solid var(--border,#2c3a52)', borderRadius: 6, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--t3,#888)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎵 {audioName}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#f59e0b', letterSpacing: 2 }}>⏱ {formatTime(audioTime)}</span>
                  </div>
                  <audio ref={step3AudioRef} src={audioUrl} controls style={{ width: '100%', height: 32 }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={autoFillEnds} style={S.secondaryBtn} title="Set each line's end = start of the next line">🔗 Auto-fill ends</button>
                    <button onClick={() => setLines(prev => [...prev].sort((a, b) => a.start - b.start))} style={S.secondaryBtn} title="Sort all lines by start time">⇅ Sort by time</button>
                    <button onClick={() => {
                      const t = Math.round((step3AudioRef.current?.currentTime ?? 0) * 100) / 100
                      setLines(prev => [...prev, { id: uid(), start: t, end: Math.round((t + 4) * 100) / 100, text: '', durationMs: 4000 }])
                    }} style={{ ...S.secondaryBtn, color: '#4ade80', borderColor: '#4ade80' }}>
                      ＋ Add line at ⏱
                    </button>
                  </div>
                  <p style={{ ...S.hint, margin: 0 }}>
                    💡 Live Timing Mode: keep audio playing and press <strong>E</strong> to set End and auto-advance. Press <strong>S</strong> to stamp Start.
                  </p>
                </div>
              )}

              {/* ── Timing table ── */}
              {step3View === 'table' && (
              <div style={{ maxHeight: 380, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--border,#333)', borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 26 }} />
                    <col style={{ width: 62 }} />
                    <col style={{ width: 26 }} />
                    <col style={{ width: 62 }} />
                    <col style={{ width: 26 }} />
                    <col />
                    <col style={{ width: 176 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg2,#222)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={S.th}>#</th>
                      <th style={S.th} title="Click number to seek audio to this line's start">Start ▶</th>
                      <th style={{ ...S.th, color: '#f59e0b' }} title="Stamp current audio time as this line's Start">◉S</th>
                      <th style={S.th}>End</th>
                      <th style={{ ...S.th, color: '#f59e0b' }} title="Stamp current audio time as this line's End">◉E</th>
                      <th style={S.th}>Lyric Text</th>
                      <th style={S.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => {
                      const isPlaying = audioTime >= line.start && audioTime < line.end
                      return (
                        <tr key={line.id} style={{
                          borderBottom: '1px solid var(--border,#333)',
                          background: isPlaying
                            ? 'rgba(245,158,11,0.20)'
                            : !line.text
                              ? 'rgba(99,102,241,0.07)'
                              : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)',
                          outline: liveTimingMode && selectedRowIndex === i
                            ? '2px solid #22d3ee'
                            : (isPlaying ? '2px solid #f59e0b' : 'none'),
                          outlineOffset: -1,
                          cursor: 'pointer',
                        }} ref={(el) => { rowRefs.current[i] = el }}>
                          <td
                            style={{
                              ...S.td,
                              fontWeight: 700,
                              color: isPlaying ? '#f59e0b' : 'var(--t3,#888)',
                              textAlign: 'center',
                              background: selectedRowIndex === i
                                ? (liveTimingMode ? 'rgba(34,211,238,.22)' : 'rgba(34,211,238,.12)')
                                : undefined,
                            }}
                            onClick={() => setSelectedRowIndex(i)}
                            title="Select row"
                          >
                            {i + 1}
                          </td>
                          <td style={S.td}>
                            <input
                              type="number" min={0} step={0.1}
                              value={line.start.toFixed(1)}
                              onChange={(e) => updateLine(i, 'start', parseFloat(e.target.value) || 0, true)}
                              onFocus={() => seekTo(line.start)}
                              onClick={() => setSelectedRowIndex(i)}
                              title={`Click to seek audio to ${formatTime(line.start)}`}
                              style={{ ...S.numInput, cursor: 'pointer', width: '100%', borderColor: isPlaying ? '#f59e0b' : undefined }}
                            />
                          </td>
                          <td style={S.td}>
                            <button
                              onClick={() => setLineStartNow(i)}
                              style={{ ...S.iconBtnSm, color: '#f59e0b', fontWeight: 700 }}
                              title="Set start to current playhead time"
                            >S</button>
                          </td>
                          <td style={S.td}>
                            <input
                              type="number" min={0} step={0.1}
                              value={line.end.toFixed(1)}
                              onChange={(e) => updateLine(i, 'end', parseFloat(e.target.value) || 0, true)}
                              onClick={() => setSelectedRowIndex(i)}
                              style={{ ...S.numInput, width: '100%' }}
                            />
                          </td>
                          <td style={S.td}>
                            <button
                              onClick={() => setLineEndNowAdvance(i)}
                              style={{ ...S.iconBtnSm, color: '#f59e0b', fontWeight: 700 }}
                              title="Set end to current playhead time and auto-advance"
                            >E</button>
                          </td>
                          <td style={S.td}>
                            <input
                              type="text"
                              value={line.text}
                              onChange={(e) => updateLine(i, 'text', e.target.value)}
                              onClick={() => setSelectedRowIndex(i)}
                              onFocus={(e) => { e.currentTarget.style.borderColor = '#22d3ee' }}
                              onBlur={(e) => { e.currentTarget.style.borderColor = '#2f3b55' }}
                              placeholder="(instrumental — blank = ♪ page)"
                              style={{ ...S.lyricTextInput, fontStyle: line.text ? 'normal' : 'italic', color: line.text ? '#ffffff' : '#b8c2d8' }}
                            />
                          </td>
                          <td style={{ ...S.td, padding: '2px 3px' }}>
                            <div style={{ display: 'flex', gap: 2, alignItems: 'center', whiteSpace: 'nowrap' }}>
                              <button onClick={() => { seekTo(line.start); step3AudioRef.current?.play?.().catch(() => {}) }} style={S.iconBtnSm} title="Play line">▶</button>
                              <button onClick={() => splitLineNow(i)} style={S.iconBtnSm} title="Split at current playhead">✂</button>
                              <button
                                onClick={() => {
                                  if (i >= lines.length - 1) return
                                  const merged = `${String(line.text || '').trim()} ${String(lines[i + 1]?.text || '').trim()}`.trim()
                                  setLines((prev) => {
                                    const out = [...prev]
                                    out[i] = { ...out[i], text: merged, end: out[i + 1].end, durationMs: Math.round((out[i + 1].end - out[i].start) * 1000) }
                                    out.splice(i + 1, 1)
                                    return out
                                  })
                                }}
                                style={S.iconBtnSm}
                                title="Merge with next"
                              >Merge</button>
                              <button
                                onClick={() => {
                                  const start = Math.max(0, Math.round((line.start - 0.1) * 10) / 10)
                                  const duration = Math.max(0.1, line.end - line.start)
                                  updateLine(i, 'start', start, false)
                                  updateLine(i, 'end', Math.max(start + 0.1, Math.round((start + duration) * 10) / 10), false)
                                }}
                                style={S.iconBtnSm}
                                title="Nudge whole line earlier by 0.1s"
                              >-0.1</button>
                              <button
                                onClick={() => {
                                  const start = Math.round((line.start + 0.1) * 10) / 10
                                  const duration = Math.max(0.1, line.end - line.start)
                                  updateLine(i, 'start', start, false)
                                  updateLine(i, 'end', Math.round((start + duration) * 10) / 10, false)
                                }}
                                style={S.iconBtnSm}
                                title="Nudge whole line later by 0.1s"
                              >+0.1</button>
                              <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.18)' }} />
                              <button onClick={() => moveLine(i, -1)} disabled={i === 0} style={{ ...S.iconBtnXs, opacity: i === 0 ? 0.25 : 0.62 }} title="Move up">↑</button>
                              <button onClick={() => moveLine(i, 1)} disabled={i === lines.length - 1} style={{ ...S.iconBtnXs, opacity: i === lines.length - 1 ? 0.25 : 0.62 }} title="Move down">↓</button>
                              <button onClick={() => deleteLine(i)} style={{ ...S.iconBtnXs, color: '#ef4444', opacity: 0.72 }} title="Delete line">×</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              )} {/* end step3View === 'table' */}

              {/* ── Timeline view ── */}
              {step3View === 'timeline' && (
                <LyricTimeline
                  lines={lines}
                  onChange={setLines}
                  audioUrl={audioUrl}
                  audioRef={step3AudioRef}
                />
              )}

              {/* ── Word transcript editor (Clideo-style) ── */}
              {wordSegments.length > 0 && (
                <details style={{ border: '1px solid var(--border,#2c3a52)', borderRadius: 5 }}>
                  <summary style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--t2,#aab)', userSelect: 'none' }}>
                    🔤 Interactive word editor — click word to seek · click again to edit
                  </summary>
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <WordTranscriptEditor
                      wordSegments={wordSegments}
                      audioRef={step3AudioRef}
                      onChange={setWordSegments}
                      label={`${wordSegments.length} words`}
                    />
                    <button
                      onClick={() => {
                        const rebuilt = rebuildFromWordSegments(wordSegments, 'word-editor-rebuild')
                        if (rebuilt.length > 0) setLines(rebuilt)
                      }}
                      style={{ ...S.secondaryBtn, fontSize: 11, alignSelf: 'flex-start' }}
                    >
                      🔄 Rebuild lyric lines
                    </button>
                  </div>
                </details>
              )}

              {/* ── Raw transcript collapse ── */}
              {transcribeResult.text && (
                <details style={{ border: '1px solid var(--border,#2c3a52)', borderRadius: 5 }}>
                  <summary style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--t2,#aab)', userSelect: 'none' }}>
                    📄 Raw transcript ({transcribeResult.segments.length} segments) — view / re-parse
                  </summary>
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <textarea
                      value={rawTranscriptDraft}
                      onChange={(e) => setRawTranscriptDraft(e.target.value)}
                      id="raw-transcript-ta"
                      rows={5}
                      style={{ ...S.textarea, fontSize: 11, fontFamily: 'monospace' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          reparseRawTranscript(rawTranscriptDraft)
                        }}
                        style={S.actionBtn}
                      >
                        🔄 Re-parse as lyric pages ({(LYRIC_LINE_STYLE_PRESETS[lyricLineStyle] ?? LYRIC_LINE_STYLE_PRESETS.balanced).label})
                      </button>
                      <span style={{ fontSize: 10, color: 'var(--t3,#888)', alignSelf: 'center' }}>
                        Rebuilds table, timed preview, and word editor from one source.
                      </span>
                    </div>

                    {Array.isArray(transcribeResult.segments) && transcribeResult.segments.length > 0 && (
                      <div style={{ border: '1px solid var(--border,#333)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--t3,#888)', borderBottom: '1px solid var(--border,#333)' }}>
                          Timed segments preview (chronological)
                        </div>
                        <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                            <thead>
                              <tr style={{ background: 'var(--bg2,#222)' }}>
                                <th style={S.th}>Start</th>
                                <th style={S.th}>End</th>
                                <th style={S.th}>Text</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transcribeResult.segments.map((seg, idx) => (
                                <tr key={`${idx}-${seg.start}-${seg.end}`} style={{ borderBottom: '1px solid var(--border,#2a2a2a)' }}>
                                  <td style={S.td}>{Number.isFinite(seg.start) ? seg.start.toFixed(2) : '-'}</td>
                                  <td style={S.td}>{Number.isFinite(seg.end) ? seg.end.toFixed(2) : '-'}</td>
                                  <td style={{ ...S.td, wordBreak: 'break-word' }}>{String(seg.text || '')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* ── Offline Translation ── */}
              <details style={{ border: '1px solid var(--border,#2c3a52)', borderRadius: 5 }}>
                <summary style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--t2,#aab)', userSelect: 'none' }}>
                  🌐 Translate lyrics offline (200+ languages — NLLB-200 AI)
                </summary>
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <p style={S.hint}>
                    Translates all lyric lines using Meta's NLLB-200 model — no internet required after first download (~1.2 GB).
                    The original lines are replaced with the translation.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ color: 'var(--t3,#888)', fontSize: 11 }}>From:</label>
                    <select value={translateSrc} onChange={e => setTranslateSrc(e.target.value)} style={S.input}>
                      {NLLB_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                    <span style={{ color: 'var(--t3,#888)' }}>→</span>
                    <label style={{ color: 'var(--t3,#888)', fontSize: 11 }}>To:</label>
                    <select value={translateTgt} onChange={e => setTranslateTgt(e.target.value)} style={S.input}>
                      {NLLB_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                    <button
                      onClick={handleTranslate}
                      disabled={translating || !lines.length || translateSrc === translateTgt}
                      style={{ ...S.actionBtn, opacity: (!translating && lines.length && translateSrc !== translateTgt) ? 1 : 0.5 }}
                    >
                      {translating ? '⏳ Translating…' : '🌐 Translate'}
                    </button>
                  </div>
                  {translateStatus && (
                    <div style={{ fontSize: 11, color: translateStatus.startsWith('✅') ? '#4ade80' : translateStatus.startsWith('❌') ? '#f87171' : 'var(--t2,#aab)' }}>
                      {translateStatus}
                    </div>
                  )}
                </div>
              </details>

              <div style={S.footer}>
                <button onClick={() => setStep(1)} style={S.secondaryBtn}>← Back</button>
                <button disabled={!lines.length} onClick={() => setStep(3)} style={{ ...S.actionBtn, opacity: lines.length ? 1 : 0.5 }}>
                  Next → Style
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Style ── */}
          {step === 3 && (
            <div style={S.stepBody}>
              <h3 style={S.stepTitle}>Page Style</h3>
              <div style={S.formGrid}>
                <label style={S.formLabel}>Font family</label>
                <FontPicker
                  value={style.fontFamily}
                  onChange={(v) => setStyle((s) => ({ ...s, fontFamily: v }))}
                  style={{ width: '100%' }}
                />

                <label style={S.formLabel}>Font size</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="range" min={16} max={96} step={2} value={style.fontSize}
                    onChange={(e) => setStyle((s) => ({ ...s, fontSize: Number(e.target.value) }))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--t2)', minWidth: 30 }}>{style.fontSize}px</span>
                </div>

                <label style={S.formLabel}>Text colour</label>
                <SmartColorPicker value={style.color}
                  onChange={(v) => setStyle((s) => ({ ...s, color: v }))} />

                <label style={S.formLabel}>Text align</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['left', 'center', 'right'].map((a) => (
                    <button key={a} onClick={() => setStyle((s) => ({ ...s, textAlign: a }))}
                      style={{ ...S.smallBtn, background: style.textAlign === a ? 'var(--accent, #3cb8be)' : 'var(--bg3)' }}>
                      {a === 'left' ? '⬛◻◻' : a === 'center' ? '◻⬛◻' : '◻◻⬛'}
                    </button>
                  ))}
                </div>

                <label style={S.formLabel}>Text position</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['top', 'Top'], ['center', 'Center'], ['bottom', 'Bottom']].map(([v, l]) => (
                    <button key={v} onClick={() => setStyle((s) => ({ ...s, position: v }))}
                      style={{ ...S.smallBtn, background: style.position === v ? 'var(--accent, #3cb8be)' : 'var(--bg3)' }}>
                      {l}
                    </button>
                  ))}
                </div>

                <label style={S.formLabel}>Background</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[['color', 'Solid'], ['gradient', 'Gradient'], ['none', 'None']].map(([v, l]) => (
                    <button key={v} onClick={() => setStyle((s) => ({ ...s, bgType: v }))}
                      style={{ ...S.smallBtn, background: style.bgType === v ? 'var(--accent, #3cb8be)' : 'var(--bg3)' }}>
                      {l}
                    </button>
                  ))}
                </div>

                {style.bgType === 'color' && (
                  <>
                    <label style={S.formLabel}>BG colour</label>
                    <SmartColorPicker value={style.bgColor}
                      onChange={(v) => setStyle((s) => ({ ...s, bgColor: v }))} />
                  </>
                )}

                {style.bgType === 'gradient' && (
                  <>
                    <label style={S.formLabel}>Grad top</label>
                    <SmartColorPicker value={style.bgGradientA}
                      onChange={(v) => setStyle((s) => ({ ...s, bgGradientA: v }))} />
                    <label style={S.formLabel}>Grad bottom</label>
                    <SmartColorPicker value={style.bgGradientB}
                      onChange={(v) => setStyle((s) => ({ ...s, bgGradientB: v }))} />
                  </>
                )}

                <label style={S.formLabel}>Text shadow</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <input type="checkbox" checked={style.textShadow}
                    onChange={(e) => setStyle((s) => ({ ...s, textShadow: e.target.checked }))} />
                  Add drop shadow to text
                </label>

                <label style={S.formLabel}>BG media</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {/* Hidden HTML file input for browser fallback (supports image + video) */}
                  <input ref={bgMediaInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={handleBgMediaHtmlPick} />

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button onClick={handlePickBgFile} style={S.secondaryBtn} title="Pick a single image or video file">
                      📂 Add file…
                    </button>
                    <button onClick={handlePickBgFolder} style={S.secondaryBtn} title="Scan a folder — imports all images & videos found inside">
                      🗂 Add folder…
                    </button>
                    {bgMedia.length > 0 && (
                      <button onClick={() => setBgMedia([])} style={{ ...S.secondaryBtn, color: '#e74c3c' }}>
                        🗑 Clear all
                      </button>
                    )}
                  </div>

                  {/* Media list */}
                  {bgMedia.length > 0 ? (
                    <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border,#333)', borderRadius: 4 }}>
                      {bgMedia.map((m, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderBottom: '1px solid var(--border,#333)', fontSize: 10 }}>
                          <span style={{ minWidth: 34, background: m.type === 'video' ? '#7c3aed' : '#0e7490', color: '#fff', borderRadius: 3, padding: '1px 4px', fontSize: 9, textAlign: 'center' }}>
                            {m.type === 'video' ? '🎬' : '🖼'} {m.type}
                          </span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t2,#ccc)' }}>{m.name}</span>
                          <button onClick={() => removeBgMedia(i)} style={{ ...S.smallBtn, color: '#e74c3c', background: 'none', padding: '0 3px' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--t3, #888)' }}>
                      No media added. Files cycle across lyric pages in order.
                    </div>
                  )}

                  {bgMedia.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--t3, #888)' }}>
                      {bgMedia.length} file{bgMedia.length !== 1 ? 's' : ''} — cycling across {lines.length} pages.
                      {bgMedia.some(m => m.type === 'video') && ' Video frames are snapshotted for MP4 export.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div style={{ marginTop: 12, background: bgMedia.length > 0 && bgMedia[0].type === 'color' ? bgMedia[0].url : style.bgType === 'color' ? style.bgColor : style.bgType === 'gradient' ? `linear-gradient(180deg, ${style.bgGradientA}, ${style.bgGradientB})` : '#111', borderRadius: 6, padding: 20, minHeight: 80, display: 'flex', alignItems: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[style.position] || 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                {bgMedia.length > 0 && bgMedia[0].type === 'image' && (
                  <img src={bgMedia[0].url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                )}
                {bgMedia.length > 0 && bgMedia[0].type === 'video' && (
                  <video src={bgMedia[0].url} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                )}
                <span style={{ position: 'relative', fontFamily: style.fontFamily, fontSize: Math.round(style.fontSize * 0.5), color: style.color, textAlign: /** @type {import('react').CSSProperties['textAlign']} */ (style.textAlign), textShadow: style.textShadow ? '0 2px 8px rgba(0,0,0,0.8)' : 'none', maxWidth: '80%' }}>
                  {lines[0]?.text || 'Preview lyric text here'}
                </span>
              </div>

              <div style={S.footer}>
                <button onClick={() => setStep(2)} style={S.secondaryBtn}>← Back</button>
                <button onClick={() => setStep(4)} style={S.actionBtn}>Next → Generate</button>
              </div>
            </div>
          )}

          {/* ── Step 5: Generate ── */}
          {step === 4 && (
            <div style={S.stepBody}>
              <h3 style={S.stepTitle}>Generate Lyric Video</h3>
              <div style={S.summaryBox}>
                <div><strong>🎵 Track:</strong> {audioName || 'Not set'}</div>
                {(songTitle || artistName) && <div><strong>🎬 Song:</strong> {[songTitle, artistName].filter(Boolean).join(' — ')}</div>}
                <div><strong>📝 Lyric pages:</strong> {lines.length} + intro + credits = {lines.length + 2} pages total</div>
                <div><strong>🖼 Background media:</strong> {bgMedia.length ? `${bgMedia.length} file${bgMedia.length !== 1 ? 's' : ''} (${bgMedia.filter(m=>m.type==='image').length} images, ${bgMedia.filter(m=>m.type==='video').length} videos)` : 'None (solid colour)'}</div>
                <div><strong>🔤 Font:</strong> {style.fontFamily} {style.fontSize}px</div>
                <div><strong>⏱ Total duration:</strong> ~{Math.round((lines[lines.length - 1]?.end || 0))} seconds</div>
                {(creatorName || copyrightYear) && <div><strong>©️ Credit:</strong> {creatorName ? `Created by ${creatorName}` : ''}{creatorName && copyrightYear ? ' · ' : ''}{copyrightYear ? `© ${copyrightYear}` : ''}</div>}
              </div>
              <p style={S.hint}>
                This will create {lines.length} pages with auto-advance timing.
                The music track will play continuously as the presentation audio.
                You can edit individual pages after generation.
              </p>
              <div style={S.footer}>
                <button onClick={() => setStep(3)} style={S.secondaryBtn}>← Back</button>
                <button
                  onClick={handleGenerate}
                  disabled={!lines.length || generating}
                  style={{ ...S.actionBtn, background: '#7c3aed', fontSize: 14, padding: '8px 20px', opacity: lines.length ? 1 : 0.5 }}
                >
                  {generating ? '⏳ Generating…' : '🎬 Generate Lyric Video!'}
                </button>
                <button
                  onClick={handleExportVideo}
                  disabled={!lines.length || exporting || !audioSourcePath}
                  title={!audioSourcePath ? 'Audio must be selected via Browse (native file picker) for export' : 'Export as MP4 video file'}
                  style={{ ...S.actionBtn, background: '#b45309', fontSize: 13, padding: '7px 16px', opacity: (lines.length && audioSourcePath) ? 1 : 0.45 }}
                >
                  {exporting ? `⏳ ${exportProgress}%` : '📹 Export MP4'}
                </button>
              </div>

              {/* Export progress / status */}
              {(exporting || exportStatus) && (
                <div style={{ marginTop: 8 }}>
                  {exporting && (
                    <div style={S.progressBar}>
                      <div style={{ ...S.progressFill, width: `${exportProgress}%` }} />
                    </div>
                  )}
                  {exportStatus && (
                    <div style={{
                      fontSize: 11,
                      color: exportStatus.startsWith('❌') ? '#e74c3c' : exportStatus.startsWith('✅') ? '#27ae60' : 'var(--t3, #888)',
                      marginTop: 4,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: 120,
                      overflowY: 'auto',
                      background: exportStatus.startsWith('❌') ? 'rgba(231,76,60,0.08)' : 'transparent',
                      borderRadius: 4,
                      padding: exportStatus.startsWith('❌') ? '4px 6px' : 0,
                    }}>
                      {exportStatus}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

/** @type {Record<string, import('react').CSSProperties>} */
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg1, #16161e)', border: '1px solid var(--border, #333)',
    borderRadius: 10, width: 'min(1200px, 92vw)', maxHeight: '92vh',
    display: 'flex', flexDirection: 'column', boxShadow: '0 16px 60px rgba(0,0,0,.6)',
    color: 'var(--t1, #eee)', overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid var(--border, #333)',
    background: 'var(--bg2, #1e1e2e)', fontSize: 15,
  },
  closeBtn: { background: 'none', border: 'none', color: 'var(--t2, #aaa)', cursor: 'pointer', fontSize: 18, lineHeight: 1 },
  stepBar: {
    display: 'flex', gap: 0, padding: '8px 16px',
    borderBottom: '1px solid var(--border, #333)', background: 'var(--bg2, #1e1e2e)',
    overflowX: 'auto',
  },
  stepTab: {
    border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11,
    cursor: 'pointer', fontWeight: 600, transition: 'background 0.15s', whiteSpace: 'nowrap',
  },
  body: { flex: 1, overflow: 'hidden', padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column' },
  stepBody: { display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, paddingRight: 4 },
  stepTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--t1, #eee)' },
  hint: { fontSize: 11, color: 'var(--t3, #888)', margin: 0 },
  actionBtn: {
    background: 'var(--accent, #3cb8be)', border: 'none', color: '#fff',
    borderRadius: 5, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
  },
  secondaryBtn: {
    background: 'var(--bg3, #2a2a3e)', border: '1px solid var(--border, #444)', color: 'var(--t2, #ccc)',
    borderRadius: 5, padding: '5px 10px', cursor: 'pointer', fontSize: 11,
  },
  smallBtn: {
    border: 'none', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10,
    color: '#fff', background: 'var(--bg3, #333)',
  },
  iconBtn: {
    border: 'none', borderRadius: 3, padding: '2px 5px', cursor: 'pointer', fontSize: 12,
    color: 'var(--t2,#ccc)', background: 'var(--bg3,#2a2a3e)', lineHeight: 1,
  },
  iconBtnSm: {
    border: 'none', borderRadius: 2, padding: '0 3px', cursor: 'pointer', fontSize: 10,
    color: 'var(--t2,#ccc)', background: 'var(--bg3,#2a2a3e)', lineHeight: 1,
  },
  iconBtnXs: {
    border: 'none', borderRadius: 2, padding: '0 2px', cursor: 'pointer', fontSize: 9,
    color: 'var(--t2,#ccc)', background: 'rgba(42,42,62,.8)', lineHeight: 1,
  },
  footer: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTop: '1px solid var(--border, #333)',
    position: 'sticky',
    bottom: 0,
    background: 'var(--bg1, #16161e)',
    zIndex: 2,
  },
  fileLabel: { fontSize: 11, color: 'var(--t2, #ccc)' },
  th: { padding: '4px 6px', textAlign: 'left', fontWeight: 600, fontSize: 10, color: 'var(--t3, #888)' },
  td: { padding: '1px 3px', fontSize: 10 },
  numInput: {
    background: 'var(--bg3, #2a2a3e)', border: '1px solid var(--border, #333)',
    color: '#ffffff', borderRadius: 2, padding: '1px 4px', fontSize: 10, width: 55,
    WebkitTextFillColor: '#ffffff', opacity: 1,
  },
  lyricTextInput: {
    width: '100%',
    background: '#101522',
    border: '1px solid #2f3b55',
    color: '#ffffff',
    WebkitTextFillColor: '#ffffff',
    borderRadius: 3,
    padding: '1px 5px',
    fontSize: 10,
    opacity: 1,
  },
  textarea: {
    width: '100%', background: 'var(--bg3, #2a2a3e)', border: '1px solid var(--border, #333)',
    color: 'var(--t1, #eee)', borderRadius: 4, padding: '5px 7px', fontSize: 11,
    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
  },
  input: {
    background: 'var(--bg3, #2a2a3e)', border: '1px solid var(--border, #333)',
    color: 'var(--t1, #eee)', borderRadius: 3, padding: '3px 6px', fontSize: 11, width: '100%', boxSizing: 'border-box',
  },
  formGrid: { display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 10px', alignItems: 'center' },
  formLabel: { fontSize: 11, color: 'var(--t2, #ccc)', fontWeight: 600, textAlign: 'right' },
  summaryBox: {
    background: 'var(--bg2, #222)', border: '1px solid var(--border, #333)',
    borderRadius: 6, padding: '10px 14px', fontSize: 12, lineHeight: 1.8,
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  errorBox: {
    background: 'rgba(192,57,43,.15)', border: '1px solid rgba(192,57,43,.4)',
    borderRadius: 4, padding: '8px 10px', fontSize: 11, color: 'var(--t1, #eee)',
  },
  progressBar: { height: 6, background: 'var(--bg3, #333)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--accent, #3cb8be)', transition: 'width 0.3s ease' },
}
