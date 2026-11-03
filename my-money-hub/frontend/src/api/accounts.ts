import apiClient from './axios'
import type { Account, NetWorth } from '@/types'

export async function fetchAccounts(): Promise<Account[]> {
  const { data } = await apiClient.get<Account[]>('/accounts')
  return data
}

export async function fetchNetWorth(): Promise<NetWorth> {
  const { data } = await apiClient.get<NetWorth>('/accounts/net-worth')
  return data
}

export async function syncAll(): Promise<void> {
  await apiClient.post('/sync')
}

/** Manual balance entry (MANUAL accounts only). `date` is an ISO yyyy-MM-dd, omitted = now. */
export async function updateBalance(id: number, balance: number, date?: string): Promise<Account> {
  const { data } = await apiClient.put<Account>(`/accounts/${id}/balance`, { balance, date })
  return data
}

/** Merges `id` with `targetId` (imported ↔ synced); returns the surviving account. */
export async function mergeAccount(id: number, targetId: number): Promise<Account> {
  const { data } = await apiClient.post<Account>(`/accounts/${id}/merge`, { targetId })
  return data
}
