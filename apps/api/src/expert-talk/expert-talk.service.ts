import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

/**
 * FA-80: KI-Fachgespräch im Übungsmodus. Die/der Lernende führt einen Dialog mit
 * einem wohlwollenden KI-Tutor zu einem Kompetenzthema. Keine Note – nur Übung;
 * der Verlauf wird gespeichert und ist einsehbar.
 */
@Injectable()
export class ExpertTalkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  private systemPrompt(topic: string, context: string, mode = 'topic'): string {
    const base =
      'Du bist ein wohlwollender, geduldiger KI-Tutor an einer Schweizer Berufsfachschule. ' +
      'Es gibt KEINE Note – es ist reine Übung. Schreibe auf Deutsch und fasse dich kurz (2–4 Sätze). ' +
      'Stelle jeweils genau EINE Frage.';

    if (mode === 'module') {
      const ctx = context.trim()
        ? ' Die folgenden Kompetenzen des Moduls bilden deinen inhaltlichen Rahmen:\n' +
          context.trim()
        : '';
      return (
        base +
        ` Du führst ein Lerngespräch zum gesamten Modul „${topic}" und prüfst die lernende Person ` +
        'abwechslungsweise zu den verschiedenen Themen/Kompetenzen ab.' +
        ctx +
        ' Gib zu jeder Antwort kurzes Feedback zur Qualität (was war gut, was fehlt) UND einen ' +
        'konkreten Lernhinweis, wie die Person das Thema vertiefen/lernen kann. Wechsle die Themen, ' +
        'damit nach und nach das ganze Modul abgedeckt wird.'
      );
    }

