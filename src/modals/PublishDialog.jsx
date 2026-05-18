/**
 * PublishDialog.jsx — FluxAura Studio Publish / Export Dialog
 *
 * Offers three publish targets:
 *   HTML   – single self-contained .html file, optional AES-256 password gate
 *   .mmp   – encrypted ZIP package (custom format) with all assets + player
 *   ZIP    – unencrypted bundle for web hosting
 *
 * Props:
 *   pages        {object[]}   Page objects from app state
 *   stage        {object}     { width, height }
 *   projectVars  {object[]}   Project variable definitions
 *   filename     {string}     Current project filename (used as default title)
 *   onClose      {()=>void}
 *   onStatus     {(msg:string)=>void}
 */

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { exportAsHtml, exportAsMmp, exportAsZip } from '../utils/publishUtils.js'

const TABS = [
  {
    id: 'html',
    icon: '🌐',
    label: 'HTML',
    desc: 'Single self-contained .html file. Works in any modern browser, offline, on any platform. All assets embedded. Optional password gate.',
    badge: 'Universal',
    badgeColor: '#2a7a3a',
  },
  {
    id: 'mmp',
    icon: '📦',
    label: 'Package (.mmp)',
    desc: 'FluxAura Studio encrypted package. AES-256 encrypted ZIP containing the project, all assets and a built-in player. Ideal for secure distribution.',
    badge: 'Secure',
    badgeColor: '#7a3a1a',
  },
  {
    id: 'zip',
    icon: '🗜',
    label: 'ZIP Bundle',
    desc: 'Unencrypted ZIP bundle with player HTML + all media files separated. Ideal for web hosting (upload to a web server or GitHub Pages).',
    badge: 'Web Deploy',
    badgeColor: '#1a4a7a',
  },
  {
    id: 'script',
    icon: '💾',
    label: 'Export Script',
    desc: 'Save the current project as a .mme script file. Use this to back up your work or transfer it to another machine.',
    badge: 'Project File',
    badgeColor: '#3a3a1a',
  },
  {
    id: 'book',
    icon: '📖',
    label: 'Export Book',
    desc: 'Export as an interactive storybook ZIP — a self-contained web bundle with page-flip navigation. Great for e-books and portfolios.',
    badge: 'Storybook',
    badgeColor: '#1a3a3a',
  },
  {
    id: 'mp4',
    icon: '🎬',
    label: 'Export MP4',
    desc: 'Render the full presentation to a .mp4 video file. All pages, animations, and lyric highlights baked into a single video.',
    badge: 'Video',
    badgeColor: '#3a1a3a',
  },
]

const PLATFORM_OPTS = [
  { id: 'kiosk', label: '🖥 Kiosk Mode', desc: 'Hide cursor, disable Esc key. Fullscreen loop presentation.' },
  { id: 'navControls', label: '◀▶ Navigation Controls', desc: 'Show prev/next overlay buttons on hover.' },
]

