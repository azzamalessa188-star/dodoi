# Bundled local model

Dodoi can ship the converted NLLB-200 3.3B INT8 model inside the desktop
installer. The build automatically picks it up when this directory contains:

```text
local-models/
  nllb-200-3.3B-int8/
    model.bin
    config.json
    shared_vocabulary.json
    sentencepiece.bpe.model
    ...
```

Place the output of **Settings → Offline translation → Download & Convert**
here before running `npm run dist:win`, `npm run dist:mac`, or
`npm run dist:linux`. Run `npm run verify:model` first to check the files.

When the directory is missing or empty, installers keep the normal first-run
download flow. When it is present, Dodoi starts with the model already
installed and never downloads it from Hugging Face.

The converted model is about 3.5 GB, so full installers are several gigabytes.
The model directory is intentionally ignored by Git; upload it as a release
asset or move it between build machines instead of committing it.

NLLB-200 is published by Meta under CC BY-NC 4.0. Review that license before
shipping the model in a commercial distribution.
