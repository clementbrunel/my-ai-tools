import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for the theme system.
 *
 * Workflow:
 *   1. First run (generate baseline):  npx playwright test --update-snapshots
 *   2. After any theme change:         npx playwright test
 *      → test fails if pixels changed (unintended visual regression)
 *
 * The football theme must produce pixel-identical output to the original
 * hardcoded green palette — these tests enforce that guarantee.
 */

test.describe('Football theme — visual regression', () => {
  test.beforeEach(async ({ page }) => {
    // Force light mode so screenshots are deterministic
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('login page matches baseline', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login-football.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('register page matches baseline', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('register-football.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('CSS variables are set on <html> for football theme', async ({ page }) => {
    await page.goto('/login');
    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--theme-primary').trim()
    );
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim()
    );
    expect(primary).toBe('#009900');
    expect(accent).toBe('#FFD700');
  });

  test('dark mode — login page matches baseline', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login-football-dark.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
