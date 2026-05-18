/* ─── Color History / Palette Helpers ─────────────────────────────────── */
const MAX_RECENT_COLORS = 20

function _colorStore_get(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
function _colorStore_set(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* noop */ }
}
export function getRecentColors() { return _colorStore_get('mme_recentColors', []) }
export function pushRecentColor(hex) {
  if (!hex || !/^#[0-9a-fA-F]{3,8}$/.test(hex)) return
  const prev = getRecentColors().filter(c => c !== hex)
  _colorStore_set('mme_recentColors', [hex, ...prev].slice(0, MAX_RECENT_COLORS))
}
export function getSavedColors() { return _colorStore_get('mme_savedColors', []) }
export function getSavedPalettes() { return _colorStore_get('mme_colorPalettes', []) }
export function savePalette(name, colors) {
  const pals = getSavedPalettes().filter(p => p.name !== name)
  _colorStore_set('mme_colorPalettes', [{ id: 'pal_' + Date.now(), name, colors }, ...pals])
}
export function deletePalette(id) {
  _colorStore_set('mme_colorPalettes', getSavedPalettes().filter(p => p.id !== id))
}
export function saveNamedColor(name, hex) {
  const prev = getSavedColors().filter(c => c.name !== name)
  _colorStore_set('mme_savedColors', [{ id: 'sc_' + Date.now(), name, hex }, ...prev])
}
export function deleteNamedColor(id) {
  _colorStore_set('mme_savedColors', getSavedColors().filter(c => c.id !== id))
}
export function setRecentColors(arr) {
  try { localStorage.setItem('mme_recentColors', JSON.stringify(arr)) } catch { /* noop */ }
}
export function setSavedColors(arr) {
  try { localStorage.setItem('mme_savedColors', JSON.stringify(arr)) } catch { /* noop */ }
}
export function setSavedPalettes(arr) {
  try { localStorage.setItem('mme_colorPalettes', JSON.stringify(arr)) } catch { /* noop */ }
}

// Extract dominant colors from an image file via canvas
export async function extractColorsFromImage(file, count = 16) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const size = 64
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, size, size)
      const data = ctx.getImageData(0, 0, size, size).data
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
