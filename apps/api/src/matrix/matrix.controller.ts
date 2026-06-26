import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CompetenceLevel, Prisma } from '@prisma/client';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

const LEVELS: CompetenceLevel[] = [
  CompetenceLevel.BEGINNER,
  CompetenceLevel.INTERMEDIATE,
  CompetenceLevel.ADVANCED,
];

@Controller()
export class MatrixController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /modules/:id/matrix
   * Liefert die vollständige Rasterstruktur (Bänder × Gütestufen inkl. Feld-IDs).
   *
   * Standardmässig werden die Einreichungen der/des aufrufenden Lernenden eingeblendet.
   * Lehrpersonen/Admins können mit `?enrollmentId=…` die Matrix einer bestimmten
   * lernenden Person ansehen (Einreichungs-Status & Punkte je Nachweis) – z. B. um aus
   * den Modulanlässen heraus eine Einreichung nachzubewerten.
   */
  @Get('modules/:id/matrix')
  @Roles(Role.TEACHER, Role.ADMIN, Role.LEARNER)
  async getMatrix(
    @Param('id') moduleId: string,
    @CurrentUser() user: RequestContext,
    @Query('enrollmentId') enrollmentId?: string,
  ) {
    const module = await this.prisma.module.findFirst({
      where: { id: moduleId, tenantId: user.tenantId },
      select: { id: true, number: true, title: true },
    });
    if (!module) throw new NotFoundException('Modul nicht gefunden.');

    const isTeacher = user.roles.includes(Role.TEACHER) || user.roles.includes(Role.ADMIN);

    // Welche Einreichungen werden je Nachweis eingeblendet? Lernende sehen die eigenen;
    // Lehrpersonen/Admins optional die einer bestimmten lernenden Person (nach Prüfung).
    let submissionWhere: Prisma.SubmissionWhereInput = { enrollment: { userId: user.userId } };
    if (enrollmentId) {
      if (!isTeacher) throw new ForbiddenException('Kein Zugriff auf fremde Einreichungen.');
      await this.assertEnrollmentAccess(enrollmentId, moduleId, user);
      submissionWhere = { enrollmentId };
    }

    const matrix = await this.prisma.competenceMatrix.findUnique({
      where: { moduleId },
      include: {
        bands: {
          orderBy: { sortOrder: 'asc' },
          include: {
            fields: {
              orderBy: { level: 'asc' },
              include: {
                descriptor: true,
                evidences: {
                  orderBy: { evidence: { sortOrder: 'asc' } },
                  include: {
                    evidence: {
                      select: {
                        id: true,
                        title: true,
                        instructions: true,
                        isVisible: true,
                        dueAt: true,
                        maxPoints: true,
                        sortOrder: true,
                        config: true,
                        _count: { select: { submissions: true } },
                        // Letzte Einreichung der betrachteten Person (für Chip-Status,
                        // Punkte-Summe des Moduls und – für Lehrpersonen – zum Nachbewerten)
                        submissions: {
                          where: submissionWhere,
                          orderBy: { createdAt: 'desc' },
                          take: 1,
                          select: { id: true, status: true, points: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            actionGoals: {
              include: { actionGoal: { select: { id: true, code: true, text: true } } },
            },
          },
        },
      },
    });
    if (!matrix) throw new NotFoundException('Matrix nicht gefunden.');

    // Lernende sehen nur sichtbare Nachweise (Lehrperson/Admin alle).
    if (!isTeacher) {
      for (const band of matrix.bands) {
        for (const field of band.fields) {
          field.evidences = field.evidences.filter((e) => e.evidence.isVisible);
        }
      }
    }

    return { module, matrix };
  }

  /**
   * POST /matrices/:matrixId/bands
   * Legt ein neues Kompetenzband an (inkl. automatisch erstellter Felder für B/I/A).
   */
  @Post('matrices/:matrixId/bands')
  @Roles(Role.TEACHER, Role.ADMIN)
  async createBand(
    @Param('matrixId') matrixId: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: RequestContext,
  ) {
    await this.assertMatrixAccess(matrixId, user.tenantId);
    const code = String(dto.code ?? '').trim();
    if (!code) throw new BadRequestException('"code" ist erforderlich.');

    const last = await this.prisma.competenceBand.findFirst({
      where: { matrixId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? 0) + 1;

    // Band anlegen + Felder für alle drei Gütestufen in einem Zug
    const band = await this.prisma.competenceBand.create({
      data: {
        matrixId,
        code,
        description: (dto.description ?? {}) as Prisma.InputJsonValue,
        weight: dto.weight !== undefined ? Number(dto.weight) : 1.0,
        sortOrder,
        fields: {
          create: LEVELS.map((level) => ({
            level,
            code: `${code}${level.charAt(0)}`,
          })),
        },
      },
      include: {
        fields: { include: { descriptor: true } },
        actionGoals: true,
      },
    });

    // Handlungsziele verknüpfen, falls angegeben
    if (Array.isArray(dto.actionGoalIds) && dto.actionGoalIds.length > 0) {
      await this.linkActionGoals(band.id, dto.actionGoalIds as string[]);
    }

    return band;
  }

  /**
   * PATCH /bands/:id
   * Ändert Beschreibung, Gewichtung, Sortierung oder HZ-Verknüpfungen.
   */
  @Patch('bands/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  async updateBand(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: RequestContext,
  ) {
    const band = await this.prisma.competenceBand.findUnique({
      where: { id },
      select: { id: true, matrixId: true },
    });
    if (!band) throw new NotFoundException('Kompetenzband nicht gefunden.');
    await this.assertMatrixAccess(band.matrixId, user.tenantId);

    await this.prisma.competenceBand.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: String(dto.code).trim() }),
        ...(dto.description !== undefined && {
          description: dto.description as Prisma.InputJsonValue,
        }),
        ...(dto.weight !== undefined && { weight: Number(dto.weight) }),
        ...(dto.sortOrder !== undefined && { sortOrder: Number(dto.sortOrder) }),
      },
    });

    if (Array.isArray(dto.actionGoalIds)) {
      await this.prisma.bandActionGoal.deleteMany({ where: { bandId: id } });
      if (dto.actionGoalIds.length > 0) {
        await this.linkActionGoals(id, dto.actionGoalIds as string[]);
      }
    }

    return this.prisma.competenceBand.findUnique({
      where: { id },
      include: {
        fields: { include: { descriptor: true } },
        actionGoals: { include: { actionGoal: true } },
      },
    });
  }

  /**
   * DELETE /bands/:id
   * Entfernt ein Band inklusive aller Felder und Deskriptoren (Cascade).
   */
  @Delete('bands/:id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  async deleteBand(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    const band = await this.prisma.competenceBand.findUnique({
      where: { id },
      select: { matrixId: true },
    });
    if (!band) throw new NotFoundException('Kompetenzband nicht gefunden.');
    await this.assertMatrixAccess(band.matrixId, user.tenantId);
    await this.prisma.competenceBand.delete({ where: { id } });
  }

  /**
   * Stellt sicher, dass die Einschreibung zum Modul gehört und die aufrufende
   * Lehrperson die Klasse besitzt oder co-leitet (Admins: immer). Verhindert das
   * Ausspähen von Einreichungen aus fremden Modulanlässen.
   */
  private async assertEnrollmentAccess(
    enrollmentId: string,
    moduleId: string,
    user: RequestContext,
  ) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, class: { moduleId, tenantId: user.tenantId } },
      select: {
        class: {
          select: {
            ownerId: true,
            coTeachers: { where: { userId: user.userId }, select: { userId: true } },
          },
        },
      },
    });
    if (!enrollment) throw new NotFoundException('Lernende Person nicht in diesem Modul gefunden.');
    const isAdmin = user.roles.includes(Role.ADMIN);
    const isClassTeacher =
      enrollment.class.ownerId === user.userId || enrollment.class.coTeachers.length > 0;
    if (!isAdmin && !isClassTeacher) {
      throw new ForbiddenException('Kein Zugriff auf diesen Modulanlass.');
    }
  }

  private async assertMatrixAccess(matrixId: string, tenantId: string) {
    const matrix = await this.prisma.competenceMatrix.findUnique({
      where: { id: matrixId },
      include: { module: { select: { tenantId: true } } },
    });
    if (!matrix || matrix.module.tenantId !== tenantId) {
      throw new NotFoundException('Matrix nicht gefunden.');
    }
    return matrix;
  }

  private async linkActionGoals(bandId: string, actionGoalIds: string[]) {
    await this.prisma.bandActionGoal.createMany({
      data: actionGoalIds.map((actionGoalId) => ({ bandId, actionGoalId })),
      skipDuplicates: true,
    });
  }
}
