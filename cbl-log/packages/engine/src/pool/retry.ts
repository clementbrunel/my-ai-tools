// Retry policy shared by the search and filter sessions: a worker that fails (file briefly unreadable,
// e.g. right after the PC wakes from sleep) is retried with exponential backoff before giving up.

/** Number of retries after a failed scan. */
export const MAX_RETRIES = 5;
const RETRY_BASE_MS = 1000;

/** Delay before retry number `attempt` (0-based): 1 s, 2 s, 4 s, ... */
export function retryDelayMs(attempt: number): number {
  return RETRY_BASE_MS * 2 ** attempt;
}
