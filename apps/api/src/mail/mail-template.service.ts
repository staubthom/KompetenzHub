import { Injectable } from '@nestjs/common';
import { Locale, MailTemplateType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ctaLabel,
  DEFAULT_TEMPLATES,
  localeKey,
  LOCALE_KEYS,
  renderTemplate,
  TEMPLATE_PLACEHOLDERS,
  TemplateText,
} from './mail.templates';

export interface ComposeInput {
  scalars: Record<string, string>;
  blocks?: Record<string, { text: string; html: string }>;
  ctaHref: string;
}

/** Eintrag für das Admin-UI: effektiver + Standard-Text, Anpassungs-Status, Platzhalter. */
export interface AdminTemplateView {
  type: MailTemplateType;
  locale: Locale;
  subject: string;
  body: string;
  defaultSubject: string;
  defaultBody: string;
  customized: boolean;
  placeholders: string[];
}

/**
 * Löst E-Mail-Vorlagen auf: pro Mandant gespeicherte Anpassungen haben Vorrang,
 * fehlende Felder fallen auf die eingebaute Standardvorlage zurück. Komponiert
 * fertige Mails (Betreff/HTML/Text) und stellt die Verwaltung fürs Admin-UI bereit.
 */
@Injectable()
export class MailTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  /** Effektive Vorlage (Anpassung über Standard) für Typ + Sprache. */
  async resolve(
    tenantId: string,
    type: MailTemplateType,
    locale: Locale | string | null | undefined,
  ): Promise<TemplateText> {
    const k = localeKey(locale);
    const def = DEFAULT_TEMPLATES[type][k];
    const custom = await this.prisma.mailTemplate.findUnique({
      where: { tenantId_type_locale: { tenantId, type, locale: k as Locale } },
    });
    return {
      subject: custom?.subject?.trim() || def.subject,
      body: custom?.body?.trim() || def.body,
    };
  }

  /** Komponiert eine versandfertige Mail (Betreff/HTML/Text). */
  async compose(
    tenantId: string,
    type: MailTemplateType,
    locale: Locale | string | null | undefined,
    input: ComposeInput,
  ): Promise<{ subject: string; html: string; text: string }> {
    const tpl = await this.resolve(tenantId, type, locale);
    return renderTemplate(tpl, {
      scalars: input.scalars,
      blocks: input.blocks,
      cta: { label: ctaLabel(type, localeKey(locale)), href: input.ctaHref },
    });
  }

  /** Alle Vorlagen (Typ × Sprache) für die Admin-Verwaltung. */
  async listForAdmin(tenantId: string): Promise<AdminTemplateView[]> {
    const customs = await this.prisma.mailTemplate.findMany({ where: { tenantId } });
    const byKey = new Map(customs.map((c) => [`${c.type}:${c.locale}`, c]));
    const out: AdminTemplateView[] = [];
    for (const type of Object.keys(DEFAULT_TEMPLATES) as MailTemplateType[]) {
      for (const k of LOCALE_KEYS) {
        const def = DEFAULT_TEMPLATES[type][k];
        const custom = byKey.get(`${type}:${k}`);
        out.push({
          type,
          locale: k as Locale,
          subject: custom?.subject?.trim() || def.subject,
          body: custom?.body?.trim() || def.body,
          defaultSubject: def.subject,
          defaultBody: def.body,
          customized: Boolean(custom?.subject?.trim() || custom?.body?.trim()),
          placeholders: TEMPLATE_PLACEHOLDERS[type],
        });
      }
    }
    return out;
  }

  /** Anpassung speichern. Leere Felder → auf Standard zurückfallen (null). */
  async upsert(
    tenantId: string,
    type: MailTemplateType,
    locale: Locale,
    data: { subject?: string | null; body?: string | null },
  ): Promise<void> {
    const subject = data.subject?.trim() ? data.subject.trim() : null;
    const body = data.body?.trim() ? data.body.trim() : null;
    if (subject === null && body === null) {
      await this.reset(tenantId, type, locale);
      return;
    }
    await this.prisma.mailTemplate.upsert({
      where: { tenantId_type_locale: { tenantId, type, locale } },
      update: { subject, body },
      create: { tenantId, type, locale, subject, body },
    });
  }

  /** Anpassung entfernen → Standardvorlage gilt wieder. */
  async reset(tenantId: string, type: MailTemplateType, locale: Locale): Promise<void> {
    await this.prisma.mailTemplate
      .delete({ where: { tenantId_type_locale: { tenantId, type, locale } } })
      .catch(() => undefined);
  }
}
