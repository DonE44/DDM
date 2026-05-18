import { FLYIN_META } from '../constants/index.js'

/** Animated SVG thumbnail for an element fly-in */
export default function FlyInThumbnail({ value }) {
  const meta = FLYIN_META.find((m) => m.value === value) || FLYIN_META[0]
  return (
    <svg viewBox="0 0 40 44" className="wipe-thumb" aria-hidden="true">
      <rect width="40" height="44" fill="#0a1a2a" />
      <rect className={`wthumb-new wthumb-flyin-${value || 'none'}`}
        width="20" height="18" x="10" y="13" rx="2" fill="#1a3a5c" />
      <text x="20" y="28" textAnchor="middle" fontSize="16" fill="#e8a020"
        fontFamily="monospace">
        {meta.icon}
      </text>
    </svg>
  )
}
