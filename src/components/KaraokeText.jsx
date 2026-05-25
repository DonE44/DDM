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
  const hasPlaybackStartedRef = useRef(false)
  const WORD_START_TOLERANCE_S = 0.04
  const WORD_END_TOLERANCE_S = 0.02

  useEffect(() => {
    const container = containerRef.current
    if (!container || !words?.length) return

    hasPlaybackStartedRef.current = false

    const spans = /** @type {HTMLSpanElement[]} */ ([...container.querySelectorAll('[data-wi]')])
    if (!spans.length) return

    let lastIdx = -2  // -2 = nothing set yet

    const tick = () => {
      const audio = audioRef?.current ?? null
      const t = audio?.currentTime ?? 0
      const lastWord = words[words.length - 1]
      const audioEndTime = Number.isFinite(audio?.duration) && Number(audio?.duration) > 0
        ? Number(audio?.duration)
        : null
      const effectiveLastEnd = lastWord
        ? Math.min(lastWord.end, audioEndTime != null ? audioEndTime : lastWord.end)
        : 0

      // Avoid the "first word stuck" effect while clip is still paused before delayed start.
      if (!hasPlaybackStartedRef.current) {
        if (audio && (!audio.paused || t > WORD_START_TOLERANCE_S)) {
          hasPlaybackStartedRef.current = true
        } else {
          if (lastIdx !== -1) {
            spans.forEach((span) => {
              span.style.color = ''
              span.style.textShadow = ''
              span.style.fontWeight = ''
              span.style.opacity = '1'
            })
            lastIdx = -1
          }
          rafRef.current = requestAnimationFrame(tick)
          return
        }
      }

      // Find active word with small tolerance windows around boundaries.
      let active = -1
      for (let i = 0; i < words.length; i++) {
        const w = words[i]
        if (t >= (w.start - WORD_START_TOLERANCE_S) && t < (w.end + WORD_END_TOLERANCE_S)) {
          active = i
          break
        }
        // During small gaps between words, choose nearest boundary to avoid jitter.
        if (i < words.length - 1 && t >= w.end && t < words[i + 1].start) {
          const mid = (w.end + words[i + 1].start) / 2
          active = t < mid ? i : i + 1
          break
        }
      }
      // Never leave the final token glowing after its effective spoken window.
      if ((audio?.ended || false) && lastWord && t >= effectiveLastEnd) {
        active = -1
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
