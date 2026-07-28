import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { getDrivers, getMyPrediction, getRace, getRacePredictions, predict } from '@/api/f1';
import { useAuth } from '@/context/AuthContext';
import type { Driver, F1Prediction, Race } from '@/types';
import { formatDate, formatTime } from '@/utils/dates';
import { getFlagUrl } from '@/utils/countryFlags';
import { useToast } from '@/components/Toast';
import { computeF1Verdicts } from '@/utils/f1Calculations';
import DriverChip from '@/components/f1/DriverChip';
import PointsLegend from '@/components/f1/PointsLegend';
import PaddockDriver from '@/components/f1/PaddockDriver';
import Slot from '@/components/f1/Slot';
import { SLOT_META, SLOT_ORDER, usePodiumSlots } from '@/hooks/usePodiumSlots';
import ResultsPanel from './ResultsPanel';

const F1RaceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const raceId = Number(id);
  const { showToast } = useToast();
  const { user } = useAuth();

  const [race, setRace] = useState<Race | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [myPrediction, setMyPrediction] = useState<F1Prediction | null>(null);
  const [groupPredictions, setGroupPredictions] = useState<F1Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const poleLocked = race ? new Date(race.qualifyingDate) <= now : false;
  const raceLocked = race ? new Date(race.raceDate) <= now : false;
  const finished = race?.status === 'FINISHED';
  const readOnly = raceLocked || finished || !race?.openInUserGroups;

  const {
    slots, setSlots, armedSlot, toggleArm, draggedDriver, placedCounts,
    isSlotLocked, clearSlot, handleTapDriver, handleDragStart, handleDragEnd,
  } = usePodiumSlots(drivers, readOnly, poleLocked);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  useEffect(() => {
    if (!raceId) return;
    Promise.all([getRace(raceId), getDrivers(), getMyPrediction(raceId)])
      .then(([raceData, driversData, prediction]) => {
        setRace(raceData);
        setDrivers(driversData);
        setMyPrediction(prediction);
        if (prediction) {
          setSlots({
            p1: prediction.p1, p2: prediction.p2, p3: prediction.p3,
            pole: prediction.pole, fastestLap: prediction.fastestLap, last: prediction.lastClassified,
          });
        }
      })
      .catch(() => setError('Impossible de charger la course'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  // Re-fetched after a save so predictionsCount (and, via the effect below, the
  // revealed groupPredictions list) reflect the server truth — same spirit as
  // football's refreshParticipations().
  const refreshRace = useCallback(async () => {
    if (!raceId) return;
    const raceData = await getRace(raceId);
    setRace(raceData);
  }, [raceId]);

  // The group's picks are revealed milestone by milestone (poles at
  // qualifying, everything at lights out) — only fetch once unlocked.
  useEffect(() => {
    if (!race || new Date(race.qualifyingDate) > new Date()) return;
    getRacePredictions(race.id)
      .then(setGroupPredictions)
      .catch(() => { /* stays hidden */ });
  }, [race]);

  const canSave = slots.p1 && slots.p2 && slots.p3 && !readOnly;

  const handleSave = async () => {
    if (!canSave || !race) return;
    setIsSaving(true);
    try {
      const saved = await predict(race.id, {
        p1DriverId: slots.p1!.id,
        p2DriverId: slots.p2!.id,
        p3DriverId: slots.p3!.id,
        poleDriverId: slots.pole?.id ?? null,
        fastestLapDriverId: slots.fastestLap?.id ?? null,
        lastClassifiedDriverId: slots.last?.id ?? null,
      });
      setMyPrediction(saved);
      await refreshRace();
      showToast('Prono enregistré ! 🏁', 'success');
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message ?? "Impossible d'enregistrer le prono", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="card text-center py-12 text-gray-500">Chargement…</div>;
  if (error || !race) {
    return <div className="card bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{error ?? 'Course introuvable'}</div>;
  }

  const flag = getFlagUrl(race.countryIso2?.toLowerCase());
  const pickVerdicts = finished && myPrediction ? computeF1Verdicts(myPrediction, race) : null;
  // The credited total comes from the backend — verdicts only drive the per-slot chips.
  const totalPoints = finished && myPrediction ? myPrediction.pointsEarned : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="wc-header rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          {flag && <img src={flag} alt="" className="w-12 h-8 object-cover rounded shadow" />}
          <div className="flex-1">
            <div className="text-xs text-white/60 font-bold uppercase">Manche {race.round}</div>
            <h1 className="text-2xl font-black">{race.name}</h1>
            <div className="text-sm text-white/70">{race.circuit}</div>
          </div>
          <Link to="/f1/races" className="text-sm text-white/70 hover:text-white shrink-0">← Calendrier</Link>
        </div>
        <div className="flex gap-3 mt-3 text-xs flex-wrap">
          <span className={`px-2 py-1 rounded-full font-bold ${poleLocked ? 'bg-white/10 text-white/50' : 'bg-white/20'}`}>
            ⏱ Pole verrouillée aux qualifs · {formatDate(race.qualifyingDate)} {formatTime(race.qualifyingDate)}
          </span>
          <span className={`px-2 py-1 rounded-full font-bold ${raceLocked ? 'bg-white/10 text-white/50' : 'bg-white/20'}`}>
            🏁 Le reste au départ · {formatDate(race.raceDate)} {formatTime(race.raceDate)}
          </span>
        </div>
      </div>

      {!race.openInUserGroups && !finished && (
        <div className="card bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-sm">
          Cette course n'est pas encore ouverte aux paris dans tes groupes — demande à ton admin de groupe de l'ouvrir.
        </div>
      )}

      {/* Points recap once finished */}
      {finished && myPrediction && totalPoints != null && (
        <div className="card text-center py-5 space-y-1">
          <div className="text-4xl font-black text-wc-green">+{totalPoints} pts</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            ton prono : {[slots.p1, slots.p2, slots.p3].map((d) => d?.code ?? '—').join(' · ')}
            {myPrediction.grandChelem && (
              <span className="ml-2 font-bold text-wc-gold">👑 Grand Chelem ! +2 pts</span>
            )}
          </div>
        </div>
      )}
      {finished && !myPrediction && (
        <div className="card text-center py-4 text-sm text-gray-500 dark:text-gray-400">
          Tu n'avais pas pronostiqué cette course.
        </div>
      )}

      {/* Prediction board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-white">
              {readOnly ? 'Ton prono' : 'Compose ton prono'}
            </h2>
            {!readOnly && (
              <span className="text-xs text-gray-400">
                Glisse une F1 sur un slot (ou touche un slot puis un pilote) — un même pilote peut cumuler podium, pole et meilleur tour
              </span>
            )}
          </div>

          <PointsLegend />

          {/* Podium */}
          <div className="flex items-end justify-center gap-3">
            <div className="pt-6"><Slot slot="p2" driver={slots.p2} locked={readOnly} armed={armedSlot === 'p2'} onArm={() => toggleArm('p2')} onClear={() => clearSlot('p2')} /></div>
            <Slot slot="p1" driver={slots.p1} locked={readOnly} armed={armedSlot === 'p1'} tall onArm={() => toggleArm('p1')} onClear={() => clearSlot('p1')} />
            <div className="pt-6"><Slot slot="p3" driver={slots.p3} locked={readOnly} armed={armedSlot === 'p3'} onArm={() => toggleArm('p3')} onClear={() => clearSlot('p3')} /></div>
          </div>

          {/* Special picks */}
          <div className="flex items-start justify-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Slot slot="pole" driver={slots.pole} locked={isSlotLocked('pole')} armed={armedSlot === 'pole'} onArm={() => toggleArm('pole')} onClear={() => clearSlot('pole')} />
            <Slot slot="fastestLap" driver={slots.fastestLap} locked={readOnly} armed={armedSlot === 'fastestLap'} onArm={() => toggleArm('fastestLap')} onClear={() => clearSlot('fastestLap')} />
            <Slot slot="last" driver={slots.last} locked={readOnly} armed={armedSlot === 'last'} onArm={() => toggleArm('last')} onClear={() => clearSlot('last')} />
          </div>

          {/* Verdicts per pick */}
          {pickVerdicts && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-[11px] pt-2 border-t border-gray-100 dark:border-gray-800">
              {SLOT_ORDER.map((key) => {
                const v = pickVerdicts[key];
                return (
                  <div key={key} className={`rounded-lg py-1 font-bold ${v.correct ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : v.partial ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                    {SLOT_META[key].icon} {v.points > 0 ? `+${v.points}` : '0'}
                  </div>
                );
              })}
            </div>
          )}
          {pickVerdicts && myPrediction?.grandChelem && (
            <div className="text-center text-[11px] font-bold rounded-lg py-1 bg-yellow-100 dark:bg-yellow-900/30 text-wc-gold">
              👑 Bonus Grand Chelem (pole + victoire + meilleur tour) : +2 pts
            </div>
          )}

          {/* Paddock */}
          {!readOnly && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="text-xs font-bold uppercase text-gray-400">Paddock</div>
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-11 gap-1.5">
                {drivers.map((driver) => (
                  <PaddockDriver
                    key={driver.id}
                    driver={driver}
                    placedCount={placedCounts.get(driver.id) ?? 0}
                    disabled={readOnly}
                    onTap={() => handleTapDriver(driver)}
                  />
                ))}
              </div>
            </div>
          )}

          {!readOnly && (
            <button onClick={handleSave} disabled={!canSave || isSaving} className="btn-primary w-full">
              {isSaving ? 'Enregistrement…' : myPrediction ? 'Mettre à jour mon prono' : 'Valider mon prono 🏁'}
            </button>
          )}
        </div>

        <DragOverlay>
          {draggedDriver && (
            <div className="pointer-events-none">
              <DriverChip driver={draggedDriver} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <ResultsPanel race={race} />

      {/* Group predictions — revealed per milestone (same spirit as football) */}
      {!poleLocked ? (
        <div className="card text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
          <p>
            🔒 <strong>{race.predictionsCount} prono{race.predictionsCount !== 1 ? 's' : ''}</strong> déposé
            {race.predictionsCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs mt-1 text-gray-400">
            Les poles seront révélées aux qualifs, le reste au départ de la course
          </p>
        </div>
      ) : groupPredictions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            👥 Pronostics ({groupPredictions.length})
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            {raceLocked
              ? 'Pronos complets — plus modifiables depuis le départ.'
              : 'Seules les poles sont révélées (verrouillées aux qualifs) — le reste au départ de la course.'}
          </p>
          <div className="space-y-2">
            {groupPredictions.map((p) => {
              const isMe = p.username === user?.username;
              return (
                <div
                  key={p.username}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg text-sm ${
                    isMe
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                      : 'bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <span className="font-semibold text-gray-900 dark:text-white truncate">
                    {p.displayName || p.username}{isMe ? ' (toi)' : ''}
                  </span>
                  <span className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 shrink-0 flex-wrap justify-end">
                    {raceLocked && (
                      <span>{[p.p1, p.p2, p.p3].map((d) => d?.code ?? '—').join(' · ')}</span>
                    )}
                    <span title="Pole">⏱ {p.pole?.code ?? '—'}</span>
                    {raceLocked && <span title="Meilleur tour">🟣 {p.fastestLap?.code ?? '—'}</span>}
                    {raceLocked && <span title="Lanterne rouge">🔦 {p.lastClassified?.code ?? '—'}</span>}
                    {finished && p.grandChelem && (
                      <span title="Grand Chelem : pole + victoire + meilleur tour (+2 pts)">👑</span>
                    )}
                    {finished && (
                      <span className="text-wc-green font-black">+{p.pointsEarned}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default F1RaceDetail;
