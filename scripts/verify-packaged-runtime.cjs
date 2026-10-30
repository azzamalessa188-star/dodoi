#!/usr/bin/env node
'use strict'

/**
 * Verifies that a packaged Dodoi build actually contains a working bundled
 * CPython runtime. Run after `electron-builder` has produced an unpacked app.
 *
 * The script scans the build output for `python-embedded/runtime.json`, then
 * runs the packaged interpreter to import every runtime dependency. This
 * catches builds where electron-builder silently skipped the runtime because
 * the platform/architecture directory was not provisioned.
 */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT_DIR = process.env.DODOI_OUTPUT_DIR || path.join(ROOT, 'release')
const IMPORT_CHECK = [
  'import ctranslate2, transformers, tokenizers, sentencepiece',
  'import huggingface_hub, torch, safetensors, accelerate, numpy',
  'import google.protobuf',
  'print("runtime ok", ctranslate2.__version__, transformers.__version__, torch.__version__)',
].join('; ')

function walk(directory) {
  const results = []
  const stack = [directory]
  while (stack.length) {
    const current = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
      } else if (entry.isFile()) {
        results.push(entryPath)
      }
    }
  }
  return results
}

function findRuntimeManifests() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    throw new Error(`Build output directory does not exist: ${OUTPUT_DIR}`)
  }
  const suffix = path.join('python-embedded', 'runtime.json')
  return walk(OUTPUT_DIR)
    .filter((file) => file.endsWith(suffix))
    .sort()
}

function pythonFor(runtimeDirectory, manifest) {
  return manifest.platform === 'win32'
    ? path.join(runtimeDirectory, 'python.exe')
    : path.join(runtimeDirectory, 'bin', 'python3')
}

function verifyRuntime(manifestPath) {
  const runtimeDirectory = path.dirname(manifestPath)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const relative = path.relative(ROOT, runtimeDirectory) || runtimeDirectory

  if (manifest.schema !== 1) {
    throw new Error(`${relative}: unsupported runtime manifest schema ${manifest.schema}`)
  }
  if (!/^3\.12\./.test(manifest.python || '')) {
    throw new Error(`${relative}: expected CPython 3.12, found ${manifest.python || 'unknown'}`)
  }
  if (manifest.platform !== process.platform || manifest.arch !== process.arch) {
    console.log(
      `- Skipping ${relative}: built for ${manifest.platform}-${manifest.arch}, this host is ${process.platform}-${process.arch}.`,
    )
    return false
  }

  const python = pythonFor(runtimeDirectory, manifest)
  if (!fs.existsSync(python)) {
    throw new Error(`${relative}: runtime manifest exists but ${python} is missing`)
  }

  const result = spawnSync(python, ['-c', IMPORT_CHECK], {
    encoding: 'utf8',
    timeout: 120_000,
    env: {
      ...process.env,
      PYTHONNOUSERSITE: '1',
      PYTHONUNBUFFERED: '1',
    },
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const detail = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
    throw new Error(`${relative}: runtime import check failed (exit ${result.status}).\n${detail}`)
  }

  const output = `${result.stdout || ''}`.trim()
  console.log(`- ${relative}: ${output}`)
  return true
}

function main() {
  const manifests = findRuntimeManifests()
  if (!manifests.length) {
    throw new Error(
      `No bundled Python runtime found under ${path.relative(ROOT, OUTPUT_DIR) || OUTPUT_DIR}. ` +
        'Run `npm run python:provision` before packaging.',
    )
  }

  console.log(`Checking ${manifests.length} bundled runtime(s) under ${path.relative(ROOT, OUTPUT_DIR)}:`)
  const verified = manifests.filter(verifyRuntime).length
  if (!verified) {
    throw new Error(
      `The build contains runtimes for other platforms or architectures, but none for ${process.platform}-${process.arch}.`,
    )
  }
  console.log(`Bundled Python runtime verified in ${verified} packaged app(s).`)
}

try {
  main()
} catch (error) {
  console.error(`\nPackaged runtime verification failed: ${error.message}`)
  process.exitCode = 1
}
