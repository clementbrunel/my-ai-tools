import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { enterRaceResults, getDrivers, getRace, getRaces, syncSeason } from '@/api/f1';
import type { Driver, Race } from '@/types';
import { formatDate } from '@/utils/dates';
import { useToast } from '@/components/Toast';
import MiniF1Car from '@/components/f1/MiniF1Car';

interface RowProps {
  driver: Driver;
  index: number;
  unclassified: boolean;
  pole: boolean;
  fastestLap: boolean;
  onToggleUnclassified: () => void;
  onSetPole: () => void;
  onSetFastestLap: () => void;
}

const SortableDriverRow: React.FC<RowProps> = ({
  driver, index, unclassified, pole, fastestLap,
  onToggleUnclassified, onSetPole, onSetFastestLap,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: driver.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 py-1.5 px-2 rounded-lg border text-sm
        ${isDragging ? 'z-10 shadow-lg border-wc-green bg-white dark:bg-wc-dark-secondary' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-wc-dark-secondary'}
        ${unclassified ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing text-gray-400 px-1 touch-none"
        aria-label={`Déplacer ${driver.code}`}
      >
        ⠿
      </button>
      <span className="w-8 text-right font-black text-gray-400">{unclassified ? 'NC' : index + 1}</span>
      <MiniF1Car color={driver.constructorColor} size={28} />
      <span className="font-bold text-gray-900 dark:text-white flex-1 min-w-0 truncate">
        {driver.name}
        <span className="text-gray-400 font-medium text-xs ml-2 hidden sm:inline">{driver.constructorName}</span>
      </span>
      <label className="flex items-center gap-1 text-xs cursor-pointer" title="Pole position">
        <input type="radio" name="pole" checked={pole} onChange={onSetPole} className="accent-wc-green" />⏱
      </label>
      <label className="flex items-center gap-1 text-xs cursor-pointer" title="Meilleur tour">
        <input type="radio" name="fastestLap" checked={fastestLap} onChange={onSetFastestLap} className="accent-purple-600" />🟣
      </label>
      <label className="flex items-center gap-1 text-xs cursor-pointer" title="Abandon / non classé">
        <input type="checkbox" checked={unclassified} onChange={onToggleUnclassified} className="accent-red-500" />
        DNF
      </label>
    </div>
  );
};

/**
 * Platform-admin entry of a race's full classification.
 * Drag rows to order the finishers; DNF rows drop to the bottom (position null).
 * Saving settles every open bet of the race.
 */
const AdminF1Tab: React.FC = () => {
  const { showToast } = useToast();
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [order, setOrder] = useState<Driver[]>([]);
  const [unclassifiedIds, setUnclassifiedIds] = useState<Set<number>>(new Set());
  const [poleId, setPoleId] = useState<number | null>(null);
  const [fastestLapId, setFastestLapId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  useEffect(() => {
    Promise.all([getRaces(), getDrivers()])
      .then(([raceRows, driverRows]) => {
        setRaces(raceRows);
        setOrder(driverRows);
        // Preselect the most recent race whose start time has passed
        const past = raceRows.filter((r) => new Date(r.raceDate) <= new Date());
        if (past.length > 0) setSelectedRaceId(past[past.length - 1].id);
        else if (raceRows.length > 0) setSelectedRaceId(raceRows[0].id);
      })
      .catch(() => setError('Impossible de charger les courses'));
  }, []);

  // Prefill from existing results when selecting an already-finished race
  useEffect(() => {
    if (selectedRaceId == null) return;
    getRace(selectedRaceId)
      .then((race) => {
        if (!race.results || race.results.length === 0) return;
        const sorted = [...race.results].sort(
          (a, b) => (a.position ?? 99) - (b.position ?? 99),
        );
        setOrder((current) => {
          const inResults = sorted.map((r) => current.find((d) => d.id === r.driver.id) ?? r.driver);
          const missing = current.filter((d) => !sorted.some((r) => r.driver.id === d.id));
          return [...inResults, ...missing];
        });
        setUnclassifiedIds(new Set(sorted.filter((r) => r.position == null).map((r) => r.driver.id)));
        setPoleId(sorted.find((r) => r.pole)?.driver.id ?? null);
        setFastestLapId(sorted.find((r) => r.fastestLap)?.driver.id ?? null);
      })
      .catch(() => { /* keep current grid order */ });
  }, [selectedRaceId]);

  const selectedRace = races.find((r) => r.id === selectedRaceId);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const summary = await syncSeason(2026);
      showToast(summary, 'success');
      const [raceRows, driverRows] = await Promise.all([getRaces(), getDrivers()]);
      setRaces(raceRows);
      setOrder(driverRows);
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message ?? "Échec de l'import jolpica (réseau ?) — saisie manuelle possible ci-dessous", 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Classified drivers first (in current order), unclassified pinned at the bottom
  const displayOrder = useMemo(() => {
    const classified = order.filter((d) => !unclassifiedIds.has(d.id));
    const unclassified = order.filter((d) => unclassifiedIds.has(d.id));
    return [...classified, ...unclassified];
  }, [order, unclassifiedIds]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((current) => {
      const oldIndex = current.findIndex((d) => d.id === active.id);
      const newIndex = current.findIndex((d) => d.id === over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const handleSave = async () => {
    if (selectedRaceId == null) return;
    setIsSaving(true);
    try {
      const classified = displayOrder.filter((d) => !unclassifiedIds.has(d.id));
      const entries = displayOrder.map((driver) => ({
        driverId: driver.id,
        position: unclassifiedIds.has(driver.id) ? null : classified.indexOf(driver) + 1,
        pole: driver.id === poleId,
        fastestLap: driver.id === fastestLapId,
        dnf: unclassifiedIds.has(driver.id),
      }));
      await enterRaceResults(selectedRaceId, entries);
      showToast('Résultats enregistrés — paris réglés ! 🏁', 'success');
      setRaces((prev) => prev.map((r) => (r.id === selectedRaceId ? { ...r, status: 'FINISHED' } : r)));
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message ?? "Impossible d'enregistrer les résultats", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="card bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{error}</div>}

      <div className="card flex flex-wrap items-center gap-3">
        <select
          className="input-field !w-auto"
          value={selectedRaceId ?? ''}
          onChange={(e) => setSelectedRaceId(Number(e.target.value))}
        >
          {races.map((race) => (
            <option key={race.id} value={race.id}>
              R{race.round} · {race.name} — {formatDate(race.raceDate)}
              {race.status === 'FINISHED' ? ' ✓' : ''}
            </option>
          ))}
        </select>
        {selectedRace?.status === 'FINISHED' && (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
            Déjà réglée — réenregistrer recalcule les points
          </span>
        )}
        <button onClick={handleSync} disabled={isSyncing} className="btn-gold ml-auto" title="Importe calendrier, grille et résultats depuis l'API jolpica-f1, et règle les paris des courses terminées">
          {isSyncing ? 'Import en cours…' : '🔄 Importer les résultats (jolpica)'}
        </button>
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold text-gray-900 dark:text-white">Classement de la course</h2>
          <span className="text-xs text-gray-400">
            Glisse les lignes pour ordonner · ⏱ pole · 🟣 meilleur tour · DNF = non classé
          </span>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayOrder.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {displayOrder.map((driver, index) => (
                <SortableDriverRow
                  key={driver.id}
                  driver={driver}
                  index={index}
                  unclassified={unclassifiedIds.has(driver.id)}
                  pole={poleId === driver.id}
                  fastestLap={fastestLapId === driver.id}
                  onToggleUnclassified={() =>
                    setUnclassifiedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(driver.id)) next.delete(driver.id);
                      else next.add(driver.id);
                      return next;
                    })
                  }
                  onSetPole={() => setPoleId(driver.id)}
                  onSetFastestLap={() => setFastestLapId(driver.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          onClick={handleSave}
          disabled={isSaving || selectedRaceId == null}
          className="btn-primary w-full"
        >
          {isSaving ? 'Enregistrement…' : 'Valider les résultats et régler les paris 🏁'}
        </button>
      </div>
    </div>
  );
};

export default AdminF1Tab;
