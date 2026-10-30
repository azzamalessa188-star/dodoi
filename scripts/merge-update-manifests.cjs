#!/usr/bin/env node
'use strict'

/**
 * Merges per-architecture latest-mac.yml files into the single metadata file
 * electron-updater expects. When the macOS x64 and arm64 builds run in separate
 * CI jobs, each job produces a metadata file that only lists its own ZIP. The
 * updater filters the merged `files` list by architecture at runtime, so both
 * entries must be present in the published latest-mac.yml.
 *
 * Usage:
 *   node scripts/merge-update-manifests.cjs <output.yml> <input.yml> [<input.yml> ...]
 */

const fs = require('node:fs')
const yaml = require('js-yaml')

function fail(message) {
  console.error(`Cannot merge update manifests: ${message}`)
  process.exit(1)
}

function load(file) {
  try {
    const document = yaml.load(fs.readFileSync(file, 'utf8'))
    if (!document || typeof document !== 'object') {
      throw new Error('the file is empty or not a YAML mapping')
    }
    return document
  } catch (error) {
    fail(`${file}: ${error.message}`)
  }
}

function architectureRank(url) {
  if (/arm64/i.test(url)) return 1
  if (/x64/i.test(url)) return 0
  return 2
}

function main() {
  const [output, ...inputs] = process.argv.slice(2)
  if (!output || inputs.length === 0) {
    console.error(
      'Usage: node scripts/merge-update-manifests.cjs <output.yml> <input.yml> [<input.yml> ...]',
    )
    process.exit(1)
  }

  const documents = inputs.map(load)
  const version = documents[0].version
  if (!version) fail(`${inputs[0]} does not contain a version`)
  for (let index = 1; index < documents.length; index += 1) {
    if (documents[index].version !== version) {
      fail(
        `${inputs[index]} is version ${documents[index].version || 'unknown'}, expected ${version}`,
      )
    }
  }

  const files = []
  const seen = new Set()
  for (const document of documents) {
    for (const file of document.files || []) {
      if (!file?.url || seen.has(file.url)) continue
      seen.add(file.url)
      files.push(file)
    }
  }
  if (!files.length) fail('none of the input files contain a files list')
  files.sort((a, b) => architectureRank(a.url) - architectureRank(b.url))

  const primary = files.find((file) => !/arm64/i.test(file.url)) || files[0]
  const releaseDates = documents
    .map((document) => document.releaseDate)
    .filter(Boolean)
    .sort()
  const merged = {
    version,
    files,
    path: primary.url,
    sha512: primary.sha512,
    releaseDate: releaseDates[releaseDates.length - 1] || new Date().toISOString(),
  }

  fs.writeFileSync(
    output,
    yaml.dump(merged, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    }),
    'utf8',
  )
  console.log(
    `Wrote ${output} with ${files.length} file(s) for ${version}: ${files
      .map((file) => file.url)
      .join(', ')}`,
  )
}

main()
