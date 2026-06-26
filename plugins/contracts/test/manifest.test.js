'use strict';
// Unit-Tests des Manifest-Validators (node:test, keine zusätzlichen Test-Deps).
// Laufen gegen das kompilierte dist/ (pretest baut zuerst).

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateManifest } = require('../dist/index.js');

/** Minimal gültiges Manifest als Ausgangsbasis; Tests klonen und mutieren es. */
function base() {
  return {
    schemaVersion: 1,
    pluginId: 'attendance',
    displayName: 'Anwesenheit',
    version: '0.1.0',
    publisher: { name: 'KompetenzHub Core' },
    license: 'AGPL-3.0-or-later',
    description: { de: 'Anwesenheit erfassen.' },
    core: { minVersion: '0.1.0', apiVersion: 1 },
    capabilities: ['plugin:attendance:manage', 'plugin:attendance:view'],
    contributions: {
      apiRoutes: [
        {
          method: 'GET',
          path: '/sessions',
          capability: 'plugin:attendance:view',
          roles: ['TEACHER'],
        },
      ],
      nav: [
        {
          id: 'attendance',
          labelKey: 'plugin.attendance.nav',
          icon: '🗓',
          href: '/plugins/attendance',
          roles: ['TEACHER'],
        },
      ],
      widgets: [{ slot: 'teacher.dashboard', component: 'TodayWidget', roles: ['TEACHER'] }],
    },
    data: { mode: 'kv', collections: ['sessions', 'marks'] },
    translations: { namespaces: ['plugin.attendance'] },
    cleanup: { data: 'delete', storage: 'delete', secrets: 'delete' },
  };
}

test('gültiges Manifest besteht', () => {
  const res = validateManifest(base());
  assert.equal(res.ok, true, res.errors.join('; '));
  assert.equal(res.manifest.pluginId, 'attendance');
});

test('lehnt ungültige pluginId ab', () => {
  const m = base();
  m.pluginId = 'AB'; // Grossbuchstaben + zu kurz
  const res = validateManifest(m);
  assert.equal(res.ok, false);
});

test('lehnt nicht deklariertes Capability in apiRoute ab', () => {
  const m = base();
  m.contributions.apiRoutes[0].capability = 'plugin:attendance:secret';
  const res = validateManifest(m);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('nicht deklariertes Capability')));
});

test('lehnt Capability mit fremdem Plugin-Präfix ab', () => {
  const m = base();
  m.capabilities = ['plugin:other:manage', 'plugin:attendance:view'];
  m.contributions.apiRoutes[0].capability = 'plugin:attendance:view';
  const res = validateManifest(m);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('muss mit "plugin:attendance:" beginnen')));
});

test('lehnt nav href ausserhalb des Plugin-Namespace ab', () => {
  const m = base();
  m.contributions.nav[0].href = '/lehrer/bewerten';
  const res = validateManifest(m);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('muss unter "/plugins/attendance" liegen')));
});

test('lehnt unbekannten Widget-Slot ab', () => {
  const m = base();
  m.contributions.widgets[0].slot = 'core.secret.slot';
  const res = validateManifest(m);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('kein bekannter Kern-Slot')));
});

test('lehnt translations-Namespace ausserhalb plugin.<id> ab', () => {
  const m = base();
  m.translations.namespaces = ['core.common'];
  const res = validateManifest(m);
  assert.equal(res.ok, false);
});

test('lehnt fehlenden cleanup-Block ab', () => {
  const m = base();
  delete m.cleanup;
  const res = validateManifest(m);
  assert.equal(res.ok, false);
});

test('lehnt storage-Prefix ausserhalb plugins/<id>/ ab', () => {
  const m = base();
  m.storage = { prefixes: ['plugins/other/x/'] };
  const res = validateManifest(m);
  assert.equal(res.ok, false);
});
