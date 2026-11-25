// Windows Explorer integration, driven by settings.json (explorerContextMenu) and written in the user's
// own registry hive (HKCU\Software\Classes: no administrator rights): « Ouvrir avec cbl-log » on the
// right-click menu of every file. The key is re-written at every start (the exe path changes with a new
// install folder), removed when the setting is turned off, and by the uninstaller (build/installer.nsh).
import { execFile } from "node:child_process";
import { t } from "@cbl-log/shared";

export const CONTEXT_MENU_KEY = "HKCU\\Software\\Classes\\*\\shell\\cbl-log";

export interface ShellIntegration {
  explorerContextMenu: boolean;
}

/** Arguments of each `reg.exe` call that brings the registry to `wanted` for the executable `exe`. */
export function registryCommands(exe: string, wanted: ShellIntegration): string[][] {
  if (!wanted.explorerContextMenu) return [["delete", CONTEXT_MENU_KEY, "/f"]];
  return [
    ["add", CONTEXT_MENU_KEY, "/ve", "/d", t("Ouvrir avec cbl-log"), "/f"],
    ["add", CONTEXT_MENU_KEY, "/v", "Icon", "/d", `"${exe}",0`, "/f"],
    ["add", `${CONTEXT_MENU_KEY}\\command`, "/ve", "/d", `"${exe}" "%1"`, "/f"],
  ];
}

const run = (args: string[]): Promise<boolean> =>
  new Promise((resolve) => execFile("reg.exe", args, { windowsHide: true }, (err) => resolve(!err)));

/**
 * Applies `wanted`. A missing key on removal is not an error; the first failing write is reported.
 * Only for the installed (or portable) app on Windows: elsewhere it is a no-op.
 */
export async function applyShellIntegration(exe: string | undefined, wanted: ShellIntegration): Promise<string | undefined> {
  if (process.platform !== "win32" || !exe) return undefined;
  for (const args of registryCommands(exe, wanted)) {
    const ok = await run(args);
    if (!ok && args[0] === "add") return t("Écriture du registre impossible ({key})", { key: args[1]! });
  }
  return undefined;
}
