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
