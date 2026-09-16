import { useState } from 'react'
import { listGitlabProjects, listGitlabSources, previewGitlabJxml } from './api/analysis'
import CodePanel from './components/CodePanel'
import CollapsedPanel from './components/CollapsedPanel'
import DivergencesTable from './components/DivergencesTable'
import Header from './components/Header'
import MergePanel from './components/MergePanel'
import SpecPanel from './components/SpecPanel'
import { useAnalysisSession } from './hooks/useAnalysisSession'
import type { GitLabEntryPoint, GitLabProjectSummary, JxmlMode } from './types'

function App() {
  const [title, setTitle] = useState('')
  const [wordFile, setWordFile] = useState<File | null>(null)
  const [jxmlMode, setJxmlMode] = useState<JxmlMode>('zip')
  const [jxmlFile, setJxmlFile] = useState<File | null>(null)
  const [jxmlText, setJxmlText] = useState('')
  const [gitlabProjects, setGitlabProjects] = useState<GitLabProjectSummary[]>([])
  const [gitlabProjectId, setGitlabProjectId] = useState('')
  const [gitlabLoading, setGitlabLoading] = useState(false)
  const [gitlabSearch, setGitlabSearch] = useState('')
  const [gitlabEntryPoints, setGitlabEntryPoints] = useState<GitLabEntryPoint[]>([])
  const [gitlabEntryPointPath, setGitlabEntryPointPath] = useState('')
  const [gitlabSourcePaths, setGitlabSourcePaths] = useState<string[]>([])
  const [gitlabSelectedPaths, setGitlabSelectedPaths] = useState<Set<string>>(new Set())
  const [gitlabSourcesLoading, setGitlabSourcesLoading] = useState(false)
  const [gitlabPreviewOpen, setGitlabPreviewOpen] = useState(false)
  const [gitlabPreviewContent, setGitlabPreviewContent] = useState('')
  const [gitlabPreviewWarnings, setGitlabPreviewWarnings] = useState<string[]>([])
  const [gitlabPreviewLoading, setGitlabPreviewLoading] = useState(false)
  const [specCollapsed, setSpecCollapsed] = useState(false)
  const [codeCollapsed, setCodeCollapsed] = useState(false)

  const { session, markdown, setMarkdown, versions, loading, error, setError, analyze, save, restore } =
    useAnalysisSession()

  async function handleAnalyze() {
    const hasJxml =
      jxmlMode === 'zip' ? !!jxmlFile : jxmlMode === 'text' ? !!jxmlText.trim() : !!gitlabProjectId
    if (!wordFile && !hasJxml) {
      setError('Fournis au moins une source : Word (.docx) ou JXML.')
      return
    }
    if (jxmlMode === 'gitlab' && gitlabEntryPoints.length > 0 && !gitlabEntryPointPath) {
      setError('Choisis la démarche à documenter parmi les points d’entrée trouvés dans FORMS.jxml.')
      return
    }
    const selectedGitlabProject = gitlabProjects.find((p) => String(p.id) === gitlabProjectId)
    await analyze({
      title: title || undefined,
      word: wordFile ?? undefined,
      jxmlArchive: jxmlMode === 'zip' ? (jxmlFile ?? undefined) : undefined,
      jxmlText: jxmlMode === 'text' ? jxmlText : undefined,
      gitlabGroupKey: jxmlMode === 'gitlab' ? selectedGitlabProject?.groupKey : undefined,
      gitlabProjectId: jxmlMode === 'gitlab' ? gitlabProjectId : undefined,
      gitlabSelectedPaths: jxmlMode === 'gitlab' ? Array.from(gitlabSelectedPaths) : undefined,
      gitlabEntryPointPath: jxmlMode === 'gitlab' ? gitlabEntryPointPath || undefined : undefined,
    })
  }

  async function handleLoadGitlabProjects() {
    setError(null)
    setGitlabLoading(true)
    try {
      setGitlabProjects(await listGitlabProjects())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec du chargement des projets GitLab — voir la console.')
      console.error(e)
    } finally {
      setGitlabLoading(false)
    }
  }

  async function handleSelectGitlabProject(projectId: string) {
    setGitlabProjectId(projectId)
    setGitlabSourcePaths([])
    setGitlabSelectedPaths(new Set())
    setGitlabEntryPoints([])
    setGitlabEntryPointPath('')
    if (!projectId) return

    const project = gitlabProjects.find((p) => String(p.id) === projectId)
    if (!project) return

    setError(null)
    setGitlabSourcesLoading(true)
    try {
      const listing = await listGitlabSources(project.groupKey, projectId)
      setGitlabSourcePaths(listing.optionalPaths)
      setGitlabSelectedPaths(new Set(listing.optionalPaths))
      setGitlabEntryPoints(listing.entryPoints)
      // Nothing to choose between when there's exactly one candidate démarche.
      setGitlabEntryPointPath(listing.entryPoints.length === 1 ? listing.entryPoints[0].path : '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec du chargement des fichiers du projet — voir la console.')
      console.error(e)
    } finally {
      setGitlabSourcesLoading(false)
    }
  }

  async function handlePreviewGitlabJxml() {
    const project = gitlabProjects.find((p) => String(p.id) === gitlabProjectId)
    if (!project || !gitlabEntryPointPath) return

    setError(null)
    setGitlabPreviewOpen(true)
    setGitlabPreviewLoading(true)
    try {
      const preview = await previewGitlabJxml({
        groupKey: project.groupKey,
        projectId: gitlabProjectId,
        entryPointPath: gitlabEntryPointPath,
        selectedPaths: Array.from(gitlabSelectedPaths),
      })
      setGitlabPreviewContent(preview.content)
      setGitlabPreviewWarnings(preview.warnings)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la prévisualisation — voir la console.')
      console.error(e)
      setGitlabPreviewOpen(false)
    } finally {
      setGitlabPreviewLoading(false)
    }
  }

  function handleToggleGitlabPath(path: string) {
    setGitlabSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  // Retracted side panels free up their width so the merge panel (and the
  // remaining side panel, if any) can grow from a third of the screen to a half.
  const gridColsClass =
    specCollapsed && codeCollapsed
      ? 'md:grid-cols-[3rem_1fr_3rem]'
      : specCollapsed
        ? 'md:grid-cols-[3rem_1fr_1fr]'
        : codeCollapsed
          ? 'md:grid-cols-[1fr_1fr_3rem]'
          : 'md:grid-cols-[1fr_1.4fr_1fr]'

  function handleDownload() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'spec-fusion'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        title={title}
        onTitleChange={setTitle}
        onAnalyze={handleAnalyze}
        loading={loading}
        hasSession={!!session}
        onSave={save}
        onDownload={handleDownload}
      />

      {error && (
        <div className="px-4 py-2 bg-red-50 text-gl-danger text-sm border-b border-red-200">{error}</div>
      )}

      <div className={`grid grid-cols-1 ${gridColsClass} gap-3 p-3 flex-1`}>
        {specCollapsed ? (
          <CollapsedPanel label="Spec Word" icon="▶" onExpand={() => setSpecCollapsed(false)} />
        ) : (
          <SpecPanel
            wordFile={wordFile}
            onWordFileChange={setWordFile}
            onCollapse={() => setSpecCollapsed(true)}
          />
        )}

        <MergePanel markdown={markdown} onMarkdownChange={setMarkdown} versions={versions} onRestore={restore} />

        {codeCollapsed ? (
          <CollapsedPanel label="Spec JXML" icon="◀" onExpand={() => setCodeCollapsed(false)} />
        ) : (
          <CodePanel
            jxmlMode={jxmlMode}
            onJxmlModeChange={setJxmlMode}
            jxmlFile={jxmlFile}
            onJxmlFileChange={setJxmlFile}
            jxmlText={jxmlText}
            onJxmlTextChange={setJxmlText}
            gitlabProjects={gitlabProjects}
            gitlabProjectId={gitlabProjectId}
            onSelectGitlabProject={handleSelectGitlabProject}
            gitlabLoading={gitlabLoading}
            onLoadGitlabProjects={handleLoadGitlabProjects}
            gitlabSearch={gitlabSearch}
            onGitlabSearchChange={setGitlabSearch}
            gitlabEntryPoints={gitlabEntryPoints}
            gitlabEntryPointPath={gitlabEntryPointPath}
            onSelectGitlabEntryPoint={setGitlabEntryPointPath}
            onPreviewGitlabJxml={handlePreviewGitlabJxml}
            gitlabPreviewOpen={gitlabPreviewOpen}
            gitlabPreviewContent={gitlabPreviewContent}
            gitlabPreviewWarnings={gitlabPreviewWarnings}
            gitlabPreviewLoading={gitlabPreviewLoading}
            onCloseGitlabPreview={() => setGitlabPreviewOpen(false)}
            gitlabSourcePaths={gitlabSourcePaths}
            gitlabSelectedPaths={gitlabSelectedPaths}
            onToggleGitlabPath={handleToggleGitlabPath}
            onSelectAllGitlabPaths={() => setGitlabSelectedPaths(new Set(gitlabSourcePaths))}
            onClearGitlabPaths={() => setGitlabSelectedPaths(new Set())}
            gitlabSourcesLoading={gitlabSourcesLoading}
            onCollapse={() => setCodeCollapsed(true)}
          />
        )}
      </div>

      {session && <DivergencesTable divergences={session.divergences} />}
    </div>
  )
}

export default App
