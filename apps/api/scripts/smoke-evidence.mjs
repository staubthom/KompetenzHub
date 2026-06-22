/**
 * Smoke-Test – Kompetenznachweise (Upload/Link/Text) + Matrix-Integration
 * FA-30, 36, 40. Läuft gegen die lokale API (http://localhost:3001).
 */
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
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}
function check(label, cond, info = '') {
  if (cond) { console.log(`  OK   ${label}`); ok++; }
  else { console.log(`  FAIL ${label}${info ? ' – ' + info : ''}`); fail++; }
}

// ── Setup ─────────────────────────────────────────────────────────
const t = await req('POST', '/auth/dev-login', { email: 'ev2-teacher@demo.ch', role: 'TEACHER' });
const teacher = t.body?.token;
const s = await req('POST', '/auth/dev-login', { email: 'ev2-student@demo.ch', role: 'LEARNER' });
const student = s.body?.token;
check('Logins', !!teacher && !!student);

const modNum = `EV2${Date.now()}`;
const mod = await req('POST', '/modules', { number: modNum, title: { de: 'Nachweis-Test 2' } }, teacher);
const moduleId = mod.body?.id;
const detail = await req('GET', `/modules/${moduleId}`, null, teacher);
const matrixId = detail.body?.matrix?.id;
const hz = await req('POST', `/modules/${moduleId}/action-goals`, { code: '1', text: { de: 'HZ' } }, teacher);
const band = await req('POST', `/matrices/${matrixId}/bands`, { code: 'A1', actionGoalIds: [hz.body.id] }, teacher);
const fieldId = band.body?.fields?.[0]?.id;
check('Setup Modul/Matrix/Feld', !!moduleId && !!fieldId);

const cls = await req('POST', '/classes', { name: 'EV2-Klasse', moduleId }, teacher);
const code = await req('POST', `/classes/${cls.body.id}/join-code`, {}, teacher);
await req('POST', '/classes/join', { code: code.body?.code }, student);

// ── Nachweis direkt am Kompetenzfeld anlegen (Rich-Text + Felder) ─
const richHtml =
  '<p>Erstelle ein <strong>Dockerfile</strong>. Siehe <a href="https://docs.docker.com">Docs</a>.</p>' +
  '<img src="https://example.com/bild.png" alt="Beispiel" />';
const ev = await req('POST', '/evidence', {
  moduleId,
  title: { de: 'Dockerfile-Nachweis' },
  instructions: { de: richHtml },
  isVisible: true,
  maxPoints: 10,
  fieldIds: [fieldId],
  config: { allowedFileTypes: ['pdf', 'png'], maxFileSizeMb: 5 },
}, teacher);
check('POST /evidence (Upload, Rich-Text) → 201', ev.status === 201);
const evId = ev.body?.id;
check('Typ FILE_UPLOAD', ev.body?.type === 'FILE_UPLOAD');
check('Feld zugeordnet', ev.body?.fields?.length === 1);
check('Rich-Text gespeichert', ev.body?.instructions?.de?.includes('<strong>'));
check('Einreichungsarten default (file/link/text)',
  ev.body?.config?.allowFile && ev.body?.config?.allowLink && ev.body?.config?.allowText);
check('Default: Einfügen gesperrt, Screenshot aus',
  ev.body?.config?.allowPaste === false && ev.body?.config?.allowScreenshot === false);
check('Default: Fachgespräch aus', ev.body?.config?.allowExpertTalk === false);

// ── Matrix liefert den Nachweis am Feld ───────────────────────────
const matrix = await req('GET', `/modules/${moduleId}/matrix`, null, teacher);
const matrixField = matrix.body?.matrix?.bands?.[0]?.fields?.find((f) => f.id === fieldId);
check('Matrix enthält Nachweis am Feld',
  Array.isArray(matrixField?.evidences) && matrixField.evidences.some((e) => e.evidence.id === evId));

// ── Lernenden-Sicht: sichtbar, Rich-Text vorhanden ────────────────
const sView = await req('GET', `/evidence/student/${evId}`, null, student);
check('Student-Sicht → 200', sView.status === 200);
check('Student sieht Rich-Text', sView.body?.instructions?.de?.includes('Dockerfile'));

// ── Validierung (noch keine Einreichung vorhanden) ────────────────
const badType = await req('POST', `/evidence/${evId}/upload-url`,
  { fileName: 'schad.exe', contentType: 'application/octet-stream', sizeBytes: 1000 }, student);
