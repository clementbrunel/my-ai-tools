; Included by electron-builder (nsis.include): the uninstaller removes the Explorer integration that
; cbl-log writes in HKCU when « Ouvrir avec cbl-log » / the .log & .out associations are enabled
; (app/src/main/shell-integration.ts). Values of other apps under the extensions are left untouched.
; An update also runs the old uninstaller: the keys are kept then (the new version re-writes them anyway).
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegKey HKCU "Software\Classes\*\shell\cbl-log"
    DeleteRegKey HKCU "Software\Classes\cbl-log.logfile"
    DeleteRegValue HKCU "Software\Classes\.log\OpenWithProgids" "cbl-log.logfile"
    DeleteRegValue HKCU "Software\Classes\.out\OpenWithProgids" "cbl-log.logfile"
  ${endIf}
!macroend
