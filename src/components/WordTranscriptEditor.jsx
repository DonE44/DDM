// @ts-check
/**
 * WordTranscriptEditor — Clideo-style interactive word-level transcript editor.
 *
 * Features:
 *  - Displays each word as a clickable span
 *  - Click a word → seeks the audio to that word's timestamp
 *  - Highlights the currently playing word in amber as audio plays (rAF loop)
 *  - Click a word to select it, then type to correct it inline
 *  - Respects sentence-segment boundaries (visual paragraph breaks)
 */

import { useState, useEffect, useRef } from 'react'

/**
 * @param {{
 *   wordSegments: {start:number, end:number, text:string}[],
 *   audioRef: React.RefObject<HTMLAudioElement>,
 *   onChange?: (updated: {start:number,end:number,text:string}[]) => void,
 *   label?: string,
 * }} props
 */
export default function WordTranscriptEditor({ wordSegments = [], audioRef, onChange, label }) {
  const [activeIdx, setActiveIdx] = useState(-1)
  const [editIdx, setEditIdx] = useState(-1)
  const [editVal, setEditVal] = useState('')
  const rafRef = useRef(/** @type {number|null} */ (null))

  // rAF loop — highlight the word that matches current audio time
  useEffect(() => {
    const audio = audioRef?.current
    if (!audio || !wordSegments.length) return

    const sync = () => {
      const t = audio.currentTime
      let found = -1
      for (let i = 0; i < wordSegments.length; i++) {
        if (t >= wordSegments[i].start && t <= wordSegments[i].end) { found = i; break }
      }
      setActiveIdx(found)
      rafRef.current = requestAnimationFrame(sync)
    }
    rafRef.current = requestAnimationFrame(sync)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [audioRef, wordSegments])

  if (!wordSegments.length) return null

  const handleWordClick = (i) => {
    if (editIdx === i) return // already editing this word
    if (audioRef?.current) audioRef.current.currentTime = wordSegments[i].start
    setEditIdx(i)
    setEditVal(wordSegments[i].text.replace(/^\s+/, ''))
  }

  const confirmEdit = (i) => {
    if (onChange) {
      const updated = wordSegments.map((w, idx) =>
        idx === i ? { ...w, text: (idx > 0 && !w.text.startsWith(' ') ? ' ' : '') + editVal } : w
      )
      onChange(updated)
    }
    setEditIdx(-1)
  }

  return (
    <div style={{
      background: 'var(--bg2,#1a1a2e)',
      border: '1px solid var(--border,#2c3a52)',
      borderRadius: 6,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--t3,#888)', marginBottom: 8, display: 'flex', gap: 12 }}>
        <span>🎤 {label || 'Interactive transcript'}</span>
        <span style={{ color: '#f59e0b' }}>■</span> <span>playing</span>
        <span>· Click any word to seek · Click again to edit</span>
      </div>
      <div style={{ lineHeight: 2.1, fontSize: 13 }}>
        {wordSegments.map((word, i) => {
          const isActive = activeIdx === i
          const isEditing = editIdx === i
          // Visual paragraph break when there's a large gap between consecutive words
          const prevEnd = i > 0 ? wordSegments[i - 1].end : 0
          const gap = word.start - prevEnd
          const showBreak = i > 0 && gap > 2

          return (
            <span key={i}>
              {showBreak && (
                <span style={{ display: 'block', height: 6, borderTop: '1px dashed var(--border,#2c3a52)', margin: '4px 0' }} />
              )}
              {isEditing ? (
                <input
                  autoFocus
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={() => confirmEdit(i)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); confirmEdit(i) }
                    if (e.key === 'Escape') setEditIdx(-1)
                  }}
                  style={{
                    display: 'inline-block',
                    width: Math.max(editVal.length * 9 + 14, 44),
                    fontSize: 13,
                    padding: '1px 5px',
                    margin: '0 2px',
                    background: '#1e3a4f',
                    border: '1px solid #3cb8be',
                    borderRadius: 4,
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              ) : (
                <span
                  onClick={() => handleWordClick(i)}
                  title={`${word.start.toFixed(2)}s – ${word.end.toFixed(2)}s`}
                  style={{
                    display: 'inline-block',
                    padding: '1px 3px',
                    margin: '1px 1px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    background: isActive ? '#f59e0b' : 'transparent',
                    color: isActive ? '#111' : 'var(--t1,#dde)',
                    fontWeight: isActive ? 700 : 400,
                    transition: 'background 0.05s',
                    userSelect: 'none',
                    borderBottom: editIdx === -1 ? '1px dashed transparent' : undefined,
                  }}
                >
                  {word.text.trim()}
                </span>
              )}
            </span>
          )
        })}
      </div>
      {onChange && (
        <div style={{ fontSize: 10, color: 'var(--t3,#888)', marginTop: 6 }}>
          Word edits here update the word editor only. Use <strong>Rebuild pages</strong> below to apply to lyric lines.
        </div>
      )}
    </div>
  )
}
