import { useEffect, useState } from 'react';
import {
  getAllDailyGages, createDailyGage,
  selectForfeitDirectly, addCandidate, removeCandidate,
} from '../api/dailyGages';
import { getForfeits } from '../api/forfeits';
import { getMatches } from '../api/matches';
import type { DailyGage, Forfeit, Match } from '../types';
import { formatDate, parseDDMMYYYY } from '../utils/dates';

interface Props {
  groupId: number;
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-600',
    ACTIVE: 'bg-green-100 text-green-700',
    SETTLED: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${map[status] ?? ''}`}>
      {status}
    </span>
  );
};

const DailyGagePanel: React.FC<Props> = ({ groupId }) => {
  const [dailyGages, setDailyGages] = useState<DailyGage[]>([]);
  const [availableForfeits, setAvailableForfeits] = useState<Forfeit[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create form
  const [date, setDate] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [mode, setMode] = useState<'DIRECT' | 'VOTE'>('DIRECT');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // List UI
  const [expandedDg, setExpandedDg] = useState<number | null>(null);
  const [selectedForfeit, setSelectedForfeit] = useState<number | ''>('');

  useEffect(() => {
    Promise.all([getAllDailyGages(), getForfeits(), getMatches()])
      .then(([allDg, forfeits, matches]) => {
        setDailyGages(allDg.filter((dg) => dg.groupId === groupId));
        setAvailableForfeits(forfeits.filter((f) => !f.groupId || f.groupId === groupId));
        setAllMatches(matches);
      })
      .finally(() => setIsLoading(false));
  }, [groupId]);

  const configuredDates = new Set(dailyGages.map((dg) => dg.matchDate));
  const unconfiguredMatchDays = [
    ...new Set(allMatches.map((m) => m.matchDate.slice(0, 10))),
  ]
    .filter((d) => !configuredDates.has(d))
    .sort();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!date) {
      setError('Date invalide — utilisez le format JJ/MM/AAAA.');
      return;
    }
    try {
      const created = await createDailyGage(groupId, date, mode);
      setDailyGages((prev) => [created, ...prev]);
      setDate('');
      setDateDisplay('');
      setSuccess('Gage du jour créé !');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Erreur — peut-être un gage existe déjà pour cette date ?');
    }
  };

  const handleSelectDirectly = async (dgId: number) => {
    if (!selectedForfeit) return;
    try {
      const updated = await selectForfeitDirectly(dgId, Number(selectedForfeit));
      setDailyGages((prev) => prev.map((dg) => (dg.id === updated.id ? updated : dg)));
      setSelectedForfeit('');
    } catch {
      setError('Erreur lors de la sélection du gage');
    }
  };

  const handleAddCandidate = async (dgId: number) => {
    if (!selectedForfeit) return;
    try {
      const updated = await addCandidate(dgId, Number(selectedForfeit));
      setDailyGages((prev) => prev.map((dg) => (dg.id === updated.id ? updated : dg)));
      setSelectedForfeit('');
    } catch {
      setError('Erreur — ce gage est peut-être déjà candidat ?');
    }
  };

  const handleRemoveCandidate = async (dgId: number, forfeitId: number) => {
    try {
      const updated = await removeCandidate(dgId, forfeitId);
      setDailyGages((prev) => prev.map((dg) => (dg.id === updated.id ? updated : dg)));
    } catch {
      setError('Erreur lors du retrait du candidat');
    }
  };

  if (isLoading) {
    return <p className="text-xs text-gray-400 italic">Chargement...</p>;
  }

  return (
    <div className="space-y-4">

      {/* Create form */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">+ Créer un gage du jour</p>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="label text-xs">Date (JJ/MM/AAAA)</label>
            <input
              type="text"
              value={dateDisplay}
              onChange={(e) => {
                setDateDisplay(e.target.value);
                setDate(parseDDMMYYYY(e.target.value));
              }}
              className="input-field w-32 text-sm"
              placeholder="JJ/MM/AAAA"
              maxLength={10}
              required
            />
          </div>
          <div>
            <label className="label text-xs">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'DIRECT' | 'VOTE')}
              className="input-field text-sm"
            >
              <option value="DIRECT">🎯 Choix direct</option>
              <option value="VOTE">🗳️ Vote</option>
            </select>
          </div>
          <button type="submit" className="btn-primary text-sm">Créer</button>
        </form>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        {success && <p className="text-green-500 text-xs mt-2">✅ {success}</p>}
      </div>

      {/* Unconfigured match days */}
      {unconfiguredMatchDays.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700/40 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
            ⚠️ Jours de match sans gage ({unconfiguredMatchDays.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unconfiguredMatchDays.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDate(d);
                  setDateDisplay(formatDate(d));
                  setMode('DIRECT');
                  setError('');
                  setSuccess('');
                }}
                className="btn-gold text-xs py-0.5 px-2"
              >
                📅 {formatDate(d)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Daily gages list */}
      {dailyGages.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Aucun gage du jour configuré.</p>
      ) : (
        <div className="space-y-2">
          {dailyGages.map((dg) => {
            const isExpanded = expandedDg === dg.id;
            return (
              <div key={dg.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer"
                  onClick={() => setExpandedDg(isExpanded ? null : dg.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatDate(dg.matchDate)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {dg.mode === 'DIRECT' ? '🎯 Direct' : '🗳️ Vote'}
                    </span>
                    {statusBadge(dg.status)}
                    {dg.forfeit && (
                      <span className="text-xs text-wc-green dark:text-green-400 font-medium">
                        🃏 {dg.forfeit.title}
                      </span>
                    )}
                    {dg.assignedToUsername && (
                      <span className="text-xs text-wc-red font-medium">
                        → {dg.assignedToUsername}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && dg.status !== 'SETTLED' && (
                  <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 space-y-2 pt-2">
                    <div className="flex gap-2 items-center flex-wrap">
                      <select
                        value={selectedForfeit}
                        onChange={(e) => setSelectedForfeit(Number(e.target.value) || '')}
                        className="input-field flex-1 min-w-[160px] text-sm"
                      >
                        <option value="">— Choisir un gage —</option>
                        {availableForfeits.map((f) => (
                          <option key={f.id} value={f.id}>{f.title}</option>
                        ))}
                      </select>

                      {dg.mode === 'DIRECT' ? (
                        <button
                          onClick={() => handleSelectDirectly(dg.id)}
                          disabled={!selectedForfeit}
                          className="btn-primary text-xs disabled:opacity-50"
                        >
                          ✅ Sélectionner
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddCandidate(dg.id)}
                          disabled={!selectedForfeit}
                          className="btn-secondary text-xs disabled:opacity-50"
                        >
                          + Candidat
                        </button>
                      )}
                    </div>

                    {dg.mode === 'VOTE' && dg.candidates.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Candidats</p>
                        {dg.candidates.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between bg-white dark:bg-gray-700 rounded px-2 py-1"
                          >
                            <div>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {c.forfeit.title}
                              </span>
                              <span className="ml-2 text-xs text-gray-400">
                                score : {c.voteScore > 0 ? '+' : ''}{c.voteScore}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveCandidate(dg.id, c.forfeit.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isExpanded && dg.status === 'SETTLED' && (
                  <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      🃏 <strong>{dg.forfeit?.title}</strong> attribué à{' '}
                      <strong className="text-wc-red">{dg.assignedToUsername}</strong>
                      {dg.assignedAt && (
                        <span className="ml-1 text-gray-400">le {formatDate(dg.assignedAt)}</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DailyGagePanel;
