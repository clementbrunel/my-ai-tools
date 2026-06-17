import { useEffect, useState } from 'react';
import { getLeaderboard, getGroupLeaderboard } from '../api/leaderboard';
import { getMyGroups } from '../api/groups';
import { getGroupPendingAssignments } from '../api/forfeits';
import type { GroupUserForfeit, LeaderboardEntry, Group } from '../types';
import LeaderboardRow from '../components/LeaderboardRow';
import ScrollableTableWrapper from '../components/ScrollableTableWrapper';
import { useAuth } from '../context/AuthContext';

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

interface PendingGagesSectionProps {
  gages: GroupUserForfeit[];
  currentUsername?: string;
}

const PendingGagesSection: React.FC<PendingGagesSectionProps> = ({ gages, currentUsername }) => {
  const byUser = groupByUser(gages);

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
        🃏 Gages en attente
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          — qui doit faire quoi ?
        </span>
      </h2>

      <div className="space-y-3">
        {Array.from(byUser.entries()).map(([username, userGages]) => {
          const first = userGages[0];
          const displayName = first.displayName || username;
          const isMe = username === currentUsername;

          return (
            <div
              key={username}
              className={`card p-4 border-l-4 ${isMe ? 'border-l-wc-red' : 'border-l-purple-400'}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {displayName[0].toUpperCase()}
                </div>
                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                  {displayName}
                  {isMe && <span className="ml-2 text-xs text-wc-red">(vous)</span>}
                </span>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                  {userGages.length} gage{userGages.length > 1 ? 's' : ''} à faire
                </span>
              </div>

              <ul className="space-y-2">
                {userGages.map((g) => (
                  <li key={g.id} className="flex items-start gap-2 text-sm">
                    <span className="text-purple-400 mt-0.5">›</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {g.forfeit.title}
                      </span>
                      {g.forfeit.description && (
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">
                          {g.forfeit.description}
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
  const [pendingGages, setPendingGages] = useState<GroupUserForfeit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load the user's groups and select the first one
  useEffect(() => {
    getMyGroups()
      .then((g) => {
        setGroups(g);
        if (g.length > 0) setSelectedGroupId(g[0].id);
      })
      .catch(console.error);
  }, []);

  // Load the leaderboard for the selected group (or global if the user has none)
  useEffect(() => {
    setIsLoading(true);
    const load = selectedGroupId != null ? getGroupLeaderboard(selectedGroupId) : getLeaderboard();
    load.then(setEntries).catch(console.error).finally(() => setIsLoading(false));

    if (selectedGroupId != null) {
      getGroupPendingAssignments(selectedGroupId).then(setPendingGages).catch(console.error);
    } else {
      setPendingGages([]);
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

  // Special badges
  const kingOfForfeits = entries.reduce(
    (prev, curr) => (curr.forfeitsReceived > prev.forfeitsReceived ? curr : prev),
    entries[0]
  );
  const worstLoser = entries[entries.length - 1];

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
          <p className="text-sm text-gray-500 dark:text-gray-400">Classement global</p>
        )}
      </div>

      {/* Special Badges */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {worstLoser && worstLoser.totalPoints === 0 ? null : worstLoser && entries.length > 1 && (
            <div className="card border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-center p-4">
              <div className="text-3xl mb-1">💀</div>
              <div className="font-bold text-gray-600 dark:text-gray-400 text-sm">Pire loser</div>
              <div className="text-xl font-black text-gray-700 dark:text-gray-300 mt-1">
                {worstLoser.user.displayName || worstLoser.user.username}
              </div>
              <div className="text-xs text-gray-500">
                {worstLoser.totalPoints} points 😅
              </div>
            </div>
          )}
        </div>
      )}

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
                  <div className={`w-9 h-9 rounded-full ${avatarColors[i]} text-white flex items-center justify-center font-black text-base shrink-0`}>
                    {name[0].toUpperCase()}
                  </div>
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
                <div className="w-16 h-16 rounded-full bg-gray-400 text-white flex items-center justify-center font-black text-xl mb-2">
                  {(top3[1].user.displayName || top3[1].user.username)[0].toUpperCase()}
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
                <div className="w-20 h-20 rounded-full bg-yellow-500 text-white flex items-center justify-center font-black text-2xl mb-2 ring-4 ring-yellow-300">
                  {(top3[0].user.displayName || top3[0].user.username)[0].toUpperCase()}
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
                <div className="w-16 h-16 rounded-full bg-orange-400 text-white flex items-center justify-center font-black text-xl mb-2">
                  {(top3[2].user.displayName || top3[2].user.username)[0].toUpperCase()}
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

      {/* Pending Gages Section — visible only in group mode */}
      {selectedGroupId != null && pendingGages.length > 0 && (
        <PendingGagesSection gages={pendingGages} currentUsername={user?.username} />
      )}
    </div>
  );
};

export default Leaderboard;
