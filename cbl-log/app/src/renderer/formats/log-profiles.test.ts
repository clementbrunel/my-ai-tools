// Log4j2, WebSphere Liberty (messages.log and JSON logging) and JSON lines (C-04, issue #515).
// Log4j2 / JSON lines samples follow the layouts the libraries write. The Liberty samples are
// synthetic, written from the Open Liberty documentation (no real Liberty file was available).
import {
  BUILTIN_FORMATS,
  JSON_LINES,
  LIBERTY_JSON,
  LIBERTY_MESSAGES,
  LOG4J2,
  LOG4J2_LEVEL_FIRST,
  compileFormat,
  detectFormat,
  parseLine,
  parseTimestamp,
} from "@cbl-log/shared";
import { describe, expect, it } from "vitest";
import { computeRowLevels } from "./row-levels";

const builtins = BUILTIN_FORMATS.map(compileFormat);
const detected = (lines: string[]) => detectFormat(lines, builtins)?.format.id;
const at = (ts: string, format: { timestamp?: string }) => parseTimestamp(ts, format.timestamp!);

describe("Log4j2", () => {
  const log4j2 = compileFormat(LOG4J2);
  const line = (level: string) => `2026-10-14 10:02:11.204 [main] ${level.padEnd(5)} com.example.Cart - added 3 items`;

  it("splits the default pattern", () => {
    expect(parseLine(log4j2, line("INFO"))).toEqual({
      ts: "2026-10-14 10:02:11.204",
      level: "info",
      thread: "main",
      logger: "com.example.Cart",
      msg: "added 3 items",
    });
  });

  it("maps every Log4j2 level", () => {
    const level = (name: string) => parseLine(log4j2, line(name))?.level;
    expect([level("FATAL"), level("ERROR"), level("WARN"), level("INFO"), level("DEBUG"), level("TRACE")]).toEqual([
      "fatal", "error", "warn", "info", "debug", "trace",
    ]);
  });

  it("reads %d{ISO8601} (comma, T), thread names with spaces and short logger names", () => {
    const p = parseLine(log4j2, "2026-10-14T10:02:11,204 [http-nio-8080-exec-1] WARN  c.e.Cart - low stock")!;
    expect(p).toMatchObject({ ts: "2026-10-14T10:02:11,204", thread: "http-nio-8080-exec-1", level: "warn", logger: "c.e.Cart" });
    expect(parseLine(log4j2, "2026-10-14 10:02:11.204 [pool-2-thread 1] ERROR a.B - boom")?.thread).toBe("pool-2-thread 1");
  });

  it("parses the level-first variant", () => {
    const first = compileFormat(LOG4J2_LEVEL_FIRST);
    const text = "2026-10-14 10:02:11,204 ERROR [main] com.example.Cart - boom";
    expect(parseLine(first, text)).toMatchObject({ level: "error", thread: "main", logger: "com.example.Cart", msg: "boom" });
    expect(parseLine(log4j2, text)).toBeUndefined();
    expect(parseLine(first, line("INFO"))).toBeUndefined();
  });

  it("is detected, and not mistaken for Spring Boot", () => {
    expect(detected([line("INFO"), line("WARN"), line("ERROR")])).toBe("log4j2");
    const first = [
      "2026-10-14 10:02:11,204 INFO  [main] a.B - one",
      "2026-10-14 10:02:12,204 WARN  [main] a.B - two",
      "2026-10-14 10:02:13,204 ERROR [main] a.B - three",
    ];
    expect(detected(first)).toBe("log4j2-level-first");
  });

  it("folds stack traces into the record above", () => {
    const rows = [
      line("INFO"),
      line("ERROR"),
      "java.lang.IllegalStateException: boom",
      "\tat com.example.Cart.add(Cart.java:42)",
      "Caused by: java.io.IOException",
      "\t... 3 more",
      line("WARN"),
    ];
    expect(computeRowLevels(log4j2, (r) => rows[r], 0, rows.length)).toEqual(["info", "error", "error", "error", "error", "error", "warn"]);
  });

  it("gives a usable clock", () => {
    expect(at("2026-10-14 10:02:11.204", LOG4J2)).toBe(Date.UTC(2026, 9, 14, 10, 2, 11, 204));
    expect(at("2026-10-14T10:02:11,204", LOG4J2)).toBe(Date.UTC(2026, 9, 14, 10, 2, 11, 204));
  });
});

