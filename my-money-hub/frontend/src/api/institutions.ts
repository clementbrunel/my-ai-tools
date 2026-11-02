import apiClient from './axios'
import type { Account, CreateInstitutionRequest, CreateManualAccountRequest, Institution } from '@/types'

export async function fetchInstitutions(): Promise<Institution[]> {
  const { data } = await apiClient.get<Institution[]>('/institutions')
  return data
}

export async function createInstitution(request: CreateInstitutionRequest): Promise<Institution> {
  const { data } = await apiClient.post<Institution>('/institutions', request)
  return data
}

export async function createManualAccount(institutionId: number, request: CreateManualAccountRequest): Promise<Account> {
  const { data } = await apiClient.post<Account>(`/institutions/${institutionId}/accounts`, request)
  return data
}

/** Returns the bank's consent page URL for an Enable Banking institution. */
export async function connectInstitution(id: number): Promise<string> {
  const { data } = await apiClient.post<{ url: string }>(`/institutions/${id}/connect`)
  return data.url
}
