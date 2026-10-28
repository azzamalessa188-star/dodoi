'use strict'

const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')

const { LOCAL_PROVIDER } = require('./local-languages.cjs')

const ENV_KEYS = Object.freeze({
  provider: 'DODOI_PROVIDER',
  apiKey: 'DODOI_API_KEY',
  apiUrl: 'DODOI_API_URL',
  model: 'DODOI_MODEL',
  targetLanguage: 'DODOI_TARGET_LANGUAGE',
  shortcut: 'DODOI_SHORTCUT',
  launchAtStartup: 'DODOI_LAUNCH_AT_STARTUP',
  smartFallback: 'DODOI_SMART_FALLBACK',
  fallbackProvider: 'DODOI_FALLBACK_PROVIDER',
  fallbackApiUrl: 'DODOI_FALLBACK_API_URL',
  fallbackModel: 'DODOI_FALLBACK_MODEL',
})

const DEFAULT_SETTINGS = Object.freeze({
  provider: 'openai',
  apiKey: '',
  apiUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  targetLanguage: 'English',
  shortcut: 'Shift+`',
  launchAtStartup: false,
  smartFallback: true,
  fallbackProvider: 'openai',
  fallbackApiUrl: 'https://api.openai.com/v1',
  fallbackModel: 'gpt-4o-mini',
})

const ENV_HEADER = `# ── Dodoi configuration ─────────────────────────────────────────────
# Managed by Dodoi, but safe to edit by hand.
# Restart Dodoi after changing the keyboard shortcut manually.
`

const KNOWN_ENV_KEYS = new Set(Object.values(ENV_KEYS))

class ConfigError extends Error {
  constructor(message, field = null, code = 'INVALID_CONFIG') {
    super(message)
    this.name = 'ConfigError'
    this.field = field
    this.code = code
  }
}

function asString(value, fallback = '') {
  if (value === undefined || value === null) return fallback
  return String(value).trim()
}

function asBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === undefined || value === null || value === '') return fallback
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function stripTrailingSlashes(value) {
  return value.replace(/\/+$/, '')
}

function inferProviderFromUrl(value) {
  try {
    const host = new URL(String(value || '')).hostname.toLowerCase()
    if (host === 'openrouter.ai' || host.endsWith('.openrouter.ai')) return 'openrouter'
    if (host === 'api.groq.com' || host.endsWith('.groq.com')) return 'groq'
    if (host === 'api.openai.com' || host.endsWith('.openai.com')) return 'openai'
  } catch {
    // A missing or invalid URL has no provider hint.
  }
  return 'custom'
}

function normalizeApiUrl(value) {
  const raw = asString(value)
  if (!raw) throw new ConfigError('Enter an API endpoint URL.', 'apiUrl', 'INVALID_API_URL')

  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new ConfigError('The API endpoint must be a valid URL.', 'apiUrl', 'INVALID_API_URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ConfigError('The API endpoint must start with http:// or https://.', 'apiUrl', 'INVALID_API_URL')
  }

  if (parsed.username || parsed.password) {
    throw new ConfigError('The API endpoint must not contain a username or password.', 'apiUrl', 'INVALID_API_URL')
  }

  return stripTrailingSlashes(parsed.toString())
}

