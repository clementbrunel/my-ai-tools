import { useState } from 'react'
import { createAnalysis, getAnalysis, listVersions, restoreVersion, saveVersion } from '../api/analysis'
import type { AnalysisSessionResponse, DocumentVersion } from '../types'

interface AnalyzeParams {
  title?: string
  word?: File
  jxmlArchive?: File
  jxmlText?: string
  gitlabGroupKey?: string
  gitlabProjectId?: string
  gitlabSelectedPaths?: string[]
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

export function useAnalysisSession() {
  const [session, setSession] = useState<AnalysisSessionResponse | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function analyze(params: AnalyzeParams) {
    setError(null)
    setLoading(true)
    try {
      const result = await createAnalysis(params)
      setSession(result)
      setMarkdown(result.markdown)
      setVersions(await listVersions(result.id))
    } catch (e) {
      setError(errorMessage(e, "Échec de l'analyse — voir la console."))
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!session) return
    setLoading(true)
    try {
      await saveVersion(session.id, markdown)
      setVersions(await listVersions(session.id))
    } catch (e) {
      setError(errorMessage(e, "Échec de l'enregistrement — voir la console."))
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function restore(versionId: string) {
    if (!session) return
    setLoading(true)
    try {
      await restoreVersion(session.id, versionId)
      const refreshed = await getAnalysis(session.id)
      setSession(refreshed)
      setMarkdown(refreshed.markdown)
      setVersions(await listVersions(session.id))
    } catch (e) {
      setError(errorMessage(e, 'Échec de la restauration — voir la console.'))
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return { session, markdown, setMarkdown, versions, loading, error, setError, analyze, save, restore }
}
