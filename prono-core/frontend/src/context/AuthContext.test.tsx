import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { makeUser, makeToken, makeAuthResponse } from '@/test-utils/factories';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

import * as authApi from '@/api/auth';

const TestConsumer: React.FC = () => {
  const { user, token, isAuthenticated } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.username ?? 'null'}</span>
      <span data-testid="token">{token ?? 'null'}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
    </div>
  );
};

const renderWithAuth = () =>
  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

describe('AuthContext — AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('login() stores user and token in state and localStorage', async () => {
    const response = makeAuthResponse();
    vi.mocked(authApi.login).mockResolvedValue(response);

    const LoginButton: React.FC = () => {
      const { login } = useAuth();
      return <button onClick={() => login({ username: 'testuser', password: 'pass' })}>Login</button>;
    };

    render(
      <AuthProvider>
        <TestConsumer />
        <LoginButton />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('testuser');
      expect(screen.getByTestId('auth').textContent).toBe('true');
    });

    expect(localStorage.getItem('token')).toBe(response.token);
    expect(JSON.parse(localStorage.getItem('user')!).username).toBe('testuser');
  });

  it('logout() clears state and localStorage', async () => {
    const response = makeAuthResponse();
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));

    const LogoutButton: React.FC = () => {
      const { logout } = useAuth();
      return <button onClick={logout}>Logout</button>;
    };

    render(
      <AuthProvider>
        <TestConsumer />
        <LogoutButton />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('testuser');
    });

    await act(async () => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('auth').textContent).toBe('false');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('setSession() persists token and user', async () => {
    const response = makeAuthResponse();

    const SetSessionButton: React.FC = () => {
      const { setSession } = useAuth();
      return <button onClick={() => setSession(response)}>SetSession</button>;
    };

    render(
      <AuthProvider>
        <TestConsumer />
        <SetSessionButton />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText('SetSession').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('testuser');
    expect(screen.getByTestId('token').textContent).toBe(response.token);
    expect(localStorage.getItem('token')).toBe(response.token);
  });

  it('updateUser() updates state and localStorage without logging out', async () => {
    const response = makeAuthResponse();
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));

    const UpdateButton: React.FC = () => {
      const { updateUser } = useAuth();
      return (
        <button onClick={() => updateUser(makeUser({ username: 'updated' }))}>Update</button>
      );
    };

    render(
      <AuthProvider>
        <TestConsumer />
        <UpdateButton />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('testuser');
    });

    await act(async () => {
      screen.getByText('Update').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('updated');
    expect(screen.getByTestId('auth').textContent).toBe('true');
    expect(JSON.parse(localStorage.getItem('user')!).username).toBe('updated');
  });

  it('expired JWT token in localStorage at mount triggers automatic logout', async () => {
    const expiredToken = makeToken(-3600);
    localStorage.setItem('token', expiredToken);
    localStorage.setItem('user', JSON.stringify(makeUser()));

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('null');
    });

    expect(localStorage.getItem('token')).toBeNull();
  });

  it('valid JWT token in localStorage at mount restores session', async () => {
    localStorage.setItem('token', makeToken(3600));
    localStorage.setItem('user', JSON.stringify(makeUser()));

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('testuser');
      expect(screen.getByTestId('auth').textContent).toBe('true');
    });
  });
});