    const ctx = context.trim()
      ? ' Die zugehörige Aufgabenstellung des Kompetenznachweises lautet: ' +
        `„${context.trim()}". Richte deine Fragen konsequent an dieser Aufgabenstellung aus.`
      : '';
    return (
      base +
      ` Du führst ein ÜBUNGS-Fachgespräch zum Thema „${topic}".` +
      ctx +
      ' Gib kurzes, konstruktives Feedback zur vorigen Antwort und vertiefe schrittweise.'
    );
  }

  async createSession(tenantId: string, userId: string, topicRaw: string, contextRaw = '') {
    const topic = (topicRaw ?? '').trim();
    if (!topic) throw new UnprocessableEntityException('Bitte ein Thema angeben.');
    if (topic.length > 200)
      throw new UnprocessableEntityException('Thema ist zu lang (max. 200 Zeichen).');

    // Aufgabenstellung (HTML) → Klartext, begrenzt auf eine vernünftige Länge.
    const context = this.stripHtml(contextRaw ?? '').slice(0, 4000);

    const session = await this.prisma.expertTalkSession.create({
      data: { tenantId, userId, topic, context },
    });

    const stub =
      `Hallo! Wir üben das Fachgespräch zum Thema „${topic}". ` +
      'Keine Sorge – das ist nur eine Übung. Erste Frage: Was verstehst du grundlegend unter diesem Thema, ' +
      'und kannst du ein konkretes Beispiel aus der Praxis nennen?';

    const reply = await this.ai.tenantChat(
      tenantId,
      userId,
      [
        { role: 'system', content: this.systemPrompt(topic, context) },
        {
          role: 'user',
          content: `Starte das Übungs-Fachgespräch mit einer ersten, einladenden Frage – ausgerichtet an der Aufgabenstellung.`,
        },
      ],
      stub,
    );

    await this.prisma.expertTalkMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: reply },
    });

    return this.getSession(tenantId, userId, session.id);
  }

  /**
   * Modul-weites Lerngespräch: Kontext = alle Kompetenzen (Deskriptoren) der Matrix.
   * Die KI prüft verschiedene Themen ab, gibt Lernhinweise und Qualitäts-Feedback.
   */
  async createModuleSession(tenantId: string, userId: string, moduleId: string) {
    const module = await this.prisma.module.findFirst({
      where: { id: moduleId, tenantId },
      select: { number: true, title: true },
    });
    if (!module) throw new NotFoundException('Modul nicht gefunden.');

    const matrix = await this.prisma.competenceMatrix.findUnique({
      where: { moduleId },
      include: {
        bands: {
          orderBy: { sortOrder: 'asc' },
          include: {
            fields: { orderBy: { level: 'asc' }, include: { descriptor: true } },
          },
        },
      },
    });

    // Kontext aus allen Kompetenzen/Deskriptoren der Matrix zusammensetzen.
    const lines: string[] = [];
    for (const band of matrix?.bands ?? []) {
      for (const f of band.fields) {
        const desc = this.de((f.descriptor?.text as Record<string, string> | undefined) ?? {});
        if (desc) lines.push(`- ${f.code}: ${desc}`);
      }
    }
    const context = lines.join('\n').slice(0, 6000);
    if (!context) {
      throw new UnprocessableEntityException(
        'Für dieses Modul sind noch keine Kompetenzen erfasst.',
      );
    }

    const title = module.title as Record<string, string>;
    const topic = `Modul ${module.number} – ${this.de(title)}`.slice(0, 200);

    const session = await this.prisma.expertTalkSession.create({
      data: { tenantId, userId, topic, context, mode: 'module' },
    });

    const stub =
      `Hallo! Wir üben gemeinsam das ganze Modul „${topic}". Ich stelle dir Fragen zu ` +
      'verschiedenen Kompetenzen, gebe dir Feedback und Lerntipps. Erste Frage: Erkläre mit eigenen ' +
      'Worten eine der Kompetenzen, die du dir am wenigsten zutraust – wir vertiefen sie gemeinsam.';

    const reply = await this.ai.tenantChat(
      tenantId,
      userId,
      [
        { role: 'system', content: this.systemPrompt(topic, context, 'module') },
        {
          role: 'user',
          content:
            'Starte das modulweite Lerngespräch mit einer ersten, einladenden Frage zu einer der Kompetenzen.',
        },
      ],
      stub,
    );

    await this.prisma.expertTalkMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: reply },
    });

    return this.getSession(tenantId, userId, session.id);
  }

  async postMessage(tenantId: string, userId: string, sessionId: string, contentRaw: string) {
    const content = (contentRaw ?? '').trim();
    if (!content) throw new UnprocessableEntityException('Bitte eine Antwort eingeben.');

    const session = await this.loadOwned(tenantId, userId, sessionId);
    if (session.status !== 'ACTIVE') {
      throw new UnprocessableEntityException('Dieses Gespräch ist abgeschlossen.');
    }

    await this.prisma.expertTalkMessage.create({
      data: { sessionId, role: 'user', content },
    });

    const history = await this.prisma.expertTalkMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: this.systemPrompt(session.topic, session.context, session.mode) },
      ...history.map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      })),
    ];

    const stub =
      'Danke für deine Antwort – das ist ein guter Ansatz. ' +
      'Kannst du das noch etwas vertiefen und begründen, warum das in der Praxis wichtig ist?';

    const reply = await this.ai.tenantChat(tenantId, userId, messages, stub);

    const assistantMsg = await this.prisma.expertTalkMessage.create({
      data: { sessionId, role: 'assistant', content: reply },
    });
    await this.prisma.expertTalkSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return {
      id: assistantMsg.id,
      role: 'assistant',
      content: reply,
      createdAt: assistantMsg.createdAt,
    };
  }

  async complete(tenantId: string, userId: string, sessionId: string) {
    await this.loadOwned(tenantId, userId, sessionId);
    await this.prisma.expertTalkSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' },
    });
    return this.getSession(tenantId, userId, sessionId);
  }

  /** Ob für diese:n Lernende:n eine KI nutzbar ist (eigene oder freigegebene Lehrer-KI). */
  async available(tenantId: string, userId: string) {
    return { available: await this.ai.hasAiForUser(tenantId, userId) };
  }

  async listSessions(tenantId: string, userId: string) {
    const sessions = await this.prisma.expertTalkSession.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
    return sessions.map((s) => ({
      id: s.id,
      topic: s.topic,
      mode: s.mode,
      status: s.status,
      messageCount: s._count.messages,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async getSession(tenantId: string, userId: string, sessionId: string) {
    const session = await this.loadOwned(tenantId, userId, sessionId);
    const messages = await this.prisma.expertTalkMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      id: session.id,
      topic: session.topic,
      mode: session.mode,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  private de(json: unknown): string {
    if (json && typeof json === 'object') {
      const rec = json as Record<string, unknown>;
      const v = rec.de ?? Object.values(rec)[0];
      return typeof v === 'string' ? v : '';
    }
    return typeof json === 'string' ? json : '';
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async loadOwned(tenantId: string, userId: string, sessionId: string) {
    const session = await this.prisma.expertTalkSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException('Fachgespräch nicht gefunden.');
    if (session.userId !== userId)
      throw new ForbiddenException('Kein Zugriff auf dieses Gespräch.');
    return session;
  }
}
