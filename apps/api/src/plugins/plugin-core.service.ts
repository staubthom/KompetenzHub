import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import type {
  AttachResult,
  ClassMemberRef,
  CoreClassRef,
  CoreContext,
  CoreModuleRef,
  TeacherAttachedEvidenceRef,
  TeacherRelation,
} from '@kompetenzhub/plugin-sdk';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceService } from '../evidence/evidence.service';

/**
 * Implementiert die schreibgeschützte Kern-Lesefassade (`ctx.core`), über die Plugins
 * kontextbezogene Berechtigungen prüfen, ohne die Kern-DB zu kennen (§ Hooks). Die
 * Berechtigung der aufrufenden Person (Tenant + Besitz/Co-Leitung der Klasse) wird hier
 * IMMER serverseitig durchgesetzt – Plugin-Eingaben können sie nicht aushebeln.
 */
@Injectable()
export class PluginCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidence: EvidenceService,
  ) {}

  /**
   * Liefert eine auf die aufrufende Person (und das Plugin) festgenagelte
   * CoreContext-Implementierung. `pluginId` wird für die Storage-Prefix-Prüfung
   * der Schreib-Fassade benötigt.
   */
  scoped(user: RequestContext, pluginId: string): CoreContext {
    return {
      getClassMember: (enrollmentId: string) => this.getClassMember(user, enrollmentId),
      listModuleMembers: (moduleId: string) => this.listModuleMembers(user, moduleId),
      listMyModules: () => this.listMyModules(user),
      listMyClasses: () => this.listMyClasses(user),
      listTeacherAttachedEvidences: (moduleId: string) =>
        this.listTeacherAttachedEvidences(user, moduleId),
      attachTeacherFiles: (evidenceId, enrollmentId, files) =>
        this.attachTeacherFiles(user, pluginId, evidenceId, enrollmentId, files),
    };
  }

  /** Hat die aufrufende Person Zugriff auf das Modul (eigene/co-geleitete Klasse oder Admin)? */
  private async hasModuleAccess(user: RequestContext, moduleId: string): Promise<boolean> {
    if (user.roles.includes(Role.ADMIN)) {
      const count = await this.prisma.class.count({
        where: { moduleId, tenantId: user.tenantId },
      });
      return count > 0;
    }
    const count = await this.prisma.class.count({
      where: {
        moduleId,
        tenantId: user.tenantId,
        OR: [{ ownerId: user.userId }, { coTeachers: { some: { userId: user.userId } } }],
      },
    });
    return count > 0;
  }

  private async listTeacherAttachedEvidences(
    user: RequestContext,
    moduleId: string,
  ): Promise<TeacherAttachedEvidenceRef[]> {
    if (!(await this.hasModuleAccess(user, moduleId))) return [];
    const evidences = await this.prisma.competenceEvidence.findMany({
      where: { moduleId, tenantId: user.tenantId },
      select: { id: true, title: true, maxPoints: true, config: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return evidences
      .filter(
        (e) => (e.config as { allowTeacherAttached?: boolean })?.allowTeacherAttached === true,
      )
      .map((e) => ({
        evidenceId: e.id,
        title: (e.title ?? {}) as Record<string, string>,
        maxPoints: e.maxPoints != null ? Number(e.maxPoints) : null,
      }));
  }

  private async attachTeacherFiles(
    user: RequestContext,
    pluginId: string,
    evidenceId: string,
    enrollmentId: string,
    files: { key: string; name: string }[],
  ): Promise<AttachResult> {
    // Schutz: das Plugin darf nur Dateien aus dem EIGENEN, tenant-gescopten Storage
    // anfügen – niemals fremde/erratene S3-Keys.
    const allowedPrefix = `plugins/${pluginId}/${user.tenantId}/`;
    for (const f of files) {
      if (!f?.key || !f.key.startsWith(allowedPrefix)) {
        throw new ForbiddenException('Datei-Key liegt ausserhalb des Plugin-Storage.');
      }
    }
    // teacherAttach erzwingt Nachweistyp + ACL (Besitz/Co-Leitung) selbst.
    return this.evidence.teacherAttach(evidenceId, user.tenantId, user.userId, user.roles, {
      enrollmentId,
      files: files.map((f) => ({ key: f.key, name: f.name })),
    });
  }

  private async listMyClasses(user: RequestContext): Promise<CoreClassRef[]> {
    const isAdmin = user.roles.includes(Role.ADMIN);
    const classes = await this.prisma.class.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'ACTIVE',
        moduleId: { not: null },
        ...(isAdmin
          ? {}
          : { OR: [{ ownerId: user.userId }, { coTeachers: { some: { userId: user.userId } } }] }),
      },
      select: {
        id: true,
        name: true,
        status: true,
        module: { select: { id: true, number: true } },
      },
      orderBy: { name: 'asc' },
    });
    return classes.map((c) => ({
      classId: c.id,
      name: c.name,
      moduleId: c.module?.id ?? null,
      moduleNumber: c.module?.number ?? null,
      classStatus: c.status,
    }));
  }

  private async listMyModules(user: RequestContext): Promise<CoreModuleRef[]> {
    const isAdmin = user.roles.includes(Role.ADMIN);
    const classes = await this.prisma.class.findMany({
      where: {
        tenantId: user.tenantId,
        moduleId: { not: null },
        ...(isAdmin
          ? {}
          : { OR: [{ ownerId: user.userId }, { coTeachers: { some: { userId: user.userId } } }] }),
      },
      select: { module: { select: { id: true, number: true, title: true } } },
    });
    const seen = new Map<string, CoreModuleRef>();
    for (const c of classes) {
      if (c.module && !seen.has(c.module.id)) {
        seen.set(c.module.id, {
          moduleId: c.module.id,
          number: c.module.number,
          title: (c.module.title ?? {}) as Record<string, string>,
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.number.localeCompare(b.number));
  }

  private relation(
    user: RequestContext,
    cls: { ownerId: string; coTeachers: { userId: string }[] },
  ): TeacherRelation {
    if (user.roles.includes(Role.ADMIN)) return 'admin';
    if (cls.ownerId === user.userId) return 'owner';
    if (cls.coTeachers.length > 0) return 'coTeacher';
    return 'none';
  }

  private async getClassMember(
    user: RequestContext,
    enrollmentId: string,
  ): Promise<ClassMemberRef | null> {
    const e = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, class: { tenantId: user.tenantId } },
      select: {
        id: true,
        displayName: true,
        user: { select: { displayName: true } },
        class: {
          select: {
            id: true,
            moduleId: true,
            status: true,
            ownerId: true,
            coTeachers: { where: { userId: user.userId }, select: { userId: true } },
          },
        },
      },
    });
    if (!e) return null;
    const relation = this.relation(user, e.class);
    return {
      enrollmentId: e.id,
      classId: e.class.id,
      moduleId: e.class.moduleId,
      displayName: e.user?.displayName ?? e.displayName,
      classStatus: e.class.status,
      teacherRelation: relation,
      teacherHasAccess: relation !== 'none',
    };
  }

  private async listModuleMembers(
    user: RequestContext,
    moduleId: string,
  ): Promise<ClassMemberRef[]> {
    const isAdmin = user.roles.includes(Role.ADMIN);
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        class: {
          moduleId,
          tenantId: user.tenantId,
          ...(isAdmin
            ? {}
            : {
                OR: [{ ownerId: user.userId }, { coTeachers: { some: { userId: user.userId } } }],
              }),
        },
      },
      select: {
        id: true,
        displayName: true,
        user: { select: { displayName: true } },
        class: {
          select: {
            id: true,
            moduleId: true,
            status: true,
            ownerId: true,
            coTeachers: { where: { userId: user.userId }, select: { userId: true } },
          },
        },
      },
      orderBy: { displayName: 'asc' },
    });
    return enrollments.map((e) => {
      const relation = this.relation(user, e.class);
      return {
        enrollmentId: e.id,
        classId: e.class.id,
        moduleId: e.class.moduleId,
        displayName: e.user?.displayName ?? e.displayName,
        classStatus: e.class.status,
        teacherRelation: relation,
        teacherHasAccess: relation !== 'none',
      };
    });
  }
}
