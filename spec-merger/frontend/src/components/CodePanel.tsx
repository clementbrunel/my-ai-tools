import { useEffect, useState } from 'react'
import {
  generateSpecFromGitlab,
  listGitlabProjects,
  listGitlabSources,
  previewGitlabJxml,
} from '../api/analysis'
import type { PersistedDoc } from '../hooks/usePersistedDoc'
import type { GitLabEntryPoint, GitLabProjectSummary, GitlabSelection } from '../types'
import FullPageLoader from './FullPageLoader'
import MarkdownView from './MarkdownView'
import XmlTreeView from './XmlTreeView'

interface CodePanelProps {
  onCollapse?: () => void
  doc: PersistedDoc
  /** The current session, if one already exists (e.g. a Word doc was generated first) — passed
   * along so this generation attaches to it instead of starting a new one. */
  sessionId?: string | null
  /** The GitLab selection read from a persisted session at mount, replayed once below — see #326. */
  initialGitlabSelection?: GitlabSelection | null
  /** Called with the current selection whenever it changes, so the parent can persist it. */
  onGitlabSelectionChange?: (selection: GitlabSelection | null) => void
}

type Tab = 'input' | 'output'

function downloadMarkdown(markdown: string, filename: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function CodePanel({ onCollapse, doc, sessionId, initialGitlabSelection, onGitlabSelectionChange }: CodePanelProps) {
  const { markdown, isDirty, saving, onGenerated, onEdit, save } = doc
  const [tab, setTab] = useState<Tab>('input')
  const [gitlabProjects, setGitlabProjects] = useState<GitLabProjectSummary[]>([])
  const [gitlabProjectId, setGitlabProjectId] = useState('')
  const [gitlabLoading, setGitlabLoading] = useState(false)
  const [gitlabSearch, setGitlabSearch] = useState('')
  const [gitlabEntryPoints, setGitlabEntryPoints] = useState<GitLabEntryPoint[]>([])
  const [gitlabEntryPointPath, setGitlabEntryPointPath] = useState('')
  const [gitlabMandatoryPaths, setGitlabMandatoryPaths] = useState<string[]>([])
  const [gitlabSourcePaths, setGitlabSourcePaths] = useState<string[]>([])
  const [gitlabSelectedPaths, setGitlabSelectedPaths] = useState<Set<string>>(new Set())
  const [gitlabSourcesLoading, setGitlabSourcesLoading] = useState(false)
  const [gitlabPreviewOpen, setGitlabPreviewOpen] = useState(false)
  const [gitlabPreviewContent, setGitlabPreviewContent] = useState('')
  const [gitlabPreviewWarnings, setGitlabPreviewWarnings] = useState<string[]>([])
  const [gitlabPreviewLoading, setGitlabPreviewLoading] = useState(false)
  const [previewViewMode, setPreviewViewMode] = useState<'tree' | 'raw'>('tree')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // While true, the effect that reports selection changes upward stays silent — otherwise the
  // intermediate states hit while replaying a restored selection (project set before its sources
  // resolve, etc.) would overwrite the persisted selection before the replay has finished.
  const [restoringGitlabSelection, setRestoringGitlabSelection] = useState(
    Boolean(initialGitlabSelection),
  )

  // Switches to the Output tab whenever markdown appears from outside a local handleGenerate
  // call — namely, a session restore, which sets it asynchronously after mount and wouldn't
  // otherwise be reflected here. A no-op for the local-generate path, which already switches
  // tabs itself, and never fights a manual switch back to Input since markdown doesn't change then.
  useEffect(() => {
    if (markdown) setTab('output')
  }, [markdown])

  useEffect(() => {
    if (!gitlabPreviewOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setGitlabPreviewOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gitlabPreviewOpen])

  // Replays the GitLab loading flow once, from whatever selection the session was restored with:
  // load the projects, pick the stored one (which fetches its sources), then apply the stored
  // entry point and checked files — overriding the defaults handleSelectGitlabProject would apply.
  useEffect(() => {
    const selection = initialGitlabSelection
    if (!selection) return

    let cancelled = false

    async function restoreSelection(selection: GitlabSelection) {
      setError(null)
      setGitlabLoading(true)
      try {
        const projects = await listGitlabProjects()
        if (cancelled) return
        setGitlabProjects(projects)
        setGitlabProjectId(selection.projectId)

        setGitlabSourcesLoading(true)
        try {
          const listing = await listGitlabSources(selection.groupKey, selection.projectId)
          if (cancelled) return
          setGitlabMandatoryPaths(listing.mandatoryPaths)
          setGitlabSourcePaths(listing.optionalPaths)
          setGitlabEntryPoints(listing.entryPoints)
          setGitlabSelectedPaths(
            new Set(selection.selectedPaths.filter((path) => listing.optionalPaths.includes(path))),
          )
          const restoredEntryPointStillExists = listing.entryPoints.some(
            (entryPoint) => entryPoint.path === selection.entryPointPath,
          )
          setGitlabEntryPointPath(
            restoredEntryPointStillExists
              ? selection.entryPointPath
              : listing.entryPoints.length === 1
                ? listing.entryPoints[0].path
                : '',
          )
        } finally {
          if (!cancelled) setGitlabSourcesLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Échec de la restauration de la sélection GitLab — voir la console.',
          )
          console.error(e)
        }
      } finally {
        if (!cancelled) {
          setGitlabLoading(false)
          setRestoringGitlabSelection(false)
        }
      }
    }

    void restoreSelection(selection)
    return () => {
      cancelled = true
    }
    // Runs once on mount only — replays whatever GitLab selection the session held at load time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reports the current selection upward (for persistence) whenever it settles on something new —
  // skipped while the restore replay above is still in flight, and cleared to null once there's
  // no project selected.
  useEffect(() => {
    if (restoringGitlabSelection) return
    if (!onGitlabSelectionChange) return

    const project = gitlabProjects.find((p) => String(p.id) === gitlabProjectId)
    if (!project) {
      onGitlabSelectionChange(null)
      return
    }

    onGitlabSelectionChange({
      groupKey: project.groupKey,
      projectId: gitlabProjectId,
      entryPointPath: gitlabEntryPointPath,
      selectedPaths: Array.from(gitlabSelectedPaths),
    })
  }, [
    gitlabProjects,
    gitlabProjectId,
    gitlabEntryPointPath,
    gitlabSelectedPaths,
    restoringGitlabSelection,
    onGitlabSelectionChange,
  ])

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
    setGitlabMandatoryPaths([])
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
      setGitlabMandatoryPaths(listing.mandatoryPaths)
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

  function currentGitlabPreviewParams() {
    const project = gitlabProjects.find((p) => String(p.id) === gitlabProjectId)
    if (!project || !gitlabEntryPointPath) return null
    return {
      groupKey: project.groupKey,
      projectId: gitlabProjectId,
      entryPointPath: gitlabEntryPointPath,
      selectedPaths: Array.from(gitlabSelectedPaths),
    }
  }

  /** Opens the read-only modal showing the full resolved JXML that will be sent to the model. */
  async function handlePreviewGitlabJxml() {
    const params = currentGitlabPreviewParams()
    if (!params) return

    setError(null)
    setGitlabPreviewOpen(true)
    setGitlabPreviewLoading(true)
    try {
      const preview = await previewGitlabJxml(params)
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

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const params = currentGitlabPreviewParams()
      if (!params) return
      onGenerated(await generateSpecFromGitlab(params, sessionId))
      setTab('output')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la génération de la doc — voir la console.')
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    setError(null)
    try {
      await save()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement — voir la console.")
      console.error(e)
    }
  }

  const canGenerate = !!gitlabEntryPointPath

  const gitlabSearchTerm = gitlabSearch.trim().toLowerCase()
  const filteredGitlabProjects = gitlabSearchTerm
    ? gitlabProjects.filter((p) =>
        `${p.groupKey} ${p.pathWithNamespace} ${p.name}`.toLowerCase().includes(gitlabSearchTerm),
      )
    : gitlabProjects

  return (
    <>
      {generating && <FullPageLoader message="Génération de la doc depuis le code source en cours…" />}
      <section className="card p-4 overflow-auto min-h-0 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="field-label">Spec JXML</h2>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              title="Réduire le panneau"
              aria-label="Réduire le panneau Spec JXML"
              className="text-gray-400 hover:text-gl-blue leading-none px-1 shrink-0"
            >
              ▶
            </button>
          )}
        </div>
        <div className="flex mb-3 border-b border-[#dcdcde] text-sm shrink-0">
          {(['input', 'output'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`flex-1 basis-1/2 text-center pb-2 -mb-px border-b-2 ${
                tab === t
                  ? 'border-gl-orange text-[#303030] font-medium'
                  : 'border-transparent text-gray-500 hover:text-[#303030]'
              }`}
              onClick={() => setTab(t)}
            >
              {t === 'input' ? 'Input' : 'Output'}
            </button>
          ))}
        </div>

        {tab === 'input' ? (
          <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-auto">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="btn-secondary self-start"
                onClick={handleLoadGitlabProjects}
                disabled={gitlabLoading}
              >
                {gitlabLoading ? 'Chargement…' : 'Charger les projets GitLab'}
              </button>
              {gitlabProjects.length > 0 && (
                <>
                  <input
                    type="text"
                    value={gitlabSearch}
                    onChange={(e) => setGitlabSearch(e.target.value)}
                    placeholder="Rechercher un projet (groupe, chemin, nom)…"
                    className="rounded border border-[#dcdcde] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gl-orange"
                  />
                  <select
                    value={gitlabProjectId}
                    onChange={(e) => handleSelectGitlabProject(e.target.value)}
                    className="rounded border border-[#dcdcde] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gl-orange"
                  >
                    <option value="">
                      {filteredGitlabProjects.length === 0 ? 'Aucun projet ne correspond' : '— Choisir un projet —'}
                    </option>
                    {filteredGitlabProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.groupKey}] {p.pathWithNamespace}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {gitlabSourcesLoading && <p className="text-sm text-gray-500">Chargement des fichiers…</p>}
              {gitlabEntryPoints.length > 0 && (
                <div className="border border-[#dcdcde] rounded">
                  <div className="px-2 py-1.5 border-b border-[#dcdcde] bg-[#fafafa] text-sm text-gray-600">
                    Démarche à documenter (trouvée{gitlabEntryPoints.length > 1 ? 's' : ''} dans FORMS.jxml)
                  </div>
                  <ul className="text-sm divide-y divide-[#eee]">
                    {gitlabEntryPoints.map((entryPoint) => (
                      <li key={entryPoint.path} className="px-2 py-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="gitlab-entry-point"
                            checked={gitlabEntryPointPath === entryPoint.path}
                            onChange={() => setGitlabEntryPointPath(entryPoint.path)}
                          />
                          <span className="font-mono text-[13px] break-all">{entryPoint.documentId}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {gitlabEntryPointPath && (
                <button
                  type="button"
                  className="btn-secondary self-start"
                  onClick={handlePreviewGitlabJxml}
                  disabled={gitlabPreviewLoading}
                >
                  {gitlabPreviewLoading ? 'Génération de la prévisualisation…' : 'Prévisualiser le JXML résolu'}
                </button>
              )}
              {gitlabPreviewOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                  onClick={() => setGitlabPreviewOpen(false)}
                >
                  <div
                    className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#dcdcde] bg-[#fafafa] text-sm shrink-0">
                      <span className="text-gray-600">
                        JXML envoyé au modèle (Include résolus, includes/traductions/Java non affichés ici)
                      </span>
                      <button
                        type="button"
                        className="text-gl-blue hover:text-gl-blue-dark hover:underline"
                        onClick={() => setGitlabPreviewOpen(false)}
                      >
                        Fermer
                      </button>
                    </div>
                    {gitlabPreviewLoading ? (
                      <p className="text-sm text-gray-500 p-3">Chargement…</p>
                    ) : (
                      <>
                        {gitlabPreviewWarnings.length > 0 && (
                          <div className="px-3 py-2 border-b border-amber-200 bg-amber-50 text-sm shrink-0">
                            <p className="font-medium text-amber-800 mb-1">
                              {gitlabPreviewWarnings.length} problème(s) détecté(s) dans le JXML généré
                            </p>
                            <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                              {gitlabPreviewWarnings.map((warning, i) => (
                                <li key={i}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex gap-4 px-3 pt-2 text-sm border-b border-[#dcdcde] shrink-0">
                          {(['tree', 'raw'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              className={`pb-2 -mb-px border-b-2 ${
                                previewViewMode === mode
                                  ? 'border-gl-orange text-[#303030] font-medium'
                                  : 'border-transparent text-gray-500 hover:text-[#303030]'
                              }`}
                              onClick={() => setPreviewViewMode(mode)}
                            >
                              {mode === 'tree' ? 'Arborescence' : 'Texte brut'}
                            </button>
                          ))}
                        </div>
                        <div className="overflow-auto p-3 flex-1">
                          {previewViewMode === 'tree' ? (
                            <XmlTreeView xml={gitlabPreviewContent} />
                          ) : (
                            <pre className="text-[12px] whitespace-pre-wrap break-all">{gitlabPreviewContent}</pre>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              {gitlabMandatoryPaths.length > 0 && (
                <div className="border border-[#dcdcde] rounded">
                  <div className="px-2 py-1.5 border-b border-[#dcdcde] bg-[#fafafa] text-sm text-gray-600">
                    Fichiers de traduction — toujours inclus (résolvent les clés trans(...) du JXML, #285)
                  </div>
                  <ul className="max-h-32 overflow-auto text-sm divide-y divide-[#eee]">
                    {gitlabMandatoryPaths.map((path) => (
                      <li key={path} className="px-2 py-1">
                        <label className="flex items-center gap-2 text-gray-500">
                          <input type="checkbox" checked disabled />
                          <span className="font-mono text-[13px] break-all">{path}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {gitlabSourcePaths.length > 0 && (
                <div className="border border-[#dcdcde] rounded">
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[#dcdcde] bg-[#fafafa] text-sm">
                    <span className="text-gray-600">
                      {gitlabSelectedPaths.size} / {gitlabSourcePaths.length} fichier(s) inclus
                    </span>
                    <span className="flex gap-3">
                      <button
                        type="button"
                        className="text-gl-blue hover:text-gl-blue-dark hover:underline"
                        onClick={() => setGitlabSelectedPaths(new Set(gitlabSourcePaths))}
                      >
                        Tout cocher
                      </button>
                      <button
                        type="button"
                        className="text-gl-blue hover:text-gl-blue-dark hover:underline"
                        onClick={() => setGitlabSelectedPaths(new Set())}
                      >
                        Tout décocher
                      </button>
                    </span>
                  </div>
                  <ul className="max-h-64 overflow-auto text-sm divide-y divide-[#eee]">
                    {gitlabSourcePaths.map((path) => (
                      <li key={path} className="px-2 py-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={gitlabSelectedPaths.has(path)}
                            onChange={() => handleToggleGitlabPath(path)}
                          />
                          <span className="font-mono text-[13px] break-all">{path}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mt-auto pt-3 border-t border-[#eee] flex items-center gap-3">
              <button type="button" className="btn-primary" onClick={handleGenerate} disabled={!canGenerate || generating}>
                {generating ? 'Génération…' : 'Générer la doc'}
              </button>
              {error && <span className="text-sm text-gl-danger">{error}</span>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col min-h-0 flex-1 gap-2">
            {markdown && (
              <div className="flex items-center justify-end gap-3 shrink-0">
                {error && <span className="text-sm text-gl-danger">{error}</span>}
                {isDirty && (
                  <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => downloadMarkdown(markdown, 'spec-jxml.md')}
                >
                  Télécharger
                </button>
              </div>
            )}
            <MarkdownView
              value={markdown}
              onChange={onEdit}
              placeholder="La doc générée depuis le JXML apparaîtra ici après génération."
            />
          </div>
        )}
      </section>
    </>
  )
}

export default CodePanel
