import { useEffect, useState } from 'react';
import {
  getGroupPendingForfeits, getGroupForfeits,
  approveGroupForfeit, deleteGroupForfeit,
} from '@/api/forfeits';
import ConfirmModal from '@/components/ConfirmModal';
import type { Forfeit } from '@/types';

interface Props {
  groupId: number;
  isOpen: boolean;
  onPendingCountChange: (count: number) => void;
  onForfeitsChanged?: () => void;
}

/** Pending + active forfeits for a group — approve/reject/delete, loaded on open. */
const ForfeitsPanel: React.FC<Props> = ({ groupId, isOpen, onPendingCountChange, onForfeitsChanged }) => {
  const [pendingForfeits, setPendingForfeits] = useState<Forfeit[] | null>(null);
  const [activeForfeits, setActiveForfeits] = useState<Forfeit[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const [pending, active] = await Promise.all([
          getGroupPendingForfeits(groupId),
          getGroupForfeits(groupId),
        ]);
        setPendingForfeits(pending);
        setActiveForfeits(active);
        onPendingCountChange(pending.length);
      } catch {
        setPendingForfeits([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, groupId]);

  const handleApproveForfeits = async (forfeitId: number) => {
    try {
      const approved = await approveGroupForfeit(groupId, forfeitId);
      setPendingForfeits((prev) => {
        const next = (prev ?? []).filter((f) => f.id !== forfeitId);
        onPendingCountChange(next.length);
        return next;
      });
      setActiveForfeits((prev) => [...prev, approved]);
      onForfeitsChanged?.();
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
          await deleteGroupForfeit(groupId, forfeitId);
          setPendingForfeits((prev) => {
            const next = (prev ?? []).filter((f) => f.id !== forfeitId);
            onPendingCountChange(next.length);
            return next;
          });
          onForfeitsChanged?.();
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
          await deleteGroupForfeit(groupId, forfeitId);
          setActiveForfeits((prev) => prev.filter((f) => f.id !== forfeitId));
        } catch {
          // Silent
        }
      },
    });
  };

  if (!isOpen) return null;

  return (
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

export default ForfeitsPanel;
