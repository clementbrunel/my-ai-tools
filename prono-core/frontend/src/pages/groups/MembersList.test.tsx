import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MembersList from './MembersList';
import { makeGroup, makeGroupMember } from '@/test-utils/factories';
import { approveApplication, rejectApplication, promoteMember, demoteMember, removeMember } from '@/api/groups';

vi.mock('@/api/groups', () => ({
  approveApplication: vi.fn(),
  rejectApplication: vi.fn(),
  promoteMember: vi.fn(),
  demoteMember: vi.fn(),
  removeMember: vi.fn(),
}));

describe('MembersList — liste des membres', () => {
  it('affiche tous les membres du groupe', () => {
    const group = makeGroup({
      members: [
        makeGroupMember({ id: 1, userId: 1, username: 'alice' }),
        makeGroupMember({ id: 2, userId: 2, username: 'bob' }),
      ],
    });
    render(<MembersList group={group} isGroupAdmin={false} currentUsername="alice" onUpdate={vi.fn()} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('marque le membre courant avec "(vous)"', () => {
    const group = makeGroup({ members: [makeGroupMember({ username: 'alice' })] });
    render(<MembersList group={group} isGroupAdmin={false} currentUsername="alice" onUpdate={vi.fn()} />);
    expect(screen.getByText('(vous)')).toBeInTheDocument();
  });

  it('affiche le badge Admin pour un GROUP_ADMIN', () => {
    const group = makeGroup({ members: [makeGroupMember({ username: 'alice', role: 'GROUP_ADMIN' })] });
    render(<MembersList group={group} isGroupAdmin={false} currentUsername="bob" onUpdate={vi.fn()} />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it("n'affiche pas les actions de gestion pour un non-admin", () => {
    const group = makeGroup({ members: [makeGroupMember({ username: 'bob', userId: 2 })] });
    render(<MembersList group={group} isGroupAdmin={false} currentUsername="alice" onUpdate={vi.fn()} />);
    expect(screen.queryByTitle('Exclure')).not.toBeInTheDocument();
  });

  it("n'affiche pas d'actions sur soi-même même en tant qu'admin", () => {
    const group = makeGroup({ members: [makeGroupMember({ username: 'alice', userId: 1 })] });
    render(<MembersList group={group} isGroupAdmin={true} currentUsername="alice" onUpdate={vi.fn()} />);
    expect(screen.queryByTitle('Exclure')).not.toBeInTheDocument();
  });
});

describe('MembersList — candidatures en attente', () => {
  beforeEach(() => vi.clearAllMocks());

  it("n'affiche pas la section pour un non-admin", () => {
    const group = makeGroup({ pendingApplications: [makeGroupMember({ id: 9, userId: 9, username: 'carol', status: 'PENDING' })] });
    render(<MembersList group={group} isGroupAdmin={false} currentUsername="alice" onUpdate={vi.fn()} />);
    expect(screen.queryByText(/Candidatures en attente/)).not.toBeInTheDocument();
  });

  it('affiche les candidatures pour un admin', () => {
    const group = makeGroup({ pendingApplications: [makeGroupMember({ id: 9, userId: 9, username: 'carol', status: 'PENDING' })] });
    render(<MembersList group={group} isGroupAdmin={true} currentUsername="alice" onUpdate={vi.fn()} />);
    expect(screen.getByText(/Candidatures en attente \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('carol')).toBeInTheDocument();
  });

  it('approuve une candidature et met à jour le groupe', async () => {
    vi.mocked(approveApplication).mockResolvedValue(makeGroupMember({ id: 9, userId: 9, username: 'carol', status: 'ACTIVE' }));
    const applicant = makeGroupMember({ id: 9, userId: 9, username: 'carol', status: 'PENDING' });
    const group = makeGroup({ memberCount: 1, members: [], pendingApplications: [applicant] });
    const onUpdate = vi.fn();

    render(<MembersList group={group} isGroupAdmin={true} currentUsername="alice" onUpdate={onUpdate} />);
    await userEvent.click(screen.getByText('✓ Accepter'));

    expect(approveApplication).toHaveBeenCalledWith(1, 9);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      memberCount: 2,
      pendingApplications: [],
    }));
  });

  it('refuse une candidature et met à jour le groupe', async () => {
    vi.mocked(rejectApplication).mockResolvedValue(undefined);
    const applicant = makeGroupMember({ id: 9, userId: 9, username: 'carol', status: 'PENDING' });
    const group = makeGroup({ pendingApplications: [applicant] });
    const onUpdate = vi.fn();

    render(<MembersList group={group} isGroupAdmin={true} currentUsername="alice" onUpdate={onUpdate} />);
    await userEvent.click(screen.getByText('✕ Refuser'));

    expect(rejectApplication).toHaveBeenCalledWith(1, 9);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ pendingApplications: [] }));
  });
});

describe('MembersList — promotion / rétrogradation / exclusion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('promeut un membre admin', async () => {
    vi.mocked(promoteMember).mockResolvedValue(makeGroupMember({ userId: 2, role: 'GROUP_ADMIN' }));
    const group = makeGroup({ members: [makeGroupMember({ userId: 2, username: 'bob', role: 'MEMBER' })] });
    const onUpdate = vi.fn();

    render(<MembersList group={group} isGroupAdmin={true} currentUsername="alice" onUpdate={onUpdate} />);
    await userEvent.click(screen.getByText('↑ Admin'));

    expect(promoteMember).toHaveBeenCalledWith(1, 2);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      members: [expect.objectContaining({ userId: 2, role: 'GROUP_ADMIN' })],
    }));
  });

  it('rétrograde un admin', async () => {
    vi.mocked(demoteMember).mockResolvedValue(makeGroupMember({ userId: 2, role: 'MEMBER' }));
    const group = makeGroup({ members: [makeGroupMember({ userId: 2, username: 'bob', role: 'GROUP_ADMIN' })] });
    const onUpdate = vi.fn();

    render(<MembersList group={group} isGroupAdmin={true} currentUsername="alice" onUpdate={onUpdate} />);
    await userEvent.click(screen.getByText('↓ Membre'));

    expect(demoteMember).toHaveBeenCalledWith(1, 2);
  });

  it('exclut un membre après confirmation', async () => {
    vi.mocked(removeMember).mockResolvedValue(undefined);
    const group = makeGroup({ memberCount: 2, members: [makeGroupMember({ userId: 2, username: 'bob' })] });
    const onUpdate = vi.fn();

    render(<MembersList group={group} isGroupAdmin={true} currentUsername="alice" onUpdate={onUpdate} />);
    await userEvent.click(screen.getByTitle('Exclure'));
    expect(await screen.findByText(/exclure bob du groupe/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('Exclure'));

    expect(removeMember).toHaveBeenCalledWith(1, 2);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ members: [], memberCount: 1 }));
  });

  it("n'exclut personne si la confirmation est annulée", async () => {
    const group = makeGroup({ members: [makeGroupMember({ userId: 2, username: 'bob' })] });
    render(<MembersList group={group} isGroupAdmin={true} currentUsername="alice" onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByTitle('Exclure'));
    await screen.findByText(/exclure bob du groupe/);
    await userEvent.click(screen.getByText('Annuler'));

    expect(removeMember).not.toHaveBeenCalled();
  });
});
