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
 * A persisted document's id and current markdown — returned by generation, merge, and auto-save
 * calls alike. `sessionId` is the session (created on the first generation of a session, unchanged
 * after) it was attached to — what the frontend actually keeps (in localStorage) to recover a
 * session, instead of holding the markdown itself across reloads or juggling several document ids.
 * Only an auto-save (which doesn't touch the session) leaves it null.
 */
export interface SpecGenerationResult {
  id: string
  markdown: string
  sessionId: string | null
}

/** The raw text extracted from an uploaded Word/.doc/.xlsx spec, exactly as it will be sent to the model. */
export interface WordExtractionPreview {
  content: string
}

/**
 * A session's id and the current content of whichever of its three slots (Word spec, JXML spec,
 * their merge) exist so far, plus the GitLab project selection it carries, if any — fetched by
 * just the session id. Backs the navbar's session export/import. An unfinished session (no merge
 * yet, or only one of the two source docs generated) comes back the same way, with the missing
 * slots simply left null.
 */
export interface SessionExport {
  sessionId: string
  wordDocumentId: string | null
  wordMarkdown: string | null
  jxmlDocumentId: string | null
  jxmlMarkdown: string | null
  mergedDocumentId: string | null
  mergedMarkdown: string | null
  gitlabSelectionJson: string | null
}
