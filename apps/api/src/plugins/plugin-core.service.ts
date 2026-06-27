import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import type {
  ClassMemberRef,
  CoreContext,
  CoreModuleRef,
  TeacherRelation,
} from '@kompetenzhub/plugin-sdk';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Implementiert die schreibgeschützte Kern-Lesefassade (`ctx.core`), über die Plugins
 * kontextbezogene Berechtigungen prüfen, ohne die Kern-DB zu kennen (§ Hooks). Die
 * Berechtigung der aufrufenden Person (Tenant + Besitz/Co-Leitung der Klasse) wird hier
 * IMMER serverseitig durchgesetzt – Plugin-Eingaben können sie nicht aushebeln.
 */
@Injectable()
export class PluginCoreService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liefert eine auf die aufrufende Person festgenagelte CoreContext-Implementierung. */
  scoped(user: RequestContext): CoreContext {
    return {
      getClassMember: (enrollmentId: string) => this.getClassMember(user, enrollmentId),
      listModuleMembers: (moduleId: string) => this.listModuleMembers(user, moduleId),
      listMyModules: () => this.listMyModules(user),
    };
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
