import React, { useRef, useState } from 'react'
import SmartColorPicker from '../components/SmartColorPicker.tsx'
import { uid } from '../utils/stageUtils.js'

// ──────────────────────────────────────────────────────────────
// Shared wipe/animation option lists (used by InteractionEditor)
// ──────────────────────────────────────────────────────────────
const IAE_WIPE_IN_OPTIONS = [
  { key: 'none', label: '— None (instant) —' },
  { key: 'fade', label: '✨ Fade In' },
  { key: 'cut',  label: '✂ Cut' },
  { key: 'smm-fly-left',   label: '← Fly from Left' },
  { key: 'smm-fly-right',  label: '→ Fly from Right' },
  { key: 'smm-fly-top',    label: '↑ Fly from Top' },
  { key: 'smm-fly-bottom', label: '↓ Fly from Bottom' },
  { key: 'smm-zoom-in',    label: '🔍 Zoom In' },
  { key: 'smm-zoom-big',   label: '🔎 Zoom from Big' },
  { key: 'smm-spiral-in',  label: '🌀 Spiral In' },
  { key: 'smm-bounce-in',  label: '🏀 Bounce In' },
  { key: 'smm-flip-x',     label: '↕ Flip (3D Vert)' },
  { key: 'smm-flip-y',     label: '↔ Flip (3D Horiz)' },
  { key: 'smm-rotate-in',  label: '🔄 Rotate In' },
  { key: 'smm-drop-in',    label: '⬇ Drop + Bounce' },
  { key: 'PageFlip',        label: '📖 Page Flip' },
  { key: 'Wipe',            label: '▶ Wipe' },
  { key: 'ZoomUp',          label: '🔭 Zoom Up' },
  { key: 'SpiralIris',      label: '🌀 Spiral Iris' },
  { key: 'Vortex',          label: '🌀 Vortex' },
  { key: 'BouncingBlinds',  label: '🎪 Bouncing Blinds' },
  { key: 'Cascade',         label: '🌊 Cascade' },
]
const IAE_WIPE_OUT_OPTIONS = [
  { key: 'none', label: '— None (instant) —' },
  { key: 'fade', label: '✨ Fade Out' },
  { key: 'cut',  label: '✂ Cut' },
  { key: 'smm-fly-left-out',   label: '← Fly to Left' },
  { key: 'smm-fly-right-out',  label: '→ Fly to Right' },
  { key: 'smm-fly-top-out',    label: '↑ Fly to Top' },
  { key: 'smm-fly-bottom-out', label: '↓ Fly to Bottom' },
  { key: 'smm-zoom-out',       label: '🔍 Zoom Out' },
  { key: 'smm-zoom-big-out',   label: '🔎 Zoom to Big' },
  { key: 'smm-spiral-out',     label: '🌀 Spiral Out' },
  { key: 'smm-flip-x-out',     label: '↕ Flip Out (3D)' },
  { key: 'smm-rotate-out',     label: '🔄 Rotate Out' },
  { key: 'smm-fade-out',       label: '✨ Fade Out (anim)' },
  { key: 'Wipe',               label: '▶ Wipe Out' },
  { key: 'Vortex',             label: '🌀 Vortex Out' },
]

// ──────────────────────────────────────────────────────────────
// InteractionEditor — floating modal for universal element interaction
// ──────────────────────────────────────────────────────────────
const INTERACT_ACTIONS = [
  { key: 'goto-next',     label: '▶ Next page',          icon: '▶', hasTarget: false },
  { key: 'goto-prev',     label: '◀ Previous page',      icon: '◀', hasTarget: false },
  { key: 'goto-page',     label: '↗ Go to page…',        icon: '↗', hasTarget: 'page' },
  { key: 'goto-element',  label: '🔗 Go to element…',    icon: '🔗', hasTarget: 'element' },
  { key: 'hyperlink',     label: '🌐 Open URL…',         icon: '🌐', hasTarget: 'url' },
  { key: 'play-media',    label: '▶ Play media file…',  icon: '▶', hasTarget: 'media' },
  { key: 'stop-media',    label: '⏹ Stop all media',    icon: '⏹', hasTarget: false },
  { key: 'set-var',       label: '📝 Set variable…',    icon: '📝', hasTarget: 'var' },
  { key: 'wait',          label: '⏱ Wait (ms)…',        icon: '⏱', hasTarget: 'wait' },
  { key: 'show-element',  label: '👁 Show element…',    icon: '👁', hasTarget: 'element' },
  { key: 'hide-element',  label: '🙈 Hide element…',    icon: '🙈', hasTarget: 'element' },
  { key: 'if-then',       label: '🔀 IF condition…',    icon: '🔀', hasTarget: 'if' },
  { key: 'loop-back',     label: '🔁 Loop to start',    icon: '🔁', hasTarget: false },
  { key: 'quit',          label: '✖ Exit presentation', icon: '✖', hasTarget: false },
  { key: 'script',        label: '⚡ Run script…',       icon: '⚡', hasTarget: 'script' },
]

