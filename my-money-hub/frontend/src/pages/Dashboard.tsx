import { useEffect, useState, useCallback } from 'react'
import { fetchNetWorth, syncAll } from '@/api/accounts'
import type { NetWorth } from '@/types'
import AccountCard from '@/components/AccountCard'

export default function Dashboard() {
  const [netWorth, setNetWorth] = useState<NetWorth | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setNetWorth(await fetchNetWorth())
      setError(null)
    } catch {
      setError('Impossible de charger les comptes — le backend est-il démarré ?')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSync() {
    setSyncing(true)
    try {
      await syncAll()
      await load()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title mb-0">My Money Hub</h1>
        <button className="btn-primary" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Synchronisation…' : 'Synchroniser tout'}
        </button>
      </div>

      {error && <p className="text-mh-danger mb-4">{error}</p>}

      {netWorth && (
        <div className="card mb-6 flex flex-col items-center py-8">
          <span className="stat-label">Patrimoine total</span>
          <span className="stat-value">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(netWorth.total)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {netWorth?.accounts.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>

      {netWorth && netWorth.accounts.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-center mt-12">
          Aucun compte pour l'instant — ajoute une institution puis lance une synchronisation.
        </p>
      )}
    </div>
  )
}
