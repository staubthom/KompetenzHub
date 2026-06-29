import { test, expect } from '@playwright/test';
import { loginAs, api } from './helpers';

/**
 * Admin-Dashboard – Einladungen, Benutzerverwaltung (Sperre, Rollenänderung).
 *
 * Voraussetzung: API (localhost:3001) + Web (localhost:3000) laufen.
 */
test.describe('Admin – Einladungen', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN');
  });

  test('Einladung erstellen → erscheint in der Liste', async ({ page }) => {
    const mail = `e2e-invite-${Date.now()}@schule.ch`;
    await page.goto('/admin/einladungen');

    await page.getByLabel('E-Mail-Adresse').fill(mail);
    await page.getByLabel('Rolle').selectOption('TEACHER');
    await page.getByRole('button', { name: 'Einladen' }).click();

    await expect(page.getByText(mail)).toBeVisible();
  });

  test('Einladung zurückziehen → verschwindet aus der Liste', async ({ page }) => {
    const mail = `e2e-revoke-${Date.now()}@schule.ch`;
    await page.goto('/admin/einladungen');

    await page.getByLabel('E-Mail-Adresse').fill(mail);
    await page.getByLabel('Rolle').selectOption('TEACHER');
    await page.getByRole('button', { name: 'Einladen' }).click();
    await expect(page.getByText(mail)).toBeVisible();

    // Dialog bestätigen
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Zurückziehen' }).first().click();

    await expect(page.getByText(mail)).not.toBeVisible();
  });
});

test.describe('Admin – Benutzerverwaltung', () => {
  let adminToken: string;
  let targetUserId: string;
  let targetEmail: string;

  test.beforeEach(async ({ page, request }) => {
    const { token } = await loginAs(page, 'ADMIN');
    adminToken = token;

    // Frischen Testbenutzer (LEARNER) über die API anlegen
    targetEmail = `e2e-person-${Date.now()}@schule.ch`;
    const res = await api(request, 'POST', '/auth/dev-login', adminToken, {
      email: targetEmail,
      role: 'LEARNER',
    });
    targetUserId = (res.body as { user?: { id?: string } }).user?.id ?? '';
  });

  test('Benutzer sperren → Badge zeigt "gesperrt"', async ({ page, request }) => {
    await page.goto('/admin/personen');

    await expect(page.getByText(targetEmail)).toBeVisible();

    // Zeile des Benutzers → Sperren-Button klicken
    const row = page.getByRole('row', { name: new RegExp(targetEmail.split('@')[0]) });
    await row.getByRole('button', { name: 'Sperren' }).click();

    await expect(row.getByText('gesperrt')).toBeVisible();

    // Cleanup: wieder entsperren
    await api(request, 'PATCH', `/admin/users/${targetUserId}/status`, adminToken, {
      active: true,
    });
  });

  test('Gesperrten Benutzer entsperren → Badge zeigt "aktiv"', async ({ page, request }) => {
    // Zuerst sperren
    await api(request, 'PATCH', `/admin/users/${targetUserId}/status`, adminToken, {
      active: false,
    });

    await page.goto('/admin/personen');
    await expect(page.getByText(targetEmail)).toBeVisible();

    const row = page.getByRole('row', { name: new RegExp(targetEmail.split('@')[0]) });
    await expect(row.getByText('gesperrt')).toBeVisible();
    await row.getByRole('button', { name: 'Entsperren' }).click();

    await expect(row.getByText('aktiv')).toBeVisible();
  });

  test('Rolle von LERNENDE → LEHRPERSON ändern', async ({ page, request }) => {
    await page.goto('/admin/personen');
    await expect(page.getByText(targetEmail)).toBeVisible();

    const row = page.getByRole('row', { name: new RegExp(targetEmail.split('@')[0]) });
    const roleSelect = row.getByLabel(new RegExp(`Rolle – `));
    await roleSelect.selectOption('TEACHER');

    // Toast "Rolle geändert." oder sichtbare Änderung abwarten
    await expect(page.getByText('Rolle geändert.')).toBeVisible();

    // Cleanup: zurück zu LEARNER
    await api(request, 'PATCH', `/admin/users/${targetUserId}/role`, adminToken, {
      role: 'LEARNER',
    });
  });

  test('Admin kann sich nicht selbst sperren', async ({ page }) => {
    await page.goto('/admin/personen');

    // Eigener Account liegt im "Schuladmins"-Tab (Standard ist Lernende)
    await page.getByRole('tab', { name: /Schuladmin/ }).click();

    // Zeile mit "Du"-Badge finden
    const selfRow = page.getByRole('row').filter({
      has: page.locator('.badge', { hasText: 'Du' }),
    });
    const disableBtn = selfRow.getByRole('button', { name: 'Sperren' });
    await expect(disableBtn).toBeDisabled();
  });
});
