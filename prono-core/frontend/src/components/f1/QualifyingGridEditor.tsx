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
import { enterQualifyingResults } from '@/api/f1';
import type { Driver, Race } from '@/types';
import { useToast } from '@/components/Toast';
import MiniF1Car from '@/components/f1/MiniF1Car';

interface RowProps {
  driver: Driver;
  index: number;
  excluded: boolean;
  time: string;
  onToggleExcluded: () => void;
  onTimeChange: (value: string) => void;
}

const SortableGridRow: React.FC<RowProps> = ({ driver, index, excluded, time, onToggleExcluded, onTimeChange }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: driver.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 py-2 sm:py-1.5 px-2 rounded-lg border text-sm
        ${isDragging ? 'z-10 shadow-lg border-wc-green bg-white dark:bg-wc-dark-secondary' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-wc-dark-secondary'}
        ${excluded ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing text-gray-400 px-1 touch-none shrink-0"
        aria-label={`Déplacer ${driver.code}`}
      >
        ⠿
      </button>
      <span className="w-8 text-right font-black text-gray-400 shrink-0">
        {excluded ? '—' : `P${index + 1}`}
      </span>
      <MiniF1Car color={driver.constructorColor} size={28} />
      <span className="font-bold text-gray-900 dark:text-white flex-1 min-w-0 truncate">
        {driver.name}
        {!excluded && index === 0 && <span className="ml-1" title="Pole position">⏱</span>}
      </span>
      <input
        type="text"
        value={time}
        onChange={(e) => onTimeChange(e.target.value)}
        disabled={excluded}
        placeholder="temps"
        title="Temps dans la dernière session atteinte (Q3, sinon Q2, sinon Q1), ex: 1:24.083"
        className="input-field !w-20 sm:!w-24 !py-0.5 !px-1.5 text-xs tabular-nums disabled:opacity-40 shrink-0"
      />
      <label
        className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap shrink-0"
        title="Ne figure pas sur la grille (pilote de réserve, forfait…)"
      >
        <input type="checkbox" checked={excluded} onChange={onToggleExcluded} className="accent-red-500 w-4 h-4" />
        Absent
      </label>
    </div>
  );
};

interface Props {
  race: Race;
  /** Full detail (getRace) — carries the stored grid and its draft flag; null while loading. */
  raceDetail: Race | null;
  /** Active roster — fills the grid when nothing is stored yet (jolpica late). */
  drivers: Driver[];
  onValidated: (race: Race) => void;
}

/**
 * Platform-admin review of a race's starting grid — same flow as the race classification:
 * a jolpica import lands as a draft (hidden from players), the admin reorders/fixes it and
 * validates; or types the whole grid in when jolpica lags behind. Validating publishes the
 * grid and protects it from being overwritten by the season sync.
 */
const QualifyingGridEditor: React.FC<Props> = ({ race, raceDetail, drivers, onValidated }) => {
  const { showToast } = useToast();
  const [order, setOrder] = useState<Driver[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [timeById, setTimeById] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const grid = raceDetail?.qualifyingResults ?? [];
  const isDraft = raceDetail?.qualifyingDraft === true;
  const isValidated = grid.length > 0 && !isDraft;
  const qualifyingPassed = new Date(race.qualifyingDate) <= new Date();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // Prefill from the stored grid (draft or validated); roster drivers not on it go to the
  // bottom, flagged absent. Nothing stored yet → the full roster, everyone on the grid.
  useEffect(() => {
    if (!raceDetail) return;
    const stored = [...(raceDetail.qualifyingResults ?? [])].sort((a, b) => a.position - b.position);
    if (stored.length > 0) {
      const onGrid = stored.map((q) => drivers.find((d) => d.id === q.driver.id) ?? q.driver);
      const missing = drivers.filter((d) => !stored.some((q) => q.driver.id === d.id));
      setOrder([...onGrid, ...missing]);
      setExcludedIds(new Set(missing.map((d) => d.id)));
      setTimeById(Object.fromEntries(stored.filter((q) => q.time).map((q) => [q.driver.id, q.time as string])));
    } else {
      setOrder(drivers);
      setExcludedIds(new Set());
      setTimeById({});
    }
  }, [raceDetail, drivers]);

  const displayOrder = useMemo(() => {
    const onGrid = order.filter((d) => !excludedIds.has(d.id));
    const absent = order.filter((d) => excludedIds.has(d.id));
    return [...onGrid, ...absent];
  }, [order, excludedIds]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((current) => {
      const oldIndex = current.findIndex((d) => d.id === active.id);
      const newIndex = current.findIndex((d) => d.id === over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const handleValidate = async () => {
    const onGrid = displayOrder.filter((d) => !excludedIds.has(d.id));
    if (onGrid.length === 0) {
      showToast('La grille est vide', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await enterQualifyingResults(race.id, onGrid.map((driver, i) => ({
        driverId: driver.id,
        position: i + 1,
        time: timeById[driver.id]?.trim() || null,
      })));
      showToast('Grille de départ validée — visible des joueurs ⏱', 'success');
      onValidated(updated);
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message ?? "Impossible d'enregistrer la grille", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-bold text-gray-900 dark:text-white">Grille de départ</h2>
        <span className="text-xs text-gray-400">Glisse les lignes pour ordonner · P1 = pole ⏱ · Absent = hors grille</span>
      </div>
      {isDraft && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm px-3 py-2">
          ⚠️ Grille importée de jolpica, <strong>pas encore validée</strong> : les joueurs ne la voient pas.
          Vérifie-la (pénalités de grille…), corrige si besoin, puis valide.
        </div>
      )}
      {grid.length === 0 && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 text-sm px-3 py-2">
          Aucune grille importée{qualifyingPassed ? ' — jolpica en retard ?' : '.'} Tu peux la saisir à la main :
          glisse les pilotes dans l'ordre de la grille, coche « Absent » pour ceux qui ne prennent pas le départ.
        </div>
      )}
      {isValidated && (
        <p className="text-xs text-gray-400">
          Grille publiée : le sync jolpica ne l'écrase plus (seul « Resync grille qualifs » la remplace).
          {race.status === 'FINISHED' && ' Course déjà réglée : si la pole change, revalide aussi le classement (onglet Course).'}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayOrder.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {displayOrder.map((driver, index) => (
              <SortableGridRow
                key={driver.id}
                driver={driver}
                index={index}
                excluded={excludedIds.has(driver.id)}
                time={timeById[driver.id] ?? ''}
                onToggleExcluded={() =>
                  setExcludedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(driver.id)) next.delete(driver.id);
                    else next.add(driver.id);
                    return next;
                  })
                }
                onTimeChange={(value) => setTimeById((prev) => ({ ...prev, [driver.id]: value }))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button onClick={handleValidate} disabled={isSaving || !raceDetail} className="btn-primary w-full">
        {isSaving ? 'Enregistrement…' : 'Valider la grille de départ ⏱'}
      </button>
    </div>
  );
};

export default QualifyingGridEditor;
