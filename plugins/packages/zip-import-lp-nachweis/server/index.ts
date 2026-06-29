// Server-Modul des ZIP-Import-Plugins.
//
// Ablauf (sandbox-konform): Das Entpacken des ZIP und das Hochladen der Dateien
// passiert im Browser (Plugin-Web-Seite) über die gescopte Plugin-Storage
// (`/upload-url`). Der Server bekommt anschliessend pro Ordner die bereits
// hochgeladenen Datei-Keys, ordnet die Ordnernamen den Lernenden zu
// (ctx.core.listModuleMembers) und hängt die Dateien über die Kern-Schreibfassade
// (ctx.core.attachTeacherFiles) an den „von Lehrperson angefügt"-Nachweis an.
//
// Berechtigungen: Manifest-Rolle TEACHER (Dispatcher blockt andere); zusätzlich
// erzwingt der Kern Modul-/Klassenzugriff und Nachweistyp.

import { definePlugin, badRequest } from '@kompetenzhub/plugin-sdk';
import type { ServerContext } from '@kompetenzhub/plugin-sdk';

/** Normalisiert einen Namen für den Abgleich (Diakritika/Sonderzeichen/Schreibweise). */
function norm(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // kombinierende Diakritika entfernen
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

interface FolderInput {
  folder: string;
  files: { key: string; name: string }[];
}

interface MatchedReport {
  folder: string;
  displayName: string;
  fileCount: number;
  status: string;
}
interface UnmatchedReport {
  folder: string;
  fileCount: number;
}

export default definePlugin({
  routes: {
    // Modulanlässe (Klassen) der aufrufenden Lehrperson (für die Anlass-Auswahl).
    'GET /classes': async (ctx: ServerContext) => ctx.core.listMyClasses(),

    // „Von Lehrperson angefügt"-Nachweise eines Moduls (Ziel-Auswahl).
    'GET /evidences': async (ctx: ServerContext, req) => {
      const moduleId = asString(req.query.moduleId);
      if (!moduleId) throw badRequest('moduleId erforderlich.');
      return ctx.core.listTeacherAttachedEvidences(moduleId);
    },

    // Presigned-Upload-URL im gescopten Plugin-Storage (Browser lädt die Datei direkt hoch).
    'POST /upload-url': async (ctx: ServerContext, req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const fileName = asString(body.fileName) || 'datei';
      const contentType = asString(body.contentType) || 'application/octet-stream';
      return ctx.storage.presignUpload(fileName, contentType);
    },

    // Zuordnung & Anfügen: pro Ordner die bereits hochgeladenen Dateien dem passenden
    // Lernenden zuordnen und an den Nachweis anhängen.
    'POST /process': async (ctx: ServerContext, req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const classId = asString(body.classId);
      const moduleId = asString(body.moduleId);
      const evidenceId = asString(body.evidenceId);
      const folders = Array.isArray(body.folders) ? (body.folders as FolderInput[]) : [];
      if (!classId || !moduleId || !evidenceId) {
        throw badRequest('classId, moduleId und evidenceId erforderlich.');
      }
      if (folders.length === 0) throw badRequest('Keine Ordner im ZIP gefunden.');

      // Nur Mitglieder DES gewählten Modulanlasses (Klasse) berücksichtigen.
      const members = (await ctx.core.listModuleMembers(moduleId)).filter(
        (m) => m.classId === classId,
      );
      // Mehrere Personen können (theoretisch) gleich heissen → erste Übereinstimmung gewinnt,
      // Mehrdeutigkeiten werden als „nicht zugeordnet" gemeldet.
      const byName = new Map<string, { ids: string[]; displayName: string }>();
      for (const m of members) {
        if (!m.teacherHasAccess) continue;
        const k = norm(m.displayName);
        const e = byName.get(k);
        if (e) e.ids.push(m.enrollmentId);
        else byName.set(k, { ids: [m.enrollmentId], displayName: m.displayName });
      }

      const matched: MatchedReport[] = [];
      const unmatched: UnmatchedReport[] = [];

      for (const f of folders) {
        const folder = asString(f.folder);
        const files = Array.isArray(f.files)
          ? f.files
              .map((x) => ({ key: asString(x.key), name: asString(x.name) || 'datei' }))
              .filter((x) => x.key)
          : [];
        if (!folder || files.length === 0) continue;

        const hit = byName.get(norm(folder));
        if (!hit || hit.ids.length !== 1) {
          unmatched.push({ folder, fileCount: files.length });
          continue;
        }
        const res = await ctx.core.attachTeacherFiles(evidenceId, hit.ids[0], files);
        matched.push({
          folder,
          displayName: hit.displayName,
          fileCount: files.length,
          status: res.status,
        });
      }

      await ctx.audit('import.run', {
        moduleId,
        evidenceId,
        matched: matched.length,
        unmatched: unmatched.length,
      });
      return { matched, unmatched };
    },
  },
});
