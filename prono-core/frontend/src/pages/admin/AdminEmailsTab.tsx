import React, { useMemo, useState } from 'react';
import { sendTestEmail, type EmailType } from '../../api/email';
import { useFormMessages } from '../../hooks/useFormMessages';

type TemplateTheme = 'FOOTBALL' | 'F1' | 'NEUTRAL';

interface EmailTemplateInfo {
  type: EmailType;
  label: string;
  theme: TemplateTheme;
  description: React.ReactNode;
}

// Each template is intrinsically tied to one sport theme (mirrors EmailService#themeFor
// on the backend) — this is the single source of truth for the filter below and for
// the "Templates disponibles" table. Add new F1 templates here as they land.
const EMAIL_TEMPLATES: EmailTemplateInfo[] = [
  {
    type: 'VERIFICATION',
    label: "Vérification d'email",
    theme: 'NEUTRAL',
    description: "Envoyé à l'inscription pour vérifier l'adresse email du nouvel utilisateur.",
  },
  {
    type: 'PASSWORD_RESET',
    label: 'Réinitialisation de mot de passe',
    theme: 'NEUTRAL',
    description: "Envoyé lors d'une demande de mot de passe oublié. Contient un lien valable 1 heure.",
  },
  {
    type: 'MATCH_REMINDER',
    label: 'Rappel de match',
    theme: 'FOOTBALL',
    description: (
      <>
        Envoyé automatiquement 4 heures avant chaque match aux joueurs n'ayant pas encore saisi leur pronostic.
        Activable / désactivable par chaque utilisateur dans son profil.
        Le test utilise un match fictif (France – Brésil, Finale).
      </>
    ),
  },
  {
    type: 'RACE_REMINDER',
    label: 'Rappel de course F1',
    theme: 'F1',
    description: (
      <>
        Envoyé automatiquement 4 heures avant chaque Grand Prix aux joueurs n'ayant pas encore saisi leur pronostic.
        Activable / désactivable par chaque utilisateur dans son profil.
        Le test utilise une course fictive (Grand Prix de Monaco).
      </>
    ),
  },
  {
    type: 'GAGE_RESOLUTION',
    label: 'Résolution du gage du jour',
    theme: 'NEUTRAL',
    description: (
      <>
        Envoyé automatiquement à la fin de la journée de matchs ou de courses aux membres du groupe ayant activé cette notification.
        Commun aux groupes Foot et F1 : contient le classement du jour (points gagnés par joueur) et l'identité du joueur qui écope du gage.
        Désactivé par défaut dans le profil utilisateur.
        Le test utilise des données fictives (groupe "Groupe des Amis", 3 joueurs).
      </>
    ),
  },
  {
    type: 'GROUP_NEW_MATCHES',
    label: 'Nouveaux matchs ouverts (chef de groupe)',
    theme: 'FOOTBALL',
    description: (
      <>
        Envoyé par un chef de groupe aux membres actifs pour signaler l'ouverture aux pronostics de nouveaux matchs futurs.
        Déclenché depuis les paramètres admin d'un groupe (sélection des matchs par cases à cocher).
        Le test utilise des données fictives (groupe "Groupe des Amis", 2 matchs, chef "Le Chef").
      </>
    ),
  },
  {
    type: 'GROUP_NEW_RACES',
    label: 'Nouveaux Grands Prix ouverts (chef de groupe)',
    theme: 'F1',
    description: (
      <>
        Envoyé par un chef de groupe aux membres actifs pour signaler l'ouverture aux pronos de nouveaux Grands Prix futurs.
        Déclenché depuis les paramètres admin d'un groupe (sélection des GP par cases à cocher).
        Le test utilise des données fictives (groupe "Groupe des Amis", 2 GP, chef "Le Chef").
      </>
    ),
  },
  {
    type: 'TEST_CEDRIC',
    label: 'test cédric 🏦',
    theme: 'NEUTRAL',
    description: (
      <>
        Email de test technique minimaliste, envoyé intentionnellement (contrairement à celui du Crédit Agricole le 9/06/2026).
        Objet : "test cédric". Permet de vérifier que la chaîne d'envoi Resend est opérationnelle sans déclencher de logique métier.
      </>
    ),
  },
];

