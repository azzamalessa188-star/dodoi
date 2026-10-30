# Dodoi

**A floating AI translator that lives above every app.**

[![Version](https://img.shields.io/badge/version-0.2.0-c9f76f?style=flat-square)](https://github.com/azzamalessa188-star/dodoi/releases/tag/v0.2.0)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-555?style=flat-square)](#install)
[![Offline](https://img.shields.io/badge/offline-NLLB--200%203.3B-a8e857?style=flat-square)](#local-nllb-200-offline)
[![Tests](https://img.shields.io/badge/tests-58%20passing-brightgreen?style=flat-square)](#development)

Dodoi sits above every app. Press a global shortcut, type or paste text, hit **Ctrl + Enter**, and the translation is copied and inserted into the app you were using. It works with any OpenAI-compatible chat completions API, or fully offline with the built-in NLLB-200 engine.

[**Download Dodoi v0.2.0**](https://github.com/azzamalessa188-star/dodoi/releases/tag/v0.2.0) · [Landing page](landing/) · [Build from source](#build-from-source)

![Dodoi landing page](docs/landing.png)

## What's new in v0.2.0

- **Reliable translation extraction.** Reasoning models that return text in `reasoning` or `thinking` fields — or as an array of alternatives — now produce a translation instead of an empty result. Dodoi reads standard content first, then reasoning/thinking, then alternative arrays, and cleans the extracted text before pasting it.
- **Complete 0.2.0 package set.** Portable Windows x64 build, macOS Intel and Apple Silicon zips, Linux AppImage, and a Debian package.
- **Direct downloads on the landing page.** Each platform card now shows every available variant with its OS logo and a direct link to the matching release asset.
- **Refreshed documentation.** New screenshots and a fully updated README for 0.2.0.
- **Auto-update is intentionally not enabled in v0.2.0.** The release contains installers only — no `latest.yml`, `latest-mac.yml`, or `latest-linux.yml` manifests — so Dodoi will not download or install a new version in the background. See [Updates in v0.2.0](#updates-in-v020).

## Screenshots

### Floating translator

The frameless overlay is always on top, follows the display with the cursor, and pastes the result into the app you came from.

<img src="docs/overlay.png" alt="Dodoi floating translation overlay translating English text to Arabic" width="760" />

### Settings

Providers, target language, shortcut recording, Smart Fallback, launch at startup, and the offline engine — all in one window.

<img src="docs/settings.png" alt="Dodoi settings window" width="900" />

### Download hub

Every platform and variant, with direct links to the v0.2.0 release assets.

<img src="docs/download.png" alt="Dodoi landing page download cards for Windows, macOS, and Linux" width="900" />

The standalone landing page lives in [`landing/`](landing/) — a self-contained static page that mirrors the app's dark, glassy visual language.

## Features

- Frameless, transparent glassmorphism overlay that follows the cursor's display
- Summon from anywhere with a configurable global shortcut (**Shift + ~** by default)
- Translation-only system prompt with tone, dialect, and formatting preservation
- Automatic clipboard copy and paste-back into the previously focused app
- Provider presets for OpenAI, OpenRouter, and Groq, plus any custom compatible endpoint
- Fully offline NLLB-200 3.3B provider using CTranslate2 INT8
- One-click model download and conversion with live progress, resumable downloads, and disk/RAM checks
- On-demand local engine with a localhost-only, token-protected server and a real **Stop** that releases RAM
- Optional launch at startup in the system tray, with local-engine warm-up when the local provider is selected
- Smart Fallback to the last saved cloud connection when the local engine is stopped or fails
- OpenRouter free-model support: stable `openrouter/free` auto-routing plus a live free-model picker
- Automatic retry through `openrouter/free` when a selected free model is retired or unavailable
- Connection testing against the provider's `/models` endpoint
- Configurable target language, model, endpoint, and API key
- API key masked in the UI and stored only in a local `.env` file
- Tray menu and ready-to-run builds for Windows, macOS, and Linux
- Portable Windows x64 build, macOS Intel and Apple Silicon zips, Linux AppImage plus Debian package
- Bundled CPython 3.12 runtime with pinned ML packages, so the local engine needs no system Python or manual `pip` install
- Sequential translation extraction for reasoning models, so replies in `reasoning`/`thinking` fields or arrays are usable
- Optional embedded NLLB model for offline-first installers, with the normal first-run download as a fallback

## Requirements

- Node.js 20.19 or newer (22.12+ or 24 LTS recommended) and npm
- Cloud translation: an OpenAI-compatible API key and endpoint
- Offline translation: about 24 GB of free disk space for the first-time model download and conversion, and 14.5 GB of RAM recommended (a 16 GB machine with integrated graphics often reports about 15.7 GB; 8 GB can fail during 3.3B conversion). Official installers include a CPython 3.12 runtime; source builds without it fall back to a system Python 3.10–3.13.
- Internet access once if you want to download the offline model

## Install

Download from the [v0.2.0 GitHub Release](https://github.com/azzamalessa188-star/dodoi/releases/tag/v0.2.0), use the direct download buttons on the [landing page](landing/), or build from source. These are the exact artifacts attached to v0.2.0:

| Platform | Artifact | Installation |
| --- | --- | --- |
| Windows 10/11 x64 | [`Dodoi-Setup-0.2.0-x64.zip`](https://github.com/azzamalessa188-star/dodoi/releases/download/v0.2.0/Dodoi-Setup-0.2.0-x64.zip) | Extract the zip and run `Dodoi.exe`. Portable build — no installer or administrator rights required. |
| macOS 12+ Apple Silicon | [`Dodoi-0.2.0-arm64.zip`](https://github.com/azzamalessa188-star/dodoi/releases/download/v0.2.0/Dodoi-0.2.0-arm64.zip) | Extract the zip, drag **Dodoi** to **Applications**, then launch it. |
| macOS 12+ Intel | [`Dodoi-0.2.0-x64.zip`](https://github.com/azzamalessa188-star/dodoi/releases/download/v0.2.0/Dodoi-0.2.0-x64.zip) | Extract the zip, drag **Dodoi** to **Applications**, then launch it. |
| Linux x64 | [`Dodoi-0.2.0-x86_64.AppImage`](https://github.com/azzamalessa188-star/dodoi/releases/download/v0.2.0/Dodoi-0.2.0-x86_64.AppImage) | `chmod +x Dodoi-0.2.0-x86_64.AppImage`, then run it. No installation required. |
| Ubuntu/Debian x64 | [`Dodoi-0.2.0-amd64.deb`](https://github.com/azzamalessa188-star/dodoi/releases/download/v0.2.0/Dodoi-0.2.0-amd64.deb) | `sudo apt install ./Dodoi-0.2.0-amd64.deb` |

The v0.2.0 artifacts are unsigned. On macOS, right-click the app and choose **Open** the first time. On Linux, if FUSE 2 is unavailable, run the AppImage with `APPIMAGE_EXTRACT_AND_RUN=1`.

The release does **not** include update manifests. See [Updates in v0.2.0](#updates-in-v020).

### Build from source

```bash
npm install
cp .env.example .env
```

On Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

Start the app in development mode:

```bash
npm run dev
```

Or build the renderer and run the production bundle:

```bash
npm start
```

To configure everything without touching the file, open **Settings** from the tray menu, the overlay's gear button, or the target-language chip.

## Updates in v0.2.0

**Auto-update is not enabled in v0.2.0.** The GitHub release publishes the five installer artifacts listed above, but no `latest.yml`, `latest-mac.yml`, or `latest-linux.yml` files. Without those manifests there is no update feed for the packaged app to follow, so Dodoi does not download or install a new version in the background.

Upgrade manually:

1. Download the new build for your platform from [Releases](https://github.com/azzamalessa188-star/dodoi/releases).
2. Quit Dodoi from the tray menu.
3. Replace the old app with the new one.
4. Launch Dodoi again. Settings, the Python runtime, and any downloaded model stay in the per-user data directory and are reused.

The updater source remains in the repository for future releases, but it is inactive for this version because no update metadata is published.

## Usage

| Action | Shortcut |
| --- | --- |
| Show or hide Dodoi | **Shift + ~** (configurable) |
| Translate | **Ctrl + Enter** (macOS: **Cmd + Enter**) |
| Dismiss the overlay | **Esc** |
| Save settings | **Ctrl + S** (macOS: **Cmd + S**) |

1. Focus any app and press the global shortcut.
2. Type or paste the text you want to translate.
3. Press **Ctrl/Cmd + Enter**. The input locks while the request is in flight.
4. Dodoi copies the result, hides, and pastes it into your previous app.

If Dodoi cannot focus the previous app, the translation stays on your clipboard and a desktop notification tells you to paste manually.

## Configuration

Dodoi reads its settings from `.env`. During development this is the project root. In a packaged app it is stored in Electron's `userData` directory, and the path is shown at the bottom of Settings.

| Key | Default | Description |
| --- | --- | --- |
| `DODOI_PROVIDER` | `openai` | Provider preset name (`openai`, `openrouter`, `groq`, `local-nllb`, `custom`) |
| `DODOI_API_KEY` | empty | API key for the cloud provider |
| `DODOI_API_URL` | `https://api.openai.com/v1` | Base URL of the OpenAI-compatible API; also the cloud snapshot used by Smart Fallback |
| `DODOI_MODEL` | `gpt-4o-mini` | Cloud chat model ID |
| `DODOI_TARGET_LANGUAGE` | `English` | Language every translation is written in |
| `DODOI_SHORTCUT` | ``Shift+` `` | Electron accelerator for the global shortcut |
| `DODOI_LAUNCH_AT_STARTUP` | `false` | Start Dodoi hidden in the system tray when you sign in |
| `DODOI_SMART_FALLBACK` | `true` | Use the saved cloud connection if the local engine is stopped or fails |
| `DODOI_FALLBACK_PROVIDER` | `openai` | Last saved cloud provider snapshot |
| `DODOI_FALLBACK_API_URL` | `https://api.openai.com/v1` | Last saved cloud endpoint snapshot |
| `DODOI_FALLBACK_MODEL` | `gpt-4o-mini` | Last saved cloud model snapshot |

Values are quoted and escaped automatically when saved from Settings. Unrelated variables in the file are preserved. The fallback snapshot is updated automatically whenever a cloud provider is saved, so you only need to configure one cloud connection.

The endpoint can be either a base URL (`https://api.example.com/v1`) or a full chat completions URL (`https://api.example.com/v1/chat/completions`). Dodoi derives both the chat and `/models` URLs from it.

## Launch on startup

Turn on **Settings → Global shortcut → Launch on startup** to keep Dodoi waiting in the system tray after you sign in. Dodoi starts hidden, registers the global shortcut immediately, and stays out of the way until you press it.

- Windows and macOS use the system login-item mechanism.
- Linux writes `~/.config/autostart/dodoi.desktop` (or the equivalent for your `XDG_CONFIG_HOME`). AppImage builds point the entry at the real `.AppImage` file, not the temporary mount.
- If the local NLLB provider is selected and the model is already installed, Dodoi warms the local engine in the background at sign-in. If it is not installed or fails to start, Smart Fallback still handles translations through the saved cloud connection.
- Turning the toggle off and saving removes the startup registration immediately.

You can override the config location with `DODOI_ENV_FILE`:

```bash
DODOI_ENV_FILE=/path/to/.env npm start
```

## Provider examples

| Provider | Endpoint | Example model |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openrouter/free` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Ollama | `http://localhost:11434/v1` | `llama3.2` |
| LM Studio | `http://localhost:1234/v1` | any loaded model |

A local server still requires an API key value in Dodoi; most local servers accept any non-empty string.

The built-in **Local · NLLB-200 (offline)** provider is not an OpenAI-compatible endpoint. Select it from the provider menu; it does not use an endpoint URL, model ID, or API key.

## OpenRouter free models

OpenRouter changes its free-model lineup often. Dodoi handles that in two layers:

1. **Stable auto-routing.** Use `openrouter/free` as the model. OpenRouter routes each request to a free, compatible model that is available at that moment. This setting never needs to be updated when individual models are retired.
2. **Live free-model discovery.** When OpenRouter is selected, Settings automatically fetches the public `GET https://openrouter.ai/api/v1/models` endpoint. Models tagged with `:free`, or with both prompt and completion pricing set to `0`, appear in the free-model picker. The list is ranked by explicit free availability, context size, and recency, with the best option marked in the picker.

If you choose a specific free model and it is later removed, rate-limited, or unavailable, Dodoi retries the translation through `openrouter/free` without interrupting the flow. After a successful fallback, the router is saved as the model in `.env` so the failure does not repeat. Auto-routing remains available even if the free-model list cannot be fetched.

## Local NLLB-200 (offline)

Choose **Local · NLLB-200 (offline)** from the provider menu when you want translation to stay on your device. Installers may include the converted INT8 model; when they do, Settings shows **Bundled · INT8** and no model download is needed. Builds without the bundled model need an internet connection for the first-time fetch. After the model is present, translation works offline.

### First-time setup for download builds

1. Open **Settings → Provider → Local · NLLB-200 (offline)**.
2. Press **Download & Convert**. Dodoi uses its bundled CPython 3.12 runtime with the ML packages already installed. Builds without the runtime (for example a local `npm run dist` without provisioning) create an isolated virtual environment from a system Python 3.10–3.13 instead. The app downloads the 17.6 GB PyTorch source model from Hugging Face, converts it to a 3.5 GB CTranslate2 INT8 model, and removes the source weights after a successful conversion. Interrupted downloads resume where they stopped.
3. Press **Start engine**. The first load can take a minute while the INT8 weights move into RAM.

The Settings panel shows the current stage, byte progress, Python runtime, model size, available memory, and disk-space warnings. A low-memory machine can still download the model, but 3.3B conversion is likely to fail below 14.5 GB of total RAM.

### Bundled model builds

Dodoi can embed the converted model in the installer. Release builders stage the model under `local-models/nllb-200-3.3B-int8/` before packaging; `npm run verify:model` checks that the directory looks complete. When present, the model is copied to `resources/local-engine/models/` and the app prefers it over any copy in `userData`.

Official installers also embed the Python runtime, so a bundled-model build needs no first-start package installation. Builds without `resources/python-embedded/` still fall back to a system Python virtual environment.

### Storage and lifecycle

The Python runtime, fallback virtual environment, logs, and downloaded models live under Electron's `userData` directory. The bundled runtime and a bundled model stay read-only inside the installed app.

```text
userData/local-engine/
  venv/                         Isolated runtime when using the system-Python fallback
  models/
    nllb-200-3.3B-source/       Temporary source weights (removed after conversion)
    nllb-200-3.3B-int8/         Converted model from Download & Convert
  engine.log                    Runtime, download, and conversion log

<install directory>/resources/python-embedded/
  runtime.json                  Provisioned runtime manifest
  bin/python3 or python.exe     Bundled CPython 3.12 and ML packages

<install directory>/resources/local-engine/models/
  nllb-200-3.3B-int8/           Read-only model shipped by a bundled installer
```

In normal use the engine starts only when you press **Start engine**, and **Stop engine** kills the Python process so its RAM is released. When **Launch on startup** is enabled, a system sign-in launch also warms the engine if the local provider is selected and the model is installed (bundled or downloaded). Quitting Dodoi kills it synchronously. Saving a cloud provider while the local engine is online stops the engine.

The local server binds only to `127.0.0.1` on an ephemeral port and requires a random bearer token generated for each run. The token is passed to the Python process through its environment and is never exposed to the renderer.

### Languages

NLLB-200 uses FLORES-200 codes. Dodoi maps all 33 target languages in its picker to the matching code and auto-detects the source language from script and common words. If a target language is outside that mapped set, the local engine returns a clear error; use a cloud provider for languages outside the list.

### Smart Fallback

Smart Fallback is on by default. If the local engine is stopped, not downloaded, still starting, or returns an error, Dodoi transparently retries the same text through the last saved cloud provider, endpoint, and model using `DODOI_API_KEY`.

- Saving any cloud provider refreshes the fallback snapshot automatically.
- The local engine stays offline; Smart Fallback sends the request directly to the cloud only when needed.
- Turn Smart Fallback off to keep every request local. In that mode, a stopped engine surfaces an error instead of contacting a cloud provider.
- If the fallback key is missing, Settings points to the API-key field so you can add one.

## Platform notes

### Windows

The published v0.2.0 build is a portable x64 zip. Extract it anywhere and run `Dodoi.exe`; no installer, elevation prompt, or registry entry is required. Settings and local-engine data live in `%APPDATA%\Dodoi`. To remove Dodoi completely, quit it, delete the extracted folder, and delete `%APPDATA%\Dodoi` if you also want to remove settings and downloaded models.

The source tree can still produce an NSIS installer with `npm run dist:win`. Building that installer requires Windows or Wine; the v0.2.0 release uses the portable zip.

Automatic paste uses PowerShell and the Win32 foreground-window APIs. No extra installation is required, and Dodoi does not need administrator rights. A background PowerShell watcher tracks the last non-Dodoi window.

### macOS

The v0.2.0 release ships separate zips for Apple Silicon and Intel. Extract the zip and drag **Dodoi** to Applications, or run it from any folder; the app is self-contained. The builds are unsigned, so Gatekeeper may block the first launch — right-click the app and choose **Open**, or clear the quarantine flag with `xattr -dr com.apple.quarantine /Applications/Dodoi.app`.

A DMG target remains available for local and CI builds. If **Launch on startup** was enabled, turn it off in Settings before moving Dodoi to the Trash so macOS does not keep a stale login item.

Dodoi runs as a menu bar app. Automatic paste uses AppleScript and **requires Accessibility permission**:

1. Open **System Settings → Privacy & Security → Accessibility**.
2. Enable Dodoi.
3. Restart Dodoi after granting permission.

If permission is missing, translations are still copied to the clipboard.

### Linux

Use the AppImage for a portable install or the `.deb` on Ubuntu/Debian. The `.deb` installs a desktop entry under `/usr/share/applications`; the AppImage carries an embedded desktop entry. Both support **Launch on startup** through `~/.config/autostart/dodoi.desktop`.

```bash
chmod +x Dodoi-0.2.0-x86_64.AppImage
./Dodoi-0.2.0-x86_64.AppImage

sudo apt install ./Dodoi-0.2.0-amd64.deb
sudo apt remove dodoi       # later removal; user data is kept
```

Automatic paste requires `xdotool` on X11/XWayland:

```bash
sudo apt install xdotool    # Debian / Ubuntu
sudo dnf install xdotool    # Fedora
sudo pacman -S xdotool      # Arch
```

- Global shortcuts and paste-back work on X11 and most XWayland setups.
- Native Wayland sessions restrict global shortcuts and do not allow `xdotool` to control other windows. Use an X11 session or paste manually with **Ctrl + V**.
- Under WSLg, Windows controls focus hand-off between X11 windows, so automatic paste and global shortcuts may be limited. The translation is still copied to the clipboard.
- Desktop notifications use libnotify. Install `libnotify-bin` (Debian/Ubuntu) if fallback notifications do not appear.
- Some minimal window managers do not support EWMH window activation. Dodoi falls back to setting X11 focus directly, but paste-back may still be unavailable.

## Development

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server plus Electron with hot reload |
| `npm start` | Build renderer, then launch Electron |
| `npm test` | Run the Node test suite |
| `npm run build` | Build renderer assets into `dist/` |
| `npm run icons` | Regenerate app icons, tray icons, and the DMG background from the brand mark script |
| `npm run verify:model` | Validate a model staged under `local-models/` |
| `npm run python:provision` | Download the pinned CPython 3.12 runtime and ML packages for this platform |
| `npm run verify:packaged` | Check that a packaged app contains a working bundled Python runtime |
| `npm run merge:update-manifests` | Merge per-architecture `latest-mac.yml` files |
| `npm run dist` | Build an installer for the current platform |
| `npm run dist:embedded` | Provision the runtime, then build for the current platform |
| `npm run dist:win` | Build the x64 Windows NSIS installer (requires Windows or Wine) |
| `npm run dist:mac` | Build a macOS DMG and ZIP for the current architecture |
| `npm run dist:mac:x64` | Build the Intel macOS DMG and ZIP |
| `npm run dist:mac:arm64` | Build the Apple Silicon macOS DMG and ZIP |
| `npm run dist:mac:all` | Build both macOS architectures in one run (requires both provisioned runtimes) |
| `npm run dist:linux` | Build the Linux AppImage and Debian package |

Build installers on their target operating system (or in CI with the matching runner). Output goes to `release/`. Artifact names include the version and architecture, for example `Dodoi-Setup-0.2.0-x64.zip`, `Dodoi-0.2.0-arm64.zip`, `Dodoi-0.2.0-x86_64.AppImage`, and `Dodoi-0.2.0-amd64.deb`.

`npm run python:provision` downloads python-build-standalone for the current OS/architecture, verifies its SHA-256 checksum, and installs the pinned packages from `scripts/local/requirements-runtime.txt`. The result is stored in `resources/python-embedded/<os>-<arch>` and is intentionally gitignored. Run `npm run dist:embedded` to provision and package in one step. A plain `npm run dist` still works without it and produces a build that uses the system-Python fallback.

### Continuous integration

`.github/workflows/build.yml` runs the test suite and a native build on Windows x64, macOS x64 (`macos-15-intel`), macOS arm64 (`macos-15`), and Linux x64. Each job provisions its own Python runtime first. On tags matching `v*`, a final job merges the macOS update metadata, generates `SHA256SUMS.txt`, and publishes the installers plus any `latest*.yml` metadata to the matching GitHub Release. Manual dispatches only upload workflow artifacts.

For v0.2.0 the release was assembled with installers only; no update manifests were attached, so the release does not activate the in-app updater. Add these repository secrets to enable signing and notarization:

| Secret | Purpose |
| --- | --- |
| `WINDOWS_CSC_LINK`, `WINDOWS_CSC_KEY_PASSWORD` | Windows PFX code-signing certificate |
| `MACOS_CSC_LINK`, `MACOS_CSC_KEY_PASSWORD` | macOS Developer ID signing certificate (`.p12`) |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS notarization with an Apple ID |
| `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` | Alternative macOS notarization with an App Store Connect API key; `APPLE_API_KEY` holds the `.p8` file contents |

`WINDOWS_CSC_LINK` and `MACOS_CSC_LINK` accept a base64-encoded certificate or a URL. The workflow sets `CSC_LINK` from the correct one for each runner, so the two platforms can use different certificates.

Without the secrets the workflow still builds usable unsigned artifacts; electron-builder skips notarization when no Apple credentials are present.

### Bundling the offline model

Stage the converted model at `local-models/nllb-200-3.3B-int8/` before running any `dist:*` command, then run `npm run verify:model`. electron-builder copies it into `resources/local-engine/models/` and `LocalEngine` prefers that read-only copy. If the directory is absent, the installer is built without a model and first-run **Download & Convert** remains the normal flow. The model is intentionally gitignored; see `local-models/README.md`.

The Linux build also produces an unpacked app at `release/linux-unpacked/dodoi`. If FUSE 2 is unavailable (common in WSL and newer Ubuntu releases), run the AppImage with `APPIMAGE_EXTRACT_AND_RUN=1 ./release/Dodoi-0.2.0-x86_64.AppImage` or use the unpacked binary instead.

### Project layout

```text
.github/workflows/build.yml  Native Windows, macOS, and Linux installer matrix
electron/
  main.cjs              App lifecycle, windows, tray, shortcuts, IPC
  preload.cjs           Sandboxed renderer bridge
  lib/config.cjs        .env parsing, validation, secure persistence
  lib/translator.cjs    Cloud requests, local translation, Smart Fallback
  lib/local-engine.cjs  Python runtime, model preparation, local server lifecycle
  lib/local-languages.cjs  NLLB language mapping and source detection
  lib/updater.cjs      Update check and install state (inactive for v0.2.0)
  lib/startup.cjs       Login-item and XDG autostart registration
  lib/automation.cjs    Window capture and paste automation per platform
build/                  App icons, DMG background, macOS entitlements, NSIS hooks
docs/                   README screenshots
landing/                Standalone static landing page with direct downloads
local-models/           Optional staged NLLB model for bundled installers
resources/python-embedded/  Provisioned CPython 3.12 runtime (gitignored)
src/renderer/
  overlay.js            Floating overlay behavior
  settings.js           Settings form, free-model discovery, local engine controls, shortcut recorder
  styles.css            Overlay and settings visual system
test/                   Node test files
scripts/local/          NLLB download/conversion and localhost server workers
scripts/                Icon generation, runtime provisioning, and build verification
```

## Changelog

### v0.2.0 — 2026-10-29

- Fixed empty translations with reasoning models by extracting content sequentially: standard content, then `reasoning`/`thinking`, then alternative arrays, with a final cleanup pass.
- Added a complete 0.2.0 artifact set: portable Windows x64 zip, macOS arm64/x64 zips, Linux AppImage, and Debian package.
- Redesigned the landing page download section with per-OS logos and every available variant linked directly.
- Refreshed the README with new screenshots of the landing page, download hub, overlay, and settings.
- Auto-update intentionally not activated: no update manifests are published for this release.

### v0.1.0 — 2026-10-29

- First public release with the floating translator, cloud provider presets, OpenRouter free-model routing, Smart Fallback, and the offline NLLB-200 engine.

## Security and privacy

- The renderer is sandboxed with context isolation; it never receives the saved API key, only a masked hint.
- The key is written to `.env` with owner-only permissions where the filesystem supports them.
- Cloud translation text is sent directly from the main process to the provider you configure. Dodoi has no telemetry or intermediary server.
- Local translation never sends text off the device. The local server listens only on `127.0.0.1`, uses a random per-run bearer token, and is killed when the engine stops or Dodoi quits.
- When the model is not bundled, the only model-related network traffic is the first-time Hugging Face download. Official installers already contain the Python runtime and ML packages, so they do not fetch packages at runtime. Builds using the system-Python fallback fetch packages from PyPI and the PyTorch CPU index when the virtual environment is first created. Bundled installers skip the model download entirely; after setup, the local engine works without internet access.
- Window navigation and new windows are blocked in both renderer processes.

## Troubleshooting

**The shortcut does nothing.**
Another app may already own the combination. Open Settings and record a different shortcut. On Wayland or WSLg, global shortcuts may be restricted by the compositor.

**Settings says the shortcut is inactive.**
The registration failed or the saved value is invalid. Record a new combination and save; the app keeps running so you can fix it.

**The API test fails but translations work.**
Some compatible APIs do not implement `/models`. The connection test relies on that endpoint, while translation uses `/chat/completions`.

**The OpenRouter free-model list does not load.**
The picker uses the public `/models` endpoint, so a temporary network or OpenRouter outage can hide the list. `openrouter/free` still works and requires no model list. Use **Refresh** in the free-model row to try again.

**A reasoning model returns an empty translation in an older build.**
Update to v0.2.0. It extracts text from standard content, reasoning/thinking fields, and alternative arrays in order, then cleans the result before copying it.

**Download & Convert fails while installing Python packages.**
This only affects builds using the system-Python fallback; official installers ship the packages. In a fallback build, use Python 3.12 or 3.13. Very new interpreters such as 3.14 may not have matching PyTorch/CTranslate2 wheels yet. On Linux, install `python3-venv`; then reopen Settings and try again. The engine log records the exact pip output.

**The bundled Python runtime is missing or incomplete.**
Reinstall Dodoi from an official build. Developers should run `npm run python:provision` before `npm run dist`, and `npm run verify:packaged` after packaging. Setting `DODOI_DISABLE_BUNDLED_PYTHON=1` forces the system-Python fallback for debugging.

**The local engine fails to start or is killed during loading.**
NLLB-200 3.3B INT8 needs roughly 3.5 GB just for the model and more while loading. Close memory-heavy apps, or use a machine with at least 14.5 GB of total RAM (16 GB machines with integrated graphics often report about 15.7 GB). The engine log and the Settings status panel show the failure.

**Translations work, but they unexpectedly go to the cloud.**
The local engine is probably stopped or still starting. Check the badge in the local panel, press **Start engine**, or turn off Smart Fallback if you want local failures to surface instead. The fallback summary shows which cloud connection will be used.

**Where is the local model stored?**
A model downloaded with **Download & Convert** lives under `userData/local-engine/`, as shown in [Local NLLB-200](#local-nllb-200-offline). A bundled model lives under the app's `resources/local-engine/models/` directory and is read-only. Use **Open log** to jump to the `userData` engine folder. Deleting `local-engine/` removes any fallback virtual environment and downloaded model, and the next **Download & Convert** starts fresh; it does not remove the bundled Python runtime or a bundled model.

**Settings says Bundled · INT8, but Start engine still downloads packages.**
That should not happen in a current official build: the Python runtime, PyTorch, and the other ML packages are embedded. If it does, the runtime was not included in that installer. Reinstall an official build or run `npm run python:provision` before packaging locally.

**macOS says Dodoi cannot be opened or is damaged.**
The v0.2.0 builds are unsigned and blocked by Gatekeeper on first launch. Right-click the app and choose **Open**, or clear the quarantine flag with `xattr -dr com.apple.quarantine /Applications/Dodoi.app`.

**How do I update Dodoi?**
Quit Dodoi, download the new build from [Releases](https://github.com/azzamalessa188-star/dodoi/releases), replace the old app, and launch it again. v0.2.0 does not install updates in the background.

**The app seems to stay open after closing Settings.**
That is expected: Dodoi lives in the tray. Use **Quit Dodoi** from the tray menu to exit.

**Dodoi does not open after signing in.**
Open Settings, turn **Launch on startup** off, save, then turn it back on and save. On Linux, check that `~/.config/autostart/dodoi.desktop` exists and that your desktop supports XDG autostart entries. Moving an AppImage after enabling startup also requires toggling the setting again so the entry points to the new path.

**The app opens an unexpected `.env` after packaging.**
Packaged builds use the per-user config file shown at the bottom of Settings. Use **Local config** in the footer to open it.

## License

Dodoi is released under the MIT License. The optional NLLB-200 model is published by Meta under [CC BY-NC 4.0](https://huggingface.co/facebook/nllb-200-3.3B); review that license before bundling the model in a commercial distribution. Builds without the bundled model download it from Hugging Face on first use.
