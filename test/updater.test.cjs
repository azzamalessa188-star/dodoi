'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const test = require('node:test')

const {
  CHECK_INTERVAL_MS,
  INITIAL_CHECK_DELAY_MS,
  UpdateManager,
  autoUpdateSupported,
} = require('../electron/lib/updater.cjs')

const silentLogger = { info() {}, warn() {}, error() {}, debug() {} }

function makeManager(overrides = {}) {
  const updater = new EventEmitter()
  const statuses = []
  const timers = []
  const intervals = []
  const downloads = []
  const manager = new UpdateManager({
    app: { isPackaged: true, getVersion: () => '0.2.0' },
    platform: 'win32',
    env: {},
    updater,
    logger: silentLogger,
    onStatus: (status) => statuses.push(status),
    onDownloaded: (info) => downloads.push(info),
    setTimeoutImpl: (callback, delay) => {
      const timer = { callback, delay, unref() {} }
      timers.push(timer)
      return timer
    },
    clearTimeoutImpl: () => {},
    setIntervalImpl: (callback, delay) => {
      const timer = { callback, delay, unref() {} }
      intervals.push(timer)
      return timer
    },
    clearIntervalImpl: () => {},
    ...overrides,
  })
  return { manager, updater, statuses, timers, intervals, downloads }
}

test('detects which builds can auto-update', () => {
  assert.equal(autoUpdateSupported({ app: { isPackaged: false }, platform: 'win32', env: {} }), false)
  assert.equal(autoUpdateSupported({ app: { isPackaged: true }, platform: 'win32', env: {} }), true)
  assert.equal(autoUpdateSupported({ app: { isPackaged: true }, platform: 'linux', env: {} }), false)
  assert.equal(
    autoUpdateSupported({
      app: { isPackaged: true },
      platform: 'linux',
      env: { APPIMAGE: '/tmp/Dodoi.AppImage' },
    }),
    true,
  )
  assert.equal(
    autoUpdateSupported({ app: { isPackaged: true }, platform: 'win32', env: { DODOI_DISABLE_UPDATES: '1' } }),
    false,
  )
})

test('reports update availability, progress, and readiness', () => {
  const { manager, updater, statuses, downloads } = makeManager()

  assert.equal(manager.start(), true)
  assert.equal(updater.autoDownload, true)
  assert.equal(updater.autoInstallOnAppQuit, true)
  assert.equal(manager.getStatus().state, 'idle')

  updater.emit('update-available', { version: '0.2.0' })
  assert.deepEqual(
    { state: manager.getStatus().state, version: manager.getStatus().version },
    { state: 'available', version: '0.2.0' },
  )

  updater.emit('download-progress', { percent: 42.5 })
  assert.equal(manager.getStatus().state, 'downloading')
  assert.equal(manager.getStatus().percent, 42.5)

  updater.emit('update-downloaded', { version: '0.2.0' })
  assert.equal(manager.getStatus().state, 'downloaded')
  assert.equal(manager.getStatus().percent, 100)
  assert.equal(downloads.length, 1)
  assert.equal(downloads[0].version, '0.2.0')

  let installArgs = null
  updater.quitAndInstall = (...args) => {
    installArgs = args
  }
  assert.equal(manager.quitAndInstall(), true)
  assert.deepEqual(installArgs, [false, true])
  assert.ok(statuses.some((status) => status.state === 'downloaded'))

  manager.stop()
})

test('schedules periodic checks and handles failures', async () => {
  let checkCount = 0
  const { manager, updater, timers, intervals } = makeManager()
  updater.checkForUpdates = () => {
    checkCount += 1
    return Promise.resolve(null)
  }

  manager.start()
  assert.equal(timers[0].delay, INITIAL_CHECK_DELAY_MS)
  timers[0].callback()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(checkCount, 1)
  assert.equal(intervals[0].delay, CHECK_INTERVAL_MS)
  intervals[0].callback()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(checkCount, 2)

  updater.emit('error', new Error('network down'))
  assert.equal(manager.getStatus().state, 'error')
  assert.match(manager.getStatus().message, /network down/)

  manager.stop()
})

test('does not start when updates are unsupported', () => {
  const { manager } = makeManager({
    app: { isPackaged: false, getVersion: () => '0.2.0' },
  })

  assert.equal(manager.start(), false)
  assert.equal(manager.getStatus().state, 'unsupported')
  assert.equal(manager.check(), false)
  assert.equal(manager.quitAndInstall(), false)
})
