// @ts-check

/**
 * lyricAlignUtils.js — Force-align existing lyric text to Whisper word timestamps.
 *
 * Algorithm:
 *  1. Parse lyric lines (split by newline, skipping blanks)
 *  2. Flatten lyric words (normalize: lowercase, strip punctuation)
 *  3. For each lyric word, greedily find the best matching Whisper word (sliding forward window)
 *  4. Assign line start/end from first/last matched word index per line
 *  5. Interpolate timing for unmatched lines
 */

/** @typedef {{ start: number, end: number, text: string }} WhisperWord */
/** @typedef {{ start: number, end: number, text: string, durationMs: number }} LyricTimingLine */

/** @param {string} w */
function normalizeWord(w) {
  return (w || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Align pasted lyric lines to Whisper word-level segments using EXACT matching.
 * Returns LINE-level timing (alignment function only).
 * KaraokeText will receive WORD-level timestamps from expandSentencesToWords.
 *
 * @param {string} lyricsText  — multi-line string (one lyric line per newline)
 * @param {WhisperWord[]} whisperWords  — word-level Whisper output
 * @returns {LyricTimingLine[]}
 */
export function alignLyricsToAudio(lyricsText, whisperWords) {
  const rawLines = (lyricsText || '').split('\n').map(l => l.trim()).filter(Boolean)
  if (!rawLines.length) return []

  if (!whisperWords || whisperWords.length === 0) {
    // No timestamps at all — distribute evenly at 4 sec per line
    return rawLines.map((text, i) => ({ start: i * 4, end: i * 4 + 4, text, durationMs: 4000 }))
  }

  /** @type {LyricTimingLine[]} */
  const result = []
  let wPos = 0

  for (const line of rawLines) {
    const lineWords = line.split(/\s+/).filter(Boolean)
    let bestStart = null
    let bestEnd = null
    let foundCount = 0

    // EXACT match only (no fuzzy matching to avoid false positives)
    for (const lw of lineWords) {
      const lnorm = normalizeWord(lw)
      if (!lnorm) continue

      let bestMatch = -1
      // Search forward from current position
      for (let wi = wPos; wi < whisperWords.length; wi++) {
        const wnorm = normalizeWord(whisperWords[wi].text)
        if (lnorm === wnorm) {
          bestMatch = wi
          break // Exact match found, stop searching
        }
      }

      if (bestMatch >= 0) {
        if (foundCount === 0) bestStart = whisperWords[bestMatch].start
        bestEnd = whisperWords[bestMatch].end
        wPos = bestMatch + 1
        foundCount++
      }
    }

    // If matches found, use their timing; otherwise interpolate
    let start, end
    if (foundCount > 0 && bestStart != null && bestEnd != null) {
      start = bestStart
      end = bestEnd
    } else {
      // No matches for this line — use time from previous line's end
      start = wPos > 0 && whisperWords[wPos - 1] ? whisperWords[wPos - 1].end : 0
      end = start + 2 // 2-second default for unmatched lines
    }

    result.push({ start, end, text: line, durationMs: Math.round((end - start) * 1000) })
  }

  return result
}
