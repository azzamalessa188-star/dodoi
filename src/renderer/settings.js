import './base.js'
import { LANGUAGES, QUICK_LANGUAGES } from './languages.js'

const api = window.dodoi
const platform = api?.platform || 'win32'
const isMac = platform === 'darwin'
const OPENROUTER_FREE_MODEL = 'openrouter/free'
const LOCAL_PROVIDER = 'local-nllb'

const PROVIDER_PRESETS = {
  openai: {
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1',
    model: OPENROUTER_FREE_MODEL,
  },
  groq: {
    apiUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  [LOCAL_PROVIDER]: null,
  custom: null,
}

const shell = document.querySelector('.settings-shell')
const provider = document.getElementById('provider')
const apiUrl = document.getElementById('apiUrl')
const model = document.getElementById('model')
const freeModelPanel = document.getElementById('freeModelPanel')
const freeModelSelect = document.getElementById('freeModelSelect')
const freeModelBadge = document.getElementById('freeModelBadge')
const freeModelStatus = document.getElementById('freeModelStatus')
const freeModelStatusText = document.getElementById('freeModelStatusText')
const refreshFreeModelsButton = document.getElementById('refreshFreeModelsButton')
const refreshFreeModelsLabel = document.getElementById('refreshFreeModelsLabel')
const apiKey = document.getElementById('apiKey')
const apiKeyField = document.getElementById('apiKeyField')
const apiKeyLabel = document.getElementById('apiKeyLabel')
const apiKeyConfiguredLabel = document.getElementById('apiKeyConfiguredLabel')
const apiKeyHint = document.getElementById('apiKeyHint')
const clearKeyButton = document.getElementById('clearKeyButton')
const revealKeyButton = document.getElementById('revealKeyButton')
const targetLanguage = document.getElementById('targetLanguage')
const languageSuggestions = document.getElementById('languageSuggestions')
const languageChips = document.getElementById('languageChips')
const shortcutRecorder = document.getElementById('shortcutRecorder')
const launchAtStartup = document.getElementById('launchAtStartup')
const startupNote = document.getElementById('startupNote')
const shortcutKeys = document.getElementById('shortcutKeys')
const shortcutHint = document.getElementById('shortcutHint')
const shortcutFeedback = document.getElementById('shortcutFeedback')
const shortcutStatusText = document.getElementById('shortcutStatusText')
const testButton = document.getElementById('testButton')
const testLabel = document.getElementById('testLabel')
const testSpinner = document.getElementById('testSpinner')
const testResult = document.getElementById('testResult')
const testResultText = document.getElementById('testResultText')
const connectionState = document.getElementById('connectionState')
const connectionDescription = document.getElementById('connectionDescription')
const localPanel = document.getElementById('localPanel')
const localBadge = document.getElementById('localBadge')
const localStatusText = document.getElementById('localStatusText')
const localEnginePulse = document.getElementById('localEnginePulse')
const localSize = document.getElementById('localSize')
const localProgress = document.getElementById('localProgress')
const localProgressText = document.getElementById('localProgressText')
const localProgressPercent = document.getElementById('localProgressPercent')
const localProgressBar = document.getElementById('localProgressBar')
const localProgressDetail = document.getElementById('localProgressDetail')
const localPrepareButton = document.getElementById('localPrepareButton')
const localPrepareLabel = document.getElementById('localPrepareLabel')
const localPrepareSpinner = document.getElementById('localPrepareSpinner')
const localStartButton = document.getElementById('localStartButton')
const localStartLabel = document.getElementById('localStartLabel')
const localStartSpinner = document.getElementById('localStartSpinner')
const localStopButton = document.getElementById('localStopButton')
const localCancelButton = document.getElementById('localCancelButton')
const localTestButton = document.getElementById('localTestButton')
const localLogButton = document.getElementById('localLogButton')
const localPython = document.getElementById('localPython')
const localModelSize = document.getElementById('localModelSize')
const localMemory = document.getElementById('localMemory')
const localDiskWarning = document.getElementById('localDiskWarning')
const localMemoryWarning = document.getElementById('localMemoryWarning')
const localError = document.getElementById('localError')
const smartFallback = document.getElementById('smartFallback')
const fallbackSummary = document.getElementById('fallbackSummary')
const fallbackKeyButton = document.getElementById('fallbackKeyButton')
const saveButton = document.getElementById('saveButton')
const saveLabel = document.getElementById('saveLabel')
const saveSpinner = document.getElementById('saveSpinner')
const saveShortcutHint = document.getElementById('saveShortcutHint')
const discardButton = document.getElementById('discardButton')
const dirtyState = document.getElementById('dirtyState')
const dirtyText = document.getElementById('dirtyText')
const overallState = document.getElementById('overallState')
const envPath = document.getElementById('envPath')
const openEnvButton = document.getElementById('openEnvButton')
const toast = document.getElementById('toast')
const toastMessage = document.getElementById('toastMessage')
const clearKeyDefaultLabel = 'Remove saved key'
const clearKeyUndoLabel = 'Undo removal'

let savedSettings = null
let pendingShortcut = ''
let baselineSnapshot = null
let loading = true
let saving = false
let testing = false
let recording = false
let apiKeyClearPending = false
let toastTimer = null
let loadSequence = 0
let testSequence = 0
let recordingSequence = 0
let freeModelSequence = 0
let freeModelRefreshTimer = null
let freeModelApiUrl = ''
let freeModelModels = []
let freeModelLoading = false
let freeModelError = ''
let freeModelFetchedAt = 0
let localStatus = null
let localAction = ''
let localActionSequence = 0
let localTestSequence = 0
let fallbackKeyOpen = false

saveShortcutHint.textContent = isMac ? '⌘ S' : 'Ctrl S'

function snapshot() {
  // The cloud snapshot is preserved while the local provider is selected, so
  // hidden cloud fields must not produce phantom unsaved changes.
  const cloud = cloudFormValues()
  return JSON.stringify({
    provider: provider.value,
    apiUrl: cloud.apiUrl,
    model: cloud.model,
    targetLanguage: targetLanguage.value.trim(),
    shortcut: pendingShortcut,
    launchAtStartup: launchAtStartup.checked,
    apiKey: apiKey.value,
    clearApiKey: apiKeyClearPending,
    smartFallback: smartFallback.checked,
  })
}

function savedSnapshot(settings) {
  return JSON.stringify({
    provider: settings.provider || '',
    apiUrl: settings.apiUrl || '',
    model: settings.model || '',
    targetLanguage: settings.targetLanguage || '',
    shortcut: settings.shortcut || '',
    launchAtStartup: settings.launchAtStartup === true,
    apiKey: '',
    clearApiKey: false,
    smartFallback: settings.smartFallback !== false,
  })
}

function isDirty() {
  return Boolean(baselineSnapshot) && snapshot() !== baselineSnapshot
}

function canSave() {
  return Boolean(savedSettings) && !loading && !saving && !testing && !recording && (isDirty() || !savedSettings.shortcutActive)
}

function resetProviderOption() {
  const existing = [...provider.options].find(
    (option) => !Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, option.value),
  )
  if (existing) existing.remove()
}

