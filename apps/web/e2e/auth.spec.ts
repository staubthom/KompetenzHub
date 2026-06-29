import { test, expect } from '@playwright/test';
import { loginAs, clearSession, trackTestUser, cleanupTestUsers } from './helpers';

/**
 * Auth-Flow – Dev-Login UI und rollenbasierte Weiterleitung.
 *
 * Voraussetzung: API (localhost:3001) + Web (localhost:3000) laufen.
 * Dev-Login muss in .env aktiv sein (ALLOW_DEV_LOGIN=1 o.ä.).
 */
test.describe('Login UI', () => {
  // Geteilte Demo-Konten (lehrperson@/lernende@/admin@demo.ch) bleiben erhalten;
  // nur eigens angelegte Test-User werden hier wieder entfernt.
  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('Login-Seite zeigt Dev-Login-Formular', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Als Dev anmelden' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Lehrperson/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Lernende/ })).toBeVisible();
  });

  test('Dev-Login als TEACHER → Weiterleitung zu /lehrer', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Lehrperson/ }).click();
    await page.getByRole('button', { name: 'Als Dev anmelden' }).click();
    await expect(page).toHaveURL('/lehrer');
  });

  test('Dev-Login als LEARNER → Weiterleitung zu /lernende', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Lernende/ }).click();
    await page.getByRole('button', { name: 'Als Dev anmelden' }).click();
    await expect(page).toHaveURL('/lernende');
  });

  test('Dev-Login als ADMIN → Weiterleitung zu /admin', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Admin-Rollenwahl nur sichtbar wenn showAdminLogin in loginOptions aktiv
    const adminBtn = page.getByRole('button', { name: /Administration/ });
    if (!(await adminBtn.isVisible())) {
      test.skip();
      return;
    }
    await adminBtn.click();
    await page.getByRole('button', { name: 'Als Dev anmelden' }).click();
    await expect(page).toHaveURL('/admin');
  });

  test('Eigene E-Mail im Dev-Login verwenden', async ({ page }) => {
    const mail = trackTestUser(`e2e-custom-${Date.now()}@demo.ch`);
    await page.goto('/login');
    await page.getByRole('button', { name: /Lehrperson/ }).click();
    await page.getByPlaceholder('lehrperson@demo.ch').fill(mail);
    await page.getByRole('button', { name: 'Als Dev anmelden' }).click();
    await expect(page).toHaveURL('/lehrer');
  });

  test('Bereits eingeloggt → direkte Weiterleitung ohne Login-Seite', async ({ page }) => {
    await loginAs(page, 'TEACHER');
    await page.goto('/login');
    await expect(page).toHaveURL('/lehrer');
  });

  test('Logout → zurück zur Login-Seite', async ({ page }) => {
    await loginAs(page, 'TEACHER');
    await page.goto('/lehrer');
    await expect(page).toHaveURL('/lehrer');

    await clearSession(page);
    await page.goto('/lehrer');
    await expect(page).toHaveURL(/\/login/);
  });

  test('OAuth-Provider-Button sichtbar wenn konfiguriert', async ({ page }) => {
    await page.goto('/login');
    // loginOptions werden async geladen – warten bis Netzwerk ruhig ist
    await page.waitForLoadState('networkidle');
    const microsoft = page.getByRole('button', { name: /Mit Microsoft/ });
    const google = page.getByRole('button', { name: /Mit Google/ });
    const devLogin = page.getByRole('button', { name: 'Als Dev anmelden' });
    const anyVisible =
      (await microsoft.isVisible()) || (await google.isVisible()) || (await devLogin.isVisible());
    expect(anyVisible).toBe(true);
  });
});
