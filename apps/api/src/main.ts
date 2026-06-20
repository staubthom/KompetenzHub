import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

// Root-.env des Monorepos laden (eine Quelle der Wahrheit für alle Apps)
loadEnv({ path: join(__dirname, '..', '..', '..', '.env') });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Einheitliches API-Prefix (REST unter /api/v1)
  app.setGlobalPrefix('api/v1');

  // CORS für die lokale Next.js-App erlauben
  app.enableCors({
    origin: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
  });

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  Logger.log(`KompetenzHub API laeuft auf http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
