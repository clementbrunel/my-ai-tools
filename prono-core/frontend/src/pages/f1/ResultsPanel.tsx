import { useEffect, useState } from 'react';
import type { Race } from '@/types';
import MiniF1Car from '@/components/f1/MiniF1Car';

type ResultsTab = 'qualifs' | 'course';

interface Props {
  race: Race;
}

/** Qualifs / Course results, tabbed — a self-contained read-only view of `race`. */
const ResultsPanel: React.FC<Props> = ({ race }) => {
  const hasQualifs = !!race.qualifyingResults && race.qualifyingResults.length > 0;
  const hasRaceResults = !!race.results && race.results.length > 0;

  const [resultsTab, setResultsTab] = useState<ResultsTab>(hasRaceResults ? 'course' : 'qualifs');

  // Default the tab to the race classification once it exists, otherwise fall
  // back to qualifs — but only on navigation to a new race, never overriding
  // a tab the user picked themselves on a background refresh.
  useEffect(() => {
    setResultsTab(hasRaceResults ? 'course' : 'qualifs');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.id]);

  if (!hasQualifs && !hasRaceResults) return null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900 dark:text-white">Résultats</h2>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shrink-0">
          <button
            type="button"
            onClick={() => setResultsTab('qualifs')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
              resultsTab === 'qualifs'
                ? 'bg-white dark:bg-gray-600 shadow text-wc-green'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Qualifs
          </button>
          <button
            type="button"
            onClick={() => setResultsTab('course')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
              resultsTab === 'course'
                ? 'bg-white dark:bg-gray-600 shadow text-wc-green'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Course
          </button>
        </div>
      </div>

      {resultsTab === 'qualifs' ? (
        hasQualifs ? (
          <>
            <p className="text-xs text-gray-400">
              Résultat des qualifs — de quoi ajuster ton prono avant le départ (le podium reste modifiable jusqu'au départ).
            </p>
            <div className="flex gap-3 overflow-x-auto pt-2 pb-1 -mx-4 px-4">
              {race.qualifyingResults!.map((r, i) => (
                <div
                  key={r.driver.id}
                  className={`flex flex-col items-center shrink-0 w-12 ${i % 2 === 1 ? 'mt-3' : ''}`}
                >
                  <div className="relative w-9 h-9 flex items-center justify-center">
                    <div className="-rotate-90">
                      <MiniF1Car color={r.driver.constructorColor} size={36} />
                    </div>
                    {r.position === 1 && (
                      <span className="absolute -top-1 right-0 text-xs" title="Pole position">⏱</span>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 leading-tight">
                    P{r.position}
                  </span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
                    {r.driver.code}
                  </span>
                  {r.time && (
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 tabular-nums leading-tight whitespace-nowrap">
                      {r.time}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
            <div className="text-2xl animate-spin">⏳</div>
            <p className="mt-1">En attente des résultats des qualifs…</p>
          </div>
        )
      ) : hasRaceResults ? (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {race.results!.map((r) => (
            <div key={r.driver.id} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="w-8 text-right font-black text-gray-400">
                {r.position ?? 'NC'}
              </span>
              <span className="w-1.5 h-5 rounded" style={{ backgroundColor: r.driver.constructorColor }} />
              <span className="font-bold text-gray-900 dark:text-white flex-1">
                {r.driver.name}
                <span className="text-gray-400 font-medium text-xs ml-2">{r.driver.constructorName}</span>
              </span>
              {r.time && (
                <span
                  className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap"
                  title={r.position === 1 ? 'Temps total' : 'Écart au vainqueur'}
                >
                  {r.time}
                </span>
              )}
              <span className="flex gap-1 text-xs items-center">
                {r.sprintPosition != null && (
                  <span className="text-purple-500 font-bold" title={`Sprint : P${r.sprintPosition}`}>
                    S{r.sprintPosition}
                  </span>
                )}
                {r.pole && <span title="Pole position">⏱</span>}
                {r.fastestLap && <span title="Meilleur tour">🟣</span>}
                {r.dnf && <span className="text-gray-400" title="Abandon">DNF</span>}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
          <div className="text-2xl animate-spin">⏳</div>
          <p className="mt-1">En attente des résultats de la course…</p>
        </div>
      )}
    </div>
  );
};

export default ResultsPanel;
