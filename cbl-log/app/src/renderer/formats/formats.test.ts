// Synthetic lines only: they follow the layout of real WebSphere SystemOut.log files but contain no
// real data.
import {
  BUILTIN_FORMATS,
  SPRING_BOOT,
  WEBSPHERE_BASIC,
  compileFormat,
  detectDateOrder,
  detectFormat,
  parseLine,
  parseLogFormat,
  parseTimestamp,
} from "@cbl-log/shared";
import { describe, expect, it } from "vitest";

const websphere = compileFormat(WEBSPHERE_BASIC);
const builtins = BUILTIN_FORMATS.map(compileFormat);

const out = (level: string, msg = "x") =>
  `[10/14/26 10:02:11:204 UTC] 0000004a SystemOut     O alice|ui.cart|20261014|100211204|${level}|com.example.Cart|add|${msg}`;

describe("parseLine: WebSphere", () => {
  it("splits the header of a SystemOut line", () => {
    const p = parseLine(websphere, out("INFO", "item=3"))!;
    expect(p).toMatchObject({ ts: "10/14/26 10:02:11:204 UTC", thread: "0000004a", logger: "SystemOut" });
    expect(p.msg).toContain("item=3");
  });

  it("takes the level of SystemOut lines from the application layout (java.util.logging names)", () => {
    const level = (name: string) => parseLine(websphere, out(name))?.level;
    expect(level("SEVERE")).toBe("error");
    expect(level("WARNING")).toBe("warn");
    expect(level("INFO")).toBe("info");
    expect(level("CONFIG")).toBe("debug");
    expect(level("FINER")).toBe("trace");
    expect(level("FINEST")).toBe("trace");
    expect(level("ERROR")).toBe("error");
  });

  it("uses the WebSphere type letter when it is informative", () => {
    const line = (t: string) => `[10/14/26 10:02:11:204 UTC] 0000004a SomeComponent  ${t} message`;
    expect(parseLine(websphere, line("W"))?.level).toBe("warn");
    expect(parseLine(websphere, line("E"))?.level).toBe("error");
    expect(parseLine(websphere, line("A"))?.level).toBe("info");
    expect(parseLine(websphere, line("3"))?.level).toBe("trace");
  });

  it("falls back to the IBM message id when the letter says nothing", () => {
    const line = "[10/14/26 10:02:11:204 UTC] 0000004a SystemOut     O CWWKZ0014W: something happened";
    expect(parseLine(websphere, line)?.level).toBe("warn");
  });

  it("leaves the level undefined when nothing tells it", () => {
    expect(parseLine(websphere, "[10/14/26 10:02:11:204 UTC] 0000004a SystemOut     O plain text")?.level).toBeUndefined();
  });

  it("does not treat continuation lines as records", () => {
    expect(parseLine(websphere, "\tat com.example.Cart.add(Cart.java:42)")).toBeUndefined();
    expect(parseLine(websphere, "Caused by: java.lang.IllegalStateException: boom")).toBeUndefined();
    expect(parseLine(websphere, "\t... 12 more")).toBeUndefined();
    expect(parseLine(websphere, "************ Start Display Current Environment ************")).toBeUndefined();
  });

  it("ignores a component name padded to any width", () => {
    const p = parseLine(websphere, "[1/2/26 3:04:05:006 CEST] 00000001 WSChannelFram A   CHFW0019I: The Transport Channel Service has started.");
    expect(p).toMatchObject({ logger: "WSChannelFram", level: "info" });
  });
});

describe("detectFormat", () => {
  const banner = ["************ Start Display Current Environment ************", "WebSphere Platform 9.0.5 running with process id 1", ""];

  it("recognizes WebSphere after a free-text environment banner", () => {
    const sample = [...banner, out("INFO"), "\tat a.b.C.d(C.java:1)", out("SEVERE"), out("INFO")];
    expect(detectFormat(sample, builtins)?.format.id).toBe("websphere-basic");
  });

  it("recognizes Spring Boot", () => {
    const sample = Array.from({ length: 5 }, (_, i) => `2026-10-14 10:02:1${i}.204  INFO 4242 --- [main] c.e.App : started ${i}`);
    expect(detectFormat(sample, builtins)?.format.id).toBe(SPRING_BOOT.id);
  });

  it("stays raw for an unknown format, an empty sample or a single stray match", () => {
    expect(detectFormat(Array.from({ length: 30 }, (_, i) => `just text ${i}`), builtins)).toBeUndefined();
    expect(detectFormat([], builtins)).toBeUndefined();
    expect(detectFormat([out("INFO"), ...Array.from({ length: 50 }, () => "other")], builtins)).toBeUndefined();
  });

  it("only looks at the first 100 lines", () => {
    const sample = [...Array.from({ length: 100 }, () => "noise"), ...Array.from({ length: 10 }, () => out("INFO"))];
    expect(detectFormat(sample, builtins)).toBeUndefined();
  });
});

