import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { getDrivers, getMyPrediction, getRace, getRacePredictions, predict } from '@/api/f1';
import { useAuth } from '@/context/AuthContext';
import type { Driver, F1Prediction, Race } from '@/types';
import { formatDate, formatTime } from '@/utils/dates';
import { getFlagUrl } from '@/utils/countryFlags';
import { useToast } from '@/components/Toast';
import { computeF1Verdicts } from '@/utils/f1Calculations';
import MiniF1Car from '@/components/f1/MiniF1Car';
import DriverChip from '@/components/f1/DriverChip';

type SlotKey = 'p1' | 'p2' | 'p3' | 'pole' | 'fastestLap' | 'last';
type Slots = Record<SlotKey, Driver | null>;

const SLOT_ORDER: SlotKey[] = ['p1', 'p2', 'p3', 'pole', 'fastestLap', 'last'];

/**
 * Slots sharing a domain are mutually exclusive for a same driver
 * (podium + lanterne rouge). Pole and meilleur tour are independent:
 * the same driver can hold them on top of a podium spot.
 */
const SLOT_DOMAIN: Record<SlotKey, 'result' | 'pole' | 'fastestLap'> = {
  p1: 'result', p2: 'result', p3: 'result', last: 'result',
  pole: 'pole', fastestLap: 'fastestLap',
};

const SLOT_META: Record<SlotKey, { label: string; icon: string; points: string }> = {
  p1: { label: 'Vainqueur', icon: '🥇', points: '3 pts' },
  p2: { label: '2e', icon: '🥈', points: '2 pts' },
  p3: { label: '3e', icon: '🥉', points: '2 pts' },
  pole: { label: 'Pole', icon: '⏱', points: '2 pts' },
  fastestLap: { label: 'Meilleur tour', icon: '🟣', points: '1 pt' },
  last: { label: 'Lanterne rouge', icon: '🔦', points: '2 pts' },
};

const emptySlots = (): Slots => ({
  p1: null, p2: null, p3: null, pole: null, fastestLap: null, last: null,
});

// ── Draggable / droppable building blocks ──────────────────────────────────

const PaddockDriver: React.FC<{
  driver: Driver;
  placedCount: number;
  disabled: boolean;
  onTap: () => void;
}> = ({ driver, placedCount, disabled, onTap }) => {
  // Placed drivers stay draggable: pole and meilleur tour accept duplicates.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `paddock-${driver.id}`,
    data: { driverId: driver.id },
    disabled,
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-30' : ''}>
      <DriverChip driver={driver} placedCount={placedCount} onClick={disabled ? undefined : onTap} />
    </div>
  );
};

