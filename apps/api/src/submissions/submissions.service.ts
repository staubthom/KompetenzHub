import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AchievedLevel,
  EvaluationChangeType,
  Prisma,
  Role,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';

export interface EvaluateDto {
  points?: number;
  level?: AchievedLevel;
  feedback?: string;
}

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  /** Liste der Einreichungen im aktiven Tenant (Lehrperson/Admin), filterbar. */
  async list(
    tenantId: string,
    filter: { status?: SubmissionStatus; classId?: string; evidenceId?: string },
  ) {
    const subs = await this.prisma.submission.findMany({
      where: {
        evidence: { tenantId },
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.evidenceId ? { evidenceId: filter.evidenceId } : {}),
        ...(filter.classId ? { enrollment: { classId: filter.classId } } : {}),
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        points: true,
        evidence: { select: { id: true, title: true, maxPoints: true } },
        enrollment: {
          select: {
            id: true,
            displayName: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return subs;
  }

  /** Detail einer Einreichung inkl. Download-Link, Bewertung & Historie. */
  async detail(id: string, tenantId: string, userId: string, roles: Role[]) {
    const sub = await this.prisma.submission.findFirst({
      where: { id, evidence: { tenantId } },
      include: {
        evidence: { select: { id: true, title: true, instructions: true, maxPoints: true } },
        enrollment: {
          select: {
            userId: true,
            displayName: true,
            class: { select: { id: true, name: true } },
          },
        },
        evaluation: true,
        history: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { displayName: true } } },
        },
      },
    });
    if (!sub) throw new NotFoundException('Einreichung nicht gefunden.');

    // Zugriff: Lehrperson/Admin im Tenant ODER der/die einreichende Lernende
    const isTeacher = roles.includes(Role.TEACHER) || roles.includes(Role.ADMIN);
    const isOwner = sub.enrollment.userId === userId;
    if (!isTeacher && !isOwner) {
      throw new ForbiddenException('Kein Zugriff auf diese Einreichung.');
    }

    let fileUrl: string | null = null;
    if (sub.fileKey) {
      fileUrl = await this.s3.presignDownload(sub.fileKey);
    }
    return { ...sub, fileUrl };
  }

  /** Bewerten (FA-60): Punkte/Level/Feedback, Status → graded, Historie. */
  async evaluate(id: string, dto: EvaluateDto, tenantId: string, userId: string) {
    const sub = await this.loadInTenant(id, tenantId);

    if (dto.points !== undefined && dto.points !== null) {
      if (dto.points < 0)
        throw new UnprocessableEntityException('Punkte dürfen nicht negativ sein.');
      const max = sub.evidence.maxPoints ? Number(sub.evidence.maxPoints) : null;
      if (max !== null && dto.points > max) {
        throw new UnprocessableEntityException(`Punkte überschreiten das Maximum (${max}).`);
      }
    }

    const existing = await this.prisma.evaluation.findUnique({ where: { submissionId: id } });
    const feedback = dto.feedback ?? existing?.feedback ?? '';

    const evaluation = await this.prisma.evaluation.upsert({
      where: { submissionId: id },
      create: {
        submissionId: id,
        evaluatorId: userId,
        achievedLevel: dto.level ?? null,
        points: dto.points ?? null,
        feedback,
        rejectionReason: null,
      },
      update: {
        evaluatorId: userId,
        achievedLevel: dto.level ?? null,
        points: dto.points ?? null,
        feedback,
        rejectionReason: null,
      },
    });

    await this.prisma.submission.update({
      where: { id },
      data: { status: SubmissionStatus.GRADED, points: dto.points ?? null },
    });

    await this.prisma.evaluationHistory.create({
      data: {
        submissionId: id,
        changedById: userId,
        changeType: existing ? EvaluationChangeType.UPDATED : EvaluationChangeType.CREATED,
        achievedLevel: dto.level ?? null,
        points: dto.points ?? null,
        feedback,
      },
    });

    await this.audit(tenantId, userId, 'submission.grade', id, {
      points: dto.points ?? null,
      level: dto.level ?? null,
    });

    return evaluation;
  }

  /** Zurückweisen (FA-62): Pflicht-Begründung, Status → rejected, Historie. */
  async reject(id: string, reason: string, tenantId: string, userId: string) {
    const trimmed = reason?.trim();
    if (!trimmed) throw new UnprocessableEntityException('Begründung ist erforderlich.');
    await this.loadInTenant(id, tenantId);

    const evaluation = await this.prisma.evaluation.upsert({
      where: { submissionId: id },
      create: {
        submissionId: id,
        evaluatorId: userId,
        feedback: '',
        rejectionReason: trimmed,
      },
      update: { evaluatorId: userId, rejectionReason: trimmed },
    });

    await this.prisma.submission.update({
      where: { id },
      data: { status: SubmissionStatus.REJECTED },
    });

    await this.prisma.evaluationHistory.create({
      data: {
        submissionId: id,
        changedById: userId,
        changeType: EvaluationChangeType.REJECTED,
        feedback: trimmed,
      },
    });

    await this.audit(tenantId, userId, 'submission.reject', id, { reason: trimmed });
    return evaluation;
  }

  /** Bewertungshistorie (FA-65). */
  async history(id: string, tenantId: string, userId: string, roles: Role[]) {
    const sub = await this.prisma.submission.findFirst({
      where: { id, evidence: { tenantId } },
      select: { enrollment: { select: { userId: true } } },
    });
    if (!sub) throw new NotFoundException('Einreichung nicht gefunden.');
    const isTeacher = roles.includes(Role.TEACHER) || roles.includes(Role.ADMIN);
    if (!isTeacher && sub.enrollment.userId !== userId) {
      throw new ForbiddenException('Kein Zugriff.');
    }
    return this.prisma.evaluationHistory.findMany({
      where: { submissionId: id },
      orderBy: { createdAt: 'desc' },
      include: { changedBy: { select: { displayName: true } } },
    });
  }

  // ── Helfer ────────────────────────────────────────────────────

  private async loadInTenant(id: string, tenantId: string) {
    const sub = await this.prisma.submission.findFirst({
      where: { id, evidence: { tenantId } },
      include: { evidence: { select: { maxPoints: true } } },
    });
    if (!sub) throw new NotFoundException('Einreichung nicht gefunden.');
    return sub;
  }

  private async audit(
    tenantId: string,
    userId: string,
    action: string,
    entityId: string,
    detail: Record<string, unknown>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { tenantId, userId, action, detail: detail as Prisma.InputJsonValue },
      });
    } catch {
      // Audit-Fehler nicht fatal
    }
  }
}
