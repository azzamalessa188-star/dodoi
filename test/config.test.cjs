'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  ConfigError,
  ConfigStore,
  inferProviderFromUrl,
  normalizeApiUrl,
  serializeEnv,
  settingsFromEnv,
  validateSettings,
} = require('../electron/lib/config.cjs')
const { LOCAL_PROVIDER } = require('../electron/lib/local-languages.cjs')

function makeStore(seedEnv = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dodoi-config-'))
  const filePath = path.join(directory, '.env')
  const store = new ConfigStore({ filePath, seedEnv })
  store.ensureFile()
  store.reload()
  return { directory, filePath, store }
}

test('creates a .env with defaults and reads it back', () => {
  const { filePath, store } = makeStore({})
  const raw = fs.readFileSync(filePath, 'utf8')

  assert.match(raw, /DODOI_PROVIDER="openai"/)
  assert.match(raw, /DODOI_TARGET_LANGUAGE="English"/)
  assert.match(raw, /DODOI_API_URL="https:\/\/api\.openai\.com\/v1"/)
  assert.equal(store.getSettings().shortcut, 'Shift+`')
})

test('seeds the first .env from environment variables', () => {
  const { store } = makeStore({
    DODOI_API_KEY: 'env-key',
    DODOI_TARGET_LANGUAGE: 'Thai',
    DODOI_MODEL: 'custom-model',
  })

  assert.equal(store.getSettings().apiKey, 'env-key')
  assert.equal(store.getSettings().targetLanguage, 'Thai')
  assert.equal(store.getSettings().model, 'custom-model')
})

test('saves changes, masks the key, and reloads from disk', () => {
  const { store } = makeStore({})
  store.save({
    apiKey: 'sk-test-12345678',
    provider: 'openrouter',
    apiUrl: 'https://openrouter.ai/api/v1/',
    model: 'openai/gpt-4o-mini',
    targetLanguage: 'Thai',
    shortcut: 'CommandOrControl+Shift+Space',
  })

  const publicSettings = store.getPublicSettings()
  assert.equal(publicSettings.apiKeyConfigured, true)
  assert.equal(publicSettings.apiKeyHint, '••••5678')
  assert.equal(publicSettings.apiKey, undefined)
  assert.equal(publicSettings.apiUrl, 'https://openrouter.ai/api/v1')

  const reloaded = new ConfigStore({ filePath: store.filePath, seedEnv: {} })
  reloaded.reload()
  assert.equal(reloaded.getSettings().targetLanguage, 'Thai')
  assert.equal(reloaded.getSettings().shortcut, 'CommandOrControl+Shift+Space')
})

test('preserves unrelated environment variables when saving', () => {
  const { filePath, store } = makeStore({})
  fs.appendFileSync(filePath, '\nMY_EXTRA_SETTING="hello"\n')
  store.reload()
  store.save({ targetLanguage: 'Japanese' })

  const raw = fs.readFileSync(filePath, 'utf8')
  assert.match(raw, /DODOI_TARGET_LANGUAGE="Japanese"/)
  assert.match(raw, /MY_EXTRA_SETTING="hello"/)

  const reloaded = new ConfigStore({ filePath, seedEnv: {} })
  reloaded.reload()
  assert.equal(reloaded.getSettings().targetLanguage, 'Japanese')
})

test('rejects invalid API URLs and multiline values', () => {
  assert.throws(() => normalizeApiUrl('ftp://example.com/v1'), ConfigError)
  assert.throws(() => normalizeApiUrl('not-a-url'), ConfigError)
  assert.throws(
    () =>
      validateSettings({
        provider: 'openai',
        apiKey: 'key',
        apiUrl: 'https://example.com/v1',
        model: 'model',
        targetLanguage: 'English\nInjected',
        shortcut: 'Shift+`',
      }),
    ConfigError,
  )
})

