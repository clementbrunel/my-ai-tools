import { client } from './client'
import type {
  GitLabJxmlPreview,
  GitLabProjectSummary,
  GitLabSourceListing,
  SessionExport,
  SpecGenerationResult,
  WordExtractionPreview,
} from '../types'

export async function listGitlabProjects(): Promise<GitLabProjectSummary[]> {
  const { data } = await client.get<GitLabProjectSummary[]>('/gitlab/projects')
  return data
}

export async function listGitlabSources(groupKey: string, projectId: string): Promise<GitLabSourceListing> {
  const { data } = await client.get<GitLabSourceListing>('/gitlab/sources', { params: { groupKey, projectId } })
  return data
}

interface GitlabPreviewParams {
  groupKey: string
  projectId: string
  entryPointPath: string
  selectedPaths?: string[]
}

// Built manually (not via axios' object params) so arrays serialize as repeated
// `selectedPaths=a&selectedPaths=b`, matching how Spring binds a List<String> — axios'
// default array serialization uses `selectedPaths[]=...`, which Spring won't bind.
function buildGitlabPreviewQuery(params: GitlabPreviewParams): URLSearchParams {
  const query = new URLSearchParams()
  query.set('groupKey', params.groupKey)
  query.set('projectId', params.projectId)
  query.set('entryPointPath', params.entryPointPath)
  if (params.selectedPaths !== undefined) {
    query.set('selectedPathsProvided', 'true')
    params.selectedPaths.forEach((path) => query.append('selectedPaths', path))
  }
  return query
}

/**
 * The flattened JXML (entry point + its Include chain resolved) exactly as it will be sent to
 * the model, plus any warnings (unresolved Includes, incomplete tag nesting) worth showing
 * separately from the content itself.
 */
export async function previewGitlabJxml(params: GitlabPreviewParams): Promise<GitLabJxmlPreview> {
  const { data } = await client.get<GitLabJxmlPreview>('/gitlab/preview', {
    params: buildGitlabPreviewQuery(params),
  })
  return data
}

/**
 * The markdown spec the model generates from the Word/Excel spec alone (no JXML/diff yet).
 * `word` is optional: while the backend is running with MISTRAL_MOCK=true, omitting it falls
 * back to a bundled sample spec server-side instead of requiring a real file (400 otherwise) —
 * same idea as the mock GitLab project, no dedicated mock endpoint needed. `sessionId` is the
 * frontend's current session, if it already has one (e.g. a JXML doc was generated first) —
 * omitted to start a brand new session.
 */
export async function generateSpecFromWord(word?: File, sessionId?: string | null): Promise<SpecGenerationResult> {
  const form = new FormData()
  if (word) form.append('word', word)
  if (sessionId) form.append('sessionId', sessionId)
  const { data } = await client.post<SpecGenerationResult>('/spec/generate-from-word', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/**
 * The raw text extracted from the uploaded Word/.doc/.xlsx spec, exactly as it will be sent to
 * the model — lets the user check the extraction before spending an AI call on it.
 */
export async function previewWord(word: File): Promise<string> {
  const form = new FormData()
  form.append('word', word)
  const { data } = await client.post<WordExtractionPreview>('/spec/preview-word', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.content
}

/**
 * The markdown spec the model generates from a GitLab entry point's JXML — Include chain resolved
 * and spec generated server-side in one request, instead of chaining previewGitlabJxml into a
 * separate generation call from the frontend. `sessionId` is the frontend's current session, if
 * it already has one (e.g. a Word doc was generated first) — omitted to start a brand new session.
 */
export async function generateSpecFromGitlab(
  params: GitlabPreviewParams,
  sessionId?: string | null,
): Promise<SpecGenerationResult> {
  const query = buildGitlabPreviewQuery(params)
  if (sessionId) query.set('sessionId', sessionId)
  const { data } = await client.get<SpecGenerationResult>('/gitlab/generate-spec', { params: query })
  return data
}

/**
 * Merges the Word-generated and JXML-generated markdown specs (as currently held by the
 * frontend, including any manual edit) into a single reconciled document, attached to
 * `sessionId` — the session both were generated under. The current GitLab project selection
 * (JSON-encoded, opaque to the backend), if any, is recorded on that same session, so its id
 * alone is enough to export/import the whole thing.
 */
export async function mergeSpecs(
  wordMarkdown: string,
  jxmlMarkdown: string,
  sessionId: string,
  gitlabSelectionJson?: string | null,
): Promise<SpecGenerationResult> {
  const { data } = await client.post<SpecGenerationResult>('/spec/merge', {
    wordMarkdown,
    jxmlMarkdown,
    sessionId,
    gitlabSelectionJson: gitlabSelectionJson ?? undefined,
  })
  return data
}

/**
 * Everything needed to recover a session from another machine, from just its id — backs the
 * navbar's session export/import.
 */
export async function getSession(sessionId: string): Promise<SessionExport> {
  const { data } = await client.get<SessionExport>(`/spec/session/${sessionId}`)
  return data
}

/** Auto-saves a manual edit as a new revision of an existing document (debounced by the caller). */
export async function updateDocument(id: string, content: string): Promise<SpecGenerationResult> {
  const { data } = await client.put<SpecGenerationResult>(`/spec/documents/${id}`, { content })
  return data
}
