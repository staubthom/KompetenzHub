'use client';

import { useEffect, useRef, useState } from 'react';
import { expertTalk, type ExpertTalkSession } from '../lib/api';
import { useToast } from './ToastProvider';

/**
 * Kompakter KI-Fachgespräch-Chat (Übungsmodus, FA-80) zum Einbetten – z. B. direkt
 * im Abgabe-Dialog eines Kompetenznachweises. Startet beim Öffnen eine Session zum
 * übergebenen Thema; der Verlauf wird serverseitig gespeichert.
 */
export default function ExpertTalkChat({ topic, context }: { topic: string; context?: string }) {
  const toast = useToast();
  const [session, setSession] = useState<ExpertTalkSession | null>(null);
  const [starting, setStarting] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await expertTalk.create(topic, context);
        if (!cancelled) setSession(s);
      } catch (e: unknown) {
        const err = e as { body?: { title?: string } };
        toast.error(err.body?.title ?? 'Fachgespräch konnte nicht gestartet werden.');
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic, context, toast]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages.length]);

  async function send() {
    if (!session || !input.trim()) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    setSession((cur) =>
      cur
        ? {
            ...cur,
            messages: [
              ...cur.messages,
              {
                id: `tmp-${Date.now()}`,
                role: 'user',
                content,
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : cur,
    );
    try {
      const reply = await expertTalk.send(session.id, content);
      setSession((cur) => (cur ? { ...cur, messages: [...cur.messages, reply] } : cur));
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? 'Senden fehlgeschlagen.');
      setSession((cur) =>
        cur ? { ...cur, messages: cur.messages.filter((m) => !m.id.startsWith('tmp-')) } : cur,
      );
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  if (starting) return <div className="loading">KI-Fachgespräch wird gestartet…</div>;
  if (!session) return null;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
      <div className="chat" style={{ maxHeight: 320 }}>
        {session.messages.map((m) => (
          <div key={m.id} className={`msg ${m.role === 'assistant' ? 'ai' : 'me'}`}>
            <div className="who">{m.role === 'assistant' ? 'KI-Tutor' : 'Du'}</div>
            {m.content}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="chatbar">
        <input
          type="text"
          placeholder="Antwort schreiben …"
          value={input}
          disabled={sending}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
        />
        <button
          className="btn primary"
          disabled={sending || !input.trim()}
          onClick={() => void send()}
        >
          {sending ? '…' : 'Senden'}
        </button>
      </div>
    </div>
  );
}
