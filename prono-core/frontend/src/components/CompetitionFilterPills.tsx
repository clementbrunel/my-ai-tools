import { useEffect, useState } from 'react';
import { getCompetitions } from '@/api/competitions';
import type { CompetitionDto, Sport } from '@/types';

interface CompetitionFilterPillsProps {
  sport: Sport;
  selected: Set<number>;
  onChange: (selected: Set<number>) => void;
}

/**
 * Multi-select pills scoped to one sport's competitions, defaulting to the active ones
 * (e.g. Ligue 1 once launched, without World Cup 2026 noise — toggle a pill to bring an
 * inactive competition back into view). Hidden entirely while there's nothing to choose
 * between, so it stays a no-op until a second competition exists for that sport.
 */
const CompetitionFilterPills: React.FC<CompetitionFilterPillsProps> = ({ sport, selected, onChange }) => {
  const [competitions, setCompetitions] = useState<CompetitionDto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCompetitions()
      .then((all) => {
        if (cancelled) return;
        const scoped = all.filter((c) => c.sport === sport);
        setCompetitions(scoped);
        onChange(new Set(scoped.filter((c) => c.active).map((c) => c.id)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport]);

  if (!competitions || competitions.length < 2) return null;

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {competitions.map((c) => (
        <button
          key={c.id}
          onClick={() => toggle(c.id)}
          className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
            selected.has(c.id)
              ? 'bg-wc-green text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
};

export default CompetitionFilterPills;
