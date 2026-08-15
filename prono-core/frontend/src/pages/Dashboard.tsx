import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getMatches } from '@/api/matches';
import { getDashboardStats } from '@/api/dashboard';
import { getCompetitions } from '@/api/competitions';
import type { GroupRankEntry } from '@/api/dashboard';
import type { Match } from '@/types';
import MatchCard from '@/components/MatchCard';
import MatchRow from '@/components/MatchRow';
import GroupRankTile from '@/components/GroupRankTile';
import DailyGageWidget from '@/components/DailyGageWidget';
import { formatDate } from '@/utils/dates';
import { logger } from '@/utils/logger';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [upcomingMatchCount, setUpcomingMatchCount] = useState<number>(0);
  const [groupRanks, setGroupRanks] = useState<GroupRankEntry[]>([]);
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCompetitionNames, setActiveCompetitionNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchesData, statsData, competitionsData] = await Promise.all([
          getMatches(),
          getDashboardStats('FOOT'),
          getCompetitions(['FOOT']),
        ]);
        setMatches(matchesData);
        setUpcomingMatchCount(statsData.upcomingMatchesInMyGroups);
        setGroupRanks(statsData.groupRanks);
        setActiveCompetitionNames(competitionsData.filter((c) => c.active).map((c) => c.name));
      } catch (err) {
        logger.error('Error loading dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const upcomingMatches = matches.filter((m) => m.status === 'UPCOMING');

  // Last matchday with finished matches — grouped by calendar day, same as the Matches page.
  const lastResults = useMemo(() => {
    const finished = matches.filter((m) => m.status === 'FINISHED');
    if (finished.length === 0) return null;
    const lastDay = finished.reduce((max, m) => {
      const day = m.matchDate.slice(0, 10);
      return day > max ? day : max;
    }, finished[0].matchDate.slice(0, 10));
    return { day: lastDay, matches: finished.filter((m) => m.matchDate.slice(0, 10) === lastDay) };
  }, [matches]);

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
            <p className="text-green-200">
              🏆 {activeCompetitionNames.length > 0 ? activeCompetitionNames.join(' & ') : 'Foot'} — Les paris sont ouverts !
            </p>
          </div>
          <div className="text-6xl hidden md:block animate-bounce-slow">🏆</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/foot/matches" className="stat-card hover:ring-2 hover:ring-wc-green transition-all cursor-pointer">
          <div className="stat-value">{upcomingMatchCount}</div>
          <div className="stat-label">⚽ Matchs à venir</div>
        </Link>

        <GroupRankTile
          groupRanks={groupRanks}
          selectedGroupIdx={selectedGroupIdx}
          onSelectGroupIdx={setSelectedGroupIdx}
          leaderboardPath="/foot/leaderboard"
        />
      </div>

      <DailyGageWidget allowedGroupIds={groupRanks.map((g) => g.groupId)} />

      {/* Upcoming Matches */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">⚽ Prochains matchs</h2>
          <Link to="/foot/matches" className="text-sm text-wc-green dark:text-green-400 hover:underline">
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

      {/* Last results — one full-width tile with the last matchday's finished matches */}
      {lastResults && (
        <div className="card space-y-1">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900 dark:text-white">📅 Dernier résultat</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(lastResults.day)}</span>
          </div>
          <div className="space-y-1">
            {lastResults.matches.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
