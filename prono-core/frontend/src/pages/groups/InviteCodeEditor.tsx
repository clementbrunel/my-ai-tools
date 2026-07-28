import { useState } from 'react';
import { updateGroupInviteCode } from '@/api/groups';
import type { Group } from '@/types';

interface Props {
  group: Group;
  isGroupAdmin: boolean;
  onUpdate: (updated: Group) => void;
}

/** Invite code display — copy, or (admin) edit/regenerate. */
const InviteCodeEditor: React.FC<Props> = ({ group, isGroupAdmin, onUpdate }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editInviteCode, setEditInviteCode] = useState(group.inviteCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const openEdit = () => {
    setEditInviteCode(group.inviteCode);
    setError(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateGroupInviteCode(group.id, editInviteCode.trim());
      onUpdate(updated);
      setIsEditing(false);
    } catch {
      setError("Ce code n'est pas disponible ou invalide (4 à 20 lettres/chiffres).");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateGroupInviteCode(group.id);
      onUpdate(updated);
      setEditInviteCode(updated.inviteCode);
    } catch {
      setError('Erreur lors de la régénération du code.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
      {isEditing ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">Code d'invitation</p>
          <input
            type="text"
            value={editInviteCode}
            onChange={(e) => setEditInviteCode(e.target.value.toUpperCase())}
            maxLength={20}
            className="input-field w-full font-mono font-bold tracking-widest uppercase"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-xs disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={saving}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              🔄 Régénérer
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="btn-secondary text-xs"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Code d'invitation</p>
            <span className="font-mono font-bold text-lg tracking-widest text-gray-900 dark:text-white">
              {group.inviteCode}
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            {isGroupAdmin && (
              <button onClick={openEdit} className="btn-secondary text-xs whitespace-nowrap">
                Modifier
              </button>
            )}
            <button onClick={copyCode} className="btn-secondary text-xs whitespace-nowrap">
              {copiedCode ? '✓ Copié !' : 'Copier'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteCodeEditor;