describe("dates and time zones", () => {
  it("detects day-first from a first field above 12 and month-first from a second field above 12", () => {
    expect(detectDateOrder(["10/11/26 10:00:00:000 UTC", "25/11/26 10:00:00:000 UTC"])).toBe("dmy");
    expect(detectDateOrder(["10/11/26 10:00:00:000 UTC", "10/16/26 10:00:00:000 UTC"])).toBe("mdy");
    expect(detectDateOrder(["10/11/26 10:00:00:000 UTC"])).toBeUndefined();
  });

  it("parses the WebSphere timestamp (M/d/yy, milliseconds after a colon, zone abbreviation)", () => {
    const pattern = WEBSPHERE_BASIC.timestamp!;
    expect(parseTimestamp("10/14/26 10:02:11:204 UTC", pattern)).toBe(Date.UTC(2026, 9, 14, 10, 2, 11, 204));
    expect(parseTimestamp("10/14/26 10:02:11:204 CEST", pattern)).toBe(Date.UTC(2026, 9, 14, 8, 2, 11, 204));
    expect(parseTimestamp("1/2/26 3:04:05:006 EST", pattern)).toBe(Date.UTC(2026, 0, 2, 8, 4, 5, 6));
  });

  it("honours a day-first order", () => {
    const pattern = WEBSPHERE_BASIC.timestamp!;
    expect(parseTimestamp("14/10/26 10:02:11:204 UTC", pattern, { order: "dmy" })).toBe(Date.UTC(2026, 9, 14, 10, 2, 11, 204));
    expect(parseTimestamp("14/10/26 10:02:11:204 UTC", pattern)).toBeUndefined(); // month 14
  });

  it("takes extra zones from the caller and rejects unknown ones", () => {
    const pattern = WEBSPHERE_BASIC.timestamp!;
    expect(parseTimestamp("10/14/26 10:00:00:000 JST", pattern)).toBeUndefined();
    expect(parseTimestamp("10/14/26 10:00:00:000 JST", pattern, { zoneOffsets: { JST: 540 } })).toBe(Date.UTC(2026, 9, 14, 1, 0, 0, 0));
  });

  it("parses ISO-like timestamps and numeric offsets", () => {
    expect(parseTimestamp("2026-10-14 10:02:11.204", SPRING_BOOT.timestamp!)).toBe(Date.UTC(2026, 9, 14, 10, 2, 11, 204));
    expect(parseTimestamp("2026-10-14T10:02:11+02:00", "yyyy-MM-dd'T'HH:mm:ssz")).toBeUndefined(); // quoted literals are not supported
    expect(parseTimestamp("2026-10-14 10:02:11 +0200", "yyyy-MM-dd HH:mm:ss z")).toBe(Date.UTC(2026, 9, 14, 8, 2, 11));
  });
});

describe("parseLogFormat (user formats)", () => {
  const base = { id: "mine", detect: "^\\d", line: "^(?<ts>\\d+) (?<level>[A-Z]) (?<msg>.*)$", levels: { E: "error" } };

  it("accepts a valid format and fills in defaults", () => {
    const parsed = parseLogFormat(JSON.stringify(base));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toMatchObject({ continuation: "not-line", dateOrder: "mdy", levelFallbacks: [] });
  });

  it("works end to end through compile / parse", () => {
    const parsed = parseLogFormat(JSON.stringify(base));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parseLine(compileFormat(parsed.value), "17 E boom")).toMatchObject({ ts: "17", level: "error", msg: "boom" });
  });

  it("rejects bad JSON, a bad schema and a regex that does not compile", () => {
    expect(parseLogFormat("{").ok).toBe(false);
    expect(parseLogFormat(JSON.stringify({ id: "x" })).ok).toBe(false);
    const broken = parseLogFormat(JSON.stringify({ ...base, line: "(" }));
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error).toMatch(/regex/i);
  });
});