function setProviderValue(value) {
  resetProviderOption()
  if (!Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, value)) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value
    provider.appendChild(option)
  }
  provider.value = value
}

function formatShortcut(accelerator) {
  if (!accelerator) return 'Not set'
  const tokens = accelerator.split('+').map((token) => token.trim()).filter(Boolean)
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

function setShortcutFeedback(message, type = '') {
  shortcutFeedback.classList.toggle('is-error', type === 'error')
  shortcutFeedback.classList.toggle('is-active', type === 'active')
  shortcutStatusText.textContent = message
}

function renderShortcut() {
  if (recording) {
    shortcutKeys.textContent = 'Listening…'
    shortcutHint.textContent = 'Press keys · Esc to cancel'
    return
  }

  shortcutKeys.textContent = formatShortcut(pendingShortcut)
  shortcutHint.textContent =
    savedSettings && pendingShortcut !== savedSettings.shortcut
      ? 'New shortcut · save to activate'
      : 'Click to record a new shortcut'
}

function isLocalSelected() {
  return provider.value === LOCAL_PROVIDER
}

function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  const precision = unit >= 3 ? 1 : unit === 0 ? 0 : 1
  return `${size.toFixed(precision)} ${units[unit]}`
}

function updateHeroState() {
  overallState.classList.remove('is-ready', 'is-error')
  if (!savedSettings) {
    overallState.textContent = 'Loading…'
    return
  }

  if (isLocalSelected()) {
    if (!localStatus) {
      overallState.textContent = 'Local engine unavailable'
      overallState.classList.add('is-error')
      return
    }
    if (localStatus.online) {
      overallState.textContent = 'Offline engine ready'
      overallState.classList.add('is-ready')
      return
    }
    if (localStatus.phase === 'error') {
      overallState.textContent = 'Local engine error'
      overallState.classList.add('is-error')
      return
    }
    if (localStatus.phase === 'preparing' || localStatus.phase === 'starting') {
      overallState.textContent = 'Preparing local engine'
      return
    }
    if (!localStatus.installed) {
      overallState.textContent = 'Local model not downloaded'
      return
    }
    if (!savedSettings.shortcutActive) {
      overallState.textContent = 'Shortcut inactive'
      overallState.classList.add('is-error')
      return
    }
    const fallbackReady =
      smartFallback.checked &&
      (Boolean(savedSettings.apiKeyConfigured) || Boolean(apiKey.value.trim()))
    if (fallbackReady) {
      overallState.textContent = 'Cloud fallback ready'
      overallState.classList.add('is-ready')
    } else if (smartFallback.checked) {
      overallState.textContent = 'Fallback needs a key'
      overallState.classList.add('is-error')
    } else {
      overallState.textContent = 'Local engine stopped'
    }
    return
  }

  if (!savedSettings.apiKeyConfigured && !apiKey.value.trim() && !apiKeyClearPending) {
    overallState.textContent = 'Needs an API key'
    return
  }

  if (!savedSettings.shortcutActive) {
    overallState.textContent = 'Shortcut inactive'
    overallState.classList.add('is-error')
    return
  }

  overallState.textContent = 'Ready'
  overallState.classList.add('is-ready')
}

function setLocalBadge(label, tone = '') {
  localBadge.textContent = label
  localBadge.classList.remove('is-online', 'is-busy', 'is-error', 'is-ready')
  if (tone) localBadge.classList.add(`is-${tone}`)
  localEnginePulse.classList.toggle('is-online', tone === 'online')
  localEnginePulse.classList.toggle('is-busy', tone === 'busy')
  localEnginePulse.classList.toggle('is-error', tone === 'error')
}

function setLocalFact(element, text, tone = '') {
  element.textContent = text
  element.classList.toggle('is-warning', tone === 'warning')
  element.classList.toggle('is-error', tone === 'error')
}

function updateFallbackSummary() {
  fallbackSummary.classList.remove('is-warning')

  const keyReady =
    Boolean(apiKey.value.trim()) ||
    Boolean(savedSettings?.apiKeyConfigured && !apiKeyClearPending)
  const showKeyAction = Boolean(savedSettings) && isLocalSelected() && smartFallback.checked

  fallbackKeyButton.hidden = !showKeyAction
  fallbackKeyButton.textContent = fallbackKeyOpen
    ? 'Hide fallback key'
    : keyReady
      ? 'Change fallback key'
      : 'Add fallback key'

  if (!savedSettings) {
    fallbackSummary.textContent = 'Loading the saved cloud connection…'
    return
  }

  if (!smartFallback.checked) {
    fallbackSummary.textContent = 'Smart Fallback is off. Local engine errors are shown directly.'
    return
  }

  const providerName = savedSettings.fallbackProvider || ''
  const modelName = savedSettings.fallbackModel || ''

  if (!providerName || !modelName) {
    fallbackSummary.textContent =
      'No cloud connection is saved yet. Save a cloud provider once to enable fallback.'
    fallbackSummary.classList.add('is-warning')
    return
  }

  const providerLabel =
    providerName === 'openrouter'
      ? 'OpenRouter'
      : providerName === 'openai'
        ? 'OpenAI'
        : providerName === 'groq'
          ? 'Groq'
          : providerName
  fallbackSummary.textContent = `${providerLabel} · ${modelName}${keyReady ? ' · key ready' : ' · API key missing'}`
  fallbackSummary.title = savedSettings.fallbackApiUrl || ''
  if (!keyReady) fallbackSummary.classList.add('is-warning')
}

function updateProviderVisibility() {
  const local = isLocalSelected()
  const showFallbackKey = local && smartFallback.checked && fallbackKeyOpen

  for (const element of document.querySelectorAll('[data-cloud-only]')) {
    element.hidden = local
  }

  apiKeyField.hidden = local ? !showFallbackKey : false
  apiKeyLabel.textContent = local ? 'Fallback API key' : 'API key'
  localPanel.hidden = !local
  connectionDescription.textContent = local
    ? 'Private, offline translation powered by NLLB-200 and CTranslate2 on this device.'
    : 'Works with any OpenAI-compatible chat completions API.'
}

