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
import { MatrixIoService } from './matrix-io.service';

@Controller()
export class MatrixIoController {
  constructor(private readonly io: MatrixIoService) {}

  // ── FA-100: Matrix-Export/-Import (ZIP) ───────────────────────

  /** Matrix als ZIP exportieren (matrix.json + assets/, ohne personenbezogene Daten). */
  @Get('matrices/:id/export')
  @Roles(Role.TEACHER, Role.ADMIN)
  async export(@Param('id') id: string, @CurrentUser() user: RequestContext, @Res() res: Response) {
    const { buffer, filename } = await this.io.exportZip(id, user.tenantId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  /** ZIP-Paket importieren → erzeugt ein neues Modul samt Matrix und Assets. */
  @Post('matrices/import')
  @HttpCode(201)
  @Roles(Role.TEACHER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  import(
    @UploadedFile() file: { buffer?: Buffer } | undefined,
    @CurrentUser() user: RequestContext,
  ) {
    if (!file?.buffer) throw new BadRequestException('Keine Datei hochgeladen (Feld „file").');
    return this.io.importZip(user.tenantId, user.userId, file.buffer);
  }
}
