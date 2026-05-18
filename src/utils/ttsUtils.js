// @ts-check
// TTS Tier 1: Web Speech API (window.speechSynthesis)
// Zero install — uses OS/browser built-in voices. Works immediately in Electron/Chromium.

/**
 * List all available speech synthesis voices.
 * Note: voices may load asynchronously — call again after voiceschanged event if list is empty.
 * @returns {SpeechSynthesisVoice[]}
 */
export function listVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  return window.speechSynthesis.getVoices()
}

/**
 * Speak text aloud using the Web Speech API (preview, no recording).
 * @param {string} text
 * @param {string} [voiceURI] - Optional voice URI from listVoices()
 * @param {number} [rate=1] - Speech rate (0.1–10)
 * @param {number} [pitch=1] - Pitch (0–2)
 * @param {number} [volume=1] - Volume (0–1)
 * @returns {SpeechSynthesisUtterance}
 */
export function speak(text, voiceURI, rate = 1, pitch = 1, volume = 1) {
  if (!window.speechSynthesis) throw new Error('Web Speech API not available')
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = rate
  utt.pitch = pitch
  utt.volume = volume
  if (voiceURI) {
    const voice = listVoices().find(v => v.voiceURI === voiceURI)
    if (voice) utt.voice = voice
  }
  window.speechSynthesis.speak(utt)
  return utt
}

/** Stop any currently speaking utterance. */
export function stopSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}

/**
 * Convert text to an audio Blob using Web Speech API + MediaRecorder.
 * Returns a Promise<Blob|null>. The blob is a WebM/Opus audio recording.
 * Note: requires a system voice to be available; quality depends on OS voice.
 * @param {string} text
 * @returns {Promise<Blob|null>}
 */
export function speakToBlob(text) {
  return new Promise((resolve) => {
    void text
    if (!window.speechSynthesis || !navigator.mediaDevices) { resolve(null); return }
    // We need to capture audio output — use loopback via AudioContext destination
    // Simpler approach: record system audio via getUserMedia with audio capture (Electron only)
    // Fallback: return null and inform caller to use Piper for file output
    // NOTE: Web Speech API cannot directly output to a file in standard browsers.
    // For now, speakToBlob returns null to indicate "use Piper for file output".
    // The speak() function (for in-app preview) works correctly.
    resolve(null)
  })
}

/**
 * Check if Web Speech API (TTS) is available.
 * @returns {boolean}
 */
export function isTTSAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}