function renderLocalStatus() {
  const status = localStatus
  updateFallbackSummary()

  if (!status) {
    setLocalBadge('Unavailable', 'error')
    localStatusText.textContent = 'The local engine manager could not be loaded.'
    localProgress.hidden = true
    localPrepareButton.hidden = false
    localPrepareButton.disabled = true
    localStartButton.hidden = true
    localStopButton.hidden = true
    localCancelButton.hidden = true
    localTestButton.hidden = true
    localPython.textContent = 'Unavailable'
    setLocalFact(localPython, 'Unavailable', 'error')
    setLocalFact(localModelSize, 'Unavailable', 'error')
    setLocalFact(localMemory, 'Unavailable', 'error')
    localDiskWarning.hidden = true
    localMemoryWarning.hidden = true
    localError.hidden = false
    localError.textContent = 'Restart Dodoi. If the problem continues, check that the app files are complete.'
    if (isLocalSelected()) setConnectionState('Engine unavailable', 'error')
    return
  }

  const progress = status.progress || {}
  const preparing = status.phase === 'preparing'
  const starting = status.phase === 'starting'
  const stopping = status.phase === 'stopping'
  const online = Boolean(status.online)
  const installed = Boolean(status.installed)
  const working = Boolean(localAction)

  if (online) setLocalBadge('Online', 'online')
  else if (preparing) setLocalBadge(progress.stage === 'convert' ? 'Converting' : 'Downloading', 'busy')
  else if (starting) setLocalBadge('Starting', 'busy')
  else if (stopping) setLocalBadge('Stopping', 'busy')
  else if (status.phase === 'error') setLocalBadge('Error', 'error')
  else if (installed) setLocalBadge('Ready', 'ready')
  else setLocalBadge('Not installed')

  if (status.phase === 'error' && status.error?.message) {
    localStatusText.textContent = 'The local engine needs attention.'
  } else {
    localStatusText.textContent =
      progress.message || status.message || (installed ? 'Model ready.' : 'Download the model to begin.')
  }

  const showProgress = Boolean(progress.active)
  localProgress.hidden = !showProgress
  if (showProgress) {
    const rawPercent = Number(progress.percent)
    const hasPercent = Number.isFinite(rawPercent)
    const percent = hasPercent ? Math.max(0, Math.min(100, rawPercent)) : 0
    localProgressText.textContent = progress.message || 'Working…'
    localProgressPercent.textContent = hasPercent ? `${Math.round(percent)}%` : '…'
    localProgressBar.style.width = `${percent}%`
    localProgressBar.classList.toggle('is-indeterminate', !hasPercent)
    const bytes = Number(progress.bytes) || 0
    const totalBytes = Number(progress.totalBytes) || 0
    localProgressDetail.textContent =
      bytes > 0 && totalBytes > 0
        ? `${formatBytes(bytes)} of ${formatBytes(totalBytes)}`
        : bytes > 0
          ? formatBytes(bytes)
          : ''
  }

  localPrepareButton.hidden = installed && !preparing
  localPrepareButton.disabled = working || preparing || starting || stopping || online
  localPrepareLabel.textContent = preparing
    ? progress.stage === 'convert'
      ? 'Converting…'
      : 'Preparing…'
    : status.partial
      ? 'Resume Download & Convert'
      : 'Download & Convert'
  localPrepareSpinner.hidden = !(preparing || localAction === 'prepare')

  localStartButton.hidden = !installed || online || preparing || starting || stopping
  localStartButton.disabled = working
  localStartSpinner.hidden = !(starting || localAction === 'start')

  localStopButton.hidden = !installed || preparing || (!online && !starting && !stopping && localAction !== 'stop')
  localStopButton.disabled =
    localAction === 'stop' || (working && !(starting && localAction === 'start'))
  localStopButton.textContent =
    localAction === 'stop' && starting
      ? 'Cancelling…'
      : starting
        ? 'Cancel start'
        : stopping
          ? 'Stopping…'
          : 'Stop engine'

  localCancelButton.hidden = !preparing
  localTestButton.hidden = !online
  localTestButton.disabled = working
  localLogButton.disabled = working

  setLocalFact(
    localPython,
    status.python?.found
      ? status.python.recommended
        ? `Python ${status.python.version}${status.python.isVenv ? ' · venv' : ''}`
        : `Python ${status.python.version} · use 3.12/3.13`
      : 'Python 3.10+ not found',
    status.python?.found ? (status.python.recommended ? '' : 'warning') : 'error',
  )

  setLocalFact(
    localModelSize,
    installed
      ? status.model.bundled
        ? 'Bundled · INT8'
        : `${status.model.sizeLabel} · INT8`
      : status.partial
        ? `${formatBytes(status.partialBytes)} downloaded`
        : 'Not downloaded',
  )

  setLocalFact(
    localMemory,
    status.memory?.totalBytes
      ? `${formatBytes(status.memory.totalBytes)} RAM`
      : 'Unknown',
    status.memory?.warning ? 'warning' : '',
  )

  localSize.textContent = installed
    ? status.model.bundled
      ? 'INT8 · Bundled with Dodoi'
      : `INT8 · ${status.model.sizeLabel} on disk`
    : `INT8 · ${status.model.downloadLabel} download`

  if (status.disk?.ok === false) {
    localDiskWarning.hidden = false
    localDiskWarning.textContent = `Not enough disk space. Free up about ${formatBytes(status.disk.requiredBytes)}; ${formatBytes(status.disk.freeBytes)} is available.`
  } else {
    localDiskWarning.hidden = true
  }

  if (status.memory?.warning) {
    localMemoryWarning.hidden = false
    localMemoryWarning.textContent = `This machine has ${formatBytes(status.memory.totalBytes)} RAM. At least 16 GB is recommended for conversion and inference.`
  } else {
    localMemoryWarning.hidden = true
  }

  if (status.phase === 'error' && status.error?.message) {
    localError.hidden = false
    localError.textContent = status.error.message
    localError.title = status.error.detail || ''
  } else {
    localError.hidden = true
    localError.textContent = ''
    localError.title = ''
  }

  if (isLocalSelected()) {
    if (online) setConnectionState('Engine online', 'success')
    else if (preparing) setConnectionState(progress.stage === 'convert' ? 'Converting model' : 'Downloading model')
    else if (starting) setConnectionState('Starting engine')
    else if (stopping) setConnectionState('Stopping engine')
    else if (status.phase === 'error') setConnectionState('Engine error', 'error')
    else if (installed) setConnectionState('Engine stopped')
    else setConnectionState('Model missing')
  }

  updateHeroState()
  refreshControls()
}

function setLocalAction(action) {
  localAction = action
  renderLocalStatus()
}

function setConnectionState(label, type = '') {
  connectionState.textContent = label
  connectionState.classList.toggle('is-success', type === 'success')
  connectionState.classList.toggle('is-error', type === 'error')
}

function resetTestState() {
  testSequence += 1
  testResult.hidden = true
  testResult.classList.remove('is-error', 'is-testing')
  testResultText.textContent = ''
  setConnectionState('Not tested')
}

