import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import * as AuthContextModule from '../context/AuthContext';

function renderRoute(authState: { isAuthenticated: boolean; isLoading: boolean }) {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    ...authState,
    user: null,
    token: null,
    login: vi.fn(),
    register: vi.fn(),
    setSession: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={['/private']}>
      <PrivateRoute>
        <div>Contenu protégé</div>
      </PrivateRoute>
    </MemoryRouter>,
  );
}

describe('PrivateRoute', () => {
  it('renders children when authenticated', () => {
    renderRoute({ isAuthenticated: true, isLoading: false });
    expect(screen.getByText('Contenu protégé')).toBeDefined();
  });

  it('does not render children when not authenticated', () => {
    renderRoute({ isAuthenticated: false, isLoading: false });
    expect(screen.queryByText('Contenu protégé')).toBeNull();
  });

  it('shows loading spinner while loading', () => {
    renderRoute({ isAuthenticated: false, isLoading: true });
    expect(screen.getByText('Chargement...')).toBeDefined();
  });

  it('does not redirect while still loading', () => {
    renderRoute({ isAuthenticated: false, isLoading: true });
    expect(screen.queryByText('Contenu protégé')).toBeNull();
    expect(screen.getByText('Chargement...')).toBeDefined();
  });

  it('shows the soccer ball emoji during loading', () => {
    renderRoute({ isAuthenticated: false, isLoading: true });
    expect(screen.getByText('⚽')).toBeDefined();
  });
});
