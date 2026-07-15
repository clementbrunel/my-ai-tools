import { Link } from 'react-router-dom';
import type { Match } from '@/types';
import { formatDate, formatTime } from '@/utils/dates';
import { getFlagUrl } from '@/utils/countryFlags';
import { buildBracketData } from '@/utils/bracket';

interface BracketViewProps {
  matches: Match[];
  highlight?: string;
}

const CARD_HEIGHT = 84;
const GAP = 16;

const TeamFlag: React.FC<{ name: string; iso2?: string | null }> = ({ name, iso2 }) => {
  const url = getFlagUrl(iso2);
  return url
    ? <img src={url} alt={name} className="w-5 h-4 object-contain rounded-sm shadow-sm shrink-0" />
    : <span className="shrink-0">🏳️</span>;
};

const BracketMatchCard: React.FC<{ match: Match; highlight?: string }> = ({ match, highlight }) => {
  const q = highlight?.trim().toLowerCase();
  const isHighlighted =
    !!q && (match.teamA.name.toLowerCase().includes(q) || match.teamB.name.toLowerCase().includes(q));

  const teamRow = (team: Match['teamA'], score?: number, won?: boolean) => (
    <div className={`flex items-center gap-1.5 min-w-0 ${won ? 'font-bold' : 'font-medium'}`}>
      <TeamFlag name={team.name} iso2={team.iso2} />
      <span className="truncate text-xs text-gray-900 dark:text-white">{team.name}</span>
      {match.status !== 'UPCOMING' && (
        <span className="ml-auto text-xs text-gray-700 dark:text-gray-300 shrink-0">{score ?? '-'}</span>
      )}
    </div>
  );

  const aWon = match.status === 'FINISHED' && (match.scoreA ?? -1) > (match.scoreB ?? -1);
  const bWon = match.status === 'FINISHED' && (match.scoreB ?? -1) > (match.scoreA ?? -1);

  return (
    <Link to={`/foot/matches/${match.id}`}>
      <div
        style={{ height: CARD_HEIGHT }}
        className={`card p-2 border-2 cursor-pointer flex flex-col justify-center gap-1 ${
          isHighlighted ? 'border-wc-green' : 'border-transparent hover:border-wc-green'
        }`}
      >
        {teamRow(match.teamA, match.scoreA, aWon)}
        {teamRow(match.teamB, match.scoreB, bWon)}
        {match.status === 'UPCOMING' && (
          <div className="text-[10px] text-gray-400 dark:text-gray-500 text-center -mt-0.5">
            {formatDate(match.matchDate)} · {formatTime(match.matchDate)}
          </div>
        )}
      </div>
    </Link>
  );
};

const BracketView: React.FC<BracketViewProps> = ({ matches, highlight }) => {
  const { tiers, thirdPlace } = buildBracketData(matches);

  if (tiers.length === 0) {
    return (
      <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
        <div className="text-4xl mb-3">🏆</div>
        <p>Le tableau final sera disponible dès que la phase éliminatoire commence</p>
      </div>
    );
  }

  const firstTierCount = tiers[0].matches.length;
  const totalHeight = firstTierCount * CARD_HEIGHT + (firstTierCount - 1) * GAP;

  return (
    <div>
      <div className="flex gap-6 overflow-x-auto pb-4">
        {tiers.map((t, colIdx) => {
          const isLast = colIdx === tiers.length - 1;
          const pairs: Match[][] = [];
          for (let i = 0; i < t.matches.length; i += 2) pairs.push(t.matches.slice(i, i + 2));

          return (
            <div key={t.tier} className="shrink-0 w-56">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 text-center">
                {t.label}
              </h3>
              <div
                className="flex flex-col justify-around gap-4"
                style={{ minHeight: totalHeight }}
              >
                {pairs.map((pair, pairIdx) => (
                  <div key={pairIdx} className="relative flex flex-col justify-around gap-4">
                    {pair.map((m) => (
                      <BracketMatchCard key={m.id} match={m} highlight={highlight} />
                    ))}
                    {!isLast && pair.length === 2 && (
                      <div
                        className="pointer-events-none absolute -right-3 w-3 border-r-2 border-t-2 border-b-2 rounded-r border-gray-300 dark:border-gray-600"
                        style={{ top: CARD_HEIGHT / 2, bottom: CARD_HEIGHT / 2 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {thirdPlace.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Petite finale
          </h3>
          <div className="w-56">
            {thirdPlace.map((m) => (
              <BracketMatchCard key={m.id} match={m} highlight={highlight} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BracketView;
