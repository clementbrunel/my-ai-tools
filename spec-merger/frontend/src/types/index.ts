export type JxmlSourceType = 'ZIP_UPLOAD' | 'PASTED_TEXT' | 'GITLAB_PROJECT'

export interface GitLabProjectSummary {
  id: number
  name: string
  pathWithNamespace: string
  defaultBranch: string | null
  webUrl: string
  groupKey: string
}

/** A démarche entry point declared by FORMS.jxml (one Hyperlink Type="Document"). */
export interface GitLabEntryPoint {
  documentId: string
  path: string
}

export interface GitLabSourceListing {
  entryPoints: GitLabEntryPoint[]
  /** Translation resources (.properties/.xlf) — always fetched to resolve trans(...) keys
   * (see #285), never a free checkbox like optionalPaths. */
  mandatoryPaths: string[]
  optionalPaths: string[]
}

export interface GitLabJxmlPreview {
  content: string
  warnings: string[]
}

/** CodePanel's live GitLab source selection — persisted so a reload can replay it (see #326). */
export interface GitlabSelection {
  groupKey: string
  projectId: string
  entryPointPath: string
  selectedPaths: string[]
}

/**
 * A persisted document's id and current markdown — returned by generation, merge, fetch, and
 * auto-save calls alike. The id is what the frontend keeps (in localStorage) to recover a
 * session, instead of holding the markdown itself across reloads.
 */
export interface SpecGenerationResult {
  id: string
  markdown: string
}

/** The raw text extracted from an uploaded Word/.doc/.xlsx spec, exactly as it will be sent to the model. */
export interface WordExtractionPreview {
  content: string
}
