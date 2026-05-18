import { useCallback, useEffect, useRef, useState } from 'react'

/** Interactive audio preview for the editor canvas — works like MidiClipPlayer
 *  but for any audio URL (WAV, MP3, OGG, etc.).
 *  Uses onMouseDown stopPropagation on controls so element selection/drag still works.
 */
export default function AudioClipPlayer({ src, label, loop, onError, onEnded = undefined }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting playback state on src change is correct here
    setIsPlaying(false)
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.currentTime = 0; audio.load() }
  }, [src])

  useEffect(() => () => { audioRef.current?.pause() }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          onError?.(String(err?.message || err || 'Audio playback failed'))
          setIsPlaying(false)
        })
    }
  }, [isPlaying, onError])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.currentTime = 0 }
    setIsPlaying(false)
  }, [])

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        loop={loop}
        onEnded={() => { setIsPlaying(false); onEnded?.() }}
        onError={() => { setIsPlaying(false); onError?.(`Audio failed: ${label || ''}`) }}
        style={{ display: 'none' }}
      />
      <div className="clip-audio-badge">
        <span className="clip-audio-icon">♪</span>
        <span className="clip-audio-name" title={label}>{label || 'Audio clip'}</span>
      </div>
      <div className="clip-midi-controls">
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={togglePlay}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={stop}
          disabled={!isPlaying}
        >
          ⏹
        </button>
      </div>
    </>
  )
}
