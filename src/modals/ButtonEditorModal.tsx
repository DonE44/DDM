import { type CSSProperties, useState } from 'react'
import PngButtonEditor from '../components/PngButtonEditor.tsx'
import SmartColorPicker from '../components/SmartColorPicker.tsx'
import { BTN_SHAPES, RETRO_BTN_PRESETS, BTN_ACTIONS, FONT_LIST } from '../constants/index.js'

export default function ButtonEditorModal({ initial, pages, pickFile, onConfirm, onCancel }) {
  const [d, setD] = useState(() => ({ ...initial }))
  const up = (patch) => setD((prev) => ({ ...prev, ...patch }))
  const isNew = !initial.id
  const [stateTab, setStateTab] = useState('normal')
  const [retroCat, setRetroCat] = useState('All')
  const [pngEditorUrl, setPngEditorUrl] = useState(null)

  function applyShape(key) {
    const s = BTN_SHAPES.find((x) => x.key === key)
    up({ btnShape: key, radius: s?.radius || '0px' })
  }

  function applyPreset(p) {
    const patch = {
      bgColor:      p.bgColor      || d.bgColor,
      btnGrad:      p.bgGrad       ?? '',
      fgColor:      p.fgColor      || d.fgColor,
      borderColor:  p.borderColor  || d.borderColor,
      borderWidth:  p.borderWidth  ?? d.borderWidth,
      radius:       p.radius       ?? d.radius,
      bevel:        p.bevel        ?? d.bevel,
      textShadow:   p.textShadow   ?? d.textShadow,
    }
    up(patch)
  }

  async function pickImage() {
    const r = await pickFile('image')
    if (r) {
      if (stateTab === 'hover')   up({ hoverBtnImage: r.url })
      else if (stateTab === 'pressed') up({ pressedBtnImage: r.url })
      else up({ btnImage: r.url })
    }
  }
  async function pickClipPng() {
    const r = await pickFile('image')
    if (r) {
      up({ btnClipPng: r.url, btnShape: 'custom-png' })
      setPngEditorUrl(r.url)
    }
  }
  function openPngEditor() {
    if (d.btnClipPng || d.btnImage) setPngEditorUrl(d.btnClipPng || d.btnImage)
  }
  function applyPngEdit(dataUrl, textAnchor) {
    up({ btnClipPng: dataUrl, btnShape: 'custom-png', textAnchorX: `${textAnchor.x}%`, textAnchorY: `${textAnchor.y}%` })
    setPngEditorUrl(null)
  }
  async function pickMedia() {
    const r = await pickFile('all')
    if (r) up({ mediaFile: r.url, mediaFileName: r.name })
  }
  async function pickAudio() {
    const r = await pickFile('audio')
    if (r) up({ audioEvent: r.url, audioEventName: r.name })
  }

  const shape = BTN_SHAPES.find((s) => s.key === d.btnShape)
  const previewBg = d.btnImage
    ? `url(${d.btnImage}) center/cover no-repeat`
    : (d.btnGrad || d.bgColor || '#1a3a5c')
  const previewStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: Math.min(d.w || 160, 260),
    height: Math.min(d.h || 44, 100),
    background: previewBg,
    color: d.fgColor || '#e8a020',
    border: shape?.clipPath ? 'none' : `${d.borderWidth ?? 2}px solid ${d.borderColor || '#4a8fc0'}`,
    borderRadius: shape?.clipPath ? '0px' : (d.radius || '0px'),
    fontSize: d.fontSize || 14,
    fontFamily: `${d.font || 'Rajdhani'}, sans-serif`,
    fontWeight: d.fontWeight || '600',
    textShadow: d.textShadow ? '1px 1px 3px rgba(0,0,0,.8)' : 'none',
    boxShadow: d.bevel ? 'inset 2px 2px 4px rgba(255,255,255,.2), inset -2px -2px 4px rgba(0,0,0,.4)' : 'none',
    filter: d.btnShadow ? 'drop-shadow(2px 3px 6px rgba(0,0,0,.65))' : undefined,
    clipPath: shape?.clipPath || undefined,
    WebkitMaskImage: (!shape?.clipPath && d.btnClipPng) ? `url(${d.btnClipPng})` : undefined,
    WebkitMaskSize: '100% 100%',
    maskImage: (!shape?.clipPath && d.btnClipPng) ? `url(${d.btnClipPng})` : undefined,
    boxSizing: 'border-box', overflow: 'hidden', userSelect: 'none', cursor: 'default', flexShrink: 0,
  }

  const retroCats = ['All', ...Array.from(new Set(RETRO_BTN_PRESETS.map((p) => p.cat)))]
  const filteredPresets = retroCat === 'All' ? RETRO_BTN_PRESETS : RETRO_BTN_PRESETS.filter((p) => p.cat === retroCat)

  return (
    <>
    <div className="btn-editor-overlay" onClick={onCancel}>
      <div className="btn-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="btn-editor-header">
          <span>Button Editor</span>
          <button className="btn-editor-close" onClick={onCancel}>✕</button>
        </div>

        <div className="btn-editor-body">
          <div className="btn-editor-left">

            {/* Retro Library */}
            <div className="btn-editor-section">
              <div className="btn-editor-shead">Retro Library</div>
              <div className="retro-cat-row">
                {retroCats.map((c) => (
                  <button key={c} className={`retro-cat-btn ${retroCat === c ? 'on' : ''}`} onClick={() => setRetroCat(c)}>{c}</button>
                ))}
              </div>
              <div className="retro-grid">
                {filteredPresets.map((p) => (
                  <button
                    key={p.key}
                    className="retro-swatch"
                    title={p.label}
                    style={{
                      background: p.bgGrad || p.bgColor || '#1a3a5c',
                      color: p.fgColor || '#fff',
                      border: `${p.borderWidth ?? 2}px solid ${p.borderColor || '#4a8fc0'}`,
                      borderRadius: p.radius || '0px',
                      boxShadow: p.bevel ? 'inset 1px 1px 3px rgba(255,255,255,.2), inset -1px -1px 3px rgba(0,0,0,.4)' : 'none',
                    }}
                    onClick={() => applyPreset(p)}
                  >{p.label}</button>
                ))}
              </div>
            </div>

            {/* Shape */}
            <div className="btn-editor-section">
              <div className="btn-editor-shead">Shape</div>
              <div className="btn-shape-grid">
                {BTN_SHAPES.map((s) => (
                  <button
                    key={s.key}
                    className={`btn-shape-opt ${d.btnShape === s.key ? 'on' : ''}`}
                    title={s.title}
                    onClick={() => {
                      if (s.key === 'custom-png') pickClipPng()
                      else applyShape(s.key)
                    }}
                  >{s.label}</button>
                ))}
              </div>
              {!shape?.clipPath && d.btnShape !== 'ellipse' && (
                <label>Radius<input value={d.radius || '0px'} onChange={(e) => up({ radius: e.target.value })} placeholder="0px · 8px · 50%" /></label>
              )}
              {d.btnClipPng && (
                <div className="btn-ed-row">
                  <span style={{ fontSize: 10, color: 'var(--t3)' }}>🖼 Custom PNG mask loaded</span>
                  <button onClick={openPngEditor}>✏ Edit PNG</button>
                  <button onClick={() => up({ btnClipPng: '', btnShape: 'rect' })}>✕ Remove</button>
                </div>
              )}
            </div>

            {/* 3-State Appearance */}
            <div className="btn-editor-section">
              <div className="btn-editor-shead">Appearance</div>
              <div className="btn-state-tabs">
                {['normal', 'hover', 'pressed'].map((t) => (
                  <button key={t} className={`btn-state-tab ${stateTab === t ? 'on' : ''}`} onClick={() => setStateTab(t)}>
                    {t === 'normal' ? '● Normal' : t === 'hover' ? '◎ Hover' : '◉ Pressed'}
                  </button>
                ))}
              </div>

              {stateTab === 'normal' && (
                <>
                  <div className="btn-ed-row">
                    <label>W<input type="number" min="20" value={d.w || 160} onChange={(e) => up({ w: Math.max(20, Number(e.target.value)) })} /></label>
                    <label>H<input type="number" min="10" value={d.h || 44} onChange={(e) => up({ h: Math.max(10, Number(e.target.value)) })} /></label>
                  </div>
                  <label>Label<input value={d.label || ''} onChange={(e) => up({ label: e.target.value })} /></label>
                  <div className="btn-ed-row">
                    <label>Font
                      <select value={d.font || 'Rajdhani'} onChange={(e) => up({ font: e.target.value })}>
                        {FONT_LIST.map(({ group, fonts }) => (
                          <optgroup key={group} label={group}>
                            {fonts.map((f) => <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label style={{ width: 68 }}>Size<input type="number" min="6" max="120" value={d.fontSize || 14} onChange={(e) => up({ fontSize: Number(e.target.value) || 14 })} /></label>
                  </div>
                  <div className="btn-ed-row">
                    <label>Text<SmartColorPicker value={d.fgColor || '#e8a020'} onChange={(v) => up({ fgColor: v })} /></label>
                    <label>Fill<SmartColorPicker value={d.bgColor || '#1a3a5c'} onChange={(v) => up({ bgColor: v })} /></label>
                    <label>Border<SmartColorPicker value={d.borderColor || '#4a8fc0'} onChange={(v) => up({ borderColor: v })} /></label>
                    <label style={{ width: 60 }}>Width<input type="number" min="0" max="20" value={d.borderWidth ?? 2} onChange={(e) => up({ borderWidth: Number(e.target.value) })} /></label>
                  </div>
                  <div className="btn-ed-row">
                    <label style={{ fontSize: 10 }}>Gradient CSS<input value={d.btnGrad || ''} onChange={(e) => up({ btnGrad: e.target.value })} placeholder="linear-gradient(…)" /></label>
                  </div>
                  <div className="btn-ed-checks">
                    <label><input type="checkbox" checked={!!d.bevel} onChange={(e) => up({ bevel: e.target.checked })} /> Bevel</label>
                    <label><input type="checkbox" checked={!!d.textShadow} onChange={(e) => up({ textShadow: e.target.checked })} /> Text shadow</label>
                    <label><input type="checkbox" checked={!!d.btnShadow} onChange={(e) => up({ btnShadow: e.target.checked })} /> Btn shadow</label>
                  </div>
                </>
              )}

              {stateTab === 'hover' && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 2 }}>Overrides applied on mouse-over. Leave blank to inherit Normal.</div>
                  <div className="btn-ed-row">
                    <label>Text<SmartColorPicker value={d.hoverFg || d.fgColor || '#e8a020'} onChange={(v) => up({ hoverFg: v })} /></label>
                    <label>Fill<SmartColorPicker value={d.hoverBg || d.bgColor || '#1a3a5c'} onChange={(v) => up({ hoverBg: v })} /></label>
                  </div>
                  <div className="btn-ed-row">
                    <label style={{ fontSize: 10 }}>Gradient CSS<input value={d.hoverGrad || ''} onChange={(e) => up({ hoverGrad: e.target.value })} placeholder="(optional override)" /></label>
                  </div>
                  <div className="btn-ed-row">
                    <button onClick={pickImage}>{d.hoverBtnImage ? '⟳ Replace hover image' : '＋ Hover image'}</button>
                    {d.hoverBtnImage && <button onClick={() => up({ hoverBtnImage: '' })}>✕</button>}
                  </div>
                  <button style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => up({ hoverBg: '', hoverFg: '', hoverGrad: '', hoverBtnImage: '' })}>↺ Clear all hover overrides</button>
                </>
              )}

              {stateTab === 'pressed' && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 2 }}>Overrides applied on mouse-down/click. Leave blank to inherit Normal.</div>
                  <div className="btn-ed-row">
                    <label>Text<SmartColorPicker value={d.pressedFg || d.fgColor || '#e8a020'} onChange={(v) => up({ pressedFg: v })} /></label>
                    <label>Fill<SmartColorPicker value={d.pressedBg || d.bgColor || '#1a3a5c'} onChange={(v) => up({ pressedBg: v })} /></label>
                  </div>
                  <div className="btn-ed-row">
                    <label style={{ fontSize: 10 }}>Gradient CSS<input value={d.pressedGrad || ''} onChange={(e) => up({ pressedGrad: e.target.value })} placeholder="(optional override)" /></label>
                  </div>
                  <div className="btn-ed-row">
                    <button onClick={pickImage}>{d.pressedBtnImage ? '⟳ Replace pressed image' : '＋ Pressed image'}</button>
                    {d.pressedBtnImage && <button onClick={() => up({ pressedBtnImage: '' })}>✕</button>}
                  </div>
                  <button style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => up({ pressedBg: '', pressedFg: '', pressedGrad: '', pressedBtnImage: '' })}>↺ Clear all pressed overrides</button>
                </>
              )}
            </div>

            {/* Background image (Normal state only) */}
            {stateTab === 'normal' && (
              <div className="btn-editor-section">
                <div className="btn-editor-shead">Background Image (Normal)</div>
                <div className="btn-ed-row">
                  <button onClick={pickImage}>{d.btnImage ? '⟳ Replace image' : '＋ Import image'}</button>
                  {d.btnImage && <button onClick={() => up({ btnImage: '' })}>✕ Remove</button>}
                </div>
              </div>
            )}

            {/* Action */}
            <div className="btn-editor-section">
              <div className="btn-editor-shead">Action on Click</div>
              <label>Action
                <select value={d.action || 'next'} onChange={(e) => up({ action: e.target.value })}>
                  {BTN_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </label>
              {d.action === 'goto' && (
                <div className="goto-block">
                  <div className="goto-type-row">
                    <button
                      className={`goto-type-btn ${(d.gotoType || 'page') === 'page' ? 'on' : ''}`}
                      onClick={() => up({ gotoType: 'page', gotoObjectId: '', linkTarget: d.linkTarget || d.target || '', target: d.linkTarget || d.target || '' })}
                    >📄 Page</button>
                    <button
                      className={`goto-type-btn ${d.gotoType === 'object' ? 'on' : ''}`}
                      onClick={() => up({ gotoType: 'object' })}
                    >⬛ Object</button>
                  </div>

                  {(d.gotoType || 'page') === 'page' && (
                    <>
                      <label>Target Page
                        <select value={d.linkTarget || d.target || ''} onChange={(e) => up({ linkTarget: e.target.value, target: e.target.value })}>
                          <option value="">(choose page)</option>
                          {pages.map((pg, pi) => (
                            <option key={pg.id} value={pg.name}>{String(pi + 1).padStart(2, '0')} — {pg.name}</option>
                          ))}
                        </select>
                      </label>
                      {d.linkTarget && (
                        <div className="goto-page-preview">
                          {(() => {
                            const pi = pages.findIndex((p) => p.name === (d.linkTarget || d.target))
                            if (pi < 0) return <span className="goto-warn">⚠ Page not found</span>
                            const pg = pages[pi]
                            return (
                              <div className="goto-page-chip">
                                <span className="goto-page-num">{String(pi + 1).padStart(2, '0')}</span>
                                <span className="goto-page-name">{pg.name}</span>
                                <span className="goto-page-els">{pg.elements?.length || 0} el</span>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </>
                  )}

                  {d.gotoType === 'object' && (
                    <>
                      <label>On Page
                        <select
                          value={d.gotoPageName || ''}
                          onChange={(e) => {
                            const pg = pages.find(p => p.name === e.target.value)
                            up({ gotoPageName: e.target.value, gotoPageId: pg?.id || '', gotoObjectId: '' })
                          }}
                        >
                          <option value="">(choose page)</option>
                          {pages.map((pg, pi) => (
                            <option key={pg.id} value={pg.name}>{String(pi + 1).padStart(2, '0')} — {pg.name}</option>
                          ))}
                        </select>
                      </label>
                      {d.gotoPageName && (() => {
                        const pg = pages.find((p) => p.name === d.gotoPageName)
                        const els = pg?.elements || []
                        return (
                          <label>Object
                            <select
                              value={d.gotoObjectId || ''}
                              onChange={(e) => {
                                const el = els.find((x) => x.id === e.target.value)
                                up({ gotoObjectId: e.target.value, linkTarget: d.gotoPageName, target: d.gotoPageName, gotoObjectLabel: el ? `${el.type.toUpperCase()} z${el.z}` : '' })
                              }}
                            >
                              <option value="">(choose object)</option>
                              {els.slice().sort((a, b) => a.z - b.z).map((el) => {
                                const name = el.type === 'text' ? `Text: ${String(el.content || '').slice(0, 18)}`
                                  : el.type === 'button' ? `Button: ${el.label || ''}`
                                  : el.mediaName ? `${el.type.toUpperCase()}: ${el.mediaName}`
                                  : `${el.type.toUpperCase()} z${el.z}`
                                return <option key={el.id} value={el.id}>{name}</option>
                              })}
                            </select>
                          </label>
                        )
                      })()}
                      {d.gotoObjectId && (
                        <div className="goto-page-preview">
                          <div className="goto-page-chip">
                            <span className="goto-page-num">→</span>
                            <span className="goto-page-name">{d.gotoPageName}</span>
                            <span className="goto-page-els">{d.gotoObjectLabel || d.gotoObjectId.slice(0, 8)}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {d.action === 'url' && (
                <label>URL<input value={d.urlTarget || d.linkTarget || ''} onChange={(e) => up({ urlTarget: e.target.value, linkTarget: e.target.value })} placeholder="https://…" /></label>
              )}
              {d.action === 'play-media' && (
                <div className="btn-ed-row">
                  <button onClick={pickMedia}>{d.mediaFileName ? `♪ ${d.mediaFileName}` : '＋ Choose media'}</button>
                  {d.mediaFile && <button onClick={() => up({ mediaFile: '', mediaFileName: '' })}>✕</button>}
                </div>
              )}
              {d.action === 'event' && (
                <div className="btn-ed-row">
                  <button onClick={pickAudio}>{d.audioEventName ? `♪ ${d.audioEventName}` : '＋ Choose audio'}</button>
                  {d.audioEvent && <button onClick={() => up({ audioEvent: '', audioEventName: '' })}>✕</button>}
                </div>
              )}
              {d.action === 'script' && (
                <label>Script<textarea value={d.scriptContent || ''} onChange={(e) => up({ scriptContent: e.target.value })} rows={4} placeholder="SMMScript commands…" /></label>
              )}
            </div>

            {/* Audio on Click (independent of action) */}
            <div className="btn-editor-section">
              <div className="btn-editor-shead">Audio on Click</div>
              <div className="btn-ed-row">
                <button onClick={pickAudio}>{d.audioEventName ? `♪ ${d.audioEventName}` : '＋ Add click sound'}</button>
                {d.audioEvent && <button onClick={() => up({ audioEvent: '', audioEventName: '' })}>✕ Remove</button>}
              </div>
              {d.audioEvent && (
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>Plays on every click regardless of action. Only one instance at a time.</div>
              )}
            </div>

          </div>

          {/* Preview */}
          <div className="btn-editor-right">
            <div className="btn-editor-shead">Preview</div>
            <div className="btn-preview-area">
              {shape?.clipPath ? (
                /* Two-layer approach: border ring behind, fill in front */
                <div style={{ position: 'relative', width: previewStyle.width, height: previewStyle.height, flexShrink: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, background: d.borderColor || '#4a8fc0', clipPath: shape.clipPath }} />
                  <div style={{ ...previewStyle, position: 'absolute', top: d.borderWidth ?? 2, left: d.borderWidth ?? 2, right: d.borderWidth ?? 2, bottom: d.borderWidth ?? 2, width: 'auto', height: 'auto' }}>
                    {!d.btnImage && (d.label || 'Button')}
                  </div>
                </div>
              ) : (
                <div style={previewStyle}>{!d.btnImage && (d.label || 'Button')}</div>
              )}
            </div>
            <div className="btn-preview-meta">{d.w} × {d.h} · {BTN_ACTIONS.find((a) => a.value === d.action)?.label || d.action}</div>
            {d.action === 'goto' && (d.gotoType === 'object' ? d.gotoObjectId : d.linkTarget) && (
              <div className="btn-preview-meta">
                {d.gotoType === 'object'
                  ? `→ ${d.gotoPageName} · ${d.gotoObjectLabel || 'object'}`
                  : `→ ${d.linkTarget}`}
              </div>
            )}
            {d.action === 'url' && (d.urlTarget || d.linkTarget) && <div className="btn-preview-meta">🔗 {(d.urlTarget || d.linkTarget).slice(0, 36)}</div>}
            <div className="btn-preview-meta" style={{ color: 'var(--acc)', marginTop: 4 }}>
              {shape?.title || d.btnShape}{d.btnShadow ? ' · shadow' : ''}{d.bevel ? ' · bevel' : ''}
            </div>
          </div>
        </div>

        <div className="btn-editor-footer">
          <button onClick={onCancel}>Cancel</button>
          <button className="btn-ed-confirm" onClick={() => onConfirm(d)}>{isNew ? 'Place Button' : 'Apply Changes'}</button>
        </div>
      </div>
    </div>

    {pngEditorUrl && (
      <PngButtonEditor
        imageUrl={pngEditorUrl}
        initialTextAnchor={{ x: parseInt(d.textAnchorX || '50'), y: parseInt(d.textAnchorY || '50') }}
        onApply={applyPngEdit}
        onClose={() => setPngEditorUrl(null)}
      />
    )}
  </>
  )
}
