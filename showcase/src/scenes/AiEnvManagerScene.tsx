import SceneFrame, { type SceneProps } from '../components/SceneFrame'

const lines: [string, string][] = [
  ['cmd', '$ ai-env-manager'],
  ['ok', '✔ 4 MCP servers healthy'],
  ['ok', '✔ CLAUDE.md · 2 skills · 3 hooks'],
  ['warn', '⚠ hook pre-commit: exit 1'],
  ['warn', '↑ 2 tools outdated'],
  ['cmd', '$ ai-env-manager update'],
  ['ok', '✔ upgraded headroom, caveman'],
  ['cmd', '$ ai-env-manager verify'],
  ['ok', '✔ all requested tools work'],
]

/** Terminal that prints its lines as the scene scrolls. */
function Terminal({ p }: { p: number }) {
  const shown = Math.min(lines.length, Math.max(2, Math.ceil((p - 0.1) / 0.5 * lines.length)))
  return (
    <div className="stage">
      <div className="term">
        <div className="dots"><i /><i /><i /><span>~/my-project</span></div>
        <pre>{lines.slice(0, shown).map(([k, l], i) => <div key={i} className={k}>{l}</div>)}<span className="cursor">▋</span></pre>
      </div>
    </div>
  )
}

export default function AiEnvManagerScene(props: SceneProps) {
  return <SceneFrame {...props} art={(p) => <Terminal p={p} />} />
}
