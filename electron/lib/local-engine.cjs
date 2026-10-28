'use strict'

const { spawn, spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const readline = require('node:readline')

const {
  LOCAL_MODEL_DOWNLOAD_BYTES,
  LOCAL_MODEL_NAME,
  LOCAL_MODEL_REPO,
  LOCAL_MODEL_SIZE_BYTES,
  LOCAL_PROVIDER,
  detectSourceLanguage,
  toFloresCode,
} = require('./local-languages.cjs')
const { TranslationError } = require('./translator.cjs')

const EVENT_PREFIX = '@@DODOI@@'
const MODEL_DIR_NAME = 'nllb-200-3.3B-int8'
const SOURCE_DIR_NAME = 'nllb-200-3.3B-source'
const START_TIMEOUT_MS = 300_000
const TRANSLATE_TIMEOUT_MS = 180_000
const HEALTH_TIMEOUT_MS = 15_000
const STOP_TIMEOUT_MS = 6_000
const COMMAND_TIMEOUT_MS = 0
const REQUIRED_DISK_BYTES = 24 * 1024 ** 3
const RECOMMENDED_RAM_BYTES = 16 * 1024 ** 3
const LOG_LIMIT_BYTES = 5 * 1024 * 1024
const MAX_LOG_LINES = 80

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

function directorySize(directory) {
  let total = 0
  let entries
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return 0
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      total += directorySize(entryPath)
    } else if (entry.isFile()) {
      try {
        total += fs.statSync(entryPath).size
      } catch {
        // A file can disappear while a download or conversion is running.
      }
    }
  }
  return total
}

function parsePythonVersion(output) {
  const match = String(output || '').match(/Python\s+(\d+)\.(\d+)\.(\d+)/i)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    version: `${match[1]}.${match[2]}.${match[3]}`,
  }
}

function pythonRank(candidate) {
  if (candidate.isVenv) return -1
  const { major, minor } = candidate
  if (major !== 3) return 100
  // ML wheels usually reach stable Python releases first. Prefer 3.12/3.13,
  // then 3.11/3.10, before trying a very new interpreter.
  const ranks = { 12: 0, 13: 1, 11: 2, 10: 3, 14: 4, 9: 5 }
  return ranks[minor] ?? 50
}

