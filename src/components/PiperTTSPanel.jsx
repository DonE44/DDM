// @ts-check
/**
 * PiperTTSPanel — Piper TTS Tier 2 UI
 *
 * Provides:
 *  - Voice catalog with download status
 *  - Download progress bar
 *  - Text-to-speech synthesis → WAV file
 *  - Returns the WAV path so caller can assign as page narration
 *
 * Requires window.smmDesktop.tts (exposed via Electron preload).
 * Gracefully degrades to a "desktop only" notice in browser/web context.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

/** @typedef {{ id:string, label:string, language:string, quality:string, modelSize:number, downloaded:boolean, piperReady:boolean }} VoiceEntry */

const QUALITY_LABEL = { medium: 'Medium', high: '★ High', low: 'Low' }

export default function PiperTTSPanel({
  /** Initial text to synthesize (optional — user can edit) */
  initialText = '',
  /** Called when synthesis completes — receives { path, name } */
  onSynthesized,
  /** Called when user closes/collapses the panel */
  onClose,
  /** Compact mode — show only essential controls */
  compact = false,
}) {
  const desktop = typeof window !== 'undefined' ? window.smmDesktop : null
  const hasPiper = !!desktop?.tts

  const [voices, setVoices] = useState(/** @type {VoiceEntry[]} */([]))
  const [selectedVoice, setSelectedVoice] = useState('')
  const [text, setText] = useState(initialText)
  const [rate, setRate] = useState(1)
  const [status, setStatus] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [installingBinary, setInstallingBinary] = useState(false)
  const [progress, setProgress] = useState({ stage: '', percent: 0, detail: '' })
  const [synthesizing, setSynthesizing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const removeListenerRef = useRef(null)
  const mediaServerPort = desktop?.mediaServerPort || 0

  const loadVoices = useCallback(async () => {
    if (!hasPiper) return
    try {
      const list = /** @type {VoiceEntry[]} */ (await desktop.tts.voicesCatalog())
      setVoices(list)
      if (!selectedVoice && list.length) setSelectedVoice(list[0].id)
    } catch (err) {
      setStatus('Failed to load voice catalog: ' + err.message)
    }
  }, [hasPiper, desktop, selectedVoice])

  useEffect(() => {
    loadVoices()
    return () => {
      if (removeListenerRef.current) { removeListenerRef.current(); removeListenerRef.current = null }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update text when parent changes initialText
  useEffect(() => {
    if (initialText) setText(initialText)
  }, [initialText])

  const handleDownload = async () => {
    if (!hasPiper || !selectedVoice || downloading) return
    setDownloading(true)
    setProgress({ stage: 'starting', percent: 0, detail: 'Starting download…' })
    setStatus('')

    // Subscribe to progress events
    if (removeListenerRef.current) removeListenerRef.current()
    removeListenerRef.current = desktop.tts.onDownloadProgress((data) => {
      setProgress({ stage: data.stage || '', percent: data.percent || 0, detail: data.detail || '' })
    })

    try {
      const result = await desktop.tts.downloadVoice(selectedVoice)
      if (removeListenerRef.current) { removeListenerRef.current(); removeListenerRef.current = null }
      if (result.ok) {
        setStatus('✅ Voice ready!')
        await loadVoices()
      } else {
        setStatus('❌ Download failed: ' + result.error)
      }
    } catch (err) {
      setStatus('❌ Download error: ' + err.message)
    } finally {
      setDownloading(false)
      setProgress({ stage: '', percent: 0, detail: '' })
    }
  }

  const handleInstallBinary = async () => {
    if (!hasPiper || installingBinary) return
    setInstallingBinary(true)
    setStatus('Downloading Piper engine (~15MB)…')
    if (removeListenerRef.current) removeListenerRef.current()
    removeListenerRef.current = desktop.tts.onDownloadProgress((data) => {
      setProgress({ stage: data.stage || '', percent: data.percent || 0, detail: data.detail || '' })
    })
    try {
      const result = await desktop.tts.installBinary()
      if (removeListenerRef.current) { removeListenerRef.current(); removeListenerRef.current = null }
      if (result.ok) {
        setStatus(result.alreadyInstalled ? '✅ Piper engine already installed.' : '✅ Piper engine installed!')
        await loadVoices()
      } else {
        setStatus('❌ Install failed: ' + result.error)
      }
    } catch (err) {
      setStatus('❌ Install error: ' + err.message)
    } finally {
      setInstallingBinary(false)
      setProgress({ stage: '', percent: 0, detail: '' })
    }
  }

  const handleSynthesize = async () => {
    if (!hasPiper || !selectedVoice || !text.trim() || synthesizing) return
    const voice = voices.find((v) => v.id === selectedVoice)
    if (!voice?.downloaded) {
      setStatus('⚠ Download this voice first.')
      return
    }
    setSynthesizing(true)
    setStatus('Synthesizing…')
    try {
      const result = await desktop.tts.synthesize({ text: text.trim(), voiceId: selectedVoice, rate })
      if (result.ok) {
        // Build media server URL for in-app preview
        if (mediaServerPort) {
          const url = `http://127.0.0.1:${mediaServerPort}/?p=${encodeURIComponent(result.path)}`
          setPreviewUrl(url)
        }
        setStatus('✅ Done! File: ' + result.path.split(/[\\/]/).pop())
        if (onSynthesized) onSynthesized({ path: result.path, name: result.path.split(/[\\/]/).pop() || 'speech.wav' })
      } else {
        setStatus('❌ Synthesis failed: ' + result.error)
      }
    } catch (err) {
      setStatus('❌ Error: ' + err.message)
    } finally {
      setSynthesizing(false)
    }
  }

  // ── Render: no desktop / no piper ─────────────────────────────────────────
  if (!hasPiper) {
    return (
      <div style={styles.notice}>
        🖥 Piper TTS requires the <strong>desktop app</strong>.
        <br />Use <em>🔊 Web Speech Preview</em> above for in-app preview.
      </div>
    )
  }

  const voice = voices.find((v) => v.id === selectedVoice)
  const isReady = !!voice?.downloaded
  const piperReady = !!voice?.piperReady
  const canSynth = isReady && piperReady && !!text.trim() && !synthesizing

  // ── Compact mode (for inline use in inspector) ────────────────────────────
  if (compact) {
    return (
      <div style={styles.compact}>
        <div style={styles.row}>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            style={styles.select}
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({v.modelSize}MB){v.downloaded ? ' ✓' : ''}
              </option>
            ))}
          </select>
          {!piperReady && (
            <button onClick={handleInstallBinary} disabled={installingBinary} style={{ ...styles.btn, background: '#e07b00' }}>
              {installingBinary ? `${progress.percent}%` : '⚙ Engine'}
            </button>
          )}
          {!isReady && (
            <button onClick={handleDownload} disabled={downloading} style={styles.btn}>
              {downloading ? `${progress.percent}%` : '⬇ Get'}
            </button>
          )}
          <button onClick={handleSynthesize} disabled={!canSynth} style={styles.btn}>
            {synthesizing ? '…' : '🔊 Make'}
          </button>
        </div>
        {status && <div style={styles.status}>{status}</div>}
      </div>
    )
  }

  // ── Full panel ─────────────────────────────────────────────────────────────
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span>🤖 Piper TTS (Offline Neural)</span>
        {onClose && <button onClick={onClose} style={styles.closeBtn}>✕</button>}
      </div>

      {/* Install binary notice (shows when voice downloaded but binary missing) */}
      {isReady && !piperReady && (
        <div style={styles.section}>
          <div style={{ ...styles.hint, color: '#e07b00', fontStyle: 'normal' }}>
            ⚠ Piper engine not installed. Voices are ready but the synthesis engine (~15MB) is missing.
          </div>
          <button
            onClick={handleInstallBinary}
            disabled={installingBinary}
            style={{ ...styles.actionBtn, width: '100%', background: '#e07b00' }}
          >
            {installingBinary ? `⚙ ${progress.detail || `Installing… ${progress.percent}%`}` : '⚙ Install Piper Engine'}
          </button>
          {installingBinary && (
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress.percent}%`, background: '#e07b00' }} />
            </div>
          )}
        </div>
      )}

      {/* Voice selector */}
      <div style={styles.section}>
        <label style={styles.label}>Voice</label>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          style={styles.selectFull}
        >
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label} — {QUALITY_LABEL[v.quality] || v.quality} ({v.modelSize}MB)
              {v.downloaded ? ' ✓' : ' (not downloaded)'}
            </option>
          ))}
        </select>
        {voice && !isReady && (
          <div style={styles.hint}>
            ~{voice.modelSize}MB download + Piper binary (~15MB, one-time).
          </div>
        )}
      </div>

      {/* Download button + progress */}
      {!isReady && (
        <div style={styles.section}>
          <button onClick={handleDownload} disabled={downloading} style={{ ...styles.actionBtn, width: '100%' }}>
            {downloading ? `⬇ ${progress.detail || 'Downloading…'}` : '⬇ Download Voice'}
          </button>
          {downloading && (
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress.percent}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Text input */}
      <div style={styles.section}>
        <label style={styles.label}>Text to speak</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Type or paste text here…"
          style={styles.textarea}
        />
      </div>

      {/* Rate control */}
      <div style={{ ...styles.section, ...styles.row }}>
        <label style={styles.label}>Speed: {rate.toFixed(1)}×</label>
        <input
          type="range" min={0.5} max={2} step={0.1}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          style={{ flex: 1 }}
        />
      </div>

      {/* Synthesize button */}
      <div style={styles.section}>
        <button
          onClick={handleSynthesize}
          disabled={!canSynth}
          style={{ ...styles.actionBtn, width: '100%', opacity: canSynth ? 1 : 0.5 }}
        >
          {synthesizing ? '⏳ Synthesizing…' : '🎙 Generate Speech (WAV)'}
        </button>
        {!isReady && <div style={styles.hint}>Download a voice first to enable synthesis.</div>}
      </div>

      {/* Preview player */}
      {previewUrl && (
        <div style={styles.section}>
          <audio src={previewUrl} controls style={{ width: '100%' }} />
        </div>
      )}

      {/* Status */}
      {status && (
        <div style={{ ...styles.status, padding: '6px 8px', borderRadius: 4, background: 'var(--bg2, #222)' }}>
          {status}
        </div>
      )}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

/** @type {Record<string, import('react').CSSProperties>} */
const styles = {
  panel: {
    display: 'flex', flexDirection: 'column', gap: 8,
    background: 'var(--bg2, #1e1e2e)', border: '1px solid var(--border, #333)',
    borderRadius: 6, padding: 10, fontSize: 12, color: 'var(--t1, #eee)',
  },
  compact: {
    display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontWeight: 600, fontSize: 12, paddingBottom: 4, borderBottom: '1px solid var(--border, #333)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--t2, #aaa)',
    cursor: 'pointer', fontSize: 13, padding: '0 2px',
  },
  section: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, color: 'var(--t3, #888)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  select: {
    flex: 1, background: 'var(--bg3, #2a2a3e)', border: '1px solid var(--border, #333)',
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
    borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap',
  },
  actionBtn: {
    background: 'var(--accent, #3cb8be)', border: 'none', color: '#fff',
    borderRadius: 4, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
  },
  progressBar: {
    height: 6, background: 'var(--bg3, #333)', borderRadius: 3, overflow: 'hidden', marginTop: 3,
  },
  progressFill: {
    height: '100%', background: 'var(--accent, #3cb8be)', transition: 'width 0.3s',
  },
  hint: { fontSize: 10, color: 'var(--t3, #888)', fontStyle: 'italic' },
  status: { fontSize: 11, color: 'var(--t2, #ccc)' },
  notice: {
    fontSize: 11, color: 'var(--t3, #888)', padding: '8px 0',
    borderTop: '1px solid var(--border, #333)', lineHeight: 1.5,
  },
}
