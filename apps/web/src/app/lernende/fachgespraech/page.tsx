'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { expertTalk, type ExpertTalkSession, type ExpertTalkSummary } from '../../../lib/api';

export default function FachgespraechPage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<ExpertTalkSummary[] | null>(null);
  const [active, setActive] = useState<ExpertTalkSession | null>(null);
  const [topic, setTopic] = useState('');
  const [input, setInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await expertTalk.list());
    } catch {
      toast.error('Gespräche konnten nicht geladen werden.');
    }
  }, [toast]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    toast.error(err.body?.title ?? 'Aktion fehlgeschlagen.');
  }

  async function start() {
    if (!topic.trim()) {
      toast.error('Bitte ein Thema eingeben.');
      return;
    }
    setStarting(true);
    try {
      const s = await expertTalk.create(topic.trim());
      setActive(s);
      setTopic('');
      void loadSessions();
    } catch (e: unknown) {
      showError(e);
    } finally {
      setStarting(false);
    }
  }

  async function open(id: string) {
    try {
      setActive(await expertTalk.get(id));
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function send() {
    if (!active || !input.trim()) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    // optimistisch eigene Nachricht anzeigen
    setActive((cur) =>
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
      const reply = await expertTalk.send(active.id, content);
      setActive((cur) => (cur ? { ...cur, messages: [...cur.messages, reply] } : cur));
    } catch (e: unknown) {
      showError(e);
      // bei Fehler eigene optimistische Nachricht wieder entfernen
      setActive((cur) =>
        cur ? { ...cur, messages: cur.messages.filter((m) => !m.id.startsWith('tmp-')) } : cur,
      );
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  async function finish() {
    if (!active) return;
    try {
      const s = await expertTalk.complete(active.id);
      setActive(s);
      void loadSessions();
      toast.success('Gespräch abgeschlossen.');
    } catch (e: unknown) {
      showError(e);
    }
  }

  // ── Ansicht: aktives Gespräch ─────────────────────────────────
  if (active) {
    const done = active.status === 'COMPLETED';
    return (
      <AppShell>
        <div className="breadcrumb">
          <button className="linklike" onClick={() => setActive(null)}>
            Fachgespräch
          </button>{' '}
          / {active.topic}
        </div>
        <div className="page-head">
          <div>
            <h1>Fachgespräch üben</h1>
            <p>Übungsdialog mit dem KI-Tutor · Thema: {active.topic}</p>
          </div>
          <span className={`badge ${done ? 'b-published' : 'b-draft'}`}>
            {done ? 'abgeschlossen' : 'Übungsmodus'}
          </span>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>💬 Gespräch</h2>
            <span className="badge b-draft">KI-Tutor</span>
          </div>
          <div className="chat">
            {active.messages.map((m) => (
              <div key={m.id} className={`msg ${m.role === 'assistant' ? 'ai' : 'me'}`}>
                <div className="who">{m.role === 'assistant' ? 'KI-Tutor' : 'Du'}</div>
                {m.content}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {done ? (
            <div className="chatbar">
              <button className="btn" onClick={() => setActive(null)}>
                ← Zur Übersicht
              </button>
            </div>
          ) : (
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
          )}
        </div>

        {!done && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setActive(null)}>
              Übersicht
            </button>
            <button className="btn" onClick={() => void finish()}>
              Gespräch abschliessen
            </button>
          </div>
        )}
        <p className="kh-muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Übungsmodus – es gibt keine Note. Der KI-Tutor hilft dir beim Üben.
        </p>
      </AppShell>
    );
  }

  // ── Ansicht: Übersicht / neues Gespräch ───────────────────────
  return (
    <AppShell>
      <div className="breadcrumb">Übersicht / Fachgespräch üben</div>
      <div className="page-head">
        <div>
          <h1>Fachgespräch üben</h1>
          <p>Übe ein mündliches Fachgespräch mit dem KI-Tutor – ganz ohne Note.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Neues Gespräch starten</h2>
        </div>
        <div className="panel-body">
          <p className="kh-muted" style={{ marginTop: 0 }}>
            Gib ein Thema oder eine Kompetenz ein, zu der du das Fachgespräch üben möchtest.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="link-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="z. B. Betriebssysteme konfigurieren"
              value={topic}
              disabled={starting}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void start();
              }}
            />
            <button className="btn primary" disabled={starting} onClick={() => void start()}>
              {starting ? 'Starte…' : '💬 Gespräch starten'}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Frühere Gespräche</h2>
        </div>
        {!sessions ? (
          <div className="loading">Lade…</div>
        ) : sessions.length === 0 ? (
          <div className="empty">
            <span className="ic">💬</span>
            <p>Noch keine Übungsgespräche. Starte oben dein erstes!</p>
          </div>
        ) : (
          <ul className="hz-list">
            {sessions.map((s) => (
              <li key={s.id} className="hz-item">
                <div style={{ flex: 1 }}>
                  <strong>{s.topic}</strong>
                  <div className="kh-muted" style={{ fontSize: 12 }}>
                    {s.messageCount} Nachricht(en) · {new Date(s.updatedAt).toLocaleString('de-CH')}
                  </div>
                </div>
                <span className={`badge ${s.status === 'COMPLETED' ? 'b-published' : 'b-draft'}`}>
                  {s.status === 'COMPLETED' ? 'abgeschlossen' : 'aktiv'}
                </span>
                <button className="btn sm" onClick={() => void open(s.id)}>
                  Öffnen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
