/** Thin progress bar. Colours/height come from CSS vars (--pbar-h, --pbar-track, --pbar-fill), see styles.css. */
export default function ProgressBar({ value }: { value: number }) {
  return <div className="pbar"><span style={{ width: `${value * 100}%` }} /></div>
}
