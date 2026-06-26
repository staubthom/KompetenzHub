// Server-Modul des Memo-Plugins. Speichert private Lehrpersonen-Notizen je
// Lernende:r (enrollmentId) im gescopten KV-Store. Die Berechtigung wird bei JEDER
// Route über ctx.core (Kern-Lesefassade) geprüft – ohne Kenntnis der Kern-DB.
//
// Datenschutz (§ Auftrag): Lernende können diese Endpunkte gar nicht erst aufrufen
// (Manifest roles: ["TEACHER"] → der Kern-Dispatcher blockt andere Rollen). Zusätzlich
// erhält eine Lehrperson nur Notizen zu Modulanlässen, die sie besitzt/co-leitet.

import { definePlugin, badRequest, forbidden, notFound } from '@kompetenzhub/plugin-sdk';
import type { ServerContext, ClassMemberRef } from '@kompetenzhub/plugin-sdk';
import { randomUUID } from 'node:crypto';

const NOTE_TYPES = ['todo', 'absence', 'note'] as const;
type NoteType = (typeof NOTE_TYPES)[number];

interface MemoNote {
  id: string;
  enrollmentId: string;
  moduleId: string | null;
  classId: string;
  learnerName: string;
  authorId: string;
  type: NoteType;
  text: string;
  /** Nur für type "todo" relevant: offen (false) / erledigt (true). */
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Co-Leitungs-Zugriff aus der (admin-gesetzten) Plugin-Konfiguration. */
type CoTeacherAccess = 'write' | 'read' | 'none';
function coTeacherAccess(ctx: ServerContext): CoTeacherAccess {
  const v = ctx.config.coTeacherAccess;
  return v === 'read' || v === 'none' ? v : 'write';
}

/** Prüft Lesezugriff auf eine Einschreibung und liefert den Member-Kontext. */
async function assertRead(ctx: ServerContext, enrollmentId: string): Promise<ClassMemberRef> {
  const member = await ctx.core.getClassMember(enrollmentId);
  if (!member || !member.teacherHasAccess) throw forbidden('Kein Zugriff auf diese:n Lernende:n.');
  if (member.teacherRelation === 'coTeacher' && coTeacherAccess(ctx) === 'none') {
    throw forbidden('Co-Leitung hat für dieses Plugin keinen Zugriff.');
  }
  return member;
}

/** Prüft Schreibzugriff (Besitz, Admin, oder Co-Leitung mit Schreibrecht). */
async function assertWrite(ctx: ServerContext, enrollmentId: string): Promise<ClassMemberRef> {
  const member = await assertRead(ctx, enrollmentId);
  if (member.teacherRelation === 'coTeacher' && coTeacherAccess(ctx) !== 'write') {
    throw forbidden('Co-Leitung darf hier nur lesen.');
  }
  return member;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export default definePlugin({
  routes: {
    // Notizen einer lernenden Person ODER eines ganzen Moduls.
    'GET /notes': async (ctx, req) => {
      const enrollmentId = asString(req.query.enrollmentId);
      const moduleId = asString(req.query.moduleId);
      const all = await ctx.data.list<MemoNote>('notes');

      if (enrollmentId) {
        await assertRead(ctx, enrollmentId);
        return all
          .map((r) => r.data)
          .filter((n) => n.enrollmentId === enrollmentId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }

      if (moduleId) {
        // listModuleMembers liefert nur zugreifbare Einschreibungen → ACL inklusive.
        const members = await ctx.core.listModuleMembers(moduleId);
        const allowed = new Map(members.map((m) => [m.enrollmentId, m] as const));
        return all
          .map((r) => r.data)
          .filter((n) => allowed.has(n.enrollmentId))
          .map((n) => ({ ...n, learnerName: allowed.get(n.enrollmentId)!.displayName }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }

      throw badRequest('enrollmentId oder moduleId erforderlich.');
    },

    // Neue Notiz anlegen.
    'POST /notes': async (ctx, req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const enrollmentId = asString(body.enrollmentId);
      const text = asString(body.text);
      const type = asString(body.type) as NoteType;
      if (!enrollmentId) throw badRequest('enrollmentId erforderlich.');
      if (!text) throw badRequest('Notiztext erforderlich.');
      if (!NOTE_TYPES.includes(type)) throw badRequest('Ungültiger Notiztyp.');

      const member = await assertWrite(ctx, enrollmentId);
      const now = new Date().toISOString();
      const note: MemoNote = {
        id: randomUUID(),
        enrollmentId,
        moduleId: member.moduleId,
        classId: member.classId,
        learnerName: member.displayName,
        authorId: ctx.user.id,
        type,
        text,
        done: false,
        createdAt: now,
        updatedAt: now,
      };
      await ctx.data.put('notes', note.id, note);
      await ctx.audit('note.create', { enrollmentId, type });
      return note;
    },

    // Notiz bearbeiten (Text/Typ/Erledigt-Status).
    'PATCH /notes/:id': async (ctx, req) => {
      const id = req.params.id;
      const existing = await ctx.data.get<MemoNote>('notes', id);
      if (!existing) throw notFound('Notiz nicht gefunden.');
      await assertWrite(ctx, existing.enrollmentId);

      const body = (req.body ?? {}) as Record<string, unknown>;
      const next: MemoNote = { ...existing, updatedAt: new Date().toISOString() };
      if (typeof body.text === 'string') {
        const text = body.text.trim();
        if (!text) throw badRequest('Notiztext darf nicht leer sein.');
        next.text = text;
      }
      if (typeof body.type === 'string') {
        if (!NOTE_TYPES.includes(body.type as NoteType)) throw badRequest('Ungültiger Notiztyp.');
        next.type = body.type as NoteType;
      }
      if (typeof body.done === 'boolean') next.done = body.done;

      await ctx.data.put('notes', id, next);
      await ctx.audit('note.update', { id });
      return next;
    },

    // Notiz löschen.
    'DELETE /notes/:id': async (ctx, req) => {
      const id = req.params.id;
      const existing = await ctx.data.get<MemoNote>('notes', id);
      if (!existing) throw notFound('Notiz nicht gefunden.');
      await assertWrite(ctx, existing.enrollmentId);
      await ctx.data.delete('notes', id);
      await ctx.audit('note.delete', { id });
      return { ok: true };
    },

    // Module der aufrufenden Lehrperson (für die Modul-Auswahl der Übersicht).
    'GET /modules': async (ctx) => {
      return ctx.core.listMyModules();
    },

    // Kennzahl für das Dashboard-Widget: eigene offene To-Dos.
    'GET /summary': async (ctx) => {
      const all = await ctx.data.list<MemoNote>('notes');
      const openTodos = all
        .map((r) => r.data)
        .filter((n) => n.type === 'todo' && !n.done && n.authorId === ctx.user.id).length;
      return { openTodos };
    },
  },
});
