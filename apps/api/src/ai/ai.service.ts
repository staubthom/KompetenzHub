import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret, maskSecret } from './crypto.util';

export interface AiConfigInput {
  provider?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string | null; // undefined = unverändert, '' / null = löschen
  enabled?: boolean;
}

export interface AiConfigView {
  provider: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyMask: string | null;
  updatedAt: string | null;
}

const PROVIDERS = ['openai', 'openai-compatible', 'azure', 'local'];

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sichtbare Konfiguration (ohne Klartext-Key). Liefert Defaults, falls nichts gespeichert. */
  async getConfig(tenantId: string, userId: string): Promise<AiConfigView> {
    const cfg = await this.prisma.aiConfig.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!cfg) {
      return {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        enabled: false,
        hasApiKey: false,
        apiKeyMask: null,
        updatedAt: null,
      };
    }
    let apiKeyMask: string | null = null;
    if (cfg.apiKeyEnc) {
      try {
        apiKeyMask = maskSecret(decryptSecret(cfg.apiKeyEnc));
      } catch {
        apiKeyMask = '••••';
      }
    }
    return {
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      enabled: cfg.enabled,
      hasApiKey: !!cfg.apiKeyEnc,
      apiKeyMask,
      updatedAt: cfg.updatedAt.toISOString(),
    };
  }

  /** Lightweight-Status für das Feature-Gate (FA-70/72/80). */
  async getStatus(
    tenantId: string,
    userId: string,
  ): Promise<{ configured: boolean; enabled: boolean }> {
    const cfg = await this.prisma.aiConfig.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    const configured = !!cfg?.apiKeyEnc && !!cfg?.baseUrl && !!cfg?.model;
    return { configured, enabled: configured && !!cfg?.enabled };
  }

  /** Ob KI-Funktionen für diese Lehrperson genutzt werden dürfen. */
  async isEnabled(tenantId: string, userId: string): Promise<boolean> {
    return (await this.getStatus(tenantId, userId)).enabled;
  }

  async saveConfig(tenantId: string, userId: string, input: AiConfigInput): Promise<AiConfigView> {
    if (input.provider !== undefined && !PROVIDERS.includes(input.provider)) {
      throw new BadRequestException(`Unbekannter Provider. Erlaubt: ${PROVIDERS.join(', ')}`);
    }
    if (input.baseUrl !== undefined && input.baseUrl && !/^https?:\/\//i.test(input.baseUrl)) {
      throw new BadRequestException('baseUrl muss mit http:// oder https:// beginnen.');
    }

    const data: {
      provider?: string;
      baseUrl?: string;
      model?: string;
      enabled?: boolean;
      apiKeyEnc?: string | null;
    } = {};
    if (input.provider !== undefined) data.provider = input.provider;
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl.replace(/\/+$/, '');
    if (input.model !== undefined) data.model = input.model;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    // apiKey: undefined = unverändert; leer/null = löschen; sonst verschlüsseln
    if (input.apiKey !== undefined) {
      data.apiKeyEnc = input.apiKey ? encryptSecret(input.apiKey) : null;
    }

    await this.prisma.aiConfig.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: { tenantId, userId, ...data },
      update: data,
    });
    return this.getConfig(tenantId, userId);
  }

  /**
   * Verbindungstest gegen den (OpenAI-kompatiblen) Endpoint via GET {baseUrl}/models.
   * Verwendet den im Body übergebenen Key (falls vorhanden) oder den gespeicherten.
   */
  async testConnection(
    tenantId: string,
    userId: string,
    input: AiConfigInput,
  ): Promise<{ ok: boolean; message: string; models?: string[] }> {
    const stored = await this.prisma.aiConfig.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });

    const baseUrl = (input.baseUrl ?? stored?.baseUrl ?? '').replace(/\/+$/, '');
    let apiKey: string | undefined;
    if (input.apiKey) apiKey = input.apiKey;
    else if (stored?.apiKeyEnc) {
      try {
        apiKey = decryptSecret(stored.apiKeyEnc);
      } catch {
        apiKey = undefined;
      }
    }

    if (!baseUrl) return { ok: false, message: 'Kein Endpoint (baseUrl) konfiguriert.' };
    if (!apiKey) return { ok: false, message: 'Kein API-Key hinterlegt.' };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        return {
          ok: false,
          message: `Verbindung fehlgeschlagen (HTTP ${res.status}). Endpoint/Key prüfen.`,
        };
      }
      const json = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null;
      const models = (json?.data ?? [])
        .map((m) => m.id)
        .filter((id): id is string => !!id)
        .slice(0, 10);
      return { ok: true, message: 'Verbindung erfolgreich.', models };
    } catch (e: unknown) {
      const aborted = (e as { name?: string })?.name === 'AbortError';
      return {
        ok: false,
        message: aborted
          ? 'Zeitüberschreitung beim Verbindungstest.'
          : 'Endpoint nicht erreichbar.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Sendet eine Chat-Completion an den konfigurierten (OpenAI-kompatiblen) Endpoint
   * und liefert den Text der Antwort. Wirft 409, wenn KI nicht aktiv konfiguriert ist
   * (Feature-Gate FA-34). Im Stub-Modus (AI_STUB_MODE=1) wird ohne Netzwerkaufruf eine
   * deterministische Antwort (`stub`) zurückgegeben – für Tests/Smokes.
   */
  async chat(
    tenantId: string,
    userId: string,
    opts: { system: string; user: string; stub: unknown },
  ): Promise<string> {
    const cfg = await this.prisma.aiConfig.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    const configured = !!cfg?.apiKeyEnc && !!cfg?.baseUrl && !!cfg?.model;
    if (!cfg || !configured || !cfg.enabled) {
      throw new ConflictException(
        'KI ist nicht konfiguriert oder deaktiviert. Bitte unter „KI-Einstellungen" einrichten.',
      );
    }

    if (process.env.AI_STUB_MODE === '1') {
      return typeof opts.stub === 'string' ? opts.stub : JSON.stringify(opts.stub);
    }

    const apiKey = decryptSecret(cfg.apiKeyEnc!);
    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: opts.system },
            { role: 'user', content: opts.user },
          ],
        }),
      });
      if (!res.ok) {
        throw new ConflictException(`KI-Anfrage fehlgeschlagen (HTTP ${res.status}).`);
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new ConflictException('Leere KI-Antwort erhalten.');
      return content;
    } catch (e: unknown) {
      if (e instanceof ConflictException) throw e;
      const aborted = (e as { name?: string })?.name === 'AbortError';
      throw new ConflictException(
        aborted ? 'Zeitüberschreitung bei der KI-Anfrage.' : 'KI-Endpoint nicht erreichbar.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Das aktuell konfigurierte Modell (für Protokollierung des Vorschlags). */
  async modelName(tenantId: string, userId: string): Promise<string | null> {
    const cfg = await this.prisma.aiConfig.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    return cfg?.model ?? null;
  }
}