function isOpenRouterSelected() {
  return provider.value === 'openrouter'
}

function isSpecificFreeModel(modelId) {
  return /:free$/i.test(String(modelId || '').trim())
}

function parseEndpointValue(value) {
  try {
    const parsed = new URL(String(value || '').trim())
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null
  } catch {
    return null
  }
}

function renderFreeModelOptions() {
  const current = model.value.trim()
  const selection = current || OPENROUTER_FREE_MODEL

  freeModelSelect.replaceChildren()

  const autoOption = document.createElement('option')
  autoOption.value = OPENROUTER_FREE_MODEL
  autoOption.textContent = 'Auto-route · openrouter/free (recommended)'
  freeModelSelect.appendChild(autoOption)

  const added = new Set([OPENROUTER_FREE_MODEL])
  freeModelModels.forEach((freeModel, index) => {
    if (!freeModel?.id || added.has(freeModel.id)) return
    added.add(freeModel.id)
    const option = document.createElement('option')
    option.value = freeModel.id
    option.textContent = index === 0 ? `${freeModel.id} · best available` : freeModel.id
    freeModelSelect.appendChild(option)
  })

  if (!added.has(selection)) {
    const option = document.createElement('option')
    option.value = selection
    option.textContent = isSpecificFreeModel(selection)
      ? `${selection} · not currently listed`
      : `${selection} · custom model`
    freeModelSelect.appendChild(option)
  }

  freeModelSelect.value = selection
}

function updateFreeModelStatus() {
  freeModelBadge.classList.remove('is-live', 'is-error')
  freeModelStatus.classList.remove('is-loading', 'is-error', 'is-warning')

  if (!isOpenRouterSelected()) {
    freeModelPanel.hidden = true
    return
  }

  freeModelPanel.hidden = false
  const current = model.value.trim()
  const recommended = freeModelModels[0] || null
  const listed = freeModelModels.some((freeModel) => freeModel.id === current)
  const count = freeModelModels.length

  if (freeModelLoading) {
    freeModelBadge.textContent = 'Loading'
    freeModelStatus.classList.add('is-loading')
    freeModelStatusText.textContent = 'Fetching the latest free models from OpenRouter…'
    return
  }

  if (freeModelError) {
    if (count) {
      freeModelBadge.textContent = 'Cached'
      freeModelBadge.classList.add('is-live')
      freeModelStatus.classList.add('is-warning')
      freeModelStatusText.textContent = 'Could not refresh free models. Showing the last loaded list.'
    } else {
      freeModelBadge.textContent = 'Offline'
      freeModelBadge.classList.add('is-error')
      freeModelStatus.classList.add('is-error')
      freeModelStatusText.textContent = 'Could not load free models. Auto-routing still works.'
    }
    return
  }

  if (!recommended) {
    freeModelBadge.textContent = 'Auto'
    freeModelStatusText.textContent = 'No free models were listed. Auto-routing still works.'
    return
  }

  if (current === OPENROUTER_FREE_MODEL) {
    freeModelBadge.textContent = 'Auto'
    freeModelBadge.classList.add('is-live')
    freeModelStatusText.textContent = `Auto-routing on · ${count} free model${count === 1 ? '' : 's'} available · best: ${recommended.id}`
    return
  }

  if (isSpecificFreeModel(current) && !listed) {
    freeModelBadge.textContent = 'Stale'
    freeModelBadge.classList.add('is-error')
    freeModelStatus.classList.add('is-warning')
    freeModelStatusText.textContent = `The selected free model is no longer listed. Best available: ${recommended.id}`
    return
  }

  if (listed) {
    freeModelBadge.textContent = 'Live'
    freeModelBadge.classList.add('is-live')
    freeModelStatusText.textContent = `${count} free model${count === 1 ? '' : 's'} available · selected model is currently free`
    return
  }

  freeModelBadge.textContent = 'Custom'
  freeModelStatusText.textContent = `${count} free model${count === 1 ? '' : 's'} available · auto-routing stays current`
}

function renderFreeModelPanel() {
  renderFreeModelOptions()
  updateFreeModelStatus()
}

function resetFreeModelState() {
  freeModelSequence += 1
  if (freeModelRefreshTimer) {
    clearTimeout(freeModelRefreshTimer)
    freeModelRefreshTimer = null
  }
  freeModelApiUrl = ''
  freeModelModels = []
  freeModelLoading = false
  freeModelError = ''
  freeModelFetchedAt = 0
  renderFreeModelPanel()
  refreshControls()
}

function scheduleFreeModelRefresh() {
  if (freeModelRefreshTimer) clearTimeout(freeModelRefreshTimer)
  freeModelSequence += 1
  freeModelApiUrl = ''
  freeModelModels = []
  freeModelLoading = false
  freeModelError = ''
  freeModelFetchedAt = 0
  renderFreeModelPanel()
  refreshControls()

  freeModelRefreshTimer = setTimeout(() => {
    freeModelRefreshTimer = null
    if (isOpenRouterSelected() && api) refreshFreeModels({ force: true })
  }, 700)
}

async function refreshFreeModels({ force = false } = {}) {
  if (!api || !isOpenRouterSelected() || loading || freeModelLoading) return

  const url = apiUrl.value.trim()
  if (!parseEndpointValue(url)) {
    freeModelApiUrl = ''
    freeModelModels = []
    freeModelError = 'Enter a valid endpoint URL to load free models.'
    renderFreeModelPanel()
    refreshControls()
    return
  }

  const cacheFresh =
    !force &&
    freeModelApiUrl === url &&
    freeModelFetchedAt > 0 &&
    !freeModelError &&
    Date.now() - freeModelFetchedAt < 5 * 60_000

  if (cacheFresh) {
    renderFreeModelPanel()
    refreshControls()
    return
  }

  const sequence = ++freeModelSequence
  if (freeModelApiUrl !== url) freeModelModels = []
  freeModelApiUrl = url
  freeModelLoading = true
  freeModelError = ''
  renderFreeModelPanel()
  refreshControls()

  try {
    const result = await api.fetchFreeModels({ provider: 'openrouter', apiUrl: url })
    if (sequence !== freeModelSequence) return

    if (!result?.ok) {
      freeModelError = result?.error?.message || 'Could not load free models.'
      return
    }

    freeModelModels = Array.isArray(result.models) ? result.models : []
  } catch (error) {
    if (sequence !== freeModelSequence) return
    freeModelError = error?.message || 'Could not load free models.'
  } finally {
    if (sequence === freeModelSequence) {
      freeModelLoading = false
      freeModelFetchedAt = Date.now()
      renderFreeModelPanel()
      refreshControls()
    }
  }
}