export default function PublishDialog({ pages, stage, projectVars, filename, presentationAudio, onClose, onStatus, onExportScript, onExportBook, onExportMp4 }) {
  const defaultTitle = (filename || 'presentation').replace(/\.(mme|sca)$/i, '')
  const [tab, setTab] = useState('html')
  const [title, setTitle] = useState(defaultTitle)
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [kiosk, setKiosk] = useState(false)
  const [navControls, setNavControls] = useState(true)
  const [compressionLevel, setCompressionLevel] = useState(6)
  const [selectedPages, setSelectedPages] = useState(() => new Set(pages.map((_, i) => i)))
  const [allPages, setAllPages] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [outputFolder, setOutputFolder] = useState('')

  const browseSaveFolder = useCallback(async () => {
    const desktop = typeof window !== 'undefined' ? window.smmDesktop : null
    if (!desktop?.selectFolder) return
    const result = await desktop.selectFolder()
    if (!result.canceled && result.folderPath) setOutputFolder(result.folderPath)
  }, [])

  const togglePage = useCallback((idx) => {
    setSelectedPages(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      setAllPages(next.size === pages.length)
      return next
    })
  }, [pages.length])

  const toggleAll = useCallback(() => {
    if (allPages) {
      setSelectedPages(new Set())
      setAllPages(false)
    } else {
      setSelectedPages(new Set(pages.map((_, i) => i)))
      setAllPages(true)
    }
  }, [allPages, pages])

  const filteredPages = pages.filter((_, i) => selectedPages.has(i))

  const doPublish = useCallback(async () => {
    // Delegate-only tabs — close dialog and call back to App
    if (tab === 'script') { onClose(); onExportScript?.(); return }
    if (tab === 'book')   { onClose(); onExportBook?.();   return }
    if (tab === 'mp4')    { onClose(); onExportMp4?.();    return }

    if (filteredPages.length === 0) { onStatus('⚠ No pages selected'); return }
    setBusy(true)
    setProgress('Building…')
    setErrorMsg('')
    try {
      const opts = {
        title, author, description, password: password || '', kiosk, navControls, compressionLevel,
        outputFolder: outputFolder || null,
        presentationAudio: presentationAudio || null,
        onProgress: (done, total) => setProgress(`Resolving media… ${done}/${total}`),
      }
      let savedPath
      if (tab === 'html') {
        setProgress('Resolving media…')
        savedPath = await exportAsHtml(filteredPages, stage, projectVars, opts)
      } else if (tab === 'mmp') {
        setProgress('Resolving media…')
        savedPath = await exportAsMmp(filteredPages, stage, projectVars, opts)
      } else {
        setProgress('Resolving media…')
        savedPath = await exportAsZip(filteredPages, stage, projectVars, opts)
      }
      if (savedPath == null) {
        setProgress('')
        setBusy(false)
        return
      }
      onStatus(`✅ Saved: ${savedPath}  (${filteredPages.length} page${filteredPages.length !== 1 ? 's' : ''})`)
      onClose()
    } catch (err) {
      const msg = err?.message || String(err)
      setErrorMsg(`❌ Publish failed: ${msg}`)
      onStatus(`❌ Publish failed: ${msg}`)
      setProgress('')
      setBusy(false)
    }
  }, [tab, filteredPages, stage, projectVars, title, author, description, password, kiosk, navControls, compressionLevel, outputFolder, presentationAudio, onClose, onStatus, onExportScript, onExportBook, onExportMp4])

  // ── Render ───────────────────────────────────────────────────────────────

  const currentTab = TABS.find(t => t.id === tab)

  const content = (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxWidth: 720, width: '95vw', maxHeight: '90vh', overflow: 'auto', padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '14px 20px', background: '#0a1a2a', borderBottom: '1px solid #2a4a7a' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e8a020' }}>📤 Publish Presentation</span>
          <button className="modal-close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, background: '#0d1f35', borderBottom: '1px solid #2a4a7a' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '10px 8px', cursor: 'pointer', border: 'none',
                borderBottom: tab === t.id ? '2px solid #e8a020' : '2px solid transparent',
                background: tab === t.id ? '#1a3a6c' : 'transparent',
                color: tab === t.id ? '#e8e0c0' : '#6080a0',
                fontWeight: tab === t.id ? 700 : 400, fontSize: 13,
                transition: 'all .15s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab description */}
        <div style={{ padding: '10px 20px', background: '#0f1e30', borderBottom: '1px solid #1a2e50', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>{currentTab.icon}</span>
          <div>
            <span style={{ display: 'inline-block', background: currentTab.badgeColor, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, marginRight: 6 }}>{currentTab.badge}</span>
            <span style={{ fontSize: 12, color: '#8ab0d0' }}>{currentTab.desc}</span>
          </div>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Metadata */}
          <fieldset style={fsStyle}>
            <legend style={legendStyle}>📋 Project Metadata</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Presentation title" />
              </div>
              <div>
                <label style={labelStyle}>Author</label>
                <input style={inputStyle} value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author name (optional)" />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...inputStyle, height: 56, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description (optional)" />
            </div>
          </fieldset>

          {/* Password */}
          <fieldset style={fsStyle}>
            <legend style={legendStyle}>🔒 Password Protection (Optional)</legend>
            <div style={{ fontSize: 12, color: '#8ab0d0', marginBottom: 8 }}>
              {tab === 'mmp'
                ? 'AES-256-GCM encryption applied to project data. Decrypted in memory on the player side only.'
                : 'AES-256-GCM password gate — viewer must enter correct password before the presentation starts.'}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...inputStyle, flex: 1, fontFamily: showPw ? 'inherit' : 'monospace', letterSpacing: showPw ? 'normal' : '2px' }}
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Leave empty for no protection"
              />
              <button
                style={{ ...btnStyle, padding: '6px 10px', background: '#1a2a3a' }}
                onClick={() => setShowPw(v => !v)}
              >{showPw ? '🙈' : '👁'}</button>
            </div>
            {password && (
              <p style={{ fontSize: 11, color: '#80e080', marginTop: 4 }}>
                ✔ Password set — {password.length < 8 ? '⚠ Use 8+ characters for better security' : 'Strong protection active'}
              </p>
            )}
          </fieldset>

          {/* Platform options */}
          <fieldset style={fsStyle}>
            <legend style={legendStyle}>⚙ Playback Options</legend>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {PLATFORM_OPTS.map(o => (
                <label key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={o.id === 'kiosk' ? kiosk : navControls}
                    onChange={e => o.id === 'kiosk' ? setKiosk(e.target.checked) : setNavControls(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <span style={{ fontSize: 13, color: '#e0d0a0', fontWeight: 600 }}>{o.label}</span>
                    <br />
                    <span style={{ fontSize: 11, color: '#6080a0' }}>{o.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            {tab !== 'html' && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ ...labelStyle, width: 'auto', whiteSpace: 'nowrap' }}>Compression level</label>
                <input
                  type="range" min={1} max={9} step={1}
                  value={compressionLevel} onChange={e => setCompressionLevel(+e.target.value)}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, color: '#8ab0d0', minWidth: 28 }}>{compressionLevel}</span>
                <span style={{ fontSize: 11, color: '#4a6a8a' }}>{compressionLevel <= 3 ? '(Fast, larger file)' : compressionLevel >= 7 ? '(Slow, smallest file)' : '(Balanced)'}</span>
              </div>
            )}
          </fieldset>

          {/* Page selection */}
          <fieldset style={fsStyle}>
            <legend style={legendStyle}>📄 Pages to Include</legend>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 12, color: '#e0d0a0' }}>
                <input type="checkbox" checked={allPages} onChange={toggleAll} />
                Select all ({pages.length} pages)
              </label>
              <span style={{ fontSize: 11, color: '#4a6a8a' }}>— {selectedPages.size} selected</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
              {pages.map((pg, i) => (
                <label
                  key={i}
                  style={{
                    display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer',
                    padding: '4px 8px', borderRadius: 4, fontSize: 12,
                    background: selectedPages.has(i) ? '#1a3a6c' : '#0d1f35',
                    border: '1px solid ' + (selectedPages.has(i) ? '#4a8fc0' : '#1a2e50'),
                    color: selectedPages.has(i) ? '#e0d0a0' : '#4a6a8a',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPages.has(i)}
                    onChange={() => togglePage(i)}
                    style={{ display: 'none' }}
                  />
                  <span>{i + 1}.</span>
                  <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pg.name || `Page ${i + 1}`}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Save location */}
          <fieldset style={fsStyle}>
            <legend style={legendStyle}>📂 Save Location</legend>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                readOnly
                value={outputFolder}
                placeholder="(click Browse to pick a folder, or leave blank for a Save dialog)"
                style={{ ...inputStyle, flex: 1, cursor: 'default', color: outputFolder ? '#e0d0a0' : '#4a6a8a', fontSize: 12 }}
              />
              <button
                style={{ ...btnStyle, padding: '7px 14px', whiteSpace: 'nowrap', fontSize: 12 }}
                onClick={browseSaveFolder}
                disabled={busy}
              >
                📁 Browse…
              </button>
              {outputFolder && (
                <button
                  style={{ ...btnStyle, background: '#2a1a1a', color: '#c04040', border: '1px solid #4a1a1a', padding: '7px 10px' }}
                  onClick={() => setOutputFolder('')}
                  disabled={busy}
                  title="Clear — use Save dialog instead"
                >✕</button>
              )}
            </div>
            <div style={{ marginTop: 5, fontSize: 11, color: '#4a7a9a' }}>
              {outputFolder
                ? `✅ File will be written directly to: ${outputFolder}`
                : '📂 A native Save dialog will open when you click Publish.'}
            </div>
          </fieldset>

          {/* Summary — only for HTML/MMP/ZIP */}
          {!['script','book','mp4'].includes(tab) && (
          <div style={{ background: '#0a1a2a', border: '1px solid #2a4a7a', borderRadius: 6, padding: '10px 14px', fontSize: 12 }}>
            <span style={{ color: '#8ab0d0' }}>Publishing </span>
            <span style={{ color: '#e8a020', fontWeight: 700 }}>{filteredPages.length} page{filteredPages.length !== 1 ? 's' : ''}</span>
            <span style={{ color: '#8ab0d0' }}> as </span>
            <span style={{ color: '#80e0ff', fontWeight: 700 }}>
              {tab === 'html' ? `"${title}.html"` : tab === 'mmp' ? `"${title}.mmp" (encrypted package)` : `"${title}_bundle.zip"`}
            </span>
            {password && <span style={{ color: '#80e080' }}> 🔒 password protected</span>}
          </div>
          )}
          {/* Delegate tab info */}
          {['script','book','mp4'].includes(tab) && (
          <div style={{ background: '#0a1a2a', border: '1px solid #2a4a7a', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#8ab0d0' }}>
            {tab === 'script' && '💾 Click "Export Script" below to save your project as a .mme file via the Save dialog.'}
            {tab === 'book'   && '📖 Click "Export Book" below to bundle the project as an interactive storybook ZIP.'}
            {tab === 'mp4'    && '🎬 Click "Export MP4" below to launch the MP4 video render dialog.'}
          </div>
          )}

          {/* Inline error display */}
          {errorMsg && (
            <div style={{ background: '#2a0a0a', border: '1px solid #7a1a1a', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#ff8080' }}>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', background: '#0a1a2a', borderTop: '1px solid #2a4a7a', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          {busy && <span style={{ fontSize: 12, color: '#8ab0d0', marginRight: 'auto' }}>⏳ {progress}</span>}
          <button style={{ ...btnStyle, background: '#1a2a3a', color: '#6080a0' }} onClick={onClose} disabled={busy}>Cancel</button>
          <button
            style={{ ...btnStyle, background: busy ? '#1a3a1a' : 'linear-gradient(180deg,#2060c0 0%,#1040a0 100%)', color: '#fff', fontWeight: 700, minWidth: 120, opacity: busy ? 0.7 : 1 }}
            onClick={doPublish}
            disabled={busy || filteredPages.length === 0}
          >
            {busy ? '⏳ Publishing…' : tab === 'script' ? '💾 Export Script' : tab === 'book' ? '📖 Export Book' : tab === 'mp4' ? '🎬 Export MP4' : `📤 Publish ${currentTab.label}`}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const fsStyle = {
  border: '1px solid #2a4a7a', borderRadius: 6, padding: '10px 14px', margin: 0,
}
const legendStyle = {
  color: '#6090c0', fontSize: 12, fontWeight: 600, padding: '0 4px',
}
const labelStyle = {
  display: 'block', fontSize: 11, color: '#6080a0', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const inputStyle = {
  width: '100%', padding: '7px 10px', fontSize: 13, background: '#0d1f35',
  border: '1px solid #2a4a7a', borderRadius: 4, color: '#e0d0a0', outline: 'none',
  boxSizing: 'border-box',
}
const btnStyle = {
  padding: '7px 16px', fontSize: 13, border: '1px solid #4a8fc0', borderRadius: 4,
  cursor: 'pointer', color: '#e8a020', background: '#1a3a6c',
}
