import { describe, expect, it } from "vitest";
import type { TabId } from "@cbl-log/shared";
import { tabsToClose } from "./tab-close";

const ids = ["a", "b", "c", "d"] as unknown as TabId[];
const [a, b, c, d] = ids as [TabId, TabId, TabId, TabId];

describe("tabsToClose", () => {
  it("closes the others, the ones on the right, or all", () => {
    expect(tabsToClose(ids, b, "others")).toEqual([a, c, d]);
    expect(tabsToClose(ids, b, "right")).toEqual([c, d]);
    expect(tabsToClose(ids, d, "right")).toEqual([]);
    expect(tabsToClose(ids, c, "all")).toEqual(ids);
  });

  it("closes nothing for an unknown tab", () => {
    expect(tabsToClose(ids, "z" as unknown as TabId, "all")).toEqual([]);
  });
});
