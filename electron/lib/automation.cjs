'use strict'

const { execFile, spawn } = require('node:child_process')
const readline = require('node:readline')

const execFileAsync = (file, args, options = {}) =>
  new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout
        error.stderr = stderr
        reject(error)
        return
      }
      resolve({ stdout, stderr })
    })
  })

const WIN32_TYPES = String.raw`
using System;
using System.Runtime.InteropServices;
public static class DodoiWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
}`

const WINDOWS_CAPTURE_SCRIPT = `${WIN32_TYPES}
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
try {
  $hwnd = [DodoiWin32]::GetForegroundWindow()
  if ($hwnd -eq [IntPtr]::Zero) { exit 0 }
  [uint32]$processId = 0
  [void][DodoiWin32]::GetWindowThreadProcessId($hwnd, [ref]$processId)
  $processName = ''
  try { $processName = (Get-Process -Id $processId -ErrorAction Stop).ProcessName } catch {}
  @{ hwnd = $hwnd.ToInt64(); pid = [int]$processId; name = $processName } | ConvertTo-Json -Compress
} catch {
  exit 1
}
`

const WINDOWS_WATCH_SCRIPT = `${WIN32_TYPES}
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$lastHandle = [Int64]0
while ($true) {
  try {
    $hwnd = [DodoiWin32]::GetForegroundWindow()
    $value = $hwnd.ToInt64()
    if ($value -ne 0 -and $value -ne $lastHandle) {
      [uint32]$processId = 0
      [void][DodoiWin32]::GetWindowThreadProcessId($hwnd, [ref]$processId)
      $processName = ''
      try { $processName = (Get-Process -Id $processId -ErrorAction Stop).ProcessName } catch {}
      @{ hwnd = $value; pid = [int]$processId; name = $processName } | ConvertTo-Json -Compress
      [Console]::Out.Flush()
      $lastHandle = $value
    }
  } catch {}
  Start-Sleep -Milliseconds 150
}
`

const WINDOWS_PASTE_SCRIPT = `${WIN32_TYPES}
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
try {
  $target = [IntPtr]([Int64]$env:DODOI_TARGET_HWND)
  if ($target -eq [IntPtr]::Zero) { exit 2 }

  if ([DodoiWin32]::IsIconic($target)) {
    [void][DodoiWin32]::ShowWindowAsync($target, 9)
    Start-Sleep -Milliseconds 80
  }

  $foreground = [DodoiWin32]::GetForegroundWindow()
  if ($foreground -ne $target) {
    [uint32]$foregroundPid = 0
    [uint32]$targetPid = 0
    $foregroundThread = [DodoiWin32]::GetWindowThreadProcessId($foreground, [ref]$foregroundPid)
    $targetThread = [DodoiWin32]::GetWindowThreadProcessId($target, [ref]$targetPid)
    [void][DodoiWin32]::AttachThreadInput($foregroundThread, $targetThread, $true)
    [void][DodoiWin32]::BringWindowToTop($target)
    [void][DodoiWin32]::SetForegroundWindow($target)
    Start-Sleep -Milliseconds 120
    [void][DodoiWin32]::AttachThreadInput($foregroundThread, $targetThread, $false)
  }

  Start-Sleep -Milliseconds 80
  if ([DodoiWin32]::GetForegroundWindow() -ne $target) { exit 3 }

  $shell = New-Object -ComObject WScript.Shell
  $shell.SendKeys('^v')
  Start-Sleep -Milliseconds 40
  exit 0
} catch {
  exit 4
}
`

const MAC_CAPTURE_SCRIPT = `
tell application "System Events"
  set frontProcess to first application process whose frontmost is true
  return (unix id of frontProcess as text) & "|" & (name of frontProcess)
end tell
`

function macPasteScript(pid) {
  return `
tell application "System Events"
  set targetProcess to first application process whose unix id is ${pid}
  set frontmost of targetProcess to true
end tell
delay 0.15
tell application "System Events" to keystroke "v" using command down
`
}

function encodedPowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

