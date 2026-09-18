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

/** The markdown a spec-generation call produced from a single source. */
export interface SpecGenerationResult {
  markdown: string
}

/** The raw text extracted from an uploaded Word/.doc/.xlsx spec, exactly as it will be sent to the model. */
export interface WordExtractionPreview {
  content: string
}

export interface Divergence {
  id: string
  sectionRef: string
  wordExcerpt: string | null
  jxmlExcerpt: string | null
  aiProposal: string | null
  resolutionStatus: 'PENDING' | 'ACCEPTED' | 'EDITED' | 'REJECTED'
  resolvedValue: string | null
}

export interface AnalysisSessionResponse {
  id: string
  title: string | null
  status: string
  markdown: string
  divergences: Divergence[]
}

export interface DocumentVersion {
  id: string
  versionNumber: number
  source: 'GENERATED' | 'MANUAL_EDIT' | 'RESTORED'
  createdAt: string
}
