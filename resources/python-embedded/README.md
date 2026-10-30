# Bundled Python runtime

Dodoi ships a relocatable CPython 3.12 runtime so the local NLLB engine does
not depend on a Python installation on the user's machine. The runtime is
generated per platform and is not committed to Git.

```bash
npm run python:provision
npm run dist:embedded
```

`python:provision` downloads the pinned python-build-standalone release for the
current OS/architecture, verifies its SHA-256 checksum, installs the CPU build
of PyTorch and the packages in `scripts/local/requirements-runtime.txt`, then
writes `runtime.json` and `runtime-lock.txt` here. The result lives in
`resources/python-embedded/<os>-<arch>` and is copied into the installer by
electron-builder. `dist:embedded` runs the provisioning step before packaging.

Official CI builds run the provisioning step on each native build runner. A
local `npm run dist:*` without provisioning still works, but the app falls
back to a system Python 3.10–3.13 installation and creates a venv on first use.

Supported targets:

- `win-x64`
- `mac-x64`
- `mac-arm64`
- `linux-x64`
