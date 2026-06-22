import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { MatrixIoService } from './matrix-io.service';

@Controller()
export class MatrixIoController {
  constructor(private readonly io: MatrixIoService) {}

  // ── FA-100: Matrix-Export/-Import (JSON) ──────────────────────

  /** Matrix als JSON exportieren (ohne personenbezogene Daten). */
  @Get('matrices/:id/export')
  @Roles(Role.TEACHER, Role.ADMIN)
  export(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.io.exportMatrix(id, user.tenantId);
  }

  /** Matrix-Export importieren → erzeugt ein neues Modul samt Matrix. */
  @Post('matrices/import')
  @HttpCode(201)
  @Roles(Role.TEACHER, Role.ADMIN)
  import(@Body() body: unknown, @CurrentUser() user: RequestContext) {
    return this.io.importMatrix(user.tenantId, user.userId, body);
  }
}
