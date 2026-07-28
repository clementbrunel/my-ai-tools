import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForfeitsPanel from './ForfeitsPanel';
import { makeForfeit } from '@/test-utils/factories';
import {
  getGroupPendingForfeits, getGroupForfeits,
  approveGroupForfeit, deleteGroupForfeit,
} from '@/api/forfeits';

vi.mock('@/api/forfeits', () => ({
  getGroupPendingForfeits: vi.fn(),
  getGroupForfeits: vi.fn(),
  approveGroupForfeit: vi.fn(),
  deleteGroupForfeit: vi.fn(),
}));

describe('ForfeitsPanel — fermé', () => {
  it("ne charge rien et n'affiche rien quand isOpen=false", () => {
    const { container } = render(
      <ForfeitsPanel groupId={1} isOpen={false} onPendingCountChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    expect(getGroupPendingForfeits).not.toHaveBeenCalled();
  });
});

describe('ForfeitsPanel — ouvert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge et affiche les gages en attente et actifs', async () => {
    vi.mocked(getGroupPendingForfeits).mockResolvedValue([makeForfeit({ id: 1, title: 'Karaoké' })]);
    vi.mocked(getGroupForfeits).mockResolvedValue([makeForfeit({ id: 2, title: 'Pompes' })]);

    render(<ForfeitsPanel groupId={7} isOpen={true} onPendingCountChange={vi.fn()} />);

    expect(await screen.findByText('Karaoké')).toBeInTheDocument();
    expect(screen.getByText('Pompes')).toBeInTheDocument();
    expect(getGroupPendingForfeits).toHaveBeenCalledWith(7);
    expect(getGroupForfeits).toHaveBeenCalledWith(7);
  });

  it('signale le nombre de gages en attente via onPendingCountChange', async () => {
    vi.mocked(getGroupPendingForfeits).mockResolvedValue([makeForfeit({ id: 1 }), makeForfeit({ id: 2 })]);
    vi.mocked(getGroupForfeits).mockResolvedValue([]);
    const onPendingCountChange = vi.fn();

    render(<ForfeitsPanel groupId={7} isOpen={true} onPendingCountChange={onPendingCountChange} />);

    await waitFor(() => expect(onPendingCountChange).toHaveBeenCalledWith(2));
  });

  it('approuve un gage en attente : il migre vers la liste active et le compteur descend', async () => {
    vi.mocked(getGroupPendingForfeits).mockResolvedValue([makeForfeit({ id: 1, title: 'Karaoké' })]);
    vi.mocked(getGroupForfeits).mockResolvedValue([]);
    vi.mocked(approveGroupForfeit).mockResolvedValue(makeForfeit({ id: 1, title: 'Karaoké' }));
    const onPendingCountChange = vi.fn();
    const onForfeitsChanged = vi.fn();

    render(
      <ForfeitsPanel groupId={7} isOpen={true} onPendingCountChange={onPendingCountChange} onForfeitsChanged={onForfeitsChanged} />
    );
    await screen.findByText('⏳ Gages proposés en attente (1)');

    await userEvent.click(screen.getByText('✓ Valider'));

    expect(approveGroupForfeit).toHaveBeenCalledWith(7, 1);
    await waitFor(() => expect(screen.getByText('✅ Gages actifs du groupe (1)')).toBeInTheDocument());
    expect(onPendingCountChange).toHaveBeenLastCalledWith(0);
    expect(onForfeitsChanged).toHaveBeenCalled();
  });

  it('refuse un gage en attente après confirmation', async () => {
    vi.mocked(getGroupPendingForfeits).mockResolvedValue([makeForfeit({ id: 1, title: 'Karaoké' })]);
    vi.mocked(getGroupForfeits).mockResolvedValue([]);
    vi.mocked(deleteGroupForfeit).mockResolvedValue(undefined);

    render(<ForfeitsPanel groupId={7} isOpen={true} onPendingCountChange={vi.fn()} />);
    await screen.findByText('Karaoké');

    await userEvent.click(screen.getByText('✕ Refuser'));
    await screen.findByText(/Refuser définitivement ce gage/);
    await userEvent.click(screen.getByText('Refuser'));

    expect(deleteGroupForfeit).toHaveBeenCalledWith(7, 1);
    await waitFor(() => expect(screen.queryByText('Karaoké')).not.toBeInTheDocument());
  });

  it('supprime un gage actif après confirmation', async () => {
    vi.mocked(getGroupPendingForfeits).mockResolvedValue([]);
    vi.mocked(getGroupForfeits).mockResolvedValue([makeForfeit({ id: 2, title: 'Pompes' })]);
    vi.mocked(deleteGroupForfeit).mockResolvedValue(undefined);

    render(<ForfeitsPanel groupId={7} isOpen={true} onPendingCountChange={vi.fn()} />);
    await screen.findByText('Pompes');

    await userEvent.click(screen.getByText('🗑️'));
    await screen.findByText(/Supprimer ce gage du groupe/);
    await userEvent.click(screen.getByText('Supprimer'));

    expect(deleteGroupForfeit).toHaveBeenCalledWith(7, 2);
    await waitFor(() => expect(screen.queryByText('Pompes')).not.toBeInTheDocument());
  });
});
