// @ts-check

/**
 * chromaKey.js — Canvas-based chroma-key (colour transparency) processor.
 *
 * Accepts a source image (data URL or Object URL), a key colour, a tolerance
 * value (0–255), and an optional edge-softness value (0–64).  Returns a new
 * PNG data URL where the keyed colour range has been replaced with full or
 * partial transparency.
 *
 * Designed to run in the browser's main thread (uses a hidden <canvas>).
 * Processing is synchronous after the image has loaded.
 *
 * Usage:
 *   import { applyChromaKey, sampleColor } from './chromaKey.js'
 *
 *   // Sample the pixel color at (x, y) from an image element:
 *   const color = await sampleColor(imgSrc, x, y, displayW, displayH)
 *
 *   // Apply keying and get back a data URL:
 *   const result = await applyChromaKey(imgSrc, { color: '#00ff00', tolerance: 40, softness: 8 })
 */

/**
 * Applies chroma key to an image.
 *
 * @param {string} src            Data URL or Object URL of the source image.
 * @param {{ color: string, tolerance: number, softness: number }} opts
 *   - color     — hex colour to key out (e.g. '#00ff00')
 *   - tolerance — how far a pixel can deviate and still be keyed (0 = exact, 255 = all)
 *   - softness  — half-width of the anti-alias fade zone around the tolerance threshold (0 = hard edge)
 * @returns {Promise<string>}     PNG data URL with transparency applied.
 */
export async function applyChromaKey(src, opts) {
  const { color, tolerance = 30, softness = 8 } = opts || {}
  const [kr, kg, kb] = hexToRgb(color || '#000000')

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('No canvas context')); return }

        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = data.data

        const tol = Math.max(0, tolerance)
        const soft = Math.max(0, Math.min(softness, 64))
        const innerEdge = tol             // dist ≤ inner → fully transparent
        const outerEdge = tol + soft      // dist ≥ outer → fully opaque

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          // Euclidean distance in RGB space
          const dist = Math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2)

          if (dist <= innerEdge) {
            // Fully transparent
            pixels[i + 3] = 0
          } else if (dist < outerEdge && soft > 0) {
            // Partial transparency in the feather zone
            const t = (dist - innerEdge) / (outerEdge - innerEdge) // 0→1
            pixels[i + 3] = Math.round(pixels[i + 3] * t)
          }
          // else: fully opaque — leave unchanged
        }

        ctx.putImageData(data, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error(`Failed to load image: ${String(src).slice(0, 60)}`))
    img.src = src
  })
}

/**
 * Samples the pixel colour at a logical position (rx, ry) within the image,
 * where rx and ry are ratios 0–1 of the display dimensions.
 *
 * @param {string}  src  Data URL or Object URL
 * @param {number}  rx   Fractional X (0 = left, 1 = right)
 * @param {number}  ry   Fractional Y (0 = top, 1 = bottom)
 * @returns {Promise<string>}  Hex colour string e.g. '#3aff00'
 */
export async function sampleColor(src, rx, ry) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('No canvas context')); return }
        ctx.drawImage(img, 0, 0)
        const px = Math.round(Math.max(0, Math.min(1, rx)) * (img.naturalWidth  - 1))
        const py = Math.round(Math.max(0, Math.min(1, ry)) * (img.naturalHeight - 1))
        const d = ctx.getImageData(px, py, 1, 1).data
        resolve(rgbToHex(d[0], d[1], d[2]))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Failed to load image for sampling'))
    img.src = src
  })
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** @param {string} hex  @returns {[number,number,number]} */
export function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ]
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

/** @param {number} r @param {number} g @param {number} b @returns {string} */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
