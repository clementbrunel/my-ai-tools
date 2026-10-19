import { useState } from 'react'
import type { Account } from '@/types'
import { updateBalance } from '@/api/accounts'
import { apiErrorMessage, parseAmount, todayIso } from '@/utils/amount'

const TYPE_LABELS: Record<Account['type'], string> = {
  CHECKING: 'Compte courant',
  SAVINGS: 'Épargne',
  LIFE_INSURANCE: 'Assurance-vie',
  INVESTMENT: 'Investissement',
  CARD: 'Carte',
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount)
}

interface Props {
  account: Account
  /** Called after a manual balance was saved so the parent can refresh the net worth. */
  onBalanceUpdated?: () => void
}

export default function AccountCard({ account, onBalanceUpdated }: Props) {
  const isManual = account.connectorType === 'MANUAL'
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function startEditing() {
    setAmount(String(account.currentBalance).replace('.', ','))
    setDate(todayIso())
    setFormError(null)
    setEditing(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (Number.isNaN(value)) {
      setFormError('Montant invalide (ex : 1 234,56).')
      return
    }
    setSaving(true)
    try {
      await updateBalance(account.id, value, date === todayIso() ? undefined : date)
      setEditing(false)
      onBalanceUpdated?.()
    } catch (err) {
      setFormError(apiErrorMessage(err, "Impossible d'enregistrer le solde."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{account.institutionName}</span>
        <span className="badge">{TYPE_LABELS[account.type]}</span>
      </div>
      <span className="font-semibold text-gray-900 dark:text-white">{account.label}</span>
      <span className="text-2xl font-bold text-mh-primary dark:text-mh-accent">
        {formatAmount(account.currentBalance, account.currency)}
      </span>
      {account.lastSyncedAt ? (
        <span className="text-xs text-gray-400">
          {isManual ? 'Saisi' : 'Synchronisé'} le {new Date(account.lastSyncedAt).toLocaleString('fr-FR')}
        </span>
      ) : (
        <span className="text-xs text-gray-400">{isManual ? 'Jamais saisi' : 'Jamais synchronisé'}</span>
      )}

      {isManual && !editing && (
        <button className="btn-secondary mt-2" onClick={startEditing}>
          Mettre à jour le solde
        </button>
      )}

      {isManual && editing && (
        <form className="mt-2 flex flex-col gap-2" onSubmit={handleSubmit}>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Nouveau solde ({account.currency})
            <input
              className="input mt-1"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Date du solde
            <input
              className="input mt-1"
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          {formError && <p className="text-mh-danger text-sm">{formError}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
