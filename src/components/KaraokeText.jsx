// @ts-check
/**
 * KaraokeText — renders lyric text with karaoke-style word highlighting.
 *
 * The active word is lit in amber with a soft glow.
 * Words already sung fade to 50% opacity.
 * Words not yet reached stay at normal colour.
 *
 * Runs its own internal rAF loop and updates the DOM directly
 * (no React state) to avoid parent re-renders at 60fps.
 */

import { useEffect, useRef } from 'react'

/**
 * @param {{
 *   words: {start:number, end:number, text:string}[],
 *   audioRef: React.RefObject<HTMLAudioElement>,
 *   style?: React.CSSProperties,
 *   activeColor?: string,
 * }} props
 */
export default function KaraokeText({
  words,
  audioRef,
  style,
  activeColor = '#f59e0b',
}) {
  const containerRef = useRef(/** @type {HTMLSpanElement|null} */ (null))
  const rafRef       = useRef(/** @type {number|null} */ (null))
  const WORD_MATCH_TOLERANCE_S = 0.05  // 50ms tolerance window for sync

  useEffect(() => {
    const container = containerRef.current
    if (!container || !words?.length) return

    const spans = /** @type {HTMLSpanElement[]} */ ([...container.querySelectorAll('[data-wi]')])
    if (!spans.length) return

    let lastIdx = -2  // -2 = nothing set yet

    const tick = () => {
      const t = audioRef?.current?.currentTime ?? 0

      // Find active word — allow ±50ms tolerance around word boundaries for sync robustness
      let active = -1
      for (let i = 0; i < words.length; i++) {
        const w = words[i]
        // With tolerance: match if time is within 50ms before start or 50ms after end
        if (t >= (w.start - WORD_MATCH_TOLERANCE_S) && t < (w.end + WORD_MATCH_TOLERANCE_S)) { 
          active = i
          break 
        }
        // Also check gap between words (happens when timing has small jitter)
        if (i < words.length - 1 && t >= w.end && t < words[i + 1].start) { 
          active = i
          break 
        }
      }
      // Once audio is past last word end, keep last word lit briefly
      if (active === -1 && words.length > 0 && t >= words[words.length - 1].start) {
        active = words.length - 1
      }

      if (active !== lastIdx) {
        spans.forEach((span, i) => {
          if (i === active) {
            span.style.color       = activeColor
            span.style.textShadow  = `0 0 24px ${activeColor}, 0 0 8px ${activeColor}`
            span.style.fontWeight  = '900'
            span.style.opacity     = '1'
          } else if (i < active) {
            span.style.color       = ''
            span.style.textShadow  = 'none'
            span.style.fontWeight  = ''
            span.style.opacity     = '0.45'
          } else {
            span.style.color       = ''
            span.style.textShadow  = ''
            span.style.fontWeight  = ''
            span.style.opacity     = '1'
          }
        })
        lastIdx = active
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }
  }, [audioRef, words, activeColor])

  if (!words?.length) return null

  return (
    <span ref={containerRef} style={{ ...style, display: 'inline' }}>
      {words.map((word, i) => (
        <span
          key={i}
          // @ts-ignore — data-wi is a valid attribute
          data-wi={i}
          style={{ transition: 'color 0.08s, opacity 0.12s, text-shadow 0.08s' }}
        >
          {word.text}
        </span>
      ))}
    </span>
  )
}
