import { useState } from 'react'
import SmartColorPicker from '../components/SmartColorPicker.tsx'

export interface MemPair {
  image: string
  color: string
  symbol: string
}

export interface MemGameConfig {
  title: string
  bgColor: string
  accentColor: string
  borderColor: string
  backColor: string
  backBorderColor: string
  backLabel: string
  backImage: string
  pairs: MemPair[]
}

export const DEFAULT_MEM_GAME_CONFIG: MemGameConfig = {
  title: 'Memory Game',
  bgColor: '#050f1e',
  accentColor: '#e8a020',
  borderColor: '#4a8fc0',
  backColor: '#1a3a5c',
  backBorderColor: '#4a8fc0',
  backLabel: '?',
  backImage: '',
  pairs: [
    { image: '', color: '#1a3a5c', symbol: '🌟' },
    { image: '', color: '#3a1a0a', symbol: '🔥' },
    { image: '', color: '#1a3a2a', symbol: '🌊' },
    { image: '', color: '#2a2a0a', symbol: '💎' },
    { image: '', color: '#3a1a4a', symbol: '⚡' },
    { image: '', color: '#0a3a3a', symbol: '🌿' },
    { image: '', color: '#2a1a2a', symbol: '🎯' },
    { image: '', color: '#0a2a3a', symbol: '🎵' },
  ],
}

interface Props {
  initial: MemGameConfig
  onConfirm: (config: MemGameConfig) => void
  onCancel: () => void
  pickFile: (category: string) => Promise<{ url: string; name?: string } | null>
}

