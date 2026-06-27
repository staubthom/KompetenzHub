'use client';

import { useEffect, useState } from 'react';
import { useToast } from './ToastProvider';
import { useI18n, localized } from '../lib/i18n';
import { submissions, type SubmissionDetail, type AiAssessment } from '../lib/api';

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: 'b-draft',
  GRADED: 'b-published',
  REJECTED: 'b-archived',
};
const LEVELS = ['NOT_MET', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

/** Wurde nach Ablauf der Frist eingereicht? */
function isLate(submittedAt: string | null, dueAt: string | null): boolean {
  if (!submittedAt || !dueAt) return false;
  return new Date(submittedAt) > new Date(dueAt);
}

/**
 * Bewerten/Nachbewerten einer einzelnen Einreichung (FA-60/62/65/70/72).
 * Wird sowohl in der Bewerten-Liste als auch beim Drilldown aus der
 * Schüler-Matrix (Modulanlässe) verwendet. Nachbewertungen landen in der
 * Historie (serverseitig via evaluationHistory).
 */
export default function SubmissionGrader({
  id,
  onBack,
  onSaved,
  backLabel,
}: {
  id: string;
  onBack: () => void;
  /** Wird nach erfolgreichem Speichern/Zurückweisen aufgerufen (z. B. Matrix neu laden). */
  onSaved?: () => void;
  /** Beschriftung des Zurück-Links/Buttons (Default: Titel der Bewerten-Ansicht). */
  backLabel?: string;
}) {
  const toast = useToast();
  const { t, locale } = useI18n();
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [points, setPoints] = useState('');
  const [level, setLevel] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [assessment, setAssessment] = useState<AiAssessment | null>(null);

  const back = backLabel ?? t('bw.title');

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
      onSaved?.();
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
      onSaved?.();
      toast.info('Einreichung zurückgewiesen.');
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!sub) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  const max = sub.evidence.maxPoints ? Number(sub.evidence.maxPoints) : null;
  const pct = max && points !== '' ? Math.round((Number(points) / max) * 100) : null;
  const content = sub.content ?? {};

  return (
    <>
      <div className="breadcrumb">
        <button className="linklike" onClick={onBack}>
          {back}
        </button>{' '}
        / {sub.enrollment.displayName}
      </div>
      <div className="page-head">
        <div>
          <h1>{localized(sub.evidence.title, locale)}</h1>
          <p>
            {sub.enrollment.displayName}
            {sub.enrollment.class?.name ? ` · ${sub.enrollment.class.name}` : ''}
            {sub.submittedAt ? ` · ${new Date(sub.submittedAt).toLocaleString()}` : ''}
          </p>
        </div>
        <button className="btn" onClick={onBack}>
          ← {t('common.back')}
        </button>
      </div>

      {/* Verspätete Einreichung deutlich hervorheben (FA) */}
      {isLate(sub.submittedAt, sub.evidence.dueAt) && (
        <div className="late-banner">
          ⚠ {t('bw.lateBanner')}
          <div className="late-banner-detail">
            {t('bw.lateSubmittedAt')}: {new Date(sub.submittedAt!).toLocaleString()}
            {sub.evidence.dueAt && (
              <>
                {' '}
                · {t('bw.lateDueWas')}: {new Date(sub.evidence.dueAt).toLocaleString()}
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid2">
        {/* Links: Einreichung */}
        <div>
          <div className="panel">
            <div className="panel-head">
              <h2>{t('bw.submittedEvidence')}</h2>
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
              {content.expertTalk && <p style={{ marginTop: 0 }}>🗣 {t('bw.expertTalk')}</p>}
              {!content.text && !content.link && !sub.fileUrl && !content.expertTalk && (
                <p className="kh-muted" style={{ marginTop: 0 }}>
                  {t('bw.noText')}
                </p>
              )}
            </div>
          </div>

          {localized(sub.evidence.instructions, locale) && (
            <div className="panel">
              <div className="panel-head">
                <h2>{t('bw.instructions')}</h2>
              </div>
              <div
                className="panel-body rte-content"
                dangerouslySetInnerHTML={{ __html: localized(sub.evidence.instructions, locale) }}
              />
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <h2>{t('bw.history')}</h2>
            </div>
            <div className="panel-body">
              {sub.history.length === 0 ? (
                <p className="kh-muted" style={{ margin: 0 }}>
                  {t('bw.noHistory')}
                </p>
              ) : (
                <ul className="hz-list" style={{ margin: 0 }}>
                  {sub.history.map((h) => (
                    <li key={h.id} className="hz-item" style={{ padding: '8px 0' }}>
                      <span style={{ flex: 1 }}>
                        <strong>{t(`hist.${h.changeType}`)}</strong>
                        {h.points != null && ` · ${h.points} P`}
                        {h.feedback ? ` · ${h.feedback}` : ''}
                      </span>
                      <span className="kh-muted" style={{ fontSize: 12 }}>
                        {h.changedBy.displayName} · {new Date(h.createdAt).toLocaleString()}
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
              <h2>{t('bw.aiAssist')}</h2>
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
                  {aiBusy ? '…' : t('bw.aiSuggest')}
                </button>
                <button
                  className="btn sm"
                  disabled={aiBusy}
                  onClick={() => {
                    void genFeedback();
                  }}
                >
                  {t('bw.aiFeedback')}
                </button>
              </div>

              {assessment && (
                <div className="sub-status sub-submitted" style={{ margin: 0 }}>
                  <strong>{t('bw.aiSuggestion')}</strong>
                  <div className="sub-feedback">
                    {assessment.suggestedPoints != null && (
                      <div>
                        {t('bw.aiPoints')}: {assessment.suggestedPoints}
                        {max != null ? ` / ${max}` : ''}
                      </div>
                    )}
                    {assessment.suggestedLevel && (
                      <div>
                        {t('bw.aiLevel')}: {t(`level.${assessment.suggestedLevel}`)}
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
                        {t('bw.aiModel')}: {assessment.model}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button className="btn sm primary" onClick={applyAssessment}>
                      {t('bw.aiApply')}
                    </button>
                  </div>
                </div>
              )}

              <p className="kh-muted" style={{ fontSize: 12, margin: 0 }}>
                {t('bw.aiDisclaimer')}
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{t('bw.grade')}</h2>
              <span className={`badge ${STATUS_BADGE[sub.status] ?? 'b-archived'}`}>
                {t(`status.${sub.status}`)}
              </span>
            </div>
            <div
              className="panel-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <label className="fld">
                <span className="field-label">
                  {t('bw.pointsAchieved')}
                  {max != null ? ` (max. ${max})` : ''}
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
                    <button type="button" className="btn sm" onClick={() => setPoints(String(max))}>
                      {t('bw.max')} ({max})
                    </button>
                  )}
                  {pct != null && <span className="badge b-published">{pct}%</span>}
                </div>
              </label>

              <label className="fld">
                <span className="field-label">{t('bw.level')}</span>
                <select
                  className="inline-select"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="">{t('bw.levelNone')}</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`level.${l}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fld">
                <span className="field-label">{t('bw.feedback')}</span>
                <textarea
                  className="text-input"
                  rows={4}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={t('bw.feedbackPlaceholder')}
                />
              </label>

              <button
                className="btn primary"
                disabled={busy}
                onClick={() => {
                  void save();
                }}
              >
                {t('bw.saveGrade')}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{t('bw.reject')}</h2>
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
                placeholder={t('bw.rejectReason')}
              />
              <button
                className="btn danger"
                disabled={busy}
                onClick={() => {
                  void doReject();
                }}
              >
                {t('bw.rejectBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
