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

  private systemPrompt(topic: string): string {
    return (
      'Du bist ein wohlwollender, geduldiger KI-Tutor an einer Schweizer Berufsfachschule. ' +
      `Du führst ein ÜBUNGS-Fachgespräch zum Thema „${topic}". ` +
      'Ziel ist, dass die lernende Person ihr Fachwissen mündlich übt – es gibt KEINE Note. ' +
      'Stelle jeweils genau EINE Frage, gib kurzes, konstruktives Feedback zur vorigen Antwort, ' +
      'und vertiefe schrittweise. Bleib beim Thema, schreibe auf Deutsch und fasse dich kurz (2–4 Sätze).'
    );
  }

  async createSession(tenantId: string, userId: string, topicRaw: string) {
    const topic = (topicRaw ?? '').trim();
    if (!topic) throw new UnprocessableEntityException('Bitte ein Thema angeben.');
    if (topic.length > 200)
      throw new UnprocessableEntityException('Thema ist zu lang (max. 200 Zeichen).');

    const session = await this.prisma.expertTalkSession.create({
      data: { tenantId, userId, topic },
    });

    const stub =
      `Hallo! Wir üben das Fachgespräch zum Thema „${topic}". ` +
      'Keine Sorge – das ist nur eine Übung. Erste Frage: Was verstehst du grundlegend unter diesem Thema, ' +
      'und kannst du ein konkretes Beispiel aus der Praxis nennen?';

    const reply = await this.ai.tenantChat(
      tenantId,
      [
        { role: 'system', content: this.systemPrompt(topic) },
        {
          role: 'user',
          content: `Starte das Übungs-Fachgespräch zum Thema „${topic}" mit einer ersten, einladenden Frage.`,
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
      { role: 'system', content: this.systemPrompt(session.topic) },
      ...history.map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      })),
    ];

    const stub =
      'Danke für deine Antwort – das ist ein guter Ansatz. ' +
      'Kannst du das noch etwas vertiefen und begründen, warum das in der Praxis wichtig ist?';

    const reply = await this.ai.tenantChat(tenantId, messages, stub);

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

  async listSessions(tenantId: string, userId: string) {
    const sessions = await this.prisma.expertTalkSession.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
    return sessions.map((s) => ({
      id: s.id,
      topic: s.topic,
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
