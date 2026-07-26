import { useState } from 'react';
import {
  approveApplication, rejectApplication,
  promoteMember, demoteMember, removeMember,
} from '@/api/groups';
import type { Group } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';
import Avatar from '@/components/Avatar';

interface Props {
  group: Group;
  isGroupAdmin: boolean;
  currentUsername?: string;
  onUpdate: (updated: Group) => void;
}

/** Pending applications (admin) and the member list, with promote/demote/remove. */
const MembersList: React.FC<Props> = ({ group, isGroupAdmin, currentUsername, onUpdate }) => {
  const pendingCount = group.pendingApplications?.length ?? 0;

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  } | null>(null);

  const handleApprove = async (userId: number) => {
    try {
      await approveApplication(group.id, userId);
      const approved = group.pendingApplications?.find((a) => a.userId === userId);
      if (!approved) return;
      onUpdate({
        ...group,
        memberCount: group.memberCount + 1,
        members: [...group.members, { ...approved, status: 'ACTIVE' as const }],
        pendingApplications: group.pendingApplications?.filter((a) => a.userId !== userId),
      });
    } catch {
      // Silent
    }
  };

  const handleReject = async (userId: number) => {
    try {
      await rejectApplication(group.id, userId);
      onUpdate({
        ...group,
        pendingApplications: group.pendingApplications?.filter((a) => a.userId !== userId),
      });
    } catch {
      // Silent
    }
  };

  const handlePromote = async (userId: number) => {
    try {
      const updated = await promoteMember(group.id, userId);
      onUpdate({
        ...group,
        members: group.members.map((m) => m.userId === userId ? { ...m, role: updated.role } : m),
      });
    } catch {
      // Silent
    }
  };

  const handleDemote = async (userId: number) => {
    try {
      const updated = await demoteMember(group.id, userId);
      onUpdate({
        ...group,
        members: group.members.map((m) => m.userId === userId ? { ...m, role: updated.role } : m),
      });
    } catch {
      // Silent
    }
  };

  const handleRemove = (userId: number, username: string) => {
    setConfirmDialog({
      title: 'Exclure un membre',
      message: `Êtes-vous sûr de vouloir exclure ${username} du groupe ?`,
      confirmLabel: 'Exclure',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await removeMember(group.id, userId);
          onUpdate({
            ...group,
            members: group.members.filter((m) => m.userId !== userId),
            memberCount: group.memberCount - 1,
          });
        } catch {
          // Silent
        }
      },
    });
  };

  return (
    <>
      {/* Pending applications */}
      {isGroupAdmin && pendingCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
            Candidatures en attente ({pendingCount})
          </p>
          {group.pendingApplications!.map((applicant) => (
            <div key={applicant.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Avatar
                  src={applicant.avatarUrl}
                  alt={applicant.displayName || applicant.username}
                  fallbackText={(applicant.displayName || applicant.username)[0].toUpperCase()}
                  sizeClassName="w-7 h-7"
                  containerClassName="bg-blue-400 text-white text-xs font-bold"
                />
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  {applicant.displayName || applicant.username}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleApprove(applicant.userId)}
                  className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  ✓ Accepter
                </button>
                <button
                  onClick={() => handleReject(applicant.userId)}
                  className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  ✕ Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Members list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Membres</h3>
        {group.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <div className="flex items-center gap-2">
              <Avatar
                src={member.avatarUrl}
                alt={member.displayName || member.username}
                fallbackText={(member.displayName || member.username)[0].toUpperCase()}
                sizeClassName="w-7 h-7"
                containerClassName="bg-wc-green text-white text-xs font-bold"
              />
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {member.displayName || member.username}
              </span>
              {member.role === 'GROUP_ADMIN' && (
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded font-medium">
                  Admin
                </span>
              )}
              {member.username === currentUsername && (
                <span className="text-xs text-wc-green dark:text-green-400">(vous)</span>
              )}
            </div>
            {isGroupAdmin && member.username !== currentUsername && (
              <div className="flex gap-1">
                {member.role === 'MEMBER' ? (
                  <button
                    onClick={() => handlePromote(member.userId)}
                    className="text-xs text-blue-500 hover:text-blue-700 px-1.5 py-0.5"
                    title="Promouvoir admin"
                  >
                    ↑ Admin
                  </button>
                ) : (
                  <button
                    onClick={() => handleDemote(member.userId)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5"
                    title="Rétrograder"
                  >
                    ↓ Membre
                  </button>
                )}
                <button
                  onClick={() => handleRemove(member.userId, member.username)}
                  className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5"
                  title="Exclure"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
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
    </>
  );
};

export default MembersList;
