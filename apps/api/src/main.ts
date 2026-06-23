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

  // CORS für die lokale Next.js-App erlauben (Cookies durchlassen)
  app.enableCors({
    origin: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  Logger.log(`KompetenzHub API laeuft auf http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