function validateSettings(settings) {
  const provider = asString(settings.provider)
  if (!provider) throw new ConfigError('Choose an API provider.', 'provider', 'INVALID_PROVIDER')
  if (provider.length > 80) throw new ConfigError('The provider name is too long.', 'provider', 'INVALID_PROVIDER')

  let apiUrl
  try {
    apiUrl = normalizeApiUrl(settings.apiUrl)
  } catch (error) {
    if (error instanceof ConfigError) throw error
    throw new ConfigError('The API endpoint is invalid.', 'apiUrl', 'INVALID_API_URL')
  }

  const apiKey = asString(settings.apiKey)
  if (/[\r\n]/.test(apiKey)) {
    throw new ConfigError('The API key must be a single line.', 'apiKey', 'INVALID_API_KEY')
  }
  if (apiKey.length > 1200) {
    throw new ConfigError('The API key is too long.', 'apiKey', 'INVALID_API_KEY')
  }

  const model = asString(settings.model)
  if (!model) throw new ConfigError('Enter a model name.', 'model', 'INVALID_MODEL')
  if (model.length > 160) throw new ConfigError('The model name is too long.', 'model', 'INVALID_MODEL')

  const targetLanguage = asString(settings.targetLanguage)
  if (!targetLanguage) throw new ConfigError('Choose a target language.', 'targetLanguage', 'INVALID_LANGUAGE')
  if (targetLanguage.length > 80) {
    throw new ConfigError('The target language name is too long.', 'targetLanguage', 'INVALID_LANGUAGE')
  }
  if (/[\r\n]/.test(targetLanguage)) {
    throw new ConfigError('The target language must be a single line.', 'targetLanguage', 'INVALID_LANGUAGE')
  }

  const shortcut = asString(settings.shortcut)
  if (!shortcut) throw new ConfigError('Choose a global shortcut.', 'shortcut', 'INVALID_SHORTCUT')
  if (shortcut.length > 80) throw new ConfigError('The shortcut is too long.', 'shortcut', 'INVALID_SHORTCUT')

  const launchAtStartup = asBoolean(settings.launchAtStartup, DEFAULT_SETTINGS.launchAtStartup)
  const smartFallback = asBoolean(settings.smartFallback, DEFAULT_SETTINGS.smartFallback)

  const fallbackProvider = asString(settings.fallbackProvider)
  if (fallbackProvider.length > 80) {
    throw new ConfigError('The fallback provider name is too long.', 'fallbackProvider', 'INVALID_PROVIDER')
  }
  if (fallbackProvider === LOCAL_PROVIDER) {
    throw new ConfigError(
      'The cloud fallback cannot use the local engine.',
      'fallbackProvider',
      'INVALID_PROVIDER',
    )
  }

  const fallbackApiUrlRaw = asString(settings.fallbackApiUrl)
  let fallbackApiUrl = ''
  if (fallbackApiUrlRaw) {
    try {
      fallbackApiUrl = normalizeApiUrl(fallbackApiUrlRaw)
    } catch (error) {
      if (error instanceof ConfigError) {
        throw new ConfigError(error.message, 'fallbackApiUrl', error.code)
      }
      throw new ConfigError('The fallback API endpoint is invalid.', 'fallbackApiUrl', 'INVALID_API_URL')
    }
  }

  const fallbackModel = asString(settings.fallbackModel)
  if (fallbackModel.length > 160) {
    throw new ConfigError('The fallback model name is too long.', 'fallbackModel', 'INVALID_MODEL')
  }

  if (fallbackProvider && (!fallbackApiUrl || !fallbackModel)) {
    throw new ConfigError(
      'The cloud fallback needs an endpoint and model.',
      !fallbackApiUrl ? 'fallbackApiUrl' : 'fallbackModel',
      'INVALID_FALLBACK',
    )
  }

  return {
    provider,
    apiKey,
    apiUrl,
    model,
    targetLanguage,
    shortcut,
    launchAtStartup,
    smartFallback,
    fallbackProvider,
    fallbackApiUrl,
    fallbackModel,
  }
}

function settingsFromEnv(parsed, fallback = DEFAULT_SETTINGS) {
  const provider = asString(parsed[ENV_KEYS.provider], fallback.provider) || fallback.provider
  const apiUrl = asString(parsed[ENV_KEYS.apiUrl], fallback.apiUrl) || fallback.apiUrl
  const model = asString(parsed[ENV_KEYS.model], fallback.model) || fallback.model

  let fallbackProvider = asString(parsed[ENV_KEYS.fallbackProvider])
  let fallbackApiUrl = asString(parsed[ENV_KEYS.fallbackApiUrl])
  let fallbackModel = asString(parsed[ENV_KEYS.fallbackModel])

  if (fallbackProvider === LOCAL_PROVIDER) fallbackProvider = ''

  if (provider !== LOCAL_PROVIDER) {
    // The live cloud connection is always the freshest fallback snapshot.
    fallbackProvider = provider
    fallbackApiUrl = apiUrl
    fallbackModel = model
  } else {
    fallbackApiUrl =
      fallbackApiUrl ||
      apiUrl ||
      fallback.fallbackApiUrl ||
      DEFAULT_SETTINGS.fallbackApiUrl
    fallbackModel =
      fallbackModel ||
      model ||
      fallback.fallbackModel ||
      DEFAULT_SETTINGS.fallbackModel
    fallbackProvider =
      fallbackProvider ||
      inferProviderFromUrl(fallbackApiUrl) ||
      fallback.fallbackProvider ||
      DEFAULT_SETTINGS.fallbackProvider
  }

  return {
    provider,
    apiKey: asString(parsed[ENV_KEYS.apiKey], fallback.apiKey),
    apiUrl,
    model,
    targetLanguage: asString(parsed[ENV_KEYS.targetLanguage], fallback.targetLanguage) || fallback.targetLanguage,
    shortcut: asString(parsed[ENV_KEYS.shortcut], fallback.shortcut) || fallback.shortcut,
    launchAtStartup: asBoolean(
      parsed[ENV_KEYS.launchAtStartup],
      fallback.launchAtStartup ?? DEFAULT_SETTINGS.launchAtStartup,
    ),
    smartFallback: asBoolean(
      parsed[ENV_KEYS.smartFallback],
      fallback.smartFallback ?? DEFAULT_SETTINGS.smartFallback,
    ),
    fallbackProvider,
    fallbackApiUrl,
    fallbackModel,
  }
}

