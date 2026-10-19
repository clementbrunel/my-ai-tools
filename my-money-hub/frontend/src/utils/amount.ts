/** Parses a user-typed amount, accepting French ("1 234,56") and English ("1234.56") notation. NaN if invalid. */
export function parseAmount(input: string): number {
  const normalized = input.replace(/[\s  ]/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return NaN
  return Number(normalized)
}

export function todayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function apiErrorMessage(e: unknown, fallback: string): string {
  const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || fallback
}
