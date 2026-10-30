#!/usr/bin/env node
'use strict'

/**
 * Provisions a relocatable CPython 3.12 runtime for the local NLLB engine.
 *
 * The runtime is based on python-build-standalone and includes the CPU build
 * of PyTorch plus CTranslate2, Transformers, SentencePiece, and the other
 * packages used by scripts/local/prepare_model.py and nllb_server.py.
 *
 * The result lives in resources/python-embedded/<os>-<arch> and is copied into
 * the packaged app by electron-builder. Runtime binaries are intentionally not
 * committed to Git; CI runs this script once per build platform.
 *
 * Usage:
 *   node scripts/provision-python.cjs
 *   node scripts/provision-python.cjs --force
 */

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const RESOURCES_DIR = path.join(ROOT, 'resources', 'python-embedded')
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache', 'dodoi-python')
const REQUIREMENTS = path.join(__dirname, 'local', 'requirements-runtime.txt')
const PYTHON_VERSION = '3.12.16'
const PBS_RELEASE = '20261026'
const SCHEMA_VERSION = 1

const RELEASE_BASE = `https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_RELEASE}`

const TARGETS = {
  'win32-x64': {
    key: 'win-x64',
    platform: 'win32',
    arch: 'x64',
    asset: `cpython-${PYTHON_VERSION}+${PBS_RELEASE}-x86_64-pc-windows-msvc-install_only.tar.gz`,
    sha256: '590dfcbe3a34c07301e6332e13e2188b98655cd072b08afa45a7998dc4c22bc5',
    python: ['python.exe'],
    sitePackages: ['Lib', 'site-packages'],
    torch: `https://download.pytorch.org/whl/cpu/torch-2.2.2%2Bcpu-cp312-cp312-win_amd64.whl`,
  },
  'darwin-x64': {
    key: 'mac-x64',
    platform: 'darwin',
    arch: 'x64',
    asset: `cpython-${PYTHON_VERSION}+${PBS_RELEASE}-x86_64-apple-darwin-install_only.tar.gz`,
    sha256: 'a962e47df522889eaa7ff0d6a56203f1079f68aabb65ffdbe8455f362bc769f3',
    python: ['bin', 'python3'],
    sitePackages: ['lib', 'python3.12', 'site-packages'],
    torch: 'torch==2.2.2',
  },
  'darwin-arm64': {
    key: 'mac-arm64',
    platform: 'darwin',
    arch: 'arm64',
    asset: `cpython-${PYTHON_VERSION}+${PBS_RELEASE}-aarch64-apple-darwin-install_only.tar.gz`,
    sha256: 'fbf4afef53c2a6b72bb741bc06d5671a9dfaf87bd84e5aa73ac9b3d0d589f14e',
    python: ['bin', 'python3'],
    sitePackages: ['lib', 'python3.12', 'site-packages'],
    torch: 'torch==2.2.2',
  },
  'linux-x64': {
    key: 'linux-x64',
    platform: 'linux',
    arch: 'x64',
    asset: `cpython-${PYTHON_VERSION}+${PBS_RELEASE}-x86_64-unknown-linux-gnu-install_only.tar.gz`,
    sha256: '6a79e922e50006b601f29e688407659da1c2b86ebcd4e9c7254cf234be8b89de',
    python: ['bin', 'python3'],
    sitePackages: ['lib', 'python3.12', 'site-packages'],
    torch: `https://download.pytorch.org/whl/cpu/torch-2.2.2%2Bcpu-cp312-cp312-linux_x86_64.whl`,
  },
}

function usage() {
  console.log(`Provision the bundled Python runtime for this machine.

Usage:
  node scripts/provision-python.cjs [--force]

Supported targets:
${Object.keys(TARGETS)
  .map((key) => `  - ${key}`)
  .join('\n')}

Run this on each target OS/architecture (CI does it automatically). Runtime
files are written to resources/python-embedded/<os>-<arch>.`)
}

function parseArgs(argv) {
  const args = { force: false, help: false }
  for (const arg of argv) {
    if (arg === '--force' || arg === '-f') args.force = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function targetForHost() {
  const key = `${process.platform}-${process.arch}`
  const target = TARGETS[key]
  if (!target) {
    throw new Error(
      `No bundled Python target for ${key}. Supported: ${Object.keys(TARGETS).join(', ')}.`,
    )
  }
  return target
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async function download(url, destination) {
  if (fs.existsSync(destination) && fs.statSync(destination).size > 0) return
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const partial = `${destination}.part`
  console.log(`Downloading ${url}`)
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'dodoi-build' },
  })
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status} ${response.statusText}): ${url}`)
  }
  const stream = fs.createWriteStream(partial)
  for await (const chunk of response.body) {
    if (!stream.write(chunk)) {
      await new Promise((resolve) => stream.once('drain', resolve))
    }
  }
  await new Promise((resolve, reject) => {
    stream.end(resolve)
    stream.on('error', reject)
  })
  fs.renameSync(partial, destination)
}

function extract(archive, destination) {
  fs.rmSync(destination, { recursive: true, force: true })
  fs.mkdirSync(destination, { recursive: true })
  console.log(`Extracting ${path.basename(archive)}`)
  const result = spawnSync('tar', ['-xzf', archive, '-C', destination], {
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Could not extract ${archive} (tar exited ${result.status}).`)
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    env: {
      ...process.env,
      PYTHONNOUSERSITE: '1',
      PYTHONUNBUFFERED: '1',
      PIP_DISABLE_PIP_VERSION_CHECK: '1',
      ...options.env,
    },
    cwd: options.cwd || ROOT,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const detail = options.capture
      ? `\n${(result.stdout || '').trim()}\n${(result.stderr || '').trim()}`.trim()
      : ''
    throw new Error(`${path.basename(command)} ${args[0] || ''} exited ${result.status}.${detail}`)
  }
  return result.stdout || ''
}