function encodeEnvValue(value) {
  const stringValue = String(value ?? '')
  if (/[\r\n]/.test(stringValue)) {
    throw new ConfigError('Configuration values cannot contain line breaks.')
  }
  return `"${stringValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function serializeEnv(settings, extras = {}) {
  const lines = [ENV_HEADER.trimEnd(), '']

  for (const [field, envKey] of Object.entries(ENV_KEYS)) {
    lines.push(`${envKey}=${encodeEnvValue(settings[field])}`)
  }

  const extraEntries = Object.entries(extras).filter(
    ([key, value]) => !KNOWN_ENV_KEYS.has(key) && typeof value === 'string',
  )

  if (extraEntries.length) {
    lines.push('', '# Other variables preserved by Dodoi')
    for (const [key, value] of extraEntries) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
      lines.push(`${key}=${encodeEnvValue(value)}`)
    }
  }

  return `${lines.join('\n')}\n`
}

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

class ConfigStore {
  constructor({ filePath, seedEnv = process.env }) {
    if (!filePath) throw new Error('ConfigStore requires a filePath')
    this.filePath = filePath
    this.seedEnv = seedEnv
    this.current = { ...DEFAULT_SETTINGS }
    this.extras = {}
  }

  ensureFile() {
    if (fs.existsSync(this.filePath)) return false

    ensureDirectory(this.filePath)
    const seeded = { ...DEFAULT_SETTINGS }
    for (const [field, envKey] of Object.entries(ENV_KEYS)) {
      if (this.seedEnv && this.seedEnv[envKey] !== undefined) {
        seeded[field] = asString(this.seedEnv[envKey])
      }
    }

    const validated = validateSettings(seeded)
    fs.writeFileSync(this.filePath, serializeEnv(validated), { encoding: 'utf8', mode: 0o600 })
    try {
      fs.chmodSync(this.filePath, 0o600)
    } catch {
      // chmod is not effective on Windows; this is best-effort only.
    }
    return true
  }

  reload() {
    this.ensureFile()
    const raw = fs.readFileSync(this.filePath, 'utf8')
    const parsed = dotenv.parse(raw)
    this.extras = Object.fromEntries(
      Object.entries(parsed).filter(([key]) => !KNOWN_ENV_KEYS.has(key)),
    )
    this.current = settingsFromEnv(parsed, DEFAULT_SETTINGS)
    return this.current
  }

  save(patch) {
    const merged = validateSettings({
      ...this.current,
      ...patch,
    })

    if (merged.provider !== LOCAL_PROVIDER) {
      // Keep the last real cloud connection ready for local Smart Fallback.
      merged.fallbackProvider = merged.provider
      merged.fallbackApiUrl = merged.apiUrl
      merged.fallbackModel = merged.model
    }

    ensureDirectory(this.filePath)
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`
    fs.writeFileSync(temporaryPath, serializeEnv(merged, this.extras), {
      encoding: 'utf8',
      mode: 0o600,
    })

    try {
      fs.chmodSync(temporaryPath, 0o600)
    } catch {
      // Best effort on platforms without POSIX permissions.
    }

    fs.renameSync(temporaryPath, this.filePath)
    this.current = merged
    return merged
  }

  getSettings() {
    return { ...this.current }
  }

  getPublicSettings() {
    const apiKey = this.current.apiKey
    const hint = apiKey ? (apiKey.length > 4 ? `••••${apiKey.slice(-4)}` : '••••') : ''

    return {
      provider: this.current.provider,
      apiUrl: this.current.apiUrl,
      model: this.current.model,
      targetLanguage: this.current.targetLanguage,
      shortcut: this.current.shortcut,
      launchAtStartup: this.current.launchAtStartup,
      smartFallback: this.current.smartFallback,
      fallbackProvider: this.current.fallbackProvider,
      fallbackApiUrl: this.current.fallbackApiUrl,
      fallbackModel: this.current.fallbackModel,
      apiKeyConfigured: Boolean(apiKey),
      apiKeyHint: hint,
      envPath: this.filePath,
    }
  }
}

module.exports = {
  ConfigStore,
  ConfigError,
  DEFAULT_SETTINGS,
  ENV_KEYS,
  inferProviderFromUrl,
  normalizeApiUrl,
  serializeEnv,
  settingsFromEnv,
  validateSettings,
}
