import { type ChangeEvent, useRef, useState } from 'react'

export default function MediaResolveDialog({ state, desktopApi, onApply, onDismiss }) {
  const { unresolvedEls, resolvedPages } = state
  const [phase, setPhase] = useState('pick') // 'pick' | 'scanning' | 'preview' | 'applying'
  const [folderLabel, setFolderLabel] = useState('')
  const [, setFileMap] = useState(null)
  const [matches, setMatches] = useState([])
  const [unmatched, setUnmatched] = useState([])
  const [applyProgress, setApplyProgress] = useState(0)
  const internalFolderRef = useRef(null)

  const needed = [...new Set(unresolvedEls.map((u: {filename?: string}) => (u.filename || '').toLowerCase()).filter(Boolean))] as string[]

  function buildMatches(fmap) {
    const matched = [], miss = []
    for (const u of unresolvedEls) {
      const key = (u.filename || '').toLowerCase()
      if (key && fmap.has(key)) matched.push({ unresEl: u, entry: fmap.get(key) })
      else miss.push(u)
    }
    setMatches(matched)
    setUnmatched(miss)
  }

  function onFolderInputChange(ev: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files || [])
    if (!files.length) return
    const label = files[0].webkitRelativePath?.split('/')[0] || 'selected folder'
    setFolderLabel(label)
    const fmap = new Map()
    for (const f of files) {
      fmap.set(f.name.toLowerCase(), { name: f.name, file: f })
    }
    setFileMap(fmap)
    buildMatches(fmap)
    setPhase('preview')
    ev.target.value = ''
  }

  async function onPickFolderDesktop() {
    if (!desktopApi?.selectFolder) return
    setPhase('scanning')
    try {
      const res = await desktopApi.selectFolder()
      if (res?.canceled) { setPhase('pick'); return }
      setFolderLabel(res.folderPath)
      const listed = await desktopApi.listFolderFiles({ folderPath: res.folderPath })
      if (!listed?.ok) { setPhase('pick'); return }
      const fmap = new Map()
      for (const f of (listed.files || [])) {
        fmap.set(f.name.toLowerCase(), { name: f.name, path: f.path })
      }
      setFileMap(fmap)
      buildMatches(fmap)
      setPhase('preview')
    } catch { setPhase('pick') }
  }

  async function applyMatches() {
    setPhase('applying')
    setApplyProgress(0)
    let updatedPages = resolvedPages.map(pg => ({ ...pg, elements: [...pg.elements] }))
    const total = matches.length

    for (let i = 0; i < matches.length; i++) {
      const { unresEl, entry } = matches[i]
      try {
        let fileUrl = ''
        if (entry.file) {
          fileUrl = await new Promise((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(String(reader.result || ''))
            reader.onerror = () => rej(reader.error)
            reader.readAsDataURL(entry.file)
          })
        } else if (entry.path && desktopApi?.readMediaDataUrl) {
          const kind = entry.name.match(/\.(mp4|webm|avi|mov|mkv|mpeg|mpg|flc|fli)/i) ? 'video'
            : entry.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|opus|mid|midi)/i) ? 'audio' : 'image'
          const loaded = await desktopApi.readMediaDataUrl({ filePath: entry.path, category: kind })
          if (loaded?.ok && loaded.dataUrl) fileUrl = loaded.dataUrl
          else fileUrl = entry.path
        }

        if (fileUrl) {
          const pg = updatedPages[unresEl.pageIdx]
          if (!pg) {
            continue
          }
          if (unresEl.field === 'bgMedia') {
            const mediaName = entry.name || unresEl.filename || ''
            const mediaKind = mediaName.match(/\.(mp4|webm|avi|mov|mkv|mpeg|mpg|flc|fli)$/i)
              ? 'video'
              : mediaName.match(/\.(mp3|wav|ogg|flac|aac|m4a|opus|mid|midi)$/i)
                ? 'audio'
                : 'image'
            updatedPages[unresEl.pageIdx] = {
              ...pg,
              bgMediaSrc: fileUrl,
              bgImage: fileUrl,
              bgMediaName: mediaName,
              bgMediaKind: mediaKind,
              bgMediaSourcePath: entry.path || pg.bgMediaSourcePath || '',
            }
            continue
          }

          const el = pg.elements[unresEl.elIdx]
          if (!el) {
            continue
          }

          if (unresEl.field === 'btnImage') {
            // Image-backed button — patch btnImage (and clear any unresolved btnImageSourcePath)
            pg.elements[unresEl.elIdx] = {
              ...el,
              btnImage: fileUrl,
              btnImageSourcePath: entry.path || el.btnImageSourcePath,
            }
          } else {
            pg.elements[unresEl.elIdx] = {
              ...el,
              file: fileUrl,
              mediaSourcePath: entry.path || el.mediaSourcePath,
            }
          }
        }
      } catch { /* skip this file */ }
      setApplyProgress(Math.round(((i + 1) / total) * 100))
    }

    onApply(updatedPages)
  }

  const hasMismatch = unmatched.length > 0
  const canApply = phase === 'preview' && matches.length > 0

  return (
    <div className="media-resolver-overlay" onClick={e => { if (e.target === e.currentTarget) onDismiss() }}>
      <div className="media-resolver-dialog">
        <div className="media-resolver-header">
          <span className="media-resolver-icon">🔍</span>
          <div>
            <div className="media-resolver-title">Resolve Missing Media</div>
            <div className="media-resolver-sub">{unresolvedEls.length} file{unresolvedEls.length !== 1 ? 's' : ''} referenced in .SCA but not found — locate the artwork folder</div>
          </div>
          <button className="media-resolver-close" onClick={onDismiss} title="Dismiss (media will appear as placeholders)">✕</button>
        </div>

        {phase === 'pick' && (
          <div className="media-resolver-body">
            <div className="media-resolver-missing-list">
              <div className="media-resolver-section-label">📋 Missing files ({needed.length} unique):</div>
              <div className="media-resolver-file-chips">
                {needed.slice(0, 30).map(n => <span key={n} className="media-resolver-chip">{n}</span>)}
                {needed.length > 30 && <span className="media-resolver-chip media-resolver-chip-more">+{needed.length - 30} more…</span>}
              </div>
            </div>
            <div className="media-resolver-pick-row">
              <div className="media-resolver-pick-hint">Select the folder containing the artwork/media files. FluxAura Studio will match filenames automatically.</div>
              {desktopApi?.selectFolder ? (
                <button className="media-resolver-pick-btn" onClick={onPickFolderDesktop}>
                  📂 Browse for Folder…
                </button>
              ) : (
                <>
                  <button className="media-resolver-pick-btn" onClick={() => internalFolderRef.current?.click()}>
                    📂 Browse for Folder…
                  </button>
                  <input
                    ref={internalFolderRef}
                    type="file"
                    webkitdirectory="true"
                    multiple
                    hidden
                    onChange={onFolderInputChange}
                    accept="image/*,audio/*,video/*,.bmp,.gif,.png,.jpg,.jpeg,.wav,.mp3,.mp4,.avi,.flc,.fli"
                  />
                </>
              )}
            </div>
          </div>
        )}

        {phase === 'scanning' && (
          <div className="media-resolver-body media-resolver-scanning">
            <div className="media-resolver-spinner">⏳</div>
            <div>Scanning folder…</div>
          </div>
        )}

        {phase === 'preview' && (
          <div className="media-resolver-body">
            <div className="media-resolver-folder-label">📁 {folderLabel}</div>
            <div className="media-resolver-results">
              <div className="media-resolver-matched">
                <div className="media-resolver-section-label">✅ Matched ({matches.length} files):</div>
                <div className="media-resolver-file-chips">
                  {matches.slice(0, 20).map(({ unresEl, entry }) => (
                    <span key={unresEl.fullRef} className="media-resolver-chip media-resolver-chip-ok" title={entry.path || entry.name}>
                      {unresEl.filename}
                    </span>
                  ))}
                  {matches.length > 20 && <span className="media-resolver-chip media-resolver-chip-more">+{matches.length - 20} more</span>}
                </div>
              </div>
              {hasMismatch && (
                <div className="media-resolver-unmatched">
                  <div className="media-resolver-section-label">❌ Not found ({unmatched.length} files):</div>
                  <div className="media-resolver-file-chips">
                    {unmatched.slice(0, 10).map(u => (
                      <span key={u.fullRef} className="media-resolver-chip media-resolver-chip-miss">{u.filename}</span>
                    ))}
                    {unmatched.length > 10 && <span className="media-resolver-chip media-resolver-chip-more">+{unmatched.length - 10} more</span>}
                  </div>
                </div>
              )}
            </div>
            <div className="media-resolver-actions">
              <button className="media-resolver-back" onClick={() => setPhase('pick')}>← Pick different folder</button>
              <button className="media-resolver-apply" onClick={applyMatches} disabled={!canApply}>
                ✅ Load {matches.length} matched file{matches.length !== 1 ? 's' : ''}
                {hasMismatch ? ` (${unmatched.length} will remain as placeholders)` : ''}
              </button>
            </div>
          </div>
        )}

        {phase === 'applying' && (
          <div className="media-resolver-body media-resolver-scanning">
            <div className="media-resolver-spinner">📥</div>
            <div>Loading media… {applyProgress}%</div>
            <div className="media-resolver-progress-bar">
              <div className="media-resolver-progress-fill" style={{ width: `${applyProgress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
