import axios from 'axios'
import type { AnalysisSessionResponse, DocumentVersion } from '../types'

const client = axios.create({ baseURL: '/api' })

export async function createAnalysis(params: {
  title?: string
  word: File
  jxmlArchive?: File
  jxmlText?: string
}): Promise<AnalysisSessionResponse> {
  const form = new FormData()
  if (params.title) form.append('title', params.title)
  form.append('word', params.word)
  if (params.jxmlArchive) form.append('jxmlArchive', params.jxmlArchive)
  if (params.jxmlText) form.append('jxmlText', params.jxmlText)

  const { data } = await client.post<AnalysisSessionResponse>('/analysis', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function getAnalysis(sessionId: string): Promise<AnalysisSessionResponse> {
  const { data } = await client.get<AnalysisSessionResponse>(`/analysis/${sessionId}`)
  return data
}

export async function listVersions(sessionId: string): Promise<DocumentVersion[]> {
  const { data } = await client.get<DocumentVersion[]>(`/analysis/${sessionId}/versions`)
  return data
}

export async function saveVersion(sessionId: string, content: string): Promise<DocumentVersion> {
  const { data } = await client.post<DocumentVersion>(`/analysis/${sessionId}/versions`, { content })
  return data
}

export async function restoreVersion(sessionId: string, versionId: string): Promise<DocumentVersion> {
  const { data } = await client.post<DocumentVersion>(`/analysis/${sessionId}/versions/${versionId}/restore`)
  return data
}
