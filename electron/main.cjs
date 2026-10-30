'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  screen,
  shell,
  Tray,
} = require('electron')

const { AutomationService } = require('./lib/automation.cjs')
const {
  ConfigError,
  ConfigStore,
  normalizeApiUrl,
  validateSettings,
} = require('./lib/config.cjs')
const { LOCAL_LANGUAGES, LOCAL_PROVIDER } = require('./lib/local-languages.cjs')
const { LocalEngine } = require('./lib/local-engine.cjs')
const { AUTOSTART_ARG, StartupManager } = require('./lib/startup.cjs')
const { UpdateManager } = require('./lib/updater.cjs')
const {
  MAX_INPUT_CHARS,
  OPENROUTER_FREE_MODEL,
  TranslationError,
  fetchFreeModels,
  testConnection,
  translateText,
} = require('./lib/translator.cjs')

const APP_ID = 'app.dodoi.translator'
const OVERLAY_WIDTH = 760
const OVERLAY_HEIGHT = 340
const SETTINGS_WIDTH = 900
const SETTINGS_HEIGHT = 780
const HIDE_ANIMATION_MS = 130
const PASTE_DELAY_MS = 80

let configStore = null
let automation = null
let localEngine = null
let updateManager = null
let startupManager = null
let overlayWindow = null
let settingsWindow = null
let settingsCreationPromise = null
let tray = null
let isQuitting = false
let isTranslating = false
let capturedTarget = null
let overlayBusy = false
let hideSequencePromise = null
let shortcutPaused = false
let registeredAccelerator = null
let registeredCanonical = null
let lastShortcutWarning = 0
const knownFreeModelsByUrl = new Map()

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function getEnvPath() {
  const override = process.env.DODOI_ENV_FILE
  if (override) {
    if (override.startsWith('~/') || override.startsWith('~\\')) {
      return path.join(app.getPath('home'), override.slice(2))
    }
    return path.resolve(override)
  }

  if (app.isPackaged) return path.join(app.getPath('userData'), '.env')
  return path.join(app.getAppPath(), '.env')
}

function getRendererUrl(page) {
  const developmentUrl = process.env.VITE_DEV_SERVER_URL
  if (developmentUrl) {
    const base = developmentUrl.endsWith('/') ? developmentUrl : `${developmentUrl}/`
    return new URL(page, base).toString()
  }
  return null
}

async function loadRendererPage(window, page) {
  const developmentUrl = getRendererUrl(page)
  if (developmentUrl) {
    await window.loadURL(developmentUrl)
  } else {
    await window.loadFile(path.join(__dirname, '..', 'dist', page))
  }
}

function getIconPath(filename) {
  return path.join(app.getAppPath(), 'build', filename)
}

function secureWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
}

function safeSend(window, channel, payload) {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return
  window.webContents.send(channel, payload)
}

function getWebPreferences() {
  return {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: false,
    devTools: !app.isPackaged,
  }
}

function getDisplayForCursor() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

function positionOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const { workArea } = getDisplayForCursor()
  const width = Math.min(OVERLAY_WIDTH, Math.max(360, workArea.width - 32))
  const height = Math.min(OVERLAY_HEIGHT, Math.max(260, workArea.height - 32))
  const x = Math.round(workArea.x + (workArea.width - width) / 2)
  const y = Math.round(workArea.y + Math.max(24, workArea.height * 0.16))
  overlayWindow.setBounds({ x, y, width, height })
}

async function createOverlayWindow() {
  const { workArea } = getDisplayForCursor()
  const width = Math.min(OVERLAY_WIDTH, Math.max(360, workArea.width - 32))
  const height = Math.min(OVERLAY_HEIGHT, Math.max(260, workArea.height - 32))

  overlayWindow = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    acceptFirstMouse: true,
    title: 'Dodoi',
    icon: getIconPath('icon.png'),
    webPreferences: getWebPreferences(),
  })

  secureWindow(overlayWindow)
  overlayWindow.setMenu?.(null)
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.setAlwaysOnTop(true, 'floating')

  overlayWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    hideOverlay({ force: !isTranslating }).catch((error) => console.error(error))
  })

  await loadRendererPage(overlayWindow, 'index.html')
}

async function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) return settingsWindow

  const display = getDisplayForCursor()
  const { workArea } = display
  const width = Math.min(SETTINGS_WIDTH, Math.max(680, workArea.width - 40))
  const height = Math.min(SETTINGS_HEIGHT, Math.max(560, workArea.height - 40))

  settingsWindow = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(680, width),
    minHeight: Math.min(560, height),
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: false,
    title: 'Dodoi Settings',
    icon: getIconPath('icon.png'),
    webPreferences: getWebPreferences(),
  })

  secureWindow(settingsWindow)
  settingsWindow.setMenu?.(null)

  settingsWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    settingsWindow.hide()
  })

  settingsWindow.on('hide', () => {
    if (shortcutPaused) {
      resumeShortcut().catch((error) => console.error('[shortcut]', error))
    }
  })

  settingsWindow.on('show', () => {
    safeSend(settingsWindow, 'settings:refresh')
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  await loadRendererPage(settingsWindow, 'settings.html')
  return settingsWindow
}

async function ensureSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) return settingsWindow
  if (!settingsCreationPromise) {
    settingsCreationPromise = createSettingsWindow().finally(() => {
      settingsCreationPromise = null
    })
  }
  return settingsCreationPromise
}

