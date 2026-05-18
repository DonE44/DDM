import { useCallback, useEffect, useRef, useState } from 'react'
import WebAudioTinySynth from 'webaudio-tinysynth'
import { _midiSynthRegistry } from '../utils/audioUtils.js'

export default function MidiClipPlayer({ src, label, onError, showControls = true, autoPlay = false }) {
  const synthRef = useRef(null)
  const pollRef = useRef(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const stopPlayback = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    try {
      if (synthRef.current) {
        synthRef.current.stopMIDI?.()
        _midiSynthRegistry.delete(synthRef.current)
      }
    } catch {
      // ignore synth stop failures during unmount/cleanup
    }
    setIsPlaying(false)
  }, [])

  useEffect(() => stopPlayback, [stopPlayback])

  // Auto-play when showControls is hidden (presentation mode with hidden controls)
  useEffect(() => {
    if (autoPlay && src) {
      void playMidi()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, src])

  useEffect(() => {
    stopPlayback()
  }, [src, stopPlayback])

  const playMidi = useCallback(async () => {
    setIsLoading(true)
    try {
      if (!synthRef.current) {
        synthRef.current = new WebAudioTinySynth({ quality: 1, useReverb: 1, voices: 64 })
        synthRef.current.setLoop?.(0)
        synthRef.current.setMasterVol?.(0.6)
      }

      const audioContext = synthRef.current.getAudioContext?.()
      if (audioContext?.state === 'suspended') {
        await audioContext.resume()
      }

      const response = await fetch(src)
      const midiData = await response.arrayBuffer()
      synthRef.current.stopMIDI?.()
      synthRef.current.loadMIDI(midiData)
      synthRef.current.playMIDI()
      _midiSynthRegistry.add(synthRef.current)
      setIsPlaying(true)

      if (pollRef.current) {
        window.clearInterval(pollRef.current)
      }
      pollRef.current = window.setInterval(() => {
        const s = synthRef.current?.getPlayStatus?.()
        if (!s?.play) stopPlayback()
      }, 250)
    } catch (error) {
      stopPlayback()
      onError?.(String(error?.message || error || 'MIDI playback failed'))
    } finally {
      setIsLoading(false)
    }
  }, [onError, src, stopPlayback])

  if (!showControls) {
    return (
      <div className="media-frame-icon">
        <span className="media-frame-note">♪</span>
        <span className="media-frame-label" title={label}>{label || 'MIDI'}</span>
        {isPlaying && <span className="media-frame-hint">▶ playing</span>}
      </div>
    )
  }

  return (
    <div className="clip-audio clip-midi">
      <div className="clip-midi-label">{label || 'MIDI clip'}</div>
      <div className="clip-midi-controls">
        <button type="button" onClick={() => void playMidi()} disabled={isLoading}>
          {isLoading ? 'Loading...' : isPlaying ? 'Replay' : 'Play MIDI'}
        </button>
        <button type="button" onClick={stopPlayback} disabled={!isPlaying && !isLoading}>
          Stop
        </button>
      </div>
    </div>
  )
}
