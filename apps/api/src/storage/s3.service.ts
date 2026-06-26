import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
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
  // Browser-erreichbare Basis-URL für öffentliche Objekte (Logo, RTE-Bilder).
  // Im Container ist S3_ENDPOINT intern (z. B. http://minio:9000); für den Browser
  // wird S3_PUBLIC_URL verwendet (z. B. http://localhost:9000 oder die Domain).
  private readonly publicBase = (
    process.env.S3_PUBLIC_URL ??
    process.env.S3_ENDPOINT ??
    'http://localhost:9000'
  ).replace(/\/$/, '');
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
    return `${this.publicBase}/${this.bucket}/${key}`;
  }

  /** Basis-URL des Buckets (für das Erkennen eigener Objekt-URLs; passt zu publicUrl). */
  get bucketBaseUrl(): string {
    return `${this.publicBase}/${this.bucket}/`;
  }

  /** Lädt ein Objekt vollständig als Buffer (für Export/Archivierung). */
  async getBytes(key: string): Promise<Buffer> {
    const obj = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = obj.Body as { transformToByteArray: () => Promise<Uint8Array> };
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  /** Lädt einen Buffer direkt hoch (serverseitig, z. B. beim Import). */
  async putBytes(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  /** Alle Objekt-Keys unter einem Präfix (paginiert) – z. B. für Plugin-Cleanup. */
  async listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const out = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const obj of out.Contents ?? []) if (obj.Key) keys.push(obj.Key);
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }

  /** Löscht ein einzelnes Objekt. */
  async deleteKey(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Löscht alle Objekte unter einem Präfix; liefert die Anzahl gelöschter Objekte. */
  async deletePrefix(prefix: string): Promise<number> {
    const keys = await this.listKeys(prefix);
    for (const key of keys) await this.deleteKey(key);
    return keys.length;
  }

  /** Alle Objekt-Keys des Buckets (paginiert) – für Voll-Backup. */
  async listAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const out = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, ContinuationToken: token }),
      );
      for (const obj of out.Contents ?? []) if (obj.Key) keys.push(obj.Key);
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }

  /** Gesamtgrösse aller Objekte in Bytes – für Speicher-Auslastung. */
  async totalSize(): Promise<number> {
    let total = 0;
    let token: string | undefined;
    do {
      const out = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, ContinuationToken: token }),
      );
      for (const obj of out.Contents ?? []) total += obj.Size ?? 0;
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);
    return total;
  }
}