async function openSettings() {
  if (isTranslating) return
  await hideOverlay({ force: false })
  capturedTarget = null

  const window = await ensureSettingsWindow()
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function safeFormatAccelerator(accelerator) {
  try {
    return formatAccelerator(accelerator)
  } catch {
    return String(accelerator || '')
  }
}

const MODIFIER_ALIASES = new Map([
  ['commandorcontrol', 'CommandOrControl'],
  ['cmdorctrl', 'CommandOrControl'],
  ['command', 'Command'],
  ['cmd', 'Command'],
  ['control', 'Control'],
  ['ctrl', 'Control'],
  ['alt', 'Alt'],
  ['option', 'Alt'],
  ['altgr', 'AltGr'],
  ['shift', 'Shift'],
  ['super', 'Super'],
  ['meta', 'Command'],
])

const NAMED_KEYS = new Map([
  ['space', 'Space'],
  ['tab', 'Tab'],
  ['backspace', 'Backspace'],
  ['delete', 'Delete'],
  ['insert', 'Insert'],
  ['return', 'Return'],
  ['enter', 'Enter'],
  ['escape', 'Escape'],
  ['esc', 'Escape'],
  ['home', 'Home'],
  ['end', 'End'],
  ['pageup', 'PageUp'],
  ['pagedown', 'PageDown'],
  ['up', 'Up'],
  ['down', 'Down'],
  ['left', 'Left'],
  ['right', 'Right'],
  ['plus', 'Plus'],
  ['capslock', 'Capslock'],
  ['numlock', 'Numlock'],
  ['scrolllock', 'Scrolllock'],
  ['printscreen', 'PrintScreen'],
  ['volumeup', 'VolumeUp'],
  ['volumedown', 'VolumeDown'],
  ['volumemute', 'VolumeMute'],
  ['medianexttrack', 'MediaNextTrack'],
  ['mediaprevioustrack', 'MediaPreviousTrack'],
  ['mediastop', 'MediaStop'],
  ['mediaplaypause', 'MediaPlayPause'],
  ['backtick', '`'],
  ['grave', '`'],
])

for (let index = 1; index <= 24; index += 1) {
  NAMED_KEYS.set(`f${index}`, `F${index}`)
}

const MODIFIER_ORDER = ['CommandOrControl', 'Command', 'Control', 'Alt', 'AltGr', 'Shift', 'Super']

function normalizeAccelerator(input) {
  const raw = String(input || '').trim()
  if (!raw) throw new ConfigError('Choose a keyboard shortcut.', 'shortcut', 'INVALID_SHORTCUT')

  const tokens = raw.split('+').map((token) => token.trim()).filter(Boolean)
  if (!tokens.length) throw new ConfigError('Choose a keyboard shortcut.', 'shortcut', 'INVALID_SHORTCUT')

  const modifiers = new Set()
  let key = null

  for (const token of tokens) {
    const modifier = MODIFIER_ALIASES.get(token.toLowerCase())
    if (modifier) {
      modifiers.add(modifier)
      continue
    }

    if (key !== null) {
      throw new ConfigError('That key combination is not supported.', 'shortcut', 'INVALID_SHORTCUT')
    }

    if (token === '~') {
      key = '`'
      modifiers.add('Shift')
      continue
    }

    if (token.length === 1) {
      key = /[a-z]/i.test(token) ? token.toUpperCase() : token
      continue
    }

    const named = NAMED_KEYS.get(token.toLowerCase())
    if (!named) throw new ConfigError('That key combination is not supported.', 'shortcut', 'INVALID_SHORTCUT')
    key = named
  }

  if (key === null) throw new ConfigError('Include a key in the shortcut.', 'shortcut', 'INVALID_SHORTCUT')

  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier))
  return [...orderedModifiers, key].join('+')
}

function formatAccelerator(input) {
  const normalized = normalizeAccelerator(input)
  const tokens = normalized.split('+')
  const isMac = process.platform === 'darwin'
  const labels = {
    CommandOrControl: isMac ? 'Cmd' : 'Ctrl',
    Command: 'Cmd',
    Control: 'Ctrl',
    Alt: 'Alt',
    AltGr: 'AltGr',
    Shift: 'Shift',
    Super: isMac ? 'Cmd' : 'Win',
    Return: 'Enter',
    Escape: 'Esc',
  }

  return tokens
    .map((token, index) => {
      if (token === '`') return tokens.includes('Shift') ? '~' : '`'
      if (labels[token]) return labels[token]
      if (index === tokens.length - 1 && token.length === 1) return token.toUpperCase()
      return token
    })
    .join(' + ')
}

function shortcutCandidates(canonical) {
  const candidates = [canonical]
  if (canonical.endsWith('+`')) candidates.push(`${canonical.slice(0, -1)}~`)
  if (canonical === '`') candidates.push('~')
  return [...new Set(candidates)]
}

function tryRegisterAccelerator(canonical, handler) {
  for (const candidate of shortcutCandidates(canonical)) {
    try {
      if (globalShortcut.register(candidate, handler)) return candidate
    } catch (error) {
      console.warn(`[shortcut] Could not register ${candidate}:`, error.message)
    }
  }
  return null
}

