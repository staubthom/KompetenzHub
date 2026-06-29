import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';
import { DigestService } from './digest.service';

/**
 * Global, damit jedes Modul MailService/MailTemplateService injizieren kann,
 * ohne sie erneut bereitzustellen (analog zu Prisma/Storage-Querschnitt).
 * DigestService wird exportiert, damit Admin-Endpunkte die geplanten Läufe
 * (Tages-Digest, Wochenbericht, Einladungs-Reminder) manuell auslösen können.
 */
@Global()
@Module({
  providers: [MailService, MailTemplateService, DigestService, PrismaService],
  exports: [MailService, MailTemplateService, DigestService],
})
export class MailModule {}