function updateApiKeyUI() {
  const hasStoredKey = Boolean(savedSettings?.apiKeyConfigured)
  const hasTypedKey = Boolean(apiKey.value.trim())
  const hint = savedSettings?.apiKeyHint || ''

  clearKeyButton.hidden = !hasStoredKey && !apiKeyClearPending
  clearKeyButton.textContent = apiKeyClearPending ? clearKeyUndoLabel : clearKeyDefaultLabel

  if (apiKeyClearPending) {
    apiKey.placeholder = 'Saved key will be removed on save'
    apiKeyConfiguredLabel.textContent = hasStoredKey ? `Saved ${hint}` : ''
    apiKeyHint.textContent = 'The stored key will be removed when you save.'
  } else if (hasTypedKey) {
    apiKey.placeholder = hasStoredKey ? `Saved key ${hint} — leave blank to keep it` : 'Paste your API key'
    apiKeyConfiguredLabel.textContent = hasStoredKey ? `Saved ${hint}` : 'New key'
    apiKeyHint.textContent = 'A new key will replace the saved one when you save.'
  } else if (hasStoredKey) {
    apiKey.placeholder = `Saved key ${hint} — leave blank to keep it`
    apiKeyConfiguredLabel.textContent = `Saved ${hint}`
    apiKeyHint.textContent = 'Your key is stored locally. Leave this blank to keep it unchanged.'
  } else {
    apiKey.placeholder = 'Paste your API key'
    apiKeyConfiguredLabel.textContent = 'No key saved'
    apiKeyHint.textContent = 'Your key stays in the local .env file and never reaches the UI layer.'
  }

  revealKeyButton.disabled = !hasTypedKey
  revealKeyButton.classList.toggle('is-revealed', apiKey.type === 'text')
  revealKeyButton.setAttribute('aria-label', apiKey.type === 'text' ? 'Hide API key' : 'Show API key')
  revealKeyButton.title = apiKey.type === 'text' ? 'Hide API key' : 'Show API key'
  updateFallbackSummary()
  updateHeroState()
}

function updateStartupNote() {
  const supported = savedSettings?.startupSupported !== false
  startupNote.classList.toggle('is-active', supported && launchAtStartup.checked)

  if (!supported) {
    startupNote.textContent = 'Startup launch is not available on this system.'
    return
  }

  startupNote.textContent = launchAtStartup.checked
    ? 'Dodoi will open hidden in the tray at sign-in. Local translation warms up when that provider is selected.'
    : 'Dodoi opens only when you launch it. Your shortcut stays active while Dodoi is running.'
}

function updateDirtyState() {
  const dirty = isDirty()
  dirtyState.classList.toggle('is-dirty', dirty)
  dirtyState.classList.toggle('is-saved', !dirty)
  dirtyText.textContent = dirty ? 'Unsaved changes' : 'All changes saved'

  saveButton.disabled = !canSave()
  discardButton.disabled = !dirty || loading || saving || recording
  saveSpinner.hidden = !saving
  saveLabel.textContent = saving ? 'Saving…' : 'Save changes'
}

function refreshControls() {
  const openRouter = isOpenRouterSelected()
  testButton.disabled = loading || testing || saving || recording
  shortcutRecorder.disabled = loading || saving || testing
  provider.disabled = loading || saving
  apiUrl.disabled = loading || saving
  model.disabled = loading || saving
  apiKey.disabled = loading || saving
  targetLanguage.disabled = loading || saving
  launchAtStartup.disabled = loading || saving || savedSettings?.startupSupported === false
  revealKeyButton.disabled = loading || saving || !apiKey.value.trim()
  openEnvButton.disabled = loading || saving
  freeModelPanel.hidden = !openRouter
  freeModelSelect.disabled = loading || saving || !openRouter
  refreshFreeModelsButton.disabled = loading || saving || freeModelLoading || !openRouter
  refreshFreeModelsLabel.textContent = freeModelLoading ? 'Loading…' : 'Refresh'
  refreshFreeModelsButton.classList.toggle('is-loading', freeModelLoading)
  updateStartupNote()
  updateDirtyState()
}

function renderLanguageChips() {
  const current = targetLanguage.value.trim().toLowerCase()
  for (const chip of languageChips.querySelectorAll('.language-chip')) {
    chip.classList.toggle('is-active', chip.dataset.language.toLowerCase() === current)
  }
}

function setInvalid(field, invalid = true) {
  const element = document.getElementById(field)
  if (!element) return
  if (invalid) element.setAttribute('aria-invalid', 'true')
  else element.removeAttribute('aria-invalid')
}

function clearInvalidState() {
  for (const element of document.querySelectorAll('[aria-invalid="true"]')) {
    element.removeAttribute('aria-invalid')
  }
}

function showToast(message, type = 'success') {
  if (toastTimer) clearTimeout(toastTimer)
  toast.hidden = false
  toast.classList.toggle('is-error', type === 'error')
  toastMessage.textContent = message
  toastTimer = setTimeout(() => {
    toast.hidden = true
  }, 4300)
}

function populateDateList() {
  for (const language of LANGUAGES) {
    const option = document.createElement('option')
    option.value = language
    languageSuggestions.appendChild(option)
  }

  for (const language of QUICK_LANGUAGES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'language-chip'
    button.dataset.language = language
    button.textContent = language
    button.addEventListener('click', () => {
      targetLanguage.value = language
      targetLanguage.removeAttribute('aria-invalid')
      renderLanguageChips()
      resetTestState()
      refreshControls()
    })
    languageChips.appendChild(button)
  }
}

async function finishRecording({ resume = true, captured = false } = {}) {
  if (!recording) return
  recording = false
  recordingSequence += 1
  shortcutRecorder.classList.remove('is-recording')
  window.removeEventListener('keydown', handleShortcutKeydown, true)
  renderShortcut()
  refreshControls()

  if (!resume || !api) return

  try {
    const result = await api.resumeShortcut()
    if (savedSettings) {
      savedSettings.shortcutActive = Boolean(result?.shortcutActive ?? result?.ok)
    }

    if (!result?.ok) {
      setShortcutFeedback(
        result?.error?.message || 'The saved shortcut could not be re-enabled. Choose another and save.',
        'error',
      )
      updateHeroState()
      return
    }

    if (captured) {
      setShortcutFeedback('New shortcut captured. Save to activate.', 'active')
    } else if (pendingShortcut !== savedSettings?.shortcut) {
      setShortcutFeedback('Unsaved shortcut change. Save to activate.', 'active')
    } else if (savedSettings?.shortcutActive) {
      setShortcutFeedback('Active and listening system-wide.', 'active')
    } else {
      setShortcutFeedback('Shortcut is inactive. Record a new one and save.', 'error')
    }
  } catch (error) {
    setShortcutFeedback(error?.message || 'Could not re-enable the saved shortcut.', 'error')
  } finally {
    updateHeroState()
    updateDirtyState()
  }
}

