'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { useI18n, localized } from '../../../lib/i18n';
import {
  classes,
  expertTalk,
  type ExpertTalkSession,
  type ExpertTalkSummary,
  type MyEnrollment,
} from '../../../lib/api';

export default function ModulUebenPage() {
  const toast = useToast();
  const { t, locale } = useI18n();
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
      toast.error(t('toast.talksLoadFailed'));
    }
  }, [toast, t]);

  useEffect(() => {
    void (async () => {
      try {
        const mine = await classes.mine();
        setEnrollments(mine);
        const first = mine.find((e) => e.class.module);
        if (first?.class.module) setModuleId(first.class.module.id);
      } catch {
        toast.error(t('toast.classesLoadFailed'));
      }
    })();
    void loadSessions();
  }, [loadSessions, toast, t]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    toast.error(err.body?.title ?? t('common.actionFailed'));
  }

  async function start() {
    if (!moduleId) {
      toast.error(t('toast.selectModuleFirst'));
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
      toast.success(t('toast.talkCompleted'));
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
            {t('talk.title')}
          </button>{' '}
          / {active.topic}
        </div>
        <div className="page-head">
          <div>
            <h1>{t('talk.title')}</h1>
            <p>{active.topic}</p>
          </div>
          <span className={`badge ${done ? 'b-published' : 'b-draft'}`}>
            {done ? t('talk.completed') : t('talk.practiceMode')}
          </span>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>💬 {t('talk.conversation')}</h2>
            <span className="badge b-draft">KI-Tutor</span>
          </div>
          <div className="chat">
            {active.messages.map((m) => (
              <div key={m.id} className={`msg ${m.role === 'assistant' ? 'ai' : 'me'}`}>
                <div className="who">
                  {m.role === 'assistant' ? 'KI-Tutor' : t('header.roleStudent')}
                </div>
                {m.content}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {done ? (
            <div className="chatbar">
              <button className="btn" onClick={() => setActive(null)}>
                ← {t('talk.toOverview')}
              </button>
            </div>
          ) : (
            <div className="chatbar">
              <input
                type="text"
                placeholder={t('talk.answerPlaceholder')}
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
                {sending ? '…' : t('talk.send')}
              </button>
            </div>
          )}
        </div>

        {!done && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setActive(null)}>
              {t('talk.toOverview')}
            </button>
            <button className="btn" onClick={() => void finish()}>
              {t('talk.finish')}
            </button>
          </div>
        )}
        <p className="kh-muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          {t('talk.footer')}
        </p>
      </AppShell>
    );
  }

  // ── Ansicht: Übersicht / neues Gespräch ───────────────────────
  const modules = (enrollments ?? []).filter((e) => e.class.module);

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('common.overview')} / {t('talk.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('talk.title')}</h1>
          <p>{t('talk.subtitle')}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{t('talk.start')}</h2>
        </div>
        <div className="panel-body">
          {enrollments === null ? (
            <div className="loading">{t('common.loading')}</div>
          ) : modules.length === 0 ? (
            <p className="kh-muted" style={{ marginTop: 0 }}>
              {t('talk.noModuleJoined')}
            </p>
          ) : (
            <>
              <p className="kh-muted" style={{ marginTop: 0 }}>
                {t('talk.chooseModule')}
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
                      {t('common.module')} {e.class.module!.number} ·{' '}
                      {localized(e.class.module!.title, locale) || e.class.name}
                    </option>
                  ))}
                </select>
                <button className="btn primary" disabled={starting} onClick={() => void start()}>
                  {starting ? t('talk.starting') : t('talk.startBtn')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{t('talk.previous')}</h2>
        </div>
        {!sessions ? (
          <div className="loading">{t('common.loading')}</div>
        ) : sessions.length === 0 ? (
          <div className="empty">
            <span className="ic">💬</span>
            <p>{t('talk.none')}</p>
          </div>
        ) : (
          <ul className="hz-list">
            {sessions.map((s) => (
              <li key={s.id} className="hz-item">
                <div style={{ flex: 1 }}>
                  <strong>{s.topic}</strong>
                  <div className="kh-muted" style={{ fontSize: 12 }}>
                    {s.messageCount} · {new Date(s.updatedAt).toLocaleString()}
                  </div>
                </div>
                <span className={`badge ${s.status === 'COMPLETED' ? 'b-published' : 'b-draft'}`}>
                  {s.status === 'COMPLETED' ? t('talk.completed') : t('cl.active')}
                </span>
                <button className="btn sm" onClick={() => void open(s.id)}>
                  {t('common.open')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