class AutomationService {
  constructor({ platform = process.platform, ownPid = process.pid, logger = console } = {}) {
    this.platform = platform
    this.ownPid = ownPid
    this.logger = logger
    this.foregroundTarget = null
    this.watcher = null
    this.watcherLines = null
    this.stopped = false
  }

  start() {
    if (this.platform === 'win32') this.startForegroundWatcher()
  }

  startForegroundWatcher() {
    if (this.watcher || this.platform !== 'win32') return

    try {
      this.watcher = spawn(
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-WindowStyle',
          'Hidden',
          '-EncodedCommand',
          encodedPowerShell(WINDOWS_WATCH_SCRIPT),
        ],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
      )

      this.watcherLines = readline.createInterface({ input: this.watcher.stdout })
      this.watcherLines.on('line', (line) => this.handleWatcherLine(line))
      this.watcher.on('error', (error) => {
        this.logger.warn?.('[automation] foreground watcher failed:', error.message)
      })
      this.watcher.on('exit', () => {
        this.watcherLines?.close()
        this.watcherLines = null
        this.watcher = null
        if (!this.stopped) {
          setTimeout(() => this.startForegroundWatcher(), 2500).unref?.()
        }
      })
    } catch (error) {
      this.logger.warn?.('[automation] could not start foreground watcher:', error.message)
      this.watcher = null
    }
  }

  handleWatcherLine(line) {
    let payload
    try {
      payload = JSON.parse(line)
    } catch {
      return
    }

    const hwnd = Number(payload?.hwnd)
    const pid = Number(payload?.pid)
    if (!Number.isFinite(hwnd) || hwnd <= 0) return
    if (pid === this.ownPid) return

    this.foregroundTarget = {
      platform: 'win32',
      handle: hwnd,
      pid,
      name: typeof payload.name === 'string' ? payload.name : '',
      capturedAt: Date.now(),
    }
  }

  stop() {
    this.stopped = true
    this.watcherLines?.close()
    this.watcherLines = null
    if (this.watcher) {
      try {
        this.watcher.kill()
      } catch {
        // The helper may already be gone.
      }
      this.watcher = null
    }
  }

  hasCapturedTarget() {
    return Boolean(this.foregroundTarget)
  }

  async captureActiveWindow() {
    if (this.platform === 'win32') {
      if (this.foregroundTarget) return this.foregroundTarget
      return this.captureWindowsForeground()
    }
    if (this.platform === 'darwin') return this.captureMacForeground()
    if (this.platform === 'linux') return this.captureLinuxForeground()
    return null
  }

  async captureWindowsForeground() {
    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-WindowStyle',
          'Hidden',
          '-EncodedCommand',
          encodedPowerShell(WINDOWS_CAPTURE_SCRIPT),
        ],
        { windowsHide: true, timeout: 6000, maxBuffer: 1024 * 64 },
      )

      const line = stdout.trim()
      if (!line) return null
      const payload = JSON.parse(line)
      const hwnd = Number(payload?.hwnd)
      const pid = Number(payload?.pid)
      if (!Number.isFinite(hwnd) || hwnd <= 0) return null
      if (pid === this.ownPid) return null

      const target = {
        platform: 'win32',
        handle: hwnd,
        pid,
        name: typeof payload.name === 'string' ? payload.name : '',
        capturedAt: Date.now(),
      }
      this.foregroundTarget = target
      return target
    } catch (error) {
      this.logger.warn?.('[automation] could not capture the active window:', error.message)
      return null
    }
  }

  async captureMacForeground() {
    try {
      const { stdout } = await execFileAsync('osascript', ['-e', MAC_CAPTURE_SCRIPT], {
        timeout: 4000,
        maxBuffer: 1024 * 32,
      })
      const [pidText, ...nameParts] = stdout.trim().split('|')
      const pid = Number(pidText)
      if (!Number.isInteger(pid) || pid <= 0 || pid === this.ownPid) return null

      return {
        platform: 'darwin',
        pid,
        name: nameParts.join('|').trim(),
        capturedAt: Date.now(),
      }
    } catch (error) {
      this.logger.warn?.('[automation] could not capture the frontmost app:', error.message)
      return null
    }
  }

  async captureLinuxForeground() {
    try {
      const { stdout } = await execFileAsync('xdotool', ['getactivewindow'], {
        timeout: 2500,
        maxBuffer: 1024 * 16,
      })
      const handle = stdout.trim()
      if (!/^\d+$/.test(handle)) return null

      let pid = null
      try {
        const result = await execFileAsync('xdotool', ['getwindowpid', handle], {
          timeout: 2000,
          maxBuffer: 1024 * 16,
        })
        const parsed = Number(result.stdout.trim())
        if (Number.isInteger(parsed) && parsed > 0) pid = parsed
      } catch {
        // A window id is enough for activation; the pid is only a safety check.
      }

      if (pid === this.ownPid) return null

      return {
        platform: 'linux',
        handle,
        pid,
        capturedAt: Date.now(),
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        this.logger.warn?.('[automation] could not capture the active window:', error.message)
      }
      return null
    }
  }

  async activateAndPaste(target) {
    if (!target) return { ok: false, reason: 'no-target' }
    if (target.platform !== this.platform) return { ok: false, reason: 'platform-mismatch' }

    try {
      if (this.platform === 'win32') return await this.pasteWindows(target)
      if (this.platform === 'darwin') return await this.pasteMac(target)
      if (this.platform === 'linux') return await this.pasteLinux(target)
      return { ok: false, reason: 'unsupported-platform' }
    } catch (error) {
      this.logger.warn?.('[automation] paste failed:', error.message)
      return { ok: false, reason: 'paste-failed', detail: error.message }
    }
  }

  async pasteWindows(target) {
    const handle = Number(target.handle)
    if (!Number.isSafeInteger(handle) || handle <= 0) return { ok: false, reason: 'invalid-target' }

    try {
      await execFileAsync(
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-WindowStyle',
          'Hidden',
          '-EncodedCommand',
          encodedPowerShell(WINDOWS_PASTE_SCRIPT),
        ],
        {
          windowsHide: true,
          timeout: 8000,
          maxBuffer: 1024 * 16,
          env: {
            ...process.env,
            DODOI_TARGET_HWND: String(handle),
          },
        },
      )
      return { ok: true }
    } catch (error) {
      const code = Number(error?.code)
      return {
        ok: false,
        reason:
          code === 3 ? 'focus-failed' : code === 2 ? 'invalid-target' : 'paste-command-failed',
      }
    }
  }

  async pasteMac(target) {
    const pid = Number(target.pid)
    if (!Number.isInteger(pid) || pid <= 0) return { ok: false, reason: 'invalid-target' }

    try {
      await execFileAsync('osascript', ['-e', macPasteScript(pid)], {
        timeout: 8000,
        maxBuffer: 1024 * 16,
      })
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        reason: 'paste-command-failed',
        detail: error?.stderr?.trim() || error.message,
      }
    }
  }

  async pasteLinux(target) {
    const handle = String(target.handle || '')
    if (!/^\d+$/.test(handle)) return { ok: false, reason: 'invalid-target' }

    try {
      await execFileAsync('xdotool', ['windowactivate', '--sync', handle], {
        timeout: 4000,
        maxBuffer: 1024 * 16,
      })
    } catch (error) {
      if (error?.code === 'ENOENT') return { ok: false, reason: 'xdotool-missing' }

      // Some lightweight window managers do not support EWMH activation. Fall back
      // to setting the X11 input focus directly before giving up.
      try {
        await execFileAsync('xdotool', ['windowfocus', handle], {
          timeout: 2500,
          maxBuffer: 1024 * 16,
        })
      } catch {
        return { ok: false, reason: 'focus-failed' }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 140))

    try {
      await execFileAsync('xdotool', ['key', '--clearmodifiers', 'ctrl+v'], {
        timeout: 4000,
        maxBuffer: 1024 * 16,
      })
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        reason: error?.code === 'ENOENT' ? 'xdotool-missing' : 'paste-command-failed',
      }
    }
  }
}

module.exports = {
  AutomationService,
}
