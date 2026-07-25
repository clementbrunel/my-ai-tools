import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRace, getRaces } from '@/api/f1';
import { getDashboardStats } from '@/api/dashboard';
import type { GroupRankEntry } from '@/api/dashboard';
import type { Race } from '@/types';
import { formatDate, formatTime } from '@/utils/dates';
import { getFlagUrl } from '@/utils/countryFlags';
import MiniF1Car from '@/components/f1/MiniF1Car';
import { logger } from '@/utils/logger';

const F1Dashboard: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [groupRanks, setGroupRanks] = useState<GroupRankEntry[]>([]);
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);
  const [lastRaceDetail, setLastRaceDetail] = useState<Race | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getRaces(), getDashboardStats('F1')])
      .then(([raceRows, statsData]) => {
        setRaces(raceRows);
        setGroupRanks(statsData.groupRanks);
      })
      .catch((err) => logger.error('Error loading F1 dashboard:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const nextRace = useMemo(
    () => races.find((r) => r.status !== 'FINISHED' && new Date(r.raceDate) > new Date()),
    [races],
  );
  const lastFinished = useMemo(
    () => [...races].reverse().find((r) => r.status === 'FINISHED'),
    [races],
  );

  // The race list doesn't carry results (too heavy to load in bulk) — fetch the
  // single race once we know which one is the last finished one.
  useEffect(() => {
    if (!lastFinished) {
      setLastRaceDetail(null);
      return;
    }
    getRace(lastFinished.id)
      .then(setLastRaceDetail)
      .catch(() => setLastRaceDetail(null));
  }, [lastFinished?.id]);

  const nextRaceFlag = getFlagUrl(nextRace?.countryIso2?.toLowerCase());
  const lastRaceFlag = getFlagUrl(lastFinished?.countryIso2?.toLowerCase());
  const podium = lastRaceDetail?.results?.slice(0, 3) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="wc-header rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-black">F1 Prono 🏎</h1>
            <p className="text-white/70">Podium, pole, meilleur tour… à toi de jouer !</p>
          </div>
          <div className="text-6xl hidden md:block">🏁</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Prochain Grand Prix */}
        <Link
          to={nextRace ? `/f1/races/${nextRace.id}` : '/f1/races'}
          className="stat-card hover:ring-2 hover:ring-wc-green transition-all cursor-pointer"
        >
          {nextRace ? (
            <>
              {nextRaceFlag ? (
                <img src={nextRaceFlag} alt="" className="w-10 h-7 object-cover rounded shadow mb-2" />
              ) : (
                <span className="text-3xl mb-1">🏁</span>
              )}
              <div className="font-bold text-gray-900 dark:text-white text-sm truncate max-w-full">{nextRace.name}</div>
              <div className="stat-label">{formatDate(nextRace.raceDate)} · {formatTime(nextRace.raceDate)}</div>
              <span
                className={`mt-2 text-xs font-bold px-3 py-1 rounded-full ${
                  nextRace.userPredicted
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                    : nextRace.openInUserGroups
                      ? 'bg-wc-gold/20 text-yellow-700 dark:text-wc-gold animate-pulse'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}
              >
                {nextRace.userPredicted ? '✓ Pronostiqué' : nextRace.openInUserGroups ? 'À pronostiquer !' : 'Pas encore ouvert'}
              </span>
            </>
          ) : (
            <div className="text-gray-400 dark:text-gray-500 text-sm">
              {isLoading ? 'Chargement…' : 'Aucun Grand Prix à venir'}
            </div>
          )}
        </Link>

        {/* Classement & Points — double tile, cliquable vers le classement */}
        <Link
          to={
            groupRanks.length === 0
              ? '/f1/leaderboard'
              : `/f1/leaderboard?groupId=${(groupRanks[selectedGroupIdx] ?? groupRanks[0]).groupId}`
          }
          className="stat-card sm:col-span-2 block hover:ring-2 hover:ring-wc-green transition-all cursor-pointer"
        >
          {groupRanks.length === 0 ? (
            <div className="text-gray-400 dark:text-gray-500 text-sm">Rejoins un groupe pour voir ton classement</div>
          ) : (() => {
            const gr = groupRanks[selectedGroupIdx] ?? groupRanks[0];
            return (
              <>
                {groupRanks.length > 1 && (
                  <div className="mb-3" onClick={(e) => e.preventDefault()}>
                    <select
                      value={selectedGroupIdx}
                      onChange={(e) => setSelectedGroupIdx(Number(e.target.value))}
                      className="input-field text-sm py-1"
                    >
                      {groupRanks.map((g, i) => (
                        <option key={g.groupId} value={i}>{g.groupName}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="stat-value text-wc-gold">#{gr.rank}<span className="text-base font-normal text-gray-400">/{gr.total}</span></div>
                    <div className="stat-label">🏅 Classement{groupRanks.length === 1 ? ` · ${gr.groupName}` : ''}</div>
                  </div>
                  <div>
                    <div className="stat-value">{gr.points}</div>
                    <div className="stat-label">⭐ Points</div>
                  </div>
                </div>
              </>
            );
          })()}
          <div className="text-xs text-wc-green dark:text-green-400 mt-2">Voir le classement complet →</div>
        </Link>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/f1/races" className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all group">
          <span className="text-4xl">🏁</span>
          <div>
            <div className="font-bold text-gray-900 dark:text-white group-hover:text-wc-green">Grands Prix</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Calendrier & pronos</div>
          </div>
        </Link>
        <Link to="/f1/standings?tab=drivers" className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all group">
          <span className="text-4xl">🏎</span>
          <div>
            <div className="font-bold text-gray-900 dark:text-white group-hover:text-wc-green">Championnat Pilotes</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Classement des pilotes</div>
          </div>
        </Link>
        <Link to="/f1/standings?tab=constructors" className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all group">
          <span className="text-4xl">🔧</span>
          <div>
            <div className="font-bold text-gray-900 dark:text-white group-hover:text-wc-green">Championnat Constructeurs</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Classement des écuries</div>
          </div>
        </Link>
      </div>

      {/* Last result — one full-width tile with the podium, no need to open the race page */}
      {lastFinished && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {lastRaceFlag ? (
                <img src={lastRaceFlag} alt="" className="w-10 h-7 object-cover rounded shadow shrink-0" />
              ) : (
                <span className="text-2xl shrink-0">🏆</span>
              )}
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-gray-400">Dernier résultat</div>
                <h2 className="font-bold text-gray-900 dark:text-white truncate">{lastFinished.name}</h2>
              </div>
            </div>
            <Link to={`/f1/races/${lastFinished.id}`} className="text-xs text-wc-green dark:text-green-400 font-bold hover:underline shrink-0">
              Voir le détail →
            </Link>
          </div>
          {podium.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {podium.map((r) => (
                <div key={r.driver.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="w-8 text-right font-black text-gray-400">{r.position ?? 'NC'}</span>
                  <MiniF1Car color={r.driver.constructorColor} size={32} />
                  <span className="font-bold text-gray-900 dark:text-white flex-1 truncate">
                    {r.driver.name}
                    <span className="text-gray-400 font-medium text-xs ml-2">{r.driver.constructorName}</span>
                  </span>
                  <span className="flex gap-1 text-xs items-center shrink-0">
                    {r.pole && <span title="Pole position">⏱</span>}
                    {r.fastestLap && <span title="Meilleur tour">🟣</span>}
                    {r.dnf && <span className="text-gray-400" title="Abandon">DNF</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">Résultats en cours de saisie…</div>
          )}
        </div>
      )}

      {isLoading && <div className="card text-center py-8 text-gray-500">Chargement…</div>}
    </div>
  );
};

export default F1Dashboard;
