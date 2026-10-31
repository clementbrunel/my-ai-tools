// Terminal script and texts of the ai-env-manager demo (Terminal.tsx).
import type { Lang } from '../../apps'

/** [css class, text]: `cmd` is the prompt line, `ok` / `warn` colour the output. */
export type Line = [string, string]

/** What the terminal shows on load: the bare `ai-env-manager` scan. */
export const scan: Line[] = [
  ['cmd', '$ ai-env-manager'],
  ['ok', '✔ 4 MCP servers healthy'],
  ['ok', '✔ CLAUDE.md · 2 skills · 3 hooks'],
  ['warn', '⚠ hook pre-commit: exit 1'],
  ['warn', '↑ 2 tools outdated'],
]

export interface Command { label: string; out: Line[]; again?: Line[] }

/** Commands the visitor can run after it (the real CLI also has `verify` and `migrate`); `again` is the output of a second run. */
export const commands: Command[] = [
  {
    label: 'update',
    out: [
      ['cmd', '$ ai-env-manager update'],
      ['ok', '✔ upgraded headroom, caveman'],
    ],
    again: [
      ['cmd', '$ ai-env-manager update'],
      ['ok', '✅ All tools are up to date.'],
    ],
  },
  {
    label: 'prepare',
    out: [
      ['cmd', '$ ai-env-manager prepare'],
      ['ok', '✓ token · headroom déjà installé'],
      ['warn', '○ memory · aucun outil détecté'],
      ['ok', '→ suggestion : mempalace'],
      ['ok', '  ai-env-manager prepare --with mempalace'],
    ],
  },
]

/** Lines kept on screen (older ones scroll out). */
export const MAX_LINES = 9
/** Delay between two output lines of a command. */
export const STEP_MS = 320

export const txt: Record<Lang, { run: string }> = {
  fr: { run: 'Lancer une commande' },
  en: { run: 'Run a command' },
}
