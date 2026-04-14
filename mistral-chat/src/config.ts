/**
 * Runtime configuration — values come from environment variables loaded via
 * `--env-file .env` (Node 20.6+). Fallbacks ensure the tool still works when
 * the file is absent (e.g. CI or global install).
 */

export const CHAT_URL: string =
  (process.env['CHAT_MISTRAL_URL'] ?? '').replace(/\/$/, '') || '';

export const AUTH_URL: string =
  (process.env['AUTH_MISTRAL_URL'] ?? '').replace(/\/$/, '') || '';

/** Hostname extracted from CHAT_URL, used for cookie domain matching. */
export const CHAT_HOST: string = CHAT_URL ? new URL(CHAT_URL).hostname : '';

/** Second-level domain pattern for SQLite LIKE queries (e.g. "%example.com%"). */
export const COOKIE_DOMAIN_PATTERN: string = (() => {
  if (!CHAT_HOST) return '%.%';
  const parts = CHAT_HOST.split('.');
  // Keep last 3 segments: chat.example.com → example.com
  return '%' + parts.slice(-3).join('.') + '%';
})();
