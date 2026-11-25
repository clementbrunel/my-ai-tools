import { describe, expect, it } from "vitest";
import { CONTEXT_MENU_KEY, registryCommands } from "./shell-integration";

const exe = "C:\\Users\\me\\AppData\\Local\\Programs\\cbl-log\\cbl-log.exe";

describe("registryCommands", () => {
  it("adds the context menu entry with the exe and its icon", () => {
    expect(registryCommands(exe, { explorerContextMenu: true })).toEqual([
      ["add", CONTEXT_MENU_KEY, "/ve", "/d", "Ouvrir avec cbl-log", "/f"],
      ["add", CONTEXT_MENU_KEY, "/v", "Icon", "/d", `"${exe}",0`, "/f"],
      ["add", `${CONTEXT_MENU_KEY}\\command`, "/ve", "/d", `"${exe}" "%1"`, "/f"],
    ]);
  });

  it("only removes its own key when turned off", () => {
    expect(registryCommands(exe, { explorerContextMenu: false })).toEqual([["delete", CONTEXT_MENU_KEY, "/f"]]);
  });
});
