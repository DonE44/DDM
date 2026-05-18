/**
 * ImportPagesDialog.jsx — Import pages from a .mme / .sca project file.
 *
 * Props:
 *   importedData  { pages, stage, projectVars } — already-parsed import data
 *   onImport      (selectedPages: object[]) => void
 *   onCancel      () => void
 */

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function ImportPagesDialog({ importedData, onImport, onCancel }) {
  const { pages = [], stage = {} } = importedData
  const [selected, setSelected] = useState(() => new Set(pages.map((_, i) => i)))
  const [insertAfter, setInsertAfter] = useState('end')   // 'end' | number

  const toggle = useCallback((idx) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selected.size === pages.length) setSelected(new Set())
    else setSelected(new Set(pages.map((_, i) => i)))
  }, [selected.size, pages])

  const doImport = useCallback(() => {
    const sel = pages.filter((_, i) => selected.has(i))
    onImport(sel, insertAfter)
  }, [pages, selected, insertAfter, onImport])

  const content = (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-box"
        style={{ maxWidth: 580, width: '92vw', padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '12px 18px' }}>
          <span style={{ fontWeight: 700, color: '#e8a020' }}>📥 Import Pages from Project</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        {/* Stage info */}
        <div style={{ padding: '8px 18px', background: '#0f1e30', borderBottom: '1px solid #1a2e50', fontSize: 12, color: '#6090c0' }}>
          Imported project: <strong style={{ color: '#8ab0d0' }}>{pages.length} page{pages.length !== 1 ? 's' : ''}</strong>
          {stage.width ? <span> — stage {stage.width} × {stage.height}</span> : null}
        </div>

        {/* Page list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 12, color: '#e0d0a0', fontWeight: 600 }}>
              <input type="checkbox" checked={selected.size === pages.length} onChange={toggleAll} />
              Select all
            </label>
            <span style={{ fontSize: 11, color: '#4a6a8a' }}>{selected.size} of {pages.length} selected</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {pages.map((pg, i) => {
              const elCount = (pg.elements || []).length
              const hasMedia = (pg.elements || []).some(e => e.type === 'clip' || e.type === 'mpeg')
              const isSel = selected.has(i)
              return (
                <label
                  key={i}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer',
                    padding: '8px 12px', borderRadius: 6,
                    background: isSel ? '#162a4a' : '#0d1f35',
                    border: '1px solid ' + (isSel ? '#3a6fac' : '#1a2e50'),
                    color: isSel ? '#e0d0a0' : '#5a7090',
                  }}
                >
                  <input type="checkbox" checked={isSel} onChange={() => toggle(i)} style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 28, fontSize: 12, color: '#4a7aac', fontWeight: 700 }}>{i + 1}.</span>
                  <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pg.name || `Page ${i + 1}`}
                  </span>
                  <span style={{ display: 'flex', gap: 6, flexShrink: 0, fontSize: 11, color: '#4a6a8a' }}>
                    {elCount > 0 && <span title="Elements">{elCount} el</span>}
                    {hasMedia && <span title="Has media">🎞</span>}
                    {pg.timing?.mode === 'timed' && <span title={`Timed: ${pg.timing.duration}s`}>⏱ {pg.timing.duration}s</span>}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Insert position */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #1a2e50', background: '#0a1a2a' }}>
          <label style={{ fontSize: 12, color: '#6090c0', fontWeight: 600, display: 'block', marginBottom: 6 }}>Insert position:</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { value: 'end', label: 'Append at end' },
              { value: 'start', label: 'Insert at beginning' },
              { value: 'after-current', label: 'After current page' },
            ].map(opt => (
              <label key={opt.value} style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', fontSize: 12, color: insertAfter === opt.value ? '#e8a020' : '#6080a0' }}>
                <input type="radio" name="insert-pos" value={opt.value} checked={insertAfter === opt.value} onChange={() => setInsertAfter(opt.value)} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #2a4a7a', background: '#0a1a2a', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            style={{ padding: '7px 14px', fontSize: 13, border: '1px solid #2a4a7a', borderRadius: 4, cursor: 'pointer', background: '#1a2a3a', color: '#6080a0' }}
            onClick={onCancel}
          >Cancel</button>
          <button
            style={{ padding: '7px 18px', fontSize: 13, fontWeight: 700, border: '1px solid #4a8fc0', borderRadius: 4, cursor: 'pointer', background: 'linear-gradient(180deg,#2060c0 0%,#1040a0 100%)', color: '#fff', opacity: selected.size === 0 ? 0.5 : 1 }}
            onClick={doImport}
            disabled={selected.size === 0}
          >
            📥 Import {selected.size} Page{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
