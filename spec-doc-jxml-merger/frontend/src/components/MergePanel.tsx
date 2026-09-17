function MergePanel() {
  return (
    <section className="card p-4 overflow-auto min-h-0 flex flex-col items-center justify-center text-center gap-2">
      <h2 className="field-label">Fusion</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        La comparaison et la fusion Word ⇄ JXML arrivent bientôt. En attendant, génère la doc dans
        chacun des panneaux Input/Output à gauche et à droite.
      </p>
    </section>
  )
}

export default MergePanel
