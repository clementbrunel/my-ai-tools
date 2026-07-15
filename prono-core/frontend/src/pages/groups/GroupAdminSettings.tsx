import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getGroupPendingForfeits, getGroupForfeits,
  approveGroupForfeit, deleteGroupForfeit,
} from '../../api/forfeits';
import {
  updateGroupPrivacy, updateGroupSports,
  getFutureOpenMatches, notifyNewMatches,
  getFutureOpenRaces, notifyNewRaces,
} from '../../api/groups';
import DailyGagePanel from '../../components/DailyGagePanel';
import ConfirmModal from '../../components/ConfirmModal';
import PillTabs from '../../components/PillTabs';
import type { Group, Forfeit, Match, Race, Sport } from '../../types';
import { formatDate } from '../../utils/dates';
import { useGroupAdminCounts } from '../../context/GroupAdminCountsContext';

type AdminSection = 'forfeits' | 'daily-gages' | 'notify-matches';

interface Props {
  group: Group;
  onGroupUpdate: (updated: Group) => void;
}

const GroupAdminSettings: React.FC<Props> = ({ group, onGroupUpdate }) => {
  const { pendingForfeitsPerGroup, missingGagesPerGroup, groupsWithNoBets, matchesWithoutBetsPerGroup, refresh: refreshCounts } = useGroupAdminCounts();

  const groupSports = group.sports ?? ['FOOT'];

  const [openSection, setOpenSection] = useState<AdminSection | null>(null);
  const [pendingForfeits, setPendingForfeits] = useState<Forfeit[] | null>(null);
  const [activeForfeits, setActiveForfeits] = useState<Forfeit[]>([]);
  const [notifySport, setNotifySport] = useState<Sport>(groupSports[0] ?? 'FOOT');
  const [futureOpenMatches, setFutureOpenMatches] = useState<Match[] | null>(null);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(new Set());
  const [futureOpenRaces, setFutureOpenRaces] = useState<Race[] | null>(null);
  const [selectedRaceIds, setSelectedRaceIds] = useState<Set<number>>(new Set());
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  } | null>(null);

  const pendingForfeitsBadge = pendingForfeits !== null
    ? pendingForfeits.length
    : (pendingForfeitsPerGroup[group.id] ?? 0);
  const missingGagesBadge = missingGagesPerGroup[group.id] ?? 0;

  const loadForfeits = async () => {
    try {
      const [pending, active] = await Promise.all([
        getGroupPendingForfeits(group.id),
        getGroupForfeits(group.id),
      ]);
      setPendingForfeits(pending);
      setActiveForfeits(active);
    } catch {
      setPendingForfeits([]);
    }
  };

  const loadFutureOpenBets = async (sport: Sport) => {
    setNotifyMessage(null);
    if (sport === 'FOOT') {
      try {
        const matches = await getFutureOpenMatches(group.id);
        setFutureOpenMatches(matches);
        setSelectedMatchIds(new Set());
      } catch {
        setFutureOpenMatches([]);
      }
    } else {
      try {
        const races = await getFutureOpenRaces(group.id);
        setFutureOpenRaces(races);
        setSelectedRaceIds(new Set());
      } catch {
        setFutureOpenRaces([]);
      }
    }
  };

  const handleToggleSection = async (section: AdminSection) => {
    const next = openSection === section ? null : section;
    setOpenSection(next);
    if (next === 'forfeits') await loadForfeits();
    if (next === 'notify-matches') await loadFutureOpenBets(notifySport);
  };

  const handleSwitchNotifySport = async (sport: Sport) => {
    setNotifySport(sport);
    if (openSection === 'notify-matches') await loadFutureOpenBets(sport);
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
        await notifyNewMatches(group.id, Array.from(selectedMatchIds));
        setSelectedMatchIds(new Set());
      } else {
        await notifyNewRaces(group.id, Array.from(selectedRaceIds));
        setSelectedRaceIds(new Set());
      }
      setNotifyMessage({ type: 'success', text: 'Les membres du groupe ont été notifiés par email !' });
    } catch {
      setNotifyMessage({ type: 'error', text: "Erreur lors de l'envoi de la notification." });
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleTogglePrivacy = async () => {
    try {
      const updated = await updateGroupPrivacy(group.id, !group.isPrivate);
      onGroupUpdate(updated);
    } catch {
      // Silently fail — privacy toggle is non-critical
    }
  };

  const handleToggleSport = async (sport: Sport) => {
    const current = group.sports ?? ['FOOT'];
    const next = current.includes(sport)
      ? current.filter((s) => s !== sport)
      : [...current, sport];
    if (next.length === 0) return; // at least one sport
    try {
      const updated = await updateGroupSports(group.id, next);
      onGroupUpdate(updated);
    } catch {
      // Silent
    }
  };

  const handleApproveForfeits = async (forfeitId: number) => {
    try {
      const approved = await approveGroupForfeit(group.id, forfeitId);
      setPendingForfeits((prev) => (prev ?? []).filter((f) => f.id !== forfeitId));
      setActiveForfeits((prev) => [...prev, approved]);
      refreshCounts();
    } catch {
      // Silent
    }
  };

  const handleRejectGroupForfeit = (forfeitId: number) => {
    setConfirmDialog({
      title: 'Refuser ce gage',
      message: 'Refuser définitivement ce gage proposé ?',
      confirmLabel: 'Refuser',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteGroupForfeit(group.id, forfeitId);
          setPendingForfeits((prev) => (prev ?? []).filter((f) => f.id !== forfeitId));
          refreshCounts();
        } catch {
          // Silent
        }
      },
    });
  };

  const handleDeleteGroupForfeit = (forfeitId: number) => {
    setConfirmDialog({
      title: 'Supprimer ce gage',
      message: 'Supprimer ce gage du groupe ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteGroupForfeit(group.id, forfeitId);
          setActiveForfeits((prev) => prev.filter((f) => f.id !== forfeitId));
        } catch {
          // Silent
        }
      },
    });
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/40 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
        Paramètres admin
      </p>

      {/* Privacy toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Groupe privé</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {group.isPrivate
              ? 'Invisible dans la liste publique, accès par code uniquement'
              : 'Visible dans la liste — les utilisateurs peuvent postuler'}
          </p>
        </div>
        <button
          onClick={handleTogglePrivacy}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            group.isPrivate ? 'bg-wc-green' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              group.isPrivate ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Sports toggles */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Sports du groupe</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Détermine les paris qui peuvent être ouverts dans ce groupe
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ['FOOT', '⚽'],
              ['F1', '🏎'],
            ] as [Sport, string][]
          ).map(([sport, icon]) => {
            const active = (group.sports ?? ['FOOT']).includes(sport);
            return (
              <button
                key={sport}
                onClick={() => handleToggleSport(sport)}
                className={`px-2.5 py-1 rounded-lg text-sm font-bold border transition-colors ${
                  active
                    ? 'bg-wc-green/10 border-wc-green text-wc-green'
                    : 'border-gray-300 dark:border-gray-600 text-gray-400 opacity-60'
                }`}
                title={active ? `Désactiver ${sport}` : `Activer ${sport}`}
              >
                {icon} {sport === 'FOOT' ? 'Foot' : 'F1'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Forfeits section button */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-yellow-800 dark:text-yellow-300 font-semibold">
          Configurez les gages customisés de votre groupe.
        </p>
        <button
          onClick={() => handleToggleSection('forfeits')}
          className={`relative text-xs px-3 py-1.5 rounded-lg font-medium transition-colors inline-flex items-center gap-1.5 shrink-0 ${
            openSection === 'forfeits'
              ? 'bg-yellow-500 text-white'
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200'
          }`}
        >
          🃏 Gages du groupe
          {pendingForfeitsBadge > 0 && (
            <span className="inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 px-1">
              {pendingForfeitsBadge}
            </span>
          )}
        </button>
      </div>

      {/* Workflow guide */}
      <div className="text-xs text-yellow-800 dark:text-yellow-300 pt-1 space-y-2 border-t border-yellow-200 dark:border-yellow-800/40">
        <p className="font-semibold pt-1">Configuration des paris de votre groupe</p>
        {(group.sports ?? ['FOOT']).includes('FOOT') && (
          <div className="flex items-center justify-between gap-3">
            <p>1. <span className="font-semibold">⚽ Foot</span> — Ouvrez les matchs aux paris pour la journée.</p>
            <Link to="/foot/open-betting" className="relative btn-primary text-xs whitespace-nowrap inline-flex items-center gap-1.5 shrink-0">
              🎲 Ouvrir aux paris
              {(matchesWithoutBetsPerGroup[group.id] ?? 0) > 0 && (
                <span className="inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 px-1">
                  {matchesWithoutBetsPerGroup[group.id]}
                </span>
              )}
            </Link>
          </div>
        )}
        {(group.sports ?? []).includes('F1') && (
          <div className="flex items-center justify-between gap-3">
            <p>1bis. <span className="font-semibold">🏎 F1</span> — Ouvrez les Grands Prix aux pronos.</p>
            <Link to="/f1/open-betting" className="btn-primary text-xs whitespace-nowrap inline-flex items-center gap-1.5 shrink-0">
              🏎 Ouvrir les GP
            </Link>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <p>2. Pimentez la partie en ajoutant un gage au plus mauvais parieur 🌶️</p>
          <button
            onClick={() => handleToggleSection('daily-gages')}
            className={`relative text-xs px-3 py-1.5 rounded-lg font-medium transition-colors inline-flex items-center gap-1.5 shrink-0 ${
              openSection === 'daily-gages'
                ? 'bg-yellow-500 text-white'
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200'
            }`}
          >
            📅 Gages du jour
            {missingGagesBadge > 0 && (
              <span className="inline-flex items-center justify-center bg-orange-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 px-1">
                {missingGagesBadge}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p>3. Prévenez le groupe quand de nouveaux paris sont ouverts 📣</p>
          <button
            onClick={() => handleToggleSection('notify-matches')}
            className={`relative text-xs px-3 py-1.5 rounded-lg font-medium transition-colors inline-flex items-center gap-1.5 shrink-0 ${
              openSection === 'notify-matches'
                ? 'bg-yellow-500 text-white'
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200'
            }`}
          >
            📣 Prévenir de nouveaux paris
          </button>
        </div>
      </div>

      {/* Forfeits panel */}
      {openSection === 'forfeits' && (
        <div className="space-y-4 pt-3 border-t border-yellow-200 dark:border-yellow-800/40">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              ⏳ Gages proposés en attente ({(pendingForfeits ?? []).length})
            </h3>
            {(pendingForfeits ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucun gage en attente de validation.</p>
            ) : (
              <div className="space-y-2">
                {(pendingForfeits ?? []).map((f) => (
                  <div
                    key={f.id}
                    className="flex items-start justify-between bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{f.title}</p>
                      {f.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{f.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {f.category} · proposé par{' '}
                        <span className="font-medium">{f.proposedByDisplayName || f.proposedByUsername || '—'}</span>
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleApproveForfeits(f.id)}
                        className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded hover:bg-green-200 transition-colors"
                      >
                        ✓ Valider
                      </button>
                      <button
                        onClick={() => handleRejectGroupForfeit(f.id)}
                        className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded hover:bg-red-200 transition-colors"
                      >
                        ✕ Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              ✅ Gages actifs du groupe ({activeForfeits.length})
            </h3>
            {activeForfeits.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucun gage actif dans ce groupe.</p>
            ) : (
              <div className="space-y-2">
                {activeForfeits.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-start justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{f.title}</p>
                      {f.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{f.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {f.category}
                        {f.proposedByUsername && (
                          <> · proposé par <span className="font-medium">{f.proposedByDisplayName || f.proposedByUsername}</span></>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteGroupForfeit(f.id)}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily gages panel */}
      {openSection === 'daily-gages' && (
        <div className="space-y-2 pt-3 border-t border-yellow-200 dark:border-yellow-800/40">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">📅 Gages du jour</h3>
          <DailyGagePanel groupId={group.id} />
        </div>
      )}

      {/* Notify new bets panel */}
      {openSection === 'notify-matches' && (() => {
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
      })()}

      <ConfirmModal
        isOpen={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmLabel={confirmDialog?.confirmLabel}
        variant={confirmDialog?.variant}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};

export default GroupAdminSettings;
