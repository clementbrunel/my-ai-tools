// "Aide > Signaler un bug / proposer une idée": the report is turned into a pre-filled "new issue" page of
// the repository, opened in the default browser. The app itself sends nothing (NF-07): no token is shipped,
// the user reviews the issue and submits it with their own GitHub account. Flood is limited twice: by
// GitHub (an account and a click are needed) and here, by a small history kept in feedback.json.
// Pure: no network, no Electron.
import type { ParseResult } from "@cbl-log/shared";
import { REPO_URL } from "./brand-pages";

export type FeedbackKind = "bug" | "request";

export interface FeedbackDraft {
  kind: FeedbackKind;
  title: string;
  description: string;
  /** Appends the version / OS block (no file path nor log content is ever included). */
  includeEnv: boolean;
}

/** What is known about the running app, shown to the user before it goes in the issue. */
export interface FeedbackEnv {
  version: string;
  install: string;
  os: string;
  electron: string;
}

export interface FeedbackHistory {
  schemaVersion: 1;
  /** Reports opened lately, oldest first. */
  sent: { at: number; kind: FeedbackKind; key: string }[];
}

export const emptyFeedbackHistory = (): FeedbackHistory => ({ schemaVersion: 1, sent: [] });

export const TITLE_MIN = 10;
export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 4000;
/** Anti-flood: delay between two reports, reports per rolling day, and how long a title counts as already sent. */
export const MIN_INTERVAL_MS = 5 * 60_000;
export const MAX_PER_DAY = 3;
export const DUPLICATE_WINDOW_MS = 30 * 24 * 3_600_000;
/** GitHub rejects longer "new issue" URLs; the description is cut to stay under it. */
export const MAX_URL_LENGTH = 8000;

const DAY_MS = 24 * 3_600_000;
const LABELS: Record<FeedbackKind, string> = { bug: "bug", request: "enhancement" };
const TITLE_PREFIX: Record<FeedbackKind, string> = { bug: "[cbl-log] Bug :", request: "[cbl-log] Idée :" };

/** Duplicate detection key: kind + title without case, accents, punctuation nor extra spaces. */
export function feedbackKey(kind: FeedbackKind, title: string): string {
  const words = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${kind}:${words}`;
}

/** First problem of the draft, in French; undefined when it can be sent. */
export function validateDraft(draft: FeedbackDraft): string | undefined {
  const title = draft.title.trim();
  const description = draft.description.trim();
  if (draft.kind !== "bug" && draft.kind !== "request") return "Type de demande inconnu.";
  if (title.length < TITLE_MIN) return `Le titre doit faire au moins ${TITLE_MIN} caractères.`;
  if (title.length > TITLE_MAX) return `Le titre ne doit pas dépasser ${TITLE_MAX} caractères.`;
  if (description.length < DESCRIPTION_MIN) return `La description doit faire au moins ${DESCRIPTION_MIN} caractères.`;
  if (description.length > DESCRIPTION_MAX) return `La description ne doit pas dépasser ${DESCRIPTION_MAX} caractères.`;
  return undefined;
}

export type FloodCheck = { ok: true } | { ok: false; reason: string; retryAt?: number };

const clock = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Whether a new report may be opened now; `key` (see feedbackKey) also rejects a report already sent. */
export function checkFlood(history: FeedbackHistory, now: number, key?: string): FloodCheck {
  const sent = history.sent.filter((s) => s.at <= now);
  const last = sent.at(-1);
  if (last && now - last.at < MIN_INTERVAL_MS) {
    const retryAt = last.at + MIN_INTERVAL_MS;
    return { ok: false, reason: `Un signalement vient d'être ouvert : réessayez après ${clock(retryAt)}.`, retryAt };
  }
  const today = sent.filter((s) => now - s.at < DAY_MS);
  if (today.length >= MAX_PER_DAY) {
    const retryAt = today[0]!.at + DAY_MS;
    return { ok: false, reason: `${MAX_PER_DAY} signalements maximum par 24 h : réessayez après ${clock(retryAt)}.`, retryAt };
  }
  if (key && sent.some((s) => s.key === key && now - s.at < DUPLICATE_WINDOW_MS)) {
    return { ok: false, reason: "Un signalement portant ce titre a déjà été ouvert récemment." };
  }
  return { ok: true };
}

/** History with the new report, entries too old to matter dropped. */
export function withSent(history: FeedbackHistory, now: number, kind: FeedbackKind, key: string): FeedbackHistory {
  const kept = history.sent.filter((s) => now - s.at < DUPLICATE_WINDOW_MS);
  return { schemaVersion: 1, sent: [...kept, { at: now, kind, key }] };
}

export const envLines = (env: FeedbackEnv): string[] => [
  `cbl-log ${env.version} (${env.install})`,
  `OS : ${env.os}`,
  `Electron ${env.electron}`,
];

function issueBody(draft: FeedbackDraft, env: FeedbackEnv, description: string): string {
  const parts = [description];
  if (draft.includeEnv) parts.push(["---", "**Environnement**", ...envLines(env).map((l) => `- ${l}`)].join("\n"));
  parts.push("_Envoyé depuis cbl-log (Aide > Signaler un bug / proposer une idée)._");
  return parts.join("\n\n");
}

/** Pre-filled "new issue" page; the description is shortened when the URL would be too long for GitHub. */
export function buildIssueUrl(draft: FeedbackDraft, env: FeedbackEnv, repoUrl = REPO_URL): string {
  const title = `${TITLE_PREFIX[draft.kind]} ${draft.title.trim()}`;
  const make = (description: string): string => {
    const query = new URLSearchParams({ title, body: issueBody(draft, env, description), labels: `cbl-log,${LABELS[draft.kind]}` });
    return `${repoUrl}/issues/new?${query.toString()}`;
  };
  let description = draft.description.trim();
  let url = make(description);
  while (url.length > MAX_URL_LENGTH && description.length > 0) {
    // encoded characters can take up to 9 URL characters each: cut proportionally, then refine
    const excess = url.length - MAX_URL_LENGTH;
    description = description.slice(0, Math.max(0, description.length - Math.max(16, Math.ceil(excess / 3))));
    url = make(`${description.trimEnd()}\n\n_[…] description tronquée, à compléter sur GitHub._`);
  }
  return url;
}

export function parseFeedbackHistory(text: string): ParseResult<FeedbackHistory> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const r = raw as Partial<FeedbackHistory> | null;
  if (!r || r.schemaVersion !== 1 || !Array.isArray(r.sent)) return { ok: false, error: "format inattendu" };
  const sent = r.sent.filter(
    (s): s is FeedbackHistory["sent"][number] =>
      !!s && typeof s.at === "number" && (s.kind === "bug" || s.kind === "request") && typeof s.key === "string",
  );
  return { ok: true, value: { schemaVersion: 1, sent: sent.sort((a, b) => a.at - b.at) } };
}
