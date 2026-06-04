import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getForfeits, proposeForfeit } from '../api/forfeits';
import type { Forfeit } from '../types';

const categoryEmoji: Record<string, string> = {
  Nourriture: '🥐',
  Humiliation: '😳',
  Spectacle: '🎭',
  'Réseaux sociaux': '📱',
  Boissons: '🍻',
  General: '🃏',
};

const Gages: React.FC = () => {
  const { user } = useAuth();
  const [forfeits, setForfeits] = useState<Forfeit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Propose form
  const [showPropose, setShowPropose] = useState(false);
  const [propTitle, setPropTitle] = useState('');
  const [propDesc, setPropDesc] = useState('');
  const [propCategory, setPropCategory] = useState('General');
  const [propError, setPropError] = useState('');
  const [propSuccess, setPropSuccess] = useState('');

  useEffect(() => {
    getForfeits()
      .then(setForfeits)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    setPropError('');
    setPropSuccess('');
    try {
      const created = await proposeForfeit(propTitle, propDesc, propCategory);
      setForfeits((prev) => [...prev, created]);
      setPropTitle('');
      setPropDesc('');
      setPropCategory('General');
      setPropSuccess('✅ Gage proposé avec succès !');
      setShowPropose(false);
    } catch {
      setPropError('Erreur lors de la proposition du gage');
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl">🃏</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  const categories = [...new Set(forfeits.map((f) => f.category))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title mb-0">🃏 Bibliothèque des gages</h1>
        <button
          onClick={() => setShowPropose(!showPropose)}
          className="btn-primary text-sm"
        >
          + Proposer un gage
        </button>
      </div>

      {propSuccess && (
        <div className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
          <p className="text-green-700 dark:text-green-300 text-sm">{propSuccess}</p>
        </div>
      )}

      {/* Propose form */}
      {showPropose && (
        <div className="card border-2 border-wc-green">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">💡 Proposer un nouveau gage</h3>
          <form onSubmit={handlePropose} className="space-y-3">
            <div>
              <label className="label">Titre *</label>
              <input
                type="text"
                value={propTitle}
                onChange={(e) => setPropTitle(e.target.value)}
                className="input-field"
                placeholder="Ex: Chanter une chanson en public"
                required
              />
            </div>
            <div>
              <label className="label">Description *</label>
              <textarea
                value={propDesc}
                onChange={(e) => setPropDesc(e.target.value)}
                className="input-field min-h-[80px]"
                placeholder="Décris le gage en détail..."
                required
              />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select
                value={propCategory}
                onChange={(e) => setPropCategory(e.target.value)}
                className="input-field"
              >
                {['General', 'Nourriture', 'Humiliation', 'Spectacle', 'Réseaux sociaux', 'Boissons'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {propError && <p className="text-red-500 text-sm">{propError}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowPropose(false)} className="btn-secondary flex-1">
                Annuler
              </button>
              <button type="submit" className="btn-primary flex-1">
                Proposer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Forfeit cards by category */}
      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-3">
            {categoryEmoji[cat] || '🃏'} {cat}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forfeits
              .filter((f) => f.category === cat)
              .map((forfeit) => (
                <div
                  key={forfeit.id}
                  className="card flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white">{forfeit.title}</h3>
                    {forfeit.timesCompleted > 0 && (
                      <span
                        title={`Effectué ${forfeit.timesCompleted} fois`}
                        className="flex-shrink-0 text-xs bg-wc-gold/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold"
                      >
                        ✅ ×{forfeit.timesCompleted}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{forfeit.description}</p>
                  {forfeit.proposedByUsername && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-auto">
                      💡 Proposé par <span className="font-medium">{forfeit.proposedByUsername}</span>
                    </p>
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}

      {forfeits.length === 0 && (
        <div className="card text-center py-12 text-gray-500">
          <div className="text-5xl mb-3">🃏</div>
          <p>Aucun gage dans la bibliothèque.</p>
          <p className="text-sm mt-1">Sois le premier à en proposer un !</p>
        </div>
      )}

      {/* Stats footer */}
      {forfeits.length > 0 && (
        <div className="text-center text-sm text-gray-400 dark:text-gray-500">
          {forfeits.length} gage{forfeits.length > 1 ? 's' : ''} •{' '}
          {forfeits.filter((f) => f.proposedByUsername).length} proposé{forfeits.filter((f) => f.proposedByUsername).length > 1 ? 's' : ''} par des joueurs •{' '}
          {forfeits.reduce((sum, f) => sum + f.timesCompleted, 0)} fois effectué{forfeits.reduce((sum, f) => sum + f.timesCompleted, 0) > 1 ? 's' : ''} au total
        </div>
      )}
    </div>
  );
};

export default Gages;
