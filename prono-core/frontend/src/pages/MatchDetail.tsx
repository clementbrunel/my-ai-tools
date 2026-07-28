import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getMatch } from '@/api/matches';
import { getBetsByMatch, getParticipationsByMatch } from '@/api/bets';
import { getDailyGagesByDate, voteOnCandidate } from '@/api/dailyGages';
import type { Match, Bet, BetParticipation, DailyGage } from '@/types';
import { useToast } from '@/components/Toast';
import DailyGageCard from '@/components/DailyGageCard';
import MatchHeader from './MatchHeader';
import PredictionForm from './PredictionForm';
import OthersPredictions from './OthersPredictions';

// ── component ─────────────────────────────────────────────────────────────────

const MatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // location.key is 'default' when the page was opened directly (no in-app history)
  const goBack = () => location.key === 'default' ? navigate('/foot/matches') : navigate(-1);

  const [match, setMatch] = useState<Match | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);
  const [participations, setParticipations] = useState<BetParticipation[]>([]);
  const [dayGages, setDayGages] = useState<DailyGage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshParticipations = useCallback(async () => {
    if (!id) return [];
    const parts = await getParticipationsByMatch(parseInt(id));
    setParticipations(parts);
    return parts;
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [matchData, betsData] = await Promise.all([
          getMatch(parseInt(id)),
          getBetsByMatch(parseInt(id)),
        ]);
        setMatch(matchData);

        // Load this day's gages across ALL the user's groups (show every gage at stake)
        try {
          setDayGages(await getDailyGagesByDate(matchData.matchDate.slice(0, 10)));
        } catch {
          // No gage for this day — that's fine
        }

        if (betsData.length > 0) {
          setBet(betsData[0]);
          await refreshParticipations();
        }
      } catch {
        setError('Match introuvable');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, refreshParticipations]);

  // ── gage vote handler ─────────────────────────────────────────────────────

  const handleVoteGage = async (gageId: number, forfeitId: number, vote: number) => {
    try {
      const updated = await voteOnCandidate(gageId, forfeitId, vote);
      setDayGages((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch {
      showToast('Erreur lors du vote');
    }
  };

  // ── derived ────────────────────────────────────────────────────────────────

  const isDeadlinePassed = match ? new Date() > new Date(match.matchDate) : false;
  const canBet = bet?.status === 'OPEN' && !isDeadlinePassed;
  const showOthers = isDeadlinePassed || (bet?.status !== 'OPEN');

  // ── loading / error guards ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl animate-bounce-slow">⚽</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-gray-600 dark:text-gray-400">{error || 'Match introuvable'}</p>
        <button onClick={goBack} className="btn-primary mt-4 inline-block">
          Retour aux matchs
        </button>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <button onClick={goBack} className="text-sm text-wc-green dark:text-green-400 hover:underline">
        ← Retour aux matchs
      </button>

      <MatchHeader match={match} />

      {/* ── Daily gages for this match day — one card per group at stake ── */}
      {dayGages.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">🃏 Gage du jour</h2>
          {dayGages.map((g) => (
            <DailyGageCard key={g.id} gage={g} onVote={handleVoteGage} showGroupName={dayGages.length > 1} />
          ))}
        </div>
      )}

      {bet && (
        <PredictionForm
          match={match}
          bet={bet}
          participations={participations}
          canBet={canBet}
          refreshParticipations={refreshParticipations}
        />
      )}

      {bet && <OthersPredictions bet={bet} participations={participations} showOthers={showOthers} />}
    </div>
  );
};

export default MatchDetail;
