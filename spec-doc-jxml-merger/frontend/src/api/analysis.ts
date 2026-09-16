import { client } from './client'
import type {
  AnalysisSessionResponse,
  DocumentVersion,
  GitLabJxmlPreview,
  GitLabProjectSummary,
  GitLabSourceListing,
} from '../types'

export async function createAnalysis(params: {
  title?: string
  word?: File
  jxmlArchive?: File
  jxmlText?: string
  gitlabGroupKey?: string
  gitlabProjectId?: string
  gitlabSelectedPaths?: string[]
  gitlabEntryPointPath?: string
}): Promise<AnalysisSessionResponse> {
  const form = new FormData()
  if (params.title) form.append('title', params.title)
  if (params.word) form.append('word', params.word)
  if (params.jxmlArchive) form.append('jxmlArchive', params.jxmlArchive)
  if (params.jxmlText) form.append('jxmlText', params.jxmlText)
  if (params.gitlabGroupKey) form.append('gitlabGroupKey', params.gitlabGroupKey)
  if (params.gitlabProjectId) form.append('gitlabProjectId', params.gitlabProjectId)
  if (params.gitlabEntryPointPath) form.append('gitlabEntryPointPath', params.gitlabEntryPointPath)
  if (params.gitlabSelectedPaths !== undefined) {
    // A multipart form can't represent "field present but empty" any other way — an
    // unchecked-everything selection must still be distinguishable from "not provided".
    form.append('gitlabSelectedPathsProvided', 'true')
    params.gitlabSelectedPaths.forEach((path) => form.append('gitlabSelectedPaths', path))
  }

  const { data } = await client.post<AnalysisSessionResponse>('/analysis', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listGitlabProjects(): Promise<GitLabProjectSummary[]> {
  const { data } = await client.get<GitLabProjectSummary[]>('/gitlab/projects')
  return data
}

export async function listGitlabSources(groupKey: string, projectId: string): Promise<GitLabSourceListing> {
  const { data } = await client.get<GitLabSourceListing>('/gitlab/sources', { params: { groupKey, projectId } })
  return data
}

/**
 * The flattened JXML (entry point + its Include chain resolved) exactly as it will be sent to
 * the model, plus any warnings (unresolved Includes, incomplete tag nesting) worth showing
 * separately from the content itself.
 */
export async function previewGitlabJxml(params: {
  groupKey: string
  projectId: string
  entryPointPath: string
  selectedPaths?: string[]
}): Promise<GitLabJxmlPreview> {
  // Built manually (not via axios' object params) so arrays serialize as repeated
  // `selectedPaths=a&selectedPaths=b`, matching how Spring binds a List<String> — axios'
  // default array serialization uses `selectedPaths[]=...`, which Spring won't bind.
  const query = new URLSearchParams()
  query.set('groupKey', params.groupKey)
  query.set('projectId', params.projectId)
  query.set('entryPointPath', params.entryPointPath)
  if (params.selectedPaths !== undefined) {
    query.set('selectedPathsProvided', 'true')
    params.selectedPaths.forEach((path) => query.append('selectedPaths', path))
  }
  const { data } = await client.get<GitLabJxmlPreview>('/gitlab/preview', { params: query })
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
