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
import { EvidenceType, Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { EvidenceService } from './evidence.service';

@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  // ── Lehrer (FA-30/32/36/40) ───────────────────────────────────

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

  @Put(':id/fields')
  @Roles(Role.TEACHER, Role.ADMIN)
  setFields(
    @Param('id') id: string,
    @Body() dto: { fieldIds: string[] },
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.setFields(id, dto?.fieldIds ?? [], user.tenantId);
  }

  // ── Lernende (FA-32 Quiz, FA-30 Upload) ───────────────────────

  @Get('student/list')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  studentList(
    @Query('type') type: EvidenceType | undefined,
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.listForStudent(user.tenantId, user.userId, type);
  }

  @Get('student/:id')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  studentGet(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.evidence.getForStudent(id, user.tenantId, user.userId);
  }

  @Post(':id/quiz/grade')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  gradeQuiz(
    @Param('id') id: string,
    @Body() dto: { answers: Record<string, string[]> },
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.gradeQuiz(id, user.tenantId, user.userId, dto?.answers ?? {});
  }

  @Post(':id/upload-url')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  requestUpload(
    @Param('id') id: string,
    @Body() dto: { fileName: string; contentType: string; sizeBytes: number },
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.requestUpload(
      id,
      user.tenantId,
      user.userId,
      dto?.fileName ?? 'datei',
      dto?.contentType ?? 'application/octet-stream',
      Number(dto?.sizeBytes ?? 0),
    );
  }

  @Post(':id/upload-confirm')
  @Roles(Role.LEARNER, Role.TEACHER, Role.ADMIN)
  confirmUpload(
    @Param('id') id: string,
    @Body() dto: { key: string; fileName: string },
    @CurrentUser() user: RequestContext,
  ) {
    return this.evidence.confirmUpload(id, user.tenantId, user.userId, dto?.key, dto?.fileName);
  }
}
