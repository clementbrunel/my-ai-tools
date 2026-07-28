import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InviteCodeEditor from './InviteCodeEditor';
import { makeGroup } from '@/test-utils/factories';
import { updateGroupInviteCode } from '@/api/groups';

vi.mock('@/api/groups', () => ({
  updateGroupInviteCode: vi.fn(),
}));

Object.assign(navigator, { clipboard: { writeText: vi.fn() } });

describe('InviteCodeEditor — affichage', () => {
  it("affiche le code d'invitation", () => {
    render(<InviteCodeEditor group={makeGroup({ inviteCode: 'ABCD1234' })} isGroupAdmin={false} onUpdate={vi.fn()} />);
    expect(screen.getByText('ABCD1234')).toBeInTheDocument();
  });

  it("n'affiche pas le bouton Modifier pour un non-admin", () => {
    render(<InviteCodeEditor group={makeGroup()} isGroupAdmin={false} onUpdate={vi.fn()} />);
    expect(screen.queryByText('Modifier')).not.toBeInTheDocument();
  });

  it('affiche le bouton Modifier pour un admin', () => {
    render(<InviteCodeEditor group={makeGroup()} isGroupAdmin={true} onUpdate={vi.fn()} />);
    expect(screen.getByText('Modifier')).toBeInTheDocument();
  });
});

describe('InviteCodeEditor — copier', () => {
  it('copie le code et affiche la confirmation', async () => {
    render(<InviteCodeEditor group={makeGroup({ inviteCode: 'ABCD1234' })} isGroupAdmin={false} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByText('Copier'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABCD1234');
    expect(await screen.findByText('✓ Copié !')).toBeInTheDocument();
  });
});

describe('InviteCodeEditor — édition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('met en majuscules la saisie du code', async () => {
    render(<InviteCodeEditor group={makeGroup()} isGroupAdmin={true} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByText('Modifier'));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'newcode');

    expect(input).toHaveValue('NEWCODE');
  });

  it('sauvegarde et appelle onUpdate en cas de succès', async () => {
    const updated = makeGroup({ inviteCode: 'NEWCODE1' });
    vi.mocked(updateGroupInviteCode).mockResolvedValue(updated);
    const onUpdate = vi.fn();

    render(<InviteCodeEditor group={makeGroup()} isGroupAdmin={true} onUpdate={onUpdate} />);
    await userEvent.click(screen.getByText('Modifier'));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'newcode1');
    await userEvent.click(screen.getByText('Enregistrer'));

    expect(updateGroupInviteCode).toHaveBeenCalledWith(1, 'NEWCODE1');
    expect(onUpdate).toHaveBeenCalledWith(updated);
  });

  it("affiche un message d'erreur si le code est invalide", async () => {
    vi.mocked(updateGroupInviteCode).mockRejectedValue(new Error('fail'));
    render(<InviteCodeEditor group={makeGroup()} isGroupAdmin={true} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByText('Modifier'));
    await userEvent.click(screen.getByText('Enregistrer'));

    expect(await screen.findByText(/n'est pas disponible ou invalide/)).toBeInTheDocument();
  });

  it('régénère le code sans argument et met à jour le champ', async () => {
    const regenerated = makeGroup({ inviteCode: 'FRESHCODE' });
    vi.mocked(updateGroupInviteCode).mockResolvedValue(regenerated);
    const onUpdate = vi.fn();

    render(<InviteCodeEditor group={makeGroup()} isGroupAdmin={true} onUpdate={onUpdate} />);
    await userEvent.click(screen.getByText('Modifier'));
    await userEvent.click(screen.getByText('🔄 Régénérer'));

    expect(updateGroupInviteCode).toHaveBeenCalledWith(1);
    expect(await screen.findByRole('textbox')).toHaveValue('FRESHCODE');
    expect(onUpdate).toHaveBeenCalledWith(regenerated);
  });
});
