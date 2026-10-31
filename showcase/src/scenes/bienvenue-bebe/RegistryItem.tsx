/** One gift of the list, ticked when reserved. */
export default function RegistryItem({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <li className={checked ? 'done' : ''}>
      <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle}>
        <i>{checked ? '✓' : ''}</i><span>{label}</span>
      </button>
    </li>
  )
}
