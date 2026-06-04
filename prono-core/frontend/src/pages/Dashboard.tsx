import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMatches } from '../api/matches';
import { getLeaderboard } from '../api/leaderboard';
import { getDashboardStats } from '../api/dashboard';
import type { GroupRankEntry } from '../api/dashboard';
import { getDailyGagesByDate, voteOnCandidate } from '../api/dailyGages';
import type { Match, LeaderboardEntry, DailyGage } from '../types';
import MatchCard from '../components/MatchCard';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [todayGages, setTodayGages] = useState<DailyGage[]>([]);
  const [upcomingMatchCount, setUpcomingMatchCount] = useState<number>(0);
  const [groupRanks, setGroupRanks] = useState<GroupRankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0]; // "2026-06-11"

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchesData, leaderboardData, statsData] = await Promise.all([
          getMatches(),
          getLeaderboard(),
          getDashboardStats(),
        ]);
        setMatches(matchesData);
        setLeaderboard(leaderboardData);
        setUpcomingMatchCount(statsData.upcomingMatchesInMyGroups);
        setGroupRanks(statsData.groupRanks);

        // Load today's gages across the user's groups (empty if none configured)
        try {
          setTodayGages(await getDailyGagesByDate(today));
        } catch {
          // No gage today — that's fine
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [today]);

  const handleVote = async (gageId: number, forfeitId: number, vote: number) => {
    try {
      const updated = await voteOnCandidate(gageId, forfeitId, vote);
      setTodayGages((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch {
      alert('Erreur lors du vote');
    }
  };

  const upcomingMatches = matches.filter((m) => m.status === 'UPCOMING');
  const userRank = leaderboard.find((e) => e.user.username === user?.username);
  const hasMultipleGroups = groupRanks.length > 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-5xl animate-bounce-slow">⚽</div>
          <p className="text-gray-500 mt-3">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="wc-header rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black mb-1">Salut {user?.username} ! ⚽</h1>
            <p className="text-green-200">🏆 Coupe du Monde 2026 — Les paris sont ouverts !</p>
          </div>
          <div className="text-6xl hidden md:block animate-bounce-slow">🏆</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="stat-value">{upcomingMatchCount}</div>
          <div className="stat-label">⚽ Matchs à venir</div>
        </div>

        {/* Classement — un badge par groupe si plusieurs groupes */}
        <div className="stat-card">
          {!hasMultipleGroups ? (
            <>
              <div className="stat-value text-wc-gold">{userRank ? `#${userRank.rank}` : '-'}</div>
              <div className="stat-label">🏅 Votre classement</div>
            </>
          ) : (
            <>
              <div className="stat-label mb-2">🏅 Votre classement</div>
              <div className="space-y-1">
                {groupRanks.map((gr) => (
                  <div key={gr.groupId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400 truncate max-w-[60%]">{gr.groupName}</span>
                    <span className="font-bold text-wc-gold">#{gr.rank}<span className="text-xs text-gray-400 font-normal">/{gr.total}</span></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Points — globaux ou par groupe */}
        <div className="stat-card">
          {!hasMultipleGroups ? (
            <>
              <div className="stat-value">{user?.globalScore ?? 0}</div>
              <div className="stat-label">⭐ Vos points</div>
            </>
          ) : (
            <>
              <div className="stat-label mb-2">⭐ Vos points</div>
              <div className="space-y-1">
                {groupRanks.map((gr) => (
                  <div key={gr.groupId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400 truncate max-w-[60%]">{gr.groupName}</span>
                    <span className="font-bold">{gr.points}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <Link to="/leaderboard" className="text-xs text-wc-green dark:text-green-400 hover:underline mt-2 block">
            Classement complet →
          </Link>
        </div>
      </div>

      {/* Daily Gage Widget — one per group that configured one today */}
      {todayGages.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">🃏 Gage du jour</h2>

          {todayGages.map((g) => (
            <div key={g.id} className="space-y-2">
              {todayGages.length > 1 && (
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">👥 {g.groupName}</p>
              )}

              {g.status === 'SETTLED' ? (
                <div className="card border-2 border-wc-red bg-red-50 dark:bg-red-900/10">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">😬</div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Gage attribué</p>
                      <p className="text-xl font-black text-wc-red">{g.forfeit?.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{g.forfeit?.description}</p>
                      <p className="text-sm mt-2 font-medium">
                        👎 <span className="text-wc-red">{g.assignedToUsername}</span> devra l'effectuer
                      </p>
                    </div>
                  </div>
                </div>
              ) : g.status === 'ACTIVE' && g.mode === 'DIRECT' && g.forfeit ? (
                <div className="card border-2 border-wc-green">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">🃏</div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Gage de la journée — le moins bon joueur l'écopera !</p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">{g.forfeit.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{g.forfeit.description}</p>
                    </div>
                  </div>
                </div>
              ) : g.mode === 'VOTE' && g.candidates.length > 0 ? (
                <div className="card border-2 border-wc-gold">
                  <p className="text-sm text-gray-500 mb-3">
                    🗳️ Vote pour le gage du jour — le moins bon joueur écopera du gagnant !
                  </p>
                  <div className="space-y-3">
                    {g.candidates.map((c) => {
                      const isLiked = c.userVote === 1;
                      const isDisliked = c.userVote === -1;
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{c.forfeit.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{c.forfeit.description}</div>
                          </div>
                          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                            <span className={`text-sm font-semibold ${c.voteScore > 0 ? 'text-green-500' : c.voteScore < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                              {c.voteScore > 0 ? '+' : ''}{c.voteScore}
                            </span>
                            <button
                              onClick={() => handleVote(g.id, c.forfeit.id, isLiked ? 0 : 1)}
                              className={`text-lg transition-transform hover:scale-125 ${isLiked ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
                              title="Pour"
                            >
                              👍
                            </button>
                            <button
                              onClick={() => handleVote(g.id, c.forfeit.id, isDisliked ? 0 : -1)}
                              className={`text-lg transition-transform hover:scale-125 ${isDisliked ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
                              title="Contre"
                            >
                              👎
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="card border border-dashed text-center py-6 text-gray-400">
                  🃏 Gage du jour en attente de configuration par l'admin du groupe
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Upcoming Matches */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">⚽ Prochains matchs</h2>
          <Link to="/matches" className="text-sm text-wc-green dark:text-green-400 hover:underline">
            Voir tous →
          </Link>
        </div>
        {upcomingMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.slice(0, 6).map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <div className="card text-center text-gray-500 dark:text-gray-400 py-8">
            Pas de match à venir pour le moment
          </div>
        )}
      </section>

    </div>
  );
};

export default Dashboard;
