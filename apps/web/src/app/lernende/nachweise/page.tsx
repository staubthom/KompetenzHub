'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import EvidenceSubmitPanel from '../../../components/EvidenceSubmitPanel';
import { evidence, type StudentEvidence } from '../../../lib/api';

export default function NachweisePage() {
  const [list, setList] = useState<StudentEvidence[] | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState<StudentEvidence | null>(null);

  async function load() {
    try {
      setList(await evidence.studentList());
    } catch (e: unknown) {
      setError(String(e));
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
            <EvidenceSubmitPanel ev={active} />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="breadcrumb">Meine Matrix / Meine Nachweise</div>
      <div className="page-head">
        <div>
          <h1>Meine Nachweise</h1>
          <p>Belege als Datei, Link oder Text einreichen</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="panel">
        {!list ? (
          <div className="loading">Lade Nachweise…</div>
        ) : list.length === 0 ? (
          <div className="empty">
            <span className="ic">📄</span>
            <p>Aktuell sind keine Nachweise verfügbar.</p>
          </div>
        ) : (
          <div className="evidence-list">
            {list.map((ev) => (
              <div key={ev.id} className="evidence-item">
                <div>
                  <strong>{ev.title?.de}</strong>
                  <div className="evidence-meta">
                    {ev.lastSubmission ? (
                      <span style={{ color: 'var(--st-graded)' }}>✓ eingereicht</span>
                    ) : (
                      'offen'
                    )}
                    {ev.maxPoints ? ` · max. ${ev.maxPoints} Punkte` : ''}
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
                <button className="btn primary sm" onClick={() => setActive(ev)}>
                  Öffnen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
