import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './Toast';

function ToastTrigger({ message, type }: { message: string; type?: 'success' | 'error' | 'info' }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(message, type)}>Afficher</button>;
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

// Tests without fake timers (interaction tests)
describe('ToastProvider — rendering', () => {
  it('renders children', () => {
    renderWithProvider(<p>Contenu</p>);
    expect(screen.getByText('Contenu')).toBeDefined();
  });

  it('shows a toast after showToast is called', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="Opération réussie" type="success" />);
    await user.click(screen.getByText('Afficher'));
    expect(screen.getByText('Opération réussie')).toBeDefined();
  });

  it('shows success icon for success type', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="OK" type="success" />);
    await user.click(screen.getByText('Afficher'));
    expect(screen.getByText('✓')).toBeDefined();
  });

  it('shows error icon for error type', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="Erreur" type="error" />);
    await user.click(screen.getByText('Afficher'));
    expect(screen.getAllByText('✕').length).toBeGreaterThan(0);
  });

  it('shows info icon for info type', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="Info" type="info" />);
    await user.click(screen.getByText('Afficher'));
    expect(screen.getByText('ℹ')).toBeDefined();
  });

  it('defaults to error type when no type is given', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="Défaut" />);
    await user.click(screen.getByText('Afficher'));
    const icons = screen.getAllByText('✕');
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it('dismisses toast manually when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ToastTrigger message="Manuel" type="success" />);
    await user.click(screen.getByText('Afficher'));
    expect(screen.getByText('Manuel')).toBeDefined();

    await user.click(screen.getByLabelText('Fermer'));
    expect(screen.queryByText('Manuel')).toBeNull();
  });

  it('can show multiple toasts simultaneously', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <>
        <ToastTrigger message="Premier" type="success" />
        <ToastTrigger message="Deuxième" type="error" />
      </>,
    );
    const buttons = screen.getAllByText('Afficher');
    await user.click(buttons[0]);
    await user.click(buttons[1]);

    expect(screen.getByText('Premier')).toBeDefined();
    expect(screen.getByText('Deuxième')).toBeDefined();
  });
});

// Tests with fake timers (auto-dismiss)
describe('ToastProvider — auto-dismiss', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('dismisses toast after 4 seconds', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderWithProvider(<ToastTrigger message="Temporaire" type="info" />);
    await user.click(screen.getByText('Afficher'));
    expect(screen.getByText('Temporaire')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Temporaire')).toBeNull();
  });

  it('does not dismiss before 4 seconds', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderWithProvider(<ToastTrigger message="Persistant" type="info" />);
    await user.click(screen.getByText('Afficher'));

    act(() => {
      vi.advanceTimersByTime(3999);
    });

    expect(screen.getByText('Persistant')).toBeDefined();
  });
});
