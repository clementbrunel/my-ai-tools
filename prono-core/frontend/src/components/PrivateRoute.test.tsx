import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import PrivateRoute from './PrivateRoute';
import * as AuthContextModule from '@/context/AuthContext';
import { makeMockAuth } from '@/test-utils/auth-mock';
import { renderWithRouter } from '@/test-utils/render-helpers';

function renderRoute(authState: { isAuthenticated: boolean; isLoading: boolean }) {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(makeMockAuth(authState));

  return renderWithRouter(
    <PrivateRoute>
      <div>Contenu protégé</div>
    </PrivateRoute>,
    { route: '/private' }
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
