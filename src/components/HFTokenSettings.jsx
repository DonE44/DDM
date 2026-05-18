// @ts-check
/**
 * HFTokenSettings.jsx
 *
 * Settings panel for HuggingFace token authentication.
 * Allows users to input and manage HF tokens to access gated Whisper models.
 *
 * Only appears in Electron environment (desktop app).
 *
 * @param {{ onClose?: () => void }} props
 */

import { useState, useEffect } from 'react'

/** Minimum plausible HF token length (hf_ + 36 chars). */
const HF_MIN_LEN = 10

/**
 * @typedef {{ hasToken: boolean, isValid: boolean, username?: string }} TokenStatusResponse
 * @typedef {{ valid: boolean, username?: string, error?: string }} SetTokenResponse
 */

/**
 * Returns a validation message for the raw token string, or null if valid.
 * @param {string} raw
 * @returns {string|null}
 */
function validateTokenFormat(raw) {
  if (!raw.trim()) return 'Token cannot be empty'
  if (!raw.trim().startsWith('hf_')) return 'Token should start with "hf_"'
  if (raw.trim().length < HF_MIN_LEN) return 'Token looks too short'
  return null
}

export default function HFTokenSettings({ onClose }) {
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  /** @type {[{ok:boolean,message:string,username?:string}|null, Function]} */
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [availableModels, setAvailableModels] = useState(/** @type {string[]} */ ([]))
  /** Inline format-validation message shown before any API call. */
  const [formatError, setFormatError] = useState(/** @type {string|null} */ (null))

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.smmDesktop

  useEffect(() => {
    if (!isElectron) return
    void checkTokenStatus()
    // checkTokenStatus is stable (defined outside effect); isElectron is a
    // mount-time constant derived from window — neither will change after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkTokenStatus() {
    if (!isElectron) return
    
    try {
      const response = /** @type {TokenStatusResponse} */ (await window.smmDesktop.invoke('whisper:getTokenStatus'))
      setHasToken(response.hasToken)
      
      if (response.hasToken) {
        setStatus({
          ok: response.isValid,
          message: response.username ? `✅ Authenticated as: ${response.username}` : '⚠ Token stored but not validated',
          username: response.username,
        })
        updateAvailableModels(true)
      }
    } catch (err) {
      console.error('[HFTokenSettings] Failed to get token status:', err)
    }
  }

  function updateAvailableModels(tokenAvailable) {
    if (tokenAvailable) {
      setAvailableModels([
        '📊 Medium (90% accuracy) — Always available',
        '🎯 Large v3 (95%+ accuracy) — Gated, requires token ✅',
      ])
    } else {
      setAvailableModels([
        '📊 Medium (90% accuracy) — Always available',
        '🎯 Large v3 (95%+ accuracy) — Requires HF token to unlock',
      ])
    }
  }

  /** @param {string} val */
  function handleTokenChange(val) {
    setToken(val)
    setFormatError(val.trim() ? validateTokenFormat(val) : null)
  }

  /** Auto-trim whitespace when user pastes a token. */
  function handlePaste(/** @type {React.ClipboardEvent<HTMLInputElement>} */ e) {
    const pasted = e.clipboardData.getData('text').trim()
    if (pasted !== e.clipboardData.getData('text')) {
      e.preventDefault()
      handleTokenChange(pasted)
    }
  }

  /** Trigger authorize on Enter key in the input. */
  function handleKeyDown(/** @type {React.KeyboardEvent<HTMLInputElement>} */ e) {
    if (e.key === 'Enter' && !loading && token.trim() && !formatError) {
      void handleAuthorize()
    }
  }

  async function handleAuthorize() {
    const fmtErr = validateTokenFormat(token)
    if (fmtErr) {
      setFormatError(fmtErr)
      setStatus({ ok: false, message: `❌ ${fmtErr}` })
      return
    }

    if (!isElectron) {
      setStatus({ ok: false, message: '❌ Token authentication only available in Electron app' })
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      const response = /** @type {SetTokenResponse} */ (await window.smmDesktop.invoke('whisper:setHFToken', token.trim()))

      if (response.valid) {
        setStatus({
          ok: true,
          message: `✅ Success! Authenticated as: ${response.username}`,
          username: response.username,
        })
        setToken('')
        setHasToken(true)
        updateAvailableModels(true)
      } else {
        setStatus({
          ok: false,
          message: `❌ Token validation failed: ${response.error || 'Unknown error'}`,
        })
      }
    } catch (err) {
      console.error('[HFTokenSettings] Authorization error:', err)
      setStatus({
        ok: false,
        message: `❌ Authorization failed: ${err.message}`,
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleForget() {
    if (!isElectron) return

    try {
      await window.smmDesktop.invoke('whisper:clearHFToken')
      setHasToken(false)
      setStatus({ ok: false, message: '🗑 Token forgotten. You can enter a new one anytime.' })
      setToken('')
      updateAvailableModels(false)
    } catch (err) {
      console.error('[HFTokenSettings] Clear token error:', err)
      setStatus({ ok: false, message: `❌ Failed to clear token: ${err.message}` })
    }
  }

  if (!isElectron) {
    return (
      <div className="hf-token-settings disabled">
        <p>⚠ Token authentication only available in desktop app</p>
      </div>
    )
  }

  return (
    <div className="hf-token-settings">
      <div className="hf-header">
        <h3>🔐 HuggingFace Authorization</h3>
        {onClose && (
          <button className="hf-close" onClick={onClose} title="Close" aria-label="Close HuggingFace settings">✕</button>
        )}
      </div>
      
      <div className="hf-intro">
        <p>
          Large Whisper models (95%+ accuracy) are <strong>gated on HuggingFace</strong>.
          Provide your HF token to unlock them.
        </p>
        <p className="hf-link">
          Need a token? <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">
            Create one here →
          </a>
        </p>
      </div>

      <div className="hf-form">
        <label>Your HuggingFace Token:</label>
        <div className={`token-input-row${formatError ? ' invalid' : token.trim() ? ' valid' : ''}`}>
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            disabled={loading}
            aria-invalid={!!formatError}
            aria-describedby={formatError ? 'hf-format-error' : undefined}
          />
          <button
            className="hf-toggle-show"
            onClick={() => setShowToken(!showToken)}
            title={showToken ? 'Hide token' : 'Show token'}
            disabled={loading || !token}
          >
            {showToken ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
        {formatError && (
          <p id="hf-format-error" className="hf-format-error">⚠ {formatError}</p>
        )}
        <p className="hf-note">Your token is stored locally and never sent anywhere except to HuggingFace for validation.</p>
      </div>

      <div className="hf-actions">
        <button
          className="hf-authorize"
          onClick={handleAuthorize}
          disabled={loading || !token.trim() || !!formatError}
          title={formatError ? formatError : undefined}
        >
          {loading ? '⏳ Validating...' : '🔐 Authorize'}
        </button>
        {hasToken && (
          <button
            className="hf-forget"
            onClick={handleForget}
            disabled={loading}
          >
            🗑 Forget Token
          </button>
        )}
      </div>

      {status && (
        <div className={`hf-status ${status.ok ? 'success' : 'error'}`}>
          {status.message}
        </div>
      )}

      <div className="hf-models">
        <h4>📦 Available Models:</h4>
        <ul>
          {availableModels.map((model, idx) => (
            <li key={idx}>{model}</li>
          ))}
        </ul>
      </div>

      <div className="hf-faq">
        <details>
          <summary>❓ How do I get a token?</summary>
          <ol>
            <li>Go to <a href="https://huggingface.co/join" target="_blank" rel="noreferrer">huggingface.co</a> and create an account</li>
            <li>Click your profile → Settings → Access Tokens</li>
            <li>Create a new token (any name, "read" access is enough)</li>
            <li>Copy the token and paste it above</li>
          </ol>
        </details>

        <details>
          <summary>❓ What if my token expires?</summary>
          <p>
            FluxAura Studio re-validates your token every 30 days. If it expires, you'll see a validation error
            when you try to transcribe with a large model. Just get a new token and authenticate again.
          </p>
        </details>

        <details>
          <summary>❓ Is my token secure?</summary>
          <p>
            Yes. Your token is stored in the FluxAura Studio app data folder and encrypted
            by Windows (if BitLocker/EFS is enabled). FluxAura Studio never logs, telemeters, or shares your token.
          </p>
        </details>
      </div>
    </div>
  )
}
