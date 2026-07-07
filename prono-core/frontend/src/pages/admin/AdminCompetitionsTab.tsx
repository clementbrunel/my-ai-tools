import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import {
  createCompetition,
  getCompetitions,
  getCompetitionTeams,
  getAllKnownTeams,
  setCompetitionTeams,
  findOrCreateTeam,
} from '../../api/competitions';
import type { CompetitionDto, TeamDto } from '../../types';

const AdminCompetitionsTab: React.FC = () => {
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
  const loadingForRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [comps, known] = await Promise.all([getCompetitions(), getAllKnownTeams()]);
      setCompetitions(comps);
      setKnownTeams(known);
      if (comps.length > 0) {
        await loadRoster(comps[0]);
      }
    })();
  }, []);

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

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCompetitionName.trim();
    if (!name || competitions.some((c) => c.name === name)) return;
    await createCompetition(name);
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white">🏆 Compétitions</h3>
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
              placeholder="Ex: FIFA World Cup 2026"
              autoFocus
              required
            />
            <button type="submit" className="btn-primary whitespace-nowrap">Créer</button>
            <button type="button" onClick={() => setShowNewCompetitionForm(false)} className="btn-secondary">Annuler</button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {competitions.map((c) => (
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
          {competitions.length === 0 && (
            <p className="text-sm text-gray-400">Aucune compétition — créez-en une ci-dessus.</p>
          )}
        </div>
      </div>

      {/* Team roster */}
      {selectedCompetition && (
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
