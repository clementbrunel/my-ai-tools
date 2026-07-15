/** Centralized keys used in localStorage across the app. */
export const StorageKey = {
  Token: 'token',
  User: 'user',
  Theme: 'app-theme',
  AdminMatchesWithoutBetsAck: 'admin_matches_without_bets_ack',
  Sport: 'pronocore-sport',
} as const;

export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey];

/** Wraps all localStorage access behind typed, per-key helpers. */
export class LocalStorageService {
  static getString(key: StorageKey): string | null {
    return localStorage.getItem(key);
  }

  static setString(key: StorageKey, value: string): void {
    localStorage.setItem(key, value);
  }

  static getJSON<T>(key: StorageKey, fallback: T): T {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  static setJSON<T>(key: StorageKey, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  static remove(key: StorageKey): void {
    localStorage.removeItem(key);
  }
}
