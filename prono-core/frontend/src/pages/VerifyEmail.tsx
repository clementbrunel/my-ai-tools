import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { verifyEmail, resendVerification } from '../api/auth';
import { useAuth } from '../context/AuthContext';

type State = 'pending' | 'verifying' | 'success' | 'error' | 'expired' | 'resent';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const token = searchParams.get('token');
  const email = searchParams.get('email') ?? '';

  const [state, setState] = useState<State>(token ? 'verifying' : 'pending');
  const [errorMsg, setErrorMsg] = useState('');
  const [resendEmail, setResendEmail] = useState(email);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!token) return;

    setState('verifying');
    verifyEmail(token)
      .then((response) => {
        setSession(response);
        setState('success');
        setTimeout(() => navigate('/dashboard'), 2000);
      })
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })
          .response?.data?.message ?? 'Lien invalide.';
        setErrorMsg(msg);
        setState(msg.includes('expiré') ? 'expired' : 'error');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setIsResending(true);
    try {
      await resendVerification(resendEmail);
      setState('resent');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message ?? 'Impossible de renvoyer l\'email.';
      setErrorMsg(msg);
      setState('error');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen wc-header flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-7xl mb-4">🏆</div>
          <h1 className="text-4xl font-black text-white">
            <span className="text-wc-gold">Prono</span>Core
          </h1>
        </div>

        <div className="bg-white dark:bg-wc-dark-secondary rounded-2xl shadow-2xl p-8">

          {/* Pending: just registered, waiting for click */}
          {state === 'pending' && (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Vérifie ton email !
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Un lien de vérification a été envoyé à{' '}
                {email && <strong className="text-gray-900 dark:text-white">{email}</strong>}.
                Clique sur le lien dans l'email pour activer ton compte.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Le lien est valable 24 heures. Vérifie aussi tes spams.
              </p>
              <ResendSection
                email={resendEmail}
                onEmailChange={setResendEmail}
                onResend={handleResend}
                isResending={isResending}
              />
            </div>
          )}

          {/* Auto-verifying */}
          {state === 'verifying' && (
            <div className="text-center space-y-4">
              <div className="text-5xl animate-spin">⏳</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Vérification en cours…
              </h2>
              <p className="text-gray-500 dark:text-gray-400">Patiente une seconde !</p>
            </div>
          )}

          {/* Success */}
          {state === 'success' && (
            <div className="text-center space-y-4">
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Email vérifié !
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Ton compte est activé. Tu vas être redirigé vers le tableau de bord…
              </p>
            </div>
          )}

          {/* Expired token */}
          {state === 'expired' && (
            <div className="text-center space-y-4">
              <div className="text-5xl">⌛</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Lien expiré
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{errorMsg}</p>
              <ResendSection
                email={resendEmail}
                onEmailChange={setResendEmail}
                onResend={handleResend}
                isResending={isResending}
              />
            </div>
          )}

          {/* Generic error */}
          {state === 'error' && (
            <div className="text-center space-y-4">
              <div className="text-5xl">❌</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Erreur de vérification
              </h2>
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-700 dark:text-red-300 text-sm">{errorMsg}</p>
              </div>
              <ResendSection
                email={resendEmail}
                onEmailChange={setResendEmail}
                onResend={handleResend}
                isResending={isResending}
              />
            </div>
          )}

          {/* Resent confirmation */}
          {state === 'resent' && (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Email renvoyé !
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Un nouveau lien a été envoyé à <strong>{resendEmail}</strong>.
                Vérifie ta boîte mail (et les spams).
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
            <Link to="/login" className="text-sm text-wc-green dark:text-green-400 hover:underline">
              ← Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ResendSectionProps {
  email: string;
  onEmailChange: (v: string) => void;
  onResend: () => void;
  isResending: boolean;
}

const ResendSection: React.FC<ResendSectionProps> = ({ email, onEmailChange, onResend, isResending }) => (
  <div className="pt-4 space-y-2">
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Tu n'as pas reçu l'email ?
    </p>
    <input
      type="email"
      value={email}
      onChange={(e) => onEmailChange(e.target.value)}
      className="input-field text-sm"
      placeholder="ton@email.com"
    />
    <button
      onClick={onResend}
      disabled={isResending || !email}
      className="w-full btn-primary py-2 text-sm"
    >
      {isResending ? '⏳ Envoi…' : '📨 Renvoyer le lien de vérification'}
    </button>
  </div>
);

export default VerifyEmail;
