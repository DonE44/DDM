/**
 * systemFonts.js — Load and inject system fonts from C:\Windows\Fonts (or OS equivalent)
 *
 * Fonts are served through the existing local media HTTP server so Chromium
 * can load them via @font-face without file:// security restrictions.
 * Results are cached — the IPC call and CSS injection only happen once per session.
 */

let _cache = null          // [{name, path, file}] once loaded, null before
let _injected = false       // true once <style> tag has been inserted
let _loadPromise = null     // in-flight promise guard (prevents duplicate calls)

/**
 * Load all system fonts via Electron IPC, inject @font-face CSS, and return
 * the font list. Safe to call multiple times — subsequent calls return the cache.
 *
 * @returns {Promise<Array<{name: string, path: string, file: string}>>}
 */
export async function loadSystemFonts() {
  if (_cache) return _cache
  if (_loadPromise) return _loadPromise

  _loadPromise = (async () => {
    if (!window.smmDesktop?.listSystemFonts) return []

    let res
    try {
      res = await window.smmDesktop.listSystemFonts()
    } catch {
      return []
    }
    if (!res?.ok || !res.fonts?.length) return []

    if (!_injected) {
      const port = window.smmDesktop?.mediaServerPort || 0
      const css = res.fonts.map(f => {
        const safeName = f.name.replace(/'/g, "\\'")
        // Serve through local media HTTP server (already handles any file path via ?p=)
        const url = port
          ? `http://127.0.0.1:${port}/?p=${encodeURIComponent(f.path)}`
          : `file:///${f.path.replace(/\\/g, '/')}`
        return `@font-face { font-family: '${safeName}'; src: url('${url}') format('truetype'); font-weight: normal; font-style: normal; }`
      }).join('\n')

      const style = document.createElement('style')
      style.id = 'smme-system-fonts'
      style.textContent = css
      document.head.appendChild(style)
      _injected = true
    }

    _cache = res.fonts
    return _cache
  })()

  return _loadPromise
}

/** Return cached font list synchronously (empty array if not yet loaded). */
export function getSystemFontCache() {
  return _cache || []
}
