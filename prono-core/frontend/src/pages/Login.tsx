import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isF1 = theme.id === 'f1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login({ username, password });
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string }; status?: number } };
      if (axiosErr.response?.status === 401) {
        setError('Identifiants incorrects');
      } else {
        setError('Erreur de connexion. Réessayez.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen wc-header flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-7xl mb-4 animate-bounce-slow">{isF1 ? '🏎️' : '⚽'}</div>
          <h1 className="text-4xl font-black text-white">
            <span className="text-wc-gold">Prono</span>Core
          </h1>
          <p className="text-green-200 mt-2">
            {isF1 ? '🏁 Formule 1 2026 - Paris entre amis !' : '🏆 World Cup 2026 - Paris entre amis !'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-wc-dark-secondary rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Connexion
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nom d'utilisateur</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="Nom d'utilisateur"
                required
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
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
              {isLoading ? '⏳ Connexion...' : '🚀 Se connecter'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pas encore de compte ?{' '}
              <Link to="/register" className="text-wc-green dark:text-green-400 font-semibold hover:underline">
                S'inscrire
              </Link>
            </p>
            <p className="text-sm">
              <Link to="/forgot-password" className="text-gray-500 dark:text-gray-400 hover:underline">
                Mot de passe oublié ?
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
