/**
 * Smoke-Test – Matrix-Export/-Import als ZIP (FA-100): Round-Trip inkl. Assets
 * (Lehrer-Anhang + Rich-Text-Bild), Validierung, RBAC.
 * Läuft gegen die lokale API (http://localhost:3001).
 */
import AdmZip from 'adm-zip';

const BASE = 'http://localhost:3001/api/v1';

let ok = 0;
let fail = 0;

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}
function check(label, cond, info = '') {
  if (cond) {
    console.log(`  OK   ${label}`);
    ok++;
  } else {
    console.log(`  FAIL ${label}${info ? ' – ' + info : ''}`);
    fail++;
  }
}
async function exportZip(matrixId, token) {
  const res = await fetch(`${BASE}/matrices/${matrixId}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, ctype: res.headers.get('Content-Type'), buffer: Buffer.from(await res.arrayBuffer()) };
}
async function importZip(bytes, token, filename = 'modul.zip') {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: 'application/zip' }), filename);
  const res = await fetch(`${BASE}/matrices/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

// ── Setup ─────────────────────────────────────────────────────────
const t = await req('POST', '/auth/dev-login', { email: `mio-teacher-${Date.now()}@demo.ch`, role: 'TEACHER' });
const teacher = t.body?.token;
const s = await req('POST', '/auth/dev-login', { email: `mio-student-${Date.now()}@demo.ch`, role: 'LEARNER' });
const student = s.body?.token;
check('Logins', !!teacher && !!student);

const modNum = `MIO${Date.now()}`;
const mod = await req('POST', '/modules', { number: modNum, title: { de: 'Export-Test' } }, teacher);
const moduleId = mod.body?.id;
const detail = await req('GET', `/modules/${moduleId}`, null, teacher);
const matrixId = detail.body?.matrix?.id;
const hz = await req('POST', `/modules/${moduleId}/action-goals`, { code: '1', text: { de: 'HZ 1' } }, teacher);
const bandA = await req('POST', `/matrices/${matrixId}/bands`, { code: 'A1', actionGoalIds: [hz.body.id] }, teacher);
const bandB = await req('POST', `/matrices/${matrixId}/bands`, { code: 'B1', actionGoalIds: [hz.body.id] }, teacher);
const fA = bandA.body?.fields?.[0]?.id;
const fB = bandB.body?.fields?.[0]?.id;
await req('PUT', `/fields/${fA}/descriptor`, { text: { de: 'Ich kann A.' } }, teacher);

// Lehrer-Anhang in S3 ablegen
const att = await req('POST', '/assets/attachment-upload-url', { fileName: 'vorlage.pdf', contentType: 'application/pdf' }, teacher);
await fetch(att.body.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: Buffer.from('%PDF-1.4 Testdokument') });
const attachmentKey = att.body.key;

// Rich-Text-Bild in S3 ablegen
const img = await req('POST', '/assets/image-upload-url', { fileName: 'bild.png', contentType: 'image/png', sizeBytes: 70 }, teacher);
await fetch(img.body.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: Buffer.from('89504e470d0a1a0a', 'hex') });
const imgUrl = img.body.publicUrl;

const ev = await req('POST', '/evidence', {
  moduleId,
  title: { de: 'Nachweis A' },
  instructions: { de: `<p>Mach A. <img src="${imgUrl}" alt="b" /></p>` },
  isVisible: true,
  maxPoints: 20,
  fieldIds: [fA],
  config: { allowText: true, attachmentKey, attachmentName: 'vorlage.pdf' },
}, teacher);
await req('POST', `/matrices/${matrixId}/paths`, { name: 'Pfad 1', fieldIds: [fA, fB], isActive: true }, teacher);
check('Setup vollständig', !!matrixId && !!fA && !!fB && !!ev.body?.id && !!attachmentKey && !!imgUrl);

