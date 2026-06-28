import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import {
  createCompetition,
  getCompetitions,
  getCompetitionTeams,
  getAllKnownTeams,
  setCompetitionTeams,
} from '../../api/competitions';

const AdminCompetitionsTab: React.FC = () => {
  const { showToast } = useToast();

  const [competitions, setCompetitions] = useState<string[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [newCompetitionName, setNewCompetitionName] = useState('');
  const [showNewCompetitionForm, setShowNewCompetitionForm] = useState(false);

  const [rosterTeams, setRosterTeams] = useState<Set<string>>(new Set());
  const [knownTeams, setKnownTeams] = useState<string[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const loadingForRef = useRef<string>('');

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

  const loadRoster = async (competition: string) => {
    loadingForRef.current = competition;
    setSelectedCompetition(competition);
    setIsDirty(false);
    setIsLoadingTeams(true);
    try {
      const teams = await getCompetitionTeams(competition);
      if (loadingForRef.current !== competition) return;
      setRosterTeams(new Set(teams));
    } finally {
      if (loadingForRef.current === competition) setIsLoadingTeams(false);
    }
  };

  const toggleTeam = (team: string) => {
    setRosterTeams((prev) => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });
    setIsDirty(true);
  };

  const addCustomTeam = () => {
    const name = newTeamName.trim();
    if (!name) return;
    setRosterTeams((prev) => new Set([...prev, name]));
    if (!knownTeams.includes(name)) {
      setKnownTeams((prev) => [...prev, name].sort());
    }
    setNewTeamName('');
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedCompetition) return;
    setIsSaving(true);
    try {
      await setCompetitionTeams(selectedCompetition, [...rosterTeams].sort());
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
    if (!name || competitions.includes(name)) return;
    await createCompetition(name);
    const updated = [...competitions, name].sort();
    setCompetitions(updated);
    setNewCompetitionName('');
    setShowNewCompetitionForm(false);
    await loadRoster(name);
  };

  const inRoster = (team: string) => rosterTeams.has(team);

  // Teams not yet in knownTeams but in current roster (edge case)
  const extraRosterTeams = [...rosterTeams].filter((t) => !knownTeams.includes(t)).sort();
  const allDisplayTeams = [...new Set([...knownTeams, ...extraRosterTeams])].sort();

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
              key={c}
              onClick={() => loadRoster(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCompetition === c
                  ? 'bg-wc-green text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {c}
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
              Équipes — <span className="text-wc-green">{selectedCompetition}</span>
            </h3>
            <span className="text-sm text-gray-500">{rosterTeams.size} équipe{rosterTeams.size !== 1 ? 's' : ''}</span>
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
                {allDisplayTeams.map((team) => {
                  const checked = inRoster(team);
                  return (
                    <label
                      key={team}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                        checked
                          ? 'border-wc-green bg-wc-green/10 text-gray-900 dark:text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTeam(team)}
                        className="accent-wc-green"
                      />
                      {team}
                    </label>
                  );
                })}
                {allDisplayTeams.length === 0 && (
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
