interface LegendRow {
  icon: string;
  label: string;
  points: number;
  gold?: boolean;
}

/** Barème complet affiché sur l'écran de prono — garder synchro avec F1RaceService.computePoints. */
const LEGEND_ROWS: LegendRow[] = [
  { icon: '🥇', label: 'Vainqueur exact', points: 3 },
  { icon: '🥈🥉', label: '2e / 3e exact', points: 2 },
  { icon: '🏎️', label: 'Sur le podium mais mauvaise place', points: 1 },
  { icon: '⏱', label: 'Pole', points: 2 },
  { icon: '🟣', label: 'Meilleur tour', points: 1 },
  { icon: '🔦', label: 'Lanterne rouge (dernier classé, pas 1er abandon)', points: 2 },
  { icon: '👑', label: 'Grand Chelem (pole + victoire + meilleur tour)', points: 2, gold: true },
];

const LegendRow: React.FC<{ row: LegendRow }> = ({ row }) => (
  <div className="flex items-start justify-between gap-2">
    <span className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
      <span className="text-sm shrink-0">{row.icon}</span>
      {row.label}
    </span>
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
        row.gold
          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-wc-gold'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
      }`}
    >
      +{row.points}
    </span>
  </div>
);

/** Barème "Podium +" — 2 colonnes de 3 (podium / picks spéciaux) + Grand Chelem en pleine largeur. */
const PointsLegend: React.FC = () => (
  <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3">
    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
      Barème
    </div>
    <div className="grid grid-cols-2 gap-x-4">
      <div className="space-y-1">
        {LEGEND_ROWS.slice(0, 3).map((row) => <LegendRow key={row.label} row={row} />)}
      </div>
      <div className="space-y-1">
        {LEGEND_ROWS.slice(3, 6).map((row) => <LegendRow key={row.label} row={row} />)}
      </div>
    </div>
    <div className="mt-2 pt-2 border-t border-gray-200/70 dark:border-gray-800">
      <LegendRow row={LEGEND_ROWS[6]} />
    </div>
  </div>
);

export default PointsLegend;
