import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AchievedLevel, Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { EvidenceService } from './evidence.service';

@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  // ── Lehrer (FA-30/36/40) ──────────────────────────────────────

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  list(@Query('moduleId') moduleId: string | undefined, @CurrentUser() user: RequestContext) {
    return this.evidence.list(user.tenantId, moduleId);
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.evidence.findOneForTeacher(id, user.tenantId);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  create(@Body() dto: Record<string, unknown>, @CurrentUser() user: RequestContext) {
    return this.evidence.create(dto as never, user.tenantId);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.update(id, dto as never, user.tenantId);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.evidence.remove(id, user.tenantId);
  }

  /**
   * Einreichungsart „von Lehrperson angefügt": die Lehrperson fügt für eine
   * lernende Person eine Datei an und trägt optional Punkte/Level/Feedback ein.
   */
  @Post(':id/teacher-submission')
  @Roles(Role.TEACHER, Role.ADMIN)
  teacherAttach(
    @Param('id') id: string,
    @Body()
    dto: {
      enrollmentId: string;
      files?: { key: string; name: string }[];
      fileKey?: string;
      fileName?: string;
      points?: number;
      level?: AchievedLevel;
      feedback?: string;
    },
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.teacherAttach(id, user.tenantId, user.userId, user.roles, dto);
  }

  @Put(':id/fields')
  @Roles(Role.TEACHER, Role.ADMIN)
  setFields(
    @Param('id') id: string,
    @Body() dto: { fieldIds: string[] },
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.setFields(id, dto?.fieldIds ?? [], user.tenantId);
  }

  // ── Lernende: Sicht + Einreichung (FA-30/50) ──────────────────

  @Get('student/list')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  studentList(@CurrentUser() user: RequestContext) {
    return this.evidence.listForStudent(user.tenantId, user.userId);
  }

  @Get('student/:id')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  studentGet(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.evidence.getForStudent(id, user.tenantId, user.userId);
  }

  /** Presigned-URL für direkten Datei-/Screenshot-Upload anfordern. */
  @Post(':id/upload-url')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  requestUpload(
    @Param('id') id: string,
    @Body()
    dto: {
      fileName: string;
      contentType: string;
      sizeBytes: number;
      kind?: 'file' | 'screenshot' | 'screencast';
    },
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.requestUpload(
      id,
      user.tenantId,
      user.userId,
      dto?.fileName ?? 'datei',
      dto?.contentType ?? 'application/octet-stream',
      Number(dto?.sizeBytes ?? 0),
      dto?.kind === 'screenshot' || dto?.kind === 'screencast' ? dto.kind : 'file',
    );
  }

  /** Zentrale Einreichung: Text + Link + Dateien/Screenshots zusammen. */
  @Post(':id/submit')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  submit(
    @Param('id') id: string,
    @Body()
    dto: {
      text?: string;
      link?: string;
      files?: { key: string; name: string; kind: 'file' | 'screenshot' | 'screencast' }[];
    },
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.submit(id, user.tenantId, user.userId, dto);
  }

  /** Datei-Upload bestätigen → Einreichung. */
  @Post(':id/upload-confirm')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  confirmUpload(
    @Param('id') id: string,
    @Body() dto: { key: string; fileName: string },
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.confirmUpload(id, user.tenantId, user.userId, dto?.key, dto?.fileName);
  }

  /** Link- oder Text-Beleg einreichen. */
  @Post(':id/submissions')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  submitContent(
    @Param('id') id: string,
    @Body() dto: { text?: string; link?: string },
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.submitContent(id, user.tenantId, user.userId, {
      text: dto?.text,
      link: dto?.link,
    });
  }
}
