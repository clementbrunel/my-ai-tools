import { useEffect, useState } from 'react';
import { getLeaderboard, getGroupLeaderboard } from '../api/leaderboard';
import { getMyGroups } from '../api/groups';
import type { LeaderboardEntry, Group } from '../types';
import LeaderboardRow from '../components/LeaderboardRow';
import { useAuth } from '../context/AuthContext';

const Leaderboard: React.FC = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
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
  const rest = entries.slice(3);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kingOfForfeits?.forfeitsReceived > 0 && (
            <div className="card border-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/10 text-center p-4">
              <div className="text-3xl mb-1">🃏</div>
              <div className="font-bold text-purple-800 dark:text-purple-300 text-sm">Roi des gages</div>
              <div className="text-xl font-black text-purple-900 dark:text-purple-200 mt-1">
                {kingOfForfeits.user.displayName || kingOfForfeits.user.username}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400">
                {kingOfForfeits.forfeitsReceived} gage{kingOfForfeits.forfeitsReceived > 1 ? 's' : ''} reçu{kingOfForfeits.forfeitsReceived > 1 ? 's' : ''}
              </div>
            </div>
          )}
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
        <div className="flex items-end justify-center gap-4 py-6">
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
      )}

      {/* Full Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Rang</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Joueur</th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase">Points</th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase">Paris gagnés</th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase">Gages 🃏</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <LeaderboardRow
                  key={entry.user.id}
                  entry={entry}
                  isCurrentUser={entry.user.username === user?.username}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
