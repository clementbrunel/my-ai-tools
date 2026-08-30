import { useState } from 'react';
import { updateMyGroupNotificationPrefs } from '@/api/groups';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/utils/errors';
import type { Group } from '@/types';

interface Props {
  group: Group;
  onUpdate: (updated: Group) => void;
}

type Choice = 'INHERIT' | 'ON' | 'OFF';

const choiceOf = (override: boolean | null): Choice =>
  override === null ? 'INHERIT' : override ? 'ON' : 'OFF';

const overrideOf = (choice: Choice): boolean | null =>
  choice === 'INHERIT' ? null : choice === 'ON';

const NotificationPrefsPanel: React.FC<Props> = ({ group, onUpdate }) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState<'reminder' | 'gage' | null>(null);

  const prefs = group.currentUserNotificationPrefs;
  if (!prefs) return null;

  const handleChange = async (field: 'emailReminderEnabled' | 'emailGageEnabled', choice: Choice) => {
    const saveKey = field === 'emailReminderEnabled' ? 'reminder' : 'gage';
    setSaving(saveKey);
    try {
      const updated = await updateMyGroupNotificationPrefs(group.id, {
        emailReminderEnabled: field === 'emailReminderEnabled' ? overrideOf(choice) : prefs.emailReminderEnabled,
        emailGageEnabled: field === 'emailGageEnabled' ? overrideOf(choice) : prefs.emailGageEnabled,
      });
      onUpdate(updated);
    } catch (e: unknown) {
      showToast(extractErrorMessage(e, 'Impossible de mettre à jour tes notifications pour ce groupe'), 'error');
    } finally {
      setSaving(null);
    }
  };

  const row = (
    field: 'emailReminderEnabled' | 'emailGageEnabled',
    icon: string,
    title: string,
    effective: boolean
  ) => {
    const current = choiceOf(prefs[field]);
    const busy = saving === (field === 'emailReminderEnabled' ? 'reminder' : 'gage');
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            {icon} {title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {effective ? 'Activé pour ce groupe' : 'Désactivé pour ce groupe'}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {(
            [
              ['INHERIT', 'Auto'],
              ['ON', 'Oui'],
              ['OFF', 'Non'],
            ] as [Choice, string][]
          ).map(([choice, label]) => (
            <button
              key={choice}
              disabled={busy}
              onClick={() => handleChange(field, choice)}
              className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                current === choice
                  ? 'bg-wc-green/10 border-wc-green text-wc-green'
                  : 'border-gray-300 dark:border-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              title={choice === 'INHERIT' ? 'Utiliser mon réglage global (Profil)' : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        🔔 Mes notifications pour ce groupe
      </p>
      {row('emailReminderEnabled', '🔔', 'Rappel avant chaque pari', prefs.effectiveEmailReminderEnabled)}
      {row('emailGageEnabled', '📊', 'Résolution des gages', prefs.effectiveEmailGageEnabled)}
      <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
        « Auto » suit ton réglage global (page Profil). Choisis « Oui »/« Non » pour l'ajuster juste pour ce groupe.
      </p>
    </div>
  );
};

export default NotificationPrefsPanel;
