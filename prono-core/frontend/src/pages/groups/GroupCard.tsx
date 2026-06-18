import { useState } from 'react';
import {
  approveApplication, rejectApplication,
  promoteMember, demoteMember, removeMember, leaveGroup,
} from '../../api/groups';
import type { Group } from '../../types';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';
import GroupAdminSettings from './GroupAdminSettings';

interface Props {
  group: Group;
  onLeave: (groupId: number) => void;
  onUpdate: (updated: Group) => void;
}

const GroupCard: React.FC<Props> = ({ group, onLeave, onUpdate }) => {
  const { user } = useAuth();
  const isGroupAdmin = group.currentUserRole === 'GROUP_ADMIN';
  const pendingCount = group.pendingApplications?.length ?? 0;

  const [copiedCode, setCopiedCode] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  } | null>(null);

  const copyCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

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
          console.error('Failed to leave group', err);
        }
      },
    });
  };

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
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">{group.name}</h2>
            {group.isPrivate && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                🔒 Privé
              </span>
            )}
          </div>
          {group.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{group.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {group.memberCount} membre{group.memberCount > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handleLeave}
          className="text-xs text-red-400 hover:text-red-600 transition-colors"
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

      {/* Pending applications */}
      {isGroupAdmin && pendingCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
            Candidatures en attente ({pendingCount})
          </p>
          {group.pendingApplications!.map((applicant) => (
            <div key={applicant.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-400 text-white flex items-center justify-center text-xs font-bold">
                  {(applicant.displayName || applicant.username)[0].toUpperCase()}
                </div>
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

      {/* Invite code */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Code d'invitation</p>
          <span className="font-mono font-bold text-lg tracking-widest text-gray-900 dark:text-white">
            {group.inviteCode}
          </span>
        </div>
        <button onClick={copyCode} className="btn-secondary text-xs whitespace-nowrap">
          {copiedCode ? '✓ Copié !' : 'Copier'}
        </button>
      </div>

      {/* Members list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Membres</h3>
        {group.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-wc-green text-white flex items-center justify-center text-xs font-bold">
                {(member.displayName || member.username)[0].toUpperCase()}
              </div>
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {member.displayName || member.username}
              </span>
              {member.role === 'GROUP_ADMIN' && (
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded font-medium">
                  Admin
                </span>
              )}
              {member.username === user?.username && (
                <span className="text-xs text-wc-green dark:text-green-400">(vous)</span>
              )}
            </div>
            {isGroupAdmin && member.username !== user?.username && (
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
