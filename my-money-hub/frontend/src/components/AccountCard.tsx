import type { Account } from '@/types'

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

export default function AccountCard({ account }: { account: Account }) {
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
          Synchronisé le {new Date(account.lastSyncedAt).toLocaleString('fr-FR')}
        </span>
      ) : (
        <span className="text-xs text-gray-400">Jamais synchronisé</span>
      )}
    </div>
  )
}
