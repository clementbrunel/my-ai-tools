import { useState } from 'react';
import { updateAvatar } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import { useFormMessages } from '../../hooks/useFormMessages';

interface Props {
  initialValue: string;
}

const AvatarEdit: React.FC<Props> = ({ initialValue }) => {
  const { updateUser } = useAuth();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const { msg, setSuccess, setError } = useFormMessages();

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateAvatar(value);
      updateUser(updated);
      setSuccess('Avatar mis à jour !');
    } catch {
      setError("Impossible de mettre à jour l'avatar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="font-bold text-gray-900 dark:text-white mb-3">🖼️ Avatar</h3>
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://example.com/photo.jpg"
          className="input flex-1"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex-shrink-0 disabled:opacity-50"
        >
          {saving ? '...' : 'Enregistrer'}
        </button>
      </div>
      {msg && (
        <p className={`text-sm mt-2 ${msg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
};

export default AvatarEdit;