const THEME_FILTERS: { value: TemplateTheme | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'FOOTBALL', label: '⚽ Foot' },
  { value: 'F1', label: '🏎️ F1' },
  { value: 'NEUTRAL', label: '🎯 Neutre' },
];

const AdminEmailsTab: React.FC = () => {
  const { msg: emailMsg, setError: setEmailTestError, setSuccess: setEmailTestSuccess, clear: clearEmailMessages } = useFormMessages();
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [themeFilter, setThemeFilter] = useState<TemplateTheme | 'ALL'>('ALL');
  const [testEmailType, setTestEmailType] = useState<EmailType>('VERIFICATION');
  const [emailTestLoading, setEmailTestLoading] = useState(false);

  const visibleTemplates = useMemo(
    () => EMAIL_TEMPLATES.filter((t) => themeFilter === 'ALL' || t.theme === themeFilter),
    [themeFilter]
  );

  const handleThemeFilterChange = (value: TemplateTheme | 'ALL') => {
    setThemeFilter(value);
    const stillVisible = EMAIL_TEMPLATES.some((t) => t.type === testEmailType && (value === 'ALL' || t.theme === value));
    if (!stillVisible) {
      const firstMatch = EMAIL_TEMPLATES.find((t) => value === 'ALL' || t.theme === value);
      if (firstMatch) setTestEmailType(firstMatch.type);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    clearEmailMessages();
    setEmailTestLoading(true);
    try {
      await sendTestEmail(testEmailTarget, testEmailType);
      setEmailTestSuccess(`Email envoyé à ${testEmailTarget} !`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setEmailTestError(axiosErr?.response?.data?.message ?? "Erreur lors de l'envoi.");
    } finally {
      setEmailTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-bold text-gray-900 dark:text-white mb-1">📧 Tester un template d'email</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Envoie un email de test directement vers une adresse pour prévisualiser le rendu d'un template.
          Le thème (⚽ Foot / 🏎️ F1 / 🎯 Neutre) est déterminé par le template lui-même, pas par toi.
        </p>
        <div className="mb-4">
          <label className="label">Filtrer par thème</label>
          <div className="flex gap-2 flex-wrap">
            {THEME_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => handleThemeFilterChange(f.value)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  themeFilter === f.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <form onSubmit={handleSendTestEmail} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="label">Adresse cible</label>
            <input type="email" value={testEmailTarget} onChange={(e) => setTestEmailTarget(e.target.value)}
              className="input-field" placeholder="test@example.com" required />
          </div>
          <div>
            <label className="label">Template</label>
            <select value={testEmailType} onChange={(e) => setTestEmailType(e.target.value as EmailType)} className="input-field">
              {visibleTemplates.map((t) => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className="btn-primary text-sm w-full" disabled={emailTestLoading || visibleTemplates.length === 0}>
              {emailTestLoading ? 'Envoi...' : '📤 Envoyer'}
            </button>
          </div>
          {emailMsg?.type === 'error' && <p className="md:col-span-3 text-red-500 text-sm">{emailMsg.text}</p>}
          {emailMsg?.type === 'success' && <p className="md:col-span-3 text-green-500 text-sm">✅ {emailMsg.text}</p>}
        </form>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Templates disponibles</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 px-4 text-left text-xs text-gray-500 uppercase">Template</th>
              <th className="py-2 px-4 text-left text-xs text-gray-500 uppercase">Thème</th>
              <th className="py-2 px-4 text-left text-xs text-gray-500 uppercase">Description</th>
            </tr>
          </thead>
          <tbody>
            {visibleTemplates.map((t) => (
              <tr key={t.type} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{t.label}</td>
                <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                  {THEME_FILTERS.find((f) => f.value === t.theme)?.label}
                </td>
                <td className="py-3 px-4 text-gray-500">{t.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminEmailsTab;