function modifierTokens(event) {
  const tokens = []
  const primaryModifier = isMac ? event.metaKey : event.ctrlKey
  const secondaryModifier = isMac ? event.ctrlKey : event.metaKey

  if (primaryModifier) tokens.push('CommandOrControl')
  if (secondaryModifier) tokens.push(isMac ? 'Control' : 'Super')
  if (event.altKey) tokens.push('Alt')
  if (event.shiftKey) tokens.push('Shift')
  return tokens
}

function mapPressedKey(event) {
  const code = event.code

  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code

  const special = {
    Space: 'Space',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Enter: 'Enter',
    NumpadEnter: 'Enter',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Backquote: '`',
    Minus: '-',
    Equal: event.shiftKey ? 'Plus' : '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    IntlBackslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
  }

  if (special[code]) return special[code]
  if (code.startsWith('Numpad')) return null
  if (typeof event.key === 'string' && event.key.length === 1) return event.key
  return null
}

function liveShortcutPreview(event) {
  const tokens = modifierTokens(event)
  if (!tokens.length) return
  shortcutKeys.textContent = `${tokens.map((token) => formatShortcut(token)).join(' + ')} + …`
}

function handleShortcutKeydown(event) {
  if (!recording) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  if (event.repeat) return
  if (event.key === 'Escape') {
    finishRecording()
    setShortcutFeedback('Recording cancelled.', 'active')
    return
  }

  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
    liveShortcutPreview(event)
    return
  }

  const key = mapPressedKey(event)
  if (!key) return

  const modifiers = modifierTokens(event)
  const hasModifier = modifiers.length > 0
  const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/.test(key)

  if (key === 'Enter' && modifiers.includes('CommandOrControl')) {
    setShortcutFeedback('Ctrl / Cmd + Enter is reserved for translating. Try another combination.', 'error')
    return
  }

  if (!hasModifier && !isFunctionKey) {
    setShortcutFeedback('Add at least one modifier, such as Ctrl, Alt, or Shift.', 'error')
    return
  }

  const candidate = [...modifiers, key].join('+')
  pendingShortcut = candidate
  shortcutKeys.textContent = formatShortcut(candidate)
  shortcutHint.textContent = 'New shortcut · save to activate'
  setInvalid('shortcut', false)
  selectedShortcutRecorderErrorReset()
  finishRecording({ captured: true })
  updateDirtyState()
}

function selectedShortcutRecorderErrorReset() {
  shortcutRecorder.classList.remove('is-error')
}

async function startRecording() {
  if (loading || saving || testing || recording || !api) return
  const sequence = ++recordingSequence
  recording = true
  shortcutRecorder.classList.add('is-recording')
  renderShortcut()
  setShortcutFeedback('Global shortcut paused while recording.', 'active')
  refreshControls()

  try {
    const result = await api.pauseShortcut()
    if (sequence !== recordingSequence) return
    if (!result?.ok) throw new Error('Could not pause the current shortcut.')
    window.addEventListener('keydown', handleShortcutKeydown, true)
  } catch (error) {
    recording = false
    shortcutRecorder.classList.remove('is-recording')
    renderShortcut()
    setShortcutFeedback(error?.message || 'Could not start recording.', 'error')
    refreshControls()
  }
}

function cancelRecording() {
  if (!recording) return
  finishRecording()
  setShortcutFeedback('Recording cancelled.', 'active')
}

function absorbLocalResult(result, failureMessage) {
  if (result?.status) localStatus = result.status
  if (!result?.ok) {
    showToast(result?.error?.message || failureMessage, 'error')
  }
  renderLocalStatus()
  updateHeroState()
  return Boolean(result?.ok)
}

async function prepareLocalModel() {
  if (!api || loading || saving || localAction) return
  setLocalAction('prepare')
  try {
    const result = await api.prepareLocalModel()
    const ready = absorbLocalResult(result, 'The local model could not be prepared.')
    if (ready && result.status?.installed) {
      showToast('NLLB-200 is ready. Start the engine to translate offline.')
    }
  } catch (error) {
    showToast(error?.message || 'The local model could not be prepared.', 'error')
  } finally {
    localAction = ''
    renderLocalStatus()
  }
}

async function cancelLocalPreparation() {
  if (!api) return
  try {
    const result = await api.cancelLocalPrepare()
    if (!result?.ok) showToast(result?.error?.message || 'Could not cancel preparation.', 'error')
  } catch (error) {
    showToast(error?.message || 'Could not cancel preparation.', 'error')
  }
}

async function startLocalEngine() {
  if (!api || loading || saving || localAction) return
  const sequence = ++localActionSequence
  setLocalAction('start')
  try {
    const result = await api.startLocalEngine()
    if (sequence !== localActionSequence) return
    const ready = absorbLocalResult(result, 'The local engine could not start.')
    if (ready && result.status?.online) {
      showToast('Local engine online. Translations stay on this device.')
    }
  } catch (error) {
    if (sequence === localActionSequence) {
      showToast(error?.message || 'The local engine could not start.', 'error')
    }
  } finally {
    if (sequence === localActionSequence) {
      localAction = ''
      renderLocalStatus()
    }
  }
}

async function stopLocalEngine() {
  // Allow stopping a start that is still loading the model into memory.
  if (!api || loading || saving || (localAction && localAction !== 'start')) return
  const sequence = ++localActionSequence
  setLocalAction('stop')
  try {
    const result = await api.stopLocalEngine()
    if (sequence !== localActionSequence) return
    const stopped = absorbLocalResult(result, 'The local engine could not stop.')
    if (stopped) showToast('Engine stopped. Its RAM has been released.')
  } catch (error) {
    if (sequence === localActionSequence) {
      showToast(error?.message || 'The local engine could not stop.', 'error')
    }
  } finally {
    if (sequence === localActionSequence) {
      localAction = ''
      renderLocalStatus()
    }
  }
}

async function testLocalEngine() {
  if (!api || loading || saving || localAction) return
  const sequence = ++localTestSequence
  setLocalAction('test')
  try {
    const result = await api.testLocalEngine()
    if (sequence !== localTestSequence) return
    if (!result?.ok) {
      showToast(result?.error?.message || 'The local engine did not respond.', 'error')
      return
    }
    showToast(`Local engine responded in ${Number(result.latencyMs) || 0} ms.`)
  } catch (error) {
    if (sequence === localTestSequence) {
      showToast(error?.message || 'The local engine did not respond.', 'error')
    }
  } finally {
    if (sequence === localTestSequence) {
      localAction = ''
      renderLocalStatus()
    }
  }
}

async function openLocalLog() {
  if (!api) return
  try {
    const result = await api.openLocalLog()
    if (!result?.ok) showToast(result?.message || 'Could not open the engine log.', 'error')
  } catch (error) {
    showToast(error?.message || 'Could not open the engine log.', 'error')
  }
}

