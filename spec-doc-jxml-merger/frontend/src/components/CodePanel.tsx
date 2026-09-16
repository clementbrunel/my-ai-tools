import { useEffect, useState } from 'react'
import type { GitLabEntryPoint, GitLabProjectSummary, JxmlMode } from '../types'
import XmlTreeView from './XmlTreeView'

interface CodePanelProps {
  jxmlMode: JxmlMode
  onJxmlModeChange: (mode: JxmlMode) => void
  jxmlFile: File | null
  onJxmlFileChange: (file: File | null) => void
  jxmlText: string
  onJxmlTextChange: (value: string) => void
  gitlabProjects: GitLabProjectSummary[]
  gitlabProjectId: string
  onSelectGitlabProject: (projectId: string) => void
  gitlabLoading: boolean
  onLoadGitlabProjects: () => void
  gitlabSearch: string
  onGitlabSearchChange: (value: string) => void
  gitlabEntryPoints: GitLabEntryPoint[]
  gitlabEntryPointPath: string
  onSelectGitlabEntryPoint: (path: string) => void
  onPreviewGitlabJxml: () => void
  onPreviewGitlabSpec: () => void
  gitlabPreviewOpen: boolean
  gitlabPreviewKind: 'jxml' | 'spec'
  gitlabPreviewContent: string
  gitlabPreviewWarnings: string[]
  gitlabPreviewLoading: boolean
  onCloseGitlabPreview: () => void
  gitlabSourcePaths: string[]
  gitlabSelectedPaths: Set<string>
  onToggleGitlabPath: (path: string) => void
  onSelectAllGitlabPaths: () => void
  onClearGitlabPaths: () => void
  gitlabSourcesLoading: boolean
  onCollapse?: () => void
}

const JXML_MODES: Array<[JxmlMode, string]> = [
  ['zip', 'Archive .zip'],
  ['text', 'Coller le texte'],
  ['gitlab', 'Projet GitLab'],
]

