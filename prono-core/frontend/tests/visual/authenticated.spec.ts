import { test, expect } from '@playwright/test';
import { injectAuth } from './helpers/auth';

test.use({ colorScheme: 'light' });

test.beforeEach(async ({ page, context }) => {
  // Inject localStorage auth before any page load
  await injectAuth(context);

  // Disable animations for stable screenshots
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });

  // Mock all API calls to return empty but valid responses
  await page.route('/api/**', (route) => {
    const url = route.request().url();
    if (url.includes('/leaderboard')) {
      return route.fulfill({ json: [] });
    }
    if (url.includes('/matches')) {
      return route.fulfill({ json: [] });
    }
    if (url.includes('/dashboard')) {
      return route.fulfill({ json: { upcomingMatchCount: 0, groupRankings: [] } });
    }
    if (url.includes('/daily-gages')) {
      return route.fulfill({ json: [] });
    }
    if (url.includes('/groups')) {
      return route.fulfill({ json: [] });
    }
    if (url.includes('/user-counts')) {
      return route.fulfill({ json: { pendingInvites: 0 } });
    }
    return route.fulfill({ json: {} });
  });
});

test.describe('Dashboard', () => {
  test('light mode', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-light.png', { fullPage: true });
  });

  test('dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-dark.png', { fullPage: true });
  });
});

test.describe('Matches', () => {
  test('light mode', async ({ page }) => {
    await page.goto('/matches');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('matches-light.png', { fullPage: true });
  });
});

test.describe('Leaderboard', () => {
  test('light mode', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('leaderboard-light.png', { fullPage: true });
  });
});

test.describe('Profile', () => {
  test('light mode', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('profile-light.png', { fullPage: true });
  });
});