async function testApiConnection() {
  if (loading || testing || saving || !api) return

  if (isLocalSelected()) {
    await testLocalEngine()
    return
  }

  if (!apiKey.value.trim() && !savedSettings?.apiKeyConfigured) {
    setInvalid('apiKey')
    apiKey.focus()
    showToast('Add an API key before testing.', 'error')
    return
  }

  if (apiKeyClearPending && !apiKey.value.trim()) {
    setInvalid('apiKey')
    apiKey.focus()
    showToast('Enter a new key or undo the removal before testing.', 'error')
    return
  }

  const currentTest = ++testSequence
  testing = true
  testButton.disabled = true
  testSpinner.hidden = false
  testLabel.textContent = 'Testing…'
  testResult.hidden = false
  testResult.classList.remove('is-error')
  testResult.classList.add('is-testing')
  testResultText.textContent = 'Reaching your provider…'
  setConnectionState('Testing')
  refreshControls()

  try {
    const result = await api.testConnection({
      provider: provider.value,
      apiUrl: apiUrl.value.trim(),
      model: model.value.trim(),
      apiKey: apiKey.value.trim() || undefined,
      clearApiKey: apiKeyClearPending,
    })

    if (currentTest !== testSequence) return

    if (!result?.ok) {
      testResult.classList.remove('is-testing')
      testResult.classList.add('is-error')
      testResultText.textContent = result?.error?.message || 'Connection failed.'
      testResult.title = result?.error?.detail || ''
      setConnectionState('Check connection', 'error')
      return
    }

    testResult.classList.remove('is-testing')
    testResult.classList.add('is-success')
    const modelCount = Number(result.modelCount) || 0
    testResultText.textContent = `Connected in ${result.latencyMs} ms${modelCount ? ` · ${modelCount} models visible` : ''}`
    testResult.title = ''
    setConnectionState('Connected', 'success')
    updateHeroState()
  } catch (error) {
    if (currentTest !== testSequence) return
    testResult.classList.remove('is-testing')
    testResult.classList.add('is-error')
    testResultText.textContent = error?.message || 'Connection failed.'
    setConnectionState('Check connection', 'error')
  } finally {
    if (currentTest === testSequence) {
      testing = false
      testSpinner.hidden = true
      testLabel.textContent = 'Test connection'
      refreshControls()
    }
  }
}

function validateForm() {
  clearInvalidState()

  if (!provider.value.trim()) {
    setInvalid('provider')
    provider.focus()
    return 'Choose a provider.'
  }

  if (!isLocalSelected()) {
    let parsedUrl
    try {
      parsedUrl = new URL(apiUrl.value.trim())
    } catch {
      setInvalid('apiUrl')
      apiUrl.focus()
      return 'Enter a valid API endpoint URL.'
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      setInvalid('apiUrl')
      apiUrl.focus()
      return 'The API endpoint must start with http:// or https://.'
    }

    if (!model.value.trim()) {
      setInvalid('model')
      model.focus()
      return 'Enter a model name.'
    }
  }

  if (!targetLanguage.value.trim()) {
    setInvalid('targetLanguage')
    targetLanguage.focus()
    return 'Choose a target language.'
  }

  if (!pendingShortcut) {
    shortcutRecorder.classList.add('is-error')
    shortcutRecorder.focus()
    return 'Record a global shortcut.'
  }

  return null
}

function cloudFormValues() {
  if (isLocalSelected()) {
    return {
      apiUrl: savedSettings?.apiUrl || 'https://api.openai.com/v1',
      model: savedSettings?.model || 'gpt-4o-mini',
    }
  }
  return {
    apiUrl: apiUrl.value.trim(),
    model: model.value.trim(),
  }
}

async function saveSettings() {
  if (loading || saving || testing || recording || !api) return

  const validationError = validateForm()
  if (validationError) {
    showToast(validationError, 'error')
    return
  }

  const cloud = cloudFormValues()
  saving = true
  refreshControls()
  saveSpinner.hidden = false

  try {
    const result = await api.saveSettings({
      provider: provider.value.trim(),
      apiUrl: cloud.apiUrl,
      model: cloud.model,
      targetLanguage: targetLanguage.value.trim(),
      shortcut: pendingShortcut,
      launchAtStartup: launchAtStartup.checked,
      apiKey: apiKey.value.trim() || undefined,
      clearApiKey: apiKeyClearPending,
      smartFallback: smartFallback.checked,
    })

    if (!result?.ok) {
      const error = result?.error || { message: 'Settings could not be saved.' }
      showToast(error.message, 'error')

      if (error.field === 'shortcut') {
        shortcutRecorder.classList.add('is-error')
        shortcutRecorder.focus()
        setShortcutFeedback(error.message, 'error')
      } else if (error.field) {
        setInvalid(error.field)
        const field = document.getElementById(error.field)
        if (field) field.focus()
      }
      return
    }

    fillForm(result.settings)
    showToast(
      result.warning || `Saved. Press ${result.settings.shortcutLabel} anywhere to open Dodoi.`,
      result.warning ? 'error' : 'success',
    )
  } catch (error) {
    showToast(error?.message || 'Settings could not be saved.', 'error')
  } finally {
    saving = false
    refreshControls()
  }
}

function fillForm(settings) {
  savedSettings = settings
  fallbackKeyOpen = false
  if (settings.localStatus !== undefined) localStatus = settings.localStatus
  setProviderValue(settings.provider || 'custom')
  apiUrl.value = settings.apiUrl || ''
  model.value = settings.model || ''
  targetLanguage.value = settings.targetLanguage || 'English'
  targetLanguage.maxLength = 80
  pendingShortcut = settings.shortcut || ''
  launchAtStartup.checked = settings.launchAtStartup === true
  smartFallback.checked = settings.smartFallback !== false
  apiKey.value = ''
  apiKey.type = 'password'
  apiKeyClearPending = false
  envPath.textContent = settings.envPath || '.env'
  envPath.title = settings.envPath || ''
  renderLanguageChips()
  renderShortcut()
  updateApiKeyUI()
  resetTestState()
  updateProviderVisibility()
  renderLocalStatus()
  updateHeroState()

  if (settings.shortcutActive) {
    setShortcutFeedback('Active and listening system-wide.', 'active')
  } else {
    setShortcutFeedback('Shortcut is inactive. Record a new one and save.', 'error')
  }

  baselineSnapshot = snapshot()
  loading = false
  shell.classList.remove('is-loading')
  shell.setAttribute('aria-busy', 'false')
  refreshControls()
  updateDirtyState()
  renderFreeModelPanel()

  if (freeModelApiUrl && freeModelApiUrl !== apiUrl.value.trim()) {
    freeModelSequence += 1
    freeModelApiUrl = ''
    freeModelModels = []
    freeModelLoading = false
    freeModelError = ''
    freeModelFetchedAt = 0
    renderFreeModelPanel()
  }

  if (isOpenRouterSelected()) refreshFreeModels()
}

