; Custom NSIS hooks for Dodoi.
; Keep in sync with the login-item names written by electron/lib/startup.cjs.

!include "MUI2.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
Var DesktopShortcutCheckbox
Var StartMenuShortcutCheckbox
Var DesktopShortcutState
Var StartMenuShortcutState

; Default both shortcut choices to on, including silent installs where the
; options page is skipped.
!macro customInit
  StrCpy $DesktopShortcutState ${BST_CHECKED}
  StrCpy $StartMenuShortcutState ${BST_CHECKED}
!macroend

!macro customPageAfterChangeDir
  Page custom ShortcutOptionsPageCreate ShortcutOptionsPageLeave
!macroend

Function ShortcutOptionsPageCreate
  !insertmacro MUI_HEADER_TEXT "Choose shortcuts" "Select the shortcuts Dodoi should create."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateCheckbox} 0 0 100% 12u "Create a &desktop shortcut"
  Pop $DesktopShortcutCheckbox
  ${If} $DesktopShortcutState == ${BST_CHECKED}
    ${NSD_Check} $DesktopShortcutCheckbox
  ${EndIf}

  ${NSD_CreateCheckbox} 0 16u 100% 12u "Create a &Start Menu shortcut"
  Pop $StartMenuShortcutCheckbox
  ${If} $StartMenuShortcutState == ${BST_CHECKED}
    ${NSD_Check} $StartMenuShortcutCheckbox
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function ShortcutOptionsPageLeave
  ${NSD_GetState} $DesktopShortcutCheckbox $DesktopShortcutState
  ${NSD_GetState} $StartMenuShortcutCheckbox $StartMenuShortcutState
FunctionEnd

; electron-builder creates both shortcuts before customInstall runs. Remove
; any the user opted out of, and point the finish-page launch at the exe when
; the Start Menu link is gone.
!macro customInstall
  ${If} $DesktopShortcutState != ${BST_CHECKED}
    WinShell::UninstShortcut "$newDesktopLink"
    Delete "$newDesktopLink"
  ${EndIf}
  ${If} $StartMenuShortcutState != ${BST_CHECKED}
    WinShell::UninstShortcut "$newStartMenuLink"
    Delete "$newStartMenuLink"
    StrCpy $launchLink "$appExe"
  ${EndIf}
!macroend
!endif

!macro customUnInstall
  ; Remove the per-user login item created by Settings > Launch on startup.
  ; Electron uses the app name for the Run value; older builds used the
  ; lowercase package name, so clean up every variant Dodoi may have written.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_ID}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Dodoi"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "dodoi"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${APP_ID}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Dodoi"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "dodoi"
!macroend
