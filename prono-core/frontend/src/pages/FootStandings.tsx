import { useEffect, useMemo, useState } from 'react';
import { getCompetitions, getStandings } from '@/api/competitions';
import type { CompetitionDto, FootStanding, FootStandingZone } from '@/types';
import TeamLogo from '@/components/TeamLogo';

const ZONE_STYLES: Record<FootStandingZone, { bar: string; label: string }> = {
  CHAMPIONS_LEAGUE: { bar: 'bg-blue-500', label: 'Ligue des Champions' },
  CHAMPIONS_LEAGUE_QUALIFYING: { bar: 'bg-blue-300', label: 'Qualifications Ligue des Champions' },
  RELEGATION_PLAYOFF: { bar: 'bg-amber-500', label: 'Barrage de relégation' },
  RELEGATION: { bar: 'bg-wc-red', label: 'Relégation' },
};

const StandingRow: React.FC<{ standing: FootStanding }> = ({ standing }) => {
  const zone = standing.zone ? ZONE_STYLES[standing.zone] : null;
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <td className="p-0 w-1.5">
        <div className={`w-1.5 h-full min-h-[2.5rem] ${zone?.bar ?? ''}`} />
      </td>
      <td className="py-2 pr-2 text-right font-black text-gray-400 w-8">{standing.position}</td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-2 min-w-0">
          <TeamLogo name={standing.teamName} crestUrl={standing.crestUrl} className="w-5 h-5 object-contain shrink-0" />
          <span className="font-bold text-gray-900 dark:text-white truncate">{standing.teamName}</span>
        </div>
      </td>
      <td className="py-2 px-1.5 text-center text-gray-600 dark:text-gray-300">{standing.played}</td>
      <td className="py-2 px-1.5 text-center text-gray-600 dark:text-gray-300">{standing.won}</td>
      <td className="py-2 px-1.5 text-center text-gray-600 dark:text-gray-300">{standing.draw}</td>
      <td className="py-2 px-1.5 text-center text-gray-600 dark:text-gray-300">{standing.lost}</td>
      <td className="py-2 px-1.5 text-center text-gray-500 dark:text-gray-400 hidden sm:table-cell">{standing.goalsFor}</td>
      <td className="py-2 px-1.5 text-center text-gray-500 dark:text-gray-400 hidden sm:table-cell">{standing.goalsAgainst}</td>
      <td className="py-2 px-1.5 text-center text-gray-600 dark:text-gray-300">
        {standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}
      </td>
      <td className="py-2 pl-1.5 pr-2 text-right font-black text-gray-900 dark:text-white">{standing.points}</td>
    </tr>
  );
};

const FootStandings: React.FC = () => {
  // Only competitions wired to a football-data.org code can show a table — for now that's
  // Ligue 1 alone. The World Cup has no standings worth showing, so it's left out entirely
  // rather than listed and disabled.
  const [competitions, setCompetitions] = useState<CompetitionDto[] | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [standings, setStandings] = useState<FootStanding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCompetitions(['FOOT'])
      .then((all) => {
        const eligible = all.filter((c) => c.footballDataCompetitionCode != null);
        setCompetitions(eligible);
        setSelectedCompetitionId(eligible[0]?.id ?? null);
      })
      .catch(() => setError('Impossible de charger les compétitions'));
  }, []);

  useEffect(() => {
    if (selectedCompetitionId == null) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    getStandings(selectedCompetitionId)
      .then(setStandings)
      .catch(() => setError('Impossible de charger le classement'))
      .finally(() => setIsLoading(false));
  }, [selectedCompetitionId]);

  const hasHighlightedZones = useMemo(() => standings.some((s) => s.zone != null), [standings]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="page-title mb-0">📊 Championnat</h1>
        {/* Hidden while there's nothing to choose between — same rule as CompetitionFilterPills. */}
        {competitions && competitions.length > 1 && (
          <select
            value={selectedCompetitionId ?? ''}
            onChange={(e) => setSelectedCompetitionId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-none focus:ring-2 focus:ring-wc-green"
          >
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{error}</div>
      )}

      {isLoading ? (
        <div className="card text-center py-12 text-gray-500">Chargement…</div>
      ) : !error && standings.length === 0 ? (
        <div className="card text-center py-12 space-y-2">
          <div className="text-5xl">⚽</div>
          <p className="text-gray-500 dark:text-gray-400">Le classement apparaîtra dès le début du championnat.</p>
        </div>
      ) : !error && (
        <>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[10px] uppercase text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="w-1.5" />
                <th className="py-2 pr-2 text-right">#</th>
                <th className="py-2 px-2 text-left">Équipe</th>
                <th className="py-2 px-1.5 text-center">J</th>
                <th className="py-2 px-1.5 text-center">G</th>
                <th className="py-2 px-1.5 text-center">N</th>
                <th className="py-2 px-1.5 text-center">P</th>
                <th className="py-2 px-1.5 text-center hidden sm:table-cell">BP</th>
                <th className="py-2 px-1.5 text-center hidden sm:table-cell">BC</th>
                <th className="py-2 px-1.5 text-center">Diff</th>
                <th className="py-2 pl-1.5 pr-2 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((standing) => (
                <StandingRow key={standing.position} standing={standing} />
              ))}
            </tbody>
          </table>
        </div>
        {hasHighlightedZones && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center text-xs text-gray-500 dark:text-gray-400">
            {Object.entries(ZONE_STYLES).map(([zone, style]) => (
              <span key={zone} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${style.bar}`} />
                {style.label}
              </span>
            ))}
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default FootStandings;
