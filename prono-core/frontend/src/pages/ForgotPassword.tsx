import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await forgotPassword({ email });
      setSubmitted(true);
    } catch {
      setError('Une erreur est survenue. Réessayez.');
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
            Mot de passe oublié
          </h2>

          {submitted ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                Si un compte est associé à <strong>{email}</strong>, vous recevrez
                un lien de réinitialisation dans les prochaines minutes.
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                Vérifiez aussi vos spams.
              </p>
              <Link
                to="/login"
                className="inline-block mt-4 text-wc-green dark:text-green-400 font-semibold hover:underline text-sm"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 text-center">
                Entrez votre adresse email et nous vous enverrons un lien pour
                réinitialiser votre mot de passe.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Adresse email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="votre@email.com"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-red-700 dark:text-red-300 text-sm">⚠️ {error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-primary py-3 text-base"
                >
                  {isLoading ? '⏳ Envoi...' : '📨 Envoyer le lien'}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
                <Link
                  to="/login"
                  className="text-sm text-wc-green dark:text-green-400 font-semibold hover:underline"
                >
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
