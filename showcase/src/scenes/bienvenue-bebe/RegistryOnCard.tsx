import { useState } from 'react'
import type { Lang } from '../../apps'
import ProgressBar from '../../components/ProgressBar'
import { BABY, registryItems, txt } from './data'
import RegistryItem from './RegistryItem'

/** Birth-registry list printed on the blank paper card of the poster (box in % of the image, lightly rotated). Items can be ticked. */
export default function RegistryOnCard({ lang }: { lang: Lang }) {
  const items = registryItems[lang]
  const t = txt[lang]
  const [checked, setChecked] = useState(() => items.map(([, done]) => done))
  const reserved = checked.filter(Boolean).length
  const toggle = (i: number) => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))
  return (
    <div className="reg">
      <div className="reg-in">
        <p className="reg-h">{t.title}<b>{BABY}</b></p>
        <ul>
          {items.map(([label], i) => <RegistryItem key={i} label={label} checked={checked[i]} onToggle={() => toggle(i)} />)}
        </ul>
        <ProgressBar value={reserved / items.length} />
        <p className="reg-f">{reserved} / {items.length} {t.reserved}</p>
      </div>
    </div>
  )
}
