; Included by electron-builder (nsis.include): the uninstaller removes the « Ouvrir avec cbl-log » entry
; that cbl-log writes in HKCU when the setting is on (app/src/main/shell-integration.ts).
; An update also runs the old uninstaller: the key is kept then (the new version re-writes it anyway).
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegKey HKCU "Software\Classes\*\shell\cbl-log"
  ${endIf}
!macroend
