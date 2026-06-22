'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import {
  classes,
  expertTalk,
  type ExpertTalkSession,
  type ExpertTalkSummary,
  type MyEnrollment,
} from '../../../lib/api';

export default function ModulUebenPage() {
  const toast = useToast();
  const [enrollments, setEnrollments] = useState<MyEnrollment[] | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ExpertTalkSummary[] | null>(null);
  const [active, setActive] = useState<ExpertTalkSession | null>(null);
  const [input, setInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      const all = await expertTalk.list();
      setSessions(all.filter((s) => s.mode === 'module'));
    } catch {
      toast.error('Gespräche konnten nicht geladen werden.');
    }
  }, [toast]);

  useEffect(() => {
    void (async () => {
      try {
        const mine = await classes.mine();
        setEnrollments(mine);
        const first = mine.find((e) => e.class.module);
        if (first?.class.module) setModuleId(first.class.module.id);
      } catch {
        toast.error('Modulanlässe konnten nicht geladen werden.');
      }
    })();
    void loadSessions();
  }, [loadSessions, toast]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    toast.error(err.body?.title ?? 'Aktion fehlgeschlagen.');
  }

  async function start() {
    if (!moduleId) {
      toast.error('Bitte zuerst ein Modul wählen.');
      return;
    }
    setStarting(true);
    try {
      const s = await expertTalk.createModule(moduleId);
      setActive(s);
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
            Modul mit KI üben
          </button>{' '}
          / {active.topic}
        </div>
        <div className="page-head">
          <div>
            <h1>Modul mit KI üben</h1>
            <p>Die KI prüft dich quer durchs Modul · {active.topic}</p>
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
          Übungsmodus – keine Note. Die KI gibt dir Feedback zur Qualität deiner Antworten und
          Lerntipps.
        </p>
      </AppShell>
    );
  }

  // ── Ansicht: Übersicht / neues Gespräch ───────────────────────
  const modules = (enrollments ?? []).filter((e) => e.class.module);

  return (
    <AppShell>
      <div className="breadcrumb">Übersicht / Modul mit KI üben</div>
      <div className="page-head">
        <div>
          <h1>Modul mit KI üben</h1>
          <p>
            Die KI führt ein Lerngespräch über das ganze Modul, fragt verschiedene Kompetenzen ab,
            gibt Lerntipps und Feedback zu deinen Antworten – ganz ohne Note.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Neues Lerngespräch starten</h2>
        </div>
        <div className="panel-body">
          {enrollments === null ? (
            <div className="loading">Lade…</div>
          ) : modules.length === 0 ? (
            <p className="kh-muted" style={{ marginTop: 0 }}>
              Du bist noch keinem Modulanlass mit Modul beigetreten.
            </p>
          ) : (
            <>
              <p className="kh-muted" style={{ marginTop: 0 }}>
                Wähle ein Modul – die KI nutzt alle Kompetenzen der Matrix als Grundlage.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="inline-select"
                  style={{ minWidth: 240 }}
                  value={moduleId ?? ''}
                  onChange={(e) => setModuleId(e.target.value)}
                >
                  {modules.map((e) => (
                    <option key={e.enrollmentId} value={e.class.module!.id}>
                      Modul {e.class.module!.number} · {e.class.module!.title?.de ?? e.class.name}
                    </option>
                  ))}
                </select>
                <button className="btn primary" disabled={starting} onClick={() => void start()}>
                  {starting ? 'Starte…' : '💬 Modul mit KI üben'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Frühere Lerngespräche</h2>
        </div>
        {!sessions ? (
          <div className="loading">Lade…</div>
        ) : sessions.length === 0 ? (
          <div className="empty">
            <span className="ic">💬</span>
            <p>Noch keine Lerngespräche. Starte oben dein erstes!</p>
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
