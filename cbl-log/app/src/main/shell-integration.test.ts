import { describe, expect, it } from "vitest";
import { CONTEXT_MENU_KEY, registryCommands } from "./shell-integration";

const exe = "C:\\Users\\me\\AppData\\Local\\Programs\\cbl-log\\cbl-log.exe";

describe("registryCommands", () => {
  it("adds the context menu entry with the exe and its icon", () => {
    const cmds = registryCommands(exe, { explorerContextMenu: true, fileAssociations: false });
    expect(cmds.slice(0, 3)).toEqual([
      ["add", CONTEXT_MENU_KEY, "/ve", "/d", "Ouvrir avec cbl-log", "/f"],
      ["add", CONTEXT_MENU_KEY, "/v", "Icon", "/d", `"${exe}",0`, "/f"],
      ["add", `${CONTEXT_MENU_KEY}\\command`, "/ve", "/d", `"${exe}" "%1"`, "/f"],
    ]);
    // associations off: only removals, never a write
    expect(cmds.slice(3).every((c) => c[0] === "delete")).toBe(true);
  });

  it("registers the ProgID and offers it for .log and .out", () => {
    const cmds = registryCommands(exe, { explorerContextMenu: false, fileAssociations: true });
    expect(cmds[0]).toEqual(["delete", CONTEXT_MENU_KEY, "/f"]);
    expect(cmds).toContainEqual(["add", "HKCU\\Software\\Classes\\cbl-log.logfile\\shell\\open\\command", "/ve", "/d", `"${exe}" "%1"`, "/f"]);
    expect(cmds).toContainEqual(["add", "HKCU\\Software\\Classes\\.log\\OpenWithProgids", "/v", "cbl-log.logfile", "/d", "", "/f"]);
    expect(cmds).toContainEqual(["add", "HKCU\\Software\\Classes\\.out\\OpenWithProgids", "/v", "cbl-log.logfile", "/d", "", "/f"]);
  });

  it("only removes its own value from the extensions when turned off", () => {
    const cmds = registryCommands(exe, { explorerContextMenu: false, fileAssociations: false });
    expect(cmds).toContainEqual(["delete", "HKCU\\Software\\Classes\\.log\\OpenWithProgids", "/v", "cbl-log.logfile", "/f"]);
    expect(cmds).not.toContainEqual(expect.arrayContaining(["HKCU\\Software\\Classes\\.log"]));
  });
});
