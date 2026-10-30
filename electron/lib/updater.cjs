'use strict'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const INITIAL_CHECK_DELAY_MS = 20 * 1000

function defaultUpdater() {
  // Loaded lazily so tests and development runs do not touch the updater.
  return require('electron-updater').autoUpdater
}

function autoUpdateSupported({ app, platform = process.platform, env = process.env } = {}) {
  if (!app?.isPackaged) return false
  if (env.DODOI_DISABLE_UPDATES === '1') return false
  // electron-updater only updates AppImage builds on Linux. A .deb install
  // must be upgraded by the package manager instead.
  if (platform === 'linux' && !env.APPIMAGE) return false
  return true
}

class UpdateManager {
  constructor({
    app,
    platform = process.platform,
    env = process.env,
    logger = console,
    onStatus = () => {},
    onDownloaded = null,
    updater = null,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval,
    now = () => Date.now(),
  } = {}) {
    this.app = app
    this.platform = platform
    this.env = env
    this.logger = logger
    this.onStatus = onStatus
    this.onDownloaded = onDownloaded
    this.updater = updater
    this.setTimeoutImpl = setTimeoutImpl
    this.clearTimeoutImpl = clearTimeoutImpl
    this.setIntervalImpl = setIntervalImpl
    this.clearIntervalImpl = clearIntervalImpl
    this.now = now

    this.supported = autoUpdateSupported({ app, platform, env })
    this.started = false
    this.checking = false
    this.timer = null
    this.interval = null
    this.handlers = new Map()
    this.status = {
      state: this.supported ? 'idle' : 'unsupported',
      version: null,
      percent: 0,
      message: this.supported ? '' : 'Automatic updates are not available for this build.',
      checkedAt: null,
    }
  }

  getStatus() {
    return { ...this.status }
  }

  setStatus(patch) {
    this.status = {
      ...this.status,
      ...patch,
      checkedAt: patch.checkedAt === undefined ? this.now() : patch.checkedAt,
    }
    try {
      this.onStatus(this.getStatus())
    } catch (error) {
      this.logger.warn?.('[updates] Status listener failed:', error.message)
    }
    return this.getStatus()
  }

  start() {
    if (this.started || !this.supported) return false
    this.started = true
    this.updater = this.updater || defaultUpdater()

    this.updater.autoDownload = true
    this.updater.autoInstallOnAppQuit = true
    this.updater.autoRunAppAfterInstall = true
    this.updater.allowPrerelease = false
    this.updater.allowDowngrade = false
    this.updater.logger = this.logger

    const on = (event, handler) => {
      this.handlers.set(event, handler)
      this.updater.on(event, handler)
    }

    on('checking-for-update', () => {
      this.checking = true
      this.setStatus({ state: 'checking', message: 'Checking for updates…' })
    })

    on('update-available', (info) => {
      this.checking = false
      this.setStatus({
        state: 'available',
        version: info?.version || null,
        percent: 0,
        message: info?.version
          ? `Dodoi ${info.version} is available and downloading in the background.`
          : 'A new Dodoi version is downloading in the background.',
      })
    })

    on('update-not-available', (info) => {
      this.checking = false
      this.setStatus({
        state: 'up-to-date',
        version: info?.version || this.app?.getVersion?.() || null,
        percent: 0,
        message: 'Dodoi is up to date.',
      })
    })

    on('download-progress', (progress) => {
      const percent = Number(progress?.percent)
      this.setStatus({
        state: 'downloading',
        percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
        message: Number.isFinite(percent)
          ? `Downloading Dodoi ${this.status.version || 'update'} · ${Math.round(percent)}%`
          : 'Downloading the Dodoi update…',
      })
    })

    on('update-downloaded', (info) => {
      this.checking = false
      this.setStatus({
        state: 'downloaded',
        version: info?.version || this.status.version || null,
        percent: 100,
        message: info?.version
          ? `Dodoi ${info.version} is ready. Restart to install.`
          : 'The update is ready. Restart Dodoi to install it.',
      })
      try {
        this.onDownloaded?.(info)
      } catch (error) {
        this.logger.warn?.('[updates] Download listener failed:', error.message)
      }
    })

    on('error', (error) => {
      this.checking = false
      const message = error?.message || 'The update check failed.'
      this.logger.warn?.('[updates]', message)
      this.setStatus({ state: 'error', message })
    })

    this.timer = this.setTimeoutImpl(() => {
      this.check()
      this.interval = this.setIntervalImpl(() => this.check(), CHECK_INTERVAL_MS)
      this.interval?.unref?.()
    }, INITIAL_CHECK_DELAY_MS)
    this.timer?.unref?.()

    return true
  }

  check() {
    if (!this.supported || !this.started || this.checking) return false
    this.checking = true
    this.setStatus({ state: 'checking', message: 'Checking for updates…' })
    Promise.resolve()
      .then(() => this.updater.checkForUpdates())
      .then(() => {
        this.checking = false
      })
      .catch((error) => {
        this.checking = false
        this.logger.warn?.('[updates]', error?.message || error)
        this.setStatus({
          state: 'error',
          message: error?.message || 'The update check failed.',
        })
      })
    return true
  }

  quitAndInstall() {
    if (this.status.state !== 'downloaded') return false
    this.updater.quitAndInstall(false, true)
    return true
  }

  stop() {
    if (this.timer) this.clearTimeoutImpl(this.timer)
    if (this.interval) this.clearIntervalImpl(this.interval)
    this.timer = null
    this.interval = null
    for (const [event, handler] of this.handlers) {
      this.updater?.removeListener?.(event, handler)
    }
    this.handlers.clear()
    this.started = false
  }
}

module.exports = {
  CHECK_INTERVAL_MS,
  INITIAL_CHECK_DELAY_MS,
  UpdateManager,
  autoUpdateSupported,
}