function msToTimecode(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const mm = ms % 1000
  return `${h.toString().padStart(2,'0')}H:${m.toString().padStart(2,'0')}M:${s.toString().padStart(2,'0')}S:${mm.toString().padStart(3,'0')}MS`
}

function ActionStepEditor({ step, idx, pages, projectVars, elements: _elements, onChange, onDelete, onMoveUp, onMoveDown }) {
  const def = INTERACT_ACTIONS.find(a => a.key === step.action) || INTERACT_ACTIONS[0]
  return (
    <div className="iae-step">
      <div className="iae-step-header">
        <span className="iae-step-num">{idx + 1}</span>
        <select
          className="iae-step-action-sel"
          value={step.action || 'goto-next'}
          onChange={(e) => onChange({ ...step, action: e.target.value, target: '', targetVal: '' })}
        >
          {INTERACT_ACTIONS.map(a => (
            <option key={a.key} value={a.key}>{a.icon} {a.label.replace('…','')}</option>
          ))}
        </select>
        <div className="iae-step-btns">
          <button title="Move up" onClick={onMoveUp}>↑</button>
          <button title="Move down" onClick={onMoveDown}>↓</button>
          <button title="Delete step" className="iae-step-del" onClick={onDelete}>✕</button>
        </div>
      </div>
      {/* Target inputs based on action type */}
      {def.hasTarget === 'page' && (
        <select className="iae-step-target" value={step.target || ''} onChange={(e) => onChange({ ...step, target: e.target.value })}>
          <option value="">— choose page —</option>
          {pages.map((pg, i) => <option key={pg.id} value={pg.id}>{i + 1}. {pg.name}</option>)}
        </select>
      )}
      {def.hasTarget === 'element' && (
        <input className="iae-step-target" placeholder="Element label name…" value={step.target || ''} onChange={(e) => onChange({ ...step, target: e.target.value })} />
      )}
      {def.hasTarget === 'url' && (
        <input className="iae-step-target" type="url" placeholder="https://…" value={step.target || ''} onChange={(e) => onChange({ ...step, target: e.target.value })} />
      )}
      {def.hasTarget === 'media' && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input className="iae-step-target" style={{ flex: 1 }} placeholder="Media file path or URL…" value={step.target || ''} onChange={(e) => onChange({ ...step, target: e.target.value })} />
          <button
            style={{ fontSize: 10, padding: '3px 8px', background: 'var(--bg4)', border: '1px solid var(--bg5)', color: 'var(--t1)', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={async () => {
              if (window.smmDesktop?.selectMedia) {
                const r = await window.smmDesktop.selectMedia({ category: 'all' }).catch(() => null)
                if (r?.filePath) onChange({ ...step, target: r.filePath })
              }
            }}
          >📁 Browse</button>
        </div>
      )}
      {def.hasTarget === 'var' && (
        <div className="iae-step-var-row">
          <select className="iae-step-varname" value={step.target || ''} onChange={(e) => onChange({ ...step, target: e.target.value })}>
            <option value="">— pick variable —</option>
            {(projectVars || []).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
            <option value="__custom__">✏ Type name…</option>
          </select>
          {step.target === '__custom__' && (
            <input className="iae-step-target" placeholder="Variable name…" value={step.customTarget || ''} onChange={(e) => onChange({ ...step, customTarget: e.target.value })} />
          )}
          <span className="iae-step-eq">=</span>
          <input className="iae-step-varval" placeholder="value" value={step.targetVal || ''} onChange={(e) => onChange({ ...step, targetVal: e.target.value })} />
        </div>
      )}
      {def.hasTarget === 'wait' && (
        <div className="iae-step-wait-row">
          <input className="iae-step-target" type="number" min={0} max={60000} step={100} placeholder="1000" value={step.target || ''} onChange={(e) => onChange({ ...step, target: e.target.value })} />
          <span className="iae-step-unit">ms</span>
        </div>
      )}
      {def.hasTarget === 'if' && (
        <div className="iae-step-if-block">
          <div className="iae-step-if-row">
            <span className="iae-step-kw">IF</span>
            <select className="iae-step-varname" value={step.ifVar || ''} onChange={(e) => onChange({ ...step, ifVar: e.target.value })}>
              <option value="">— variable —</option>
              {(projectVars || []).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
            <select className="iae-step-op" value={step.ifOp || '=='} onChange={(e) => onChange({ ...step, ifOp: e.target.value })}>
              <option value="==">==</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="contains">contains</option>
            </select>
            <input className="iae-step-varval" placeholder="value" value={step.ifVal || ''} onChange={(e) => onChange({ ...step, ifVal: e.target.value })} />
          </div>
          <div className="iae-step-if-row">
            <span className="iae-step-kw">THEN</span>
            <select className="iae-step-action-sel" value={step.thenAction || 'goto-next'} onChange={(e) => onChange({ ...step, thenAction: e.target.value })}>
              {INTERACT_ACTIONS.filter(a => a.key !== 'if-then').map(a => <option key={a.key} value={a.key}>{a.icon} {a.label.replace('…','')}</option>)}
            </select>
            {(INTERACT_ACTIONS.find(a => a.key === step.thenAction)?.hasTarget === 'page') && (
              <select className="iae-step-target" value={step.thenTarget || ''} onChange={(e) => onChange({ ...step, thenTarget: e.target.value })}>
                <option value="">— page —</option>
                {pages.map((pg, i) => <option key={pg.id} value={pg.name}>{i + 1}. {pg.name}</option>)}
              </select>
            )}
            {(INTERACT_ACTIONS.find(a => a.key === step.thenAction)?.hasTarget !== 'page' && INTERACT_ACTIONS.find(a => a.key === step.thenAction)?.hasTarget) && (
              <input className="iae-step-target" placeholder="target…" value={step.thenTarget || ''} onChange={(e) => onChange({ ...step, thenTarget: e.target.value })} />
            )}
          </div>
          <div className="iae-step-if-row">
            <span className="iae-step-kw">ELSE</span>
            <select className="iae-step-action-sel" value={step.elseAction || 'goto-next'} onChange={(e) => onChange({ ...step, elseAction: e.target.value })}>
              {INTERACT_ACTIONS.filter(a => a.key !== 'if-then').map(a => <option key={a.key} value={a.key}>{a.icon} {a.label.replace('…','')}</option>)}
            </select>
            {(INTERACT_ACTIONS.find(a => a.key === step.elseAction)?.hasTarget === 'page') && (
              <select className="iae-step-target" value={step.elseTarget || ''} onChange={(e) => onChange({ ...step, elseTarget: e.target.value })}>
                <option value="">— page —</option>
                {pages.map((pg, i) => <option key={pg.id} value={pg.name}>{i + 1}. {pg.name}</option>)}
              </select>
            )}
            {(INTERACT_ACTIONS.find(a => a.key === step.elseAction)?.hasTarget !== 'page' && INTERACT_ACTIONS.find(a => a.key === step.elseAction)?.hasTarget) && (
              <input className="iae-step-target" placeholder="target…" value={step.elseTarget || ''} onChange={(e) => onChange({ ...step, elseTarget: e.target.value })} />
            )}
          </div>
        </div>
      )}
      {def.hasTarget === 'script' && (
        <textarea className="iae-step-script" rows={3} placeholder="// JavaScript…&#10;navigate('Page 2')" value={step.target || ''} onChange={(e) => onChange({ ...step, target: e.target.value })} />
      )}
    </div>
  )
}

export default function InteractionEditor({ el, pages, projectVars, onUpdate, onClose }) {
  const [tab, setTab] = useState('states')

  // Hidden file-input refs for browser fallback (no Electron desktop API)
  const hoverSoundInputRef = useRef(null)
  const hoverMediaInputRef = useRef(null)
  const clickSoundInputRef = useRef(null)
  const clickMediaInputRef = useRef(null)

  // Unified file picker: uses Electron API when available, falls back to hidden <input>
  async function pickFile(category: string, inputRef: React.RefObject<HTMLInputElement>): Promise<{ url: string; name: string } | null> {
    if (window.smmDesktop?.selectMedia) {
      const r = await window.smmDesktop.selectMedia({ category }).catch(() => null)
      if (!r || r.canceled) return null
      return { url: r.filePath, name: r.fileName }
    }
    // Browser fallback — trigger hidden file input
    return new Promise((resolve) => {
      const input = inputRef?.current
      if (!input) { resolve(null); return }
      const onchange = (e) => {
        input.removeEventListener('change', onchange)
        const f = e.target.files?.[0]
        if (!f) { resolve(null); return }
        resolve({ url: URL.createObjectURL(f), name: f.name })
        e.target.value = ''
      }
      input.addEventListener('change', onchange)
      input.click()
    })
  }

  // Auto-enable interactive when hover/click media is configured
  function setMediaField(updates) {
    const hasInteraction = !!(
      updates.hoverMediaFile || updates.hoverSoundFile || updates.clickMediaFile || updates.clickSoundFile ||
      el.hoverMediaFile || el.hoverSoundFile || el.clickMediaFile || el.clickSoundFile
    )
    onUpdate({ ...updates, ...(hasInteraction ? { interactive: true } : {}) })
  }

  const chain = el.actionChain || []
  const elseChain = el.ifCondElse || []

  function updateChain(newChain) { onUpdate({ actionChain: newChain }) }
  function addStep() {
    updateChain([...chain, { id: uid(), action: 'goto-next', target: '', targetVal: '' }])
  }
  function updateStep(idx, step) {
    updateChain(chain.map((s, i) => i === idx ? step : s))
  }
  function deleteStep(idx) { updateChain(chain.filter((_, i) => i !== idx)) }
  function moveStep(idx, dir) {
    const c = [...chain]
    const swap = idx + dir
    if (swap < 0 || swap >= c.length) return
    ;[c[idx], c[swap]] = [c[swap], c[idx]]
    updateChain(c)
  }

  // Collect element labels for goto-element
  const allElements = pages.flatMap(pg => pg.elements || []).filter(e => e.elLabel)

  // Derived: is this element acting as a button?
  const isButton = !!(el.interactive || el.hoverMediaFile || el.hoverSoundFile || el.clickMediaFile || el.clickSoundFile || el.actionChain?.length)

  return (
    <div className="iae-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="iae-modal">
        <div className="iae-header">
          <span className="iae-title">🖱 Interaction Editor</span>
          <span className="iae-subtitle">{el.elLabel || el.type?.toUpperCase() || 'Element'}</span>
          <button className="iae-close" onClick={onClose}>✕</button>
        </div>

        {/* Make Button toggle — prominent header row */}
        <div className="iae-make-btn-row">
          <label className={`iae-make-btn-toggle${isButton ? ' on' : ''}`}>
            <input type="checkbox" checked={isButton}
              onChange={(e) => onUpdate({ interactive: e.target.checked })} />
            <span className="iae-make-btn-icon">{isButton ? '🔘' : '⭕'}</span>
            <span className="iae-make-btn-label">{isButton ? 'BUTTON MODE ON' : 'Make Button'}</span>
          </label>
          {isButton && (
            <label className="iae-enable-label" style={{ marginLeft: 12 }}>
              <input type="checkbox" checked={!!el.waitOnClick} onChange={(e) => onUpdate({ waitOnClick: e.target.checked })} />
              <span>⏸ Wait on click</span>
            </label>
          )}
        </div>

        {/* Tabs */}
        <div className="iae-tabs">
          {[
            { key: 'states',    label: '🎭 States' },
            { key: 'actions',   label: '⚡ Actions' },
            { key: 'wipes',     label: '⏱ Wipes & Timing' },
            { key: 'condition', label: '🔀 Condition' },
          ].map(t => (
            <button key={t.key} className={`iae-tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        <div className="iae-body">
          {/* ── STATES tab ── */}
          {tab === 'states' && (
            <div className="iae-section">

              {/* NORMAL state */}
              <div className="iae-state-header iae-state-normal">⬜ NORMAL State</div>
              {el.type === 'clip' ? (
                <>
                  <p className="iae-hint" style={{ marginBottom: 4 }}>
                    Media button idle position — the media is paused here until triggered.
                  </p>
                  <div className="iae-row">
                    <label className="iae-lbl" title="Where the media is paused in the idle/normal state (0 = frame 1 for video)">🎬 Idle pause-at</label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={el.normalStatePauseMs ?? 0}
                      onChange={(e) => onUpdate({ normalStatePauseMs: Math.max(0, Number(e.target.value)) })}
                      style={{ width: 80 }}
                    />
                    <span className="iae-unit">ms</span>
                    <span className="iae-hint" style={{ fontSize: 9, marginLeft: 6 }}>
                      {(el.normalStatePauseMs ?? 0) > 0 ? msToTimecode(el.normalStatePauseMs ?? 0) : '▶ frame 1 / start'}
                    </span>
                  </div>
                  <div className="iae-row">
                    <label className="iae-lbl">▶ Play trigger</label>
                    <select
                      value={el.normalStatePlayTrigger || 'click'}
                      onChange={(e) => onUpdate({ normalStatePlayTrigger: e.target.value })}
                      style={{ flex: 1 }}
                    >
                      <option value="click">🖱 Click</option>
                      <option value="hover">🖱 Hover (mouse over)</option>
                      <option value="auto">⚡ Auto (plays on page enter)</option>
                    </select>
                  </div>
                  <div className="iae-row">
                    <label className="iae-lbl">⏭ Play then goto</label>
                    <input
                      type="checkbox"
                      checked={!!el.normalStatePlayThenGoto}
                      onChange={(e) => onUpdate({ normalStatePlayThenGoto: e.target.checked })}
                    />
                    <span className="iae-hint" style={{ fontSize: 9, marginLeft: 4 }}>let media play to end before firing Actions</span>
                  </div>
                </>
              ) : (
                <p className="iae-hint">Default appearance — configure using the main element inspector. No special media needed.</p>
              )}

              {/* HOVER state */}
              <div className="iae-state-header iae-state-hover" style={{ marginTop: 12 }}>🔵 HOVER State</div>
              <div className="iae-row">
                <label className="iae-lbl">Scale</label>
                <input type="number" min={0.5} max={3} step={0.02} value={el.hoverScale ?? 1.0}
                  onChange={(e) => onUpdate({ hoverScale: parseFloat(e.target.value) || 1 })} style={{ width: 70 }} />
                <span className="iae-unit">× (1.0 = no change)</span>
              </div>
              <div className="iae-row">
                <label className="iae-lbl">Opacity</label>
                <input type="range" min={10} max={100} value={el.hoverOpacity ?? 100}
                  onChange={(e) => onUpdate({ hoverOpacity: Number(e.target.value) })} style={{ flex: 1 }} />
                <span className="iae-unit">{el.hoverOpacity ?? 100}%</span>
              </div>
              <div className="iae-row">
                <label className="iae-lbl">Color tint</label>
                <input type="checkbox" checked={!!el.hoverOverlayOn} onChange={(e) => onUpdate({ hoverOverlayOn: e.target.checked })} />
                {el.hoverOverlayOn && (
                  <SmartColorPicker value={el.hoverColorOverlay || '#ffffff'} onChange={(v) => onUpdate({ hoverColorOverlay: v })} />
                )}
              </div>
              <div className="iae-row">
                <label className="iae-lbl">Hover sound</label>
                <input placeholder="No audio…" value={el.hoverSoundName || ''} readOnly style={{ flex: 1, fontSize: 10 }} />
                <button onClick={async () => {
                  const r = await pickFile('audio', hoverSoundInputRef)
                  if (r) setMediaField({ hoverSoundFile: r.url, hoverSoundName: r.name })
                }}>📁 Browse</button>
                {el.hoverSoundFile && <button onClick={() => onUpdate({ hoverSoundFile: '', hoverSoundName: '' })}>✕</button>}
              </div>
              <div className="iae-row">
                <label className="iae-lbl">Hover media</label>
                <input placeholder="GIF / WebP / MP4 / APNG…" value={el.hoverMediaName || ''} readOnly style={{ flex: 1, fontSize: 10 }} />
                <button onClick={async () => {
                  const r = await pickFile('all', hoverMediaInputRef)
                  if (r) setMediaField({ hoverMediaFile: r.url, hoverMediaName: r.name })
                }}>📁 Browse</button>
                {el.hoverMediaFile && <button onClick={() => onUpdate({ hoverMediaFile: '', hoverMediaName: '' })}>✕</button>}
              </div>
              {el.hoverMediaFile && (
                <>
                  <div className="iae-row">
                    <label className="iae-lbl">Loop</label>
                    <input type="checkbox" checked={el.hoverMediaLoop !== false} onChange={(e) => onUpdate({ hoverMediaLoop: e.target.checked })} />
                    <label className="iae-lbl" style={{ marginLeft: 12 }}>Play count</label>
                    <input type="number" min={0} max={99} value={el.hoverMediaPlayCount ?? 0}
                      onChange={(e) => onUpdate({ hoverMediaPlayCount: Number(e.target.value) })} style={{ width: 50 }} />
                    <span className="iae-unit">0=∞</span>
                  </div>
                  <div className="iae-row">
                    <label className="iae-lbl">▶ From</label>
                    <input type="number" min={0} step={100} value={el.hoverMediaFromMs ?? 0}
                      onChange={(e) => onUpdate({ hoverMediaFromMs: Math.max(0, Number(e.target.value)) })} style={{ width: 65 }} />
                    <span className="iae-unit">ms</span>
                    <label className="iae-lbl" style={{ marginLeft: 8 }}>⏹ To</label>
                    <input type="number" min={0} step={100} value={el.hoverMediaToMs ?? 0}
                      onChange={(e) => onUpdate({ hoverMediaToMs: Math.max(0, Number(e.target.value)) })} style={{ width: 65 }} />
                    <span className="iae-unit">ms (0=end)</span>
                  </div>
                </>
              )}
              <div className="iae-row">
                <label className="iae-lbl">Play media on hover</label>
                <input type="checkbox" checked={!!el.hoverMediaPlay} onChange={(e) => onUpdate({ hoverMediaPlay: e.target.checked })} />
                <span className="iae-hint" style={{ fontSize: 9, marginLeft: 4 }}>starts element's own media when hovered</span>
              </div>
              <div className="iae-row">
                <label className="iae-lbl">📺 Fullscreen on hover</label>
                <input type="checkbox" checked={!!el.hoverFullscreen} onChange={(e) => onUpdate({ hoverFullscreen: e.target.checked })} />
                <span className="iae-hint" style={{ fontSize: 9, marginLeft: 4 }}>opens hover media full-screen lightbox</span>
              </div>

              {/* CLICK / SELECT state */}
              <div className="iae-state-header iae-state-click" style={{ marginTop: 12 }}>🔴 CLICK / SELECT State</div>
              <div className="iae-row">
                <label className="iae-lbl">Press scale</label>
                <input type="number" min={0.5} max={1.5} step={0.01} value={el.clickScale ?? 0.96}
                  onChange={(e) => onUpdate({ clickScale: parseFloat(e.target.value) || 0.96 })} style={{ width: 70 }} />
                <span className="iae-unit">×</span>
              </div>
              <div className="iae-row">
                <label className="iae-lbl">Click sound</label>
                <input placeholder="No audio…" value={el.clickSoundName || ''} readOnly style={{ flex: 1, fontSize: 10 }} />
                <button onClick={async () => {
                  const r = await pickFile('audio', clickSoundInputRef)
                  if (r) setMediaField({ clickSoundFile: r.url, clickSoundName: r.name })
                }}>📁 Browse</button>
                {el.clickSoundFile && <button onClick={() => onUpdate({ clickSoundFile: '', clickSoundName: '' })}>✕</button>}
              </div>
              <div className="iae-row">
                <label className="iae-lbl">Click media</label>
                <input placeholder="GIF / WebP / MP4 / APNG…" value={el.clickMediaName || ''} readOnly style={{ flex: 1, fontSize: 10 }} />
                <button onClick={async () => {
                  const r = await pickFile('all', clickMediaInputRef)
                  if (r) setMediaField({ clickMediaFile: r.url, clickMediaName: r.name })
                }}>📁 Browse</button>
                {el.clickMediaFile && <button onClick={() => onUpdate({ clickMediaFile: '', clickMediaName: '' })}>✕</button>}
              </div>
              {el.clickMediaFile && (
                <>
                  <div className="iae-row">
                    <label className="iae-lbl">Loop</label>
                    <input type="checkbox" checked={!!el.clickMediaLoop} onChange={(e) => onUpdate({ clickMediaLoop: e.target.checked })} />
                    <label className="iae-lbl" style={{ marginLeft: 12 }}>Play count</label>
                    <input type="number" min={1} max={99} value={el.clickMediaPlayCount ?? 1}
                      onChange={(e) => onUpdate({ clickMediaPlayCount: Number(e.target.value) })} style={{ width: 50 }} />
                    <span className="iae-unit">times</span>
                  </div>
                  <div className="iae-row">
                    <label className="iae-lbl">▶ From</label>
                    <input type="number" min={0} step={100} value={el.clickMediaFromMs ?? 0}
                      onChange={(e) => onUpdate({ clickMediaFromMs: Math.max(0, Number(e.target.value)) })} style={{ width: 65 }} />
                    <span className="iae-unit">ms</span>
                    <label className="iae-lbl" style={{ marginLeft: 8 }}>⏹ To</label>
                    <input type="number" min={0} step={100} value={el.clickMediaToMs ?? 0}
                      onChange={(e) => onUpdate({ clickMediaToMs: Math.max(0, Number(e.target.value)) })} style={{ width: 65 }} />
                    <span className="iae-unit">ms (0=end)</span>
                  </div>
                </>
              )}
              <div className="iae-row">
                <label className="iae-lbl">📺 Fullscreen on click</label>
                <input type="checkbox" checked={!!el.clickFullscreen} onChange={(e) => onUpdate({ clickFullscreen: e.target.checked })} />
                <span className="iae-hint" style={{ fontSize: 9, marginLeft: 4 }}>opens click media (or element media) full-screen lightbox</span>
              </div>
              <p className="iae-hint" style={{ marginTop: 6, fontSize: 9 }}>
                💡 Click actions (goto page, play sound, etc.) are set in the <strong>⚡ Actions</strong> tab.
              </p>
            </div>
          )}

          {/* ── ACTIONS tab ── */}
          {tab === 'actions' && (
            <div className="iae-section">
              {/* ── Hotspot: show native action selector so broken page links can be repaired ── */}
              {el.type === 'hotspot' && (
                <div style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(232,160,32,.08)', border: '1px solid rgba(232,160,32,.25)', borderRadius: 5 }}>
                  <div className="iae-section-title" style={{ marginBottom: 6 }}>🔗 Quick Goto Action</div>
                  <div className="iae-row">
                    <label className="iae-lbl">Action</label>
                    <select value={el.action || 'none'} onChange={(e) => onUpdate({ action: e.target.value })} style={{ flex: 1 }}>
                      <option value="none">— none —</option>
                      <option value="next">Next page</option>
                      <option value="prev">Previous page</option>
                      <option value="goto-page">Go to page…</option>
                      <option value="hyperlink">Open URL…</option>
                    </select>
                  </div>
                  {(el.action === 'goto-page') && (
                    <div className="iae-row">
                      <label className="iae-lbl">Page</label>
                      <select
                        value={
                          // Resolve stale gotoPageId: if saved ID no longer matches any current page,
                          // fall back to name-based lookup for backward compat with old saves
                          (el.gotoPageId && pages.some(pg => pg.id === el.gotoPageId))
                            ? el.gotoPageId
                            : (el.gotoPageName ? (pages.find(pg => pg.name === el.gotoPageName)?.id || '') : '')
                        }
                        onChange={(e) => {
                          const p = pages.find(pg => pg.id === e.target.value)
                          onUpdate({ gotoPageId: e.target.value, gotoPageName: p ? p.name : e.target.value })
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">— pick page —</option>
                        {pages.map((p, pi) => (
                          <option key={p.id} value={p.id}>{pi + 1}. {p.name || `Page ${pi + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {(el.action === 'hyperlink') && (
                    <div className="iae-row">
                      <label className="iae-lbl">URL</label>
                      <input value={el.linkTarget || ''} onChange={(e) => onUpdate({ linkTarget: e.target.value })} style={{ flex: 1, fontSize: 10 }} placeholder="https://…" />
                    </div>
                  )}
                  <p className="iae-hint" style={{ fontSize: 9, marginTop: 4 }}>Quick actions fire first (before Action Chain below)</p>
                </div>
              )}
              <div className="iae-section-title">
                Action Chain
                <span className="iae-hint" style={{ fontWeight: 400, marginLeft: 8 }}>runs in order when element is clicked</span>
              </div>
              {chain.length === 0 && (
                <p className="iae-empty">No actions yet. Click + Add Step to build your interaction.</p>
              )}
              {chain.map((step, i) => (
                <ActionStepEditor
                  key={step.id || i}
                  step={step}
                  idx={i}
                  pages={pages}
                  projectVars={projectVars}
                  elements={allElements}
                  onChange={(s) => updateStep(i, s)}
                  onDelete={() => deleteStep(i)}
                  onMoveUp={() => moveStep(i, -1)}
                  onMoveDown={() => moveStep(i, 1)}
                />
              ))}
              <button className="iae-add-step" onClick={addStep}>＋ Add Action Step</button>
              <p className="iae-hint" style={{ marginTop: 8, fontSize: 9 }}>
                💡 Steps execute in order. Use IF-condition to branch. Use WAIT to add delays between steps.
              </p>
            </div>
          )}

          {/* ── WIPES & TIMING tab ── */}
          {tab === 'wipes' && (
            <div className="iae-section">
              <div className="iae-section-title">▶ Entry (Wipe In)</div>
              <div className="iae-row">
                <label className="iae-lbl">Transition</label>
                <select value={el.mediaInTransition || 'none'} onChange={(e) => onUpdate({ mediaInTransition: e.target.value })} style={{ flex: 1 }}>
                  {IAE_WIPE_IN_OPTIONS.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
                </select>
              </div>
              {el.mediaInTransition && el.mediaInTransition !== 'none' && el.mediaInTransition !== 'cut' && (
                <div className="iae-row">
                  <label className="iae-lbl">Duration</label>
                  <input type="number" min={100} max={5000} step={100} value={el.mediaInDuration ?? 500}
                    onChange={(e) => onUpdate({ mediaInDuration: Math.max(100, Number(e.target.value)) })} style={{ width: 80 }} />
                  <span className="iae-unit">ms</span>
                </div>
              )}
              <div className="iae-row">
                <label className="iae-lbl">Entry delay</label>
                <input type="number" min={0} max={60000} step={100} value={el.mediaEntryDelay ?? 0}
                  onChange={(e) => onUpdate({ mediaEntryDelay: Math.max(0, Number(e.target.value)) })} style={{ width: 80 }} />
                <span className="iae-unit">ms after page loads</span>
              </div>

              <div className="iae-section-title" style={{ marginTop: 12 }}>◀ Exit (Wipe Out)</div>
              <div className="iae-row">
                <label className="iae-lbl">Transition</label>
                <select value={el.mediaOutTransition || 'none'} onChange={(e) => onUpdate({ mediaOutTransition: e.target.value })} style={{ flex: 1 }}>
                  {IAE_WIPE_OUT_OPTIONS.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
                </select>
              </div>
              {el.mediaOutTransition && el.mediaOutTransition !== 'none' && el.mediaOutTransition !== 'cut' && (
                <div className="iae-row">
                  <label className="iae-lbl">Duration</label>
                  <input type="number" min={100} max={5000} step={100} value={el.mediaOutDuration ?? 500}
                    onChange={(e) => onUpdate({ mediaOutDuration: Math.max(100, Number(e.target.value)) })} style={{ width: 80 }} />
                  <span className="iae-unit">ms</span>
                </div>
              )}

              <div className="iae-section-title" style={{ marginTop: 12 }}>⏱ Display Timing</div>
              <div className="iae-row">
                <label className="iae-lbl">Display duration</label>
                <input type="number" min={0} max={3600} step={0.5} value={el.mediaDisplayDuration ?? 0}
                  onChange={(e) => onUpdate({ mediaDisplayDuration: Math.max(0, Number(e.target.value)) })} style={{ width: 80 }} />
                <span className="iae-unit">s (0 = no auto-hide)</span>
              </div>
              <p className="iae-hint" style={{ marginTop: 8, fontSize: 9 }}>
                💡 Entry/exit wipes play when the element enters or leaves the page. Use delay to stagger multiple elements.
              </p>
            </div>
          )}

          {/* ── CONDITION tab ── */}
          {tab === 'condition' && (
            <div className="iae-section">
              <div className="iae-section-title">Condition Gate</div>
              <p className="iae-hint">If set, this condition is tested before running the Action Chain.</p>
              <div className="iae-row" style={{ gap: 4 }}>
                <span className="iae-step-kw">IF</span>
                <select value={el.ifCondVar || ''} onChange={(e) => onUpdate({ ifCondVar: e.target.value })} style={{ flex: 1 }}>
                  <option value="">— no condition (always run) —</option>
                  {(projectVars || []).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
                <select value={el.ifCondOp || '=='} onChange={(e) => onUpdate({ ifCondOp: e.target.value })} style={{ width: 60 }}>
                  <option value="==">==</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<=">&lt;=</option>
                </select>
                <input style={{ width: 80 }} value={el.ifCondVal || ''} onChange={(e) => onUpdate({ ifCondVal: e.target.value })} placeholder="value" />
              </div>
              {el.ifCondVar && (
                <>
                  <div className="iae-section-title" style={{ marginTop: 10 }}>ELSE Chain (condition is false)</div>
                  {elseChain.length === 0 && <p className="iae-empty">No else actions — element does nothing if condition fails.</p>}
                  {elseChain.map((step, i) => (
                    <ActionStepEditor
                      key={step.id || i}
                      step={step}
                      idx={i}
                      pages={pages}
                      projectVars={projectVars}
                      elements={allElements}
                      onChange={(s) => onUpdate({ ifCondElse: elseChain.map((ss, ii) => ii === i ? s : ss) })}
                      onDelete={() => onUpdate({ ifCondElse: elseChain.filter((_, ii) => ii !== i) })}
                      onMoveUp={() => {
                        const c = [...elseChain]; if (i > 0) { [c[i], c[i-1]] = [c[i-1], c[i]]; onUpdate({ ifCondElse: c }) }
                      }}
                      onMoveDown={() => {
                        const c = [...elseChain]; if (i < c.length - 1) { [c[i], c[i+1]] = [c[i+1], c[i]]; onUpdate({ ifCondElse: c }) }
                      }}
                    />
                  ))}
                  <button className="iae-add-step" onClick={() => onUpdate({ ifCondElse: [...elseChain, { id: uid(), action: 'goto-next', target: '' }] })}>＋ Add Else Step</button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="iae-footer">
          <span className="iae-hint">Changes are applied immediately.</span>
          <button className="iae-done" onClick={onClose}>✓ Done</button>
        </div>

        {/* Hidden file inputs — browser fallback when Electron API unavailable */}
        <input ref={hoverSoundInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.aac,.flac,.m4a" style={{ display: 'none' }} />
        <input ref={hoverMediaInputRef} type="file" accept="image/gif,image/webp,video/mp4,video/webm,.gif,.webp,.mp4,.webm,.avi,.mov,.wmv,.apng" style={{ display: 'none' }} />
        <input ref={clickSoundInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.aac,.flac,.m4a" style={{ display: 'none' }} />
        <input ref={clickMediaInputRef} type="file" accept="image/gif,image/webp,video/mp4,video/webm,.gif,.webp,.mp4,.webm,.avi,.mov,.wmv,.apng" style={{ display: 'none' }} />
      </div>
    </div>
  )
}
