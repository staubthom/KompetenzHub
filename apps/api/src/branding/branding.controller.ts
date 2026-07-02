import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';

/**
 * Lese-Endpunkt für das Schul-Branding (Logo, Anzeigename), den die Kopfzeile
 * für ALLE angemeldeten Rollen benötigt. Schreiben erfolgt über /admin/settings.
 */
@Controller('branding')
export class BrandingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  async get(
    @CurrentUser() user: RequestContext,
  ): Promise<{ logoUrl: string | null; displayName: string | null; primaryColor: string | null }> {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId: user.tenantId },
    });
    return {
      // Logo liegt privat im Bucket → für die Anzeige kurzlebig presignen.
      logoUrl: await this.s3.presignUrlForRead(branding?.logoLightKey),
      displayName: branding?.displayName ?? null,
      primaryColor: branding?.primaryColor ?? null,
    };
  }
}
