import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import {
  createCompetition,
  getCompetitions,
  getCompetitionTeams,
  getAllKnownTeams,
  setCompetitionTeams,
  setCompetitionActive,
  setCompetitionSettings,
  syncCompetitionTeamsFromFootballData,
  deleteCompetition,
  findOrCreateTeam,
} from '@/api/competitions';
import { getDrivers } from '@/api/f1';
import type { CompetitionDto, Driver, Sport, TeamDto } from '@/types';
import MiniF1Car from '@/components/f1/MiniF1Car';
import ConfirmModal from '@/components/ConfirmModal';
import { extractErrorMessage } from '@/utils/errors';

interface AdminCompetitionsTabProps {
  /** Sport scope selected at the top of the admin page. */
  sport: Sport;
}

const AdminCompetitionsTab: React.FC<AdminCompetitionsTabProps> = ({ sport }) => {
  const { showToast } = useToast();

  const [competitions, setCompetitions] = useState<CompetitionDto[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<CompetitionDto | null>(null);
  const [newCompetitionName, setNewCompetitionName] = useState('');
  const [showNewCompetitionForm, setShowNewCompetitionForm] = useState(false);

  const [rosterTeamIds, setRosterTeamIds] = useState<Set<number>>(new Set());
  const [knownTeams, setKnownTeams] = useState<TeamDto[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamOriginFilter, setTeamOriginFilter] = useState<'ALL' | 'NATIONAL' | 'CLUB'>('ALL');
  const [newTeamName, setNewTeamName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [seasonInput, setSeasonInput] = useState('');
  const [footballDataCodeInput, setFootballDataCodeInput] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSyncingTeams, setIsSyncingTeams] = useState(false);
  const [f1Drivers, setF1Drivers] = useState<Driver[] | null>(null);
  const loadingForRef = useRef<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmLabel?: string;
    variant?: 'danger' | 'default'; onConfirm: () => void;
  } | null>(null);

  // Known teams span every sport's rosters — fetched once.
  useEffect(() => {
    getAllKnownTeams().then(setKnownTeams);
  }, []);

  // (Re)load this sport's competitions whenever the admin-page sport switch changes.
  useEffect(() => {
    (async () => {
      const comps = await getCompetitions([sport]);
      setCompetitions(comps);
      const first = comps[0];
      if (first) await loadRoster(first);
      else setSelectedCompetition(null);
    })();
  }, [sport]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRoster = async (competition: CompetitionDto) => {
    loadingForRef.current = competition.id;
    setSelectedCompetition(competition);
    setSeasonInput(competition.season?.toString() ?? '');
    setFootballDataCodeInput(competition.footballDataCompetitionCode ?? '');
    setIsDirty(false);
    setIsLoadingTeams(true);
    try {
      const teams = await getCompetitionTeams(competition.id);
      if (loadingForRef.current !== competition.id) return;
      setRosterTeamIds(new Set(teams.map((t) => t.id)));
    } finally {
      if (loadingForRef.current === competition.id) setIsLoadingTeams(false);
    }
  };

  const toggleTeam = (teamId: number) => {
    setRosterTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
    setIsDirty(true);
  };

  const addCustomTeam = async () => {
    const name = newTeamName.trim();
    if (!name) return;
    setNewTeamName('');
    try {
      const team = await findOrCreateTeam(name);
      setRosterTeamIds((prev) => new Set([...prev, team.id]));
      setKnownTeams((prev) => (prev.some((t) => t.id === team.id) ? prev : [...prev, team].sort((a, b) => a.name.localeCompare(b.name))));
      setIsDirty(true);
    } catch {
      showToast("Erreur lors de l'ajout de l'équipe");
    }
  };

  const handleSave = async () => {
    if (!selectedCompetition) return;
    setIsSaving(true);
    try {
      await setCompetitionTeams(selectedCompetition.id, [...rosterTeamIds]);
      setIsDirty(false);
      showToast('Roster sauvegardé ✅');
    } catch {
      showToast('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncTeamsFromFootballData = async () => {
    if (!selectedCompetition) return;
    setIsSyncingTeams(true);
    try {
      const teams = await syncCompetitionTeamsFromFootballData(selectedCompetition.id);
      setRosterTeamIds(new Set(teams.map((t) => t.id)));
      setKnownTeams((prev) => {
        const merged = [...prev];
        for (const t of teams) if (!merged.some((k) => k.id === t.id)) merged.push(t);
        return merged.sort((a, b) => a.name.localeCompare(b.name));
      });
      setIsDirty(false);
      showToast(`Roster importé depuis football-data.org (${teams.length} équipe${teams.length > 1 ? 's' : ''}) ✅`);
    } catch (err) {
      showToast(extractErrorMessage(err, "Erreur lors de l'import du roster depuis football-data.org"));
    } finally {
      setIsSyncingTeams(false);
    }
  };

  // Load the F1 entry list once an F1 competition is shown.
  useEffect(() => {
    if (selectedCompetition?.sport === 'F1' && f1Drivers === null) {
      getDrivers().then(setF1Drivers).catch(() => setF1Drivers([]));
    }
  }, [selectedCompetition, f1Drivers]);

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCompetitionName.trim();
    if (!name || competitions.some((c) => c.name === name)) return;
    await createCompetition(name, sport);
    const updated = await getCompetitions([sport]);
    setCompetitions(updated);
    setNewCompetitionName('');
    setShowNewCompetitionForm(false);
    const created = updated.find((c) => c.name === name);
    if (created) await loadRoster(created);
  };

  const inRoster = (teamId: number) => rosterTeamIds.has(teamId);

  // National teams carry an iso2 (World Cup backfill); club teams (football-data.org imports) don't.
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filteredKnownTeams = knownTeams.filter((team) => {
    if (teamOriginFilter === 'NATIONAL' && team.iso2 == null) return false;
    if (teamOriginFilter === 'CLUB' && team.iso2 != null) return false;
    if (teamSearch.trim() && !normalize(team.name).includes(normalize(teamSearch.trim()))) return false;
    return true;
  });

  const toggleActive = async (competition: CompetitionDto) => {
    const active = !competition.active;
    try {
      await setCompetitionActive(competition.id, active);
      setCompetitions((prev) => prev.map((c) => (c.id === competition.id ? { ...c, active } : c)));
      setSelectedCompetition((prev) => (prev?.id === competition.id ? { ...prev, active } : prev));
    } catch {
      showToast('Erreur lors de la mise à jour du statut');
    }
  };

  const isSeasonDirty = selectedCompetition !== null
    && seasonInput !== (selectedCompetition.season?.toString() ?? '');
  const isFootballDataCodeDirty = selectedCompetition !== null
    && selectedCompetition.sport !== 'F1'
    && footballDataCodeInput !== (selectedCompetition.footballDataCompetitionCode ?? '');
  const isCompetitionSettingsDirty = isSeasonDirty || isFootballDataCodeDirty;

  const handleSaveCompetitionSettings = async () => {
    if (!selectedCompetition) return;
    const trimmedSeason = seasonInput.trim();
    const season = trimmedSeason === '' ? null : Number(trimmedSeason);
    if (season !== null && !Number.isInteger(season)) return;
    const code = footballDataCodeInput.trim() || null;
    setIsSavingSettings(true);
    try {
      await setCompetitionSettings(selectedCompetition.id, season, code);
      const normalizedCode = code ? code.toUpperCase() : null;
      setCompetitions((prev) => prev.map((c) => (c.id === selectedCompetition.id
        ? { ...c, season, footballDataCompetitionCode: normalizedCode }
        : c)));
      setSelectedCompetition((prev) => (prev?.id === selectedCompetition.id
        ? { ...prev, season, footballDataCompetitionCode: normalizedCode }
        : prev));
      showToast('Réglages de la compétition mis à jour ✅');
    } catch {
      showToast('Erreur lors de la mise à jour des réglages');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteCompetition = (competition: CompetitionDto) => {
    setConfirmDialog({
      title: 'Supprimer la compétition',
      message: `Êtes-vous sûr de vouloir supprimer « ${competition.name} » ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteCompetition(competition.id);
          const remaining = competitions.filter((c) => c.id !== competition.id);
          setCompetitions(remaining);
          if (selectedCompetition?.id === competition.id) {
            const next = remaining[0];
            if (next) await loadRoster(next);
            else setSelectedCompetition(null);
          }
          showToast('Compétition supprimée');
        } catch {
          showToast('Impossible de supprimer cette compétition — elle a probablement des matchs ou courses associés');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Competition selector */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-bold text-gray-900 dark:text-white">
            🏆 Compétitions {sport === 'F1' ? '🏎' : '⚽'}
          </h3>
          <button
            onClick={() => setShowNewCompetitionForm((v) => !v)}
            className="btn-secondary text-sm"
          >
            ➕ Nouvelle
          </button>
        </div>

        {showNewCompetitionForm && (
          <form onSubmit={handleCreateCompetition} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newCompetitionName}
              onChange={(e) => setNewCompetitionName(e.target.value)}
              className="input-field flex-1"
              placeholder={sport === 'F1' ? 'Ex: Formule 1 2027' : 'Ex: FIFA World Cup 2026'}
              autoFocus
              required
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              Créer ({sport === 'F1' ? '🏎 F1' : '⚽ Foot'})
            </button>
            <button type="button" onClick={() => setShowNewCompetitionForm(false)} className="btn-secondary">Annuler</button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {competitions.map((c) => (
            <div key={c.id} className="flex items-stretch rounded-lg overflow-hidden">
              <button
                onClick={() => loadRoster(c)}
                className={`h-8 flex items-center px-3 text-sm font-medium transition-colors ${
                  selectedCompetition?.id === c.id
                    ? 'bg-wc-green text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                } ${!c.active ? 'opacity-50' : ''}`}
              >
                {c.name}
              </button>
              <button
                onClick={() => toggleActive(c)}
                title={c.active ? 'Active — visible par défaut dans les filtres' : 'Inactive — masquée par défaut dans les filtres'}
                className={`h-8 flex items-center px-2 text-xs font-semibold border-l transition-colors ${
                  c.active
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {c.active ? '● Active' : '○ Inactive'}
              </button>
              <button
                onClick={() => handleDeleteCompetition(c)}
                title="Supprimer la compétition"
                className="h-8 flex items-center px-2 text-xs font-semibold border-l border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400 transition-colors"
              >
                🗑
              </button>
            </div>
          ))}
          {competitions.length === 0 && (
            <p className="text-sm text-gray-400">Aucune compétition pour ce sport — créez-en une ci-dessus.</p>
          )}
        </div>
      </div>

      {/* Season + football-data.org competition code — one form, saved together */}
      {selectedCompetition && (
        <div className="card">
          <h3 className="font-bold text-gray-900 dark:text-white mb-1">
            Réglages — <span className="text-wc-green">{selectedCompetition.name}</span>
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            {selectedCompetition.sport === 'F1'
              ? "Saison utilisée pour l'import jolpica (calendrier, grille, résultats)."
              : 'Saison de la compétition (facultatif) et code football-data.org (ex : FL1 = Ligue 1, PL = Premier League, WC = Coupe du Monde) — vide désactive la synchronisation automatique.'}
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSaveCompetitionSettings(); }}
            className="flex flex-wrap gap-3 items-end"
          >
            <div className="w-32">
              <label className="block text-xs text-gray-400 mb-1">Saison</label>
              <input
                type="number"
                value={seasonInput}
                onChange={(e) => setSeasonInput(e.target.value)}
                className="input-field w-32"
                placeholder="Ex: 2026"
              />
            </div>

            {selectedCompetition.sport !== 'F1' && (
              <div className="w-32">
                <label className="block text-xs text-gray-400 mb-1">Code football-data.org</label>
                <input
                  type="text"
                  value={footballDataCodeInput}
                  onChange={(e) => setFootballDataCodeInput(e.target.value.toUpperCase())}
                  className="input-field w-32"
                  placeholder="Ex: FL1"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!isCompetitionSettingsDirty || isSavingSettings}
              className="btn-primary disabled:opacity-50"
            >
              {isSavingSettings ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
            </button>
          </form>
        </div>
      )}

      {/* F1 competitions: the entry list (drivers per constructor) is the roster */}
      {selectedCompetition && selectedCompetition.sport === 'F1' && (
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-gray-900 dark:text-white">
              Pilotes engagés — <span className="text-wc-green">{selectedCompetition.name}</span>
            </h3>
            <span className="text-sm text-gray-500">
              {f1Drivers ? `${f1Drivers.length} pilote${f1Drivers.length > 1 ? 's' : ''}` : ''}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Grille mise à jour par l'import jolpica (onglet 🏁 Courses) — calendrier et résultats s'y gèrent aussi.
          </p>

          {f1Drivers === null ? (
            <p className="text-sm text-gray-400">Chargement de la grille…</p>
          ) : f1Drivers.length === 0 ? (
            <p className="text-sm text-gray-400">
              Aucun pilote — lance l'import jolpica depuis l'onglet 🏁 Courses pour charger la grille.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...new Map(f1Drivers.map((d) => [d.constructorId, d])).values()].map((ref) => (
                <div key={ref.constructorId} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-5 rounded" style={{ backgroundColor: ref.constructorColor }} />
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{ref.constructorName}</span>
                  </div>
                  <div className="space-y-1.5">
                    {f1Drivers
                      .filter((d) => d.constructorId === ref.constructorId)
                      .map((driver) => (
                        <div key={driver.id} className="flex items-center gap-2 text-sm">
                          <MiniF1Car color={driver.constructorColor} size={26} />
                          <span className="font-medium text-gray-900 dark:text-white flex-1 truncate">
                            {driver.name}
                          </span>
                          <span className="text-xs font-bold text-gray-400">
                            {driver.code} · #{driver.number}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team roster (football competitions) */}
      {selectedCompetition && selectedCompetition.sport !== 'F1' && (
        <div className="card">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h3 className="font-bold text-gray-900 dark:text-white">
              Équipes — <span className="text-wc-green">{selectedCompetition.name}</span>
            </h3>
            <div className="flex items-center gap-2">
              {selectedCompetition.footballDataCompetitionCode != null && (
                <button
                  onClick={handleSyncTeamsFromFootballData}
                  disabled={isSyncingTeams}
                  className="btn-secondary text-xs disabled:opacity-50"
                  title="Importe les clubs de la compétition configurée depuis football-data.org"
                >
                  {isSyncingTeams ? '⏳ Import...' : '🔄 Importer depuis football-data.org'}
                </button>
              )}
              <span className="text-sm text-gray-500">{rosterTeamIds.size} équipe{rosterTeamIds.size !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Cochez les équipes participantes. Les équipes déjà présentes dans les matchs existants sont incluses automatiquement.
          </p>

          {isLoadingTeams ? (
            <p className="text-sm text-gray-400">Chargement...</p>
          ) : (
            <>
              {/* Add custom team */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTeam())}
                  className="input-field flex-1"
                  placeholder="Ajouter une équipe..."
                />
                <button type="button" onClick={addCustomTeam} className="btn-secondary whitespace-nowrap">
                  + Ajouter
                </button>
              </div>

              {/* Search + origin filter for the team grid below */}
              <div className="flex flex-wrap gap-2 mb-3">
                <input
                  type="text"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  className="input-field flex-1 min-w-[160px]"
                  placeholder="🔍 Rechercher une équipe..."
                />
                <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  {([
                    ['ALL', 'Toutes'],
                    ['NATIONAL', '🌍 Pays'],
                    ['CLUB', '🛡️ Clubs'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTeamOriginFilter(value)}
                      className={`h-9 px-3 text-sm font-medium transition-colors whitespace-nowrap ${
                        teamOriginFilter === value
                          ? 'bg-wc-green text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                {filteredKnownTeams.map((team) => {
                  const checked = inRoster(team.id);
                  return (
                    <label
                      key={team.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                        checked
                          ? 'border-wc-green bg-wc-green/10 text-gray-900 dark:text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTeam(team.id)}
                        className="accent-wc-green"
                      />
                      {team.name}
                    </label>
                  );
                })}
                {knownTeams.length === 0 && (
                  <p className="col-span-full text-sm text-gray-400">
                    Aucune équipe connue — saisissez-en une ci-dessus.
                  </p>
                )}
                {knownTeams.length > 0 && filteredKnownTeams.length === 0 && (
                  <p className="col-span-full text-sm text-gray-400">
                    Aucune équipe ne correspond à ce filtre.
                  </p>
                )}
              </div>

              <button
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="btn-primary disabled:opacity-50"
              >
                {isSaving ? '⏳ Sauvegarde...' : '💾 Sauvegarder le roster'}
              </button>
            </>
          )}
        </div>
      )}

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

export default AdminCompetitionsTab;
