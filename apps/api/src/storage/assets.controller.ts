import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators';
import { S3Service } from './s3.service';

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
const MAX_IMAGE_MB = 8;

/**
 * Upload-Endpunkte für Rich-Text-Assets (Bilder).
 * Liefert eine presigned PUT-URL + die stabile, öffentlich lesbare Bild-URL
 * (Objekte landen unter dem öffentlichen rte/-Präfix).
 */
@Controller('assets')
export class AssetsController {
  constructor(private readonly s3: S3Service) {}

  @Post('image-upload-url')
  @Roles(Role.TEACHER, Role.ADMIN)
  async imageUploadUrl(
    @Body() dto: { fileName: string; contentType: string; sizeBytes?: number },
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const fileName = dto?.fileName ?? 'bild';
    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
    if (!IMAGE_TYPES.includes(ext)) {
      throw new BadRequestException(`Nur Bilddateien erlaubt (${IMAGE_TYPES.join(', ')}).`);
    }
    if (dto?.sizeBytes && dto.sizeBytes > MAX_IMAGE_MB * 1024 * 1024) {
      throw new BadRequestException(`Bild zu gross (max. ${MAX_IMAGE_MB} MB).`);
    }
    const key = this.s3.buildKey(this.s3.publicPrefix, fileName);
    const uploadUrl = await this.s3.presignUpload(key, dto?.contentType || 'image/png');
    return { uploadUrl, publicUrl: this.s3.publicUrl(key) };
  }
}
