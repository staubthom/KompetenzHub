import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators';
import type { RequestContext } from '../common/request-context';
import { S3Service } from './s3.service';
import { StorageObjectsService } from './storage-objects.service';

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
const MAX_IMAGE_MB = 8;

/**
 * Upload-Endpunkte für Rich-Text-Assets (Bilder).
 * Liefert eine presigned PUT-URL + die stabile, öffentlich lesbare Bild-URL
 * (Objekte landen unter dem öffentlichen rte/-Präfix).
 */
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly s3: S3Service,
    private readonly storageObjects: StorageObjectsService,
  ) {}

  @Post('image-upload-url')
  @Roles(Role.TEACHER, Role.ADMIN)
  async imageUploadUrl(
    @Body() dto: { fileName: string; contentType: string; sizeBytes?: number },
    @CurrentUser() user: RequestContext,
  ): Promise<{ uploadUrl: string; canonicalUrl: string; viewUrl: string }> {
    const fileName = dto?.fileName ?? 'bild';
    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
    if (!IMAGE_TYPES.includes(ext)) {
      throw new BadRequestException(`Nur Bilddateien erlaubt (${IMAGE_TYPES.join(', ')}).`);
    }
    if (dto?.sizeBytes && dto.sizeBytes > MAX_IMAGE_MB * 1024 * 1024) {
      throw new BadRequestException(`Bild zu gross (max. ${MAX_IMAGE_MB} MB).`);
    }
    const key = this.s3.tenantKey(user.tenantId, this.s3.publicPrefix, fileName);
    const uploadUrl = await this.s3.presignUpload(key, dto?.contentType || 'image/png');
    await this.storageObjects.record({
      tenantId: user.tenantId,
      key,
      sizeBytes: dto?.sizeBytes ?? 0,
      kind: 'rte',
      uploaderId: user.userId,
    });
    // canonicalUrl: stabile Form für die Speicherung (wird beim Lesen presigned).
    // viewUrl: kurzlebige presigned URL für die sofortige Vorschau im Editor.
    return {
      uploadUrl,
      canonicalUrl: this.s3.publicUrl(key),
      viewUrl: await this.s3.presignDownload(key),
    };
  }

  /** Presigned PUT für einen Lehrer-Anhang am Nachweis (privat). */
  @Post('attachment-upload-url')
  @Roles(Role.TEACHER, Role.ADMIN)
  async attachmentUploadUrl(
    @Body() dto: { fileName: string; contentType: string; sizeBytes?: number },
    @CurrentUser() user: RequestContext,
  ): Promise<{ uploadUrl: string; key: string }> {
    const fileName = dto?.fileName ?? 'anhang';
    const key = this.s3.tenantKey(user.tenantId, 'attachments', fileName);
    const uploadUrl = await this.s3.presignUpload(
      key,
      dto?.contentType || 'application/octet-stream',
    );
    await this.storageObjects.record({
      tenantId: user.tenantId,
      key,
      sizeBytes: dto?.sizeBytes ?? 0,
      kind: 'attachment',
      uploaderId: user.userId,
    });
    return { uploadUrl, key };
  }
}