function handleGlobalShortcut() {
  if (isQuitting) return
  toggleOverlay().catch((error) => console.error('[overlay]', error))
}

function registerConfiguredShortcut({ announce = false } = {}) {
  let configured
  try {
    configured = normalizeAccelerator(configStore.getSettings().shortcut)
  } catch (error) {
    console.warn(`[shortcut] Invalid shortcut in .env: ${error.message}`)
    if (announce) {
      showNotification(
        'Shortcut needs attention',
        'The saved shortcut is not valid. Open Settings and record a new one.',
        openSettings,
      )
    }
    return false
  }

  const actual = tryRegisterAccelerator(configured, handleGlobalShortcut)
  if (!actual) {
    if (announce) {
      showNotification(
        'Shortcut unavailable',
        `Dodoi could not register ${safeFormatAccelerator(configured)}. Open Settings to choose another shortcut.`,
        openSettings,
      )
    }
    return false
  }

  registeredAccelerator = actual
  registeredCanonical = configured
  shortcutPaused = false
  return true
}

function releaseShortcut() {
  if (registeredAccelerator) {
    try {
      globalShortcut.unregister(registeredAccelerator)
    } catch {
      // The shortcut may already be gone.
    }
  }
  registeredAccelerator = null
  registeredCanonical = null
}

async function pauseShortcut() {
  if (shortcutPaused) return
  releaseShortcut()
  shortcutPaused = true
}

async function resumeShortcut() {
  if (!shortcutPaused) {
    return { ok: Boolean(registeredAccelerator), shortcutActive: Boolean(registeredAccelerator) }
  }

  shortcutPaused = false
  try {
    configStore.reload()
    try {
      normalizeAccelerator(configStore.getSettings().shortcut)
    } catch {
      return {
        ok: false,
        shortcutActive: false,
        error: {
          message: 'The saved shortcut is invalid. Save a new one to activate it.',
          field: 'shortcut',
          code: 'INVALID_SHORTCUT',
        },
      }
    }

    const ok = registerConfiguredShortcut()
    if (!ok) {
      const label = safeFormatAccelerator(configStore.getSettings().shortcut)
      return {
        ok: false,
        shortcutActive: false,
        error: {
          message: `Could not register ${label}. It may already be used by another app.`,
          field: 'shortcut',
          code: 'SHORTCUT_UNAVAILABLE',
        },
      }
    }
    return { ok: true, shortcutActive: true }
  } catch (error) {
    return {
      ok: false,
      shortcutActive: false,
      error: toClientError(error),
    }
  }
}

function matchesConfiguredShortcut() {
  try {
    const configured = normalizeAccelerator(configStore.getSettings().shortcut)
    return Boolean(registeredAccelerator) && configured === registeredCanonical && !shortcutPaused
  } catch {
    return false
  }
}

function syncShortcutWithConfig() {
  if (shortcutPaused || matchesConfiguredShortcut()) return

  let configured
  try {
    configured = normalizeAccelerator(configStore.getSettings().shortcut)
  } catch (error) {
    if (Date.now() - lastShortcutWarning > 60_000) {
      lastShortcutWarning = Date.now()
      console.warn(`[shortcut] Invalid shortcut in .env: ${error.message}`)
    }
    return
  }

  const oldAccelerator = registeredAccelerator
  const actual = tryRegisterAccelerator(configured, handleGlobalShortcut)
  if (!actual) {
    if (Date.now() - lastShortcutWarning > 60_000) {
      lastShortcutWarning = Date.now()
      console.warn(`[shortcut] Could not activate ${configured}`)
    }
    return
  }

  if (oldAccelerator) {
    try {
      globalShortcut.unregister(oldAccelerator)
    } catch {
      // Ignore stale registrations.
    }
  }
  registeredAccelerator = actual
  registeredCanonical = configured
}

function showNotification(title, body, onClick = null) {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title,
    body,
    silent: false,
  })
  if (onClick) {
    notification.on('click', () => {
      Promise.resolve(onClick()).catch((error) => console.error(error))
    })
  }
  notification.show()
}

function toClientError(error) {
  if (error instanceof TranslationError) {
    return {
      message: error.message,
      code: error.code,
      field: error.field,
      status: error.status,
      detail: error.detail || undefined,
    }
  }
  if (error instanceof ConfigError) {
    return {
      message: error.message,
      code: error.code,
      field: error.field,
    }
  }
  return {
    message: 'Something went wrong. Please try again.',
    code: 'UNEXPECTED_ERROR',
  }
}

function getSettingsView() {
  const publicSettings = configStore.getPublicSettings()
  return {
    ...publicSettings,
    shortcutLabel: safeFormatAccelerator(publicSettings.shortcut),
    shortcutActive:
      Boolean(registeredAccelerator) &&
      globalShortcut.isRegistered(registeredAccelerator) &&
      matchesConfiguredShortcut(),
    shortcutPaused,
    maxInputChars: MAX_INPUT_CHARS,
    localStatus: localEngine ? localEngine.getStatus() : null,
    localLanguages: LOCAL_LANGUAGES.map((language) => language.label),
    startupSupported: Boolean(startupManager?.supported),
    update: updateManager ? updateManager.getStatus() : null,
    version: app.getVersion(),
    platform: process.platform,
  }
}

