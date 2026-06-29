import { test, expect } from '@playwright/test';
import { loginAs, api } from './helpers';

/**
 * Evidence-Submission-Flow – Student reicht zwei Nachweise ein, Lehrperson
 * bewertet einen mit vollen Punkten und weist den anderen zurück, Student
 * sieht die Ergebnisse und reicht den zurückgewiesenen erneut ein.
 *
 * Voraussetzung: API (localhost:3001) + Web (localhost:3000) laufen.
 * Setup (Modul, Klasse, Nachweise) erfolgt per API; UI-Flow wird getestet.
 */
test.describe('Evidence-Submission-Flow', () => {
  const stamp = Date.now();
  let teacherToken: string;
  let studentToken: string;
  let moduleId: string;
  let classId: string;
  let evidenceId: string;
  let evidenceId2: string;
  let evidenceTitle: string;
  let evidenceTitle2: string;

  test.beforeAll(async ({ request, browser }) => {
    const page = await browser.newPage();

    const teacher = await loginAs(page, 'TEACHER', `e2e-ev-teacher-${stamp}@demo.ch`);
    teacherToken = teacher.token;

    const student = await loginAs(page, 'LEARNER', `e2e-ev-student-${stamp}@demo.ch`);
    studentToken = student.token;

    await page.close();

    // Modul anlegen
    const mod = await api(request, 'POST', '/modules', teacherToken, {
      number: `EV${stamp}`,
      title: { de: 'E2E Evidence Test' },
    });
    moduleId = (mod.body as { id: string }).id;

    // Handlungsziel + Band + Felder für die Nachweise
    const modDetail = await api(request, 'GET', `/modules/${moduleId}`, teacherToken);
    const matrixId = (modDetail.body as { matrix?: { id: string } }).matrix?.id ?? '';
    const hz = await api(request, 'POST', `/modules/${moduleId}/action-goals`, teacherToken, {
      code: '1',
      text: { de: 'HZ E2E' },
    });
    const band = await api(request, 'POST', `/matrices/${matrixId}/bands`, teacherToken, {
      code: 'A',
      actionGoalIds: [(hz.body as { id: string }).id],
    });
    const fieldId = ((band.body as { fields?: { id: string }[] }).fields ?? [])[0]?.id ?? '';

    // Klasse anlegen + Student beitreten lassen
    const cls = await api(request, 'POST', '/classes', teacherToken, {
      name: `E2E-Klasse-${stamp}`,
      moduleId,
    });
    classId = (cls.body as { id: string }).id;
    const codeRes = await api(request, 'POST', `/classes/${classId}/join-code`, teacherToken, {});
    const joinCode = (codeRes.body as { code: string }).code;
    await api(request, 'POST', '/classes/join', studentToken, { code: joinCode });

    // Erster Nachweis
    evidenceTitle = `E2E-Nachweis-A-${stamp}`;
    const ev1 = await api(request, 'POST', '/evidence', teacherToken, {
      moduleId,
      title: { de: evidenceTitle },
      instructions: { de: '<p>Nachweis A – bitte dokumentieren.</p>' },
      isVisible: true,
      maxPoints: 10,
      fieldIds: [fieldId],
    });
    evidenceId = (ev1.body as { id: string }).id;

    // Zweiter Nachweis
    evidenceTitle2 = `E2E-Nachweis-B-${stamp}`;
    const ev2 = await api(request, 'POST', '/evidence', teacherToken, {
      moduleId,
      title: { de: evidenceTitle2 },
      instructions: { de: '<p>Nachweis B – bitte dokumentieren.</p>' },
      isVisible: true,
      maxPoints: 10,
      fieldIds: [fieldId],
    });
    evidenceId2 = (ev2.body as { id: string }).id;
  });

  test.afterAll(async ({ request }) => {
    await api(request, 'DELETE', `/evidence/${evidenceId}`, teacherToken).catch(() => {});
    await api(request, 'DELETE', `/evidence/${evidenceId2}`, teacherToken).catch(() => {});
    await api(request, 'DELETE', `/classes/${classId}`, teacherToken).catch(() => {});
    await api(request, 'DELETE', `/modules/${moduleId}`, teacherToken).catch(() => {});
  });

  // --- Test 1: Student sieht beide Nachweise in der Matrix ---

  test('Student sieht beide Nachweise in der Matrix', async ({ page }) => {
    await loginAs(page, 'LEARNER', `e2e-ev-student-${stamp}@demo.ch`);
    await page.goto('/lernende');
    await expect(page.getByText(evidenceTitle)).toBeVisible();
    await expect(page.getByText(evidenceTitle2)).toBeVisible();
  });

  // --- Test 2: Student reicht beide Nachweise ein ---

  test('Student reicht beide Nachweise ein', async ({ page }) => {
    await loginAs(page, 'LEARNER', `e2e-ev-student-${stamp}@demo.ch`);
    await page.goto('/lernende');

    // Nachweis A einreichen
    await page.getByText(evidenceTitle).click();
    const dialogA = page.getByRole('dialog', { name: evidenceTitle });
    await expect(dialogA.getByRole('button', { name: /Einreichen/ })).toBeVisible();
    await dialogA.getByLabel(/Text/).fill('Meine Dokumentation für Nachweis A.');
    await dialogA.getByRole('button', { name: /Einreichen/ }).click();
    await expect(dialogA.getByText('eingereicht')).toBeVisible();
    await page.keyboard.press('Escape');

    // Nachweis B einreichen
    await page.getByText(evidenceTitle2).click();
    const dialogB = page.getByRole('dialog', { name: evidenceTitle2 });
    await expect(dialogB.getByRole('button', { name: /Einreichen/ })).toBeVisible();
    await dialogB.getByLabel(/Text/).fill('Meine Dokumentation für Nachweis B.');
    await dialogB.getByRole('button', { name: /Einreichen/ }).click();
    await expect(dialogB.getByText('eingereicht')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  // --- Test 3: Lehrperson sieht beide Einreichungen ---

  test('Lehrperson sieht beide eingereichten Nachweise in Bewerten', async ({ page }) => {
    await loginAs(page, 'TEACHER', `e2e-ev-teacher-${stamp}@demo.ch`);
    await page.goto('/lehrer/bewerten');
    await expect(page.getByText(evidenceTitle)).toBeVisible();
    await expect(page.getByText(evidenceTitle2)).toBeVisible();
  });

  // --- Test 4: Lehrperson bewertet A mit vollen Punkten, weist B zurück ---

  test('Lehrperson bewertet Nachweis A mit vollen Punkten, weist B zurück', async ({ page }) => {
    await loginAs(page, 'TEACHER', `e2e-ev-teacher-${stamp}@demo.ch`);
    await page.goto('/lehrer/bewerten');

    // Nachweis A: volle Punktzahl vergeben
    const rowA = page.getByRole('row').filter({ has: page.getByText(evidenceTitle) });
    await rowA.getByRole('button', { name: 'Öffnen' }).click();
    await page.getByLabel(/Erreichte Punkte/).fill('10');
    await page.getByPlaceholder(/Rückmeldung/).fill('Vollständig und korrekt – volle Punkte.');
    await page.getByRole('button', { name: /Bewertung speichern/ }).click();
    await expect(page.getByText('Bewertung gespeichert.')).toBeVisible();
    await expect(page.locator('.badge', { hasText: 'bewertet' })).toBeVisible();

    // Zurück zur Liste
    await page.getByRole('button', { name: /← Zurück/ }).click();

    // Nachweis B: zurückweisen
    const rowB = page.getByRole('row').filter({ has: page.getByText(evidenceTitle2) });
    await rowB.getByRole('button', { name: 'Öffnen' }).click();
    await page.getByPlaceholder(/Begründung/).fill('Bitte die Quellen ergänzen und erneut einreichen.');
    await page.getByRole('button', { name: /Zur Überarbeitung zurückweisen/ }).click();
    await expect(page.getByText('Einreichung zurückgewiesen.')).toBeVisible();
    await expect(page.locator('.badge', { hasText: 'zurückgewiesen' })).toBeVisible();
  });

  // --- Test 5: Student sieht Bewertung und reicht B erneut ein ---

  test('Student sieht Bewertung und reicht zurückgewiesenen Nachweis erneut ein', async ({
    page,
  }) => {
    await loginAs(page, 'LEARNER', `e2e-ev-student-${stamp}@demo.ch`);
    await page.goto('/lernende');

    // Nachweis A: zeigt Bewertung mit Punkten
    await page.getByText(evidenceTitle).click();
    const dialogA = page.getByRole('dialog', { name: evidenceTitle });
    await expect(dialogA.locator('strong', { hasText: 'Bewertet' })).toBeVisible();
    await expect(dialogA.getByText(/10\s*\/\s*10/)).toBeVisible();
    await page.keyboard.press('Escape');

    // Nachweis B: zeigt "zurückgewiesen" mit Begründung, Formular ist wieder aktiv
    await page.getByText(evidenceTitle2).click();
    const dialogB = page.getByRole('dialog', { name: evidenceTitle2 });
    await expect(dialogB.getByText(/Zurückgewiesen/)).toBeVisible();
    await expect(dialogB.getByText(/Quellen ergänzen/)).toBeVisible();

    // Erneut einreichen
    await dialogB.getByLabel(/Text/).fill('Überarbeitete Version mit ergänzten Quellen.');
    await dialogB.getByRole('button', { name: /Einreichen/ }).click();
    await expect(dialogB.getByText('eingereicht')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
