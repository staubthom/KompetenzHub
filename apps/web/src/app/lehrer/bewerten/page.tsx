'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import {
  submissions,
  classes,
  type SubmissionListItem,
  type SubmissionDetail,
  type ClassSummary,
  type AiAssessment,
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
  const toast = useToast();

  async function loadList() {
    try {
      setList(
        await submissions.list({
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(classFilter ? { classId: classFilter } : {}),
        }),
      );
    } catch {
      toast.error('Einreichungen konnten nicht geladen werden.');
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
  const toast = useToast();
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [points, setPoints] = useState('');
  const [level, setLevel] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [assessment, setAssessment] = useState<AiAssessment | null>(null);

  async function load() {
    try {
      const d = await submissions.detail(id);
      setSub(d);
      setPoints(d.evaluation?.points ?? '');
      setLevel(d.evaluation?.achievedLevel ?? '');
      setFeedback(d.evaluation?.feedback ?? '');
      try {
        setAssessment(await submissions.getAiAssessment(id));
      } catch {
        /* KI optional */
      }
    } catch {
      setLoadFailed(true);
      toast.error('Einreichung konnte nicht geladen werden.');
    }
  }
  useEffect(() => {
    void load();
  }, [id]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    toast.error(err.body?.title ?? 'Aktion fehlgeschlagen.');
  }

  async function save() {
    setBusy(true);
    try {
      await submissions.evaluate(id, {
        points: points === '' ? undefined : Number(points),
        level: level || undefined,
        feedback,
      });
      await load();
      toast.success('Bewertung gespeichert.');
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  async function genAssessment() {
    setAiBusy(true);
    try {
      const a = await submissions.aiAssessment(id);
      setAssessment(a);
      toast.success('KI-Bewertungsvorschlag erstellt.');
    } catch (e: unknown) {
      showError(e);
    } finally {
      setAiBusy(false);
    }
  }

  async function genFeedback() {
    setAiBusy(true);
    try {
      const r = await submissions.aiFeedback(id);
      setFeedback(r.feedback);
      toast.success('KI-Feedback-Entwurf eingefügt – bitte prüfen/anpassen.');
    } catch (e: unknown) {
      showError(e);
    } finally {
      setAiBusy(false);
    }
  }

  function applyAssessment() {
    if (!assessment) return;
    if (assessment.suggestedPoints != null) setPoints(String(assessment.suggestedPoints));
    if (assessment.suggestedLevel) setLevel(assessment.suggestedLevel);
    if (assessment.feedback) setFeedback(assessment.feedback);
    toast.info('KI-Vorschlag übernommen – bitte prüfen und speichern.');
  }

  async function doReject() {
    if (!reason.trim()) {
      toast.error('Begründung für die Rückweisung ist erforderlich.');
      return;
    }
    setBusy(true);
    try {
      await submissions.reject(id, reason.trim());
      setReason('');
      await load();
      toast.info('Einreichung zurückgewiesen.');
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!sub) {
    return (
      <div className="loading">
        {loadFailed ? 'Einreichung konnte nicht geladen werden.' : 'Lade…'}
      </div>
    );
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
          {/* KI-Assistenz (FA-70/72) */}
          <div className="panel">
            <div className="panel-head">
              <h2>KI-Assistenz</h2>
            </div>
            <div
              className="panel-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn sm"
                  disabled={aiBusy}
                  onClick={() => {
                    void genAssessment();
                  }}
                >
                  {aiBusy ? '…' : '🤖 KI-Bewertungsvorschlag'}
                </button>
                <button
                  className="btn sm"
                  disabled={aiBusy}
                  onClick={() => {
                    void genFeedback();
                  }}
                >
                  💬 KI-Feedback-Entwurf
                </button>
              </div>

              {assessment && (
                <div className="sub-status sub-submitted" style={{ margin: 0 }}>
                  <strong>🤖 KI-Vorschlag (unverbindlich)</strong>
                  <div className="sub-feedback">
                    {assessment.suggestedPoints != null && (
                      <div>
                        Punkte: {assessment.suggestedPoints}
                        {max != null ? ` / ${max}` : ''}
                      </div>
                    )}
                    {assessment.suggestedLevel && (
                      <div>
                        Gütestufe:{' '}
                        {LEVELS.find((l) => l.value === assessment.suggestedLevel)?.label ??
                          assessment.suggestedLevel}
                      </div>
                    )}
                    {assessment.feedback && (
                      <div style={{ marginTop: 6 }}>{assessment.feedback}</div>
                    )}
                    {assessment.reasoning.length > 0 && (
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {assessment.reasoning.map((r, i) => (
                          <li key={i}>
                            <strong>{r.criterion}:</strong> {r.comment}
                          </li>
                        ))}
                      </ul>
                    )}
                    {assessment.model && (
                      <div className="kh-muted" style={{ fontSize: 11, marginTop: 6 }}>
                        Modell: {assessment.model}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button className="btn sm primary" onClick={applyAssessment}>
                      In Bewertung übernehmen
                    </button>
                  </div>
                </div>
              )}

              <p className="kh-muted" style={{ fontSize: 12, margin: 0 }}>
                KI-Vorschläge sind unverbindlich – die endgültige Bewertung triffst immer du.
              </p>
            </div>
          </div>

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
