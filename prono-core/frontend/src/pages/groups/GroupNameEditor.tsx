import { useState } from 'react';
import { updateGroupInfo } from '@/api/groups';
import type { Group } from '@/types';

interface Props {
  group: Group;
  isGroupAdmin: boolean;
  onUpdate: (updated: Group) => void;
}

/** Group name/description — inline display, or an editable form behind the ✏️ icon. */
const GroupNameEditor: React.FC<Props> = ({ group, isGroupAdmin, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editDescription, setEditDescription] = useState(group.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = () => {
    setEditName(group.name);
    setEditDescription(group.description ?? '');
    setError(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editName.trim().length < 2) {
      setError('Le nom doit contenir au moins 2 caractères.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateGroupInfo(group.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      onUpdate(updated);
      setIsEditing(false);
    } catch {
      setError('Erreur lors de la mise à jour du groupe.');
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex-1 mr-3 space-y-2">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          minLength={2}
          maxLength={100}
          className="input-field w-full font-black text-lg"
          placeholder="Nom du groupe"
        />
        <textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          maxLength={500}
          rows={2}
          className="input-field w-full text-sm"
          placeholder="Description (optionnelle)"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
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
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-black text-gray-900 dark:text-white">{group.name}</h2>
        {group.isPrivate && (
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
            🔒 Privé
          </span>
        )}
        {isGroupAdmin && (
          <button
            onClick={openEdit}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
            title="Modifier le nom et la description"
            aria-label="Modifier le nom et la description"
          >
            ✏️
          </button>
        )}
      </div>
      {group.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{group.description}</p>
      )}
      <p className="text-xs text-gray-400 mt-1">
        {group.memberCount} membre{group.memberCount > 1 ? 's' : ''}
      </p>
    </div>
  );
};

export default GroupNameEditor;
