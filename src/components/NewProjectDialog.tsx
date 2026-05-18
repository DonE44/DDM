import { useState } from 'react'
import { PROJECT_TEMPLATES } from '../constants/index.js'

/* ─── New Project Dialog ─────────────────────────────────────────────────── */
export default function NewProjectDialog({ hasUnsaved, onApply, onCancel, onSaveFirst }) {
  const [phase, setPhase] = useState(hasUnsaved ? 'save' : 'templates')
  const [selCat, setSelCat] = useState('All')

  const cats = ['All', ...Array.from(new Set(PROJECT_TEMPLATES.map(t => t.cat)))]
  const visible = selCat === 'All' ? PROJECT_TEMPLATES : PROJECT_TEMPLATES.filter(t => t.cat === selCat)

  if (phase === 'save') {
    return (
      <div className="newproj-overlay">
        <div className="newproj-modal newproj-save-prompt">
          <div className="newproj-header">
            <span>⚠ Unsaved Project</span>
          </div>
          <div className="newproj-save-body">
            <p>Your current project has content that may not be saved.<br/>What would you like to do?</p>
          </div>
          <div className="newproj-footer">
            <button onClick={onCancel}>Cancel</button>
            <button onClick={() => setPhase('templates')}>Don't Save</button>
            <button className="newproj-confirm" onClick={async () => {
              const ok = await onSaveFirst()
              if (ok !== false) setPhase('templates')
            }}>Save First…</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="newproj-overlay">
      <div className="newproj-modal">
        <div className="newproj-header">
          <span>✦ New Project — Choose a Template</span>
          <button className="newproj-close" onClick={onCancel}>✕</button>
        </div>

        <div className="newproj-cats">
          {cats.map(c => (
            <button key={c} className={'newproj-cat' + (selCat === c ? ' on' : '')} onClick={() => setSelCat(c)}>{c}</button>
          ))}
        </div>

        <div className="newproj-grid">
          {visible.map(t => (
            <button key={t.id} className="newproj-card" onClick={() => onApply(t.id)}>
              <div className="newproj-card-icon">{t.icon}</div>
              <div className="newproj-card-label">{t.label}</div>
              <div className="newproj-card-cat">{t.cat}</div>
              <div className="newproj-card-desc">{t.desc}</div>
            </button>
          ))}
        </div>

        <div className="newproj-footer">
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
