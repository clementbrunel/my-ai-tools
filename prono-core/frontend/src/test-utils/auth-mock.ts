import { vi } from 'vitest';
import type { User } from '../types';

interface MockAuthOverrides {
  user?: User | null;
  token?: string | null;
  isLoading?: boolean;
  isAuthenticated?: boolean;
}

export const makeMockAuth = (overrides: MockAuthOverrides = {}) => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  login: vi.fn(),
  register: vi.fn(),
  setSession: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
  ...overrides,
});
