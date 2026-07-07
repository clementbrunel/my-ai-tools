const F1Races: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title mb-0">🏁 Courses F1</h1>
        <span className="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          🚧 WIP
        </span>
      </div>

      <div className="card text-center py-16 space-y-4">
        <div className="text-7xl">🏎</div>
        <p className="text-xl font-bold text-gray-700 dark:text-gray-200">Grands Prix à venir</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Cette page listera les Grands Prix de la saison F1 et permettra de saisir vos pronostics
          (pole position, podium, vainqueur, fastest lap…).
        </p>
      </div>
    </div>
  );
};

export default F1Races;
