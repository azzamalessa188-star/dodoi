'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  StartupManager,
  buildLinuxAutostartEntry,
  quoteDesktopExecArgument,
} = require('../electron/lib/startup.cjs')

function makeFakeApp({ openAtLogin = false } = {}) {
  const calls = []
  let enabled = openAtLogin

  return {
    calls,
    getName: () => 'Dodoi',
    getLoginItemSettings: () => ({ openAtLogin: enabled }),
    setLoginItemSettings: (settings) => {
      calls.push(settings)
      enabled = Boolean(settings.openAtLogin)
    },
  }
}

test('quotes desktop Exec arguments safely', () => {
  assert.equal(quoteDesktopExecArgument('/Applications/Dodoi.app'), '"/Applications/Dodoi.app"')
  assert.equal(quoteDesktopExecArgument('/home/me/Dodoi 100%.AppImage'), '"/home/me/Dodoi 100%%.AppImage"')
  assert.equal(quoteDesktopExecArgument('a"b\\c$d`e'), '"a\\"b\\\\c\\$d\\`e"')
})

test('builds a Linux autostart entry with the real AppImage path', () => {
  const entry = buildLinuxAutostartEntry({
    command: '/home/me/Applications/Dodoi.AppImage',
    args: ['--autostart'],
    name: 'Dodoi',
  })

  assert.match(entry, /^\[Desktop Entry\]/m)
  assert.match(entry, /^Name=Dodoi$/m)
  assert.match(entry, /^Exec="\/home\/me\/Applications\/Dodoi\.AppImage" "--autostart"$/m)
  assert.match(entry, /^X-GNOME-Autostart-enabled=true$/m)
})

test('enables and disables launch at startup on Linux', () => {
  const appDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dodoi-startup-'))
  const app = makeFakeApp()
  const manager = new StartupManager({
    app,
    platform: 'linux',
    env: { APPIMAGE: '/home/me/Applications/Dodoi 1.0.AppImage' },
    isPackaged: true,
    appDataDir,
  })

  assert.equal(manager.isEnabled(), false)
  assert.equal(manager.setEnabled(true), true)
  assert.equal(manager.isEnabled(), true)

  const filePath = path.join(appDataDir, 'autostart', 'dodoi.desktop')
  const entry = fs.readFileSync(filePath, 'utf8')
  assert.match(entry, /Dodoi 1\.0\.AppImage/)
  assert.match(entry, /"--autostart"/)

  assert.equal(manager.setEnabled(false), false)
  assert.equal(manager.isEnabled(), false)
  assert.equal(fs.existsSync(filePath), false)
})

test('uses the project path when running from source', () => {
  const manager = new StartupManager({
    app: makeFakeApp(),
    platform: 'linux',
    isPackaged: false,
    appPath: '/home/me/dodoi',
    execPath: '/home/me/dodoi/node_modules/electron/dist/electron',
    appDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'dodoi-startup-dev-')),
  })

  assert.equal(manager.launch.command, '/home/me/dodoi/node_modules/electron/dist/electron')
  assert.deepEqual(manager.launch.args, ['/home/me/dodoi', '--autostart'])
})

test('registers Windows login items with the autostart argument', () => {
  const app = makeFakeApp()
  const manager = new StartupManager({
    app,
    platform: 'win32',
    env: {},
    isPackaged: true,
    execPath: 'C:\\Program Files\\Dodoi\\Dodoi.exe',
    appDataDir: 'C:\\Users\\me\\AppData\\Roaming',
  })

  assert.equal(manager.supported, true)
  assert.equal(manager.isEnabled(), false)
  manager.setEnabled(true)
  assert.deepEqual(app.calls, [
    {
      openAtLogin: true,
      path: 'C:\\Program Files\\Dodoi\\Dodoi.exe',
      args: ['--autostart'],
      enabled: true,
    },
  ])
  assert.equal(manager.isEnabled(), true)
})

test('reports unsupported platforms without touching the app', () => {
  const app = makeFakeApp()
  const manager = new StartupManager({ app, platform: 'freebsd', isPackaged: true })

  assert.equal(manager.supported, false)
  assert.equal(manager.isEnabled(), false)
  assert.throws(() => manager.setEnabled(true), /not supported/)
  assert.deepEqual(app.calls, [])
})
