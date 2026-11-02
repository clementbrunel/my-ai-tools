import { commands } from './data'
import './CommandButtons.css'

/** One button per command, all disabled while a command is printing. */
export default function CommandButtons({ label, busy, onRun }: { label: string; busy: boolean; onRun: (i: number) => void }) {
  return (
    <div className="term-btns" role="group" aria-label={label}>
      {commands.map((c, i) => <button key={c.label} type="button" disabled={busy} onClick={() => onRun(i)}>{c.label}</button>)}
    </div>
  )
}