function CodePanel({
  jxmlMode,
  onJxmlModeChange,
  jxmlFile,
  onJxmlFileChange,
  jxmlText,
  onJxmlTextChange,
  gitlabProjects,
  gitlabProjectId,
  onSelectGitlabProject,
  gitlabLoading,
  onLoadGitlabProjects,
  gitlabSearch,
  onGitlabSearchChange,
  gitlabEntryPoints,
  gitlabEntryPointPath,
  onSelectGitlabEntryPoint,
  onPreviewGitlabJxml,
  onPreviewGitlabSpec,
  gitlabPreviewOpen,
  gitlabPreviewKind,
  gitlabPreviewContent,
  gitlabPreviewWarnings,
  gitlabPreviewLoading,
  onCloseGitlabPreview,
  gitlabSourcePaths,
  gitlabSelectedPaths,
  onToggleGitlabPath,
  onSelectAllGitlabPaths,
  onClearGitlabPaths,
  gitlabSourcesLoading,
  onCollapse,
}: CodePanelProps) {
  const [previewViewMode, setPreviewViewMode] = useState<'tree' | 'raw'>('tree')

  useEffect(() => {
    if (!gitlabPreviewOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseGitlabPreview()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gitlabPreviewOpen, onCloseGitlabPreview])

  const gitlabSearchTerm = gitlabSearch.trim().toLowerCase()
  const filteredGitlabProjects = gitlabSearchTerm
    ? gitlabProjects.filter((p) =>
        `${p.groupKey} ${p.pathWithNamespace} ${p.name}`.toLowerCase().includes(gitlabSearchTerm),
      )
    : gitlabProjects

  return (
    <section className="card p-4 overflow-auto">
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
      <div className="flex gap-4 mb-3 border-b border-[#dcdcde] text-sm">
        {JXML_MODES.map(([mode, label]) => (
          <label
            key={mode}
            className={`pb-2 -mb-px border-b-2 cursor-pointer ${
              jxmlMode === mode
                ? 'border-gl-orange text-[#303030] font-medium'
                : 'border-transparent text-gray-500 hover:text-[#303030]'
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              checked={jxmlMode === mode}
              onChange={() => onJxmlModeChange(mode)}
            />
            {label}
          </label>
        ))}
      </div>
      {jxmlMode === 'zip' && (
        <>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => onJxmlFileChange(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gl-blue file:text-white file:text-sm hover:file:bg-gl-blue-dark file:cursor-pointer"
          />
          {jxmlFile && <p className="text-sm text-gray-500 mt-2">{jxmlFile.name}</p>}
        </>
      )}
      {jxmlMode === 'text' && (
        <textarea
          value={jxmlText}
          onChange={(e) => onJxmlTextChange(e.target.value)}
          placeholder="Colle ici le contenu JXML"
          className="w-full min-h-[40vh] rounded border border-[#dcdcde] p-2 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-gl-orange"
        />
      )}
      {jxmlMode === 'gitlab' && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="btn-secondary self-start"
            onClick={onLoadGitlabProjects}
            disabled={gitlabLoading}
          >
            {gitlabLoading ? 'Chargement…' : 'Charger les projets GitLab'}
          </button>
          {gitlabProjects.length > 0 && (
            <>
              <input
                type="text"
                value={gitlabSearch}
                onChange={(e) => onGitlabSearchChange(e.target.value)}
                placeholder="Rechercher un projet (groupe, chemin, nom)…"
                className="rounded border border-[#dcdcde] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gl-orange"
              />
              <select
                value={gitlabProjectId}
                onChange={(e) => onSelectGitlabProject(e.target.value)}
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
                        onChange={() => onSelectGitlabEntryPoint(entryPoint.path)}
                      />
                      <span className="font-mono text-[13px] break-all">{entryPoint.documentId}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {gitlabEntryPointPath && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary self-start"
                onClick={onPreviewGitlabJxml}
                disabled={gitlabPreviewLoading}
              >
                {gitlabPreviewLoading && gitlabPreviewKind === 'jxml'
                  ? 'Génération de la prévisualisation…'
                  : 'Prévisualiser le JXML résolu'}
              </button>
              <button
                type="button"
                className="btn-secondary self-start"
                onClick={onPreviewGitlabSpec}
                disabled={gitlabPreviewLoading}
              >
                {gitlabPreviewLoading && gitlabPreviewKind === 'spec'
                  ? 'Génération de la doc…'
                  : 'Générer la doc depuis le JXML (aperçu IA)'}
              </button>
            </div>
          )}
          {gitlabPreviewOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={onCloseGitlabPreview}
            >
              <div
                className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#dcdcde] bg-[#fafafa] text-sm shrink-0">
                  <span className="text-gray-600">
                    {gitlabPreviewKind === 'spec'
                      ? "Documentation générée par l'IA à partir du JXML seul (aperçu, sans comparaison Word)"
                      : 'JXML envoyé au modèle (Include résolus, includes/traductions/Java non affichés ici)'}
                  </span>
                  <button
                    type="button"
                    className="text-gl-blue hover:text-gl-blue-dark hover:underline"
                    onClick={onCloseGitlabPreview}
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
                    {gitlabPreviewKind === 'jxml' && (
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
                    )}
                    <div className="overflow-auto p-3 flex-1">
                      {gitlabPreviewKind === 'jxml' && previewViewMode === 'tree' ? (
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
                    onClick={onSelectAllGitlabPaths}
                  >
                    Tout cocher
                  </button>
                  <button
                    type="button"
                    className="text-gl-blue hover:text-gl-blue-dark hover:underline"
                    onClick={onClearGitlabPaths}
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
                        onChange={() => onToggleGitlabPath(path)}
                      />
                      <span className="font-mono text-[13px] break-all">{path}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default CodePanel
