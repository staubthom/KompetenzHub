'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import EvidenceSubmitPanel from '../../../components/EvidenceSubmitPanel';
import { useToast } from '../../../components/ToastProvider';
import { evidence, type StudentEvidence } from '../../../lib/api';

function statusBadge(ev: StudentEvidence) {
  const sub = ev.lastSubmission;
  if (!sub) return <span className="badge b-archived">offen</span>;
  switch (sub.status) {
    case 'GRADED':
      return (
        <span className="badge b-published">
          ✓ bewertet{sub.points != null ? ` · ${sub.points} P` : ''}
        </span>
      );
    case 'REJECTED':
      return <span className="badge b-rejected">↩ zurückgewiesen</span>;
    case 'SUBMITTED':
      return <span className="badge b-draft">⏳ eingereicht</span>;
    default:
      return <span className="badge b-archived">{sub.status.toLowerCase()}</span>;
  }
}

function EvidenceRow({ ev, onOpen }: { ev: StudentEvidence; onOpen: () => void }) {
  return (
    <div className="evidence-item">
      <div>
        <strong>{ev.title?.de}</strong>
        <div className="evidence-meta">
          {ev.maxPoints ? `max. ${ev.maxPoints} Punkte` : 'ohne Punktewertung'}
          {ev.dueAt && (
            <>
              {' · '}
              {ev.isOverdue ? (
                <span className="overdue">überfällig</span>
              ) : (
                `fällig ${new Date(ev.dueAt).toLocaleDateString('de-CH')}`
              )}
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {statusBadge(ev)}
        <button className="btn primary sm" onClick={onOpen}>
          Öffnen
        </button>
      </div>
    </div>
  );
}

export default function NachweisePage() {
  const toast = useToast();
  const [list, setList] = useState<StudentEvidence[] | null>(null);
  const [active, setActive] = useState<StudentEvidence | null>(null);

  async function load() {
    try {
      setList(await evidence.studentList());
    } catch {
      toast.error('Nachweise konnten nicht geladen werden.');
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
            Meine Nachweise
          </button>{' '}
          / {active.title?.de}
        </div>
        <div className="page-head">
          <div>
            <h1>{active.title?.de}</h1>
            {active.dueAt && (
              <p>
                {active.isOverdue ? (
                  <span className="overdue">überfällig</span>
                ) : (
                  `fällig ${new Date(active.dueAt).toLocaleString('de-CH')}`
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
            ← Zurück
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
      <div className="breadcrumb">Meine Matrix / Meine Nachweise</div>
      <div className="page-head">
        <div>
          <h1>Meine Nachweise</h1>
          <p>Belege als Datei, Link, Text oder Screenshot einreichen</p>
        </div>
      </div>

      {!list ? (
        <div className="loading">Lade Nachweise…</div>
      ) : list.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">📄</span>
            <p>Aktuell sind keine Nachweise verfügbar.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="panel-head">
              <h2>Zu erledigen ({todo.length})</h2>
            </div>
            {todo.length === 0 ? (
              <div className="empty">
                <p>Alles erledigt – aktuell nichts offen. 🎉</p>
              </div>
            ) : (
              <div className="evidence-list">
                {todo.map((ev) => (
                  <EvidenceRow key={ev.id} ev={ev} onOpen={() => setActive(ev)} />
                ))}
              </div>
            )}
          </div>

          {done.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <h2>Eingereicht &amp; bewertet ({done.length})</h2>
              </div>
              <div className="evidence-list">
                {done.map((ev) => (
                  <EvidenceRow key={ev.id} ev={ev} onOpen={() => setActive(ev)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
