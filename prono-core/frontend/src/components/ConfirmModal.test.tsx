import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmModal from './ConfirmModal';

const defaultProps = {
  isOpen: true,
  title: 'Confirmation',
  message: 'Êtes-vous sûr ?',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmModal', () => {
  it('renders title and message when open', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('Confirmation')).toBeDefined();
    expect(screen.getByText('Êtes-vous sûr ?')).toBeDefined();
  });

  it('renders nothing when isOpen is false', () => {
    render(<ConfirmModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Confirmation')).toBeNull();
  });

  it('renders default button labels', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('Confirmer')).toBeDefined();
    expect(screen.getByText('Annuler')).toBeDefined();
  });

  it('renders custom button labels', () => {
    render(<ConfirmModal {...defaultProps} confirmLabel="Supprimer" cancelLabel="Retour" />);
    expect(screen.getByText('Supprimer')).toBeDefined();
    expect(screen.getByText('Retour')).toBeDefined();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByText('Confirmer'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByText('Annuler'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking the backdrop', async () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
    const backdrop = screen.getByText('Confirmation').closest('.fixed')!;
    await userEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalled();
  });

  it('confirm button has btn-danger class in danger variant', () => {
    render(<ConfirmModal {...defaultProps} variant="danger" confirmLabel="Supprimer" />);
    const btn = screen.getByText('Supprimer');
    expect(btn.className).toContain('btn-danger');
  });

  it('confirm button has btn-primary class in default variant', () => {
    render(<ConfirmModal {...defaultProps} variant="default" confirmLabel="Confirmer" />);
    const btn = screen.getByText('Confirmer');
    expect(btn.className).toContain('btn-primary');
  });
});
