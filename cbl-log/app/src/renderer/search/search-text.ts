import type { SearchError, SearchQuery } from "@cbl-log/shared";
import { fmtNumber, t } from "@cbl-log/shared";

/** Error message for an invalid regex, undefined when the query can be sent. */
export function validateQuery(query: SearchQuery): string | undefined {
  if (!query.isRegex || query.pattern === "") return undefined;
  try {
    new RegExp(query.pattern);
    return undefined;
  } catch (err) {
    return err instanceof Error ? err.message.replace(/^Invalid regular expression: /, "") : String(err);
  }
}

export interface SearchSummaryInput {
  pattern: string;
  invalid: string | undefined;
  status: { matches: number; done: boolean; error?: SearchError } | undefined;
  /** 1-based rank of the match the view is parked on. */
  ordinal: number | null;
}

const plural = (n: number): string => (n > 1 ? t("{n} résultats", { n: fmtNumber(n) }) : t("{n} résultat", { n: fmtNumber(n) }));

/** Text shown next to the search field. */
export function describeSearch({ pattern, invalid, status, ordinal }: SearchSummaryInput): string {
  if (invalid) return t("Regex invalide : {error}", { error: invalid });
  if (pattern === "") return "";
  if (status?.error === "too-expensive") return t("Regex trop coûteuse : recherche interrompue");
  if (status?.error === "failed") return t("Recherche impossible");
  if (!status) return t("Recherche…");
  if (status.matches === 0) return status.done ? t("Aucun résultat") : t("Recherche…");
  const total = status.done ? plural(status.matches) : `${plural(status.matches)}+`;
  return ordinal !== null ? `${fmtNumber(ordinal)} / ${total}` : total;
}
