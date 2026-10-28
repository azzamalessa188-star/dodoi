'use strict'

const fs = require('node:fs')
const path = require('node:path')

const AUTOSTART_FILENAME = 'dodoi.desktop'
const AUTOSTART_ARG = '--autostart'
const SUPPORTED_PLATFORMS = new Set(['darwin', 'linux', 'win32'])

function escapeDesktopValue(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
}

function quoteDesktopExecArgument(value) {
  const escaped = String(value ?? '')
    .replace(/%/g, '%%')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')

  return `"${escaped}"`
}

function buildLinuxAutostartEntry({
  command,
  args = [],
  name = 'Dodoi',
  comment = 'Start Dodoi in the system tray',
}) {
  if (!command) throw new Error('A launch command is required.')

  const exec = [command, ...args]
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map(quoteDesktopExecArgument)
    .join(' ')

  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${escapeDesktopValue(name)}`,
    `Comment=${escapeDesktopValue(comment)}`,
    `Exec=${exec}`,
    'Terminal=false',
    'StartupNotify=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n')
}

class StartupManager {
  constructor({
    app,
    platform = process.platform,
    env = process.env,
    execPath = process.execPath,
    appPath = '',
    appDataDir = '',
    isPackaged = false,
    fsImpl = fs,
    pathImpl = path,
  } = {}) {
    this.app = app
    this.platform = platform
    this.env = env || {}
    this.execPath = execPath
    this.appPath = appPath
    this.appDataDir = appDataDir
    this.isPackaged = Boolean(isPackaged)
    this.fs = fsImpl
    this.path = pathImpl
    this.launch = this.resolveLaunchCommand()
  }

  get supported() {
    return SUPPORTED_PLATFORMS.has(this.platform)
  }

  get autostartPath() {
    if (!this.appDataDir) throw new Error('The application data directory is unavailable.')
    return this.path.join(this.appDataDir, 'autostart', AUTOSTART_FILENAME)
  }

  get loginItemOptions() {
    if (this.platform !== 'win32') return {}
    return {
      path: this.launch.command,
      args: this.launch.args,
    }
  }

  resolveLaunchCommand() {
    const args = []

    // In development the executable is Electron itself, so the project path
    // must be passed explicitly. Packaged apps launch their own executable.
    if (!this.isPackaged && this.appPath) args.push(this.appPath)
    args.push(AUTOSTART_ARG)

    if (this.platform === 'linux' && this.isPackaged && this.env.APPIMAGE) {
      // process.execPath points inside the temporary AppImage mount. The
      // APPIMAGE variable keeps the real, persistent file path.
      return { command: this.path.resolve(this.env.APPIMAGE), args }
    }

    return { command: this.execPath, args }
  }

  isEnabled() {
    if (!this.supported) return false

    if (this.platform === 'linux') {
      return this.fs.existsSync(this.autostartPath)
    }

    try {
      return Boolean(this.app?.getLoginItemSettings?.(this.loginItemOptions)?.openAtLogin)
    } catch {
      return false
    }
  }

  setEnabled(enabled) {
    if (!this.supported) {
      throw new Error('Launch at startup is not supported on this platform.')
    }

    if (this.platform === 'linux') {
      if (enabled) this.writeLinuxAutostart()
      else this.fs.rmSync(this.autostartPath, { force: true })
      return Boolean(enabled)
    }

    if (!this.app?.setLoginItemSettings) {
      throw new Error('The operating system startup service is unavailable.')
    }

    const settings = { openAtLogin: Boolean(enabled) }
    if (this.platform === 'win32') {
      settings.path = this.launch.command
      settings.args = this.launch.args
      settings.enabled = true
    }
    this.app.setLoginItemSettings(settings)
    return Boolean(enabled)
  }

  writeLinuxAutostart() {
    const entry = buildLinuxAutostartEntry({
      command: this.launch.command,
      args: this.launch.args,
      name: 'Dodoi',
    })
    const filePath = this.autostartPath
    const directory = this.path.dirname(filePath)
    const temporaryPath = `${filePath}.${process.pid}.tmp`

    this.fs.mkdirSync(directory, { recursive: true })
    try {
      this.fs.writeFileSync(temporaryPath, entry, { encoding: 'utf8', mode: 0o644 })
      this.fs.renameSync(temporaryPath, filePath)
    } catch (error) {
      try {
        this.fs.rmSync(temporaryPath, { force: true })
      } catch {
        // Best-effort cleanup of the temporary autostart file.
      }
      throw error
    }
  }
}

module.exports = {
  AUTOSTART_ARG,
  AUTOSTART_FILENAME,
  StartupManager,
  buildLinuxAutostartEntry,
  quoteDesktopExecArgument,
}
