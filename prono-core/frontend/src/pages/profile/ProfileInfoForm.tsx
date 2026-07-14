import { useState } from 'react';
import { updateDisplayName, updateAvatar, updateEmail, updateEmailPreferences } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import { useFormMessages } from '../../hooks/useFormMessages';

interface Props {
  initialDisplayName: string;
  initialAvatarUrl: string;
  initialEmail: string;
  initialEmailReminder: boolean;
  initialEmailGage: boolean;
  initialEmailNewsletter: boolean;
  usernamePlaceholder?: string;
}

const ProfileInfoForm: React.FC<Props> = ({
  initialDisplayName,
  initialAvatarUrl,
  initialEmail,
  initialEmailReminder,
  initialEmailGage,
  initialEmailNewsletter,
  usernamePlaceholder,
}) => {
  const { updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [email, setEmail] = useState(initialEmail);
  const [emailReminder, setEmailReminder] = useState(initialEmailReminder);
  const [emailGage, setEmailGage] = useState(initialEmailGage);
  const [emailNewsletter, setEmailNewsletter] = useState(initialEmailNewsletter);
  const [saving, setSaving] = useState(false);
  const { msg, setSuccess, setError } = useFormMessages();

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: ReturnType<typeof updateDisplayName>[] = [];

      if (displayName !== initialDisplayName) {
        updates.push(updateDisplayName(displayName));
      }
      if (avatarUrl !== initialAvatarUrl) {
        updates.push(updateAvatar(avatarUrl));
      }
      if (email !== initialEmail) {
        updates.push(updateEmail(email));
      }
      if (
        emailReminder !== initialEmailReminder ||
        emailGage !== initialEmailGage ||
        emailNewsletter !== initialEmailNewsletter
      ) {
        updates.push(updateEmailPreferences(emailReminder, emailGage, emailNewsletter));
      }

      const results = await Promise.all(updates);
      if (results.length > 0) {
        updateUser(results[results.length - 1]);
      }
      setSuccess('Profil mis à jour !');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Impossible de mettre à jour le profil.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          ✏️ Nom affiché
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={usernamePlaceholder}
          maxLength={100}
          className="input w-full"
        />
        <p className="text-xs text-gray-400 mt-1">Laisser vide pour afficher votre login.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          📧 Adresse email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          🖼️ Avatar (URL)
        </label>
        <input
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://example.com/photo.jpg"
          className="input w-full"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Laisse ce champ vide pour utiliser ton avatar Gravatar (basé sur ton email).
        </p>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">🔔 Rappel par email avant chaque match</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Reçois un email 4 heures avant le match si tu n'as pas encore saisi ton pronostic
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEmailReminder((v) => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            emailReminder ? 'bg-wc-green' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={emailReminder}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              emailReminder ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">🃏 Résolution du gage du jour</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Reçois un email avec le bilan des paris et l'attribution du gage quand la journée se termine
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEmailGage((v) => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            emailGage ? 'bg-wc-green' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={emailGage}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              emailGage ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">📣 Nouveautés &amp; annonces</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Reçois un email quand une grosse nouveauté arrive sur PronoCore (rare, ponctuel)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEmailNewsletter((v) => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            emailNewsletter ? 'bg-wc-green' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={emailNewsletter}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              emailNewsletter ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {msg && (
        <p className={`text-sm ${msg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
          {msg.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full disabled:opacity-50"
      >
        {saving ? '...' : 'Enregistrer'}
      </button>
    </div>
  );
};

export default ProfileInfoForm;