function discardChanges() {
  if (recording) {
    finishRecording()
  }
  if (savedSettings) {
    fillForm(savedSettings)
    showToast('Unsaved changes discarded.')
  }
}

async function loadSettings() {
  if (!api) return
  const sequence = ++loadSequence
  loading = true
  shell.classList.add('is-loading')
  shell.setAttribute('aria-busy', 'true')
  refreshControls()

  if (recording) {
    recording = false
    recordingSequence += 1
    shortcutRecorder.classList.remove('is-recording')
    window.removeEventListener('keydown', handleShortcutKeydown, true)
  }

  try {
    const result = await api.getSettings()
    if (sequence !== loadSequence) return
    if (!result?.ok) throw new Error(result?.error?.message || 'Could not load settings.')
    fillForm(result.settings)
  } catch (error) {
    if (sequence !== loadSequence) return
    loading = false
    shell.classList.remove('is-loading')
    overallState.textContent = 'Unable to load'
    overallState.classList.add('is-error')
    showToast(error?.message || 'Could not load settings.', 'error')
  } finally {
    if (sequence === loadSequence) refreshControls()
  }
}

async function openEnvFile() {
  if (!api || loading) return
  try {
    const result = await api.openEnvFile()
    if (!result?.ok) {
      showToast(result?.message || 'Could not open the .env file.', 'error')
    } else {
      showToast('Opened your local .env file.')
    }
  } catch (error) {
    showToast(error?.message || 'Could not open the .env file.', 'error')
  }
}

function handleWindowBlur() {
  if (recording) {
    finishRecording()
    setShortcutFeedback('Recording cancelled.', 'active')
  }
}

provider.addEventListener('change', () => {
  fallbackKeyOpen = false
  const preset = PROVIDER_PRESETS[provider.value]
  if (preset) {
    apiUrl.value = preset.apiUrl
    model.value = preset.model
  }
  resetTestState()
  clearInvalidState()
  resetFreeModelState()
  updateProviderVisibility()
  renderLocalStatus()
  updateDirtyState()
  updateHeroState()
  refreshControls()
  if (isOpenRouterSelected()) refreshFreeModels()
})

for (const element of [apiUrl, model, apiKey]) {
  element.addEventListener('input', () => {
    if (element) clearInvalidState()
    if (element === apiKey && apiKey.value.trim()) apiKeyClearPending = false
    if (element === apiKey) updateApiKeyUI()
    if (element === model) renderFreeModelPanel()
    if (element === apiUrl && isOpenRouterSelected()) scheduleFreeModelRefresh()
    resetTestState()
    updateDirtyState()
    updateHeroState()
    refreshControls()
  })
}

apiKey.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) event.preventDefault()
})

targetLanguage.addEventListener('input', () => {
  targetLanguage.removeAttribute('aria-invalid')
  renderLanguageChips()
  updateDirtyState()
})

launchAtStartup.addEventListener('change', () => {
  updateStartupNote()
  updateDirtyState()
})

shortcutRecorder.addEventListener('click', () => {
  if (recording) cancelRecording()
  else startRecording()
})

revealKeyButton.addEventListener('click', () => {
  apiKey.type = apiKey.type === 'password' ? 'text' : 'password'
  updateApiKeyUI()
})

clearKeyButton.addEventListener('click', () => {
  apiKeyClearPending = !apiKeyClearPending
  if (apiKeyClearPending) {
    apiKey.value = ''
    apiKey.type = 'password'
  }
  clearInvalidState()
  resetTestState()
  updateApiKeyUI()
  updateDirtyState()
})

testButton.addEventListener('click', testApiConnection)
saveButton.addEventListener('click', saveSettings)
discardButton.addEventListener('click', discardChanges)
openEnvButton.addEventListener('click', openEnvFile)

localPrepareButton.addEventListener('click', prepareLocalModel)
localCancelButton.addEventListener('click', cancelLocalPreparation)
localStartButton.addEventListener('click', startLocalEngine)
localStopButton.addEventListener('click', stopLocalEngine)
localTestButton.addEventListener('click', testLocalEngine)
localLogButton.addEventListener('click', openLocalLog)

smartFallback.addEventListener('change', () => {
  if (!smartFallback.checked) fallbackKeyOpen = false
  updateProviderVisibility()
  updateFallbackSummary()
  updateHeroState()
  updateDirtyState()
})

fallbackKeyButton.addEventListener('click', () => {
  fallbackKeyOpen = !fallbackKeyOpen
  updateProviderVisibility()
  updateFallbackSummary()
  if (fallbackKeyOpen) {
    apiKeyField.scrollIntoView({ block: 'center' })
    apiKey.focus()
  }
})

freeModelSelect.addEventListener('change', () => {
  if (!isOpenRouterSelected()) return
  model.value = freeModelSelect.value
  model.removeAttribute('aria-invalid')
  resetTestState()
  renderFreeModelPanel()
  updateDirtyState()
  updateHeroState()
  refreshControls()
})

refreshFreeModelsButton.addEventListener('click', () => {
  if (loading || saving || freeModelLoading) return
  refreshFreeModels({ force: true }).catch(() => {})
})

document.getElementById('minimizeButton').addEventListener('click', () => api?.minimizeSettings())
document.getElementById('maximizeButton').addEventListener('click', () => api?.maximizeSettings())
document.getElementById('closeButton').addEventListener('click', () => api?.closeSettings())

window.addEventListener('blur', handleWindowBlur)

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (!recording && !saving && !testing) saveSettings()
  }

  if (event.key === 'Escape' && recording) {
    event.preventDefault()
    cancelRecording()
  }
})

if (!api) {
  loading = false
  shell.classList.remove('is-loading')
  overallState.textContent = 'Desktop bridge unavailable'
  overallState.classList.add('is-error')
  showToast('The desktop bridge is unavailable. Start Dodoi through Electron.', 'error')
  refreshControls()
} else {
  populateDateList()
  loadSettings()
  api.onSettingsRefresh(() => {
    if (!saving) loadSettings()
  })
  api.onSettingsChanged((settings) => {
    if (!settings || loading || saving) return

    if (settings.localStatus !== undefined) localStatus = settings.localStatus

    if (isDirty()) {
      savedSettings = { ...savedSettings, ...settings }
      baselineSnapshot = savedSnapshot(settings)
      renderLocalStatus()
      updateHeroState()
      updateDirtyState()
      return
    }

    fillForm(settings)
  })

  api.onLocalStatus((status) => {
    if (!status) return
    localStatus = status
    renderLocalStatus()
  })
}
