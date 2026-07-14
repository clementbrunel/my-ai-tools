import type { BrowserContext } from '@playwright/test';

// Forge a minimal JWT with a valid exp (no signature — the app only decodes, never verifies)
function makeJwt(payloadOverrides: Record<string, unknown> = {}): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'test-user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payloadOverrides,
    }),
  );
  return `${header}.${payload}.fake-signature`;
}

export const TEST_USER = {
  id: 1,
  username: 'testuser',
  displayName: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  role: 'USER' as const,
  globalScore: 42,
  betsWon: 10,
  forfeitsReceived: 2,
  emailReminderEnabled: false,
  emailGageEnabled: false,
  emailNewsletterEnabled: true,
};

export async function injectAuth(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ({ token, user }: { token: string; user: typeof TEST_USER }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token: makeJwt(), user: TEST_USER },
  );
}
