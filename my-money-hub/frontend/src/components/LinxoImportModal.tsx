import { useEffect, useState } from 'react'
import axios from 'axios'
import { fetchAccounts } from '@/api/accounts'
import { importLinxo } from '@/api/import'
import type { Account, LinxoAccountChoice, LinxoAccountReport, LinxoImportReport } from '@/types'

// Select value: CREATE_ARCHIVED | CREATE_ACTIVE | LINK:<accountId>
function toValue(report: LinxoAccountReport) {
  return report.action === 'LINK' && report.accountId ? `LINK:${report.accountId}` : report.action
}

function toChoice(report: LinxoAccountReport, value: string): LinxoAccountChoice {
  if (value.startsWith('LINK:')) {
    return { connection: report.connection, account: report.account, action: 'LINK', accountId: Number(value.slice(5)) }
  }
  return {
    connection: report.connection,
    account: report.account,
    action: value as LinxoAccountChoice['action'],
    accountId: null,
  }
}

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')

export default function LinxoImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<LinxoImportReport | null>(null)
  const [result, setResult] = useState<LinxoImportReport | null>(null)
  const [selection, setSelection] = useState<Record<string, string>>({})
  const [accounts, setAccounts] = useState<Account[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]))
  }, [])

  const keyOf = (r: LinxoAccountReport) => `${r.connection}\u0000${r.account}`

  function describeError(e: unknown) {
    if (axios.isAxiosError(e)) return e.response?.data?.message ?? e.response?.data?.error ?? e.message
    return 'Erreur inattendue'
  }

  async function handlePreview() {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const report = await importLinxo(file, true)
      setPreview(report)
      setSelection(Object.fromEntries(report.accounts.map((a) => [keyOf(a), toValue(a)])))
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (!file || !preview) return
    setBusy(true)
    setError(null)
    try {
      const choices = preview.accounts.map((a) => toChoice(a, selection[keyOf(a)]))
      setResult(await importLinxo(file, false, choices))
      onImported()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const report = result ?? preview

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Importer un export Linxo</h2>
          <button className="text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {!result && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setPreview(null)
              }}
            />
            <button className="btn-primary" onClick={handlePreview} disabled={!file || busy}>
              {busy && !preview ? 'Analyse…' : 'Analyser'}
            </button>
          </div>
        )}

        {error && <p className="text-mh-danger mb-4">{error}</p>}

        {report && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {report.rowsRead} lignes lues du {formatDate(report.from)} au {formatDate(report.to)}
              {report.rowsRejected > 0 && ` — ${report.rowsRejected} rejetée(s)`}.{' '}
              {result ? 'Importées' : 'À importer'} : <strong>{report.imported}</strong>, déjà présentes :{' '}
              {report.skippedDuplicate}, couvertes par la synchro : {report.skippedOverlap}.
            </p>
            {report.errors.length > 0 && (
              <ul className="text-xs text-mh-danger mb-3 list-disc pl-5">
                {report.errors.slice(0, 5).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="py-2 pr-3">Connexion / compte</th>
                    <th className="pr-3">Lignes</th>
                    <th className="pr-3">Période</th>
                    <th className="pr-3">Solde des opérations</th>
                    <th>{result ? 'Compte' : 'Destination'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {report.accounts.map((a) => (
                    <tr key={keyOf(a)} className="text-gray-900 dark:text-gray-100">
                      <td className="py-2 pr-3">
                        {a.connection || '—'} / <strong>{a.account}</strong>
                      </td>
                      <td className="pr-3">{result ? a.imported : a.rows}</td>
                      <td className="pr-3">
                        {formatDate(a.from)} → {formatDate(a.to)}
                      </td>
                      <td className="pr-3">{formatAmount(a.total)}</td>
                      <td>
                        {result ? (
                          a.accountLabel
                        ) : (
                          <select
                            className="border rounded px-2 py-1 bg-white dark:bg-mh-dark text-gray-900 dark:text-gray-100"
                            value={selection[keyOf(a)]}
                            onChange={(e) => setSelection({ ...selection, [keyOf(a)]: e.target.value })}
                          >
                            <option value="CREATE_ARCHIVED">Créer — archivé (historique seul)</option>
                            <option value="CREATE_ACTIVE">Créer — actif</option>
                            {accounts.map((existing) => (
                              <option key={existing.id} value={`LINK:${existing.id}`}>
                                Rattacher à {existing.institutionName} — {existing.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!result && (
              <div className="flex justify-end mt-4">
                <button className="btn-primary" onClick={handleConfirm} disabled={busy || preview?.imported === 0}>
                  {busy ? 'Import en cours…' : `Importer ${preview?.imported ?? 0} opérations`}
                </button>
              </div>
            )}
            {result && (
              <div className="flex justify-end mt-4">
                <button className="btn-primary" onClick={onClose}>
                  Fermer
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