test('quotes environment values safely', () => {
  const serialized = serializeEnv({
    provider: 'custom',
    apiKey: 'key"with\\characters',
    apiUrl: 'https://example.com/v1',
    model: 'model',
    targetLanguage: 'English',
    shortcut: 'Shift+`',
  })

  const parsed = settingsFromEnv({
    DODOI_PROVIDER: 'custom',
    DODOI_API_KEY: 'key"with\\characters',
    DODOI_API_URL: 'https://example.com/v1',
    DODOI_MODEL: 'model',
    DODOI_TARGET_LANGUAGE: 'English',
    DODOI_SHORTCUT: 'Shift+`',
  })
  assert.equal(parsed.apiKey, 'key"with\\characters')
  assert.match(serialized, /DODOI_API_KEY="key\\"with\\\\characters"/)
})

test('defaults launch at startup off and persists changes', () => {
  const { filePath, store } = makeStore({})

  assert.equal(store.getSettings().launchAtStartup, false)
  assert.match(fs.readFileSync(filePath, 'utf8'), /DODOI_LAUNCH_AT_STARTUP="false"/)

  store.save({ launchAtStartup: true })
  assert.equal(store.getSettings().launchAtStartup, true)
  assert.match(fs.readFileSync(filePath, 'utf8'), /DODOI_LAUNCH_AT_STARTUP="true"/)

  const reloaded = new ConfigStore({ filePath, seedEnv: {} })
  reloaded.reload()
  assert.equal(reloaded.getSettings().launchAtStartup, true)
})

test('reads launch at startup from the environment', () => {
  const { store } = makeStore({ DODOI_LAUNCH_AT_STARTUP: 'yes' })
  assert.equal(store.getSettings().launchAtStartup, true)
})

test('creates Smart Fallback defaults', () => {
  const { filePath, store } = makeStore({})
  const settings = store.getSettings()

  assert.equal(settings.smartFallback, true)
  assert.equal(settings.fallbackProvider, 'openai')
  assert.equal(settings.fallbackApiUrl, 'https://api.openai.com/v1')
  assert.equal(settings.fallbackModel, 'gpt-4o-mini')
  assert.match(fs.readFileSync(filePath, 'utf8'), /DODOI_SMART_FALLBACK="true"/)
})

test('updates the cloud snapshot whenever a cloud provider is saved', () => {
  const { store } = makeStore({})
  store.save({
    provider: 'openrouter',
    apiUrl: 'https://openrouter.ai/api/v1',
    model: 'some/model:free',
  })

  let settings = store.getSettings()
  assert.equal(settings.fallbackProvider, 'openrouter')
  assert.equal(settings.fallbackApiUrl, 'https://openrouter.ai/api/v1')
  assert.equal(settings.fallbackModel, 'some/model:free')

  const reloaded = new ConfigStore({ filePath: store.filePath, seedEnv: {} })
  reloaded.reload()
  settings = reloaded.getSettings()
  assert.equal(settings.fallbackProvider, 'openrouter')
  assert.equal(settings.fallbackModel, 'some/model:free')
})

test('keeps the cloud snapshot when switching to the local provider', () => {
  const { filePath, store } = makeStore({})
  store.save({
    provider: 'openrouter',
    apiUrl: 'https://openrouter.ai/api/v1',
    model: 'some/model:free',
  })
  store.save({
    provider: LOCAL_PROVIDER,
    smartFallback: false,
    targetLanguage: 'Thai',
  })

  const settings = store.getSettings()
  assert.equal(settings.provider, LOCAL_PROVIDER)
  assert.equal(settings.smartFallback, false)
  assert.equal(settings.apiUrl, 'https://openrouter.ai/api/v1')
  assert.equal(settings.fallbackProvider, 'openrouter')
  assert.equal(settings.fallbackApiUrl, 'https://openrouter.ai/api/v1')
  assert.equal(settings.fallbackModel, 'some/model:free')

  const raw = fs.readFileSync(filePath, 'utf8')
  assert.match(raw, /DODOI_PROVIDER="local-nllb"/)
  assert.match(raw, /DODOI_FALLBACK_PROVIDER="openrouter"/)
  assert.match(raw, /DODOI_SMART_FALLBACK="false"/)
})

test('infers the fallback provider for a hand-edited local config', () => {
  assert.equal(inferProviderFromUrl('https://openrouter.ai/api/v1'), 'openrouter')
  assert.equal(inferProviderFromUrl('https://api.groq.com/openai/v1'), 'groq')
  assert.equal(inferProviderFromUrl('https://api.openai.com/v1'), 'openai')
  assert.equal(inferProviderFromUrl('https://example.com/v1'), 'custom')

  const settings = settingsFromEnv({
    DODOI_PROVIDER: LOCAL_PROVIDER,
    DODOI_API_URL: 'https://openrouter.ai/api/v1',
    DODOI_MODEL: 'openrouter/free',
    DODOI_TARGET_LANGUAGE: 'Thai',
    DODOI_SHORTCUT: 'Shift+`',
    DODOI_SMART_FALLBACK: 'true',
  })

  assert.equal(settings.fallbackProvider, 'openrouter')
  assert.equal(settings.fallbackApiUrl, 'https://openrouter.ai/api/v1')
  assert.equal(settings.fallbackModel, 'openrouter/free')
})

test('rejects local or incomplete cloud fallbacks', () => {
  const base = {
    provider: LOCAL_PROVIDER,
    apiKey: '',
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    targetLanguage: 'English',
    shortcut: 'Shift+`',
    smartFallback: true,
  }

  assert.throws(
    () =>
      validateSettings({
        ...base,
        fallbackProvider: LOCAL_PROVIDER,
        fallbackApiUrl: 'https://api.openai.com/v1',
        fallbackModel: 'gpt-4o-mini',
      }),
    ConfigError,
  )

  assert.throws(
    () =>
      validateSettings({
        ...base,
        fallbackProvider: 'openrouter',
        fallbackApiUrl: '',
        fallbackModel: '',
      }),
    ConfigError,
  )
})
