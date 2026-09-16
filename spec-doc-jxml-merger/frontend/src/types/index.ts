export type JxmlSourceType = 'ZIP_UPLOAD' | 'PASTED_TEXT' | 'GITLAB_PROJECT'

export interface GitLabProjectSummary {
  id: number
  name: string
  pathWithNamespace: string
  defaultBranch: string | null
  webUrl: string
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
