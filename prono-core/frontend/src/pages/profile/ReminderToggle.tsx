import { useState } from 'react';
import { updateEmailReminder } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';

interface Props {
  initialEnabled: boolean;
}

const ReminderToggle: React.FC<Props> = ({ initialEnabled }) => {
  const { updateUser } = useAuth();
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    const next = !enabled;
    setSaving(true);
    try {
      const updated = await updateEmailReminder(next);
      setEnabled(updated.emailReminderEnabled);
      updateUser(updated);
      showToast(next ? 'Rappels par email activés' : 'Rappels par email désactivés');
    } catch {
      showToast('Impossible de modifier la préférence de rappel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="font-bold text-gray-900 dark:text-white mb-3">🔔 Notifications</h3>
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">Rappel par email avant chaque match</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Reçois un email 4 heures avant le match si tu n'as pas encore saisi ton pronostic
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
            enabled ? 'bg-wc-green' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default ReminderToggle;
