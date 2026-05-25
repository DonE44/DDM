// @ts-check

/* ─── Color History / Palette Helpers ─────────────────────────────────── */
const MAX_RECENT_COLORS = 20

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
function _colorStore_get(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

/**
 * @param {string} key
 * @param {unknown} val
 */
function _colorStore_set(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* noop */ }
}

/** @returns {string[]} */
export function getRecentColors() { return _colorStore_get('mme_recentColors', []) }

/** @param {string} hex */
export function pushRecentColor(hex) {
  if (!hex || !/^#[0-9a-fA-F]{3,8}$/.test(hex)) return
  const prev = getRecentColors().filter(c => c !== hex)
  _colorStore_set('mme_recentColors', [hex, ...prev].slice(0, MAX_RECENT_COLORS))
}

/** @returns {{ id: string, name: string, hex: string }[]} */
export function getSavedColors() { return _colorStore_get('mme_savedColors', []) }

/** @returns {{ id: string, name: string, colors: string[] }[]} */
export function getSavedPalettes() { return _colorStore_get('mme_colorPalettes', []) }

/** @param {string} name @param {string[]} colors */
export function savePalette(name, colors) {
  const pals = getSavedPalettes().filter(p => p.name !== name)
  _colorStore_set('mme_colorPalettes', [{ id: 'pal_' + Date.now(), name, colors }, ...pals])
}

/** @param {string} id */
export function deletePalette(id) {
  _colorStore_set('mme_colorPalettes', getSavedPalettes().filter(p => p.id !== id))
}

/** @param {string} name @param {string} hex */
export function saveNamedColor(name, hex) {
  const prev = getSavedColors().filter(c => c.name !== name)
  _colorStore_set('mme_savedColors', [{ id: 'sc_' + Date.now(), name, hex }, ...prev])
}

/** @param {string} id */
export function deleteNamedColor(id) {
  _colorStore_set('mme_savedColors', getSavedColors().filter(c => c.id !== id))
}

/** @param {string[]} arr */
export function setRecentColors(arr) {
  try { localStorage.setItem('mme_recentColors', JSON.stringify(arr)) } catch { /* noop */ }
}

/** @param {{ id: string, name: string, hex: string }[]} arr */
export function setSavedColors(arr) {
  try { localStorage.setItem('mme_savedColors', JSON.stringify(arr)) } catch { /* noop */ }
}

/** @param {{ id: string, name: string, colors: string[] }[]} arr */
export function setSavedPalettes(arr) {
  try { localStorage.setItem('mme_colorPalettes', JSON.stringify(arr)) } catch { /* noop */ }
}

/**
 * Extract dominant colors from an image file via canvas.
 * @param {Blob|MediaSource} file
 * @param {number} [count]
 * @returns {Promise<string[]>}
 */
export async function extractColorsFromImage(file, count = 16) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const size = 64
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve([]); return }
      ctx.drawImage(img, 0, 0, size, size)
      const data = ctx.getImageData(0, 0, size, size).data
      /** @type {Record<string, number>} */
      const buckets = {}
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]
        if (a < 128) continue
        // Quantize to 5-bit per channel
        const r = (data[i]   >> 3) << 3
        const g = (data[i+1] >> 3) << 3
        const b = (data[i+2] >> 3) << 3
        const key = `${r},${g},${b}`
        buckets[key] = (buckets[key] || 0) + 1
      }
      const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, count)
      const colors = sorted.map(([k]) => {
        const [r, g, b] = k.split(',').map(Number)
        return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')
      })
      resolve(colors)
    }
    img.onerror = () => resolve([])
    img.src = URL.createObjectURL(file)
  })
}
