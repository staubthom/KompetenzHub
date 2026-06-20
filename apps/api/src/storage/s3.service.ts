import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

/** Präfix für öffentlich lesbare Rich-Text-Bilder. */
const PUBLIC_PREFIX = 'rte';

/**
 * S3-/MinIO-Anbindung für presigned Uploads/Downloads.
 * Dateien gehen direkt vom Client an den Objektspeicher – nie über die API.
 */
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucket = process.env.S3_BUCKET ?? 'kompetenzhub';
  private readonly endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
  private readonly client = new S3Client({
    region: 'us-east-1',
    endpoint: this.endpoint,
    forcePathStyle: true, // notwendig für MinIO
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    },
  });

  async onModuleInit(): Promise<void> {
    // Bucket beim Start sicherstellen (idempotent), Fehler nicht fatal.
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket "${this.bucket}" angelegt.`);
      } catch (error) {
        this.logger.warn(`Bucket konnte nicht angelegt werden: ${String(error)}`);
      }
    }
    // Öffentlicher Lesezugriff nur für Rich-Text-Bilder (rte/*); Belege bleiben privat.
    try {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadRteImages',
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/${PUBLIC_PREFIX}/*`],
          },
        ],
      };
      await this.client.send(
        new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: JSON.stringify(policy) }),
      );
    } catch (error) {
      this.logger.warn(`Bucket-Policy konnte nicht gesetzt werden: ${String(error)}`);
    }
  }

  /** Erzeugt einen eindeutigen Objekt-Key unter einem Präfix. */
  buildKey(prefix: string, fileName: string): string {
    const safe = fileName.replace(/[^\w.-]/g, '_');
    return `${prefix}/${randomUUID()}-${safe}`;
  }

  /** Presigned PUT-URL für den direkten Upload durch den Client. */
  async presignUpload(key: string, contentType: string, expiresIn = 900): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }

  /** Presigned GET-URL zum Herunterladen/Ansehen. */
  async presignDownload(key: string, expiresIn = 900): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }

  /** Key-Präfix für öffentlich lesbare Rich-Text-Bilder. */
  get publicPrefix(): string {
    return PUBLIC_PREFIX;
  }

  /** Stabile, öffentlich lesbare URL (nur für rte/*-Objekte gültig). */
  publicUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }
}
