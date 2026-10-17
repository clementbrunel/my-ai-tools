import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getTeam, getTeamMatches } from '@/api/teams';
import { getStandings } from '@/api/competitions';
import type { Team, Match, FootStanding } from '@/types';
import MatchRow from '@/components/MatchRow';
import TeamLogo from '@/components/TeamLogo';

type TeamTab = 'results' | 'upcoming';
type Outcome = 'W' | 'D' | 'L';

/** Only Ligue 1 exposes a standings table (same rule as FootStandings). */
const LIGUE1_CODE = 'FL1';

const OUTCOME_STYLES: Record<Outcome, { letter: string; singular: string; plural: string; tile: string; dot: string }> = {
  W: { letter: 'V', singular: 'Victoire', plural: 'Victoires', tile: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500' },
  D: { letter: 'N', singular: 'Match nul', plural: 'Nuls', tile: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300', dot: 'bg-gray-400' },
  L: { letter: 'D', singular: 'Défaite', plural: 'Défaites', tile: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-wc-red' },
};

const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => location.key === 'default' ? navigate('/foot/matches') : navigate(-1);

  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [standing, setStanding] = useState<FootStanding | null>(null);
  const [activeTab, setActiveTab] = useState<TeamTab>('results');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [teamData, matchesData] = await Promise.all([
          getTeam(parseInt(id)),
          getTeamMatches(parseInt(id)),
        ]);
        setTeam(teamData);
        setMatches(matchesData);

        // League rank/points are a bonus: a failure here must not hide the page.
        const league = matchesData.find((m) => m.competition.footballDataCompetitionCode === LIGUE1_CODE)?.competition;
        if (league) {
          getStandings(league.id)
            .then((rows) => setStanding(rows.find((r) => r.teamId === teamData.id) ?? null))
            .catch(() => setStanding(null));
        }
      } catch {
        setError('Équipe introuvable');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl animate-bounce-slow">⚽</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-gray-600 dark:text-gray-400">{error || 'Équipe introuvable'}</p>
        <button onClick={goBack} className="btn-primary mt-4 inline-block">
          Retour aux matchs
        </button>
      </div>
    );
  }

  const results = matches.filter((m) => m.status === 'FINISHED');
  const upcoming = matches.filter((m) => m.status !== 'FINISHED');
  const teamId = team.id;

  // Outcome of each finished match from this team's point of view, oldest first.
  const outcomes: Outcome[] = [...results]
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    .flatMap((m) => {
      if (m.scoreA == null || m.scoreB == null) return [];
      const mine = m.teamA.id === teamId ? m.scoreA : m.scoreB;
      const theirs = m.teamA.id === teamId ? m.scoreB : m.scoreA;
      return [mine > theirs ? 'W' : mine < theirs ? 'L' : 'D'];
    });
  const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
  const recentForm = outcomes.slice(-5);
  const leagueRow = standing && standing.teamId === teamId ? standing : null;

  const tabs: { id: TeamTab; label: string }[] = [
    { id: 'results', label: `✅ Résultats (${results.length})` },
    { id: 'upcoming', label: `📅 À venir (${upcoming.length})` },
  ];

  const shownMatches = activeTab === 'results' ? results : upcoming;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <button onClick={goBack} className="text-sm text-wc-green dark:text-green-400 hover:underline">
        ← Retour aux matchs
      </button>

      {/* ── Team header ── */}
      <div className="card text-center py-8">
        <div className="flex justify-center mb-3">
          <TeamLogo
            name={team.name}
            iso2={team.iso2}
            crestUrl={team.crestUrl}
            className="w-20 h-14 object-contain rounded shadow"
            fallbackClassName="text-6xl"
          />
        </div>
        <div className="text-2xl font-black text-gray-900 dark:text-white">{team.name}</div>
      </div>

      {/* ── Form summary ── */}
      {outcomes.length > 0 && (
        <div className="card space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {(['W', 'D', 'L'] as Outcome[]).map((o) => (
              <div key={o} className={`rounded-xl py-3 ${OUTCOME_STYLES[o].tile}`}>
                <div className="text-3xl font-black leading-none">{count(o)}</div>
                <div className="text-xs font-medium mt-1">{OUTCOME_STYLES[o].plural}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Forme</span>
              {recentForm.map((o, i) => (
                <span
                  key={i}
                  title={OUTCOME_STYLES[o].singular}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${OUTCOME_STYLES[o].dot}`}
                >
                  {OUTCOME_STYLES[o].letter}
                </span>
              ))}
            </div>
            {leagueRow && (
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <div className="text-xl font-black text-gray-900 dark:text-white">
                    {leagueRow.position}
                    <sup className="text-xs">{leagueRow.position === 1 ? 'er' : 'e'}</sup>
                  </div>
                  <div className="text-[10px] uppercase text-gray-400">Classement</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-gray-900 dark:text-white">{leagueRow.points}</div>
                  <div className="text-[10px] uppercase text-gray-400">Points</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile: native select */}
      <div className="md:hidden">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as TeamTab)}
          className="input-field w-full"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>{tab.label}</option>
          ))}
        </select>
      </div>

      {/* Desktop: tab strip */}
      <div className="hidden md:flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-wc-green text-wc-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {shownMatches.length > 0 ? (
        <div className="flex flex-col gap-1">
          {shownMatches.map((match) => (
            <MatchRow key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-3">😅</div>
          <p>{activeTab === 'results' ? 'Aucun résultat pour le moment' : 'Aucun match à venir'}</p>
        </div>
      )}
    </div>
  );
};

export default TeamDetail;
