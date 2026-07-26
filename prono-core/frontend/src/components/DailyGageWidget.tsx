import { useEffect, useState } from 'react';
import { getDailyGagesByDate, voteOnCandidate } from '@/api/dailyGages';
import type { DailyGage } from '@/types';
import DailyGageCard from '@/components/DailyGageCard';
import { useToast } from '@/components/Toast';

/** Today's gage(s) across the user's groups, regardless of sport — a group's
 * daily gage is settled from its foot matches or F1 races alike. Self-contained
 * so both dashboards render it identically without duplicating the fetch/vote logic. */
const DailyGageWidget: React.FC = () => {
  const { showToast } = useToast();
  const [todayGages, setTodayGages] = useState<DailyGage[]>([]);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    getDailyGagesByDate(today)
      .then(setTodayGages)
      .catch(() => { /* No gage today — that's fine */ });
  }, [today]);

  const handleVote = async (gageId: number, forfeitId: number, vote: number) => {
    try {
      const updated = await voteOnCandidate(gageId, forfeitId, vote);
      setTodayGages((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch {
      showToast('Erreur lors du vote');
    }
  };

  if (todayGages.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">🃏 Gage du jour</h2>
      {todayGages.map((g) => (
        <DailyGageCard key={g.id} gage={g} onVote={handleVote} showGroupName={todayGages.length > 1} />
      ))}
    </section>
  );
};

export default DailyGageWidget;
