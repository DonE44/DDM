// @ts-check
// Extracted from App.jsx — module-level audio singletons and helpers

/* Module-level audio registry — stops the previous instance before playing a new one */
export const _clickAudioMap = new Map()
/** Module-level MIDI synth registry — all active TinySynth instances */
export const _midiSynthRegistry = new Set()

export function playAudio(url, id) {
  try {
    const prev = _clickAudioMap.get(id)
    if (prev) { prev.pause(); prev.currentTime = 0 }
    const audio = new Audio(url)
    _clickAudioMap.set(id, audio)
    audio.play().catch(() => {})
    audio.addEventListener('ended', () => { if (_clickAudioMap.get(id) === audio) _clickAudioMap.delete(id) }, { once: true })
  } catch { /* ignore */ }
}

/** Stop ALL audio/video that the app has started — call on player exit */
export function stopAllAudio() {
  // 1. Stop all button/event audio instances
  for (const [, audio] of _clickAudioMap) {
    try { audio.pause(); audio.currentTime = 0 } catch { /* noop */ }
  }
  _clickAudioMap.clear()
  // 2. Stop all MIDI TinySynth instances
  for (const synth of _midiSynthRegistry) {
    try { synth.stopMIDI?.() } catch { /* noop */ }
  }
  // 3. Pause any HTMLMediaElements that slipped through (safety net)
  try {
    document.querySelectorAll('audio, video').forEach((el) => {
      const media = /** @type {HTMLMediaElement} */ (el)
      try { if (!media.paused) { media.pause(); media.currentTime = 0 } } catch { /* noop */ }
    })
  } catch { /* noop */ }
}