// ── Export (ZIP) ──────────────────────────────────────────────────
const exp = await exportZip(matrixId, teacher);
check('Export → 200, Content-Type zip', exp.status === 200 && (exp.ctype ?? '').includes('zip'));
let zip;
try {
  zip = new AdmZip(exp.buffer);
} catch {
  zip = null;
}
check('Export ist gültiges ZIP', !!zip);
const manifestEntry = zip?.getEntry('matrix.json');
check('ZIP enthält matrix.json', !!manifestEntry);
const manifest = manifestEntry ? JSON.parse(manifestEntry.getData().toString('utf8')) : {};
check('Manifest schemaVersion=1', manifest.schemaVersion === 1);
check('Manifest listet 2 Assets (Bild + Anhang)', Array.isArray(manifest.assets) && manifest.assets.length === 2);
const assetFilesPresent = (manifest.assets ?? []).every((a) => !!zip.getEntry(a.path));
check('Asset-Dateien im ZIP vorhanden', assetFilesPresent);
const evExp = manifest.evidences?.[0];
check('Instruktion verweist auf zip-Pfad (assets/…) statt URL', !!evExp && evExp.instructions.de.includes('assets/') && !evExp.instructions.de.includes('http'));
check('Anhang als zip-Pfad referenziert', !!evExp?.attachment?.path && evExp.attachment.name === 'vorlage.pdf');
check('Export ohne personenbezogene Daten', JSON.stringify(manifest).includes('submission') === false);

// ── Import (Round-Trip, Original existiert noch) ──────────────────
const imp = await importZip(exp.buffer, teacher);
check('Import → 201 mit neuem Modul', imp.status === 201 && !!imp.body?.moduleId, `status=${imp.status}`);
check('Neue Modulnummer (Original existiert)', imp.body?.number === `${modNum}-2`, `number=${imp.body?.number}`);
const impDetail = await req('GET', `/modules/${imp.body.moduleId}`, null, teacher);
check('Importierter Titel enthält „(Importiert)"', (impDetail.body?.title?.de ?? '').includes('(Importiert)'));

// Importierte Nachweise prüfen: Assets neu in S3, Referenzen umgeschrieben
const impEvList = await req('GET', `/evidence?moduleId=${imp.body.moduleId}`, null, teacher);
const impEv = impEvList.body?.[0];
check('Import: Nachweis vorhanden', !!impEv);
check('Import: Bild-URL neu gesetzt (rte/, kein assets/)',
  !!impEv && impEv.instructions.de.includes('/rte/') && !impEv.instructions.de.includes('assets/') && impEv.instructions.de.includes('http'));
check('Import: neuer Anhang-Key (attachments/, != Original)',
  !!impEv?.config?.attachmentKey && impEv.config.attachmentKey.includes('attachments/') && impEv.config.attachmentKey !== attachmentKey);

// Re-Export → Struktur (ohne Asset-Pfade/URLs) identisch
const exp2 = await exportZip(impDetail.body.matrix.id, teacher);
const zip2 = new AdmZip(exp2.buffer);
const manifest2 = JSON.parse(zip2.getEntry('matrix.json').getData().toString('utf8'));
const strip = (m) =>
  JSON.stringify({
    bands: m.bands,
    actionGoals: m.actionGoals,
    learningPaths: m.learningPaths,
    evidences: (m.evidences ?? []).map((e) => ({
      title: e.title,
      maxPoints: e.maxPoints,
      fieldCodes: e.fieldCodes,
      attachmentName: e.attachment?.name ?? null,
    })),
  });
check('Round-Trip: Struktur identisch', strip(manifest) === strip(manifest2));
check('Round-Trip: erneut 2 Assets', (manifest2.assets ?? []).length === 2);

// ── Validierung ───────────────────────────────────────────────────
const notZip = await importZip(Buffer.from('das ist kein zip'), teacher);
check('Kein ZIP → 400', notZip.status === 400, `status=${notZip.status}`);
const emptyZip = new AdmZip();
emptyZip.addFile('readme.txt', Buffer.from('leer'));
const noManifest = await importZip(emptyZip.toBuffer(), teacher);
check('ZIP ohne matrix.json → 400', noManifest.status === 400);
const badVersionZip = new AdmZip();
badVersionZip.addFile('matrix.json', Buffer.from(JSON.stringify({ schemaVersion: 99, kind: 'matrix-export', module: { number: 'x', title: { de: 'x' } }, bands: [] })));
const badVersion = await importZip(badVersionZip.toBuffer(), teacher);
check('Falsche Schema-Version → 400', badVersion.status === 400);

// ── RBAC ──────────────────────────────────────────────────────────
const expForbidden = await exportZip(matrixId, student);
check('Lernende:r → Export 403', expForbidden.status === 403);
const impForbidden = await importZip(exp.buffer, student);
check('Lernende:r → Import 403', impForbidden.status === 403);

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/modules/${moduleId}`, null, teacher);
if (imp.body?.moduleId) await req('DELETE', `/modules/${imp.body.moduleId}`, null, teacher);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
