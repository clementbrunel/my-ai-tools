import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword, validateResetToken } from '../api/auth';

type Status = 'validating' | 'invalid' | 'ready' | 'success' | 'error';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<Status>('validating');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    validateResetToken(token)
      .then((valid) => setStatus(valid ? 'ready' : 'invalid'))
      .catch(() => setStatus('invalid'));
  }, [token]);

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => navigate('/login'), 3000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError('');

    if (newPassword !== confirmPassword) {
      setFieldError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (newPassword.length < 6) {
      setFieldError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword({ token, newPassword });
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen wc-header flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-7xl mb-4">⚽</div>
          <h1 className="text-4xl font-black text-white">
            <span className="text-wc-gold">Prono</span>Core
          </h1>
        </div>

        <div className="bg-white dark:bg-wc-dark-secondary rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Nouveau mot de passe
          </h2>

          {status === 'validating' && (
            <p className="text-center text-gray-500 dark:text-gray-400">
              ⏳ Vérification du lien...
            </p>
          )}

          {status === 'invalid' && (
            <div className="text-center space-y-4">
              <div className="text-5xl">❌</div>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Ce lien de réinitialisation est invalide ou a expiré.
              </p>
              <Link
                to="/forgot-password"
                className="inline-block text-wc-green dark:text-green-400 font-semibold hover:underline text-sm"
              >
                Demander un nouveau lien
              </Link>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Mot de passe réinitialisé avec succès !
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                Redirection vers la connexion dans 3 secondes…
              </p>
              <Link
                to="/login"
                className="inline-block text-wc-green dark:text-green-400 font-semibold hover:underline text-sm"
              >
                Se connecter maintenant
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="text-5xl">⚠️</div>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Une erreur est survenue. Réessayez ou demandez un nouveau lien.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => setStatus('ready')}
                  className="text-sm text-wc-green dark:text-green-400 font-semibold hover:underline"
                >
                  Réessayer
                </button>
                <Link
                  to="/forgot-password"
                  className="text-sm text-gray-500 hover:underline"
                >
                  Nouveau lien
                </Link>
              </div>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="label">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  required
                />
              </div>

              {fieldError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-700 dark:text-red-300 text-sm">⚠️ {fieldError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3 text-base"
              >
                {isLoading ? '⏳ Enregistrement...' : '🔒 Réinitialiser le mot de passe'}
              </button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
