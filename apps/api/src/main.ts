import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { ProblemExceptionFilter } from './common/problem.filter';

// Root-.env des Monorepos laden (eine Quelle der Wahrheit für alle Apps)
loadEnv({ path: join(__dirname, '..', '..', '..', '.env') });

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
  const app = await NestFactory.create(AppModule);

  // Einheitliches API-Prefix (REST unter /api/v1)
  app.setGlobalPrefix('api/v1');

  // Cookies parsen (für httpOnly-JWT-Cookie)
  app.use(cookieParser);

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