describe("WebSphere Liberty messages.log", () => {
  const liberty = compileFormat(LIBERTY_MESSAGES);
  const ready =
    "[10/14/26 10:02:11:204 CEST] 0000002a com.ibm.ws.kernel.feature.internal.FeatureManager I CWWKF0011I: The server defaultServer is ready to run a smarter planet.";

  it("splits a message line", () => {
    expect(parseLine(liberty, ready)).toMatchObject({
      ts: "10/14/26 10:02:11:204 CEST",
      thread: "0000002a",
      logger: "com.ibm.ws.kernel.feature.internal.FeatureManager",
      level: "info",
    });
  });

  it("maps the type letters, including audit, stderr and trace entry / exit", () => {
    const level = (t: string) => parseLine(liberty, `[10/14/26 10:02:11:204 UTC] 00000001 com.ibm.ws.X ${t} text`)?.level;
    expect([level("A"), level("W"), level("E"), level("R"), level("F"), level(">"), level("<"), level("3")]).toEqual([
      "info", "warn", "error", "error", "fatal", "trace", "trace", "trace",
    ]);
  });

  it("falls back to the message id for System.out lines and skips the trace.log id= column", () => {
    const out = "[10/14/26 10:02:11:204 UTC] 00000001 com.ibm.ws.logging.internal.TraceSpecification O CWWKG0011W: bad value";
    expect(parseLine(liberty, out)?.level).toBe("warn");
    const trace = "[10/14/26 10:02:11:204 UTC] 0000002a id=00000000 com.ibm.ws.X > doStuff Entry";
    expect(parseLine(liberty, trace)).toMatchObject({ logger: "com.ibm.ws.X", level: "trace", msg: "doStuff Entry" });
  });

  it("wins over websphere-basic on Liberty files only", () => {
    expect(detected([ready, ready, ready])).toBe("liberty-messages");
    const was = "[10/14/26 10:02:11:204 UTC] 0000004a SystemOut     O hello";
    expect(detected([was, was, was])).toBe("websphere-basic");
  });

  it("folds stack traces and gives a clock", () => {
    const rows = [ready, "[10/14/26 10:02:12:000 CEST] 0000002a com.ibm.ws.X E CWWKZ0002E: failed", "java.lang.RuntimeException: x", "\tat a.b.C.d(C.java:1)"];
    expect(computeRowLevels(liberty, (r) => rows[r], 0, 4)).toEqual(["info", "error", "error", "error"]);
    expect(at("10/14/26 10:02:11:204 CEST", LIBERTY_MESSAGES)).toBe(Date.UTC(2026, 9, 14, 8, 2, 11, 204));
  });
});

