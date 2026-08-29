import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationPrefsPanel from './NotificationPrefsPanel';
import { makeGroup } from '@/test-utils/factories';
import { updateMyGroupNotificationPrefs } from '@/api/groups';

vi.mock('@/api/groups', () => ({
  updateMyGroupNotificationPrefs: vi.fn(),
}));

describe('NotificationPrefsPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it("n'affiche rien quand l'utilisateur n'est pas membre actif", () => {
    const group = makeGroup({ currentUserNotificationPrefs: null });
    const { container } = render(<NotificationPrefsPanel group={group} onUpdate={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche les deux réglages avec le choix courant en surbrillance', () => {
    const group = makeGroup({
      currentUserNotificationPrefs: {
        emailReminderEnabled: null,
        emailGageEnabled: false,
        effectiveEmailReminderEnabled: true,
        effectiveEmailGageEnabled: false,
      },
    });
    render(<NotificationPrefsPanel group={group} onUpdate={vi.fn()} />);

    expect(screen.getByText(/Rappel avant chaque pari/)).toBeInTheDocument();
    expect(screen.getByText(/Résolution des gages/)).toBeInTheDocument();
  });

  it('envoie un override explicite quand on choisit Non pour le rappel', async () => {
    const group = makeGroup({
      currentUserNotificationPrefs: {
        emailReminderEnabled: null,
        emailGageEnabled: null,
        effectiveEmailReminderEnabled: true,
        effectiveEmailGageEnabled: false,
      },
    });
    const onUpdate = vi.fn();
    vi.mocked(updateMyGroupNotificationPrefs).mockResolvedValue(group);

    render(<NotificationPrefsPanel group={group} onUpdate={onUpdate} />);

    const reminderRow = screen.getByText(/Rappel avant chaque pari/).closest('div')!.parentElement!;
    await userEvent.click(within(reminderRow).getByText('Non'));

    expect(updateMyGroupNotificationPrefs).toHaveBeenCalledWith(group.id, {
      emailReminderEnabled: false,
      emailGageEnabled: null,
    });
    expect(onUpdate).toHaveBeenCalledWith(group);
  });

  it('revient à "Auto" (null) quand on reclique sur le choix déjà actif', async () => {
    const group = makeGroup({
      currentUserNotificationPrefs: {
        emailReminderEnabled: true,
        emailGageEnabled: null,
        effectiveEmailReminderEnabled: true,
        effectiveEmailGageEnabled: false,
      },
    });
    vi.mocked(updateMyGroupNotificationPrefs).mockResolvedValue(group);

    render(<NotificationPrefsPanel group={group} onUpdate={vi.fn()} />);

    const reminderRow = screen.getByText(/Rappel avant chaque pari/).closest('div')!.parentElement!;
    await userEvent.click(within(reminderRow).getByText('Auto'));

    expect(updateMyGroupNotificationPrefs).toHaveBeenCalledWith(group.id, {
      emailReminderEnabled: null,
      emailGageEnabled: null,
    });
  });
});
