// View logic of the cbl-log demo: what is rendered from the streams and the user's choices. No React here.
import { TAB_IDS, type Entry, type Level, type TabId } from './data'

/** One displayed line: a record, or one line of its stack trace. */
export type Line = { kind: 'entry'; e: Entry } | { kind: 'stack'; e: Entry; i: number }
export interface Include { pattern: string; regex: boolean }
export interface View { levels: Set<Level>; includes: Include[]; fold: boolean; open: Set<number>; frozenAt: number | null }

/** One value per tab, built the same way for all of them. */
export const perTab = <T,>(f: (id: TabId) => T) => Object.fromEntries(TAB_IDS.map((id) => [id, f(id)])) as Record<TabId, T>
/** Copy of `s` with `v` added or removed. */
export const toggled = <T,>(s: Set<T>, v: T) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n }
export const lvlClass = (l: Level) => `lvl-${l.toLowerCase()}`

export const matcher = (inc: Include): ((s: string) => boolean) => {
  if (!inc.regex) { const p = inc.pattern.toLowerCase(); return (s) => s.toLowerCase().includes(p) }
  try { const re = new RegExp(inc.pattern, 'i'); return (s) => re.test(s) } catch { return () => false }
}
export const validRegex = (s: string) => { try { new RegExp(s); return true } catch { return false } }

/** Lines to render: records of the shown levels matching an included text, each followed by its trace unless folded. Stops at the Pause point. */
export function visibleLines(entries: Entry[], v: View, tests: ((s: string) => boolean)[]) {
  const lines: Line[] = []
  let matched = 0
  for (const e of entries) {
    if (v.frozenAt !== null && e.id > v.frozenAt) break
    if (!v.levels.has(e.level) || (tests.length && !tests.some((f) => f(e.msg)))) continue
    matched++
    lines.push({ kind: 'entry', e })
    if (e.stack && (!v.fold || v.open.has(e.id))) e.stack.forEach((_, i) => lines.push({ kind: 'stack', e, i }))
  }
  return { lines, matched }
}