function getOverlayPayload() {
  const settings = configStore.getSettings()
  return {
    provider: settings.provider,
    targetLanguage: settings.targetLanguage,
    shortcutLabel: safeFormatAccelerator(settings.shortcut),
    apiKeyConfigured: Boolean(settings.apiKey) || settings.provider === LOCAL_PROVIDER,
    localOnline: settings.provider === LOCAL_PROVIDER && Boolean(localEngine?.getStatus().online),
    maxInputChars: MAX_INPUT_CHARS,
  }
}

async function showOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed() || isQuitting) return
  if (isTranslating) return
  if (overlayWindow.isVisible()) return

  try {
    configStore.reload()
    syncShortcutWithConfig()
  } catch (error) {
    console.error('[config] Could not reload .env:', error)
  }

  if (hideSequencePromise) {
    await hideSequencePromise.catch(() => {})
  }

  const settingsWasFocused = Boolean(settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isFocused())
  capturedTarget = settingsWasFocused
    ? null
    : await automation.captureActiveWindow().catch(() => null)

  positionOverlay()
  overlayWindow.show()
  overlayWindow.focus()
  overlayWindow.moveTop()
  safeSend(overlayWindow, 'overlay:shown', getOverlayPayload())
  overlayWindow.webContents.focus()
}

async function hideOverlay({ force = false } = {}) {
  if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) return true
  if (isTranslating && !force) return false
  if (hideSequencePromise) return hideSequencePromise

  hideSequencePromise = (async () => {
    safeSend(overlayWindow, 'overlay:hide')
    await delay(HIDE_ANIMATION_MS)
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide()
    return true
  })()

  try {
    return await hideSequencePromise
  } finally {
    hideSequencePromise = null
  }
}

async function toggleOverlay() {
  if (overlayBusy || isTranslating) return
  overlayBusy = true
  try {
    if (overlayWindow?.isVisible()) {
      if (isTranslating) return
      const hidden = await hideOverlay()
      if (hidden) capturedTarget = null
    } else {
      await showOverlay()
    }
  } finally {
    overlayBusy = false
  }
}

function resolveDraftApiKey(payload, current) {
  if (payload?.clearApiKey === true) return ''
  if (typeof payload?.apiKey === 'string' && payload.apiKey.trim()) return payload.apiKey.trim()
  return current.apiKey
}

function isSettingsSender(event) {
  return Boolean(
    settingsWindow &&
      !settingsWindow.isDestroyed() &&
      BrowserWindow.fromWebContents(event.sender) === settingsWindow,
  )
}

function isOverlaySender(event) {
  return Boolean(
    overlayWindow &&
      !overlayWindow.isDestroyed() &&
      BrowserWindow.fromWebContents(event.sender) === overlayWindow,
  )
}

function buildSaveDraft(payload, current) {
  return validateSettings({
    ...current,
    provider: typeof payload?.provider === 'string' ? payload.provider : current.provider,
    apiKey: resolveDraftApiKey(payload, current),
    apiUrl: typeof payload?.apiUrl === 'string' ? payload.apiUrl : current.apiUrl,
    model: typeof payload?.model === 'string' ? payload.model : current.model,
    targetLanguage:
      typeof payload?.targetLanguage === 'string' ? payload.targetLanguage : current.targetLanguage,
    shortcut: typeof payload?.shortcut === 'string' ? payload.shortcut : current.shortcut,
    launchAtStartup:
      typeof payload?.launchAtStartup === 'boolean'
        ? payload.launchAtStartup
        : current.launchAtStartup,
    smartFallback:
      typeof payload?.smartFallback === 'boolean' ? payload.smartFallback : current.smartFallback,
  })
}

