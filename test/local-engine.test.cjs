'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  LocalEngine,
  RECOMMENDED_RAM_BYTES,
  REQUIRED_DISK_BYTES,
  directorySize,
  formatBytes,
  parsePythonVersion,
  pythonRank,
} = require('../electron/lib/local-engine.cjs')
const { LOCAL_MODEL_SIZE_BYTES, LOCAL_PROVIDER } = require('../electron/lib/local-languages.cjs')

function makeEngine(overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dodoi-local-engine-'))
  const engine = new LocalEngine({
    userDataDir: directory,
    appPath: path.resolve(__dirname, '..'),
    env: {},
    platform: 'linux',
    logger: { log() {}, warn() {}, error() {} },
    spawnSyncImpl: () => ({ stdout: 'Python 3.12.9\n', stderr: '' }),
    ...overrides,
  })
  return { directory, engine }
}

function createInstalledModel(engine) {
  fs.mkdirSync(engine.modelDir, { recursive: true })
  fs.writeFileSync(path.join(engine.modelDir, 'model.bin'), Buffer.alloc(2048))
  fs.writeFileSync(path.join(engine.modelDir, 'config.json'), '{}\n')
  engine.refreshInstallation()
}

test('formats bytes and parses Python versions', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1024), '1.0 KB')
  assert.equal(formatBytes(1536), '1.5 KB')
  assert.equal(formatBytes(3_500_000_000), '3.3 GB')
  assert.equal(formatBytes(-1), '0 B')

  assert.deepEqual(parsePythonVersion('Python 3.13.1'), {
    major: 3,
    minor: 13,
    patch: 1,
    version: '3.13.1',
  })
  assert.equal(parsePythonVersion('not python'), null)
})

test('ranks Python interpreters for ML wheel compatibility', () => {
  assert.equal(pythonRank({ isBundled: true, major: 3, minor: 12 }), -2)
  assert.equal(pythonRank({ isVenv: true, major: 3, minor: 14 }), -1)
  assert.equal(pythonRank({ major: 3, minor: 12 }), 0)
  assert.equal(pythonRank({ major: 3, minor: 13 }), 1)
  assert.equal(pythonRank({ major: 3, minor: 11 }), 2)
  assert.equal(pythonRank({ major: 3, minor: 10 }), 3)
  assert.equal(pythonRank({ major: 3, minor: 14 }), 4)
  assert.equal(pythonRank({ major: 3, minor: 9 }), 5)
  assert.equal(pythonRank({ major: 2, minor: 7 }), 100)
})

test('measures a directory tree', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dodoi-size-'))
  fs.writeFileSync(path.join(directory, 'a.bin'), Buffer.alloc(100))
  fs.mkdirSync(path.join(directory, 'nested'))
  fs.writeFileSync(path.join(directory, 'nested', 'b.bin'), Buffer.alloc(250))

  assert.equal(directorySize(directory), 350)
  assert.equal(directorySize(path.join(directory, 'missing')), 0)
})

test('initializes the local engine and reports its readiness', async () => {
  const { engine } = makeEngine()
  const status = await engine.init()

  assert.equal(status.provider, LOCAL_PROVIDER)
  assert.equal(status.online, false)
  assert.equal(status.installed, false)
  assert.equal(status.python.found, true)
  assert.equal(status.python.version, '3.12.9')
  assert.equal(status.python.recommended, true)
  assert.equal(status.model.repo, 'facebook/nllb-200-3.3B')
  assert.equal(status.disk.requiredBytes, REQUIRED_DISK_BYTES)
  assert.equal(status.memory.recommendedBytes, RECOMMENDED_RAM_BYTES)
  assert.equal(RECOMMENDED_RAM_BYTES, 14.5 * 1024 ** 3)
  assert.match(status.message, /Download the model/)
  assert.ok(fs.existsSync(engine.engineHome))
  assert.ok(fs.existsSync(engine.logPath))

  createInstalledModel(engine)
  const installed = engine.getStatus()
  assert.equal(installed.installed, true)
  assert.equal(installed.phase, 'idle')
  assert.equal(installed.model.sizeBytes, 2051)
  assert.match(installed.message, /Model ready/)
})

