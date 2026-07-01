import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { ProblemExceptionFilter } from './common/problem.filter';
import { requestContextStore } from './common/request-context';

// Root-.env des Monorepos laden (eine Quelle der Wahrheit für alle Apps)
loadEnv({ path: join(__dirname, '..', '..', '..', '.env') });

/**
 * Secrets-Härtung: In Produktion dürfen die unsicheren Default-Schlüssel nicht
 * verwendet werden. Der Start wird abgebrochen, statt unsicher hochzufahren.
 */
function assertSecureSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  const insecure = (v: string | undefined, marker: string): boolean => !v || v.includes(marker);
  if (insecure(process.env.JWT_SIGNING_KEY, 'dev-insecure'))
    problems.push('JWT_SIGNING_KEY ist nicht gesetzt oder unsicher.');
  if (insecure(process.env.AI_CONFIG_ENC_KEY, 'dev-insecure'))
    problems.push('AI_CONFIG_ENC_KEY ist nicht gesetzt oder unsicher.');
  if ((process.env.DEV_LOGIN_ENABLED ?? 'true') === 'true')
    problems.push('DEV_LOGIN_ENABLED muss in Produktion auf false stehen.');
  if (problems.length > 0) {
    throw new Error(
      `Unsichere Konfiguration in Produktion:\n - ${problems.join('\n - ')}\n` +
        'Bitte starke Secrets setzen (siehe docs/22-Security-Review.md).',
    );
  }
}

/**
 * Basisdomain für die CORS-Freigabe der Schul-Subdomains. Bevorzugt die explizite
 * `TENANT_BASE_DOMAIN`; ist sie leer, wird sie aus `NEXT_PUBLIC_WEB_URL` abgeleitet
 * (z. B. https://demo.kompetenzhub.ch → "kompetenzhub.ch"), sofern dabei noch
 * mindestens zwei Labels übrig bleiben (verhindert eine zu breite Freigabe wie "ch").
 */
function tenantBaseDomain(): string | undefined {
  const explicit = process.env.TENANT_BASE_DOMAIN?.trim().toLowerCase();
  if (explicit) return explicit;
  const web = process.env.NEXT_PUBLIC_WEB_URL;
  if (!web) return undefined;
  try {
    const host = new URL(web).hostname.toLowerCase();
    const dot = host.indexOf('.');
    if (dot > 0) {
      const base = host.slice(dot + 1);
      if (base.includes('.')) return base;
    }
  } catch {
    /* ungültige URL → keine Ableitung */
  }
  return undefined;
}

/**
 * CORS-Origin-Prüfung für den Multi-Tenant-Betrieb: Neben der konfigurierten
 * Web-URL (Single-Tenant/lokal) werden localhost sowie alle Subdomains der
 * Basisdomain über https erlaubt, damit jede Schule (schule.kompetenzhub.ch)
 * auf die zentrale API zugreifen darf. Zusätzlich kann eine explizite Komma-Liste
 * über `CORS_ALLOWED_ORIGINS` freigegeben werden.
 */
function isAllowedOrigin(origin: string): boolean {
  const configured = process.env.NEXT_PUBLIC_WEB_URL;
  if (configured && origin === configured) return true;

  let host: string;
  let protocol: string;
  try {
    const u = new URL(origin);
    host = u.hostname.toLowerCase();
    protocol = u.protocol;
  } catch {
    return false;
  }

  // Lokale Entwicklung.
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1') return true;

  // Multi-Tenant: jede Subdomain (und die Apex) der Basisdomain, nur über https.
  const base = tenantBaseDomain();
  if (base && protocol === 'https:' && (host === base || host.endsWith(`.${base}`))) return true;

  // Optionale, explizit erlaubte Origins.
  const extra = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.includes(origin);
}

/** Schlanker Cookie-Parser (vermeidet zusätzliche Abhängigkeit). */
function cookieParser(
  req: Request & { cookies?: Record<string, string> },
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (header) {
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx > -1) {
        const k = part.slice(0, idx).trim();
        const v = decodeURIComponent(part.slice(idx + 1).trim());
        out[k] = v;
      }
    }
  }
  req.cookies = out;
  next();
}

async function bootstrap(): Promise<void> {
  assertSecureSecrets();

  const app = await NestFactory.create(AppModule);

  // Einheitliches API-Prefix (REST unter /api/v1)
  app.setGlobalPrefix('api/v1');

  // Sichere HTTP-Header (CSP für reine JSON-API nicht nötig → deaktiviert)
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

  // Cookies parsen (für httpOnly-JWT-Cookie)
  app.use(cookieParser);

  // Pro Request einen stabilen AsyncLocalStorage-Kontext eröffnen, damit das
  // Tenant-Scoping auch über asynchrone Pipes (ValidationPipe) hinweg trägt.
  // Der JwtAuthGuard befüllt dieses Objekt anschliessend (mutierend).
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    requestContextStore.run({ userId: '', tenantId: '', roles: [], locale: 'de' }, () => next());
  });

  // Eingabevalidierung: unbekannte Felder entfernen, Typen umwandeln (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Einheitliche Fehlerantworten (RFC 7807)
  app.useGlobalFilters(new ProblemExceptionFilter());

  // CORS: konfigurierte Web-URL, localhost und alle Schul-Subdomains der
  // Basisdomain zulassen (Multi-Tenant), Cookies durchlassen.
  app.enableCors({
    origin: (origin, callback) => {
      // Kein Origin (Server-zu-Server, curl, same-origin) → zulassen.
      callback(null, !origin || isAllowedOrigin(origin));
    },
    credentials: true,
  });

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  Logger.log(`KompetenzHub API laeuft auf http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
