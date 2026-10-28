'use strict'

const fs = require('node:fs')
const path = require('node:path')

const MODEL_DIR_NAME = 'nllb-200-3.3B-int8'
const REQUIRED_FILES = ['model.bin', 'config.json', 'sentencepiece.bpe.model']
const MINIMUM_MODEL_BYTES = 1_500_000_000
const root = path.resolve(__dirname, '..')
const modelDir = path.join(root, 'local-models', MODEL_DIR_NAME)

function fail(message) {
  console.error(`verify:model: ${message}`)
  process.exit(1)
}

if (!fs.existsSync(modelDir)) {
  fail(
    `no bundled model found at local-models/${MODEL_DIR_NAME}.\n` +
      'Run "Download & Convert" in Dodoi, then move that model directory here. ' +
      'Standard builds continue to download the model on first use.',
  )
}

for (const name of REQUIRED_FILES) {
  const filePath = path.join(modelDir, name)
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`missing required file: local-models/${MODEL_DIR_NAME}/${name}`)
  }
}

const modelBytes = fs.statSync(path.join(modelDir, 'model.bin')).size
if (modelBytes < MINIMUM_MODEL_BYTES) {
  fail(
    `model.bin is only ${(modelBytes / 1e9).toFixed(2)} GB. ` +
      `Expected at least ${(MINIMUM_MODEL_BYTES / 1e9).toFixed(2)} GB for the INT8 NLLB-200 3.3B model.`,
  )
}

console.log(
  `verify:model: ${MODEL_DIR_NAME} looks complete (${(modelBytes / 1e9).toFixed(2)} GB model.bin). ` +
    'Installer builds will embed it.',
)
