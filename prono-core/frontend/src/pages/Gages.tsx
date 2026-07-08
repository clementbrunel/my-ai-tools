import { useEffect, useState } from 'react';
import { getForfeits, proposeForfeit, voteForfeit } from '../api/forfeits';
import { getMyGroups } from '../api/groups';
import type { Forfeit, Group } from '../types';
import { logger } from '../utils/logger';

const categoryEmoji: Record<string, string> = {
  Nourriture: '🥐',
  Humiliation: '😳',
  Spectacle: '🎭',
  'Réseaux sociaux': '📱',
  Boissons: '🍻',
  General: '🃏',
};

const GAGE_EMOJIS = [
  '🎯','🃏','🤪','😬','🙈','🤡','🥵','🥴','😤','🤢',
  '🫣','🫡','🤓','😈','👀','🫠','🤸','💃','🎤','🍕',
  '🍺','🌶️','🎭','📸','🎬','🧃','🚀','🪄','🎲','🏆',
];
const DEFAULT_GAGE_EMOJI = '🎯';

const Gages: React.FC = () => {
  const [forfeits, setForfeits] = useState<Forfeit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Propose form
  const [filter, setFilter] = useState<'all' | 'shared' | 'groups'>('all');
  const [showPropose, setShowPropose] = useState(false);
  const [propEmoji, setPropEmoji] = useState(DEFAULT_GAGE_EMOJI);
  const [propTitle, setPropTitle] = useState('');
  const [propDesc, setPropDesc] = useState('');
  const [propCategory, setPropCategory] = useState('General');
  const [propGroupId, setPropGroupId] = useState<number | ''>('');
  const [propError, setPropError] = useState('');
  const [propSuccess, setPropSuccess] = useState('');

  useEffect(() => {
    Promise.all([getForfeits(), getMyGroups()])
      .then(([f, g]) => {
        setForfeits(f);
        setGroups(g);
        if (g.length > 0) setPropGroupId(g[0].id);
      })
      .catch(logger.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleVote = async (forfeitId: number, vote: 1 | -1 | 0) => {
    try {
      const updated = await voteForfeit(forfeitId, vote);
      setForfeits((prev) =>
        prev.map((f) =>
          f.id === forfeitId ? { ...f, voteScore: updated.voteScore, userVote: updated.userVote } : f
        )
      );
    } catch (err) {
      logger.error('Vote error', err);
    }
  };

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    setPropError('');
    setPropSuccess('');
    if (propGroupId === '') {
      setPropError('Choisissez un groupe pour ce gage.');
      return;
    }
    try {
      const emoji = propEmoji || DEFAULT_GAGE_EMOJI;
      const created = await proposeForfeit(propGroupId, `${emoji} ${propTitle}`, propDesc, propCategory);
      setForfeits((prev) => [...prev, created]);
      setPropEmoji(DEFAULT_GAGE_EMOJI);
      setPropTitle('');
      setPropDesc('');
      setPropCategory('General');
      setPropSuccess('✅ Gage ajouté à votre groupe !');
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

  const filteredForfeits = forfeits.filter((f) => {
    if (filter === 'shared') return !f.groupId;
    if (filter === 'groups') return !!f.groupId;
    return true;
  });

  const categories = [...new Set(filteredForfeits.map((f) => f.category))].sort();

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

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'shared', 'groups'] as const).map((tab) => {
          const labels = { all: '🃏 Tous', shared: '🌍 Partagés', groups: '🔒 Mes groupes' };
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === tab
                  ? 'bg-wc-green text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
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
              <label className="label">Icône</label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                {GAGE_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setPropEmoji(e)}
                    className={`text-xl w-9 h-9 flex items-center justify-center rounded-md transition-colors ${
                      propEmoji === e
                        ? 'bg-wc-green text-white shadow-sm'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Titre *</label>
              <div className="flex items-center gap-2">
                <span className="text-2xl w-9 text-center flex-shrink-0">{propEmoji}</span>
                <input
                  type="text"
                  value={propTitle}
                  onChange={(e) => setPropTitle(e.target.value)}
                  className="input-field flex-1"
                  placeholder="Ex: Chanter une chanson en public"
                  required
                />
              </div>
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
            <div>
              <label className="label">Groupe</label>
              {groups.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Rejoignez un groupe pour pouvoir ajouter un gage.
                </p>
              ) : (
                <>
                  <select
                    value={propGroupId}
                    onChange={(e) => setPropGroupId(Number(e.target.value))}
                    className="input-field"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Ce gage restera privé à ce groupe.
                  </p>
                </>
              )}
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
            {filteredForfeits
              .filter((f) => f.category === cat)
              .map((forfeit) => {
                const userVote = forfeit.userVote ?? 0;
                const voteScore = forfeit.voteScore ?? 0;
                return (
                  <div key={forfeit.id} className="card flex flex-col gap-2">
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
                    <span
                      className={`self-start text-xs px-2 py-0.5 rounded-full font-medium ${
                        forfeit.groupId
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {forfeit.groupId ? `🔒 ${forfeit.groupName}` : '🌍 Partagé'}
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{forfeit.description}</p>
                    {forfeit.proposedByUsername && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        💡 Proposé par <span className="font-medium">{forfeit.proposedByDisplayName || forfeit.proposedByUsername}</span>
                      </p>
                    )}
                    {/* Vote row */}
                    <div className="flex items-center gap-1 mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() => handleVote(forfeit.id, userVote === 1 ? 0 : 1)}
                        title="J'aime"
                        className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors text-base ${
                          userVote === 1
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-green-500'
                        }`}
                      >
                        ▲
                      </button>
                      <span
                        className={`w-8 text-center text-sm font-semibold tabular-nums ${
                          voteScore > 0
                            ? 'text-green-600 dark:text-green-400'
                            : voteScore < 0
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {voteScore > 0 ? `+${voteScore}` : voteScore}
                      </span>
                      <button
                        onClick={() => handleVote(forfeit.id, userVote === -1 ? 0 : -1)}
                        title="Je n'aime pas"
                        className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors text-base ${
                          userVote === -1
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-500'
                        }`}
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}

      {filteredForfeits.length === 0 && (
        <div className="card text-center py-12 text-gray-500">
          <div className="text-5xl mb-3">🃏</div>
          <p>Aucun gage dans cette catégorie.</p>
          <p className="text-sm mt-1">Sois le premier à en proposer un !</p>
        </div>
      )}

      {/* Stats footer */}
      {filteredForfeits.length > 0 && (
        <div className="text-center text-sm text-gray-400 dark:text-gray-500">
          {filteredForfeits.length} gage{filteredForfeits.length > 1 ? 's' : ''} •{' '}
          {filteredForfeits.filter((f) => f.proposedByUsername).length} proposé{filteredForfeits.filter((f) => f.proposedByUsername).length > 1 ? 's' : ''} par des joueurs •{' '}
          {filteredForfeits.reduce((sum, f) => sum + f.timesCompleted, 0)} fois effectué{filteredForfeits.reduce((sum, f) => sum + f.timesCompleted, 0) > 1 ? 's' : ''} au total
        </div>
      )}
    </div>
  );
};

export default Gages;