async function handleSaveSettings(event, payload) {
  if (!isSettingsSender(event)) {
    return { ok: false, error: { message: 'Settings can only be saved from the settings window.' } }
  }

  try {
    configStore.reload()
    const current = configStore.getSettings()
    const draft = buildSaveDraft(payload || {}, current)
    const desiredCanonical = normalizeAccelerator(draft.shortcut)
    let currentCanonical = null
    try {
      currentCanonical = normalizeAccelerator(current.shortcut)
    } catch {
      // A hand-edited .env may contain an invalid shortcut; saving a valid one should repair it.
    }
    const shortcutChanged = currentCanonical === null || desiredCanonical !== currentCanonical
    const wasPaused = shortcutPaused
    const oldAccelerator = registeredAccelerator
    const needsRegistration = shortcutChanged || wasPaused || !registeredAccelerator
    const startupChanged = draft.launchAtStartup !== current.launchAtStartup
    let newlyRegistered = null
    let startupApplied = false

    if (startupChanged && !startupManager?.supported) {
      throw new ConfigError(
        'Launch at startup is not available on this system.',
        'launchAtStartup',
        'STARTUP_UNAVAILABLE',
      )
    }

    if (needsRegistration) {
      newlyRegistered = tryRegisterAccelerator(desiredCanonical, handleGlobalShortcut)
      if (!newlyRegistered && (shortcutChanged || wasPaused)) {
        throw new ConfigError(
          `Could not register ${safeFormatAccelerator(desiredCanonical)}. It may be used by another app.`,
          'shortcut',
          'SHORTCUT_UNAVAILABLE',
        )
      }
    }

    try {
      if (startupChanged) {
        try {
          startupManager.setEnabled(draft.launchAtStartup)
          startupApplied = true
        } catch (error) {
          throw new ConfigError(
            'Dodoi could not update the system startup setting. Try again, or check your desktop’s startup permissions.',
            'launchAtStartup',
            'STARTUP_UNAVAILABLE',
          )
        }
      }
      configStore.save(draft)
    } catch (error) {
      if (startupApplied) {
        try {
          startupManager.setEnabled(current.launchAtStartup)
        } catch {
          // Best effort rollback if the config write failed.
        }
      }
      if (newlyRegistered) {
        try {
          globalShortcut.unregister(newlyRegistered)
        } catch {
          // Best effort cleanup.
        }
      }
      throw error
    }

    if (newlyRegistered) {
      if (oldAccelerator && oldAccelerator !== newlyRegistered) {
        try {
          globalShortcut.unregister(oldAccelerator)
        } catch {
          // Ignore stale registrations.
        }
      }
      registeredAccelerator = newlyRegistered
      registeredCanonical = desiredCanonical
      shortcutPaused = false
    }

    if (draft.provider !== LOCAL_PROVIDER && current.provider === LOCAL_PROVIDER && localEngine) {
      const localPhase = localEngine.getStatus().phase
      if (localPhase === 'online' || localPhase === 'starting') {
        // The local engine is only kept in RAM while the local provider is selected.
        localEngine.stop().catch((error) => {
          console.warn('[local] Could not stop the engine after switching providers:', error.message)
        })
      }
    }

    const view = getSettingsView()
    safeSend(settingsWindow, 'settings:changed', view)
    if (process.platform === 'linux' && tray) {
      tray.setContextMenu(buildTrayMenu())
    }
    if (tray) tray.setToolTip(`Dodoi — ${view.shortcutLabel}`)

    return {
      ok: true,
      settings: view,
      warning:
        view.shortcutActive || shortcutPaused
          ? null
          : 'Settings saved, but the global shortcut is not active. Choose another shortcut.',
    }
  } catch (error) {
    console.error('[settings] Save failed:', error.message)
    return { ok: false, error: toClientError(error) }
  }
}

async function handleTestConnection(event, payload) {
  if (!isSettingsSender(event)) {
    return { ok: false, error: { message: 'Connection tests can only run from Settings.' } }
  }

  try {
    configStore.reload()
    const current = configStore.getSettings()
    const requestedProvider =
      typeof payload?.provider === 'string' && payload.provider.trim()
        ? payload.provider
        : current.provider

    if (requestedProvider === LOCAL_PROVIDER) {
      if (!localEngine) {
        throw new TranslationError(
          'The local engine is not available in this build.',
          'LOCAL_ENGINE_OFFLINE',
          { field: 'localEngine' },
        )
      }
      const result = await localEngine.ping()
      return { ok: true, ...result }
    }

    const apiKey = resolveDraftApiKey(payload, current)
    const apiUrl = normalizeApiUrl(
      typeof payload?.apiUrl === 'string' && payload.apiUrl.trim() ? payload.apiUrl : current.apiUrl,
    )
    const model = String(
      typeof payload?.model === 'string' && payload.model.trim() ? payload.model : current.model,
    ).trim()

    if (!apiKey) throw new TranslationError('Enter an API key before testing.', 'NO_API_KEY', { field: 'apiKey' })
    if (!model) throw new TranslationError('Enter a model name before testing.', 'NO_MODEL', { field: 'model' })

    const result = await testConnection({
      settings: { ...current, apiKey, apiUrl, model },
      fetchImpl: globalThis.fetch,
    })

    return { ok: true, ...result }
  } catch (error) {
    console.error('[settings] Connection test failed:', error.message)
    return { ok: false, error: toClientError(error) }
  }
}

async function handleFetchFreeModels(event, payload) {
  if (!isSettingsSender(event)) {
    return { ok: false, error: { message: 'Free model discovery can only run from Settings.' } }
  }

  try {
    if (payload?.provider && payload.provider !== 'openrouter') {
      throw new TranslationError('Free model discovery is available for OpenRouter.', 'INVALID_PROVIDER', {
        field: 'provider',
      })
    }

    configStore.reload()
    const current = configStore.getSettings()
    const apiUrl = normalizeApiUrl(
      typeof payload?.apiUrl === 'string' && payload.apiUrl.trim() ? payload.apiUrl : current.apiUrl,
    )

    const result = await fetchFreeModels({
      apiUrl,
      fetchImpl: globalThis.fetch,
    })

    knownFreeModelsByUrl.set(
      apiUrl,
      new Set(result.models.map((model) => model.id)),
    )

    return { ok: true, ...result }
  } catch (error) {
    console.error('[settings] Free model discovery failed:', error.message)
    return { ok: false, error: toClientError(error) }
  }
}

function localEngineForSender(event) {
  if (!isSettingsSender(event)) {
    return {
      error: {
        message: 'Local engine controls are only available from Settings.',
        code: 'INVALID_SENDER',
      },
    }
  }
  if (!localEngine) {
    return {
      error: {
        message: 'The local engine is not available in this build.',
        code: 'LOCAL_ENGINE_OFFLINE',
        field: 'localEngine',
      },
    }
  }
  return { engine: localEngine }
}

async function handleLocalStatus(event) {
  const { engine, error } = localEngineForSender(event)
  if (error) return { ok: false, error }
  return { ok: true, status: engine.getStatus() }
}

