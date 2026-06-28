import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination';

const renderPagination = (currentPage: number, totalPages: number, onPageChange = vi.fn()) =>
  render(<Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />);

describe('Pagination — visibilité', () => {
  it('ne rend rien si totalPages <= 1', () => {
    const { container } = renderPagination(1, 1);
    expect(container.firstChild).toBeNull();
  });

  it('rend les boutons si totalPages > 1', () => {
    renderPagination(1, 3);
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });
});

describe('Pagination — état des boutons prev/next', () => {
  it('désactive prev en page 1', () => {
    renderPagination(1, 3);
    const prev = screen.getByText('‹');
    expect((prev as HTMLButtonElement).disabled).toBe(true);
  });

  it('désactive next à la dernière page', () => {
    renderPagination(3, 3);
    const next = screen.getByText('›');
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  it('active prev et next sur une page intermédiaire', () => {
    renderPagination(2, 3);
    expect((screen.getByText('‹') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByText('›') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('Pagination — navigation', () => {
  it('appelle onPageChange avec la page précédente au clic sur prev', async () => {
    const onPageChange = vi.fn();
    renderPagination(2, 3, onPageChange);
    await userEvent.click(screen.getByText('‹'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('appelle onPageChange avec la page suivante au clic sur next', async () => {
    const onPageChange = vi.fn();
    renderPagination(2, 3, onPageChange);
    await userEvent.click(screen.getByText('›'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('appelle onPageChange avec le numéro cliqué', async () => {
    const onPageChange = vi.fn();
    renderPagination(1, 3, onPageChange);
    await userEvent.click(screen.getByText('3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});

describe('Pagination — ellipsis (> 7 pages)', () => {
  it('affiche des ellipsis pour une longue liste', () => {
    renderPagination(5, 10);
    const ellipsis = screen.getAllByText('…');
    expect(ellipsis.length).toBeGreaterThanOrEqual(1);
  });

  it('affiche toujours la première et la dernière page', () => {
    renderPagination(5, 10);
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
  });
});
