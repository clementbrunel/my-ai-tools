export type InstitutionType = 'BANK' | 'INSURANCE' | 'INVESTMENT'
export type ConnectorType = 'ENABLE_BANKING' | 'WOOB' | 'MANUAL'
export type AccountType = 'CHECKING' | 'SAVINGS' | 'LIFE_INSURANCE' | 'INVESTMENT' | 'CARD'

export interface Institution {
  id: number
  name: string
  type: InstitutionType
  connectorType: ConnectorType
  externalRef: string | null
}

export interface CreateInstitutionRequest {
  name: string
  type: InstitutionType
  connectorType: ConnectorType
  externalRef?: string
}

export interface Account {
  id: number
  institutionName: string
  label: string
  iban: string | null
  currency: string
  type: AccountType
  currentBalance: number
  lastSyncedAt: string | null
}

export interface NetWorth {
  total: number
  accounts: Account[]
}
