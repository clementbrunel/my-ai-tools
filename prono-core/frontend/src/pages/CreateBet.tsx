import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getMatches } from '../api/matches';
import { createBet } from '../api/bets';
import type { Match } from '../types';

const CreateBet: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedMatchId = searchParams.get('matchId');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [matchId, setMatchId] = useState(preselectedMatchId || '');
  const betType = 'SCORE' as const;
  const [points, setPoints] = useState(10);
  const [deadline, setDeadline] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMatches().then(setMatches).catch(console.error);
    // Set default deadline to 2 hours from now
    const defaultDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000);
    setDeadline(defaultDeadline.toISOString().slice(0, 16));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Le titre est obligatoire');
      return;
    }
    if (!matchId) {
      setError('Un match doit être associé au pari');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await createBet({
        title,
        description: description || undefined,
        matchId: matchId ? parseInt(matchId) : undefined,
        betType: betType as 'SCORE' | 'EVENT' | 'FORFEIT' | 'FREE',
        points,
        deadline: new Date(deadline).toISOString(),
      });
      navigate('/bets');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Erreur lors de la création du pari');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/bets" className="text-sm text-wc-green dark:text-green-400 hover:underline mb-4 inline-block">
        ← Retour aux paris
      </Link>

      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          ⚽ Créer un pari — Score exact
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="label">Titre du pari *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              placeholder="Ex: Score exact France vs Brésil"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description (optionnel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder="Détails supplémentaires..."
            />
          </div>

          {/* Match (required) */}
          <div>
            <label className="label">Match *</label>
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className="input-field"
              required
            >
              <option value="">-- Sélectionne un match --</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.teamA} vs {m.teamB} — {new Date(m.matchDate).toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>
          </div>

          {/* Points & Deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Points 🏅</label>
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value))}
                className="input-field"
                min={1}
                max={100}
              />
            </div>
            <div>
              <label className="label">Date limite ⏰</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-red-700 dark:text-red-300 text-sm">⚠️ {error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link to="/bets" className="btn-secondary flex-1 text-center">
              Annuler
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary flex-1"
            >
              {isLoading ? '⏳ Création...' : '🎯 Créer le pari !'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBet;
