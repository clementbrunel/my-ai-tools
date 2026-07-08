import { test, expect } from '@playwright/test';

// Disable all CSS animations/transitions for stable screenshots
test.use({
  colorScheme: 'light',
});

test.beforeEach(async ({ page }) => {
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
});

test.describe('Login page', () => {
  test('light mode', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login-light.png', { fullPage: true });
  });

  test('dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login-dark.png', { fullPage: true });
  });
});

test.describe('Register page', () => {
  test('light mode', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('register-light.png', { fullPage: true });
  });

  test('dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('register-dark.png', { fullPage: true });
  });
});

test.describe('Forgot password page', () => {
  test('light mode', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('forgot-password-light.png', { fullPage: true });
  });
});
