'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import EvidenceSubmitPanel from '../../../components/EvidenceSubmitPanel';
import { useToast } from '../../../components/ToastProvider';
import { useI18n, localized, type Locale } from '../../../lib/i18n';
import { evidence, type StudentEvidence } from '../../../lib/api';

type T = (k: string) => string;

function statusBadge(ev: StudentEvidence, t: T) {
  const sub = ev.lastSubmission;
  if (!sub) return <span className="badge b-archived">{t('status.OPEN')}</span>;
  switch (sub.status) {
    case 'GRADED':
      return (
        <span className="badge b-published">
          ✓ {t('status.GRADED')}
          {sub.points != null ? ` · ${sub.points} P` : ''}
        </span>
      );
    case 'REJECTED':
      return <span className="badge b-rejected">↩ {t('status.REJECTED')}</span>;
    case 'SUBMITTED':
      return <span className="badge b-draft">⏳ {t('status.SUBMITTED')}</span>;
    default:
      return <span className="badge b-archived">{t(`status.${sub.status}`)}</span>;
  }
}

function EvidenceRow({
  ev,
  onOpen,
  t,
  locale,
}: {
  ev: StudentEvidence;
  onOpen: () => void;
  t: T;
  locale: Locale;
}) {
  return (
    <div className="evidence-item">
      <div>
        <strong>{localized(ev.title, locale)}</strong>
        <div className="evidence-meta">
          {ev.maxPoints ? `max. ${ev.maxPoints} ${t('common.points')}` : ''}
          {ev.dueAt && (
            <>
              {' · '}
              {ev.isOverdue ? (
                <span className="overdue">{t('status.EXPIRED')}</span>
              ) : (
                new Date(ev.dueAt).toLocaleDateString()
              )}
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {statusBadge(ev, t)}
        <button className="btn primary sm" onClick={onOpen}>
          {t('nw.open')}
        </button>
      </div>
    </div>
  );
}

export default function NachweisePage() {
  const toast = useToast();
  const { t, locale } = useI18n();
  const [list, setList] = useState<StudentEvidence[] | null>(null);
  const [active, setActive] = useState<StudentEvidence | null>(null);

  async function load() {
    try {
      setList(await evidence.studentList());
    } catch {
      toast.error(t('toast.evidenceListLoadFailed'));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (active) {
    return (
      <AppShell>
        <div className="breadcrumb">
          <button
            className="linklike"
            onClick={() => {
              setActive(null);
              void load();
            }}
          >
            {t('nw.title')}
          </button>{' '}
          / {localized(active.title, locale)}
        </div>
        <div className="page-head">
          <div>
            <h1>{localized(active.title, locale)}</h1>
            {active.dueAt && (
              <p>
                {active.isOverdue ? (
                  <span className="overdue">{t('status.EXPIRED')}</span>
                ) : (
                  new Date(active.dueAt).toLocaleString()
                )}
              </p>
            )}
          </div>
          <button
            className="btn"
            onClick={() => {
              setActive(null);
              void load();
            }}
          >
            ← {t('common.back')}
          </button>
        </div>
        <div className="panel">
          <div className="panel-body">
            <EvidenceSubmitPanel ev={active} onSubmitted={() => void load()} />
          </div>
        </div>
      </AppShell>
    );
  }

  // Aufteilen: zu erledigen (offen / zurückgewiesen) vs. erledigt (eingereicht / bewertet)
  const todo = (list ?? []).filter(
    (e) => !e.lastSubmission || e.lastSubmission.status === 'REJECTED',
  );
  const done = (list ?? []).filter(
    (e) => e.lastSubmission && e.lastSubmission.status !== 'REJECTED',
  );

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('nav.matrix')} / {t('nw.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('nw.title')}</h1>
          <p>{t('nw.subtitle')}</p>
        </div>
      </div>

      {!list ? (
        <div className="loading">{t('common.loading')}</div>
      ) : list.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">📄</span>
            <p>{t('nw.empty')}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="panel-head">
              <h2>
                {t('nw.todo')} ({todo.length})
              </h2>
            </div>
            {todo.length === 0 ? (
              <div className="empty">
                <p>{t('nw.emptyTodo')}</p>
              </div>
            ) : (
              <div className="evidence-list">
                {todo.map((ev) => (
                  <EvidenceRow
                    key={ev.id}
                    ev={ev}
                    onOpen={() => setActive(ev)}
                    t={t}
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </div>

          {done.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <h2>
                  {t('nw.done')} ({done.length})
                </h2>
              </div>
              <div className="evidence-list">
                {done.map((ev) => (
                  <EvidenceRow
                    key={ev.id}
                    ev={ev}
                    onOpen={() => setActive(ev)}
                    t={t}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
