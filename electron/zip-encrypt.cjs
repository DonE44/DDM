'use strict'

/**
 * zip-encrypt.cjs
 * IPC handler for creating AES-256-encrypted ZIP bundles via archiver + archiver-zip-encrypted.
 * Called from the renderer when publishUtils.exportAsZip() has a password set.
 *
 * IPC channel: 'export:save-zip-encrypted'
 * Payload: { files: [{name: string, base64: string}], password: string, defaultName: string, outputFolder?: string }
 * Returns: { ok: boolean, filePath?: string, error?: string, canceled?: boolean }
 */

const { ipcMain, dialog, BrowserWindow } = require('electron')
const path = require('path')
const fsp = require('fs/promises')
const fs = require('fs')
const { Readable, PassThrough } = require('stream')

// Dynamically load archiver + plugin to avoid crashing if not installed
let archiver = null
let zipEncrypted = null
try {
  archiver = require('archiver')
  zipEncrypted = require('archiver-zip-encrypted')
} catch (e) {
  console.warn('[zip-encrypt] archiver/archiver-zip-encrypted not available:', e.message)
}

/**
 * Build an AES-256 encrypted ZIP buffer from an array of {name, base64} entries.
 * Returns a Buffer of the final ZIP file.
 */
function buildEncryptedZip(files, password) {
  return new Promise((resolve, reject) => {
    if (!archiver || !zipEncrypted) {
      reject(new Error('archiver-zip-encrypted is not installed. Run: npm install archiver archiver-zip-encrypted'))
      return
    }

    // Register the encryption format (safe to call multiple times)
    try {
      archiver.registerFormat('zip-encrypted', zipEncrypted)
    } catch (_) {
      // Already registered — ignore
    }

    const archive = archiver.create('zip-encrypted', {
      zlib: { level: 6 },
      encryptionMethod: 'aes256',
      password,
    })

    const chunks = []
    const output = new PassThrough()
    output.on('data', (chunk) => chunks.push(chunk))
    output.on('end', () => resolve(Buffer.concat(chunks)))
    output.on('error', reject)

    archive.pipe(output)
    archive.on('error', reject)
    archive.on('warning', (warn) => {
      if (warn.code !== 'ENOENT') console.warn('[zip-encrypt] archiver warning:', warn.message)
    })

    for (const { name, base64 } of files) {
      const buf = Buffer.from(base64, 'base64')
      const readable = Readable.from(buf)
      archive.append(readable, { name })
    }

    archive.finalize()
  })
}

function registerZipEncryptIPC() {
  ipcMain.handle('export:save-zip-encrypted', async (_evt, payload = {}) => {
    const { files, password, defaultName, outputFolder, filters } = payload

    if (!files || !Array.isArray(files) || files.length === 0) {
      return { ok: false, error: 'No files provided' }
    }
    if (!password) {
      return { ok: false, error: 'No password provided — use regular ZIP export for unencrypted bundles' }
    }
    if (!defaultName) {
      return { ok: false, error: 'Missing defaultName' }
    }

    try {
      // Build the encrypted ZIP buffer
      const zipBuffer = await buildEncryptedZip(files, password)

      let filePath
      if (outputFolder) {
        filePath = path.join(outputFolder, defaultName)
      } else {
        const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
        const { filePath: fp, canceled } = await dialog.showSaveDialog(win, {
          title: 'Save Encrypted ZIP Bundle',
          defaultPath: defaultName,
          filters: filters || [
            { name: 'ZIP Archive', extensions: ['zip'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        })
        if (canceled || !fp) return { ok: false, canceled: true }
        filePath = fp
      }

      await fsp.writeFile(filePath, zipBuffer)
      return { ok: true, filePath, fileName: path.basename(filePath) }
    } catch (err) {
      console.error('[zip-encrypt] Error creating encrypted ZIP:', err)
      return { ok: false, error: String(err.message || err) }
    }
  })
}

module.exports = { registerZipEncryptIPC }
