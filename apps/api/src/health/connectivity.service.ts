import { Injectable } from '@nestjs/common';
import { Socket } from 'node:net';

/**
 * Leichte TCP-Erreichbarkeitsprüfung für Infrastruktur-Dienste
 * (Redis, MinIO/S3) ohne zusätzliche Runtime-Dependencies.
 * Für den Health-Check genügt der Verbindungsaufbau zum Port.
 */
@Injectable()
export class ConnectivityService {
  /** Prüft, ob ein TCP-Port erreichbar ist. */
  private checkTcp(host: string, port: number, timeoutMs = 1000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();
      const done = (ok: boolean): void => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
      socket.connect(port, host);
    });
  }

  /** Hostname/Port aus einer URL (z. B. redis://host:6379, http://host:9000). */
  private parseHostPort(rawUrl: string, fallbackPort: number): { host: string; port: number } {
    try {
      const url = new URL(rawUrl);
      return {
        host: url.hostname || 'localhost',
        port: url.port ? Number(url.port) : fallbackPort,
      };
    } catch {
      return { host: 'localhost', port: fallbackPort };
    }
  }

  async isRedisReachable(): Promise<boolean> {
    const { host, port } = this.parseHostPort(
      process.env.REDIS_URL ?? `redis://localhost:${process.env.REDIS_PORT ?? '6379'}`,
      6379,
    );
    return this.checkTcp(host, port);
  }

  async isS3Reachable(): Promise<boolean> {
    const { host, port } = this.parseHostPort(
      process.env.S3_ENDPOINT ?? `http://localhost:${process.env.MINIO_PORT ?? '9000'}`,
      9000,
    );
    return this.checkTcp(host, port);
  }
}
