import axios from 'axios'
import type { AnalysisSessionResponse, DocumentVersion, GitLabProjectSummary } from '../types'

const client = axios.create({ baseURL: '/api' })

export async function createAnalysis(params: {
  title?: string
  word?: File
  jxmlArchive?: File
  jxmlText?: string
  gitlabProjectId?: string
}): Promise<AnalysisSessionResponse> {
  const form = new FormData()
  if (params.title) form.append('title', params.title)
  if (params.word) form.append('word', params.word)
  if (params.jxmlArchive) form.append('jxmlArchive', params.jxmlArchive)
  if (params.jxmlText) form.append('jxmlText', params.jxmlText)
  if (params.gitlabProjectId) form.append('gitlabProjectId', params.gitlabProjectId)

  const { data } = await client.post<AnalysisSessionResponse>('/analysis', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listGitlabProjects(): Promise<GitLabProjectSummary[]> {
  const { data } = await client.get<GitLabProjectSummary[]>('/gitlab/projects')
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
