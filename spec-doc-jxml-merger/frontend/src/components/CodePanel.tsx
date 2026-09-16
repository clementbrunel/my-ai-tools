import type { GitLabEntryPoint, GitLabProjectSummary, JxmlMode } from '../types'

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
  gitlabPreviewOpen: boolean
  gitlabPreviewContent: string
  gitlabPreviewLoading: boolean
  onCloseGitlabPreview: () => void
  gitlabSourcePaths: string[]
  gitlabSelectedPaths: Set<string>
  onToggleGitlabPath: (path: string) => void
  onSelectAllGitlabPaths: () => void
  onClearGitlabPaths: () => void
  gitlabSourcesLoading: boolean
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
  gitlabPreviewOpen,
  gitlabPreviewContent,
  gitlabPreviewLoading,
  onCloseGitlabPreview,
  gitlabSourcePaths,
  gitlabSelectedPaths,
  onToggleGitlabPath,
  onSelectAllGitlabPaths,
  onClearGitlabPaths,
  gitlabSourcesLoading,
}: CodePanelProps) {
  const gitlabSearchTerm = gitlabSearch.trim().toLowerCase()
  const filteredGitlabProjects = gitlabSearchTerm
    ? gitlabProjects.filter((p) =>
        `${p.groupKey} ${p.pathWithNamespace} ${p.name}`.toLowerCase().includes(gitlabSearchTerm),
      )
    : gitlabProjects

  return (
    <section className="card p-4 overflow-auto">
      <h2 className="field-label mb-3">Spec JXML</h2>
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
            <button
              type="button"
              className="btn-secondary self-start"
              onClick={onPreviewGitlabJxml}
              disabled={gitlabPreviewLoading}
            >
              {gitlabPreviewLoading ? 'Génération de la prévisualisation…' : 'Prévisualiser le JXML résolu'}
            </button>
          )}
          {gitlabPreviewOpen && (
            <div className="border border-[#dcdcde] rounded">
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[#dcdcde] bg-[#fafafa] text-sm">
                <span className="text-gray-600">
                  JXML envoyé au modèle (Include résolus, includes/traductions/Java non affichés ici)
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
                <p className="text-sm text-gray-500 p-2">Chargement…</p>
              ) : (
                <pre className="max-h-96 overflow-auto text-[12px] p-2 whitespace-pre-wrap break-all">
                  {gitlabPreviewContent}
                </pre>
              )}
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
