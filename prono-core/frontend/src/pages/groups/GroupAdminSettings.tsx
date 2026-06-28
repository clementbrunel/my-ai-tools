import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getGroupPendingForfeits, getGroupForfeits,
  approveGroupForfeit, deleteGroupForfeit,
} from '../../api/forfeits';
import { updateGroupPrivacy } from '../../api/groups';
import DailyGagePanel from '../../components/DailyGagePanel';
import ConfirmModal from '../../components/ConfirmModal';
import type { Group, Forfeit } from '../../types';
import { useGroupAdminCounts } from '../../context/GroupAdminCountsContext';

type AdminSection = 'forfeits' | 'daily-gages';

interface Props {
  group: Group;
  onGroupUpdate: (updated: Group) => void;
}

const GroupAdminSettings: React.FC<Props> = ({ group, onGroupUpdate }) => {
  const { pendingForfeitsPerGroup, missingGagesPerGroup, groupsWithNoBets, matchesWithoutBetsPerGroup, refresh: refreshCounts } = useGroupAdminCounts();

  const [openSection, setOpenSection] = useState<AdminSection | null>(null);
  const [pendingForfeits, setPendingForfeits] = useState<Forfeit[] | null>(null);
  const [activeForfeits, setActiveForfeits] = useState<Forfeit[]>([]);
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

  const handleToggleSection = async (section: AdminSection) => {
    const next = openSection === section ? null : section;
    setOpenSection(next);
    if (next === 'forfeits') await loadForfeits();
  };

  const handleTogglePrivacy = async () => {
    try {
      const updated = await updateGroupPrivacy(group.id, !group.isPrivate);
      onGroupUpdate(updated);
    } catch {
      // Silently fail — privacy toggle is non-critical
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
        <div className="flex items-center justify-between gap-3">
          <p>1. Ouvrez les matchs aux paris pour la journée.</p>
          <Link to="/open-betting" className="relative btn-primary text-xs whitespace-nowrap inline-flex items-center gap-1.5 shrink-0">
            🎲 Ouvrir aux paris
            {(matchesWithoutBetsPerGroup[group.id] ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 px-1">
                {matchesWithoutBetsPerGroup[group.id]}
              </span>
            )}
          </Link>
        </div>
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
