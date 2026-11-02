import { useState } from 'react'
import type { AccountType, Institution } from '@/types'
import { createManualAccount } from '@/api/institutions'
import { apiErrorMessage, parseAmount, todayIso } from '@/utils/amount'

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'LIFE_INSURANCE', label: 'Assurance-vie' },
  { value: 'INVESTMENT', label: 'Investissement' },
  { value: 'SAVINGS', label: 'Épargne' },
  { value: 'CHECKING', label: 'Compte courant' },
]

interface Props {
  institutions: Institution[]
  onCreated: () => void
}

export default function ManualAccountForm({ institutions, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [institutionId, setInstitutionId] = useState<number>(institutions[0]?.id ?? 0)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<AccountType>('LIFE_INSURANCE')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const initialBalance = parseAmount(amount)
    if (Number.isNaN(initialBalance)) {
      setError('Montant invalide (ex : 1 234,56).')
      return
    }
    setSaving(true)
    try {
      await createManualAccount(institutionId, {
        label: label.trim(),
        type,
        initialBalance,
        date: date === todayIso() ? undefined : date,
      })
      setOpen(false)
      setLabel('')
      setAmount('')
      setError(null)
      onCreated()
    } catch (err) {
      setError(apiErrorMessage(err, 'Impossible de créer le compte.'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button className="btn-secondary mb-6" onClick={() => setOpen(true)}>
        Ajouter un compte manuel
      </button>
    )
  }

  return (
    <form className="card mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={handleSubmit}>
      <label className="text-sm text-gray-600 dark:text-gray-300">
        Institution
        <select className="input mt-1" value={institutionId} onChange={(e) => setInstitutionId(Number(e.target.value))}>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-gray-600 dark:text-gray-300">
        Nom du compte
        <input className="input mt-1" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={150} required />
      </label>
      <label className="text-sm text-gray-600 dark:text-gray-300">
        Type
        <select className="input mt-1" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-gray-600 dark:text-gray-300">
        Solde initial (EUR)
        <input className="input mt-1" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </label>
      <label className="text-sm text-gray-600 dark:text-gray-300">
        Date du solde
        <input className="input mt-1" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} required />
      </label>
      {error && <p className="text-mh-danger text-sm sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Création…' : 'Créer le compte'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
          Annuler
        </button>
      </div>
    </form>
  )
}
