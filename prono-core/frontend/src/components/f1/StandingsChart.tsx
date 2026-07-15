import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { F1StandingHistory } from '../../types';

/** Recessive, one-step-off-surface gray — reads on both light and dark cards. */
const AXIS_COLOR = '#9ca3af';

interface ChartPoint {
  round: number;
  raceName: string;
  [seriesLabel: string]: number | string;
}

const CustomTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const raceName = payload[0]?.payload?.raceName as string | undefined;
  const sorted = [...payload].sort((a, b) => Number(b.value) - Number(a.value));

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg px-3 py-2 text-xs space-y-1 max-h-72 overflow-y-auto">
      <div className="font-bold text-gray-900 dark:text-white mb-1">
        R{label}{raceName ? ` · ${raceName}` : ''}
      </div>
      {sorted.map((entry) => (
        <div key={entry.dataKey as string} className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5 rounded shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="font-bold text-gray-900 dark:text-white tabular-nums">{entry.value}</span>
          <span className="text-gray-500 dark:text-gray-400 truncate">{entry.dataKey as string}</span>
        </div>
      ))}
    </div>
  );
};

/** Cumulative championship points per race round — top 10, one line per driver/constructor. */
const StandingsChart: React.FC<{ history: F1StandingHistory }> = ({ history }) => {
  if (history.races.length === 0) {
    return (
      <div className="card text-center py-12 space-y-2">
        <div className="text-5xl">📈</div>
        <p className="text-gray-500 dark:text-gray-400">
          Le graphique apparaîtra dès le premier résultat de course saisi.
        </p>
      </div>
    );
  }

  const chartData: ChartPoint[] = history.races.map((race, i) => {
    const point: ChartPoint = { round: race.round, raceName: race.name };
    history.series.forEach((s) => {
      point[s.label] = s.points[i] ?? 0;
    });
    return point;
  });

  // Teammates share their constructor color — dash the second line of any repeated color
  // so identity never rests on hue alone (still backed by the legend's names below).
  const seenColors = new Set<string>();
  const series = history.series.map((s) => {
    const dashed = seenColors.has(s.color);
    seenColors.add(s.color);
    return { ...s, dashed };
  });

  const tickInterval = chartData.length > 12 ? Math.ceil(chartData.length / 12) - 1 : 0;

  return (
    <div className="card space-y-4">
      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={AXIS_COLOR} strokeOpacity={0.15} vertical={false} />
            <XAxis
              dataKey="round"
              type="category"
              tickFormatter={(round: number) => `R${round}`}
              tick={{ fontSize: 11, fill: AXIS_COLOR }}
              tickLine={false}
              axisLine={{ stroke: AXIS_COLOR, strokeOpacity: 0.3 }}
              interval={tickInterval}
            />
            <YAxis
              tick={{ fontSize: 11, fill: AXIS_COLOR }}
              tickLine={false}
              axisLine={false}
              width={32}
              allowDecimals={false}
            />
            <Tooltip content={(props) => <CustomTooltip {...props} />} />
            {series.map((s) => (
              <Line
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '6 4' : undefined}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — text carries identity alongside color/dash, never color alone */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center border-t border-gray-100 dark:border-gray-800 pt-3">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <svg width="16" height="8" className="shrink-0">
              <line
                x1="0" y1="4" x2="16" y2="4"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '4 3' : undefined}
              />
            </svg>
            <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[9rem]">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StandingsChart;
