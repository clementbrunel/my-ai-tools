import { useEffect, useState, useCallback } from 'react'
import { fetchNetWorth, syncAll } from '@/api/accounts'
import { connectInstitution, fetchInstitutions } from '@/api/institutions'
import type { Institution, NetWorth } from '@/types'
import AccountCard from '@/components/AccountCard'
import ManualAccountForm from '@/components/ManualAccountForm'

export default function Dashboard() {
  const [netWorth, setNetWorth] = useState<NetWorth | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [manualInstitutions, setManualInstitutions] = useState<Institution[]>([])
  // Set by the Enable Banking callback redirect (?connected=… / ?connectError=…)
  const [notice] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const connectError = params.get('connectError')
    if (connected || connectError) window.history.replaceState(null, '', window.location.pathname)
    if (connected) return { ok: true, text: `${connected} connecté — tu peux lancer une synchronisation.` }
    if (connectError) return { ok: false, text: `Connexion refusée : ${connectError}` }
    return null
  })

  const load = useCallback(async () => {
    try {
      setNetWorth(await fetchNetWorth())
      const all = await fetchInstitutions()
      setInstitutions(all.filter((i) => i.connectorType === 'ENABLE_BANKING'))
      setManualInstitutions(all.filter((i) => i.connectorType === 'MANUAL'))
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

  async function handleConnect(institution: Institution) {
    try {
      window.location.href = await connectInstitution(institution.id)
    } catch {
      setError(`Impossible de démarrer la connexion à ${institution.name} — Enable Banking est-il configuré ?`)
    }
  }

  function consentLabel(institution: Institution) {
    if (!institution.sessionValidUntil) return 'Non connecté'
    const until = new Date(institution.sessionValidUntil)
    if (until < new Date()) return 'Consentement expiré'
    return `Connecté jusqu'au ${until.toLocaleDateString('fr-FR')}`
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
      {notice && <p className={notice.ok ? 'text-green-600 mb-4' : 'text-mh-danger mb-4'}>{notice.text}</p>}

      {institutions.length > 0 && (
        <div className="card mb-6">
          <span className="stat-label">Banques Enable Banking</span>
          <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
            {institutions.map((institution) => (
              <li key={institution.id} className="flex items-center justify-between py-2">
                <span>
                  {institution.name}{' '}
                  <span className="text-sm text-gray-500 dark:text-gray-400">— {consentLabel(institution)}</span>
                </span>
                <button className="btn-primary" onClick={() => handleConnect(institution)}>
                  {institution.sessionValidUntil ? 'Reconnecter' : 'Connecter'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {netWorth && (
        <div className="card mb-6 flex flex-col items-center py-8">
          <span className="stat-label">Patrimoine total</span>
          <span className="stat-value">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(netWorth.total)}
          </span>
        </div>
      )}

      {manualInstitutions.length > 0 && <ManualAccountForm institutions={manualInstitutions} onCreated={load} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {netWorth?.accounts.map((account) => (
          <AccountCard key={account.id} account={account} onBalanceUpdated={load} />
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
