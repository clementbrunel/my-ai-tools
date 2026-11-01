export type InstitutionType = 'BANK' | 'INSURANCE' | 'INVESTMENT'
export type ConnectorType = 'ENABLE_BANKING' | 'WOOB' | 'MANUAL'
export type AccountType = 'CHECKING' | 'SAVINGS' | 'LIFE_INSURANCE' | 'INVESTMENT' | 'CARD'

export interface Institution {
  id: number
  name: string
  type: InstitutionType
  connectorType: ConnectorType
  externalRef: string | null
  externalCountry: string | null
  sessionValidUntil: string | null
}

export interface CreateInstitutionRequest {
  name: string
  type: InstitutionType
  connectorType: ConnectorType
  externalRef?: string
  externalCountry?: string
}

export interface Account {
  id: number
  institutionName: string
  label: string
  iban: string | null
  currency: string
  type: AccountType
  connectorType: ConnectorType
  currentBalance: number
  lastSyncedAt: string | null
  archived: boolean
}

export type LinxoAction = 'LINK' | 'CREATE_ACTIVE' | 'CREATE_ARCHIVED'

export interface LinxoAccountChoice {
  connection: string
  account: string
  action: LinxoAction
  accountId: number | null
}

export interface LinxoAccountReport {
  connection: string
  account: string
  rows: number
  from: string | null
  to: string | null
  total: number
  action: LinxoAction
  accountId: number | null
  accountLabel: string | null
  imported: number
  skippedDuplicate: number
  skippedOverlap: number
  syncStartsOn: string | null
  balanceSnapshots: number
}

export interface LinxoImportReport {
  dryRun: boolean
  rowsRead: number
  rowsRejected: number
  errors: string[]
  from: string | null
  to: string | null
  imported: number
  skippedDuplicate: number
  skippedOverlap: number
  accounts: LinxoAccountReport[]
}

export interface CreateManualAccountRequest {
  label: string
  type: AccountType
  currency?: string
  initialBalance: number
  /** ISO date (yyyy-MM-dd) the balance was observed; omitted = now. */
  date?: string
}

export interface NetWorth {
  total: number
  accounts: Account[]
}
