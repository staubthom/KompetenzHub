import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  DeleteBucketPolicyCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

/** Präfix für öffentlich lesbare Rich-Text-Bilder. */
const PUBLIC_PREFIX = 'rte';

/** Oberster Namespace für mandanten-scoped Objekte: t/<tenantId>/… */
const TENANT_PREFIX = 't';

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
    // Bucket vollständig privat: KEIN öffentlicher Lesezugriff mehr. Auch
    // Rich-Text-Bilder werden nur noch über kurzlebige, mandanten-geprüfte
    // presigned URLs ausgeliefert (siehe presignHtmlForRead). Eine evtl. früher
    // gesetzte Public-Read-Policy wird entfernt.
    try {
      await this.client.send(new DeleteBucketPolicyCommand({ Bucket: this.bucket }));
    } catch {
      /* Keine Policy vorhanden → bereits privat. */
    }
  }

  /** Erzeugt einen eindeutigen Objekt-Key unter einem Präfix. */
  buildKey(prefix: string, fileName: string): string {
    const safe = fileName.replace(/[^\w.-]/g, '_');
    return `${prefix}/${randomUUID()}-${safe}`;
  }

  /**
   * Objekt-Key unter dem mandanten-scoped Namespace: t/<tenantId>/<category>/uuid-datei.
   * `category` darf Unterpfade enthalten (z. B. `evidence/<evidenceId>`). Damit lassen
   * sich Speicherverbrauch/Cleanup/Export pro Schule über ein einziges Präfix abbilden.
   */
  tenantKey(tenantId: string, category: string, fileName: string): string {
    return this.buildKey(`${TENANT_PREFIX}/${tenantId}/${category}`, fileName);
  }

  /** Präfix aller Objekte eines Mandanten (für Verbrauch/Cleanup/Export). */
  tenantPrefix(tenantId: string): string {
    return `${TENANT_PREFIX}/${tenantId}/`;
  }

  /**
   * Presigned PUT-URL für den direkten Upload durch den Client. Wird
   * `contentLength` gesetzt, ist die Objektgrösse Teil der Signatur: S3/MinIO
   * lehnt dann jeden Upload ab, dessen `Content-Length` abweicht. So kann der
   * Client die serverseitige Quota-Prüfung nicht durch Unterschätzen der Grösse
   * umgehen (die geprüfte Grösse == die tatsächlich geschriebene Grösse).
   */
  async presignUpload(
    key: string,
    contentType: string,
    opts: { expiresIn?: number; contentLength?: number } = {},
  ): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength:
        opts.contentLength != null && Number.isFinite(opts.contentLength)
          ? Math.max(0, Math.trunc(opts.contentLength))
          : undefined,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: opts.expiresIn ?? 900 });
  }

  /**
   * Presigned GET-URL zum Herunterladen/Ansehen.
   *
   * SVG-Sicherheit: SVG-Dateien können eingebettetes JavaScript enthalten und
   * würden im Browser inline gerendert (potenzielles Stored-XSS, falls der
   * Objektspeicher je unter derselben Origin wie die App ausgeliefert wird).
   * Für .svg erzwingen wir daher `Content-Disposition: attachment` und einen
   * neutralen Content-Type – der Browser lädt die Datei herunter statt sie
   * auszuführen/darzustellen. Dies ist der zentrale Ausgabepunkt (auch
   * presignHtmlForRead nutzt ihn), greift also überall.
   */
  async presignDownload(key: string, expiresIn = 900): Promise<string> {
    const isSvg = /\.svg$/i.test(key);
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(isSvg
        ? {
            ResponseContentDisposition: 'attachment',
            ResponseContentType: 'application/octet-stream',
          }
        : {}),
    });
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

  /** Interne Endpoint-Basis (falls presign-URLs auf den internen Host zeigen). */
  private get endpointBaseUrl(): string {
    return `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/`;
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Ersetzt in einem i18n-HTML-Feld gespeicherte (kanonische) Objekt-URLs des
   * eigenen Buckets durch kurzlebige presigned Download-URLs. So bleiben Bilder
   * privat und sind nur für berechtigte, angemeldete Nutzer (kurzzeitig) abrufbar.
   */
  async presignHtmlForRead(json: unknown): Promise<unknown> {
    if (!json || typeof json !== 'object') return json;
    const base = this.bucketBaseUrl;
    const re = new RegExp(this.escapeRegex(base) + `[^"'\\s>?]+`, 'g');
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      if (typeof v !== 'string') {
        out[k] = v;
        continue;
      }
      let html = v;
      for (const url of Array.from(new Set(html.match(re) ?? []))) {
        const key = url.slice(base.length);
        const signed = await this.presignDownload(key);
        html = html.split(url).join(signed);
      }
      out[k] = html;
    }
    return out;
  }

  /** Presigned Download-URL für eine gespeicherte (kanonische) Objekt-URL; externe URLs unverändert. */
  async presignUrlForRead(url: string | null | undefined): Promise<string | null> {
    if (!url) return url ?? null;
    if (!url.startsWith(this.bucketBaseUrl)) return url;
    const key = url.slice(this.bucketBaseUrl.length).split('?')[0];
    return this.presignDownload(key);
  }

  /**
   * Normalisiert i18n-HTML vor dem Speichern: macht Objekt-URLs des eigenen
   * Buckets wieder kanonisch (öffentliche Basis, ohne Presign-Query), damit nie
   * eine ablaufende presigned URL persistiert wird.
   */
  normalizeHtmlForWrite(json: unknown): unknown {
    if (!json || typeof json !== 'object') return json;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      out[k] = typeof v === 'string' ? this.canonicalize(v) : v;
    }
    return out;
  }

  /** Kanonisiert eine einzelne (evtl. presigned) Objekt-URL für die Speicherung. */
  normalizeUrlForWrite(url: string | null | undefined): string | null {
    if (!url) return url ?? null;
    for (const base of [this.bucketBaseUrl, this.endpointBaseUrl]) {
      if (url.startsWith(base))
        return `${this.bucketBaseUrl}${url.slice(base.length).split('?')[0]}`;
    }
    return url;
  }

  private canonicalize(html: string): string {
    let out = html;
    for (const base of [this.bucketBaseUrl, this.endpointBaseUrl]) {
      const re = new RegExp(this.escapeRegex(base) + `([^"'\\s>?]+)(\\?[^"'\\s>]*)?`, 'g');
      out = out.replace(re, (_m, key: string) => `${this.bucketBaseUrl}${key}`);
    }
    return out;
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

  /** Objekte unter einem Präfix inkl. Grösse und Änderungsdatum (für GC/Reconcile). */
  async listObjects(prefix?: string): Promise<{ key: string; size: number; lastModified: Date }[]> {
    const out: { key: string; size: number; lastModified: Date }[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const o of res.Contents ?? []) {
        if (o.Key) {
          out.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified ?? new Date(0) });
        }
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
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

  /**
   * Gesamtgrösse der Objekte in Bytes – für Speicher-Auslastung. Ohne Präfix über
   * den ganzen Bucket, mit Präfix z. B. pro Mandant (`tenantPrefix(tenantId)`).
   */
  async totalSize(prefix?: string): Promise<number> {
    let total = 0;
    let token: string | undefined;
    do {
      const out = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const obj of out.Contents ?? []) total += obj.Size ?? 0;
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);
    return total;
  }
}
