import { test, expect } from '@playwright/test';
import { loginAs, clearSession, cleanupTestUsers } from './helpers';

/**
 * Sprache und Layout – Persistenz über Sitzungen hinweg.
 *
 * Voraussetzung: API (localhost:3001) + Web (localhost:3000) laufen.
 * Sprache wird serverseitig gespeichert (updatePreferences), Theme in localStorage.
 */
test.describe('Sprache und Layout', () => {
  const stamp = Date.now();

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  // --- Sprache ---

  test('Sprache auf Französisch umstellen → nach Neuanmeldung noch aktiv', async ({ page }) => {
    const email = `e2e-locale-${stamp}@demo.ch`;
    await loginAs(page, 'TEACHER', email);
    await page.goto('/lehrer');

    // Sprach-Dropdown auf Französisch stellen
    const langSelect = page.getByRole('banner').getByLabel('Sprache');
    await expect(langSelect).toBeVisible();
    await langSelect.selectOption('fr');

    // UI wechselt sofort auf Französisch – Dropdown-Label ändert sich
    await expect(page.getByRole('banner').getByLabel('Langue')).toBeVisible();
    // Nav-Link "Tableau de bord" ist sichtbar (war vorher "Dashboard")
    await expect(page.getByRole('link', { name: 'Tableau de bord' })).toBeVisible();

    // Session beenden (Token entfernen)
    await clearSession(page);

    // Neu anmelden mit derselben E-Mail → Servereinstellung greift
    await loginAs(page, 'TEACHER', email);
    await page.goto('/lehrer');

    // Sprache ist noch Französisch
    await expect(page.getByRole('banner').getByLabel('Langue')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tableau de bord' })).toBeVisible();
  });

  test('Sprache zurück auf Deutsch → nach Neuanmeldung noch aktiv', async ({ page }) => {
    const email = `e2e-locale-de-${stamp}@demo.ch`;
    await loginAs(page, 'TEACHER', email);
    await page.goto('/lehrer');

    // Auf Englisch wechseln, dann zurück auf Deutsch
    await page.getByRole('banner').getByLabel('Sprache').selectOption('en');
    await expect(page.getByRole('banner').getByLabel('Language')).toBeVisible();

    await page.getByRole('banner').getByLabel('Language').selectOption('de');
    await expect(page.getByRole('banner').getByLabel('Sprache')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    // Nach Neuanmeldung noch Deutsch
    await clearSession(page);
    await loginAs(page, 'TEACHER', email);
    await page.goto('/lehrer');

    await expect(page.getByRole('banner').getByLabel('Sprache')).toBeVisible();
  });

  // --- Theme ---

  test('Theme auf Dunkel umstellen → nach Neuanmeldung noch aktiv', async ({ page }) => {
    const email = `e2e-theme-${stamp}@demo.ch`;
    await loginAs(page, 'TEACHER', email);
    await page.goto('/lehrer');

    // Theme-Gruppe finden und "Dunkel" aktivieren
    const themeGroup = page.getByRole('group', { name: 'Anzeigemodus' });
    await themeGroup.getByRole('button', { name: 'Dunkel' }).click();

    // Button ist als aktiv markiert und HTML-Attribut gesetzt
    await expect(themeGroup.getByRole('button', { name: 'Dunkel' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Session beenden
    await clearSession(page);

    // Neu anmelden – Theme bleibt über localStorage erhalten
    await loginAs(page, 'TEACHER', email);
    await page.goto('/lehrer');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(
      page.getByRole('group', { name: 'Anzeigemodus' }).getByRole('button', { name: 'Dunkel' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('Theme auf Hell zurückstellen → nach Neuanmeldung noch aktiv', async ({ page }) => {
    const email = `e2e-theme-light-${stamp}@demo.ch`;
    await loginAs(page, 'TEACHER', email);
    await page.goto('/lehrer');

    const themeGroup = page.getByRole('group', { name: 'Anzeigemodus' });

    // Erst Grau, dann zurück auf Hell
    await themeGroup.getByRole('button', { name: 'Grau' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'gray');

    await themeGroup.getByRole('button', { name: 'Hell' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Nach Neuanmeldung noch Hell
    await clearSession(page);
    await loginAs(page, 'TEACHER', email);
    await page.goto('/lehrer');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(
      page.getByRole('group', { name: 'Anzeigemodus' }).getByRole('button', { name: 'Hell' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
