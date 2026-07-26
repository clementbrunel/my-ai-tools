import { useEffect, useState } from 'react';
import { getDailyGagesByDate, voteOnCandidate } from '@/api/dailyGages';
import type { DailyGage } from '@/types';
import DailyGageCard from '@/components/DailyGageCard';
import { useToast } from '@/components/Toast';

interface DailyGageWidgetProps {
  /** Group IDs eligible for the current dashboard's sport (e.g. groupRanks' groupIds) —
   * the API returns gages across every group regardless of sport, so a foot-only
   * group's gage must not leak onto the F1 dashboard and vice versa. */
  allowedGroupIds: number[];
}

/** Today's gage(s), restricted to the groups relevant to the current sport. A
 * group's daily gage can be settled from its foot matches or F1 races alike, but
 * each dashboard only shows the gages of the groups it actually lists. Self-contained
 * so both dashboards render it identically without duplicating the fetch/vote logic. */
const DailyGageWidget: React.FC<DailyGageWidgetProps> = ({ allowedGroupIds }) => {
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

  const gages = todayGages.filter((g) => allowedGroupIds.includes(g.groupId));

  if (gages.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">🃏 Gage du jour</h2>
      {gages.map((g) => (
        <DailyGageCard key={g.id} gage={g} onVote={handleVote} showGroupName={gages.length > 1} />
      ))}
    </section>
  );
};

export default DailyGageWidget;