export default function MemoryGameEditorModal({ initial, onConfirm, onCancel, pickFile }: Props) {
  const [d, setD] = useState<MemGameConfig>(() => ({
    ...DEFAULT_MEM_GAME_CONFIG,
    ...initial,
    pairs: (initial.pairs?.length === 8 ? initial.pairs : DEFAULT_MEM_GAME_CONFIG.pairs).map(
      (p) => ({ ...p }),
    ),
  }))

  const up = (patch: Partial<MemGameConfig>) => setD((prev) => ({ ...prev, ...patch }))
  const upPair = (i: number, patch: Partial<MemPair>) =>
    setD((prev) => ({
      ...prev,
      pairs: prev.pairs.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }))

  async function pickPairImage(i: number) {
    const r = await pickFile('image')
    if (r) upPair(i, { image: r.url })
  }
  async function pickBackImage() {
    const r = await pickFile('image')
    if (r) up({ backImage: r.url })
  }

  const swatch = (value: string, onChange: (c: string) => void) => (
    <SmartColorPicker value={value} onChange={onChange} />
  )

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-panel"
        style={{ width: 640, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <span>🧠 Memory Game Editor</span>
          <button className="modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Game Title */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 80, color: '#8ab8d8', flexShrink: 0 }}>Game Title</span>
            <input
              value={d.title}
              onChange={(e) => up({ title: e.target.value })}
              style={{ flex: 1 }}
            />
          </label>

          {/* ── Card Pairs ── */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#6090a0',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
                borderBottom: '1px solid #1a3a5a',
                paddingBottom: 4,
              }}
            >
              🃏 Card Pairs — 8 unique symbols (each appears twice)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {d.pairs.map((pair, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    background: '#0d1e30',
                    border: '1px solid #1e3a5a',
                    borderRadius: 6,
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Card face preview — clickable to pick image */}
                    <div
                      style={{
                        width: 56,
                        height: 46,
                        borderRadius: 5,
                        background: pair.image ? 'transparent' : pair.color,
                        border: '1px solid #3a5a7a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: pair.image ? 9 : 22,
                        color: '#fff',
                        overflow: 'hidden',
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                      onClick={() => pickPairImage(i)}
                      title="Click to pick an image for this card face"
                    >
                      {pair.image ? (
                        <img
                          src={pair.image}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          alt=""
                        />
                      ) : (
                        pair.symbol
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ fontSize: 10, color: '#5070a0', marginBottom: 4 }}
                      >{`Pair ${i + 1}`}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="be-btn"
                          onClick={() => pickPairImage(i)}
                          title="Pick image"
                        >
                          📁
                        </button>
                        {pair.image && (
                          <button
                            className="be-btn"
                            onClick={() => upPair(i, { image: '' })}
                            title="Clear image"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#5070a0', width: 44, flexShrink: 0 }}>
                      Symbol
                    </span>
                    <input
                      value={pair.symbol}
                      onChange={(e) => upPair(i, { symbol: e.target.value })}
                      style={{ width: 52, textAlign: 'center', fontSize: 18 }}
                      title="Emoji or text shown when no image is set"
                    />
                    <span style={{ fontSize: 10, color: '#5070a0', flexShrink: 0 }}>BG</span>
                    {swatch(pair.color, (c) => upPair(i, { color: c }))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#3a5a7a', marginTop: 6 }}>
              Symbol is shown as fallback text when no image is set. Click a card preview or 📁 to
              assign an image.
            </div>
          </div>

          {/* ── Card Back ── */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#6090a0',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
                borderBottom: '1px solid #1a3a5a',
                paddingBottom: 4,
              }}
            >
              🔄 Card Back Design
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {/* Back preview */}
              <div
                style={{
                  width: 74,
                  height: 58,
                  borderRadius: 6,
                  background: d.backImage ? 'transparent' : d.backColor,
                  border: `2px solid ${d.backBorderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: d.backImage ? 9 : 28,
                  color: '#aac8e0',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                onClick={pickBackImage}
                title="Click to pick a card back image"
              >
                {d.backImage ? (
                  <img
                    src={d.backImage}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    alt="card back"
                  />
                ) : (
                  d.backLabel
                )}
              </div>

              <div
                style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
                  >
                    <span style={{ color: '#5a80a0', width: 60 }}>Back label</span>
                    <input
                      value={d.backLabel}
                      onChange={(e) => up({ backLabel: e.target.value })}
                      style={{ width: 48, textAlign: 'center', fontSize: 20 }}
                    />
                  </label>
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
                  >
                    <span style={{ color: '#5a80a0', width: 52 }}>BG Color</span>
                    {swatch(d.backColor, (c) => up({ backColor: c }))}
                  </label>
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
                  >
                    <span style={{ color: '#5a80a0', width: 52 }}>Border</span>
                    {swatch(d.backBorderColor, (c) => up({ backBorderColor: c }))}
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="be-btn" onClick={pickBackImage}>
                    📁 Pick Image
                  </button>
                  {d.backImage && (
                    <button className="be-btn" onClick={() => up({ backImage: '' })}>
                      ✕ Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Theme ── */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#6090a0',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
                borderBottom: '1px solid #1a3a5a',
                paddingBottom: 4,
              }}
            >
              🎨 Theme Colors
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ color: '#5a80a0', width: 68 }}>Background</span>
                {swatch(d.bgColor, (c) => up({ bgColor: c }))}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ color: '#5a80a0', width: 44 }}>Accent</span>
                {swatch(d.accentColor, (c) => up({ accentColor: c }))}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ color: '#5a80a0', width: 64 }}>Grid Border</span>
                {swatch(d.borderColor, (c) => up({ borderColor: c }))}
              </label>
            </div>
          </div>

          {/* Tip */}
          <div
            style={{
              fontSize: 10,
              color: '#4a6a8a',
              background: '#071422',
              borderRadius: 5,
              padding: '8px 10px',
              lineHeight: 1.6,
            }}
          >
            <b style={{ color: '#5a80a0' }}>💡 Tip:</b> After applying, the three Memory Game
            pages are rebuilt with your settings. To embed this game inside a larger project, the
            generated pages carry a{' '}
            <code style={{ background: '#0d2038', padding: '1px 4px', borderRadius: 3 }}>
              templateId: "memory-game"
            </code>{' '}
            tag — clicking <em>Edit Memory Game</em> again will update only those pages.
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '10px 16px',
            borderTop: '1px solid #1a3a5a',
          }}
        >
          <button className="be-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="be-btn"
            style={{ background: '#1a4a2a', borderColor: '#2a7a3a', color: '#80e080' }}
            onClick={() => onConfirm(d)}
          >
            ✓ Apply to Game
          </button>
        </div>
      </div>
    </div>
  )
}
