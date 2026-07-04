import { useEffect, useState } from 'react';
import { getGroupLeaderboard } from '../api/leaderboard';
import { getMyGroups } from '../api/groups';
import { getGroupAssignments } from '../api/forfeits';
import type { GroupUserForfeit, LeaderboardEntry, Group } from '../types';
import LeaderboardRow from '../components/LeaderboardRow';
import NoGroupBanner from '../components/NoGroupBanner';
import Avatar from '../components/Avatar';
import ScrollableTableWrapper from '../components/ScrollableTableWrapper';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';

// ─── Pending Gages Section ────────────────────────────────────────────────────

const categoryColor: Record<string, string> = {
  General:         'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  Nourriture:      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Humiliation:     'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  Spectacle:       'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Réseaux sociaux': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Boissons:        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

function groupByUser(gages: GroupUserForfeit[]): Map<string, GroupUserForfeit[]> {
  const map = new Map<string, GroupUserForfeit[]>();
  for (const g of gages) {
    const key = g.username;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  }
  return map;
}

interface GagesSectionProps {
  gages: GroupUserForfeit[];
  currentUsername?: string;
  completed?: boolean;
}

const GagesSection: React.FC<GagesSectionProps> = ({ gages, currentUsername, completed = false }) => {
  const byUser = groupByUser(gages);

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {Array.from(byUser.entries()).map(([username, userGages]) => {
          const first = userGages[0];
          const displayName = first.displayName || username;
          const isMe = username === currentUsername;
          const borderColor = completed
            ? (isMe ? 'border-l-green-500' : 'border-l-green-400')
            : (isMe ? 'border-l-wc-red' : 'border-l-purple-400');
          const avatarColor = completed ? 'bg-green-500' : 'bg-purple-500';
          const bulletColor = completed ? 'text-green-400' : 'text-purple-400';
          const countLabel = completed
            ? `${userGages.length} gage${userGages.length > 1 ? 's' : ''} effectué${userGages.length > 1 ? 's' : ''}`
            : `${userGages.length} gage${userGages.length > 1 ? 's' : ''} à faire`;

          return (
            <div
              key={username}
              className={`card p-4 border-l-4 ${borderColor}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Avatar
                  src={first.avatarUrl}
                  alt={displayName}
                  fallbackText={displayName[0].toUpperCase()}
                  sizeClassName="w-8 h-8 shrink-0"
                  containerClassName={`${avatarColor} text-white font-bold text-sm`}
                />
                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                  {displayName}
                  {isMe && <span className="ml-2 text-xs text-wc-red">(vous)</span>}
                </span>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                  {countLabel}
                </span>
              </div>

              <ul className="space-y-2">
                {userGages.map((g) => (
                  <li key={g.id} className="flex items-start gap-2 text-sm">
                    <span className={`${bulletColor} mt-0.5`}>{completed ? '✓' : '›'}</span>
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${completed ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
                        {g.forfeit.title}
                      </span>
                      {g.forfeit.description && (
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">
                          {g.forfeit.description}
                        </p>
                      )}
                      {completed && g.completedAt && (
                        <p className="text-green-500 dark:text-green-400 text-xs mt-0.5">
                          Fait le {new Date(g.completedAt).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor[g.forfeit.category] ?? categoryColor['General']}`}>
                      {g.forfeit.category}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Leaderboard Page ─────────────────────────────────────────────────────────

const Leaderboard: React.FC = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [allGages, setAllGages] = useState<GroupUserForfeit[]>([]);
  const [gagesFilter, setGagesFilter] = useState<'pending' | 'completed'>('pending');
  const [isLoading, setIsLoading] = useState(true);

  // Load the user's groups and select the first one
  useEffect(() => {
    getMyGroups()
      .then((g) => {
        setGroups(g);
        if (g.length > 0) setSelectedGroupId(g[0].id);
      })
      .catch(logger.error);
  }, []);

  // Load the leaderboard for the selected group
  useEffect(() => {
    if (selectedGroupId == null) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    getGroupLeaderboard(selectedGroupId).then(setEntries).catch(logger.error).finally(() => setIsLoading(false));

    if (selectedGroupId != null) {
      getGroupAssignments(selectedGroupId).then(setAllGages).catch(logger.error);
    } else {
      setAllGages([]);
    }
  }, [selectedGroupId]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl animate-bounce-slow">🏆</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  const top3 = entries.slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title mb-0">🏆 Classement</h1>
        {groups.length > 0 ? (
          <div className="flex items-center gap-2">
            <label className="label mb-0">Groupe</label>
            <select
              value={selectedGroupId ?? ''}
              onChange={(e) => setSelectedGroupId(Number(e.target.value))}
              className="input-field"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <NoGroupBanner message="Rejoins ou crée un groupe pour voir le classement." />
        )}
      </div>


      {/* Podium Top 3 */}
      {top3.length > 0 && (
        <>
          {/* Mobile podium: vertical list 1→2→3 */}
          <div className="md:hidden space-y-2">
            {top3.map((entry, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              const avatarColors = ['bg-yellow-500 ring-2 ring-yellow-300', 'bg-gray-400', 'bg-orange-400'];
              const name = entry.user.displayName || entry.user.username;
              return (
                <div key={entry.user.id} className="flex items-center gap-3 card p-3">
                  <span className="text-2xl w-8 text-center">{medals[i]}</span>
                  <Avatar
                    src={entry.user.avatarUrl}
                    alt={name}
                    fallbackText={name[0].toUpperCase()}
                    sizeClassName="w-9 h-9 shrink-0"
                    containerClassName={`${avatarColors[i]} text-white font-black text-base`}
                  />
                  <span className="font-bold text-sm text-gray-900 dark:text-white flex-1 truncate">{name}</span>
                  <span className="font-black text-lg text-gray-800 dark:text-white">{entry.totalPoints}</span>
                  <span className="text-xs text-gray-500">pts</span>
                </div>
              );
            })}
          </div>

          {/* Desktop podium: 2nd / 1st / 3rd side-by-side with bars */}
          <div className="hidden md:flex items-end justify-center gap-4 py-6">
            {/* 2nd place */}
            {top3[1] && (
              <div className="flex flex-col items-center">
                <div className="text-4xl mb-2">🥈</div>
                <div className="mb-2">
                  <Avatar
                    src={top3[1].user.avatarUrl}
                    alt={top3[1].user.displayName || top3[1].user.username}
                    fallbackText={(top3[1].user.displayName || top3[1].user.username)[0].toUpperCase()}
                    sizeClassName="w-16 h-16"
                    containerClassName="bg-gray-400 text-white font-black text-xl"
                  />
                </div>
                <div className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-1">{top3[1].user.displayName || top3[1].user.username}</div>
                <div className="podium-2 rounded-t-lg w-20 h-20 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-black text-gray-700">{top3[1].totalPoints}</div>
                    <div className="text-xs text-gray-600">pts</div>
                  </div>
                </div>
              </div>
            )}

            {/* 1st place */}
            {top3[0] && (
              <div className="flex flex-col items-center">
                <div className="text-4xl mb-2 animate-bounce-slow">🥇</div>
                <div className="mb-2 ring-4 ring-yellow-300 rounded-full">
                  <Avatar
                    src={top3[0].user.avatarUrl}
                    alt={top3[0].user.displayName || top3[0].user.username}
                    fallbackText={(top3[0].user.displayName || top3[0].user.username)[0].toUpperCase()}
                    sizeClassName="w-20 h-20"
                    containerClassName="bg-yellow-500 text-white font-black text-2xl"
                  />
                </div>
                <div className="font-black text-base text-gray-800 dark:text-white mb-1">{top3[0].user.displayName || top3[0].user.username}</div>
                <div className="podium-1 rounded-t-lg w-20 h-28 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-black text-yellow-900">{top3[0].totalPoints}</div>
                    <div className="text-xs text-yellow-800">pts</div>
                  </div>
                </div>
              </div>
            )}

            {/* 3rd place */}
            {top3[2] && (
              <div className="flex flex-col items-center">
                <div className="text-4xl mb-2">🥉</div>
                <div className="mb-2">
                  <Avatar
                    src={top3[2].user.avatarUrl}
                    alt={top3[2].user.displayName || top3[2].user.username}
                    fallbackText={(top3[2].user.displayName || top3[2].user.username)[0].toUpperCase()}
                    sizeClassName="w-16 h-16"
                    containerClassName="bg-orange-400 text-white font-black text-xl"
                  />
                </div>
                <div className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-1">{top3[2].user.displayName || top3[2].user.username}</div>
                <div className="podium-3 rounded-t-lg w-20 h-14 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xl font-black text-orange-900">{top3[2].totalPoints}</div>
                    <div className="text-xs text-orange-800">pts</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Full Table */}
      <div className="card overflow-hidden p-0">
        <ScrollableTableWrapper>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Rang</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Joueur</th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase">Points</th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase">Paris gagnés</th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase">Gages 🃏</th>
                {selectedGroupId && <th className="py-3 px-4 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <LeaderboardRow
                  key={entry.user.id}
                  entry={entry}
                  isCurrentUser={entry.user.username === user?.username}
                  groupId={selectedGroupId}
                />
              ))}
            </tbody>
          </table>
        </ScrollableTableWrapper>
      </div>

      {/* Gages Section — visible only in group mode */}
      {selectedGroupId != null && allGages.length > 0 && (() => {
        const pendingGages = allGages.filter((g) => !g.completed);
        const completedGages = allGages.filter((g) => g.completed);
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                🃏 Gages
              </h2>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-sm">
                <button
                  onClick={() => setGagesFilter('pending')}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    gagesFilter === 'pending'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  En attente
                  {pendingGages.length > 0 && (
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${gagesFilter === 'pending' ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      {pendingGages.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setGagesFilter('completed')}
                  className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-200 dark:border-gray-700 ${
                    gagesFilter === 'completed'
                      ? 'bg-green-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Effectués
                  {completedGages.length > 0 && (
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${gagesFilter === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      {completedGages.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {gagesFilter === 'pending' && pendingGages.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucun gage en attente 🎉</p>
            )}
            {gagesFilter === 'completed' && completedGages.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucun gage effectué pour le moment.</p>
            )}

            {gagesFilter === 'pending' && pendingGages.length > 0 && (
              <GagesSection gages={pendingGages} currentUsername={user?.username} completed={false} />
            )}
            {gagesFilter === 'completed' && completedGages.length > 0 && (
              <GagesSection gages={completedGages} currentUsername={user?.username} completed={true} />
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default Leaderboard;
