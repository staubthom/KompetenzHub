import { test, expect } from '@playwright/test';
import { loginAs, api, cleanupTestUsers } from './helpers';

/**
 * Kompetenzmatrix-Editor – Modul/HZ/Band/Deskriptor CRUD.
 *
 * Voraussetzung: API (localhost:3001) + Web (localhost:3000) laufen.
 * Hinweis: Drag & Drop (Reihenfolge von Bändern) ist nicht abgedeckt.
 */
test.describe('Matrix-Editor', () => {
  const stamp = Date.now();
  const modNumber = `E2E${stamp}`;
  const modTitle = `E2E Matrix Test ${stamp}`;
  let moduleId: string;

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'TEACHER');
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test('Neues Modul erstellen → erscheint in der Liste', async ({ page }) => {
    await page.goto('/modules');

    await page.getByRole('button', { name: '+ Neues Modul' }).click();
    await page.getByPlaceholder('z. B. 293').fill(modNumber);
    await page.getByPlaceholder('z. B. ICT-Geräte in Betrieb nehmen').fill(modTitle);
    await page.getByRole('button', { name: 'Erstellen' }).click();

    // Toast verschwindet – nur den Tabelleneintrag prüfen, nicht den Toast
    await expect(page.locator('table').getByText(modNumber)).toBeVisible();
    await expect(page.locator('table').getByText(modTitle)).toBeVisible();
  });

  test('Handlungsziel hinzufügen', async ({ page, request }) => {
    // Modul per API erstellen für isolierten Test
    const { token } = await loginAs(page, 'TEACHER');
    const mod = await api(request, 'POST', '/modules', token, {
      number: `HZ${stamp}`,
      title: { de: `HZ-Test ${stamp}` },
    });
    moduleId = (mod.body as { id: string }).id;

    await page.goto(`/modules/${moduleId}`);
    await page.getByRole('button', { name: '+ HZ hinzufügen' }).click();

    await page.getByPlaceholder('Code (z. B. 1)').fill('1');
    await page.getByPlaceholder('Beschreibung (DE)').fill('Netzwerke dokumentieren');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();

    await expect(page.getByText('Netzwerke dokumentieren')).toBeVisible();

    // Cleanup
    await api(request, 'DELETE', `/modules/${moduleId}`, token);
  });

  test('Kompetenzband hinzufügen', async ({ page, request }) => {
    const { token } = await loginAs(page, 'TEACHER');

    // Modul + HZ per API anlegen
    const mod = await api(request, 'POST', '/modules', token, {
      number: `BD${stamp}`,
      title: { de: `Band-Test ${stamp}` },
    });
    moduleId = (mod.body as { id: string }).id;

    const modDetail = await api(request, 'GET', `/modules/${moduleId}`, token);
    const matrixId = (modDetail.body as { matrix?: { id: string } }).matrix?.id ?? '';

    const hz = await api(request, 'POST', `/modules/${moduleId}/action-goals`, token, {
      code: '1',
      text: { de: 'HZ für Band' },
    });

    await page.goto(`/modules/${moduleId}`);

    // Band hinzufügen
    await page.getByRole('button', { name: '+ Band hinzufügen' }).click();
    await page.getByPlaceholder('z. B. A1').fill('A1');

    // Handlungsziel via Checkbox auswählen
    await page.getByRole('checkbox', { name: /HZ für Band/ }).check();
    await page.getByRole('button', { name: 'Band anlegen' }).click();

    await expect(page.locator('.band-code', { hasText: 'A1' })).toBeVisible();

    // Cleanup
    await api(request, 'DELETE', `/modules/${moduleId}`, token);
    void matrixId;
    void hz;
  });

  test('Deskriptor in Matrixfeld eintragen', async ({ page, request }) => {
    const { token } = await loginAs(page, 'TEACHER');

    // Modul + HZ + Band per API anlegen
    const mod = await api(request, 'POST', '/modules', token, {
      number: `DS${stamp}`,
      title: { de: `Deskriptor-Test ${stamp}` },
    });
    moduleId = (mod.body as { id: string }).id;

    const modDetail = await api(request, 'GET', `/modules/${moduleId}`, token);
    const matrixId = (modDetail.body as { matrix?: { id: string } }).matrix?.id ?? '';
    const hz = await api(request, 'POST', `/modules/${moduleId}/action-goals`, token, {
      code: '1',
      text: { de: 'HZ Deskriptor' },
    });
    const band = await api(request, 'POST', `/matrices/${matrixId}/bands`, token, {
      code: 'A1',
      actionGoalIds: [(hz.body as { id: string }).id],
    });
    void band; // Band via API anlegen reicht – Feld wird per UI-Button gesucht

    await page.goto(`/modules/${moduleId}`);

    // Matrixzelle ist ein Button – erst anklicken, dann erscheint das Textarea
    await page
      .getByRole('button', { name: /Ich kann/ })
      .first()
      .click();
    await page
      .getByPlaceholder('Ich kann …')
      .fill('Ich kann ein Netzwerk vollständig dokumentieren.');
    await page.getByRole('button', { name: /Speichern/ }).click();

    // Deskriptor sichtbar in der Matrix
    await expect(page.getByText('Ich kann ein Netzwerk vollständig dokumentieren.')).toBeVisible();

    // Nachweis im Matrixfeld erstellen
    await page.getByRole('button', { name: '+ Nachweis' }).first().click();

    const modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: '+ Neuer Nachweis' }).click();

    const nachweisTitel = `E2E-FeldNachweis-${stamp}`;
    await modal.getByLabel(/Titel/).fill(nachweisTitel);
    await modal.getByRole('button', { name: 'Nachweis anlegen' }).click();

    // Toast erscheint und Nachweis ist in der Modalliste sichtbar
    await expect(page.getByText('Nachweis gespeichert.')).toBeVisible();
    await expect(modal.getByText(nachweisTitel)).toBeVisible();

    // Modal schliessen
    await page.keyboard.press('Escape');

    // Nachweis-Chip erscheint im Matrixfeld
    await expect(page.locator('.evidence-chip', { hasText: nachweisTitel })).toBeVisible();

    // Cleanup
    await api(request, 'DELETE', `/modules/${moduleId}`, token);
  });

  test('Modul löschen → verschwindet aus der Liste', async ({ page, request }) => {
    const { token } = await loginAs(page, 'TEACHER');
    const delNum = `DEL${stamp}`;

    // Modul per API anlegen
    const mod = await api(request, 'POST', '/modules', token, {
      number: delNum,
      title: { de: `Löschen-Test ${stamp}` },
    });
    const delId = (mod.body as { id: string }).id;

    await page.goto('/modules');
    await expect(page.getByText(delNum)).toBeVisible();

    // Modul-Detailseite → Bearbeiten-Formular öffnen → Löschen-Button liegt darin
    await page.goto(`/modules/${delId}`);
    await page.getByRole('button', { name: 'Modul bearbeiten' }).click();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: /Modul löschen/ }).click();

    await expect(page).toHaveURL('/modules');
    await expect(page.getByText(delNum)).not.toBeVisible();
  });
});