test('prefers a provisioned bundled Python runtime', async () => {
  const appDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dodoi-bundled-python-'))
  const runtimeDirectory = path.join(
    appDirectory,
    'resources',
    'python-embedded',
    'linux-x64',
  )
  fs.mkdirSync(path.join(runtimeDirectory, 'bin'), { recursive: true })
  fs.writeFileSync(
    path.join(runtimeDirectory, 'runtime.json'),
    JSON.stringify({ schema: 1, python: '3.12.16', platform: 'linux', arch: 'x64' }),
  )
  const bundledPython = path.join(runtimeDirectory, 'bin', 'python3')
  fs.writeFileSync(bundledPython, '#!/bin/sh\n')
  fs.chmodSync(bundledPython, 0o755)

  const calls = []
  const { engine } = makeEngine({
    appPath: appDirectory,
    spawnSyncImpl: (command, args) => {
      calls.push({ command, args })
      return { stdout: 'Python 3.12.16\n', stderr: '' }
    },
  })

  const status = await engine.init()
  assert.equal(engine.bundledPythonDir, runtimeDirectory)
  assert.equal(engine.bundledPythonPath(), bundledPython)
  assert.equal(engine.python.command, bundledPython)
  assert.equal(status.python.isBundled, true)
  assert.equal(status.python.runtime, 'bundled')
  assert.equal(status.python.version, '3.12.16')
  assert.equal(status.python.recommended, true)
  assert.deepEqual(calls[0], { command: bundledPython, args: ['--version'] })
})

test('resolves the packaged bundled Python runtime under resources', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dodoi-bundled-runtime-packaged-'))
  const resources = path.join(directory, 'resources')
  const engine = new LocalEngine({
    userDataDir: directory,
    appPath: path.join(directory, 'app.asar'),
    resourcesPath: resources,
    isPackaged: true,
    platform: 'win32',
    arch: 'x64',
    env: {},
    logger: { log() {}, warn() {}, error() {} },
  })

  assert.equal(engine.bundledPythonDir, path.join(resources, 'python-embedded'))
  assert.equal(
    engine.bundledPythonPath(),
    path.join(resources, 'python-embedded', 'python.exe'),
  )
})

test('prefers a bundled model over one downloaded to user data', async () => {
  const appDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dodoi-bundled-app-'))
  const bundledModelDir = path.join(appDirectory, 'local-models', 'nllb-200-3.3B-int8')
  fs.mkdirSync(bundledModelDir, { recursive: true })
  fs.writeFileSync(path.join(bundledModelDir, 'model.bin'), Buffer.alloc(4096))
  fs.writeFileSync(path.join(bundledModelDir, 'config.json'), '{}\n')

  const { engine } = makeEngine({ appPath: appDirectory })
  const status = await engine.init()

  assert.equal(engine.bundledModelDir, bundledModelDir)
  assert.equal(engine.modelDir, bundledModelDir)
  assert.equal(status.installed, true)
  assert.equal(status.model.bundled, true)
  assert.equal(status.model.source, 'bundled')
  assert.equal(status.model.sizeBytes, LOCAL_MODEL_SIZE_BYTES)
  assert.match(status.message, /Bundled model ready/)

  fs.mkdirSync(engine.userModelDir, { recursive: true })
  fs.writeFileSync(path.join(engine.userModelDir, 'model.bin'), Buffer.alloc(2048))
  fs.writeFileSync(path.join(engine.userModelDir, 'config.json'), '{}\n')
  engine.refreshInstallation()

  assert.equal(engine.modelDir, bundledModelDir)
  assert.equal(engine.getStatus().model.source, 'bundled')
})

test('resolves the packaged bundled model under resources', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dodoi-bundled-packaged-'))
  const engine = new LocalEngine({
    userDataDir: directory,
    appPath: path.join(directory, 'app.asar'),
    resourcesPath: path.join(directory, 'resources'),
    isPackaged: true,
    env: {},
    platform: 'linux',
    logger: { log() {}, warn() {}, error() {} },
  })

  assert.equal(
    engine.bundledModelDir,
    path.join(directory, 'resources', 'local-engine', 'models', 'nllb-200-3.3B-int8'),
  )
})

test('rejects translation when the model is missing or the engine is stopped', async () => {
  const { engine } = makeEngine()
  await engine.init()

  await assert.rejects(
    () => engine.translate({ text: 'Hello', targetLanguage: 'Spanish' }),
    (error) => {
      assert.equal(error.code, 'LOCAL_MODEL_MISSING')
      return true
    },
  )

  createInstalledModel(engine)
  await assert.rejects(
    () => engine.translate({ text: 'Hello', targetLanguage: 'Spanish' }),
    (error) => {
      assert.equal(error.code, 'LOCAL_ENGINE_OFFLINE')
      return true
    },
  )

  engine.phase = 'online'
  engine.port = 12345
  engine.token = 'test-token'
  await assert.rejects(
    () => engine.translate({ text: 'Hello', targetLanguage: 'Klingon' }),
    (error) => {
      assert.equal(error.code, 'LOCAL_LANGUAGE_UNSUPPORTED')
      return true
    },
  )
})

test('handles empty cancellation and synchronous shutdown safely', async () => {
  const { engine } = makeEngine()
  await engine.init()

  assert.deepEqual(engine.cancelPrepare(), {
    ok: false,
    message: 'No model preparation is running.',
  })

  engine.phase = 'online'
  engine.port = 12345
  engine.token = 'test-token'
  engine.shutdownSync()

  assert.equal(engine.phase, 'idle')
  assert.equal(engine.port, null)
  assert.equal(engine.token, null)
})
