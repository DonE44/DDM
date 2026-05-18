import { type CSSProperties } from 'react'
import { pageBgCss } from '../utils/stageUtils.js'
import { detectMediaKind } from '../utils/mediaUtils.js'

/** Scaled-down page thumbnail for the page strip */
export default function PageThumb({ page, stageWidth, stageHeight, thumbWidth }) {
  const thumbHeight = Math.round(thumbWidth * (stageHeight / stageWidth))
  const scale = thumbWidth / stageWidth
  const bg = pageBgCss(page)
  const sorted = [...(page?.elements || [])].sort((a, b) => a.z - b.z)

  return (
    <div
      className="page-thumb-outer"
      style={{ width: thumbWidth, height: thumbHeight, flexShrink: 0 }}
    >
      {/* Scaled inner stage */}
      <div
        className="page-thumb-inner"
        style={{
          width: stageWidth,
          height: stageHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          background: bg,
          position: 'relative',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* Background image/video (as static image) */}
        {page.bgMediaSrc && page.bgMediaKind !== 'video' && (
          <img src={page.bgMediaSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {page.bgImage && !page.bgMediaSrc && (
          <img src={page.bgImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {/* Element blocks */}
        {sorted.map((el) => {
          if (el.visible === false) return null
          const base: CSSProperties = {
            position: 'absolute',
            left: el.x,
            top: el.y,
            width: el.w,
            height: el.h,
            boxSizing: 'border-box',
            borderRadius: 1,
            overflow: 'hidden',
          }
          if (el.type === 'text') return (
            <div key={el.id} style={{ ...base, background: el.bgOn ? el.bgColor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center', padding: '0 4px' }}>
              <span style={{ color: el.color || '#e8a020', fontSize: Math.max(6, (el.size || 16) * 0.85), fontFamily: el.font || 'sans-serif', fontWeight: el.weight || '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>
                {el.content || ''}
              </span>
            </div>
          )
          if (el.type === 'button') return (
            <div key={el.id} style={{ ...base, background: el.bgColor || '#1a3a5c', border: `${el.borderWidth ?? 1}px solid ${el.borderColor || '#4a8fc0'}`, borderRadius: el.radius || 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: el.fgColor || '#e8a020', fontSize: Math.max(5, (el.fontSize || 14) * 0.85), fontFamily: el.font || 'sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 3px' }}>
                {el.label || ''}
              </span>
            </div>
          )
          if (el.type === 'clip' || el.type === 'mpeg') {
            const kind = el.mediaKind || detectMediaKind(el.file || '')
            if (kind === 'image' && el.file) return (
              <img key={el.id} src={el.file} alt="" style={{ ...base, objectFit: el.fit || 'contain', opacity: (el.opacity || 100) / 100 }} />
            )
            if (kind === 'pdf') return (
              <div key={el.id} style={{ ...base, background: '#fff', display: 'grid', placeItems: 'center', border: '1px solid #ccc' }}>
                <span style={{ fontSize: Math.max(10, el.h * 0.25), opacity: .7, color: '#c00', fontWeight: 700 }}>PDF</span>
              </div>
            )
            return (
              <div key={el.id} style={{ ...base, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center' }}>
                <span style={{ fontSize: Math.max(10, el.h * 0.35), opacity: .6, color: '#fff' }}>
                  {kind === 'audio' ? '♪' : '▶'}
                </span>
              </div>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}
