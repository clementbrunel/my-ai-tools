import { useState } from 'react';
import type { Race } from '@/types';
import { formatDate } from '@/utils/dates';

interface RaceSyncPanelProps {
  races: Race[];
  selectedRaceId: number | null;
  selectedRace: Race | undefined;
  /** Full detail of the selected race (qualifying grid, results) — only `getRace(id)` carries
   *  it, the list endpoint that fills `races` doesn't, so this backs the status chips. */
  raceDetail: Race | null;
  onSelectRace: (raceId: number) => void;
  isSyncing: boolean;
  onSync: () => void;
  isResyncingGrid: boolean;
  onResyncQualifying: () => void;
  isResyncingResults: boolean;
  onResyncResults: () => void;
  onDeleteRace: () => void;
  notifyByEmail: boolean;
  onNotifyByEmailChange: (checked: boolean) => void;
}

/**
 * Race picker + the jolpica sync/resync/delete admin actions for one race, plus at-a-glance
 * status chips (grid imported? results settled?) so the admin doesn't have to guess which of
 * the force-resync buttons applies. Those are corrections, not the routine flow (pick a race,
 * hit the jolpica sync, done) — tucked under "Actions avancées" so they don't crowd it.
 *
 * Render with `key={selectedRaceId}` from the parent: switching races should reset the
 * "advanced" disclosure, and remounting is simpler than lifting yet another piece of state.
 */
const RaceSyncPanel: React.FC<RaceSyncPanelProps> = ({
  races, selectedRaceId, selectedRace, raceDetail, onSelectRace,
  isSyncing, onSync, isResyncingGrid, onResyncQualifying,
  isResyncingResults, onResyncResults, onDeleteRace,
  notifyByEmail, onNotifyByEmailChange,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const qualifyingPassed = selectedRace ? new Date(selectedRace.qualifyingDate) <= new Date() : false;
  const qualifsImported = (raceDetail?.qualifyingResults?.length ?? 0) > 0;
  const racePassed = selectedRace ? new Date(selectedRace.raceDate) <= new Date() : false;
  const resultsSettled = selectedRace?.status === 'FINISHED';

  return (
    <div className="card space-y-3">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
        <select
          className="input-field w-full sm:!w-auto"
          value={selectedRaceId ?? ''}
          onChange={(e) => onSelectRace(Number(e.target.value))}
        >
          {races.map((race) => (
            <option key={race.id} value={race.id}>
              R{race.round} · {race.name} — {formatDate(race.raceDate)}
              {race.status === 'FINISHED' ? ' ✓' : ''}
            </option>
          ))}
        </select>
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="btn-gold w-full sm:w-auto sm:ml-auto"
          title="Action de routine après un GP : importe calendrier, grille et résultats depuis jolpica-f1 pour toute la saison, et règle les paris des courses qui viennent de se terminer"
        >
          {isSyncing ? 'Import en cours…' : '🔄 Importer les résultats (jolpica)'}
        </button>
      </div>

      {selectedRace && (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-xs font-bold px-2 py-1 rounded-full ${
              qualifsImported
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                : qualifyingPassed
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            ⏱ Grille qualifs {qualifsImported ? 'importée ✓' : qualifyingPassed ? 'pas encore importée' : 'à venir'}
          </span>
          <span
            className={`text-xs font-bold px-2 py-1 rounded-full ${
              resultsSettled
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                : racePassed
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
            title={resultsSettled ? 'Réenregistrer ou resynchroniser recalcule les points' : undefined}
          >
            🏁 Résultats {resultsSettled ? 'réglés ✓' : racePassed ? 'pas encore importés' : 'à venir'}
          </span>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="ml-auto text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline decoration-dotted underline-offset-2"
          >
            {showAdvanced ? 'Masquer les actions avancées ▴' : 'Actions avancées ▾'}
          </button>
        </div>
      )}

      {showAdvanced && selectedRace && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onResyncQualifying}
            disabled={isResyncingGrid}
            className="btn-secondary w-full sm:w-auto"
            title="Force le re-import de la grille de qualifs de cette course depuis jolpica, même si elle est déjà terminée (utile après une pénalité sur grille confirmée après coup)"
          >
            {isResyncingGrid ? 'Import…' : '⏱ Resync grille qualifs'}
          </button>
          <button
            onClick={onResyncResults}
            disabled={isResyncingResults}
            className="btn-secondary w-full sm:w-auto"
            title="Force le re-import du classement de cette course depuis jolpica et re-règle les paris, même si elle est déjà terminée (utile après une pénalité post-course confirmée après coup)"
          >
            {isResyncingResults ? 'Import…' : '🏁 Resync résultats course'}
          </button>
          {resultsSettled && (
            <label
              className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap"
              title="Un recalcul (réenregistrement ou resync résultats) ne prévient plus les joueurs par email par défaut, pour éviter de les spammer — coche pour renvoyer l'email du jour (gage/récap) malgré tout"
            >
              <input
                type="checkbox"
                checked={notifyByEmail}
                onChange={(e) => onNotifyByEmailChange(e.target.checked)}
                className="accent-wc-green w-4 h-4"
              />
              Prévenir les joueurs par email
            </label>
          )}
          <button
            onClick={onDeleteRace}
            className="btn-secondary w-full sm:w-auto text-red-600 dark:text-red-400 sm:ml-auto"
            title="Supprime la course sélectionnée — refusé si des pronostics existent déjà dessus (l'avoir juste ouverte aux paris n'empêche pas la suppression)"
          >
            🗑 Supprimer la course
          </button>
        </div>
      )}
    </div>
  );
};

export default RaceSyncPanel;
