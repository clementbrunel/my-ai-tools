import React, { useEffect, useState } from 'react';
import {
  listNewsletters,
  createNewsletter,
  updateNewsletter,
  deleteNewsletter,
  previewNewsletter,
  sendNewsletterTest,
  broadcastNewsletter,
  type Newsletter,
  type NewsletterInput,
  type NewsletterTheme,
} from '@/api/newsletter';
import { useFormMessages } from '@/hooks/useFormMessages';
import ConfirmModal from '@/components/ConfirmModal';

const EMPTY: NewsletterInput = { title: '', subtitle: '', bodyMd: '', theme: 'FOOTBALL', ctaLabel: '', ctaUrl: '' };

const AdminNewslettersTab: React.FC = () => {
  const [items, setItems] = useState<Newsletter[]>([]);
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<NewsletterInput>(EMPTY);
  const [previewHtml, setPreviewHtml] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [confirmSend, setConfirmSend] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Newsletter | null>(null);
  const [busy, setBusy] = useState(false);
  const { msg, setSuccess, setError, clear } = useFormMessages();

  const current = typeof selectedId === 'number' ? items.find((n) => n.id === selectedId) : undefined;
  const isDraft = selectedId === 'new' || current?.status === 'DRAFT';

  const refresh = async () => {
    try {
      setItems(await listNewsletters());
    } catch {
      setError('Impossible de charger les newsletters.');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const openNew = () => {
    clear();
    setSelectedId('new');
    setForm(EMPTY);
    setPreviewHtml('');
  };

  const openExisting = (n: Newsletter) => {
    clear();
    setSelectedId(n.id);
    setForm({
      title: n.title,
      subtitle: n.subtitle ?? '',
      bodyMd: n.bodyMd,
      theme: n.theme,
      ctaLabel: n.ctaLabel ?? '',
      ctaUrl: n.ctaUrl ?? '',
    });
    setPreviewHtml('');
    loadPreview(n.id);
  };

  const loadPreview = async (id: number) => {
    try {
      setPreviewHtml(await previewNewsletter(id));
    } catch {
      /* preview is best-effort */
    }
  };

  const handleSave = async () => {
    clear();
    setBusy(true);
    try {
      const saved =
        selectedId === 'new'
          ? await createNewsletter(form)
          : await updateNewsletter(selectedId as number, form);
      setSuccess('Brouillon enregistré.');
      await refresh();
      setSelectedId(saved.id);
      await loadPreview(saved.id);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur à l'enregistrement.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (n: Newsletter) => {
    setDeleteTarget(n);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const n = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteNewsletter(n.id);
      if (selectedId === n.id) setSelectedId(null);
      await refresh();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Suppression impossible.');
    }
  };

  const handleTest = async () => {
    if (typeof selectedId !== 'number') {
      setError('Enregistre le brouillon avant de tester.');
      return;
    }
    clear();
    setBusy(true);
    try {
      await sendNewsletterTest(selectedId, testEmail);
      setSuccess(`Test envoyé à ${testEmail}.`);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Échec de l'envoi de test.");
    } finally {
      setBusy(false);
    }
  };

  const handleBroadcast = async () => {
    if (typeof selectedId !== 'number') return;
    setConfirmSend(false);
    setBusy(true);
    clear();
    try {
      const count = await broadcastNewsletter(selectedId);
      setSuccess(`Newsletter envoyée à ${count} destinataire(s) 🎉`);
      await refresh();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Échec de la diffusion.");
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (s: Newsletter['status']) =>
    s === 'SENT' ? (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Envoyée</span>
    ) : (
      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">Brouillon</span>
    );

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-900 dark:text-white">📣 Newsletters</h3>
          <button onClick={openNew} className="btn-primary text-sm">+ Nouvelle</button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Annonces ponctuelles envoyées en une fois à tous les membres inscrits (opt-in). Séparé des templates transactionnels.
        </p>

        {items.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune campagne pour le moment.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map((n) => (
              <li key={n.id} className="py-2 flex items-center justify-between gap-3">
                <button className="flex-1 text-left" onClick={() => openExisting(n)}>
                  <span className="font-medium text-gray-900 dark:text-white">{n.title}</span>{' '}
                  {statusBadge(n.status)}
                  <span className="block text-xs text-gray-400">
                    {n.status === 'SENT'
                      ? `Envoyée le ${n.sentAt?.slice(0, 10)} · ${n.sentCount} destinataire(s)`
                      : `Créée le ${n.createdAt?.slice(0, 10)}`}
                  </span>
                </button>
                {n.status === 'DRAFT' && (
                  <button onClick={() => handleDelete(n)} className="text-red-500 text-sm hover:underline">Supprimer</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedId !== null && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Éditeur */}
          <div className="card space-y-3">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200">
              {selectedId === 'new' ? 'Nouvelle newsletter' : `Édition — ${current?.title ?? ''}`}
              {current?.status === 'SENT' && (
                <span className="ml-2 text-xs text-gray-400">(envoyée, lecture seule)</span>
              )}
            </h4>

            <div>
              <label className="label">Titre (= objet de l'email)</label>
              <input className="input-field" value={form.title} disabled={!isDraft}
                onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
            </div>
            <div>
              <label className="label">Sous-titre (bandeau)</label>
              <input className="input-field" value={form.subtitle} disabled={!isDraft}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })} maxLength={200} />
            </div>
            <div>
              <label className="label">Contenu (Markdown)</label>
              <textarea className="input-field font-mono text-sm" rows={10} value={form.bodyMd} disabled={!isDraft}
                onChange={(e) => setForm({ ...form, bodyMd: e.target.value })}
                placeholder={'## Une grosse nouveauté !\n\nOn vient de sortir **X**...\n\n- point 1\n- point 2'} />
              <p className="text-xs text-gray-400 mt-1">Markdown : ## titres, **gras**, listes, [liens](url). Le style email est appliqué au rendu.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Thème</label>
                <select className="input-field" value={form.theme} disabled={!isDraft}
                  onChange={(e) => setForm({ ...form, theme: e.target.value as NewsletterTheme })}>
                  <option value="FOOTBALL">⚽ Foot</option>
                  <option value="F1">🏎️ F1</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Bouton — libellé (optionnel)</label>
                <input className="input-field" value={form.ctaLabel} disabled={!isDraft}
                  onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} maxLength={100} />
              </div>
              <div>
                <label className="label">Bouton — URL</label>
                <input className="input-field" value={form.ctaUrl} disabled={!isDraft}
                  onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} maxLength={500} />
              </div>
            </div>

            {isDraft && (
              <div className="flex gap-2">
                <button onClick={handleSave} className="btn-primary text-sm" disabled={busy}>
                  {busy ? '...' : '💾 Enregistrer le brouillon'}
                </button>
              </div>
            )}

            {typeof selectedId === 'number' && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="label">Envoyer un test à</label>
                    <input type="email" className="input-field" value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)} placeholder="moi@example.com" />
                  </div>
                  <button onClick={handleTest} className="btn-secondary text-sm" disabled={busy || !testEmail}>📤 Test</button>
                </div>

                {isDraft && (
                  <button onClick={() => setConfirmSend(true)} className="btn-primary w-full text-sm" disabled={busy}>
                    🚀 Envoyer à tous les membres
                  </button>
                )}
              </div>
            )}

            {msg?.type === 'error' && <p className="text-red-500 text-sm">{msg.text}</p>}
            {msg?.type === 'success' && <p className="text-green-600 text-sm">✅ {msg.text}</p>}
          </div>

          {/* Aperçu */}
          <div className="card">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Aperçu email</h4>
            {previewHtml ? (
              <iframe title="preview" srcDoc={previewHtml} className="w-full h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white" />
            ) : (
              <p className="text-sm text-gray-400">Enregistre le brouillon pour générer l'aperçu.</p>
            )}
          </div>
        </div>
      )}

      {/* Modale de confirmation */}
      {confirmSend && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full space-y-4">
            <h4 className="font-bold text-lg text-gray-900 dark:text-white">Confirmer la diffusion</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Cette newsletter va être envoyée <strong>à tous les membres inscrits ayant activé les annonces</strong>.
              L'opération est <strong>définitive</strong> et ne peut pas être renvoyée.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmSend(false)} className="btn-secondary text-sm">Annuler</button>
              <button onClick={handleBroadcast} className="btn-primary text-sm" disabled={busy}>Oui, envoyer</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Supprimer le brouillon"
        message={`Supprimer le brouillon « ${deleteTarget?.title ?? ''} » ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default AdminNewslettersTab;