describe("WebSphere Liberty JSON logging", () => {
  const json = compileFormat(LIBERTY_JSON);
  const entry = (loglevel: string, message: string) =>
    `{"type":"liberty_message","host":"srv1","ibm_userDir":"/opt/ol/wlp/usr/","ibm_serverName":"defaultServer","message":"${message}","ibm_threadId":"00000020","ibm_datetime":"2026-10-14T10:02:11.204+0200","ibm_messageId":"CWWKF0011I","module":"com.ibm.ws.kernel.feature.internal.FeatureManager","loglevel":"${loglevel}","ibm_sequence":"1760428931204_0000000000008","ext_thread":"Default Executor-thread-2"}`;

  it("reads the fields whatever their order", () => {
    expect(parseLine(json, entry("INFO", "CWWKF0011I: ready"))).toEqual({
      ts: "2026-10-14T10:02:11.204+0200",
      level: "info",
      thread: "00000020",
      logger: "com.ibm.ws.kernel.feature.internal.FeatureManager",
      msg: "CWWKF0011I: ready",
    });
  });

  it("keeps escaped quotes inside the message and ignores look-alike keys in it", () => {
    const message = 'said \\"loglevel\\":\\"SEVERE\\" ok';
    const p = parseLine(json, entry("WARNING", message))!;
    expect(p.level).toBe("warn");
    expect(p.msg).toBe(message);
  });

  it("maps Liberty levels; System.out falls back to the message id", () => {
    const level = (l: string, m = "plain") => parseLine(json, entry(l, m))?.level;
    expect([level("SEVERE"), level("AUDIT"), level("DETAIL"), level("FINE"), level("ENTRY")]).toEqual(["error", "info", "debug", "debug", "trace"]);
    expect(level("SystemOut", "CWWKZ0014W: x")).toBe("warn");
    expect(level("SystemOut")).toBeUndefined();
  });

  it("is detected and gives a clock", () => {
    expect(detected([entry("INFO", "a"), entry("AUDIT", "b"), entry("INFO", "c")])).toBe("liberty-json");
    expect(at("2026-10-14T10:02:11.204+0200", LIBERTY_JSON)).toBe(Date.UTC(2026, 9, 14, 8, 2, 11, 204));
  });
});

describe("JSON lines", () => {
  const jsonl = compileFormat(JSON_LINES);

  it("reads logstash / logback-json style lines", () => {
    const text =
      '{"@timestamp":"2026-10-14T10:02:11.204Z","level":"ERROR","thread_name":"main","logger_name":"com.example.Cart","message":"boom \\"x\\""}';
    expect(parseLine(jsonl, text)).toEqual({
      ts: "2026-10-14T10:02:11.204Z",
      level: "error",
      thread: "main",
      logger: "com.example.Cart",
      msg: 'boom \\"x\\"',
    });
  });

  it("reads keys in any order, with optional fields missing", () => {
    const p = parseLine(jsonl, '{"msg":"started","severity":"warning","time":"2026-10-14T10:02:11+02:00"}')!;
    expect(p).toMatchObject({ ts: "2026-10-14T10:02:11+02:00", level: "warn", msg: "started" });
    expect(p.thread).toBeUndefined();
    expect(p.logger).toBeUndefined();
  });

  it("maps pino numeric levels and Python level names", () => {
    const level = (v: string) => parseLine(jsonl, `{"level":${v},"time":"2026-10-14T10:02:11.000Z","msg":"x"}`)?.level;
    expect([level("30"), level("50"), level("60"), level('"CRITICAL"')]).toEqual(["info", "error", "fatal", "fatal"]);
  });

  it("does not take a non-JSON line, or an object without level and timestamp, for a record", () => {
    expect(parseLine(jsonl, "\tat com.example.Cart.add(Cart.java:42)")).toBeUndefined();
    expect(parseLine(jsonl, '{"a":1,"b":"2026-10-14T10:02:11Z"}')).toBeUndefined();
  });

  it("is detected", () => {
    const lines = [1, 2, 3].map((i) => `{"@timestamp":"2026-10-14T10:02:1${i}.000Z","level":"INFO","message":"m${i}"}`);
    expect(detected(lines)).toBe("json-lines");
  });

  it("gives a clock, with or without milliseconds", () => {
    expect(at("2026-10-14T10:02:11.204Z", JSON_LINES)).toBe(Date.UTC(2026, 9, 14, 10, 2, 11, 204));
    expect(at("2026-10-14T10:02:11Z", JSON_LINES)).toBe(Date.UTC(2026, 9, 14, 10, 2, 11));
    expect(at("2026-10-14T10:02:11.204+02:00", JSON_LINES)).toBe(Date.UTC(2026, 9, 14, 8, 2, 11, 204));
  });
});
