/**
 * HuggingFace Token Management & Authentication
 * 
 * Handles:
 * - Token storage in user data directory
 * - Token validation via HuggingFace API
 * - HF_TOKEN environment variable setup
 * - Token expiration checking
 */

const fs = require('fs').promises
const path = require('path')
const https = require('https')
const http = require('http')

let _configPath = null

/**
 * Initialize token config file path
 */
function init(userDataPath) {
  _configPath = path.join(userDataPath, 'whisper-config.json')
  console.log('[hf-auth] Config path:', _configPath)
}

/**
 * Load HF token config from disk
 */
async function loadConfig() {
  try {
    const data = await fs.readFile(_configPath, 'utf8')
    return JSON.parse(data)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[hf-auth] Failed to load config:', err.message)
    }
    return {}
  }
}

/**
 * Save HF token config to disk
 */
async function saveConfig(config) {
  try {
    await fs.writeFile(_configPath, JSON.stringify(config, null, 2), 'utf8')
    console.log('[hf-auth] Config saved')
  } catch (err) {
    console.error('[hf-auth] Failed to save config:', err.message)
    throw err
  }
}

/**
 * Fetch from HTTPS/HTTP (for token validation)
 */
async function fetchWithToken(url, token) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const requestOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'FluxAuraStudio/0.1.0',
      },
    }

    protocol.get(url, requestOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : {},
          })
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          })
        }
      })
    }).on('error', reject)
  })
}

/**
 * Validate HuggingFace token
 * 
 * Returns: { valid: boolean, username?: string, error?: string }
 */
async function validateToken(token) {
  if (!token) {
    return { valid: false, error: 'No token provided' }
  }

  try {
    console.log('[hf-auth] Validating token...')
    const response = await fetchWithToken('https://huggingface.co/api/whoami', token)

    if (response.status === 401) {
      return { valid: false, error: 'Token invalid or expired' }
    }

    if (response.status >= 400) {
      return {
        valid: false,
        error: `HuggingFace API error: ${response.status}`,
      }
    }

    const user = response.body
    if (!user.name) {
      return { valid: false, error: 'Unexpected HuggingFace API response' }
    }

    console.log(`[hf-auth] ✅ Token valid for user: ${user.name}`)
    return {
      valid: true,
      username: user.name,
      userId: user.id,
    }
  } catch (err) {
    console.error('[hf-auth] Token validation error:', err.message)
    return {
      valid: false,
      error: `Validation failed: ${err.message}`,
    }
  }
}

/**
 * Set and save HF token
 * 
 * Validates token, saves to config, sets env var
 */
async function setToken(token) {
  const validation = await validateToken(token)

  if (!validation.valid) {
    return validation
  }

  // Save token to config file
  const config = await loadConfig()
  config.hfToken = token
  config.tokenValidatedAt = new Date().toISOString()
  config.username = validation.username
  config.userId = validation.userId

  await saveConfig(config)

  // Set environment variable for @xenova/transformers
  process.env.HF_TOKEN = token
  console.log('[hf-auth] HF_TOKEN set in environment')

  return { valid: true, username: validation.username }
}

/**
 * Get token from config (if still valid)
 */
async function getToken() {
  const config = await loadConfig()

  if (!config.hfToken) {
    return null
  }

  // Check if token was recently validated (within 30 days)
  if (config.tokenValidatedAt) {
    const validatedAt = new Date(config.tokenValidatedAt).getTime()
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)

    if (validatedAt < thirtyDaysAgo) {
      console.log('[hf-auth] Token validation is stale (>30 days), will re-validate on next use')
      // Don't set env var yet, let it be re-validated on first transcribe
      return null
    }
  }

  // Token is recent, use it
  process.env.HF_TOKEN = config.hfToken
  return config.hfToken
}

/**
 * Clear token (user clicked "Forget")
 */
async function clearToken() {
  const config = await loadConfig()
  delete config.hfToken
  delete config.tokenValidatedAt
  delete config.username
  delete config.userId
  await saveConfig(config)
  delete process.env.HF_TOKEN
  console.log('[hf-auth] HF_TOKEN cleared')
  return { success: true }
}

/**
 * Get token status (for UI display)
 */
async function getStatus() {
  const config = await loadConfig()

  return {
    hasToken: !!config.hfToken,
    username: config.username || null,
    validatedAt: config.tokenValidatedAt || null,
    isValid: !!process.env.HF_TOKEN,
  }
}

module.exports = {
  init,
  setToken,
  getToken,
  clearToken,
  validateToken,
  getStatus,
}
