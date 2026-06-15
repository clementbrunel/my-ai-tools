import { useState } from 'react';
import { updateDisplayName } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import { useFormMessages } from '../../hooks/useFormMessages';

interface Props {
  initialValue: string;
  placeholder?: string;
}

const DisplayNameEdit: React.FC<Props> = ({ initialValue, placeholder }) => {
  const { updateUser } = useAuth();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const { msg, setSuccess, setError } = useFormMessages();

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateDisplayName(value);
      updateUser(updated);
      setSuccess('Nom affiché mis à jour !');
    } catch {
      setError('Impossible de mettre à jour le nom affiché.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="font-bold text-gray-900 dark:text-white mb-3">✏️ Nom affiché</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={100}
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
      <p className="text-xs text-gray-400 mt-1">Laisser vide pour afficher votre login.</p>
      {msg && (
        <p className={`text-sm mt-2 ${msg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
};

export default DisplayNameEdit;
