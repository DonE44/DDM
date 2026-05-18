import { WIPE_META } from '../constants/index.js'

/** Animated SVG thumbnail for a WIPE transition */
export default function WipeThumbnail({ wipe }) {
  const meta = WIPE_META[wipe] || { icon: '?', desc: wipe }
  return (
    <svg viewBox="0 0 40 44" className="wipe-thumb" aria-hidden="true">
      {/* Background = old page (dark blue) */}
      <rect width="40" height="44" fill="#0a1a2a" />
      {/* "New page" colour */}
      <rect className={`wthumb-new wthumb-${wipe.toLowerCase().replace(/[^a-z0-9]/g, '_')}`}
        width="40" height="44" fill="#1a3a5c" />
      {/* Icon centred */}
      <text x="20" y="26" textAnchor="middle" fontSize="16" fill="#e8a020"
        fontFamily="monospace" className="wthumb-icon">
        {meta.icon}
      </text>
    </svg>
  )
}
