import React, { useEffect, useState } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/Toast';
import { getAllForfeitsAdmin, createForfeit, updateForfeit, deleteForfeit } from '../../api/forfeits';
import { getAllGroups } from '../../api/groups';
import DailyGagePanel from '../../components/DailyGagePanel';
import { useFormMessages } from '../../hooks/useFormMessages';
import type { Forfeit, Group } from '../../types';
import ScrollableTableWrapper from '../../components/ScrollableTableWrapper';

const FORFEIT_CATEGORIES = ['General', 'Nourriture', 'Humiliation', 'Spectacle', 'Réseaux sociaux', 'Boissons'];

const AdminForfeitsTab: React.FC = () => {
  const { showToast } = useToast();
  const { msg: forfeitMsg, setError: setForfeitError, setSuccess: setForfeitSuccess, clear: clearForfeitMessages } = useFormMessages();

  const [forfeits, setForfeits] = useState<Forfeit[]>([]);
  const [adminGroups, setAdminGroups] = useState<Group[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmLabel?: string;
    variant?: 'danger' | 'default'; onConfirm: () => void;
  } | null>(null);

  const [newForfeitTitle, setNewForfeitTitle] = useState('');
  const [newForfeitDesc, setNewForfeitDesc] = useState('');
  const [newForfeitCategory, setNewForfeitCategory] = useState('General');

  const [editingForfeit, setEditingForfeit] = useState<Forfeit | null>(null);
  const [editForfeitTitle, setEditForfeitTitle] = useState('');
  const [editForfeitDesc, setEditForfeitDesc] = useState('');
  const [editForfeitCategory, setEditForfeitCategory] = useState('General');

  useEffect(() => {
    Promise.all([getAllForfeitsAdmin(), getAllGroups()])
      .then(([f, groups]) => {
        setForfeits(f);
        setAdminGroups(groups);
      })
      .catch(console.error);
  }, []);

  const handleCreateForfeit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearForfeitMessages();
    try {
      const created = await createForfeit(newForfeitTitle, newForfeitDesc, newForfeitCategory);
      setForfeits([...forfeits, created]);
      setNewForfeitTitle(''); setNewForfeitDesc(''); setNewForfeitCategory('General');
      setForfeitSuccess('Gage créé !');
    } catch { setForfeitError('Erreur lors de la création'); }
  };

  const handleDeleteForfeit = (id: number) => {
    setConfirmDialog({
      title: 'Désactiver le gage',
      message: 'Êtes-vous sûr de vouloir désactiver ce gage ?',
      confirmLabel: 'Désactiver',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteForfeit(id);
          setForfeits(prev => prev.map((f) => f.id === id ? { ...f, isActive: false } : f));
        } catch { showToast('Erreur'); }
      },
    });
  };

  const handleOpenEditForfeit = (f: Forfeit) => {
    setEditingForfeit(f);
    setEditForfeitTitle(f.title);
    setEditForfeitDesc(f.description);
    setEditForfeitCategory(f.category);
  };

  const handleSaveEditForfeit = async () => {
    if (!editingForfeit) return;
    try {
      const updated = await updateForfeit(editingForfeit.id, editForfeitTitle, editForfeitDesc, editForfeitCategory);
      setForfeits(prev => prev.map((f) => f.id === updated.id ? updated : f));
      setEditingForfeit(null);
      showToast('Gage mis à jour !', 'success');
    } catch { showToast('Erreur lors de la mise à jour'); }
  };

  return (
    <div className="space-y-8">

      {/* Daily Gage per admin group */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">📅 Gage du Jour</h2>
        {adminGroups.length === 0 ? (
          <div className="card text-center py-6 text-gray-500">
            Vous n'administrez aucun groupe.
          </div>
        ) : (
          adminGroups.map((g) => (
            <div key={g.id} className="card space-y-3">
              <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                  👥 {g.name}
                </span>
              </h3>
              <DailyGagePanel groupId={g.id} />
            </div>
          ))
        )}
      </section>

      {/* Shared forfeit library */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">📚 Bibliothèque de gages</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ces gages sont partagés entre tous les groupes. Les gages proposés par les joueurs sont gérés par l'admin de leur groupe.
        </p>

        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">+ Ajouter un gage</h3>
          <form onSubmit={handleCreateForfeit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="label">Titre</label>
              <input type="text" value={newForfeitTitle} onChange={(e) => setNewForfeitTitle(e.target.value)}
                className="input-field" placeholder="Ex: Croissants pour tout le monde" required />
            </div>
            <div>
              <label className="label">Description</label>
              <input type="text" value={newForfeitDesc} onChange={(e) => setNewForfeitDesc(e.target.value)}
                className="input-field" placeholder="Détail du gage..." required />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select value={newForfeitCategory} onChange={(e) => setNewForfeitCategory(e.target.value)} className="input-field">
                {FORFEIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {forfeitMsg?.type === 'error' && <p className="col-span-3 text-red-500 text-sm">{forfeitMsg.text}</p>}
            {forfeitMsg?.type === 'success' && <p className="col-span-3 text-green-500 text-sm">✅ {forfeitMsg.text}</p>}
            <div className="md:col-span-3">
              <button type="submit" className="btn-primary text-sm">🃏 Ajouter le gage</button>
            </div>
          </form>
        </div>

        <div className="card overflow-hidden p-0">
          <ScrollableTableWrapper>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Gage</th>
                  <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Catégorie</th>
                  <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Effectué</th>
                  <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Statut</th>
                  <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {forfeits.filter((f) => !f.groupId).map((f) => (
                  <tr
                    key={f.id}
                    className={`border-b border-gray-100 dark:border-gray-700 ${
                      !f.isActive ? 'opacity-40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{f.title}</div>
                      <div className="text-xs text-gray-400 truncate max-w-xs">{f.description}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{f.category}</td>
                    <td className="py-3 px-4 text-center text-sm font-semibold text-amber-600">
                      {f.timesCompleted > 0 ? `✅ ×${f.timesCompleted}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        f.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {f.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleOpenEditForfeit(f)} className="text-xs text-indigo-500 hover:text-indigo-700">
                          ✏️ Éditer
                        </button>
                        {f.isActive && (
                          <button onClick={() => handleDeleteForfeit(f.id)} className="text-xs text-red-500 hover:text-red-700">
                            🗑️ Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTableWrapper>
        </div>
      </section>

      <ConfirmModal
        isOpen={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmLabel={confirmDialog?.confirmLabel}
        variant={confirmDialog?.variant}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />

      {editingForfeit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-wc-dark-secondary rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">✏️ Éditer le gage</h2>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Titre</label>
                <input type="text" value={editForfeitTitle} onChange={(e) => setEditForfeitTitle(e.target.value)}
                  className="input-field" placeholder="Titre du gage" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={editForfeitDesc} onChange={(e) => setEditForfeitDesc(e.target.value)}
                  className="input-field resize-none" rows={3} placeholder="Description détaillée du gage..." />
              </div>
              <div>
                <label className="label">Catégorie</label>
                <select value={editForfeitCategory} onChange={(e) => setEditForfeitCategory(e.target.value)} className="input-field">
                  {FORFEIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingForfeit(null)} className="btn-secondary flex-1">Annuler</button>
              <button
                onClick={handleSaveEditForfeit}
                disabled={!editForfeitTitle.trim() || !editForfeitDesc.trim()}
                className="btn-primary flex-1"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminForfeitsTab;
