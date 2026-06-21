'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import {
  submissions,
  classes,
  type SubmissionListItem,
  type SubmissionDetail,
  type ClassSummary,
} from '../../../lib/api';

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'offen',
  SUBMITTED: 'eingereicht',
  IN_REVIEW: 'in Prüfung',
  GRADED: 'bewertet',
  REJECTED: 'zurückgewiesen',
  EXPIRED: 'abgelaufen',
};
const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: 'b-draft',
  GRADED: 'b-published',
  REJECTED: 'b-archived',
};
const LEVELS = [
  { value: 'NOT_MET', label: 'nicht erfüllt' },
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
];

export default function BewertenPage() {
  const [list, setList] = useState<SubmissionListItem[] | null>(null);
  const [classList, setClassList] = useState<ClassSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [classFilter, setClassFilter] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function loadList() {
    try {
      setList(
        await submissions.list({
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(classFilter ? { classId: classFilter } : {}),
        }),
      );
    } catch (e: unknown) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void loadList();
  }, [statusFilter, classFilter]);

  useEffect(() => {
    void (async () => {
      try {
        setClassList(await classes.list());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  if (activeId) {
    return (
      <AppShell>
        <BewertenDetail
          id={activeId}
          onBack={() => {
            setActiveId(null);
            void loadList();
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="breadcrumb">Übersicht / Bewerten</div>
      <div className="page-head">
        <div>
          <h1>Bewerten</h1>
          <p>Eingereichte Nachweise prüfen und bewerten</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {classList.length > 0 && (
            <select
              className="inline-select"
              style={{ minWidth: 180 }}
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">Alle Modulanlässe</option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="seg" role="group" aria-label="Status">
            {['SUBMITTED', 'GRADED', 'REJECTED'].map((s) => (
              <button key={s} aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="panel">
        {!list ? (
          <div className="loading">Lade Einreichungen…</div>
        ) : list.length === 0 ? (
          <div className="empty">
            <span className="ic">✓</span>
            <p>Keine Einreichungen mit Status „{STATUS_LABEL[statusFilter]}".</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Lernende:r</th>
                <th>Nachweis</th>
                <th>Modulanlass</th>
                <th>Eingereicht</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{s.enrollment.displayName}</td>
                  <td>{s.evidence.title?.de}</td>
                  <td className="kh-muted">{s.enrollment.class?.name ?? '—'}</td>
                  <td className="kh-muted">
                    {s.submittedAt ? new Date(s.submittedAt).toLocaleString('de-CH') : '—'}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[s.status] ?? 'b-archived'}`}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn sm" onClick={() => setActiveId(s.id)}>
                      Öffnen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

function BewertenDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState('');
  const [points, setPoints] = useState('');
  const [level, setLevel] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await submissions.detail(id);
      setSub(d);
      setPoints(d.evaluation?.points ?? '');
      setLevel(d.evaluation?.achievedLevel ?? '');
      setFeedback(d.evaluation?.feedback ?? '');
    } catch (e: unknown) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, [id]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    setError(err.body?.title ?? String(e));
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await submissions.evaluate(id, {
        points: points === '' ? undefined : Number(points),
        level: level || undefined,
        feedback,
      });
      await load();
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    if (!reason.trim()) {
      setError('Begründung für die Rückweisung ist erforderlich.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submissions.reject(id, reason.trim());
      setReason('');
      await load();
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!sub) {
    return error ? <div className="error">{error}</div> : <div className="loading">Lade…</div>;
  }

  const max = sub.evidence.maxPoints ? Number(sub.evidence.maxPoints) : null;
  const pct = max && points !== '' ? Math.round((Number(points) / max) * 100) : null;
  const content = sub.content ?? {};

  return (
    <>
      <div className="breadcrumb">
        <button className="linklike" onClick={onBack}>
          Bewerten
        </button>{' '}
        / {sub.enrollment.displayName}
      </div>
      <div className="page-head">
        <div>
          <h1>{sub.evidence.title?.de}</h1>
          <p>
            {sub.enrollment.displayName}
            {sub.enrollment.class?.name ? ` · ${sub.enrollment.class.name}` : ''}
            {sub.submittedAt
              ? ` · eingereicht ${new Date(sub.submittedAt).toLocaleString('de-CH')}`
              : ''}
          </p>
        </div>
        <button className="btn" onClick={onBack}>
          ← Zurück
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid2">
        {/* Links: Einreichung */}
        <div>
          <div className="panel">
            <div className="panel-head">
              <h2>Eingereichter Nachweis</h2>
              {sub.fileUrl && (
                <a className="btn sm" href={sub.fileUrl} target="_blank" rel="noopener">
                  ⬇ {sub.fileName ?? 'Datei'}
                </a>
              )}
            </div>
            <div className="panel-body">
              {content.text && <p style={{ marginTop: 0 }}>{content.text}</p>}
              {content.link && (
                <p>
                  🔗{' '}
                  <a href={content.link} target="_blank" rel="noopener">
                    {content.link}
                  </a>
                </p>
              )}
              {!content.text && !content.link && !sub.fileUrl && (
                <p className="kh-muted" style={{ marginTop: 0 }}>
                  Kein Textinhalt – siehe Datei/Link.
                </p>
              )}
            </div>
          </div>

          {sub.evidence.instructions?.de && (
            <div className="panel">
              <div className="panel-head">
                <h2>Aufgabenstellung</h2>
              </div>
              <div
                className="panel-body rte-content"
                dangerouslySetInnerHTML={{ __html: sub.evidence.instructions.de }}
              />
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <h2>Verlauf</h2>
            </div>
            <div className="panel-body">
              {sub.history.length === 0 ? (
                <p className="kh-muted" style={{ margin: 0 }}>
                  Noch keine Bewertungsschritte.
                </p>
              ) : (
                <ul className="hz-list" style={{ margin: 0 }}>
                  {sub.history.map((h) => (
                    <li key={h.id} className="hz-item" style={{ padding: '8px 0' }}>
                      <span style={{ flex: 1 }}>
                        <strong>{historyLabel(h.changeType)}</strong>
                        {h.points != null && ` · ${h.points} P`}
                        {h.feedback ? ` · ${h.feedback}` : ''}
                      </span>
                      <span className="kh-muted" style={{ fontSize: 12 }}>
                        {h.changedBy.displayName} · {new Date(h.createdAt).toLocaleString('de-CH')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Rechts: Bewerten */}
        <div>
          <div className="panel">
            <div className="panel-head">
              <h2>Bewerten</h2>
              <span className={`badge ${STATUS_BADGE[sub.status] ?? 'b-archived'}`}>
                {STATUS_LABEL[sub.status] ?? sub.status}
              </span>
            </div>
            <div
              className="panel-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <label className="fld">
                <span className="field-label">
                  Erreichte Punkte{max != null ? ` (max. ${max})` : ''}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    className="link-input"
                    style={{ width: 120, flex: 'none' }}
                    value={points}
                    min={0}
                    max={max ?? undefined}
                    onChange={(e) => setPoints(e.target.value)}
                  />
                  {max != null && (
                    <button
                      type="button"
                      className="btn sm"
                      title={`Volle Punktzahl (${max}) vergeben`}
                      onClick={() => setPoints(String(max))}
                    >
                      Max ({max})
                    </button>
                  )}
                  {pct != null && <span className="badge b-published">{pct}%</span>}
                </div>
              </label>

              <label className="fld">
                <span className="field-label">Gütestufe</span>
                <select
                  className="inline-select"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="">— keine —</option>
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fld">
                <span className="field-label">Feedback</span>
                <textarea
                  className="text-input"
                  rows={4}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Rückmeldung an die/den Lernende:n …"
                />
              </label>

              <button
                className="btn primary"
                disabled={busy}
                onClick={() => {
                  void save();
                }}
              >
                ✓ Bewertung speichern &amp; freigeben
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Zurückweisen</h2>
            </div>
            <div
              className="panel-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <textarea
                className="text-input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Begründung (Pflicht) – was soll überarbeitet werden?"
              />
              <button
                className="btn danger"
                disabled={busy}
                onClick={() => {
                  void doReject();
                }}
              >
                ↩ Zur Überarbeitung zurückweisen
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function historyLabel(t: string): string {
  switch (t) {
    case 'CREATED':
      return 'Bewertet';
    case 'UPDATED':
      return 'Bewertung geändert';
    case 'REJECTED':
      return 'Zurückgewiesen';
    case 'REOPENED':
      return 'Wieder geöffnet';
    default:
      return t;
  }
}
