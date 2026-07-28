import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupNameEditor from './GroupNameEditor';
import { makeGroup } from '@/test-utils/factories';
import { updateGroupInfo } from '@/api/groups';

vi.mock('@/api/groups', () => ({
  updateGroupInfo: vi.fn(),
}));

describe('GroupNameEditor — affichage', () => {
  it('affiche le nom et la description du groupe', () => {
    render(<GroupNameEditor group={makeGroup({ name: 'Les Potes', description: 'Groupe de la victoire' })} isGroupAdmin={false} onUpdate={vi.fn()} />);
    expect(screen.getByText('Les Potes')).toBeInTheDocument();
    expect(screen.getByText('Groupe de la victoire')).toBeInTheDocument();
  });

  it('affiche le badge "Privé" si le groupe est privé', () => {
    render(<GroupNameEditor group={makeGroup({ isPrivate: true })} isGroupAdmin={false} onUpdate={vi.fn()} />);
    expect(screen.getByText(/Privé/)).toBeInTheDocument();
  });

  it("n'affiche pas le bouton d'édition pour un non-admin", () => {
    render(<GroupNameEditor group={makeGroup()} isGroupAdmin={false} onUpdate={vi.fn()} />);
    expect(screen.queryByLabelText('Modifier le nom et la description')).not.toBeInTheDocument();
  });

  it("affiche le bouton d'édition pour un admin", () => {
    render(<GroupNameEditor group={makeGroup()} isGroupAdmin={true} onUpdate={vi.fn()} />);
    expect(screen.getByLabelText('Modifier le nom et la description')).toBeInTheDocument();
  });
});

describe('GroupNameEditor — édition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ouvre le formulaire au clic sur ✏️', async () => {
    render(<GroupNameEditor group={makeGroup({ name: 'Les Potes' })} isGroupAdmin={true} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByLabelText('Modifier le nom et la description'));
    expect(screen.getByPlaceholderText('Nom du groupe')).toHaveValue('Les Potes');
  });

  it('refuse un nom trop court sans appeler l’API', async () => {
    render(<GroupNameEditor group={makeGroup()} isGroupAdmin={true} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByLabelText('Modifier le nom et la description'));
    const input = screen.getByPlaceholderText('Nom du groupe');
    await userEvent.clear(input);
    await userEvent.type(input, 'A');
    await userEvent.click(screen.getByText('Enregistrer'));

    expect(screen.getByText(/au moins 2 caractères/)).toBeInTheDocument();
    expect(updateGroupInfo).not.toHaveBeenCalled();
  });

  it('sauvegarde et appelle onUpdate en cas de succès', async () => {
    const updated = makeGroup({ name: 'Nouveau nom' });
    vi.mocked(updateGroupInfo).mockResolvedValue(updated);
    const onUpdate = vi.fn();

    render(<GroupNameEditor group={makeGroup({ name: 'Les Potes' })} isGroupAdmin={true} onUpdate={onUpdate} />);
    await userEvent.click(screen.getByLabelText('Modifier le nom et la description'));
    const input = screen.getByPlaceholderText('Nom du groupe');
    await userEvent.clear(input);
    await userEvent.type(input, 'Nouveau nom');
    await userEvent.click(screen.getByText('Enregistrer'));

    expect(updateGroupInfo).toHaveBeenCalledWith(1, { name: 'Nouveau nom', description: undefined });
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updated));
    // Save succeeded → back to display mode (parent owns re-rendering with the updated group)
    expect(screen.queryByPlaceholderText('Nom du groupe')).not.toBeInTheDocument();
  });

  it("affiche un message d'erreur si l'API échoue", async () => {
    vi.mocked(updateGroupInfo).mockRejectedValue(new Error('fail'));
    render(<GroupNameEditor group={makeGroup()} isGroupAdmin={true} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByLabelText('Modifier le nom et la description'));
    await userEvent.click(screen.getByText('Enregistrer'));

    expect(await screen.findByText(/Erreur lors de la mise à jour/)).toBeInTheDocument();
  });

  it('annule l’édition sans appeler l’API', async () => {
    render(<GroupNameEditor group={makeGroup({ name: 'Les Potes' })} isGroupAdmin={true} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByLabelText('Modifier le nom et la description'));
    await userEvent.click(screen.getByText('Annuler'));

    expect(screen.getByText('Les Potes')).toBeInTheDocument();
    expect(updateGroupInfo).not.toHaveBeenCalled();
  });
});
