import apiClient from './axios'
import type { CreateInstitutionRequest, Institution } from '@/types'

export async function fetchInstitutions(): Promise<Institution[]> {
  const { data } = await apiClient.get<Institution[]>('/institutions')
  return data
}

export async function createInstitution(request: CreateInstitutionRequest): Promise<Institution> {
  const { data } = await apiClient.post<Institution>('/institutions', request)
  return data
}
