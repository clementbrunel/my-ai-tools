import React, { useState } from 'react';
import { sendTestEmail, type EmailType } from '../../api/email';
import { useFormMessages } from '../../hooks/useFormMessages';

const AdminEmailsTab: React.FC = () => {
  const { msg: emailMsg, setError: setEmailTestError, setSuccess: setEmailTestSuccess, clear: clearEmailMessages } = useFormMessages();
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [testEmailType, setTestEmailType] = useState<EmailType>('VERIFICATION');
  const [emailTestLoading, setEmailTestLoading] = useState(false);

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
        </p>
        <form onSubmit={handleSendTestEmail} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="label">Adresse cible</label>
            <input type="email" value={testEmailTarget} onChange={(e) => setTestEmailTarget(e.target.value)}
              className="input-field" placeholder="test@example.com" required />
          </div>
          <div>
            <label className="label">Template</label>
            <select value={testEmailType} onChange={(e) => setTestEmailType(e.target.value as EmailType)} className="input-field">
              <option value="VERIFICATION">Vérification d'email</option>
              <option value="PASSWORD_RESET">Réinitialisation de mot de passe</option>
              <option value="MATCH_REMINDER">Rappel de match</option>
              <option value="GAGE_RESOLUTION">Résolution du gage du jour</option>
              <option value="GROUP_NEW_MATCHES">Nouveaux matchs ouverts (chef de groupe)</option>
              <option value="TEST_CEDRIC">test cédric 🏦</option>
            </select>
          </div>
          <div>
            <button type="submit" className="btn-primary text-sm w-full" disabled={emailTestLoading}>
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
              <th className="py-2 px-4 text-left text-xs text-gray-500 uppercase">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">Vérification d'email</td>
              <td className="py-3 px-4 text-gray-500">Envoyé à l'inscription pour vérifier l'adresse email du nouvel utilisateur.</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">Réinitialisation de mot de passe</td>
              <td className="py-3 px-4 text-gray-500">Envoyé lors d'une demande de mot de passe oublié. Contient un lien valable 1 heure.</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">Rappel de match</td>
              <td className="py-3 px-4 text-gray-500">
                Envoyé automatiquement 4 heures avant chaque match aux joueurs n'ayant pas encore saisi leur pronostic.
                Activable / désactivable par chaque utilisateur dans son profil.
                Le test utilise un match fictif (France – Brésil, Finale).
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">Résolution du gage du jour</td>
              <td className="py-3 px-4 text-gray-500">
                Envoyé automatiquement à la fin de la journée de matchs aux membres du groupe ayant activé cette notification.
                Contient le classement du jour (points gagnés par joueur) et l'identité du joueur qui écope du gage.
                Désactivé par défaut dans le profil utilisateur.
                Le test utilise des données fictives (groupe "Groupe des Amis", 3 joueurs).
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">Nouveaux matchs ouverts (chef de groupe)</td>
              <td className="py-3 px-4 text-gray-500">
                Envoyé par un chef de groupe aux membres actifs pour signaler l'ouverture aux pronostics de nouveaux matchs futurs.
                Déclenché depuis les paramètres admin d'un groupe (sélection des matchs par cases à cocher).
                Le test utilise des données fictives (groupe "Groupe des Amis", 2 matchs, chef "Le Chef").
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">test cédric 🏦</td>
              <td className="py-3 px-4 text-gray-500">
                Email de test technique minimaliste, envoyé intentionnellement (contrairement à celui du Crédit Agricole le 9/06/2026).
                Objet : "test cédric". Permet de vérifier que la chaîne d'envoi Resend est opérationnelle sans déclencher de logique métier.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminEmailsTab;