const Slot: React.FC<{
  slot: SlotKey;
  driver: Driver | null;
  locked: boolean;
  armed: boolean;
  tall?: boolean;
  onArm: () => void;
  onClear: () => void;
}> = ({ slot, driver, locked, armed, tall, onArm, onClear }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot}`, data: { slot }, disabled: locked });
  const meta = SLOT_META[slot];
  const dragProps = useDraggable({
    id: `fromslot-${slot}`,
    data: { driverId: driver?.id, fromSlot: slot },
    disabled: locked || !driver,
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={setNodeRef}
        onClick={locked ? undefined : onArm}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all
          ${tall ? 'w-20 h-28 sm:w-24 sm:h-32' : 'w-20 h-24 sm:w-24 sm:h-28'}
          ${locked
            ? 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-60'
            : isOver
              ? 'border-wc-green bg-green-50 dark:bg-green-900/20 scale-105'
              : armed
                ? 'border-wc-gold bg-yellow-50 dark:bg-yellow-900/20'
                : driver
                  ? 'border-transparent bg-gray-100 dark:bg-gray-800'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 cursor-pointer'}`}
      >
        {driver ? (
          <div
            ref={dragProps.setNodeRef}
            {...dragProps.listeners}
            {...dragProps.attributes}
            className={`flex flex-col items-center ${dragProps.isDragging ? 'opacity-30' : ''} ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
          >
            <MiniF1Car color={driver.constructorColor} size={tall ? 52 : 44} />
            <span className="text-xs font-black text-gray-900 dark:text-white">{driver.code}</span>
          </div>
        ) : (
          <span className="text-2xl opacity-40">{meta.icon}</span>
        )}
        {driver && !locked && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-[10px] font-bold flex items-center justify-center hover:bg-red-400 hover:text-white"
            aria-label={`Retirer ${driver.code} de ${meta.label}`}
          >
            ✕
          </button>
        )}
        {locked && <span className="absolute -top-2 -right-2 text-sm">🔒</span>}
      </div>
      <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 text-center leading-tight">
        {meta.icon} {meta.label}
        <br />
        <span className="text-gray-400 dark:text-gray-500 font-medium">{meta.points}</span>
      </span>
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────

const F1RaceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const raceId = Number(id);
  const { showToast } = useToast();
  const { user } = useAuth();

  const [race, setRace] = useState<Race | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [myPrediction, setMyPrediction] = useState<F1Prediction | null>(null);
  const [groupPredictions, setGroupPredictions] = useState<F1Prediction[]>([]);
  const [slots, setSlots] = useState<Slots>(emptySlots());
  const [armedSlot, setArmedSlot] = useState<SlotKey | null>(null);
  const [draggedDriver, setDraggedDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [raceId]);

  // The group's picks are revealed milestone by milestone (poles at
  // qualifying, everything at lights out) — only fetch once unlocked.
  useEffect(() => {
    if (!race || new Date(race.qualifyingDate) > new Date()) return;
    getRacePredictions(race.id)
      .then(setGroupPredictions)
      .catch(() => { /* stays hidden */ });
  }, [race]);

  const now = new Date();
  const poleLocked = race ? new Date(race.qualifyingDate) <= now : false;
  const raceLocked = race ? new Date(race.raceDate) <= now : false;
  const finished = race?.status === 'FINISHED';
  const readOnly = raceLocked || finished || !race?.openInUserGroups;

  // Times each driver is used across the six picks — shown on the paddock chips.
  const placedCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const driver of Object.values(slots)) {
      if (driver) counts.set(driver.id, (counts.get(driver.id) ?? 0) + 1);
    }
    return counts;
  }, [slots]);

  const isSlotLocked = (slot: SlotKey) => readOnly || (slot === 'pole' && poleLocked);

  const assign = (slot: SlotKey, driver: Driver) => {
    if (isSlotLocked(slot)) return;
    setSlots((prev) => {
      const next = { ...prev };
      // Vacate the driver only within the same conflict domain — the same
      // pilot may hold pole and/or meilleur tour on top of a podium spot.
      for (const key of SLOT_ORDER) {
        if (key !== slot && SLOT_DOMAIN[key] === SLOT_DOMAIN[slot]
            && next[key]?.id === driver.id && !isSlotLocked(key)) {
          next[key] = null;
        }
      }
      next[slot] = driver;
      return next;
    });
    setArmedSlot(null);
  };

  const handleTapDriver = (driver: Driver) => {
    // Armed slot wins; otherwise fill the first empty slot the driver may take.
    const target = armedSlot ?? SLOT_ORDER.find((key) => {
      if (slots[key] || isSlotLocked(key)) return false;
      if (SLOT_DOMAIN[key] !== 'result') return true;
      return !SLOT_ORDER.some((other) =>
        SLOT_DOMAIN[other] === 'result' && slots[other]?.id === driver.id);
    });
    if (target) assign(target, driver);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const driverId = event.active.data.current?.driverId as number | undefined;
    setDraggedDriver(drivers.find((d) => d.id === driverId) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedDriver(null);
    const { active, over } = event;
    if (!over) return;
    const targetSlot = over.data.current?.slot as SlotKey | undefined;
    const driverId = active.data.current?.driverId as number | undefined;
    const fromSlot = active.data.current?.fromSlot as SlotKey | undefined;
    if (!targetSlot || !driverId || isSlotLocked(targetSlot)) return;
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;

    if (fromSlot && fromSlot !== targetSlot) {
      if (isSlotLocked(fromSlot)) return;
      if (SLOT_DOMAIN[fromSlot] === SLOT_DOMAIN[targetSlot]) {
        // Same domain: swap occupants.
        setSlots((prev) => ({ ...prev, [fromSlot]: prev[targetSlot], [targetSlot]: driver }));
        setArmedSlot(null);
      } else {
        // Across domains (podium → pole…): copy, the source keeps its driver.
        assign(targetSlot, driver);
      }
    } else if (!fromSlot) {
      assign(targetSlot, driver);
    }
  };

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
            {pickVerdicts?.pole.correct && pickVerdicts.p1.correct && pickVerdicts.fastestLap.correct && (
              <span className="ml-2 font-bold text-wc-gold">👑 Grand Chelem !</span>
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

          {/* Podium */}
          <div className="flex items-end justify-center gap-3">
            <div className="pt-6"><Slot slot="p2" driver={slots.p2} locked={readOnly} armed={armedSlot === 'p2'} onArm={() => setArmedSlot(armedSlot === 'p2' ? null : 'p2')} onClear={() => setSlots((s) => ({ ...s, p2: null }))} /></div>
            <Slot slot="p1" driver={slots.p1} locked={readOnly} armed={armedSlot === 'p1'} tall onArm={() => setArmedSlot(armedSlot === 'p1' ? null : 'p1')} onClear={() => setSlots((s) => ({ ...s, p1: null }))} />
            <div className="pt-6"><Slot slot="p3" driver={slots.p3} locked={readOnly} armed={armedSlot === 'p3'} onArm={() => setArmedSlot(armedSlot === 'p3' ? null : 'p3')} onClear={() => setSlots((s) => ({ ...s, p3: null }))} /></div>
          </div>

          {/* Special picks */}
          <div className="flex items-start justify-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Slot slot="pole" driver={slots.pole} locked={isSlotLocked('pole')} armed={armedSlot === 'pole'} onArm={() => setArmedSlot(armedSlot === 'pole' ? null : 'pole')} onClear={() => setSlots((s) => ({ ...s, pole: null }))} />
            <Slot slot="fastestLap" driver={slots.fastestLap} locked={readOnly} armed={armedSlot === 'fastestLap'} onArm={() => setArmedSlot(armedSlot === 'fastestLap' ? null : 'fastestLap')} onClear={() => setSlots((s) => ({ ...s, fastestLap: null }))} />
            <Slot slot="last" driver={slots.last} locked={readOnly} armed={armedSlot === 'last'} onArm={() => setArmedSlot(armedSlot === 'last' ? null : 'last')} onClear={() => setSlots((s) => ({ ...s, last: null }))} />
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

      {/* Full classification */}
      {finished && race.results && race.results.length > 0 && (
        <div className="card space-y-2">
          <h2 className="font-bold text-gray-900 dark:text-white">Classement de la course</h2>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {race.results.map((r) => (
              <div key={r.driver.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="w-8 text-right font-black text-gray-400">
                  {r.position ?? 'NC'}
                </span>
                <span className="w-1.5 h-5 rounded" style={{ backgroundColor: r.driver.constructorColor }} />
                <span className="font-bold text-gray-900 dark:text-white flex-1">
                  {r.driver.name}
                  <span className="text-gray-400 font-medium text-xs ml-2">{r.driver.constructorName}</span>
                </span>
                <span className="flex gap-1 text-xs items-center">
                  {r.sprintPosition != null && (
                    <span className="text-purple-500 font-bold" title={`Sprint : P${r.sprintPosition}`}>
                      S{r.sprintPosition}
                    </span>
                  )}
                  {r.pole && <span title="Pole position">⏱</span>}
                  {r.fastestLap && <span title="Meilleur tour">🟣</span>}
                  {r.dnf && <span className="text-gray-400" title="Abandon">DNF</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default F1RaceDetail;
