import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getTeam, getTeamMatches } from '@/api/teams';
import type { Team, Match } from '@/types';
import { getFlagUrl } from '@/utils/countryFlags';
import MatchRow from '@/components/MatchRow';

type TeamTab = 'results' | 'upcoming';

const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => location.key === 'default' ? navigate('/foot/matches') : navigate(-1);

  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
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
          {getFlagUrl(team.iso2)
            ? <img src={getFlagUrl(team.iso2)!} alt={team.name} className="w-20 h-14 object-contain rounded shadow" />
            : <span className="text-6xl">🏳️</span>}
        </div>
        <div className="text-2xl font-black text-gray-900 dark:text-white">{team.name}</div>
      </div>

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
