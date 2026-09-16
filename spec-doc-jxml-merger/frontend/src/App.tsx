import { useState } from 'react'
import {
  createAnalysis,
  getAnalysis,
  listGitlabProjects,
  listGitlabSources,
  listVersions,
  restoreVersion,
  saveVersion,
} from './api/analysis'
import type { AnalysisSessionResponse, DocumentVersion, GitLabProjectSummary } from './types'

type JxmlMode = 'zip' | 'text' | 'gitlab'

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
  const [gitlabSourcePaths, setGitlabSourcePaths] = useState<string[]>([])
  const [gitlabSelectedPaths, setGitlabSelectedPaths] = useState<Set<string>>(new Set())
  const [gitlabSourcesLoading, setGitlabSourcesLoading] = useState(false)
  const [session, setSession] = useState<AnalysisSessionResponse | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    const hasJxml =
      jxmlMode === 'zip' ? !!jxmlFile : jxmlMode === 'text' ? !!jxmlText.trim() : !!gitlabProjectId
    if (!wordFile && !hasJxml) {
      setError('Fournis au moins une source : Word (.docx) ou JXML.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const selectedGitlabProject = gitlabProjects.find((p) => String(p.id) === gitlabProjectId)
      const result = await createAnalysis({
        title: title || undefined,
        word: wordFile ?? undefined,
        jxmlArchive: jxmlMode === 'zip' ? (jxmlFile ?? undefined) : undefined,
        jxmlText: jxmlMode === 'text' ? jxmlText : undefined,
        gitlabGroupKey: jxmlMode === 'gitlab' ? selectedGitlabProject?.groupKey : undefined,
        gitlabProjectId: jxmlMode === 'gitlab' ? gitlabProjectId : undefined,
        gitlabSelectedPaths: jxmlMode === 'gitlab' ? Array.from(gitlabSelectedPaths) : undefined,
      })
      setSession(result)
      setMarkdown(result.markdown)
      setVersions(await listVersions(result.id))
    } catch (e) {
      setError("Échec de l'analyse — voir la console.")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleLoadGitlabProjects() {
    setError(null)
    setGitlabLoading(true)
    try {
      setGitlabProjects(await listGitlabProjects())
    } catch (e) {
      setError('Échec du chargement des projets GitLab — voir la console.')
      console.error(e)
    } finally {
      setGitlabLoading(false)
    }
  }

  async function handleSelectGitlabProject(projectId: string) {
    setGitlabProjectId(projectId)
    setGitlabSourcePaths([])
    setGitlabSelectedPaths(new Set())
    if (!projectId) return

    const project = gitlabProjects.find((p) => String(p.id) === projectId)
    if (!project) return

    setError(null)
    setGitlabSourcesLoading(true)
    try {
      const paths = await listGitlabSources(project.groupKey, projectId)
      setGitlabSourcePaths(paths)
      setGitlabSelectedPaths(new Set(paths))
    } catch (e) {
      setError('Échec du chargement des fichiers du projet — voir la console.')
      console.error(e)
    } finally {
      setGitlabSourcesLoading(false)
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

  async function handleSave() {
    if (!session) return
    setLoading(true)
    try {
      await saveVersion(session.id, markdown)
      setVersions(await listVersions(session.id))
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(versionId: string) {
    if (!session) return
    setLoading(true)
    try {
      await restoreVersion(session.id, versionId)
      const refreshed = await getAnalysis(session.id)
      setSession(refreshed)
      setMarkdown(refreshed.markdown)
      setVersions(await listVersions(session.id))
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'spec-fusion'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const gitlabSearchTerm = gitlabSearch.trim().toLowerCase()
  const filteredGitlabProjects = gitlabSearchTerm
    ? gitlabProjects.filter((p) =>
        `${p.groupKey} ${p.pathWithNamespace} ${p.name}`.toLowerCase().includes(gitlabSearchTerm),
      )
    : gitlabProjects

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 bg-gl-dark shadow-sm">
        <div className="flex items-center gap-2 shrink-0">
          <span className="h-6 w-6 rounded-sm bg-gradient-to-br from-gl-orange to-gl-orange-dark" />
          <span className="text-white font-semibold text-sm hidden sm:inline">Spec Doc/JXML Merger</span>
        </div>
        <input
          placeholder="Titre de la spécification"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 min-w-0 rounded border border-transparent bg-white/95 px-3 py-1.5 text-sm text-[#303030] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gl-orange"
        />
        <button className="btn-primary" onClick={handleAnalyze} disabled={loading}>
          {loading ? 'Analyse en cours…' : 'Analyser'}
        </button>
        {session && (
          <>
            <button className="btn-secondary" onClick={handleSave} disabled={loading}>
              Enregistrer l'édition
            </button>
            <button className="btn-secondary" onClick={handleDownload}>
              Télécharger le markdown
            </button>
          </>
        )}
      </header>

      {error && (
        <div className="px-4 py-2 bg-red-50 text-gl-danger text-sm border-b border-red-200">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_1fr] gap-3 p-3 flex-1">
        <section className="card p-4 overflow-auto">
          <h2 className="field-label mb-3">Spec Word (optionnel)</h2>
          <input
            type="file"
            accept=".docx"
            onChange={(e) => setWordFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gl-blue file:text-white file:text-sm hover:file:bg-gl-blue-dark file:cursor-pointer"
          />
          {wordFile && <p className="text-sm text-gray-500 mt-2">{wordFile.name}</p>}
        </section>

        <section className="card p-4 overflow-auto flex flex-col">
          <h2 className="field-label mb-3">Markdown de fusion</h2>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Le markdown de fusion apparaîtra ici après analyse."
            className="w-full min-h-[50vh] flex-1 rounded border border-[#dcdcde] p-2 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-gl-orange"
          />
          {versions.length > 0 && (
            <div className="mt-4">
              <h3 className="field-label mb-2">Historique</h3>
              <ul className="text-sm divide-y divide-[#eee]">
                {versions.map((v) => (
                  <li key={v.id} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-gray-600">
                      v{v.versionNumber} — {v.source} — {new Date(v.createdAt).toLocaleString('fr-FR')}
                    </span>
                    <button
                      onClick={() => handleRestore(v.id)}
                      className="text-gl-blue hover:text-gl-blue-dark hover:underline shrink-0"
                    >
                      Restaurer
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card p-4 overflow-auto">
          <h2 className="field-label mb-3">Spec JXML</h2>
          <div className="flex gap-4 mb-3 border-b border-[#dcdcde] text-sm">
            {(
              [
                ['zip', 'Archive .zip'],
                ['text', 'Coller le texte'],
                ['gitlab', 'Projet GitLab'],
              ] as const
            ).map(([mode, label]) => (
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
                  onChange={() => setJxmlMode(mode)}
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
                onChange={(e) => setJxmlFile(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gl-blue file:text-white file:text-sm hover:file:bg-gl-blue-dark file:cursor-pointer"
              />
              {jxmlFile && <p className="text-sm text-gray-500 mt-2">{jxmlFile.name}</p>}
            </>
          )}
          {jxmlMode === 'text' && (
            <textarea
              value={jxmlText}
              onChange={(e) => setJxmlText(e.target.value)}
              placeholder="Colle ici le contenu JXML"
              className="w-full min-h-[40vh] rounded border border-[#dcdcde] p-2 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-gl-orange"
            />
          )}
          {jxmlMode === 'gitlab' && (
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
          )}
        </section>
      </div>

      {session && session.divergences.length > 0 && (
        <section className="mx-3 mb-3 card p-4 overflow-x-auto">
          <h2 className="field-label mb-3">Divergences détectées ({session.divergences.length})</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#fafafa]">
                <th className="border border-[#dcdcde] px-3 py-2 text-left font-semibold text-[#626168]">Section</th>
                <th className="border border-[#dcdcde] px-3 py-2 text-left font-semibold text-[#626168]">Word</th>
                <th className="border border-[#dcdcde] px-3 py-2 text-left font-semibold text-[#626168]">JXML</th>
                <th className="border border-[#dcdcde] px-3 py-2 text-left font-semibold text-[#626168]">Proposition IA</th>
              </tr>
            </thead>
            <tbody>
              {session.divergences.map((d) => (
                <tr key={d.id} className="hover:bg-[#fafafa]">
                  <td className="border border-[#dcdcde] px-3 py-2 align-top">{d.sectionRef}</td>
                  <td className="border border-[#dcdcde] px-3 py-2 align-top">{d.wordExcerpt ?? '—'}</td>
                  <td className="border border-[#dcdcde] px-3 py-2 align-top">{d.jxmlExcerpt ?? '—'}</td>
                  <td className="border border-[#dcdcde] px-3 py-2 align-top">{d.aiProposal ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

export default App
