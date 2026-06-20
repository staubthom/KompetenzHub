import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';

/** Nutzlast unseres API-JWT (HS256). */
export interface JwtPayload {
  sub: string; // userId
  tid: string; // tenantId
  roles: Role[];
  locale: string;
  iat: number;
  exp: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlJson(obj: unknown): string {
  return base64url(JSON.stringify(obj));
}

function fromBase64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/**
 * Schlanker, abhängigkeitsfreier JWT-Dienst (HS256).
 * Für MVP/Dev ausreichend; bei Bedarf später durch @nestjs/jwt ersetzbar.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly secret = process.env.JWT_SIGNING_KEY ?? 'dev-insecure-signing-key-change-me';
  private readonly ttlSeconds = Number(process.env.JWT_TTL_SECONDS ?? 15 * 60);

  constructor() {
    if (this.secret === 'dev-insecure-signing-key-change-me') {
      this.logger.warn('JWT_SIGNING_KEY nicht gesetzt – verwende unsicheren Dev-Schluessel.');
    }
  }

  sign(claims: { userId: string; tenantId: string; roles: Role[]; locale: string }): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: claims.userId,
      tid: claims.tenantId,
      roles: claims.roles,
      locale: claims.locale,
      iat: now,
      exp: now + this.ttlSeconds,
    };
    const head = base64urlJson(header);
    const body = base64urlJson(payload);
    const sig = this.signature(`${head}.${body}`);
    return `${head}.${body}.${sig}`;
  }

  /** Verifiziert Signatur + Ablauf und liefert die Payload oder null. */
  verify(token: string): JwtPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [head, body, sig] = parts;

    const expected = this.signature(`${head}.${body}`);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    try {
      const payload = JSON.parse(fromBase64url(body).toString('utf8')) as JwtPayload;
      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.exp !== 'number' || payload.exp < now) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private signature(data: string): string {
    return base64url(createHmac('sha256', this.secret).update(data).digest());
  }
}
