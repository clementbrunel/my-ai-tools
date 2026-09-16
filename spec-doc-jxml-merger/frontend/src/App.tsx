import { useState } from 'react'
import { createAnalysis, getAnalysis, listGitlabProjects, listVersions, restoreVersion, saveVersion } from './api/analysis'
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

  return (
    <div className="app">
      <header className="toolbar">
        <input
          placeholder="Titre de la spécification"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button onClick={handleAnalyze} disabled={loading}>
          {loading ? 'Analyse en cours…' : 'Analyser'}
        </button>
        {session && (
          <>
            <button onClick={handleSave} disabled={loading}>
              Enregistrer l'édition
            </button>
            <button onClick={handleDownload}>Télécharger le markdown</button>
          </>
        )}
      </header>

      {error && <div className="error">{error}</div>}

      <div className="panes">
        <section className="pane pane-word">
          <h2>Spec Word (optionnel)</h2>
          <input type="file" accept=".docx" onChange={(e) => setWordFile(e.target.files?.[0] ?? null)} />
          {wordFile && <p className="filename">{wordFile.name}</p>}
        </section>

        <section className="pane pane-markdown">
          <h2>Markdown de fusion</h2>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Le markdown de fusion apparaîtra ici après analyse."
          />
          {versions.length > 0 && (
            <div className="versions">
              <h3>Historique</h3>
              <ul>
                {versions.map((v) => (
                  <li key={v.id}>
                    v{v.versionNumber} — {v.source} — {new Date(v.createdAt).toLocaleString('fr-FR')}{' '}
                    <button onClick={() => handleRestore(v.id)}>Restaurer</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="pane pane-jxml">
          <h2>Spec JXML</h2>
          <div className="jxml-mode-toggle">
            <label>
              <input type="radio" checked={jxmlMode === 'zip'} onChange={() => setJxmlMode('zip')} />
              Archive .zip
            </label>
            <label>
              <input type="radio" checked={jxmlMode === 'text'} onChange={() => setJxmlMode('text')} />
              Coller le texte
            </label>
            <label>
              <input type="radio" checked={jxmlMode === 'gitlab'} onChange={() => setJxmlMode('gitlab')} />
              Projet GitLab
            </label>
          </div>
          {jxmlMode === 'zip' && (
            <>
              <input type="file" accept=".zip" onChange={(e) => setJxmlFile(e.target.files?.[0] ?? null)} />
              {jxmlFile && <p className="filename">{jxmlFile.name}</p>}
            </>
          )}
          {jxmlMode === 'text' && (
            <textarea
              value={jxmlText}
              onChange={(e) => setJxmlText(e.target.value)}
              placeholder="Colle ici le contenu JXML"
            />
          )}
          {jxmlMode === 'gitlab' && (
            <div className="gitlab-picker">
              <button type="button" onClick={handleLoadGitlabProjects} disabled={gitlabLoading}>
                {gitlabLoading ? 'Chargement…' : 'Charger les projets GitLab'}
              </button>
              {gitlabProjects.length > 0 && (
                <select value={gitlabProjectId} onChange={(e) => setGitlabProjectId(e.target.value)}>
                  <option value="">— Choisir un projet —</option>
                  {gitlabProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.groupKey}] {p.pathWithNamespace}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </section>
      </div>

      {session && session.divergences.length > 0 && (
        <section className="divergences">
          <h2>Divergences détectées ({session.divergences.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Word</th>
                <th>JXML</th>
                <th>Proposition IA</th>
              </tr>
            </thead>
            <tbody>
              {session.divergences.map((d) => (
                <tr key={d.id}>
                  <td>{d.sectionRef}</td>
                  <td>{d.wordExcerpt ?? '—'}</td>
                  <td>{d.jxmlExcerpt ?? '—'}</td>
                  <td>{d.aiProposal ?? '—'}</td>
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
