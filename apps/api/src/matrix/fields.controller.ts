import { Body, Controller, Get, NotFoundException, Param, Put } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

@Controller('fields')
export class FieldsController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /fields/:id/descriptor */
  @Get(':id/descriptor')
  @Roles(Role.TEACHER, Role.ADMIN, Role.LEARNER)
  async getDescriptor(@Param('id') fieldId: string, @CurrentUser() user: RequestContext) {
    await this.assertFieldAccess(fieldId, user.tenantId);
    const descriptor = await this.prisma.descriptor.findUnique({ where: { fieldId } });
    if (!descriptor) throw new NotFoundException('Kein Deskriptor für dieses Feld.');
    return descriptor;
  }

  /**
   * PUT /fields/:id/descriptor
   * Setzt oder aktualisiert den „Ich kann…"-Text eines Kompetenzfelds (i18n).
   * Upsert: erzeugt den Deskriptor falls noch keiner existiert.
   */
  @Put(':id/descriptor')
  @Roles(Role.TEACHER, Role.ADMIN)
  async upsertDescriptor(
    @Param('id') fieldId: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: RequestContext,
  ) {
    await this.assertFieldAccess(fieldId, user.tenantId);
    const text = (dto.text ?? {}) as Prisma.InputJsonValue;

    return this.prisma.descriptor.upsert({
      where: { fieldId },
      create: { fieldId, text },
      update: { text },
    });
  }

  private async assertFieldAccess(fieldId: string, tenantId: string) {
    const field = await this.prisma.competenceField.findUnique({
      where: { id: fieldId },
      include: {
        band: {
          include: {
            matrix: { include: { module: { select: { tenantId: true } } } },
          },
        },
      },
    });
    if (!field || field.band.matrix.module.tenantId !== tenantId) {
      throw new NotFoundException('Kompetenzfeld nicht gefunden.');
    }
    return field;
  }
}
