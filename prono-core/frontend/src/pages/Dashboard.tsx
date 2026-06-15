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
import DailyGageCard from '../components/DailyGageCard';
import { useToast } from '../components/Toast';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
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
      showToast('Erreur lors du vote');
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
            <h1 className="text-3xl font-black mb-1">Salut {user?.displayName || user?.username} ! ⚽</h1>
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
            <DailyGageCard key={g.id} gage={g} onVote={handleVote} showGroupName={todayGages.length > 1} />
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
