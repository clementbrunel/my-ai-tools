import { describe, expect, it } from "vitest";
import {
  buildIssueUrl,
  checkFlood,
  DUPLICATE_WINDOW_MS,
  emptyFeedbackHistory,
  feedbackKey,
  MAX_PER_DAY,
  MAX_URL_LENGTH,
  MIN_INTERVAL_MS,
  parseFeedbackHistory,
  validateDraft,
  withSent,
  type FeedbackDraft,
  type FeedbackHistory,
} from "./feedback";

const env = { version: "2.0.0", install: "installée", os: "Windows 10.0.22631 x64", electron: "44.7.2" };
const draft = (change: Partial<FeedbackDraft> = {}): FeedbackDraft => ({
  kind: "bug",
  title: "Le suivi s'arrête après rotation",
  description: "Après la rotation de SystemOut.log, plus aucune ligne n'arrive.",
  includeEnv: true,
  ...change,
});
const params = (url: string): URLSearchParams => new URL(url).searchParams;
const T0 = Date.UTC(2026, 9, 20, 12, 0);
const historyAt = (...ats: number[]): FeedbackHistory => ({ schemaVersion: 1, sent: ats.map((at, i) => ({ at, kind: "bug", key: `bug:k${i}` })) });

describe("feedback draft", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(draft())).toBeUndefined();
  });

  it("rejects a short title or description (spaces do not count)", () => {
    expect(validateDraft(draft({ title: "   bug    " }))).toMatch(/titre/);
    expect(validateDraft(draft({ description: "ça marche pas" }))).toMatch(/description/);
  });
});

describe("issue URL", () => {
  it("points to the repository's new issue page with title, labels and body", () => {
    const url = buildIssueUrl(draft(), env, "https://github.com/o/r");
    expect(url.startsWith("https://github.com/o/r/issues/new?")).toBe(true);
    const p = params(url);
    expect(p.get("title")).toBe("[cbl-log] Bug : Le suivi s'arrête après rotation");
    expect(p.get("labels")).toBe("cbl-log,bug");
    expect(p.get("body")).toContain("plus aucune ligne n'arrive");
    expect(p.get("body")).toContain("- cbl-log 2.0.0 (installée)");
  });

  it("labels a request as an enhancement and can leave the environment out", () => {
    const p = params(buildIssueUrl(draft({ kind: "request", includeEnv: false }), env));
    expect(p.get("title")).toMatch(/^\[cbl-log\] Idée : /);
    expect(p.get("labels")).toBe("cbl-log,enhancement");
    expect(p.get("body")).not.toContain("Windows");
  });

  it("shortens a long description to fit GitHub's URL limit", () => {
    const url = buildIssueUrl(draft({ description: "é€ ".repeat(1300) }), env);
    expect(url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    expect(params(url).get("body")).toContain("description tronquée");
  });
});

describe("anti-flood", () => {
  it("lets the first report through", () => {
    expect(checkFlood(emptyFeedbackHistory(), T0, "bug:x").ok).toBe(true);
  });

  it("enforces a delay between two reports", () => {
    const check = checkFlood(historyAt(T0), T0 + MIN_INTERVAL_MS - 1);
    expect(check).toMatchObject({ ok: false, retryAt: T0 + MIN_INTERVAL_MS });
    expect(checkFlood(historyAt(T0), T0 + MIN_INTERVAL_MS).ok).toBe(true);
  });

  it(`allows ${MAX_PER_DAY} reports per rolling day`, () => {
    const hour = 3_600_000;
    const full = historyAt(T0, T0 + hour, T0 + 2 * hour);
    expect(checkFlood(full, T0 + 3 * hour)).toMatchObject({ ok: false, retryAt: T0 + 24 * hour });
    expect(checkFlood(full, T0 + 24 * hour).ok).toBe(true);
  });

  it("rejects the same title again, whatever its case or accents", () => {
    const key = feedbackKey("bug", "Le suivi s'arrête !");
    expect(feedbackKey("bug", "le SUIVI s arrete")).toBe(key);
    expect(feedbackKey("request", "le suivi s arrete")).not.toBe(key);
    const history = withSent(emptyFeedbackHistory(), T0, "bug", key);
    expect(checkFlood(history, T0 + 2 * 24 * 3_600_000, key).ok).toBe(false);
    expect(checkFlood(history, T0 + DUPLICATE_WINDOW_MS, key).ok).toBe(true);
  });

  it("forgets entries older than the duplicate window", () => {
    const history = withSent(historyAt(T0), T0 + DUPLICATE_WINDOW_MS, "request", "request:y");
    expect(history.sent).toEqual([{ at: T0 + DUPLICATE_WINDOW_MS, kind: "request", key: "request:y" }]);
  });
});

describe("feedback.json", () => {
  it("round-trips and drops malformed entries", () => {
    const parsed = parseFeedbackHistory(JSON.stringify({ schemaVersion: 1, sent: [{ at: 2, kind: "bug", key: "b" }, { at: "x" }, { at: 1, kind: "request", key: "a" }] }));
    expect(parsed).toEqual({ ok: true, value: { schemaVersion: 1, sent: [{ at: 1, kind: "request", key: "a" }, { at: 2, kind: "bug", key: "b" }] } });
  });

  it("rejects an unusable file", () => {
    expect(parseFeedbackHistory("{ nope").ok).toBe(false);
    expect(parseFeedbackHistory('{"schemaVersion":2,"sent":[]}').ok).toBe(false);
  });
});
