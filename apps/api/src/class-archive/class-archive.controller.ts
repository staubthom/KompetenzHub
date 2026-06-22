import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { ClassArchiveService } from './class-archive.service';

@Controller('classes')
export class ClassArchiveController {
  constructor(private readonly archive: ClassArchiveService) {}

  // ── FA-103: Modulanlass-Archiv (ZIP, inkl. Lernenden-Daten) ───

  /** Modulanlass als ZIP exportieren (alle Abgaben, Bewertungen, Dateien). */
  @Get(':id/archive-export')
  @Roles(Role.TEACHER, Role.ADMIN)
  async export(@Param('id') id: string, @CurrentUser() user: RequestContext, @Res() res: Response) {
    const { buffer, filename } = await this.archive.exportZip(
      id,
      user.tenantId,
      user.userId,
      user.roles,
    );
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  /** Modulanlass-Archiv importieren → read-only (archivierter) Modulanlass. */
  @Post('archive-import')
  @HttpCode(201)
  @Roles(Role.TEACHER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  import(
    @UploadedFile() file: { buffer?: Buffer } | undefined,
    @CurrentUser() user: RequestContext,
  ) {
    if (!file?.buffer) throw new BadRequestException('Keine Datei hochgeladen (Feld „file").');
    return this.archive.importZip(user.tenantId, user.userId, file.buffer);
  }
}
