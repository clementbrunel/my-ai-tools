import { useState } from 'react';
import { Link } from 'react-router-dom';
import { updateGroupGagesEnabled, updateGroupPrivacy, updateGroupSports } from '@/api/groups';
import DailyGagePanel from '@/components/DailyGagePanel';
import ForfeitsPanel from './ForfeitsPanel';
import NotifyMatchesPanel from './NotifyMatchesPanel';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/utils/errors';
import type { Group, Sport } from '@/types';
import { useGroupAdminCounts } from '@/context/GroupAdminCountsContext';

type AdminSection = 'forfeits' | 'daily-gages' | 'notify-matches';

interface Props {
  group: Group;
  onGroupUpdate: (updated: Group) => void;
}

const GroupAdminSettings: React.FC<Props> = ({ group, onGroupUpdate }) => {
  const { pendingForfeitsPerGroup, missingGagesPerGroup, matchesWithoutBetsPerGroup, refresh: refreshCounts } = useGroupAdminCounts();
  const { showToast } = useToast();

  const groupSports = group.sports ?? ['FOOT'];

  const [openSection, setOpenSection] = useState<AdminSection | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const pendingForfeitsBadge = pendingCount ?? (pendingForfeitsPerGroup[group.id] ?? 0);
  const missingGagesBadge = missingGagesPerGroup[group.id] ?? 0;

  const handleToggleSection = (section: AdminSection) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  const handleTogglePrivacy = async () => {
    try {
      const updated = await updateGroupPrivacy(group.id, !group.isPrivate);
      onGroupUpdate(updated);
    } catch (e: unknown) {
      showToast(extractErrorMessage(e, 'Impossible de modifier la confidentialité du groupe'), 'error');
    }
  };

  const handleToggleGagesEnabled = async () => {
    try {
      const updated = await updateGroupGagesEnabled(group.id, !group.gagesEnabled);
      onGroupUpdate(updated);
      if (openSection === 'forfeits' || openSection === 'daily-gages') {
        setOpenSection(null);
      }
    } catch (e: unknown) {
      showToast(extractErrorMessage(e, 'Impossible de modifier les gages du groupe'), 'error');
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
    } catch (e: unknown) {
      showToast(extractErrorMessage(e, 'Impossible de modifier les sports du groupe'), 'error');
    }
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

      {/* Gages toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Gages du groupe</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {group.gagesEnabled
              ? 'Un gage est attribué chaque jour au plus mauvais parieur'
              : "Désactivés — l'email quotidien ne montre plus que les scores"}
          </p>
        </div>
        <button
          onClick={handleToggleGagesEnabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            group.gagesEnabled ? 'bg-wc-green' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              group.gagesEnabled ? 'translate-x-6' : 'translate-x-1'
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
      {group.gagesEnabled && (
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
      )}

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
        {group.gagesEnabled && (
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
        )}
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

      {group.gagesEnabled && (
        <ForfeitsPanel
          groupId={group.id}
          isOpen={openSection === 'forfeits'}
          onPendingCountChange={setPendingCount}
          onForfeitsChanged={refreshCounts}
        />
      )}

      {group.gagesEnabled && openSection === 'daily-gages' && (
        <div className="space-y-2 pt-3 border-t border-yellow-200 dark:border-yellow-800/40">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">📅 Gages du jour</h3>
          <DailyGagePanel groupId={group.id} />
        </div>
      )}

      <NotifyMatchesPanel
        groupId={group.id}
        isOpen={openSection === 'notify-matches'}
        groupSports={groupSports}
      />
    </div>
  );
};

export default GroupAdminSettings;