check('Upload falscher Typ → 422', badType.status === 422);
const badLink = await req('POST', `/evidence/${evId}/submissions`, { link: 'kein-link' }, student);
check('Ungültiger Link → 422', badLink.status === 422);
const emptySub = await req('POST', `/evidence/${evId}/submissions`, {}, student);
check('Leere Einreichung → 400', emptySub.status === 400);

// ── FA-30: Datei-Upload (presigned + PUT + confirm) ───────────────
const presign = await req('POST', `/evidence/${evId}/upload-url`,
  { fileName: 'nachweis.pdf', contentType: 'application/pdf', sizeBytes: 1024 }, student);
check('Upload gültig → presigned URL', presign.status === 201 && presign.body?.uploadUrl?.startsWith('http'));
const put = await fetch(presign.body.uploadUrl, {
  method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: Buffer.from('%PDF-1.4 x'),
});
check('Datei-PUT an MinIO → 200', put.status === 200);
const confirm = await req('POST', `/evidence/${evId}/upload-confirm`,
  { key: presign.body.key, fileName: 'nachweis.pdf' }, student);
check('Upload bestätigt → submitted', confirm.body?.status === 'SUBMITTED');

// ── Sperre: erneutes Einreichen vor Rückweisung nicht möglich ─────
const blocked = await req('POST', `/evidence/${evId}/submissions`, { text: 'Nochmal' }, student);
check('Erneute Einreichung gesperrt → 409', blocked.status === 409);

// Lehrperson weist zurück → erneute Einreichung möglich
await req('POST', `/submissions/${confirm.body.submissionId}/reject`, { reason: 'Bitte ergänzen.' }, teacher);
const linkSub = await req('POST', `/evidence/${evId}/submissions`, { link: 'https://github.com/me/repo' }, student);
check('Nach Rückweisung Link-Einreichung → submitted', linkSub.body?.status === 'SUBMITTED');

await req('POST', `/submissions/${linkSub.body.submissionId}/reject`, { reason: 'Link defekt.' }, teacher);
const textSub = await req('POST', `/evidence/${evId}/submissions`, { text: 'Meine Lösung als Text.' }, student);
check('Nach Rückweisung Text-Einreichung → submitted', textSub.body?.status === 'SUBMITTED');

// ── FA-36: Sichtbarkeit ───────────────────────────────────────────
await req('PATCH', `/evidence/${evId}`, { isVisible: false }, teacher);
const hidden = await req('GET', `/evidence/student/${evId}`, null, student);
check('Verborgener Nachweis → 404', hidden.status === 404);

// ── RBAC ──────────────────────────────────────────────────────────
const studentCreate = await req('POST', '/evidence', { moduleId, title: { de: 'x' } }, student);
check('Student POST /evidence → 403', studentCreate.status === 403);

// ── Reihenfolge der Nachweise ─────────────────────────────────────
await req('PATCH', `/evidence/${evId}`, { isVisible: true }, teacher); // wieder sichtbar
const ev2 = await req('POST', '/evidence', {
  moduleId, title: { de: 'Zweiter Nachweis' }, isVisible: true, fieldIds: [fieldId],
}, teacher);
const evId2 = ev2.body?.id;
check('Zweiter Nachweis sortOrder > erster', ev2.body?.sortOrder > ev.body?.sortOrder);

// Reihenfolge tauschen: zweiten nach vorne
await req('PATCH', `/evidence/${evId2}`, { sortOrder: ev.body.sortOrder }, teacher);
await req('PATCH', `/evidence/${evId}`, { sortOrder: ev2.body.sortOrder }, teacher);
const reordered = await req('GET', `/modules/${moduleId}/matrix`, null, teacher);
const fieldEvs = reordered.body?.matrix?.bands?.[0]?.fields?.find((f) => f.id === fieldId)?.evidences ?? [];
check('Matrix-Reihenfolge getauscht', fieldEvs[0]?.evidence?.id === evId2);

