import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import type { User, LoginRequest, RegisterRequest, AuthResponse, DecodedToken } from '@/types';
import { login as apiLogin, register as apiRegister } from '@/api/auth';
import { getCurrentUser } from '@/api/users';
import { LocalStorageService, StorageKey } from '@/utils/localStorage';
import { logger } from '@/utils/logger';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<string>;
  setSession: (response: AuthResponse) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    LocalStorageService.remove(StorageKey.Token);
    LocalStorageService.remove(StorageKey.User);
    setToken(null);
    setUser(null);
  }, []);

  const isTokenExpired = (token: string): boolean => {
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  };

  useEffect(() => {
    const storedToken = LocalStorageService.getString(StorageKey.Token);
    const storedUser = LocalStorageService.getJSON<User | null>(StorageKey.User, null);

    if (storedToken && storedUser) {
      if (isTokenExpired(storedToken)) {
        logout();
      } else {
        setToken(storedToken);
        setUser(storedUser);
        // The cached profile can be stale (e.g. a new field's default value
        // added server-side while the user stayed logged in across a deploy) —
        // refresh it from the server in the background.
        getCurrentUser()
          .then((fresh) => {
            LocalStorageService.setJSON(StorageKey.User, fresh);
            setUser(fresh);
          })
          .catch((err) => logger.error('Failed to refresh user profile', err));
      }
    }
    setIsLoading(false);
  }, [logout]);

  const login = async (data: LoginRequest) => {
    const response = await apiLogin(data);
    setSession(response);
  };

  // Returns the email to allow the caller to redirect to the verify page
  const register = async (data: RegisterRequest): Promise<string> => {
    const response = await apiRegister(data);
    return response.email;
  };

  const setSession = (response: AuthResponse) => {
    LocalStorageService.setString(StorageKey.Token, response.token);
    LocalStorageService.setJSON(StorageKey.User, response.user);
    setToken(response.token);
    setUser(response.user);
  };

  const updateUser = (updated: User) => {
    LocalStorageService.setJSON(StorageKey.User, updated);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        setSession,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
