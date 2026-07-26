import { useEffect, useState } from 'react';
import {
  getFutureOpenMatches, notifyNewMatches,
  getFutureOpenRaces, notifyNewRaces,
} from '@/api/groups';
import PillTabs from '@/components/PillTabs';
import type { Match, Race, Sport } from '@/types';
import { formatDate } from '@/utils/dates';

interface Props {
  groupId: number;
  isOpen: boolean;
  groupSports: Sport[];
}

/** Lets a group admin pick upcoming open bets and email the group about them. */
const NotifyMatchesPanel: React.FC<Props> = ({ groupId, isOpen, groupSports }) => {
  const [notifySport, setNotifySport] = useState<Sport>(groupSports[0] ?? 'FOOT');
  const [futureOpenMatches, setFutureOpenMatches] = useState<Match[] | null>(null);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(new Set());
  const [futureOpenRaces, setFutureOpenRaces] = useState<Race[] | null>(null);
  const [selectedRaceIds, setSelectedRaceIds] = useState<Set<number>>(new Set());
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadFutureOpenBets = async (sport: Sport) => {
    setNotifyMessage(null);
    if (sport === 'FOOT') {
      try {
        const matches = await getFutureOpenMatches(groupId);
        setFutureOpenMatches(matches);
        setSelectedMatchIds(new Set());
      } catch {
        setFutureOpenMatches([]);
      }
    } else {
      try {
        const races = await getFutureOpenRaces(groupId);
        setFutureOpenRaces(races);
        setSelectedRaceIds(new Set());
      } catch {
        setFutureOpenRaces([]);
      }
    }
  };

  useEffect(() => {
    if (isOpen) loadFutureOpenBets(notifySport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSwitchNotifySport = async (sport: Sport) => {
    setNotifySport(sport);
    if (isOpen) await loadFutureOpenBets(sport);
  };

  const handleToggleMatchSelection = (matchId: number) => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  const handleToggleRaceSelection = (raceId: number) => {
    setSelectedRaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(raceId)) next.delete(raceId);
      else next.add(raceId);
      return next;
    });
  };

  const handleSendNotify = async () => {
    const selectedIds = notifySport === 'FOOT' ? selectedMatchIds : selectedRaceIds;
    if (selectedIds.size === 0) return;
    setNotifyLoading(true);
    setNotifyMessage(null);
    try {
      if (notifySport === 'FOOT') {
        await notifyNewMatches(groupId, Array.from(selectedMatchIds));
        setSelectedMatchIds(new Set());
      } else {
        await notifyNewRaces(groupId, Array.from(selectedRaceIds));
        setSelectedRaceIds(new Set());
      }
      setNotifyMessage({ type: 'success', text: 'Les membres du groupe ont été notifiés par email !' });
    } catch {
      setNotifyMessage({ type: 'error', text: "Erreur lors de l'envoi de la notification." });
    } finally {
      setNotifyLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedCount = notifySport === 'FOOT' ? selectedMatchIds.size : selectedRaceIds.size;
  const itemLabel = notifySport === 'FOOT' ? 'match' : 'GP';

  return (
    <div className="space-y-3 pt-3 border-t border-yellow-200 dark:border-yellow-800/40">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        📣 Prévenir le groupe de nouveaux paris
      </h3>

      {groupSports.length > 1 && (
        <PillTabs
          options={[
            ['FOOT', '⚽ Foot'],
            ['F1', '🏎 F1'],
          ]}
          value={notifySport}
          onChange={handleSwitchNotifySport}
        />
      )}

      {notifySport === 'FOOT' ? (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sélectionnez les matchs à venir déjà ouverts aux pronostics pour ce groupe :
            un email sera envoyé à tous les membres actifs.
          </p>
          {futureOpenMatches === null ? (
            <p className="text-xs text-gray-400 italic">Chargement...</p>
          ) : futureOpenMatches.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucun match futur ouvert aux pronostics pour ce groupe.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {futureOpenMatches.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMatchIds.has(m.id)}
                    onChange={() => handleToggleMatchSelection(m.id)}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {m.teamA.name} – {m.teamB.name}
                    </p>
                    <p className="text-xs text-gray-400">{m.round} · {formatDate(m.matchDate)}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sélectionnez les Grands Prix à venir déjà ouverts aux pronos pour ce groupe :
            un email sera envoyé à tous les membres actifs.
          </p>
          {futureOpenRaces === null ? (
            <p className="text-xs text-gray-400 italic">Chargement...</p>
          ) : futureOpenRaces.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucun Grand Prix futur ouvert aux pronos pour ce groupe.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {futureOpenRaces.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRaceIds.has(r.id)}
                    onChange={() => handleToggleRaceSelection(r.id)}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {r.name}
                    </p>
                    <p className="text-xs text-gray-400">Manche {r.round} · {formatDate(r.raceDate)}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </>
      )}

      {selectedCount > 0 && (
        <button
          onClick={handleSendNotify}
          disabled={notifyLoading}
          className="btn-primary text-xs w-full disabled:opacity-50"
        >
          {notifyLoading
            ? 'Envoi...'
            : `📤 Notifier les membres (${selectedCount} ${itemLabel}${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''})`}
        </button>
      )}

      {notifyMessage?.type === 'error' && <p className="text-red-500 text-xs">{notifyMessage.text}</p>}
      {notifyMessage?.type === 'success' && <p className="text-green-500 text-xs">✅ {notifyMessage.text}</p>}
    </div>
  );
};

export default NotifyMatchesPanel;
