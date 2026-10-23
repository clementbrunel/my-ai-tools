import { describe, expect, it } from "vitest";
import { marksByRow, rollMarkLabel, type RollMark } from "./roll-mark";

const at = new Date(2026, 9, 14, 10, 2, 11).getTime(); // local time, so the test is timezone-proof

describe("rollMarkLabel", () => {
  it("shows the archive name for a rename", () => {
    const mark: RollMark = { row: 10, reason: "rename", previous: "C:\\logs\\app.2026-10-14.0.log", at };
    expect(rollMarkLabel(mark)).toBe("rolling 10:02:11 → app.2026-10-14.0.log");
  });

  it("says truncated, with the archive when recovered", () => {
    expect(rollMarkLabel({ row: 1, reason: "truncate", at })).toBe("tronqué 10:02:11");
    expect(rollMarkLabel({ row: 1, reason: "truncate", previous: "/var/log/app.log.1", at })).toBe("tronqué 10:02:11 → app.log.1");
  });

  it("works without an archive for a new file", () => {
    expect(rollMarkLabel({ row: 1, reason: "new-file", at })).toBe("rolling 10:02:11");
  });
});

describe("marksByRow", () => {
  it("indexes marks by row, the latest one winning", () => {
    const map = marksByRow([
      { row: 5, reason: "rename", at: 1 },
      { row: 9, reason: "truncate", at: 2 },
      { row: 5, reason: "new-file", at: 3 },
    ]);
    expect(map.size).toBe(2);
    expect(map.get(5)?.reason).toBe("new-file");
  });
});