async function handleLocalPrepare(event) {
  const { engine, error } = localEngineForSender(event)
  if (error) return { ok: false, error }

  try {
    const status = await engine.prepare()
    return { ok: true, status }
  } catch (prepareError) {
    return { ok: false, error: toClientError(prepareError), status: engine.getStatus() }
  }
}

async function handleLocalStart(event) {
  const { engine, error } = localEngineForSender(event)
  if (error) return { ok: false, error }

  try {
    const status = await engine.start()
    return { ok: true, status }
  } catch (startError) {
    return { ok: false, error: toClientError(startError), status: engine.getStatus() }
  }
}

async function handleLocalStop(event) {
  const { engine, error } = localEngineForSender(event)
  if (error) return { ok: false, error }

  try {
    const status = await engine.stop()
    return { ok: true, status }
  } catch (stopError) {
    return { ok: false, error: toClientError(stopError), status: engine.getStatus() }
  }
}

async function handleLocalTest(event) {
  const { engine, error } = localEngineForSender(event)
  if (error) return { ok: false, error }

  try {
    const result = await engine.ping()
    return { ok: true, ...result }
  } catch (testError) {
    return { ok: false, error: toClientError(testError) }
  }
}

function handleLocalCancel(event) {
  const { engine, error } = localEngineForSender(event)
  if (error) return { ok: false, error }
  return { ok: true, ...engine.cancelPrepare() }
}

async function handleLocalOpenLog(event) {
  const { engine, error } = localEngineForSender(event)
  if (error) return { ok: false, error }

  engine.ensureDirectories()
  if (!fs.existsSync(engine.logPath)) {
    try {
      fs.writeFileSync(engine.logPath, '', 'utf8')
    } catch {
      // Fall back to showing the engine folder.
    }
  }

  if (fs.existsSync(engine.logPath)) {
    shell.showItemInFolder(engine.logPath)
  } else {
    const openError = await shell.openPath(engine.rootDir)
    if (openError) return { ok: false, message: openError, path: engine.rootDir }
  }
  return { ok: true, path: engine.logPath }
}

function persistFreeRouterFallback(previousSettings) {
  try {
    configStore.reload()
    const current = configStore.getSettings()

    if (current.provider === 'openrouter') {
      if (current.model !== previousSettings.model) return
      configStore.save({ model: OPENROUTER_FREE_MODEL })
    } else if (current.provider === LOCAL_PROVIDER && current.fallbackProvider === 'openrouter') {
      if (current.fallbackModel !== previousSettings.fallbackModel) return
      configStore.save({ fallbackModel: OPENROUTER_FREE_MODEL })
    } else {
      return
    }

    console.log(`[translate] Saved ${OPENROUTER_FREE_MODEL} as the model after automatic fallback.`)
    safeSend(settingsWindow, 'settings:changed', getSettingsView())
  } catch (error) {
    console.warn('[translate] Could not save the automatic free-router fallback:', error.message)
  }
}

