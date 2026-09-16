interface HeaderProps {
  title: string
  onTitleChange: (value: string) => void
  onAnalyze: () => void
  loading: boolean
  hasSession: boolean
  onSave: () => void
  onDownload: () => void
  onGenerateSpec: () => void
  canGenerateSpec: boolean
  specGenerating: boolean
  generateSpecTitle?: string
}

function Header({
  title,
  onTitleChange,
  onAnalyze,
  loading,
  hasSession,
  onSave,
  onDownload,
  onGenerateSpec,
  canGenerateSpec,
  specGenerating,
  generateSpecTitle,
}: HeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-gl-dark shadow-sm">
      <div className="flex items-center gap-2 shrink-0">
        <span className="h-6 w-6 rounded-sm bg-gradient-to-br from-gl-orange to-gl-orange-dark" />
        <span className="text-white font-semibold text-sm hidden sm:inline">Spec Doc/JXML Merger</span>
      </div>
      <input
        placeholder="Titre de la spécification"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="flex-1 min-w-0 rounded border border-transparent bg-white/95 px-3 py-1.5 text-sm text-[#303030] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gl-orange"
      />
      <button
        className="btn-secondary"
        onClick={onGenerateSpec}
        disabled={!canGenerateSpec || specGenerating}
        title={generateSpecTitle}
      >
        {specGenerating ? 'Génération…' : 'Générer la doc'}
      </button>
      <button className="btn-primary" onClick={onAnalyze} disabled={loading}>
        {loading ? 'Analyse en cours…' : 'Analyser'}
      </button>
      {hasSession && (
        <>
          <button className="btn-secondary" onClick={onSave} disabled={loading}>
            Enregistrer l'édition
          </button>
          <button className="btn-secondary" onClick={onDownload}>
            Télécharger le markdown
          </button>
        </>
      )}
    </header>
  )
}

export default Header
