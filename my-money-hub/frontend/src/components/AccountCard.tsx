import { useState } from 'react'
import type { Account } from '@/types'
import { mergeAccount, updateBalance } from '@/api/accounts'
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
  /** All accounts: offers the "Fusionner avec…" action (archived/imported cards only) with the other accounts as targets. */
  allAccounts?: Account[]
}

export default function AccountCard({ account, onBalanceUpdated, allAccounts = [] }: Props) {
  const isManual = account.connectorType === 'MANUAL' && !account.archived
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)
  const [mergeTarget, setMergeTarget] = useState('')
  const mergeCandidates = allAccounts.filter((a) => a.id !== account.id && a.currency === account.currency)
  const canMerge = account.connectorType === 'MANUAL' && mergeCandidates.length > 0

  async function handleMerge(e: React.FormEvent) {
    e.preventDefault()
    const target = mergeCandidates.find((a) => a.id === Number(mergeTarget))
    if (!target) return
    if (!window.confirm(`Fusionner « ${account.label} » dans « ${target.institutionName} — ${target.label} » ? Le compte importé sera supprimé et son historique rattaché.`)) return
    setSaving(true)
    try {
      await mergeAccount(account.id, target.id)
      setMerging(false)
      onBalanceUpdated?.()
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Impossible de fusionner les comptes.'))
    } finally {
      setSaving(false)
    }
  }

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
        <span className="badge">{account.archived ? 'Archivé' : TYPE_LABELS[account.type]}</span>
      </div>
      <span className="font-semibold text-gray-900 dark:text-white">{account.label}</span>
      <span className="text-2xl font-bold text-mh-primary dark:text-mh-accent">
        {formatAmount(account.currentBalance, account.currency)}
      </span>
      {account.archived ? (
        <span className="text-xs text-gray-400">Compte clos — historique uniquement</span>
      ) : account.lastSyncedAt ? (
        <span className="text-xs text-gray-400">
          {isManual ? 'Saisi' : 'Synchronisé'} le {new Date(account.lastSyncedAt).toLocaleString('fr-FR')}
        </span>
      ) : (
        <span className="text-xs text-gray-400">{isManual ? 'Jamais saisi' : 'Jamais synchronisé'}</span>
      )}

      {canMerge && !merging && (
        <button
          className="btn-secondary mt-2"
          onClick={() => {
            setFormError(null)
            setMergeTarget('')
            setMerging(true)
          }}
        >
          Fusionner avec…
        </button>
      )}

      {canMerge && merging && (
        <form className="mt-2 flex flex-col gap-2" onSubmit={handleMerge}>
          <select className="input" value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} required>
            <option value="">Compte à conserver…</option>
            {mergeCandidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.institutionName} — {a.label}
              </option>
            ))}
          </select>
          {formError && <p className="text-mh-danger text-sm">{formError}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={saving || !mergeTarget}>
              {saving ? 'Fusion…' : 'Fusionner'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setMerging(false)} disabled={saving}>
              Annuler
            </button>
          </div>
        </form>
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
