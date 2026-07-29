import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { deleteRace, enterRaceResults, getDrivers, getRace, getRaces, resyncQualifying, resyncResults, syncSeason } from '@/api/f1';
import type { Driver, Race } from '@/types';
import { formatDate } from '@/utils/dates';
import { useToast } from '@/components/Toast';
import MiniF1Car from '@/components/f1/MiniF1Car';
import ConfirmModal from '@/components/ConfirmModal';

interface RowProps {
  driver: Driver;
  index: number;
  unclassified: boolean;
  pole: boolean;
  fastestLap: boolean;
  time: string;
  onToggleUnclassified: () => void;
  onSetPole: () => void;
  onSetFastestLap: () => void;
  onTimeChange: (value: string) => void;
}

const SortableDriverRow: React.FC<RowProps> = ({
  driver, index, unclassified, pole, fastestLap, time,
  onToggleUnclassified, onSetPole, onSetFastestLap, onTimeChange,
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
      <input
        type="text"
        value={time}
        onChange={(e) => onTimeChange(e.target.value)}
        disabled={unclassified}
        placeholder="temps / écart"
        title="Temps (vainqueur) ou écart au vainqueur, ex: 1:32:53.435 ou +22.792"
        className="input-field !w-24 !py-0.5 !px-1.5 text-xs tabular-nums disabled:opacity-40"
      />
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
  const [timeById, setTimeById] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResyncingGrid, setIsResyncingGrid] = useState(false);
  const [isResyncingResults, setIsResyncingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmLabel?: string;
    variant?: 'danger' | 'default'; onConfirm: () => void;
  } | null>(null);

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

  // Prefills the form from a race's stored results — shared by the initial load and by a
  // forced resync, which needs to reflect the freshly re-imported classification right away.
  // Always resets DNF/pole/fastest-lap/time, even when the newly selected race has no results
  // yet — otherwise those picks leak over from whichever race was selected before it.
  const applyRaceResultsToForm = useCallback((race: Race) => {
    const sorted = race.results && race.results.length > 0
      ? [...race.results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
      : [];
    if (sorted.length > 0) {
      setOrder((current) => {
        const inResults = sorted.map((r) => current.find((d) => d.id === r.driver.id) ?? r.driver);
        const missing = current.filter((d) => !sorted.some((r) => r.driver.id === d.id));
        return [...inResults, ...missing];
      });
    }
    setUnclassifiedIds(new Set(sorted.filter((r) => r.position == null).map((r) => r.driver.id)));
    setPoleId(sorted.find((r) => r.pole)?.driver.id ?? null);
    setFastestLapId(sorted.find((r) => r.fastestLap)?.driver.id ?? null);
    setTimeById(Object.fromEntries(
      sorted.filter((r) => r.time).map((r) => [r.driver.id, r.time as string]),
    ));
  }, []);

  // Prefill from existing results when selecting an already-finished race
  useEffect(() => {
    if (selectedRaceId == null) return;
    getRace(selectedRaceId)
      .then(applyRaceResultsToForm)
      .catch(() => { /* keep current grid order */ });
  }, [selectedRaceId, applyRaceResultsToForm]);

  const selectedRace = races.find((r) => r.id === selectedRaceId);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const summary = await syncSeason();
      showToast(summary, 'success');
      const [raceRows, driverRows] = await Promise.all([getRaces(), getDrivers()]);
      setRaces(raceRows);
      setOrder(driverRows);
      if (selectedRaceId != null) {
        await getRace(selectedRaceId).then(applyRaceResultsToForm).catch(() => { /* keep current grid order */ });
      }
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message ?? "Échec de l'import jolpica (réseau ?) — saisie manuelle possible ci-dessous", 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Forces a fresh pull of the qualifying grid even once the race is FINISHED — the
  // regular sync skips finished races, but a grid penalty can be confirmed after the fact.
  const handleResyncQualifying = async () => {
    if (selectedRaceId == null) return;
    setIsResyncingGrid(true);
    try {
      const message = await resyncQualifying(selectedRaceId);
      showToast(message, 'success');
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message ?? 'Échec du re-import de la grille de qualifs', 'error');
    } finally {
      setIsResyncingGrid(false);
    }
  };

  // Forces a fresh pull of the full classification even once the race is FINISHED — the
  // regular sync skips finished races, but a post-race penalty can be confirmed after the fact.
  const handleResyncResults = async () => {
    if (selectedRaceId == null) return;
    setIsResyncingResults(true);
    try {
      const message = await resyncResults(selectedRaceId);
      showToast(message, 'success');
      // The server's status is authoritative — a "nothing to import yet" resync (e.g. forced
      // on a race jolpica hasn't raced yet) settles nothing, so it must not flip the local
      // "✓ Déjà réglée" badge.
      const race = await getRace(selectedRaceId);
      applyRaceResultsToForm(race);
      setRaces((prev) => prev.map((r) => (r.id === selectedRaceId ? { ...r, status: race.status } : r)));
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message ?? 'Échec du re-import des résultats', 'error');
    } finally {
      setIsResyncingResults(false);
    }
  };

  // For a stale duplicate left over by a jolpica resync (round renumbered after a
  // calendar change) — the backend refuses if a group already has bets on the race.
  const handleDeleteRace = () => {
    const race = selectedRace;
    if (!race) return;
    setConfirmDialog({
      title: 'Supprimer la course',
      message: `Êtes-vous sûr de vouloir supprimer R${race.round} · ${race.name} — ${race.circuit ?? ''} ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteRace(race.id);
          setRaces((prev) => prev.filter((r) => r.id !== race.id));
          setSelectedRaceId((prev) => (prev === race.id ? null : prev));
          showToast('Course supprimée', 'success');
        } catch (e: unknown) {
          const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
          showToast(message ?? 'Impossible de supprimer cette course', 'error');
        }
      },
    });
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
        time: unclassifiedIds.has(driver.id) ? null : (timeById[driver.id]?.trim() || null),
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
        <button
          onClick={handleResyncQualifying}
          disabled={isResyncingGrid || selectedRaceId == null}
          className="btn-secondary ml-auto"
          title="Force le re-import de la grille de qualifs de cette course depuis jolpica, même si elle est déjà terminée (utile après une pénalité sur grille confirmée après coup)"
        >
          {isResyncingGrid ? 'Import…' : '⏱ Resync grille qualifs'}
        </button>
        <button
          onClick={handleResyncResults}
          disabled={isResyncingResults || selectedRaceId == null}
          className="btn-secondary"
          title="Force le re-import du classement de cette course depuis jolpica et re-règle les paris, même si elle est déjà terminée (utile après une pénalité post-course confirmée après coup)"
        >
          {isResyncingResults ? 'Import…' : '🏁 Resync résultats course'}
        </button>
        <button onClick={handleSync} disabled={isSyncing} className="btn-gold" title="Importe calendrier, grille et résultats depuis l'API jolpica-f1, et règle les paris des courses terminées">
          {isSyncing ? 'Import en cours…' : '🔄 Importer les résultats (jolpica)'}
        </button>
        <button
          onClick={handleDeleteRace}
          disabled={selectedRaceId == null}
          className="btn-secondary text-red-600 dark:text-red-400"
          title="Supprime la course sélectionnée — refusé si des paris existent déjà dessus"
        >
          🗑 Supprimer la course
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
                  time={timeById[driver.id] ?? ''}
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
                  onTimeChange={(value) => setTimeById((prev) => ({ ...prev, [driver.id]: value }))}
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

      <ConfirmModal
        isOpen={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmLabel={confirmDialog?.confirmLabel}
        variant={confirmDialog?.variant}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};

export default AdminF1Tab;
