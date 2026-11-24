// Windows Explorer integration, driven by settings.json (section « Windows ») and written in the user's
// own registry hive (HKCU\Software\Classes: no administrator rights):
// - explorerContextMenu: « Ouvrir avec cbl-log » on the right-click menu of every file;
// - fileAssociations: cbl-log registered for .log / .out, so that it is offered in « Ouvrir avec » and
//   can be made the default app (Windows reserves that choice to the user since Windows 10).
// The keys are re-written at every start (the exe path changes with a new install folder) and removed
// when the setting is turned off, and by the uninstaller (build/installer.nsh).
import { execFile } from "node:child_process";

const CLASSES = "HKCU\\Software\\Classes";
export const CONTEXT_MENU_KEY = `${CLASSES}\\*\\shell\\cbl-log`;
export const PROG_ID = "cbl-log.logfile";
export const ASSOCIATED_EXTENSIONS = [".log", ".out"] as const;

export interface ShellIntegration {
  explorerContextMenu: boolean;
  fileAssociations: boolean;
}

/** Arguments of each `reg.exe` call that brings the registry to `wanted` for the executable `exe`. */
export function registryCommands(exe: string, wanted: ShellIntegration): string[][] {
  const open = `"${exe}" "%1"`;
  const icon = `"${exe}",0`;
  const cmds: string[][] = [];
  if (wanted.explorerContextMenu) {
    cmds.push(
      ["add", CONTEXT_MENU_KEY, "/ve", "/d", "Ouvrir avec cbl-log", "/f"],
      ["add", CONTEXT_MENU_KEY, "/v", "Icon", "/d", icon, "/f"],
      ["add", `${CONTEXT_MENU_KEY}\\command`, "/ve", "/d", open, "/f"],
    );
  } else {
    cmds.push(["delete", CONTEXT_MENU_KEY, "/f"]);
  }
  const progId = `${CLASSES}\\${PROG_ID}`;
  if (wanted.fileAssociations) {
    cmds.push(
      ["add", progId, "/ve", "/d", "Fichier journal (cbl-log)", "/f"],
      ["add", `${progId}\\DefaultIcon`, "/ve", "/d", icon, "/f"],
      ["add", `${progId}\\shell\\open\\command`, "/ve", "/d", open, "/f"],
      ...ASSOCIATED_EXTENSIONS.map((ext) => ["add", `${CLASSES}\\${ext}\\OpenWithProgids`, "/v", PROG_ID, "/d", "", "/f"]),
    );
  } else {
    cmds.push(["delete", progId, "/f"], ...ASSOCIATED_EXTENSIONS.map((ext) => ["delete", `${CLASSES}\\${ext}\\OpenWithProgids`, "/v", PROG_ID, "/f"]));
  }
  return cmds;
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
    if (!ok && args[0] === "add") return `Écriture du registre impossible (${args[1]})`;
  }
  return undefined;
}
