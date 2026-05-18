// @ts-check
/**
 * translate-ipc.cjs — Offline text translation via NLLB-200.
 *
 * Uses Xenova/nllb-200-distilled-600M via @xenova/transformers (Node.js main process).
 * ~1.2 GB first-time download, cached permanently in userData/translate-models.
 *
 * Supports 200+ languages via NLLB language codes (e.g. eng_Latn, fra_Latn).
 *
 * IPC channels:
 *   translate:start   → { texts[], srcLang, tgtLang } → { ok, texts[] } or { ok:false, error }
 *   translate:cancel  → cancels in-progress translation
 *   translate:status  → { cached: bool }
 *
 * Progress events (sent to renderer on 'translate:progress'):
 *   { type: 'model', status, file, progress }
 *   { type: 'progress', done, total }
 *   { status: string }
 */

const { ipcMain, app } = require('electron')
const path  = require('path')
const fs    = require('fs')

const TRANSLATE_MODEL = 'Xenova/nllb-200-distilled-600M'

let _pipeline = null
let _cancelFlag = false

function getCacheDir() {
  return path.join(app.getPath('userData'), 'translate-models')
}

async function runTranslation(event, { texts, srcLang, tgtLang }) {
  const send = (data) => { try { event.sender.send('translate:progress', data) } catch {} }
  _cancelFlag = false

  if (!Array.isArray(texts) || texts.length === 0) throw new Error('No text provided.')
  if (!tgtLang) throw new Error('Target language is required.')

  // Load pipeline (singleton — keep in memory)
  if (!_pipeline) {
    const { pipeline, env } = await import('@xenova/transformers')
    env.cacheDir          = getCacheDir()
    env.allowLocalModels  = true
    env.allowRemoteModels = true
    env.useBrowserCache   = false
    env.useFSCache        = true

    send({ status: `Loading translation model… (first run: ~1.2 GB download)` })

    _pipeline = await pipeline('translation', TRANSLATE_MODEL, {
      quantized: true,
      progress_callback: (prog) => send({ type: 'model', ...prog }),
    })
  } else {
    send({ status: 'Translation model ready.' })
  }

  if (_cancelFlag) throw new Error('Cancelled')

  send({ status: `Translating ${texts.length} lines from ${srcLang} → ${tgtLang}…` })

  const results = []
  for (let i = 0; i < texts.length; i++) {
    if (_cancelFlag) throw new Error('Cancelled')
    const input = texts[i]
    if (!input.trim()) {
      results.push('')
      continue
    }
    const out = await _pipeline(input, {
      src_lang: srcLang || 'eng_Latn',
      tgt_lang: tgtLang,
      max_new_tokens: 256,
    })
    results.push((out?.[0]?.translation_text || input).trim())
    send({ type: 'progress', done: i + 1, total: texts.length })
  }

  return results
}

function registerTranslateIPC() {
  ipcMain.handle('translate:start', async (event, payload) => {
    try {
      const translated = await runTranslation(event, payload || {})
      return { ok: true, texts: translated }
    } catch (err) {
      const msg = err?.message || String(err)
      if (msg !== 'Cancelled') console.error('[translate-ipc] Error:', msg)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle('translate:cancel', () => {
    _cancelFlag = true
    return { ok: true }
  })

  ipcMain.handle('translate:status', async () => {
    const dir = path.join(getCacheDir(), TRANSLATE_MODEL.replace(/\//g, '--'))
    return { cached: fs.existsSync(dir) }
  })
}

module.exports = { registerTranslateIPC }