function buildTrayMenu() {
  const shortcutLabel = safeFormatAccelerator(configStore.getSettings().shortcut)
  return Menu.buildFromTemplate([
    {
      label: overlayWindow?.isVisible() ? 'Hide Dodoi' : 'Show Dodoi',
      click: () => toggleOverlay().catch((error) => console.error(error)),
    },
    {
      label: `Shortcut: ${shortcutLabel}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Settings…',
      click: () => openSettings().catch((error) => console.error(error)),
    },
    {
      label: 'Open .env',
      click: () => openEnvFile().catch((error) => console.error(error)),
    },
    { type: 'separator' },
    {
      label: 'Quit Dodoi',
      click: () => app.quit(),
    },
  ])
}

function createTray() {
  if (tray) return

  const isMac = process.platform === 'darwin'
  const iconPath = getIconPath(isMac ? 'trayTemplate.png' : 'tray.png')
  let image = nativeImage.createFromPath(iconPath)
  if (isMac && !image.isEmpty()) image.setTemplateImage(true)
  if (image.isEmpty()) image = nativeImage.createFromPath(getIconPath('icon.png'))

  try {
    tray = new Tray(image)
  } catch (error) {
    console.warn('[tray] Could not create tray:', error.message)
    tray = null
    return
  }

  tray.setToolTip(`Dodoi — ${safeFormatAccelerator(configStore.getSettings().shortcut)}`)

  if (process.platform === 'linux') {
    tray.setContextMenu(buildTrayMenu())
  } else {
    tray.on('click', () => toggleOverlay().catch((error) => console.error(error)))
    tray.on('right-click', () => tray?.popUpContextMenu(buildTrayMenu()))
  }
}

async function openEnvFile() {
  configStore.ensureFile()
  const envPath = configStore.filePath
  const error = await shell.openPath(envPath)
  if (error) {
    shell.showItemInFolder(envPath)
    return { ok: false, path: envPath, message: error }
  }
  return { ok: true, path: envPath }
}

async function runTranslation(event, text) {
  if (!isOverlaySender(event)) {
    return { ok: false, error: { message: 'Translation can only run from the overlay.', code: 'INVALID_SENDER' } }
  }
  if (isTranslating) {
    return { ok: false, error: { message: 'A translation is already in progress.', code: 'BUSY' } }
  }
  if (!overlayWindow?.isVisible()) {
    return { ok: false, error: { message: 'The Dodoi window is not visible.', code: 'OVERLAY_HIDDEN' } }
  }

  isTranslating = true
  try {
    configStore.reload()
    syncShortcutWithConfig()
    const settings = configStore.getSettings()
    const cloudUrl = settings.provider === LOCAL_PROVIDER ? settings.fallbackApiUrl : settings.apiUrl
    const cloudModel = settings.provider === LOCAL_PROVIDER ? settings.fallbackModel : settings.model
    const result = await translateText({
      settings,
      text,
      fetchImpl: globalThis.fetch,
      isKnownFreeModel: Boolean(knownFreeModelsByUrl.get(cloudUrl)?.has(cloudModel)),
      localEngine,
    })

    // Local-to-cloud fallback also sets fallbackUsed. Only persist when the
    // OpenRouter free router itself was used.
    if (result.routedVia === OPENROUTER_FREE_MODEL) persistFreeRouterFallback(settings)

    clipboard.writeText(result.text)
    const target = capturedTarget

    await hideOverlay({ force: true })
    await delay(PASTE_DELAY_MS)

    const pasteResult = target
      ? await automation.activateAndPaste(target)
      : { ok: false, reason: 'no-target' }

    capturedTarget = null
    isTranslating = false

    if (!pasteResult.ok) {
      notifyPasteFallback(pasteResult.reason)
    }

    return {
      ok: true,
      targetLanguage: settings.targetLanguage,
      latencyMs: result.latencyMs,
      model: result.model,
      fallbackUsed: result.fallbackUsed,
      pasted: pasteResult.ok,
    }
  } catch (error) {
    isTranslating = false
    console.error('[translate]', error.code || error.name, error.message)
    return { ok: false, error: toClientError(error) }
  }
}

function notifyPasteFallback(reason) {
  const modifier = process.platform === 'darwin' ? 'Cmd' : 'Ctrl'
  const messages = {
    'no-target': `Translation copied to your clipboard. Press ${modifier}+V to paste.`,
    'xdotool-missing':
      'Translation copied. Install xdotool to enable automatic pasting on Linux.',
    'focus-failed': `Translation copied, but the previous app could not be focused. Press ${modifier}+V to paste.`,
    'paste-command-failed': `Translation copied to your clipboard. Press ${modifier}+V to paste.`,
    'platform-mismatch': `Translation copied to your clipboard. Press ${modifier}+V to paste.`,
    'invalid-target': `Translation copied to your clipboard. Press ${modifier}+V to paste.`,
    'paste-failed': `Translation copied to your clipboard. Press ${modifier}+V to paste.`,
    'unsupported-platform': `Translation copied to your clipboard. Press ${modifier}+V to paste.`,
  }

  showNotification('Dodoi · Copied to clipboard', messages[reason] || messages['paste-command-failed'])
}

function registerIpcHandlers() {
  ipcMain.handle('settings:get', (event) => {
    if (!isSettingsSender(event)) {
      return { ok: false, error: { message: 'Settings are not available here.' } }
    }
    try {
      configStore.reload()
      syncShortcutWithConfig()
      return { ok: true, settings: getSettingsView() }
    } catch (error) {
      return { ok: false, error: toClientError(error) }
    }
  })

  ipcMain.handle('settings:save', handleSaveSettings)
  ipcMain.handle('settings:test', handleTestConnection)
  ipcMain.handle('settings:free-models', handleFetchFreeModels)

  ipcMain.handle('local:status', handleLocalStatus)
  ipcMain.handle('local:prepare', handleLocalPrepare)
  ipcMain.handle('local:cancel', handleLocalCancel)
  ipcMain.handle('local:start', handleLocalStart)
  ipcMain.handle('local:stop', handleLocalStop)
  ipcMain.handle('local:test', handleLocalTest)
  ipcMain.handle('local:open-log', handleLocalOpenLog)

  ipcMain.handle('updates:get', (event) => {
    if (!isSettingsSender(event)) return { ok: false }
    return {
      ok: true,
      status: updateManager?.getStatus() || {
        state: 'unsupported',
        version: null,
        percent: 0,
        message: 'Automatic updates are not available for this build.',
      },
    }
  })

  ipcMain.handle('updates:check', (event) => {
    if (!isSettingsSender(event)) return { ok: false }
    const started = updateManager?.check() || false
    return { ok: started, status: updateManager?.getStatus() || null }
  })

  ipcMain.handle('updates:install', (event) => {
    if (!isSettingsSender(event)) return { ok: false }
    return { ok: updateManager?.quitAndInstall() || false }
  })

  ipcMain.handle('settings:open-env', async (event) => {
    if (!isSettingsSender(event)) {
      return { ok: false, error: { message: 'Not available.' } }
    }
    return openEnvFile()
  })

  ipcMain.handle('shortcut:pause', async (event) => {
    if (!isSettingsSender(event)) return { ok: false }
    await pauseShortcut()
    return { ok: true }
  })

  ipcMain.handle('shortcut:resume', async (event) => {
    if (!isSettingsSender(event)) return { ok: false, shortcutActive: false }
    return resumeShortcut()
  })

  ipcMain.handle('translate:run', runTranslation)

  ipcMain.on('overlay:hide', (event) => {
    if (!isOverlaySender(event)) return
    hideOverlay()
      .then((hidden) => {
        if (hidden) capturedTarget = null
      })
      .catch((error) => console.error(error))
  })

  ipcMain.on('overlay:open-settings', (event) => {
    if (!isOverlaySender(event)) return
    openSettings().catch((error) => console.error(error))
  })

  ipcMain.on('settings:minimize', (event) => {
    if (!isSettingsSender(event)) return
    settingsWindow.minimize()
  })

  ipcMain.on('settings:maximize', (event) => {
    if (!isSettingsSender(event)) return
    if (settingsWindow.isMaximized()) settingsWindow.unmaximize()
    else settingsWindow.maximize()
  })

  ipcMain.on('settings:close', (event) => {
    if (!isSettingsSender(event)) return
    settingsWindow.hide()
  })

  ipcMain.on('app:quit', (event) => {
    if (isSettingsSender(event) || isOverlaySender(event)) app.quit()
  })
}

function startAutomation() {
  automation = new AutomationService({
    platform: process.platform,
    ownPid: process.pid,
    logger: console,
  })
  automation.start()
}

function initStartupManager() {
  try {
    startupManager = new StartupManager({
      app,
      platform: process.platform,
      env: process.env,
      execPath: process.execPath,
      appPath: app.getAppPath(),
      appDataDir: app.getPath('appData'),
      isPackaged: app.isPackaged,
    })
  } catch (error) {
    console.error('[startup] Could not initialize launch-at-startup support:', error)
    startupManager = null
  }
}

function isAutostartLaunch() {
  if (process.argv.includes(AUTOSTART_ARG)) return true
  if (process.platform !== 'darwin') return false

  try {
    return Boolean(app.getLoginItemSettings().wasOpenedAtLogin)
  } catch {
    return false
  }
}

function warmLocalEngineOnAutostart() {
  if (!localEngine || !isAutostartLaunch()) return

  const settings = configStore.getSettings()
  if (!settings.launchAtStartup || settings.provider !== LOCAL_PROVIDER) return
  if (!localEngine.getStatus().installed) return

  console.log('[local] Dodoi was opened at login; warming the local engine.')
  localEngine.start().catch((error) => {
    console.warn('[local] Could not warm the engine at login:', error.message)
  })
}

async function initLocalEngine() {
  try {
    localEngine = new LocalEngine({
      userDataDir: app.getPath('userData'),
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      isPackaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
      env: process.env,
      fetchImpl: globalThis.fetch,
      logger: console,
    })

    localEngine.on('status', (status) => {
      safeSend(settingsWindow, 'local:status', status)
    })

    const status = await localEngine.init()
    console.log(
      `[local] Engine home: ${localEngine.rootDir} · Python: ${status.python.version || 'missing'}${status.python.isBundled ? ' (bundled)' : ''} · Model installed: ${status.installed}`,
    )
  } catch (error) {
    console.error('[local] Could not initialize the local engine manager:', error)
    localEngine = null
  }
}

function initUpdateManager() {
  try {
    updateManager = new UpdateManager({
      app,
      platform: process.platform,
      env: process.env,
      logger: console,
      onStatus: (status) => {
        safeSend(settingsWindow, 'updates:status', status)
      },
      onDownloaded: (info) => {
        const version = info?.version
        showNotification(
          'Dodoi update ready',
          version
            ? `Version ${version} has been downloaded. Click to restart and install it.`
            : 'An update has been downloaded. Click to restart and install it.',
          () => {
            if (!updateManager?.quitAndInstall()) {
              console.warn('[updates] The update is no longer ready to install.')
            }
          },
        )
      },
    })

    if (updateManager.start()) {
      console.log('[updates] Automatic update checks enabled.')
    } else {
      console.log(`[updates] ${updateManager.getStatus().message}`)
    }
  } catch (error) {
    console.error('[updates] Could not initialize the updater:', error)
    updateManager = null
  }
}

async function bootstrap() {
  app.setAppUserModelId(APP_ID)
  Menu.setApplicationMenu(null)

  configStore = new ConfigStore({ filePath: getEnvPath() })
  configStore.reload()
  initStartupManager()

  await initLocalEngine()
  startAutomation()
  registerIpcHandlers()
  await createOverlayWindow()
  createTray()
  initUpdateManager()

  const shortcutOk = registerConfiguredShortcut({ announce: true })
  if (!shortcutOk) console.warn('[shortcut] Dodoi started without an active global shortcut.')

  warmLocalEngineOnAutostart()

  screen.on('display-metrics-changed', () => {
    if (overlayWindow?.isVisible()) positionOverlay()
  })

  console.log(`[dodoi] Ready. Config: ${configStore.filePath}`)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (app.isReady()) showOverlay().catch((error) => console.error(error))
  })

  app.on('window-all-closed', () => {
    // Dodoi lives in the tray; closing its windows only hides them.
  })

  app.on('activate', () => {
    if (app.isReady()) toggleOverlay().catch((error) => console.error(error))
  })

  app.on('before-quit', () => {
    isQuitting = true
    shortcutPaused = false
    releaseShortcut()
    automation?.stop()
    updateManager?.stop()
    localEngine?.shutdownSync()
    localEngine = null
    overlayWindow = null
    settingsWindow = null
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })

  app
    .whenReady()
    .then(bootstrap)
    .catch((error) => {
      console.error('[dodoi] Failed to start:', error)
      app.quit()
    })
}
