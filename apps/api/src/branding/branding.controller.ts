import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lese-Endpunkt für das Schul-Branding (Logo, Anzeigename), den die Kopfzeile
 * für ALLE angemeldeten Rollen benötigt. Schreiben erfolgt über /admin/settings.
 */
@Controller('branding')
export class BrandingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(
    @CurrentUser() user: RequestContext,
  ): Promise<{ logoUrl: string | null; displayName: string | null }> {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId: user.tenantId },
    });
    return {
      logoUrl: branding?.logoLightKey ?? null,
      displayName: branding?.displayName ?? null,
    };
  }
}
