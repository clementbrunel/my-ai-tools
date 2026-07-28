import { useState } from 'react';
import { leaveGroup } from '@/api/groups';
import type { Group } from '@/types';
import { useAuth } from '@/context/AuthContext';
import ConfirmModal from '@/components/ConfirmModal';
import GroupAdminSettings from './GroupAdminSettings';
import GroupNameEditor from './GroupNameEditor';
import InviteCodeEditor from './InviteCodeEditor';
import MembersList from './MembersList';
import { logger } from '@/utils/logger';

interface Props {
  group: Group;
  onLeave: (groupId: number) => void;
  onUpdate: (updated: Group) => void;
}

const GroupCard: React.FC<Props> = ({ group, onLeave, onUpdate }) => {
  const { user } = useAuth();
  const isGroupAdmin = group.currentUserRole === 'GROUP_ADMIN';

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  } | null>(null);

  const handleLeave = () => {
    setConfirmDialog({
      title: 'Quitter le groupe',
      message: 'Êtes-vous sûr de vouloir quitter ce groupe ?',
      confirmLabel: 'Quitter',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await leaveGroup(group.id);
          onLeave(group.id);
        } catch (err: unknown) {
          // Leave failed — group stays in list
          logger.error('Failed to leave group', err);
        }
      },
    });
  };

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <GroupNameEditor group={group} isGroupAdmin={isGroupAdmin} onUpdate={onUpdate} />
        <button
          onClick={handleLeave}
          className="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0"
        >
          Quitter
        </button>
      </div>

      {/* Admin settings — behind a "Gérer" button on mobile, inline on desktop */}
      {isGroupAdmin && (
        <>
          {/* Mobile: open drawer */}
          <button
            onClick={() => setShowAdminPanel(true)}
            className="md:hidden w-full flex items-center justify-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/40 rounded-lg py-2.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors"
          >
            ⚙️ Gérer le groupe
          </button>

          {/* Desktop: inline as before */}
          <div className="hidden md:block">
            <GroupAdminSettings group={group} onGroupUpdate={onUpdate} />
          </div>
        </>
      )}

      <MembersList
        group={group}
        isGroupAdmin={isGroupAdmin}
        currentUsername={user?.username}
        onUpdate={onUpdate}
      />

      <InviteCodeEditor group={group} isGroupAdmin={isGroupAdmin} onUpdate={onUpdate} />

      <ConfirmModal
        isOpen={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmLabel={confirmDialog?.confirmLabel}
        variant={confirmDialog?.variant}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />

      {/* Mobile admin drawer */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAdminPanel(false)}
          />
          {/* Sheet slides up from bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <h2 className="font-bold text-gray-900 dark:text-white">⚙️ Gérer — {group.name}</h2>
              <button
                onClick={() => setShowAdminPanel(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none p-1"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-4 pb-6 space-y-4">
              <GroupAdminSettings group={group} onGroupUpdate={onUpdate} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupCard;