function trimDetail(lines) {
  return lines
    .slice(-MAX_LOG_LINES)
    .join('\n')
    .replace(/\s+$/, '')
    .slice(-4000)
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

class LocalEngine extends EventEmitter {
  constructor({
    userDataDir,
    appPath,
    resourcesPath,
    isPackaged = false,
    platform = process.platform,
    env = process.env,
    logger = console,
    spawnImpl = spawn,
    spawnSyncImpl = spawnSync,
    fetchImpl = globalThis.fetch,
  } = {}) {
    super()

    if (!userDataDir) throw new Error('LocalEngine requires a userDataDir')
    this.platform = platform
    this.isWindows = platform === 'win32'
    this.env = env
    this.logger = logger
    this.spawnImpl = spawnImpl
    this.spawnSyncImpl = spawnSyncImpl
    this.fetchImpl = fetchImpl
    this.now = () => Date.now()

    this.engineHome = env.DODOI_LOCAL_ENGINE_HOME
      ? path.resolve(env.DODOI_LOCAL_ENGINE_HOME.replace(/^~(?=$|[\\/])/, os.homedir()))
      : path.join(userDataDir, 'local-engine')

    this.rootDir = this.engineHome
    this.venvDir = path.join(this.rootDir, 'venv')
    this.modelsDir = path.join(this.rootDir, 'models')
    this.userModelDir = path.join(this.modelsDir, MODEL_DIR_NAME)
    this.bundledModelDir = isPackaged
      ? path.join(
          resourcesPath || path.join(appPath || '', '..'),
          'local-engine',
          'models',
          MODEL_DIR_NAME,
        )
      : path.join(
          appPath || path.join(__dirname, '..', '..'),
          'local-models',
          MODEL_DIR_NAME,
        )
    this.modelDir = this.userModelDir
    this.modelSource = 'none'
    this.modelBundled = false
    this.sourceDir = path.join(this.modelsDir, SOURCE_DIR_NAME)
    this.logPath = path.join(this.rootDir, 'engine.log')
    this.scriptsDir = isPackaged
      ? path.join(resourcesPath || path.join(appPath || '', '..'), 'local-engine')
      : path.join(appPath || path.join(__dirname, '..', '..'), 'scripts', 'local')

    this.phase = 'idle'
    this.installed = false
    this.modelSizeBytes = 0
    this.sourceSizeBytes = 0
    this.python = null
    this.progress = this.emptyProgress()
    this.lastError = null
    this.message = 'Model not downloaded yet.'
    this.port = null
    this.token = null
    this.startedAt = null
    this.lastLatencyMs = null
    this.child = null
    this.prepareChild = null
    this.commandChild = null
    this.preparePromise = null
    this.startPromise = null
    this.stopRequested = false
    this.cancelled = false
    this.depsReady = false
    this.venvReady = false
    this.lastDiskCheck = 0
    this.lastDiskInfo = null

    this.on('error', () => {})
  }

  emptyProgress() {
    return {
      active: false,
      stage: 'idle',
      percent: 0,
      message: '',
      bytes: 0,
      totalBytes: 0,
      indeterminate: false,
    }
  }

  ensureDirectories() {
    for (const directory of [this.rootDir, this.modelsDir]) {
      fs.mkdirSync(directory, { recursive: true })
    }
  }

  truncateLog() {
    try {
      const stat = fs.statSync(this.logPath)
      if (stat.size > LOG_LIMIT_BYTES) fs.truncateSync(this.logPath, 0)
    } catch {
      // The log is created on the first write.
    }
  }

  log(source, message) {
    const line = String(message || '').replace(/\s+$/, '')
    if (!line) return
    try {
      fs.appendFileSync(
        this.logPath,
        `${new Date().toISOString()} [${source}] ${line}\n`,
        'utf8',
      )
    } catch {
      // Logging must never break the engine.
    }
  }

  emitStatus() {
    this.emit('status', this.getStatus())
  }

  getDiskInfo() {
    if (this.lastDiskInfo && this.now() - this.lastDiskCheck < 10_000) {
      return this.lastDiskInfo
    }

    try {
      const stats = fs.statfsSync(this.rootDir)
      this.lastDiskInfo = {
        freeBytes: Number(stats.bavail) * Number(stats.bsize),
        totalBytes: Number(stats.blocks) * Number(stats.bsize),
      }
    } catch {
      this.lastDiskInfo = { freeBytes: null, totalBytes: null }
    }
    this.lastDiskCheck = this.now()
    return this.lastDiskInfo
  }

  getStatus() {
    const python = this.python
      ? {
          found: true,
          version: this.python.version,
          major: this.python.major,
          minor: this.python.minor,
          path: this.python.command,
          isVenv: Boolean(this.python.isVenv),
          venvReady: this.venvReady || isExecutable(this.venvPythonPath()),
          recommended: this.python.major === 3 && this.python.minor >= 10 && this.python.minor <= 13,
        }
      : {
          found: false,
          version: '',
          path: '',
          isVenv: false,
          venvReady: false,
          recommended: false,
        }

    const disk = this.getDiskInfo()
    const totalMemory = os.totalmem()
    const bus = ['preparing', 'starting', 'stopping'].includes(this.phase)

    return {
      phase: this.phase,
      online: this.phase === 'online',
      busy: bus,
      installed: this.installed,
      provider: LOCAL_PROVIDER,
      model: {
        name: LOCAL_MODEL_NAME,
        repo: LOCAL_MODEL_REPO,
        path: this.modelDir,
        bundled: this.modelBundled,
        source: this.modelSource,
        sizeBytes: this.modelSizeBytes,
        sizeLabel: formatBytes(this.modelSizeBytes),
        downloadBytes: LOCAL_MODEL_DOWNLOAD_BYTES,
        downloadLabel: formatBytes(LOCAL_MODEL_DOWNLOAD_BYTES),
        expectedSizeBytes: LOCAL_MODEL_SIZE_BYTES,
        expectedSizeLabel: formatBytes(LOCAL_MODEL_SIZE_BYTES),
      },
      python,
      progress: { ...this.progress },
      error: this.lastError ? { ...this.lastError } : null,
      message: this.message,
      port: this.phase === 'online' ? this.port : null,
      startedAt: this.phase === 'online' ? this.startedAt : null,
      lastLatencyMs: this.lastLatencyMs,
      logPath: this.logPath,
      partialBytes: this.sourceSizeBytes,
      partial: !this.installed && this.sourceSizeBytes > 0,
      disk: {
        freeBytes: disk.freeBytes,
        totalBytes: disk.totalBytes,
        requiredBytes: REQUIRED_DISK_BYTES,
        ok: disk.freeBytes === null ? null : disk.freeBytes >= REQUIRED_DISK_BYTES,
      },
      memory: {
        totalBytes: totalMemory,
        recommendedBytes: RECOMMENDED_RAM_BYTES,
        warning: totalMemory > 0 && totalMemory < RECOMMENDED_RAM_BYTES,
      },
    }
  }

  venvPythonPath() {
    return this.isWindows
      ? path.join(this.venvDir, 'Scripts', 'python.exe')
      : path.join(this.venvDir, 'bin', 'python')
  }

  discoverPython() {
    const candidates = []
    const add = (candidate) => {
      if (!candidate.command) return
      const key = `${candidate.command}\u0000${(candidate.args || []).join('\u0000')}`
      if (candidates.some((item) => item.key === key)) return
      candidates.push({ ...candidate, key })
    }

    const venvPython = this.venvPythonPath()
    if (isExecutable(venvPython) || fs.existsSync(venvPython)) {
      add({ command: venvPython, args: [], isVenv: true })
    }
    if (this.env.DODOI_PYTHON) {
      add({ command: this.env.DODOI_PYTHON, args: [] })
    }
    if (this.isWindows) {
      add({ command: 'py', args: ['-3'] })
      add({ command: 'python', args: [] })
      add({ command: 'python3', args: [] })
    } else {
      add({ command: 'python3', args: [] })
      add({ command: 'python', args: [] })
    }

    const found = []
    for (const candidate of candidates) {
      try {
        const result = this.spawnSyncImpl(
          candidate.command,
          [...(candidate.args || []), '--version'],
          {
            encoding: 'utf8',
            windowsHide: true,
            timeout: 8_000,
            env: this.env,
          },
        )
        const version = parsePythonVersion(`${result.stdout || ''}\n${result.stderr || ''}`)
        if (!version) continue
        found.push({
          ...candidate,
          ...version,
          isVenv: Boolean(candidate.isVenv),
        })
      } catch {
        // Try the next interpreter.
      }
    }

    if (!found.length) {
      this.log('python', 'No usable Python interpreter found.')
      return null
    }

    found.sort((a, b) => pythonRank(a) - pythonRank(b) || b.minor - a.minor)
    const selected = found[0]
    this.log(
      'python',
      `Using ${selected.command} ${selected.version}${selected.isVenv ? ' (venv)' : ''}`,
    )
    return selected
  }

  refreshInstallation() {
    const hasBundledModel = ['model.bin', 'config.json'].every((name) =>
      fs.existsSync(path.join(this.bundledModelDir, name)),
    )

    this.modelBundled = hasBundledModel
    this.modelDir = hasBundledModel ? this.bundledModelDir : this.userModelDir

    const modelBin = path.join(this.modelDir, 'model.bin')
    const config = path.join(this.modelDir, 'config.json')
    this.installed = fs.existsSync(modelBin) && fs.existsSync(config)
    this.modelSource = !this.installed ? 'none' : hasBundledModel ? 'bundled' : 'downloaded'
    // The bundled model is read-only release data; summing a multi-gigabyte
    // directory on every status refresh is not worth it. Use the expected size.
    this.modelSizeBytes = !this.installed
      ? 0
      : hasBundledModel
        ? LOCAL_MODEL_SIZE_BYTES
        : directorySize(this.modelDir)
    this.sourceSizeBytes = directorySize(this.sourceDir)
    if (this.phase === 'idle' && this.python) this.message = this.idleMessage()
    return this.installed
  }

  idleMessage() {
    if (!this.python) return 'Python 3.10 or newer is required for the local engine.'
    if (this.installed) {
      return this.modelBundled
        ? 'Bundled model ready. Start the engine to translate offline.'
        : 'Model ready. Start the engine to translate offline.'
    }
    if (this.partial) return 'Partial download found. Download & Convert will resume where it stopped.'
    return 'Download the model to enable private, offline translation.'
  }

  async init() {
    this.ensureDirectories()
    this.truncateLog()
    this.python = this.discoverPython()
    this.venvReady = fs.existsSync(this.venvPythonPath())
    this.refreshInstallation()
    this.message = this.idleMessage()
    this.emitStatus()
    return this.getStatus()
  }

  setProgress(stage, percent, message, extra = {}) {
    const numeric = Number.isFinite(Number(percent)) ? Number(percent) : null
    this.progress = {
      active: true,
      stage,
      percent:
        numeric === null
          ? this.progress.percent || 0
          : Math.max(Number(this.progress.percent || 0), Math.max(0, Math.min(100, numeric))),
      message: message || this.progress.message,
      bytes: extra.bytes ?? this.progress.bytes ?? 0,
      totalBytes: extra.totalBytes ?? this.progress.totalBytes ?? 0,
      indeterminate: numeric === null,
    }
    this.message = this.progress.message
    this.emitStatus()
  }

  setError(error, fallbackCode = 'LOCAL_ENGINE_ERROR') {
    const normalized =
      error instanceof TranslationError
        ? error
        : new TranslationError(
            error?.message || 'The local engine ran into a problem.',
            error?.code || fallbackCode,
            { detail: error?.detail || '' },
          )

    this.lastError = {
      message: normalized.message,
      code: normalized.code,
      detail: normalized.detail || '',
    }
    this.message = normalized.message
    this.progress = { ...this.progress, active: false }
    this.phase = 'error'
    this.emitStatus()
    return normalized
  }

  ensureDiskSpace() {
    const disk = this.getDiskInfo()
    if (disk.freeBytes !== null && disk.freeBytes < REQUIRED_DISK_BYTES) {
      throw new TranslationError(
        `The local model needs about ${formatBytes(REQUIRED_DISK_BYTES)} of free disk space. Free up space and try again.`,
        'LOCAL_DISK_FULL',
        { field: 'localEngine', detail: `Free: ${formatBytes(disk.freeBytes)}` },
      )
    }
  }

  async runCommand(command, args, { label, cwd = this.rootDir, env = {}, timeout = 0 } = {}) {
    return new Promise((resolve, reject) => {
      const child = this.spawnImpl(command, args, {
        cwd,
        env: { ...this.env, ...env },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      this.commandChild = child
      const output = []
      const collect = (chunk) => {
        const text = String(chunk || '')
        for (const line of text.split(/\r?\n/)) {
          if (!line) continue
          output.push(line)
          if (output.length > MAX_LOG_LINES * 2) output.shift()
          this.log(label || 'command', line)
        }
      }

      child.stdout?.on('data', collect)
      child.stderr?.on('data', collect)

      let settled = false
      let timer = null
      const finish = (error) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        if (this.commandChild === child) this.commandChild = null
        if (error) reject(error)
        else resolve()
      }

      if (timeout > 0) {
        timer = setTimeout(() => {
          this.killChild(child)
          finish(
            new TranslationError(
              `${label || 'The local runtime'} timed out.`,
              'LOCAL_COMMAND_TIMEOUT',
              { detail: trimDetail(output) },
            ),
          )
        }, timeout)
      }

      child.on('error', (error) => {
        finish(
          new TranslationError(
            `${label || 'The local runtime'} could not start.`,
            'LOCAL_COMMAND_FAILED',
            { detail: error.message },
          ),
        )
      })

      child.on('close', (code) => {
        if (code === 0) {
          finish()
          return
        }
        finish(
          new TranslationError(
            `${label || 'The local runtime'} failed.`,
            this.cancelled || this.stopRequested ? 'LOCAL_CANCELLED' : 'LOCAL_COMMAND_FAILED',
            { detail: trimDetail(output) },
          ),
        )
      })
    })
  }

  async dependenciesReady() {
    if (this.depsReady) return true
    const python = this.venvPythonPath()
    if (!fs.existsSync(python)) return false

    try {
      await this.runCommand(
        python,
        [
          '-c',
          'import ctranslate2, transformers, sentencepiece, huggingface_hub, torch; print("ok")',
        ],
        { label: 'dependencies', timeout: 30_000 },
      )
      this.depsReady = true
      this.venvReady = true
      return true
    } catch (error) {
      this.log('dependencies', `Import check failed: ${error.message}`)
      return false
    }
  }

  async ensureVenv({ allowInstall = true, phaseLabel = 'Setting up the local runtime' } = {}) {
    this.ensureDirectories()
    if (!this.python?.found) {
      throw new TranslationError(
        'Python 3.10 or newer is required for the local engine. Install Python and restart Dodoi.',
        'LOCAL_PYTHON_MISSING',
        { field: 'localEngine' },
      )
    }

    const venvPython = this.venvPythonPath()
    if (!fs.existsSync(venvPython)) {
      if (!allowInstall) {
        throw new TranslationError(
          'The local Python environment is missing. Run Download & Convert in Settings to repair it.',
          'LOCAL_RUNTIME_MISSING',
          { field: 'localEngine' },
        )
      }

      this.setProgress('python', 2, 'Creating the isolated Python environment…')
      try {
        await this.runCommand(
          this.python.command,
          [...(this.python.args || []), '-m', 'venv', this.venvDir],
          { label: 'venv' },
        )
      } catch (error) {
        throw new TranslationError(
          'Could not create the local Python environment. On Linux, install python3-venv and try again.',
          'LOCAL_VENV_FAILED',
          { field: 'localEngine', detail: error.detail || error.message },
        )
      }
    }

    if (!fs.existsSync(venvPython)) {
      throw new TranslationError(
        'The local Python environment could not be created.',
        'LOCAL_VENV_FAILED',
        { field: 'localEngine' },
      )
    }
    this.venvReady = true

    if (await this.dependenciesReady()) return venvPython

    if (!allowInstall) {
      throw new TranslationError(
        'The local Python packages are missing. Run Download & Convert to restore them.',
        'LOCAL_RUNTIME_MISSING',
        { field: 'localEngine' },
      )
    }

    this.setProgress(
      'dependencies',
      5,
      `${phaseLabel}: installing PyTorch, CTranslate2, and Transformers. This can take several minutes…`,
    )

    const pip = ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input']
    const torchArgs = ['torch']
    if (!this.isWindows && this.platform === 'darwin') {
      // PyTorch's CPU index is Linux/Windows only; macOS wheels are on PyPI.
    } else {
      torchArgs.push('--index-url', 'https://download.pytorch.org/whl/cpu')
    }

    try {
      await this.runCommand(venvPython, [...pip, ...torchArgs], { label: 'pip-torch' })
      this.setProgress('dependencies', 8, `${phaseLabel}: installing the NLLB runtime packages…`)
      await this.runCommand(
        venvPython,
        [
          ...pip,
          '--upgrade',
          'ctranslate2',
          'transformers',
          'sentencepiece',
          'huggingface_hub',
          'safetensors',
          'accelerate',
          'protobuf',
        ],
        { label: 'pip-runtime' },
      )
    } catch (error) {
      const pythonHint =
        this.python && this.python.major === 3 && this.python.minor >= 14
          ? ' Python 3.14 does not have reliable ML wheels yet; install Python 3.12 or 3.13 and restart Dodoi.'
          : ''
      throw new TranslationError(
        `Could not install the local Python packages.${pythonHint}`,
        'LOCAL_DEPENDENCY_INSTALL_FAILED',
        { field: 'localEngine', detail: error.detail || error.message },
      )
    }

    if (!(await this.dependenciesReady())) {
      throw new TranslationError(
        'The local Python packages were installed but could not be imported.',
        'LOCAL_DEPENDENCY_IMPORT_FAILED',
        { field: 'localEngine' },
      )
    }

    return venvPython
  }

  async prepare() {
    if (this.preparePromise) return this.preparePromise
    if (this.phase === 'online' || this.phase === 'starting') {
      return Promise.reject(
        new TranslationError(
          'Stop the local engine before preparing the model.',
          'LOCAL_ENGINE_BUSY',
          { field: 'localEngine' },
        ),
      )
    }
    if (this.installed) return this.getStatus()

    this.preparePromise = this.prepareModel().finally(() => {
      this.preparePromise = null
    })
    return this.preparePromise
  }

  async prepareModel() {
    this.cancelled = false
    this.stopRequested = false
    this.depsReady = false
    this.phase = 'preparing'
    this.lastError = null
    this.progress = {
      active: true,
      stage: 'python',
      percent: 1,
      message: 'Checking Python and disk space…',
      bytes: 0,
      totalBytes: 0,
      indeterminate: false,
    }
    this.message = this.progress.message
    this.emitStatus()

    try {
      this.ensureDirectories()
      this.ensureDiskSpace()
      this.python = this.discoverPython()
      if (!this.python) {
        throw new TranslationError(
          'Python 3.10 or newer is required for the local engine. Install Python and restart Dodoi.',
          'LOCAL_PYTHON_MISSING',
          { field: 'localEngine' },
        )
      }

      await this.ensureVenv({ phaseLabel: 'Preparing the NLLB runtime' })
      if (this.cancelled) throw new TranslationError('Model preparation cancelled.', 'LOCAL_CANCELLED')

      this.setProgress('download', 12, 'Starting the Hugging Face download…')
      await this.runPrepareScript()

      this.refreshInstallation()
      if (!this.installed) {
        throw new TranslationError(
          'The conversion finished but the CTranslate2 model files were not found.',
          'LOCAL_MODEL_INCOMPLETE',
          { field: 'localEngine' },
        )
      }

      this.phase = 'idle'
      this.lastError = null
      this.progress = {
        active: false,
        stage: 'done',
        percent: 100,
        message: `Model ready · ${formatBytes(this.modelSizeBytes)}`,
        bytes: this.modelSizeBytes,
        totalBytes: this.modelSizeBytes,
        indeterminate: false,
      }
      this.message = 'Model ready. Start the engine to translate offline.'
      this.log('prepare', `Model ready (${formatBytes(this.modelSizeBytes)}).`)
      this.emitStatus()
      return this.getStatus()
    } catch (error) {
      const normalized =
        error instanceof TranslationError
          ? error
          : new TranslationError(
              'Model preparation failed.',
              'LOCAL_PREPARE_FAILED',
              { detail: error?.message || '' },
            )

      if (this.cancelled || normalized.code === 'LOCAL_CANCELLED') {
        this.phase = 'idle'
        this.lastError = null
        this.progress = { ...this.emptyProgress(), message: 'Model preparation cancelled.' }
        this.message = this.partial
          ? 'Partial download saved. Download & Convert will resume next time.'
          : 'Model preparation cancelled.'
        this.log('prepare', 'Cancelled.')
        this.emitStatus()
        return this.getStatus()
      }

      this.log('prepare', `${normalized.code}: ${normalized.message}\n${normalized.detail || ''}`)
      this.setError(normalized, 'LOCAL_PREPARE_FAILED')
      throw normalized
    } finally {
      this.prepareChild = null
      this.refreshInstallation()
    }
  }

  handlePrepareEvent(event) {
    if (!event || typeof event !== 'object') return

    if (event.type === 'stage') {
      const stage = event.stage || this.progress.stage
      const base = stage === 'download' ? 12 : stage === 'convert' ? 57 : 98
      this.setProgress(stage, base, event.message || this.progress.message, {
        bytes: event.bytes,
        totalBytes: event.totalBytes,
      })
      return
    }

    if (event.type === 'progress') {
      const stage = event.stage || this.progress.stage
      const percent = Number.isFinite(Number(event.percent)) ? Number(event.percent) : null
      let overall = this.progress.percent
      if (percent !== null) {
        const bounded = Math.max(0, Math.min(100, percent))
        if (stage === 'download') overall = 12 + bounded * 0.45
        else if (stage === 'convert') overall = 57 + bounded * 0.4
        else if (stage === 'finalize') overall = 98
        else overall = bounded
      }
      this.setProgress(stage, percent === null ? null : overall, event.message || this.progress.message, {
        bytes: event.bytes,
        totalBytes: event.totalBytes,
      })
      return
    }

    if (event.type === 'error') {
      this.lastError = {
        message: event.message || 'Model preparation failed.',
        code: event.code || 'LOCAL_PREPARE_FAILED',
        detail: event.detail || '',
      }
      return
    }

    if (event.type === 'log') {
      this.log('prepare-script', event.message || '')
    }
  }

  async runPrepareScript() {
    const scriptPath = path.join(this.scriptsDir, 'prepare_model.py')
    if (!fs.existsSync(scriptPath)) {
      throw new TranslationError(
        'The local engine preparation script is missing from this build.',
        'LOCAL_SCRIPT_MISSING',
        { field: 'localEngine', detail: scriptPath },
      )
    }

    const python = this.venvPythonPath()
    const args = [
      scriptPath,
      '--repo',
      LOCAL_MODEL_REPO,
      '--source-dir',
      this.sourceDir,
      '--output-dir',
      this.userModelDir,
      '--quantization',
      'int8',
    ]

    return new Promise((resolve, reject) => {
      const child = this.spawnImpl(python, args, {
        cwd: this.rootDir,
        env: {
          ...this.env,
          PYTHONUNBUFFERED: '1',
          HF_HUB_DISABLE_TELEMETRY: '1',
          TOKENIZERS_PARALLELISM: 'false',
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      this.prepareChild = child
      const logs = []
      let settled = false

      const finish = (error) => {
        if (settled) return
        settled = true
        if (this.prepareChild === child) this.prepareChild = null
        if (error) reject(error)
        else resolve()
      }

      const stdout = readline.createInterface({ input: child.stdout })
      stdout.on('line', (line) => {
        if (line.startsWith(EVENT_PREFIX)) {
          try {
            this.handlePrepareEvent(JSON.parse(line.slice(EVENT_PREFIX.length).trim()))
          } catch (error) {
            this.log('prepare-script', `Unreadable event: ${line}`)
          }
          return
        }
        logs.push(line)
        if (logs.length > MAX_LOG_LINES * 2) logs.shift()
        this.log('prepare-script', line)
      })

      const stderr = readline.createInterface({ input: child.stderr })
      stderr.on('line', (line) => {
        logs.push(line)
        if (logs.length > MAX_LOG_LINES * 2) logs.shift()
        this.log('prepare-script:err', line)
      })

      child.on('error', (error) => {
        finish(
          new TranslationError(
            'The local model preparation process could not start.',
            'LOCAL_PREPARE_FAILED',
            { field: 'localEngine', detail: error.message },
          ),
        )
      })

      child.on('close', (code) => {
        if (code === 0) {
          finish()
          return
        }

        const recorded = this.lastError
        const cancelled = this.cancelled || this.stopRequested
        finish(
          new TranslationError(
            recorded?.message ||
              (cancelled
                ? 'Model preparation cancelled.'
                : 'The Hugging Face download or INT8 conversion failed.'),
            recorded?.code || (cancelled ? 'LOCAL_CANCELLED' : 'LOCAL_PREPARE_FAILED'),
            { field: 'localEngine', detail: recorded?.detail || trimDetail(logs) },
          ),
        )
      })
    })
  }

  cancelPrepare() {
    if (!this.preparePromise && !this.prepareChild && !this.commandChild) {
      return { ok: false, message: 'No model preparation is running.' }
    }

    this.cancelled = true
    this.log('prepare', 'Cancellation requested.')
    const script = this.prepareChild
    const command = this.commandChild
    if (script) this.killChild(script)
    if (command) this.killChild(command)
    return { ok: true }
  }

  async start() {
    if (this.startPromise) return this.startPromise
    this.startPromise = this.startServer().finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  async startServer() {
    if (this.phase === 'online') return this.getStatus()
    if (this.phase === 'preparing' || this.phase === 'stopping') {
      throw new TranslationError(
        'The local engine is busy. Wait for the current operation to finish.',
        'LOCAL_ENGINE_BUSY',
        { field: 'localEngine' },
      )
    }
    if (!this.installed) {
      throw new TranslationError(
        'Download and convert the NLLB model in Settings before starting the engine.',
        'LOCAL_MODEL_MISSING',
        { field: 'localEngine' },
      )
    }

    this.stopRequested = false
    this.cancelled = false
    this.phase = 'starting'
    this.lastError = null
    this.progress = {
      active: true,
      stage: 'start',
      percent: 5,
      message: 'Checking the local Python runtime…',
      bytes: 0,
      totalBytes: 0,
      indeterminate: false,
    }
    this.message = this.progress.message
    this.emitStatus()

    try {
      this.python = this.python || this.discoverPython()
      await this.ensureVenv({ phaseLabel: 'Starting the local engine' })
      if (this.stopRequested) {
        throw new TranslationError('Local engine start cancelled.', 'LOCAL_CANCELLED')
      }

      this.setProgress('start', 35, 'Loading NLLB-200 into memory. The first start can take a minute…')
      const result = await this.spawnServer()
      return result
    } catch (error) {
      const normalized =
        error instanceof TranslationError
          ? error
          : new TranslationError('The local engine could not start.', 'LOCAL_START_FAILED', {
              detail: error?.message || '',
            })

      if (this.stopRequested || normalized.code === 'LOCAL_CANCELLED') {
        this.phase = 'idle'
        this.lastError = null
        this.progress = { ...this.emptyProgress(), message: 'Engine stopped.' }
        this.message = this.idleMessage()
        this.emitStatus()
        throw normalized
      }

      this.log('start', `${normalized.code}: ${normalized.message}\n${normalized.detail || ''}`)
      this.setError(normalized, 'LOCAL_START_FAILED')
      throw normalized
    }
  }

  spawnServer() {
    const scriptPath = path.join(this.scriptsDir, 'nllb_server.py')
    if (!fs.existsSync(scriptPath)) {
      return Promise.reject(
        new TranslationError(
          'The local translation server script is missing from this build.',
          'LOCAL_SCRIPT_MISSING',
          { field: 'localEngine', detail: scriptPath },
        ),
      )
    }

    const token = crypto.randomBytes(24).toString('hex')
    const python = this.venvPythonPath()
    const args = [
      scriptPath,
      '--model-dir',
      this.modelDir,
      '--host',
      '127.0.0.1',
      '--port',
      '0',
    ]

    return new Promise((resolve, reject) => {
      const child = this.spawnImpl(python, args, {
        cwd: this.rootDir,
        env: {
          ...this.env,
          DODOI_LOCAL_TOKEN: token,
          DODOI_PARENT_PID: String(process.pid),
          PYTHONUNBUFFERED: '1',
          TOKENIZERS_PARALLELISM: 'false',
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      this.child = child
      const logs = []
      let settled = false
      let ready = false
      let readyPort = null

      const timer = setTimeout(() => {
        if (settled) return
        this.log('server', `Startup timed out after ${START_TIMEOUT_MS} ms.`)
        this.killChild(child)
        finish(
          new TranslationError(
            'The local engine took too long to load. Check the engine log, or try a machine with more available RAM.',
            'LOCAL_START_TIMEOUT',
            { field: 'localEngine', detail: trimDetail(logs) },
          ),
        )
      }, START_TIMEOUT_MS)

      const finish = (error, status = null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (error) reject(error)
        else resolve(status)
      }

      const stdout = readline.createInterface({ input: child.stdout })
      stdout.on('line', (line) => {
        if (line.startsWith(EVENT_PREFIX)) {
          let event
          try {
            event = JSON.parse(line.slice(EVENT_PREFIX.length).trim())
          } catch {
            return
          }

          if (event.type === 'port' && Number(event.port) > 0) {
            readyPort = Number(event.port)
          } else if (event.type === 'ready') {
            if (Number(event.port) > 0) readyPort = Number(event.port)
            if (!readyPort) return
            ready = true
            this.port = readyPort
            this.token = token
            this.startedAt = this.now()
            this.phase = 'online'
            this.lastError = null
            this.progress = {
              active: false,
              stage: 'online',
              percent: 100,
              message: `Online · port ${readyPort}`,
              bytes: 0,
              totalBytes: 0,
              indeterminate: false,
            }
            this.message = 'Engine online. Translations stay on this device.'
            this.log('server', `Ready on 127.0.0.1:${readyPort}.`)
            this.emitStatus()
            finish(null, this.getStatus())
          } else if (event.type === 'error') {
            this.log('server', `Error event: ${event.message || 'unknown'}`)
            finish(
              new TranslationError(
                event.message || 'The local engine reported an error.',
                event.code || 'LOCAL_START_FAILED',
                { field: 'localEngine', detail: event.detail || '' },
              ),
            )
          }
          return
        }

        logs.push(line)
        if (logs.length > MAX_LOG_LINES * 2) logs.shift()
        this.log('server', line)
      })

      const stderr = readline.createInterface({ input: child.stderr })
      stderr.on('line', (line) => {
        logs.push(line)
        if (logs.length > MAX_LOG_LINES * 2) logs.shift()
        this.log('server:err', line)
      })

      child.on('error', (error) => {
        finish(
          new TranslationError(
            'The local Python server could not start.',
            'LOCAL_START_FAILED',
            { field: 'localEngine', detail: error.message },
          ),
        )
      })

      child.on('close', (code) => {
        if (!settled) {
          const cancelled = this.stopRequested
          finish(
            new TranslationError(
              cancelled
                ? 'Local engine start cancelled.'
                : `The local engine stopped before it was ready (exit ${code}).`,
              cancelled ? 'LOCAL_CANCELLED' : 'LOCAL_START_FAILED',
              { field: 'localEngine', detail: trimDetail(logs) },
            ),
          )
          return
        }

        if (ready) this.handleServerClose(child)
      })
    })
  }

  async stop() {
    this.stopRequested = true
    this.cancelled = true
    const child = this.child
    if (!child && this.phase !== 'starting') {
      this.phase = 'idle'
      this.port = null
      this.token = null
      this.startedAt = null
      this.progress = { ...this.emptyProgress(), message: 'Engine stopped.' }
      this.message = this.idleMessage()
      this.emitStatus()
      return this.getStatus()
    }

    this.phase = 'stopping'
    this.message = 'Stopping the engine and releasing RAM…'
    this.progress = {
      active: true,
      stage: 'stopping',
      percent: 50,
      message: this.message,
      bytes: 0,
      totalBytes: 0,
      indeterminate: false,
    }
    this.emitStatus()

    const command = this.commandChild
    if (command) this.killChild(command)
    if (child) {
      this.killChild(child)
      await Promise.race([this.waitForExit(child), delay(STOP_TIMEOUT_MS)])
      if (child.exitCode === null) this.killChild(child, true)
    }

    if (this.child === child) this.child = null
    this.port = null
    this.token = null
    this.startedAt = null
    this.phase = 'idle'
    this.lastError = null
    this.progress = { ...this.emptyProgress(), message: 'Engine stopped.' }
    this.message = 'Engine stopped. The model is no longer using RAM.'
    this.log('server', 'Stopped.')
    this.emitStatus()
    return this.getStatus()
  }

  waitForExit(child) {
    return new Promise((resolve) => {
      if (!child || child.exitCode !== null || child.signalCode !== null) {
        resolve()
        return
      }
      const timer = setTimeout(resolve, STOP_TIMEOUT_MS)
      child.once('close', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  killChild(child, force = false) {
    if (!child || !child.pid) return
    if (this.isWindows) {
      try {
        this.spawnSyncImpl('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        })
      } catch {
        try {
          child.kill()
        } catch {
          // Already gone.
        }
      }
      return
    }

    try {
      child.kill(force ? 'SIGKILL' : 'SIGTERM')
    } catch {
      // Already gone.
    }
  }

  handleServerClose(child) {
    if (this.child !== child) return
    this.child = null
    this.port = null
    this.token = null
    this.startedAt = null

    if (this.stopRequested) {
      this.phase = 'idle'
      this.lastError = null
      this.progress = { ...this.emptyProgress(), message: 'Engine stopped.' }
      this.message = 'Engine stopped. The model is no longer using RAM.'
      this.emitStatus()
      return
    }

    if (this.phase === 'online' || this.phase === 'starting') {
      this.setError(
        new TranslationError(
          'The local engine stopped unexpectedly. Start it again from Settings.',
          'LOCAL_ENGINE_CRASHED',
          { field: 'localEngine', detail: 'The Python server exited while Dodoi was running.' },
        ),
        'LOCAL_ENGINE_CRASHED',
      )
    }
  }

  async translate({ text, targetLanguage }) {
    if (this.phase !== 'online' || !this.port || !this.token) {
      if (!this.installed) {
        throw new TranslationError(
          'The local NLLB model is not downloaded yet. Open Settings to download it, or use a cloud provider.',
          'LOCAL_MODEL_MISSING',
          { field: 'localEngine' },
        )
      }
      if (this.phase === 'starting') {
        throw new TranslationError(
          'The local engine is still starting. Wait a moment, or let Smart Fallback use the cloud.',
          'LOCAL_ENGINE_STARTING',
          { field: 'localEngine' },
        )
      }
      throw new TranslationError(
        'The local NLLB engine is stopped. Start it in Settings, or turn on Smart Fallback to use the cloud.',
        'LOCAL_ENGINE_OFFLINE',
        { field: 'localEngine' },
      )
    }

    const targetCode = toFloresCode(targetLanguage)
    if (!targetCode) {
      throw new TranslationError(
        `The local NLLB engine cannot translate into ${targetLanguage || 'that language'}. Choose a language from the target list or use a cloud provider.`,
        'LOCAL_LANGUAGE_UNSUPPORTED',
        { field: 'targetLanguage' },
      )
    }

    const sourceCode = detectSourceLanguage(text)
    const startedAt = this.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS)

    let response
    try {
      response = await this.fetchImpl(`http://127.0.0.1:${this.port}/translate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ text, sourceCode, targetCode }),
        signal: controller.signal,
      })
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new TranslationError(
          'The local translation took too long. Try a shorter passage.',
          'LOCAL_TIMEOUT',
          { field: 'localEngine' },
        )
      }
      throw new TranslationError(
        'Could not reach the local engine. It may have stopped. Start it again in Settings.',
        'LOCAL_ENGINE_UNREACHABLE',
        { field: 'localEngine', detail: error?.message || '' },
      )
    } finally {
      clearTimeout(timeout)
    }

    let data = null
    const raw = await response.text().catch(() => '')
    if (raw) {
      try {
        data = JSON.parse(raw)
      } catch {
        data = null
      }
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        `The local engine rejected the translation (${response.status}).`
      const code =
        response.status === 401
          ? 'LOCAL_ENGINE_AUTH'
          : response.status === 503
            ? 'LOCAL_ENGINE_LOADING'
            : 'LOCAL_TRANSLATION_FAILED'
      throw new TranslationError(message, code, {
        status: response.status,
        field: 'localEngine',
        detail: raw.slice(0, 400),
      })
    }

    const translated = String(data?.translation || '').trim()
    if (!translated) {
      throw new TranslationError(
        'The local engine returned an empty translation.',
        'EMPTY_TRANSLATION',
        { field: 'localEngine' },
      )
    }

    this.lastLatencyMs = this.now() - startedAt
    return {
      text: translated,
      model: LOCAL_MODEL_NAME,
      provider: LOCAL_PROVIDER,
      sourceCode: data?.sourceCode || sourceCode,
      targetCode: data?.targetCode || targetCode,
      latencyMs: this.lastLatencyMs,
    }
  }

  async ping() {
    if (this.phase !== 'online' || !this.port || !this.token) {
      throw new TranslationError(
        'The local engine is stopped. Start it from the local engine panel first.',
        'LOCAL_ENGINE_OFFLINE',
        { field: 'localEngine' },
      )
    }

    const startedAt = this.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
    try {
      const response = await this.fetchImpl(`http://127.0.0.1:${this.port}/health`, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new TranslationError(
          data?.error?.message || 'The local engine health check failed.',
          'LOCAL_ENGINE_ERROR',
          { field: 'localEngine' },
        )
      }
      return {
        ok: true,
        latencyMs: this.now() - startedAt,
        ...data,
      }
    } catch (error) {
      if (error instanceof TranslationError) throw error
      throw new TranslationError(
        'Could not reach the local engine.',
        'LOCAL_ENGINE_UNREACHABLE',
        { field: 'localEngine', detail: error?.message || '' },
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  shutdownSync() {
    this.stopRequested = true
    this.cancelled = true
    const children = [this.prepareChild, this.commandChild, this.child].filter(Boolean)
    for (const child of children) this.killChild(child, true)
    this.child = null
    this.prepareChild = null
    this.commandChild = null
    this.phase = 'idle'
    this.port = null
    this.token = null
  }
}

module.exports = {
  LocalEngine,
  REQUIRED_DISK_BYTES,
  RECOMMENDED_RAM_BYTES,
  directorySize,
  formatBytes,
  parsePythonVersion,
  pythonRank,
}