function removeEmptyArtifacts(directory) {
  const skipDirs = new Set([
    'test',
    'tests',
    'idlelib',
    'tkinter',
    'turtledemo',
    'ensurepip',
    'lib2to3',
    'pydoc_data',
  ])
  const stack = [directory]
  let removed = 0
  while (stack.length) {
    const current = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name) && path.relative(directory, entryPath).split(path.sep).length <= 3) {
          fs.rmSync(entryPath, { recursive: true, force: true })
          removed += 1
          continue
        }
        stack.push(entryPath)
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.pdb') ||
          entry.name.endsWith('.pyc') ||
          entry.name.endsWith('.pyo'))
      ) {
        fs.rmSync(entryPath, { force: true })
        removed += 1
      }
    }
  }
  console.log(`Removed ${removed} unused runtime artifact(s).`)
}

function directorySize(directory) {
  let total = 0
  const stack = [directory]
  while (stack.length) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(entryPath)
      else if (entry.isFile()) {
        try {
          total += fs.statSync(entryPath).size
        } catch {
          // The runtime is not being modified while this runs.
        }
      }
    }
  }
  return total
}

function formatBytes(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function manifestPath(target) {
  return path.join(RESOURCES_DIR, target.key, 'runtime.json')
}

function readManifest(target) {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(target), 'utf8'))
  } catch {
    return null
  }
}

function runtimeReady(target) {
  const directory = path.join(RESOURCES_DIR, target.key)
  const python = path.join(directory, ...target.python)
  const manifest = readManifest(target)
  return Boolean(
    manifest &&
      manifest.schema === SCHEMA_VERSION &&
      manifest.python === PYTHON_VERSION &&
      manifest.platform === target.platform &&
      manifest.arch === target.arch &&
      fs.existsSync(python),
  )
}

async function provision(target, { force }) {
  if (!force && runtimeReady(target)) {
    console.log(`Bundled Python ${PYTHON_VERSION} for ${target.key} is already provisioned.`)
    return
  }

  if (process.platform !== target.platform || process.arch !== target.arch) {
    throw new Error(
      `This machine is ${process.platform}-${process.arch}; ${target.key} must be provisioned on a ${target.platform}-${target.arch} host or in CI.`,
    )
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const archive = path.join(CACHE_DIR, target.asset)
  await download(`${RELEASE_BASE}/${target.asset.replace('+', '%2B')}`, archive)
  const actualHash = await hashFile(archive)
  if (actualHash !== target.sha256) {
    fs.rmSync(archive, { force: true })
    throw new Error(
      `Checksum mismatch for ${target.asset}.\nExpected ${target.sha256}\nReceived ${actualHash}`,
    )
  }

  const extraction = path.join(CACHE_DIR, `extract-${target.key}`)
  extract(archive, extraction)
  const extractedPython = path.join(extraction, 'python')
  if (!fs.existsSync(extractedPython)) {
    throw new Error(`The Python archive did not contain the expected python/ directory.`)
  }

  fs.mkdirSync(RESOURCES_DIR, { recursive: true })
  const destination = path.join(RESOURCES_DIR, target.key)
  fs.rmSync(destination, { recursive: true, force: true })
  fs.renameSync(extractedPython, destination)
  fs.rmSync(extraction, { recursive: true, force: true })

  const python = path.join(destination, ...target.python)
  if (!fs.existsSync(python)) {
    throw new Error(`The extracted runtime is missing ${python}.`)
  }

  console.log(`Installing PyTorch and the NLLB runtime into ${destination}`)
  const pipBase = ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--no-cache-dir']
  const torchArgs = target.torch.startsWith('http')
    ? [target.torch]
    : [target.torch, '--index-url', 'https://pypi.org/simple']
  run(python, [...pipBase, ...torchArgs])
  run(python, [...pipBase, '-r', REQUIREMENTS])

  const importCheck = [
    'import ctranslate2, transformers, sentencepiece, huggingface_hub, torch, safetensors, accelerate, numpy',
    'import google.protobuf',
    'print("runtime ok", ctranslate2.__version__, transformers.__version__, torch.__version__)',
  ].join('; ')
  run(python, ['-c', importCheck])

  const freeze = run(python, ['-m', 'pip', 'freeze'], { capture: true })
  fs.writeFileSync(path.join(destination, 'runtime-lock.txt'), freeze, 'utf8')

  removeEmptyArtifacts(destination)

  const manifest = {
    schema: SCHEMA_VERSION,
    python: PYTHON_VERSION,
    platform: target.platform,
    arch: target.arch,
    runtime: 'python-build-standalone',
    release: PBS_RELEASE,
    packages: freeze
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')),
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(manifestPath(target), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  console.log(
    `Bundled Python ready: ${destination} (${formatBytes(directorySize(destination))})`,
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return
  }
  const target = targetForHost()
  await provision(target, args)
}

main().catch((error) => {
  console.error(`\nCould not provision the bundled Python runtime: ${error.message}`)
  process.exitCode = 1
})