// ── Bild-Upload (Rich-Text-Asset) ─────────────────────────────────
const imgBad = await req('POST', '/assets/image-upload-url', { fileName: 'x.exe', contentType: 'x' }, teacher);
check('Nicht-Bild → 400', imgBad.status === 400);
const img = await req('POST', '/assets/image-upload-url', { fileName: 'foto.png', contentType: 'image/png', sizeBytes: 2048 }, teacher);
check('Bild-Upload-URL → presigned + publicUrl', img.status === 201 && img.body?.uploadUrl?.startsWith('http') && !!img.body?.publicUrl);
const imgPut = await fetch(img.body.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: Buffer.from('PNGDATA') });
check('Bild-PUT an MinIO → 200', imgPut.status === 200);
const imgGet = await fetch(img.body.publicUrl);
check('Bild öffentlich abrufbar (GET ohne Auth) → 200', imgGet.status === 200);
const studentImgPost = await req('POST', '/assets/image-upload-url', { fileName: 'a.png', contentType: 'image/png' }, student);
check('Student Bild-Upload → 403', studentImgPost.status === 403);

// ── Zentrale Einreichung (Text+Link zusammen) + Screenshot-Erlaubnis ─
const ev3 = await req('POST', '/evidence', {
  moduleId, title: { de: 'Zentral-Einreichung' }, isVisible: true, fieldIds: [fieldId],
  config: { allowScreenshot: true, allowPaste: true, allowExpertTalk: true },
}, teacher);
const evId3 = ev3.body?.id;
check('Nachweis mit allowScreenshot/allowPaste', ev3.body?.config?.allowScreenshot === true && ev3.body?.config?.allowPaste === true);
check('Nachweis mit allowExpertTalk', ev3.body?.config?.allowExpertTalk === true);
const multi = await req('POST', `/evidence/${evId3}/submit`,
  { text: 'Meine Begründung', link: 'https://example.com/x' }, student);
check('Zentrale Einreichung (Text+Link) → submitted', multi.body?.status === 'SUBMITTED');
const blocked3 = await req('POST', `/evidence/${evId3}/submit`, { text: 'Nochmal' }, student);
check('Zentrale Einreichung erneut gesperrt → 409', blocked3.status === 409);

// ── Reines Fachgespräch: Einreichung ohne Text/Link/Datei erlaubt ─
const evTalk = await req('POST', '/evidence', {
  moduleId, title: { de: 'Fachgespräch OS' }, isVisible: true, fieldIds: [fieldId],
  config: { allowFile: false, allowLink: false, allowText: false, allowExpertTalk: true },
}, teacher);
const evTalkId = evTalk.body?.id;
const talkSubmit = await req('POST', `/evidence/${evTalkId}/submit`, {}, student);
check('Reines Fachgespräch ohne Inhalt → submitted', talkSubmit.body?.status === 'SUBMITTED', `status=${talkSubmit.status}`);

// Gegenprobe: ohne Fachgespräch ist leere Einreichung weiterhin 400
const evPlain = await req('POST', '/evidence', {
  moduleId, title: { de: 'Plain' }, isVisible: true, fieldIds: [fieldId],
}, teacher);
const plainEmpty = await req('POST', `/evidence/${evPlain.body?.id}/submit`, {}, student);
check('Leere Einreichung ohne Fachgespräch → 400', plainEmpty.status === 400);
await req('DELETE', `/evidence/${evTalkId}`, null, teacher);
await req('DELETE', `/evidence/${evPlain.body?.id}`, null, teacher);

// ── Lehrer-Anhang am Nachweis ─────────────────────────────────────
const att = await req('POST', '/assets/attachment-upload-url', { fileName: 'vorlage.pdf', contentType: 'application/pdf' }, teacher);
check('Anhang-Upload-URL → presigned', att.status === 201 && !!att.body?.key);
await fetch(att.body.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: Buffer.from('%PDF vorlage') });
await req('PATCH', `/evidence/${evId3}`, { config: { allowScreenshot: true, attachmentKey: att.body.key, attachmentName: 'vorlage.pdf' } }, teacher);
const sView3 = await req('GET', `/evidence/student/${evId3}`, null, student);
check('Lernende:r erhält Anhang-Download-URL', typeof sView3.body?.attachmentUrl === 'string' && sView3.body.attachmentUrl.startsWith('http'));

// ── Aufräumen ─────────────────────────────────────────────────────
await req('DELETE', `/evidence/${evId}`, null, teacher);
await req('DELETE', `/evidence/${evId2}`, null, teacher);
await req('DELETE', `/evidence/${evId3}`, null, teacher);
await req('DELETE', `/classes/${cls.body.id}`, null, teacher);
await req('DELETE', `/modules/${moduleId}`, null, teacher);

console.log(`\nErgebnis: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
