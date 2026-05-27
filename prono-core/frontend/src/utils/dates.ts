/**
 * Date formatting utilities — all dates are displayed as DD/MM/YYYY.
 *
 * Parsing is done by extracting the date components directly from the ISO
 * string (YYYY-MM-DD…) to avoid timezone-related day shifts.
 */

/**
 * Format any ISO date or datetime string as DD/MM/YYYY.
 * Works with both LocalDate ("2026-06-11") and LocalDateTime ("2026-06-11T21:00:00").
 */
export function formatDate(dateInput: Date | string): string {
  const s = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  // Fallback for non-standard formats
  const d = new Date(s);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Format an ISO datetime string as DD/MM/YYYY HH:mm.
 */
export function formatDateTime(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${formatDate(d)} ${time}`;
}
