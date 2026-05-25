// @ts-check

/**
 * mediaRegistry — externalises large media blobs from React state.
 *
 * PROBLEM: Data URLs (base64 images/audio) stored directly in React state
 * cause React to diff and serialize 10–30 MB on every setState() call,
 * freezing the editor on every drag, resize or keystroke.
 *
 * SOLUTION: Convert data URLs to browser Object URLs at ingestion.
 * React state holds short "blob:null/uuid" strings (~40 chars) instead of
 * multi-MB base64. The original data URLs are kept in a module-level Map
 * (outside React) and recovered on save.
 *
 * Usage:
 *   import { internDataUrl, externUrl, clearRegistry } from './mediaRegistry'
 *
 *   // On load / pick:
 *   const blobUrl = internDataUrl(dataUrl, nativePath)
 *   // Store blobUrl in React state.
 *
 *   // On save (genMME):
 *   const dataUrl = externUrl(blobUrl)   // recovers original data URL
 *
 *   // On new project / close:
 *   clearRegistry()
 */

/** @type {Map<string, string>} objectUrl → original dataUrl */
const _objToData = new Map()

/** @type {Map<string, string>} nativePath → objectUrl (deduplication) */
const _pathToObj = new Map()

/**
 * Converts a data URL to a browser Object URL and registers it.
 * Subsequent renders use the compact Object URL; the data URL is preserved
 * for save operations via {@link externUrl}.
 *
 * @param {string} dataUrl      The full data: URL from readMediaDataUrl / file picker
 * @param {string} [sourcePath] Optional native file path — used to deduplicate
 *                              re-reads of the same file across project open.
 * @returns {string} A short blob: Object URL, or the original URL unchanged
 *                   if it is not a data URL (already a blob:/http:/path).
 */
export function internDataUrl(dataUrl, sourcePath) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl

  // Deduplicate: same native path already registered → reuse existing Object URL
  if (sourcePath) {
    const existing = _pathToObj.get(sourcePath)
    if (existing && _objToData.has(existing)) return existing
  }

  try {
    const blob = _dataUrlToBlob(dataUrl)
    const objectUrl = URL.createObjectURL(blob)
    _objToData.set(objectUrl, dataUrl)
    if (sourcePath) _pathToObj.set(sourcePath, objectUrl)
    return objectUrl
  } catch {
    // Fallback: return original data URL unchanged
    return dataUrl
  }
}

/**
 * Recovers the original data URL from a registered Object URL.
 * Used in {@link genMME} and similar serialisation paths so that embedded
 * media is written correctly even though React state holds Object URLs.
 *
 * @param {string} url  Any URL — blob:, data:, http:, native path, etc.
 * @returns {string}    Original data URL if registered; otherwise `url` unchanged.
 */
export function externUrl(url) {
  if (!url) return url
  if (url.startsWith('blob:') && _objToData.has(url)) {
    return /** @type {string} */ (_objToData.get(url))
  }
  return url
}

/**
 * Returns true if `url` is a blob: URL that is registered in this registry.
 * @param {string} url
 * @returns {boolean}
 */
export function isRegisteredBlob(url) {
  return typeof url === 'string' && url.startsWith('blob:') && _objToData.has(url)
}

/**
 * Returns the byte length of the stored data for a registered blob URL.
 * Returns 0 if not registered.
 * @param {string} url
 * @returns {number}
 */
export function getBlobSize(url) {
  if (!url || !url.startsWith('blob:')) return 0
  const data = _objToData.get(url)
  return data ? data.length : 0
}

/**
 * Clears the registry and revokes all created Object URLs.
 * Call when opening a new project or closing the application.
 */
export function clearRegistry() {
  for (const objectUrl of _objToData.keys()) {
    try { URL.revokeObjectURL(objectUrl) } catch { /* ignore */ }
  }
  _objToData.clear()
  _pathToObj.clear()
}

/**
 * Returns current registry statistics (useful for diagnostics).
 * @returns {{ count: number, totalDataBytes: number }}
 */
export function getRegistryStats() {
  let totalDataBytes = 0
  for (const dataUrl of _objToData.values()) {
    totalDataBytes += dataUrl.length
  }
  return { count: _objToData.size, totalDataBytes }
}

// ── internal helpers ────────────────────────────────────────────────────────

/**
 * @param {string} dataUrl
 * @returns {Blob}
 */
function _dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',')
  const header = dataUrl.slice(0, comma)
  const body = dataUrl.slice(comma + 1)
  const mime = (header.match(/:(.*?);/) || [])[1] || 'application/octet-stream'
  const isBase64 = header.includes(';base64')
  if (isBase64) {
    const binary = atob(body)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }
  return new Blob([decodeURIComponent(body)], { type: mime })
}
