import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import {
  createCompetition,
  getCompetitions,
  getCompetitionTeams,
  getAllKnownTeams,
  setCompetitionTeams,
  findOrCreateTeam,
} from '@/api/competitions';
import { getDrivers } from '@/api/f1';
import type { CompetitionDto, Driver, Sport, TeamDto } from '@/types';
import MiniF1Car from '@/components/f1/MiniF1Car';

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
  const [newTeamName, setNewTeamName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [f1Drivers, setF1Drivers] = useState<Driver[] | null>(null);
  const loadingForRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [comps, known] = await Promise.all([getCompetitions(), getAllKnownTeams()]);
      setCompetitions(comps);
      setKnownTeams(known);
      const first = comps.find((c) => c.sport === sport);
      if (first) await loadRoster(first);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRoster = async (competition: CompetitionDto) => {
    loadingForRef.current = competition.id;
    setSelectedCompetition(competition);
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

  const visibleCompetitions = competitions.filter((c) => c.sport === sport);

  // Load the F1 entry list once an F1 competition is shown.
  useEffect(() => {
    if (selectedCompetition?.sport === 'F1' && f1Drivers === null) {
      getDrivers().then(setF1Drivers).catch(() => setF1Drivers([]));
    }
  }, [selectedCompetition, f1Drivers]);

  // Follow the admin-page sport switch.
  useEffect(() => {
    if (selectedCompetition && selectedCompetition.sport !== sport) {
      const first = competitions.find((c) => c.sport === sport);
      if (first) loadRoster(first);
      else setSelectedCompetition(null);
    }
  }, [sport]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCompetitionName.trim();
    if (!name || competitions.some((c) => c.name === name)) return;
    await createCompetition(name, sport);
    const updated = await getCompetitions();
    setCompetitions(updated);
    setNewCompetitionName('');
    setShowNewCompetitionForm(false);
    const created = updated.find((c) => c.name === name);
    if (created) await loadRoster(created);
  };

  const inRoster = (teamId: number) => rosterTeamIds.has(teamId);

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
          {visibleCompetitions.map((c) => (
            <button
              key={c.id}
              onClick={() => loadRoster(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCompetition?.id === c.id
                  ? 'bg-wc-green text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {c.name}
            </button>
          ))}
          {visibleCompetitions.length === 0 && (
            <p className="text-sm text-gray-400">Aucune compétition pour ce sport — créez-en une ci-dessus.</p>
          )}
        </div>
      </div>

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
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-gray-900 dark:text-white">
              Équipes — <span className="text-wc-green">{selectedCompetition.name}</span>
            </h3>
            <span className="text-sm text-gray-500">{rosterTeamIds.size} équipe{rosterTeamIds.size !== 1 ? 's' : ''}</span>
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

              {/* Team grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                {knownTeams.map((team) => {
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
    </div>
  );
};

export default AdminCompetitionsTab;
