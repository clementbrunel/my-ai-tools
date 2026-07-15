import { useState } from 'react';
import { updatePassword } from '@/api/users';
import { useFormMessages } from '@/hooks/useFormMessages';

const PasswordForm: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const { msg, setSuccess, setError, clear } = useFormMessages();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clear();
    if (newPassword !== confirmPassword) {
      setError('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Mot de passe mis à jour !');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Impossible de modifier le mot de passe.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="font-bold text-gray-900 dark:text-white mb-3">🔒 Changer le mot de passe</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Mot de passe actuel"
          required
          className="input w-full"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Nouveau mot de passe (min. 6 caractères)"
          required
          minLength={6}
          className="input w-full"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirmer le nouveau mot de passe"
          required
          className="input w-full"
        />
        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full disabled:opacity-50"
        >
          {saving ? '...' : 'Changer le mot de passe'}
        </button>
        {msg && (
          <p className={`text-sm ${msg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {msg.text}
          </p>
        )}
      </form>
    </div>
  );
};

export default PasswordForm;
