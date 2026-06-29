import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Zentraler E-Mail-Versand über SMTP (Nodemailer).
 *
 * Bewusst robust: ist keine SMTP-Konfiguration gesetzt (z. B. in Tests,
 * CI oder lokaler Entwicklung ohne Mailserver), wird der Versand still
 * übersprungen und nur protokolliert – nie geworfen. Aufrufer müssen den
 * Versand nicht in try/catch kapseln; Fehler werden hier geschluckt, damit
 * fachliche Aktionen (Einladung, Bewertung) nie an der Mail scheitern.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST?.trim();
    this.from = process.env.MAIL_FROM?.trim() || 'KompetenzHub <no-reply@kompetenzhub.local>';

    if (!host) {
      this.logger.warn('SMTP_HOST nicht gesetzt – E-Mail-Versand ist deaktiviert (No-op).');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      // SMTP_SECURE=true → implizites TLS (Port 465); sonst STARTTLS (Port 587).
      secure: String(process.env.SMTP_SECURE ?? '').toLowerCase() === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
        : undefined,
    });
    this.logger.log(`E-Mail-Versand aktiv über SMTP-Host ${host}.`);
  }

  /** True, wenn ein SMTP-Transport konfiguriert ist. */
  get enabled(): boolean {
    return this.transporter !== null;
  }

  /**
   * Versendet eine E-Mail. Schlägt der Versand fehl (oder ist SMTP nicht
   * konfiguriert), wird `false` zurückgegeben – ohne zu werfen.
   */
  async send(input: SendMailInput): Promise<boolean> {
    if (!this.transporter) {
      this.logger.debug(`Mail (No-op) an ${input.to}: "${input.subject}"`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return true;
    } catch (err) {
      this.logger.error(`Mail-Versand an ${input.to} fehlgeschlagen: ${String(err)}`);
      return false;
    }
  }
}
