import { MAX_LINES, type Line } from './data'

/** Last MAX_LINES lines of the terminal, blinking cursor after the newest one. */
export default function TermOutput({ history }: { history: Line[] }) {
  const first = Math.max(0, history.length - MAX_LINES)
  return (
    <pre>
      {history.slice(first).map(([k, l], i) => (
        <div key={first + i} className={k}>
          {l}{first + i === history.length - 1 && <span className="cursor"> ▋</span>}
        </div>
      ))}
    </pre>
  )
}
