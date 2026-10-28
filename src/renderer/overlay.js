import './base.js'

const api = window.dodoi

const body = document.body
const panel = document.getElementById('panel')
const appStatus = document.getElementById('appStatus')
const appStatusText = document.getElementById('appStatusText')
const sourceText = document.getElementById('sourceText')
const settingsButton = document.getElementById('settingsButton')
const targetChip = document.getElementById('targetChip')
const targetLanguage = document.getElementById('targetLanguage')
const translateButton = document.getElementById('translateButton')
const translateLabel = document.getElementById('translateLabel')
const translateSpinner = document.getElementById('translateSpinner')
const translateShortcut = translateButton.querySelector('kbd')
const statusBar = document.getElementById('statusBar')
const statusMessage = document.getElementById('statusMessage')
const statusAction = document.getElementById('statusAction')

if (api?.platform === 'darwin' && translateShortcut) {
  translateShortcut.textContent = '⌘ ↵'
}

let target = 'English'
let translating = false
let maxInputChars = 12000

const settingsErrorCodes = new Set([
  'NO_API_KEY',
  'AUTH_ERROR',
  'NOT_FOUND',
  'NO_MODEL',
  'INVALID_API_URL',
  'NETWORK_ERROR',
  'PROVIDER_ERROR',
])

function setAppStatus(mode, text) {
  appStatus.classList.toggle('is-busy', mode === 'busy')
  appStatus.classList.toggle('is-error', mode === 'error')
  appStatusText.textContent = text
}

function clearStatus() {
  statusBar.hidden = true
  statusBar.classList.remove('is-error', 'is-working')
  statusMessage.textContent = ''
  statusAction.hidden = true
  panel.classList.remove('has-error')
}

function showStatus(message, { type = 'error', action = false } = {}) {
  statusBar.hidden = false
  statusBar.classList.toggle('is-error', type === 'error')
  statusBar.classList.toggle('is-working', type === 'working')
  statusMessage.textContent = message
  statusMessage.title = message
  statusAction.hidden = !action
  panel.classList.toggle('has-error', type === 'error')
}

function setBusy(busy) {
  translating = busy
  panel.classList.toggle('is-translating', busy)
  panel.setAttribute('aria-busy', busy ? 'true' : 'false')
  sourceText.readOnly = busy
  translateButton.disabled = busy
  translateLabel.textContent = busy ? 'Translating' : 'Translate'
  translateSpinner.hidden = !busy
  settingsButton.disabled = busy
  targetChip.disabled = busy
  if (busy) {
    setAppStatus('busy', 'Translating')
    showStatus(`Translating into ${target}…`, { type: 'working' })
  } else if (!statusBar.classList.contains('is-error')) {
    setAppStatus('ready', 'Ready')
  }
}

function focusInput() {
  requestAnimationFrame(() => {
    sourceText.focus({ preventScroll: true })
    const length = sourceText.value.length
    sourceText.setSelectionRange(length, length)
  })
}

function applyTarget(value) {
  target = String(value || 'English')
  targetLanguage.textContent = target
  targetLanguage.title = target
  targetChip.title = `Target: ${target}. Click to change.`
}

function resetOverlay(payload = {}) {
  clearStatus()
  setBusy(false)
  setAppStatus('ready', 'Ready')
  sourceText.value = ''
  sourceText.readOnly = false
  maxInputChars = Number(payload.maxInputChars) || 12000
  sourceText.maxLength = maxInputChars
  applyTarget(payload.targetLanguage || target)
  focusInput()
}

function openSettings() {
  if (!api || translating) return
  api.openSettings()
}

async function runTranslation() {
  if (!api || translating) return

  const text = sourceText.value.trim()
  if (!text) {
    showStatus('Type something to translate.', { type: 'error' })
    focusInput()
    return
  }

  clearStatus()
  setBusy(true)

  try {
    const result = await api.translate(text)
    if (!result?.ok) {
      const message = result?.error?.message || 'Translation failed. Please try again.'
      const showSettings =
        Boolean(result?.error?.field) || settingsErrorCodes.has(result?.error?.code)
      setBusy(false)
      setAppStatus('error', 'Attention')
      showStatus(message, { type: 'error', action: showSettings })
      focusInput()
      return
    }

    sourceText.value = ''
    setBusy(false)
    setAppStatus('ready', 'Ready')
  } catch (error) {
    setBusy(false)
    setAppStatus('error', 'Attention')
    showStatus(error?.message || 'Could not reach Dodoi. Please try again.', {
      type: 'error',
      action: true,
    })
    focusInput()
  }
}

sourceText.addEventListener('input', () => {
  if (!statusBar.hidden) {
    clearStatus()
    if (!translating) setAppStatus('ready', 'Ready')
  }
})

sourceText.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    event.stopPropagation()
    runTranslation()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    if (!translating) api?.hideOverlay()
  }
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.activeElement !== sourceText) {
    event.preventDefault()
    if (!translating) api?.hideOverlay()
  }
})

translateButton.addEventListener('click', runTranslation)
settingsButton.addEventListener('click', openSettings)
targetChip.addEventListener('click', openSettings)
statusAction.addEventListener('click', openSettings)

if (!api) {
  body.classList.remove('is-hidden')
  setAppStatus('error', 'Unavailable')
  showStatus('The desktop bridge is unavailable. Start Dodoi through Electron.', {
    type: 'error',
  })
} else {
  api.onOverlayShown((payload) => {
    body.classList.remove('is-hidden')
    resetOverlay(payload)
  })

  api.onOverlayHide(() => {
    body.classList.add('is-hidden')
    setBusy(false)
    clearStatus()
  })
}
