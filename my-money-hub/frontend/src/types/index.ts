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
