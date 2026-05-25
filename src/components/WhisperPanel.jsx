// @ts-check
/**
 * WhisperPanel — Speech-to-Text UI using @xenova/transformers Whisper
 *
 * Features:
 *  - Model selector (tiny/base/small/medium with sizes shown)
 *  - Download progress bar
 *  - Transcription progress bar
 *  - Editable output text area
 *  - Export as SRT / copy to clipboard
 *  - Callback for "use as text element", "create lyric pages", or "set as page narration caption"
 *
 * Requires @xenova/transformers to be installed (npm install @xenova/transformers).
 * Degrades gracefully if package not installed.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { WHISPER_MODELS, DEFAULT_WHISPER_MODEL, transcribe, abortTranscription, segmentsToSrt, segmentsToLyricLines, isWhisperAvailable, clearWhisperCache } from '../utils/whisperUtils.js'

/** @typedef {{ start:number, end:number, text:string, durationMs:number }} LyricLine */

function formatCacheBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

export default function WhisperPanel({
  /** URL of the audio file to transcribe (pre-filled if caller provides it) */
  audioUrl = '',
  /** Audio file name (for display) */
  audioName = '',
  /** Called immediately when transcription succeeds with {text, segments, language}.
   *  Preferred over onCreateLyricPages for wizard use — wizard owns navigation. */
  onTranscribeComplete = undefined,
  /** Called when user clicks "Insert as text element" with the full transcript */
  onInsertText = undefined,
  /** Called when user clicks "Create lyric pages" with lyric lines array (legacy) */
  onCreateLyricPages = undefined,
  /** Called when user dismisses / closes the panel */
  onClose,
  /** Compact inline mode for embedding in inspector */
  compact = false,
  /** Lock model selection to an externally resolved model id */
  modelIdOverride = '',
  /** Hide raw model selector for simple preset-driven UX */
  hideModelSelector = false,
  /** User-facing selected preset id (for debug metadata) */
  selectedPreset = null,
  /** User-facing engine intent (for debug metadata) */
  engineIntent = null,
  /** Resolver output showing active effective engine */
  resolvedEngine = null,
  /** Transcription mode for Whisper main-process pipeline */
  transcriptionMode = 'normal',
}) {
  const [available, setAvailable] = useState(/** @type {boolean|null} */ (null))
  const [modelId, setModelId] = useState(modelIdOverride || DEFAULT_WHISPER_MODEL)
  const activeModelId = modelIdOverride || modelId
  const [openAiKey, setOpenAiKey] = useState(() => {
    try { return localStorage.getItem('openai-api-key') || '' } catch { return '' }
  })
function ignoreError() {}
  const [transcribing, setTranscribing] = useState(false)
  const [modelProgress, setModelProgress] = useState({ status: '', file: '', progress: 0 })
  const [transcribeProgress, setTranscribeProgress] = useState(0)
  const [result, setResult] = useState({ text: '', segments: [], language: '', engine: 'xenova', method: null, model: null, warnings: [], gaps: [] })
  const [editedText, setEditedText] = useState('')
  const [status, setStatus] = useState('')
  const [engineStatusText, setEngineStatusText] = useState('')
  const [showSrt, setShowSrt] = useState(false)
  const [customAudioUrl, setCustomAudioUrl] = useState(audioUrl)
  const [customAudioName, setCustomAudioName] = useState(audioName)
  const [customAudioFilePath, setCustomAudioFilePath] = useState(/** @type {string|null} */ (null))
  const [modelCacheStatus, setModelCacheStatus] = useState(/** @type {{ state:string, message:string, dir?:string }} */ ({ state: 'unknown', message: 'Cache status not checked.' }))
  const [modelCacheBusy, setModelCacheBusy] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    isWhisperAvailable().then(setAvailable)
  }, [])

  useEffect(() => {
    if (audioUrl) { setCustomAudioUrl(audioUrl); setCustomAudioName(audioName); setCustomAudioFilePath(null) }
  }, [audioUrl, audioName])

  const refreshModelCacheStatus = useCallback(async () => {
    const modelIdForCache = activeModelId.startsWith('whispercpp-') || activeModelId === 'auto-best'
      ? 'Xenova/whisper-medium'
      : activeModelId
    const selectedModel = WHISPER_MODELS.find((m) => m.id === activeModelId)
    if (activeModelId === 'openai-api') {
      setModelCacheStatus({ state: 'cloud', message: 'OpenAI API uses a cloud model; no local Whisper cache is used.' })
      return
    }

    if (typeof window === 'undefined' || !window.smmDesktop?.whisper?.modelStatus) {
      setModelCacheStatus({ state: 'browser', message: 'Local cache controls are available in the Electron desktop app.' })
      return
    }

    setModelCacheBusy(true)
    try {
      const info = await window.smmDesktop.whisper.modelStatus({ modelId: modelIdForCache })
      const sizeText = selectedModel?.size ? ` (${selectedModel.size})` : ''
      if (info?.allCached) {
        const detailText = info.fileCount ? `, ${info.fileCount} files, ${formatCacheBytes(info.sizeBytes || 0)}` : ''
        setModelCacheStatus({ state: 'ready', message: `Cached locally${sizeText}${detailText}.`, dir: info.dir })
      } else {
        setModelCacheStatus({ state: 'missing', message: `Not cached yet${sizeText}. First transcription will download it.`, dir: info?.dir })
      }
    } catch (err) {
      setModelCacheStatus({ state: 'error', message: `Could not read model cache: ${err?.message || String(err)}` })
    } finally {
      setModelCacheBusy(false)
    }
  }, [activeModelId])

  const refreshEngineStatus = useCallback(async () => {
    if (!window.smmDesktop?.whisper?.engineStatus) return
    try {
      const info = await window.smmDesktop.whisper.engineStatus()
      const cpp = Array.isArray(info?.availableEngines)
        ? info.availableEngines.find((e) => e.id === 'whisper.cpp')
        : null
      if (!cpp) {
        setEngineStatusText('')
        return
      }
      if (cpp.available) {
        const count = Array.isArray(cpp.modelCandidates) ? cpp.modelCandidates.length : 0
        setEngineStatusText(`whisper.cpp available (${count} model candidate${count === 1 ? '' : 's'}).`)
      } else {
        setEngineStatusText('whisper.cpp not installed. Add whisper-cli/main.exe and GGML/GGUF model file.')
      }
    } catch {
      setEngineStatusText('')
    }
  }, [])

  useEffect(() => {
    if (!transcribing) refreshModelCacheStatus()
  }, [activeModelId, transcribing, refreshModelCacheStatus])

  useEffect(() => {
    refreshEngineStatus()
  }, [activeModelId, refreshEngineStatus])

  const handleClearModelCache = useCallback(async () => {
    if (activeModelId === 'openai-api' || modelCacheBusy || transcribing) return
    const selectedModel = WHISPER_MODELS.find((m) => m.id === activeModelId)
    const label = selectedModel?.label || activeModelId
    if (!window.confirm(`Clear the cached files for ${label}? The original audio and projects will not be deleted.`)) return

    setModelCacheBusy(true)
    try {
      const result = await clearWhisperCache(activeModelId)
      if (!result?.ok) throw new Error(result?.error || 'Clear failed')
      setModelCacheStatus({ state: 'missing', message: `Cleared ${label}. It will download again on next use.` })
      await refreshModelCacheStatus()
    } catch (err) {
      setModelCacheStatus({ state: 'error', message: `Could not clear model cache: ${err?.message || String(err)}` })
    } finally {
      setModelCacheBusy(false)
    }
  }, [activeModelId, modelCacheBusy, transcribing, refreshModelCacheStatus])

  const handleTranscribe = useCallback(async () => {
    if (!customAudioUrl || transcribing) return
    const hasSharedBuf = typeof SharedArrayBuffer !== 'undefined'
    setTranscribing(true)
    setStatus(hasSharedBuf ? 'Loading model…' : 'Loading model (single-thread mode — no SharedArrayBuffer)…')
    setTranscribeProgress(0)
    setResult({ text: '', segments: [], language: '', engine: 'xenova', method: null, model: null, warnings: [], gaps: [] })
    setEditedText('')

    try {
      const res = await transcribe(customAudioUrl, {
        model: activeModelId,
        selectedPreset,
        engineIntent,
        resolvedEngine,
        audioFilePath: customAudioFilePath || undefined,
        wordTimestamps: true,
        transcriptionMode,
        apiKey: openAiKey || undefined,
        onModelProgress: (prog) => {
          const file = (prog.file || '').split(/[\\/]/).pop() || ''
          const fileOf = (prog.fileCount > 1) ? ` (file ${(prog.fileIndex || 0) + 1}/${prog.fileCount})` : ''
          if (prog.status === 'progress' || prog.status === 'download') {
            const pct = prog.total ? Math.round((prog.loaded || 0) / prog.total * 100) : Math.round(prog.progress || 0)
            const mbLoaded = prog.loaded ? (prog.loaded / 1024 / 1024).toFixed(1) : null
            const mbTotal  = prog.total  ? (prog.total  / 1024 / 1024).toFixed(1) : null
            const sizeStr  = mbLoaded && mbTotal ? ` — ${mbLoaded} / ${mbTotal} MB` : ''
            setModelProgress({ status: 'downloading', file, progress: pct })
            setStatus(`⬇ Downloading ${file || 'model'}${fileOf}: ${pct}%${sizeStr}`)
          } else if (prog.status === 'done' || prog.status === 'skipped') {
            setModelProgress({ status: 'done', file, progress: 100 })
            setStatus(`✔ ${file || 'file'} ready${fileOf} — fetching next…`)
          } else if (prog.status === 'initiate') {
            setStatus(file ? `📂 Requesting: ${file}${fileOf}` : 'Initialising model pipeline…')
            setModelProgress({ status: '', file: '', progress: 0 })
          } else if (prog.status === 'ready') {
            setStatus('✅ Model ready — starting transcription…')
            setModelProgress({ status: 'ready', file: '', progress: 100 })
          } else if (prog.status === 'error') {
            setStatus(`❌ Download error: ${prog.error || 'unknown'}`)
          }
        },
        onTranscribeProgress: (pct) => {
          setTranscribeProgress(pct)
          if (pct < 100) setStatus(`Transcribing… ${pct}%`)
          else setStatus('Transcription complete!')
        },
      })
      setResult(res)
      setEditedText(res.text)
      // Show first 120 chars of transcribed text in status so user can confirm it worked
      const preview = res.text ? `"${res.text.slice(0, 120)}${res.text.length > 120 ? '…' : ''}"` : '(no text returned)'
      const warningText = Array.isArray(res.warnings) && res.warnings.length ? ` ⚠ ${res.warnings[0]}` : ''
      setStatus(`✅ Done (${res.language}, ${res.engine || 'xenova'}) — ${res.segments.length} segments — ${preview}${warningText}`)

      if (onTranscribeComplete) {
        onTranscribeComplete(res)
      }
      if (!onTranscribeComplete && onCreateLyricPages && res.segments.length > 0) {
        const autoLines = segmentsToLyricLines(res.segments)
        if (autoLines.length > 0) onCreateLyricPages(autoLines)
      }
      refreshModelCacheStatus()
    } catch (err) {
      if (err?.name === 'AbortError') {
        setStatus('Cancelled.')
      } else {
        setStatus('❌ Error: ' + (err?.message || String(err)))
      }
    } finally {
      setTranscribing(false)
    }
  // onTranscribeComplete and onCreateLyricPages are stable callback refs from parent —
  // including them avoids stale closure without causing unnecessary re-runs.
  }, [activeModelId, customAudioUrl, customAudioFilePath, transcribing, onTranscribeComplete, onCreateLyricPages, openAiKey, refreshModelCacheStatus, transcriptionMode, selectedPreset, engineIntent, resolvedEngine])

  const handleAbort = () => {
    abortTranscription()
    setTranscribing(false)
    setStatus('Cancelling…')
  }

  const handlePickFile = () => {
    // Use Electron's media picker if available, else HTML file input
    if (window.smmDesktop?.selectMedia) {
      window.smmDesktop.selectMedia({ category: 'audio', title: 'Select audio file to transcribe' }).then((r) => {
        if (!r?.canceled && r?.filePath) {
          const port = window.smmDesktop?.mediaServerPort || 0
          const url = port ? `http://127.0.0.1:${port}/media?p=${encodeURIComponent(r.filePath)}` : `file://${r.filePath}`
          setCustomAudioUrl(url)
          setCustomAudioName(r.fileName || r.filePath.split(/[\\/]/).pop() || 'audio')
          setCustomAudioFilePath(r.filePath) // store native path for direct ffmpeg access
        }
      })
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleHtmlFilePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCustomAudioUrl(url)
    setCustomAudioName(file.name)
    setCustomAudioFilePath(null) // blob URL — no native path available
  }

  const srtContent = result.segments.length ? segmentsToSrt(result.segments) : ''

  const lyricLines = result.segments.length ? segmentsToLyricLines(result.segments) : []

  // ── Not available ─────────────────────────────────────────────────────────
  if (available === false) {
    return (
      <div style={S.panel}>
        <div style={S.errorBox}>
          <strong>⚠ @xenova/transformers not installed</strong>
          <p style={{ marginTop: 4 }}>Run <code>npm install @xenova/transformers</code> then restart the app.</p>
        </div>
      </div>
    )
  }

  // ── Loading availability ──────────────────────────────────────────────────
  if (available === null) {
    return <div style={S.panel}><div style={S.muted}>Checking Whisper availability…</div></div>
  }

  // ── Compact mode ──────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div style={S.compact}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={activeModelId} onChange={(e) => setModelId(e.target.value)} style={S.select}>
            {WHISPER_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button onClick={handleTranscribe} disabled={!customAudioUrl || transcribing} style={S.btn}>
            {transcribing ? `${transcribeProgress}%` : '📝 Transcribe'}
          </button>
          {transcribing && <button onClick={handleAbort} style={{ ...S.btn, background: '#c0392b' }}>✕</button>}
        </div>
        {editedText && (
          <textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} rows={3} style={S.textarea} />
        )}
        {editedText && onInsertText && (
          <button onClick={() => onInsertText(editedText)} style={{ ...S.btn, width: '100%' }}>
            📋 Insert as text element
          </button>
        )}
        {status && <div style={S.muted}>{status}</div>}
      </div>
    )
  }

  // ── Full panel ─────────────────────────────────────────────────────────────
  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.header}>
        <span>🎤 Whisper Speech-to-Text</span>
        {onClose && <button onClick={onClose} style={S.closeBtn}>✕</button>}
      </div>

      {/* Audio source */}
      <div style={S.section}>
        <div style={S.label}>Audio source</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handlePickFile} style={S.actionBtn}>📂 Browse…</button>
          <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleHtmlFilePick} />
          {customAudioName && (
            <span style={{ ...S.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '26px' }}>
              🎵 {customAudioName}
            </span>
          )}
        </div>
        {customAudioUrl && <audio src={customAudioUrl} controls style={{ width: '100%', marginTop: 4 }} />}
      </div>

      {/* Model selector */}
      {!hideModelSelector && (
        <div style={S.section}>
          <div style={S.label}>Whisper model</div>
          <select value={activeModelId} onChange={(e) => setModelId(e.target.value)} style={S.selectFull}>
            {WHISPER_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label} — {m.description}</option>
            ))}
          </select>
          {WHISPER_MODELS.find(m => m.id === activeModelId)?.electronOnly && (
            <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2, fontWeight: 600 }}>
              ⚠ This model requires the Electron desktop app and will error in the browser preview.
              Use Tiny, Base, or Small for browser testing.
            </div>
          )}
          {engineStatusText && (
            <div style={{ fontSize: 10, color: 'var(--t3,#888)', marginTop: 3 }}>{engineStatusText}</div>
          )}
          <div style={S.cachePanel}>
            <div style={{ ...S.muted, color: modelCacheStatus.state === 'ready' ? '#22c55e' : modelCacheStatus.state === 'error' ? '#ef4444' : 'var(--t3, #888)' }}>
              Cache: {modelCacheStatus.message}
            </div>
            {modelCacheStatus.dir && (
              <div title={modelCacheStatus.dir} style={S.cachePath}>{modelCacheStatus.dir}</div>
            )}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button type="button" onClick={refreshModelCacheStatus} disabled={modelCacheBusy || transcribing} style={S.secondaryBtn}>
                {modelCacheBusy ? 'Checking...' : 'Refresh cache'}
              </button>
              {activeModelId !== 'openai-api' && (
                <button type="button" onClick={handleClearModelCache} disabled={modelCacheBusy || transcribing || modelCacheStatus.state !== 'ready'} style={S.secondaryBtn}>
                  Clear selected model
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OpenAI API key input — shown only when openai-api model is selected */}
      {activeModelId === 'openai-api' && (
        <div style={S.section}>
          <div style={S.label}>OpenAI API Key</div>
          <input
            type="password"
            value={openAiKey}
            onChange={e => {
              setOpenAiKey(e.target.value)
              try { localStorage.setItem('openai-api-key', e.target.value) } catch { ignoreError() }
            }}
            placeholder="sk-…  (stored locally, never sent anywhere except OpenAI)"
            style={{ ...S.textarea, padding: '4px 8px', fontFamily: 'monospace', fontSize: 12, height: 28, resize: 'none' }}
          />
          <div style={{ fontSize: 10, color: 'var(--t3,#888)', marginTop: 2 }}>
            Uses OpenAI <code>whisper-1</code> model (large-v2 quality) via their API. Cost: ~$0.006/min.
            Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: '#3cb8be' }}>platform.openai.com/api-keys</a>.
          </div>
        </div>
      )}

      {/* Transcribe button */}
      <div style={S.section}>
        {!transcribing ? (
          <button
            onClick={handleTranscribe}
            disabled={!customAudioUrl}
            style={{ ...S.actionBtn, width: '100%', opacity: customAudioUrl ? 1 : 0.5 }}
          >
            🎤 Transcribe Audio
          </button>
        ) : (
          <button onClick={handleAbort} style={{ ...S.actionBtn, background: '#c0392b', width: '100%' }}>
            ✕ Cancel
          </button>
        )}
      </div>

      {/* Model download progress */}
      {transcribing && modelProgress.status === 'downloading' && (
        <div style={S.section}>
          <div style={S.muted}>Downloading: {modelProgress.file}</div>
          <div style={S.progressBar}><div style={{ ...S.progressFill, width: `${modelProgress.progress}%` }} /></div>
        </div>
      )}

      {/* Show indeterminate bar while waiting for first progress event (initiate / prepare phase) */}
      {transcribing && modelProgress.status !== 'ready' && modelProgress.status !== 'downloading' && (
        <div style={S.section}>
          <div style={S.muted}>
            {`Loading model… (first run downloads ${WHISPER_MODELS.find(m => m.id === activeModelId)?.size ?? '??'} from HuggingFace — large models can take several minutes)`}
          </div>
          <div style={{ ...S.progressBar, overflow: 'hidden' }}>
            <div style={{ ...S.progressFill, width: '100%', animation: 'whisper-pulse 1.4s ease-in-out infinite', opacity: 0.7 }} />
          </div>
        </div>
      )}

      {/* Transcription progress */}
      {transcribing && transcribeProgress > 0 && (
        <div style={S.section}>
          <div style={S.progressBar}><div style={{ ...S.progressFill, width: `${transcribeProgress}%` }} /></div>
        </div>
      )}

      {/* Status */}
      {status && <div style={{ ...S.muted, padding: '4px 8px', background: 'var(--bg2, #222)', borderRadius: 4 }}>{status}</div>}

      {/* Output */}
      {editedText && (
        <>
          <div style={S.section}>
            <div style={S.label}>Transcript</div>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={6}
              style={S.textarea}
              placeholder="Transcript will appear here…"
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {onInsertText && (
              <button onClick={() => onInsertText(editedText)} style={S.actionBtn}>
                📋 Insert as text
              </button>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(editedText).catch(() => {})}
              style={S.actionBtn}
            >
              📋 Copy
            </button>
            {onCreateLyricPages && lyricLines.length > 0 && (
              <button onClick={() => onCreateLyricPages(lyricLines)} style={{ ...S.actionBtn, background: '#7c3aed' }}>
                🎵 Create lyric pages ({lyricLines.length})
              </button>
            )}
            <button onClick={() => setShowSrt((v) => !v)} style={S.secondaryBtn}>
              {showSrt ? 'Hide SRT' : 'View SRT'}
            </button>
            {showSrt && (
              <button
                onClick={() => {
                  const blob = new Blob([srtContent], { type: 'text/plain' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = (customAudioName.replace(/\.[^.]+$/, '') || 'transcript') + '.srt'
                  a.click()
                }}
                style={S.secondaryBtn}
              >
                ⬇ Export .srt
              </button>
            )}
            {window.smmDesktop?.whisper?.exportDebug && (
              <button
                onClick={async () => {
                  const r = await window.smmDesktop.whisper.exportDebug({
                    request: {
                      audioUrl: customAudioUrl,
                      audioFilePath: customAudioFilePath,
                      selectedPreset,
                      engineIntent,
                      resolvedEngine,
                      modelId: activeModelId,
                      engineSelection: ['auto-best', 'whispercpp-medium', 'whispercpp-large'].includes(activeModelId) ? activeModelId : 'xenova',
                      desiredModel: activeModelId === 'whispercpp-large' ? 'large' : 'medium',
                      transcriptionMode,
                    },
                    output: {
                      text: result.text,
                      chunks: result.segments,
                      wordTimestamps: result.wordTimestamps || [],
                      engine: result.engine || 'xenova',
                      resolvedEngine: result.engine || resolvedEngine || null,
                      method: result.method || null,
                      model: result.model || activeModelId,
                      fullText: result.text,
                      fullTextPreview: String(result.text || '').slice(0, 1000),
                      warnings: result.warnings || [],
                      gaps: result.gaps || [],
                      containsGasoline: !!result.containsGasoline,
                      containsFingers: !!result.containsFingers,
                      containsMatch: !!result.containsMatch,
                      firstTenChunks: (result.segments || []).slice(0, 10),
                      lyricLines: segmentsToLyricLines(result.segments || []),
                    },
                  })
                  if (r?.ok && r.filePath) setStatus(`🧾 Debug exported: ${r.filePath}`)
                  else setStatus(`❌ Debug export failed: ${r?.error || 'unknown error'}`)
                }}
                style={S.secondaryBtn}
              >
                🧾 Export Transcription Debug JSON
              </button>
            )}
          </div>

          {showSrt && (
            <div style={S.section}>
              <div style={S.label}>SRT Preview</div>
              <pre style={{ ...S.textarea, overflowY: 'auto', maxHeight: 150, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {srtContent}
              </pre>
            </div>
          )}

          {lyricLines.length > 0 && (
            <div style={S.section}>
              <div style={S.label}>Lyric lines ({lyricLines.length})</div>
              <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 10 }}>
                {lyricLines.map((line, i) => (
                  <div key={i} style={{ padding: '2px 4px', borderBottom: '1px solid var(--border, #333)' }}>
                    <span style={{ color: 'var(--t3)', marginRight: 6 }}>
                      {Math.floor(line.start / 60)}:{String(Math.floor(line.start % 60)).padStart(2, '0')}
                    </span>
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

/** @type {Record<string, import('react').CSSProperties>} */
const S = {
  panel: {
    display: 'flex', flexDirection: 'column', gap: 8,
    background: 'var(--bg2, #1e1e2e)', border: '1px solid var(--border, #333)',
    borderRadius: 6, padding: 10, fontSize: 12, color: 'var(--t1, #eee)',
  },
  compact: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontWeight: 600, fontSize: 12, paddingBottom: 4, borderBottom: '1px solid var(--border, #333)',
  },
  closeBtn: { background: 'none', border: 'none', color: 'var(--t2, #aaa)', cursor: 'pointer', fontSize: 13 },
  section: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 10, color: 'var(--t3, #888)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  muted: { fontSize: 10, color: 'var(--t3, #888)' },
  select: {
    background: 'var(--bg3, #2a2a3e)', border: '1px solid var(--border, #333)',
    color: 'var(--t1, #eee)', borderRadius: 3, padding: '2px 4px', fontSize: 11,
  },
  selectFull: {
    width: '100%', background: 'var(--bg3, #2a2a3e)', border: '1px solid var(--border, #333)',
    color: 'var(--t1, #eee)', borderRadius: 3, padding: '3px 6px', fontSize: 11,
  },
  textarea: {
    width: '100%', background: 'var(--bg3, #2a2a3e)', border: '1px solid var(--border, #333)',
    color: 'var(--t1, #eee)', borderRadius: 4, padding: '5px 7px', fontSize: 11,
    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
  },
  btn: {
    background: 'var(--accent, #3cb8be)', border: 'none', color: '#fff',
    borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap',
  },
  actionBtn: {
    background: 'var(--accent, #3cb8be)', border: 'none', color: '#fff',
    borderRadius: 4, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  secondaryBtn: {
    background: 'var(--bg3, #2a2a3e)', border: '1px solid var(--border, #444)', color: 'var(--t2, #ccc)',
    borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 11,
  },
  progressBar: { height: 6, background: 'var(--bg3, #333)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--accent, #3cb8be)', transition: 'width 0.3s' },
  cachePanel: {
    display: 'flex', flexDirection: 'column', gap: 4,
    border: '1px solid var(--border, #333)', borderRadius: 4, padding: 6,
    background: 'rgba(255,255,255,0.03)',
  },
  cachePath: {
    fontSize: 10, color: 'var(--t3, #888)', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  errorBox: {
    background: 'rgba(192,57,43,.15)', border: '1px solid rgba(192,57,43,.4)',
    borderRadius: 4, padding: '8px 10px', fontSize: 11, color: 'var(--t1, #eee)',
  },
}
