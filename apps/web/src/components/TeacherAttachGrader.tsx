'use client';

import { useEffect, useState } from 'react';
import { useToast } from './ToastProvider';
import { useI18n } from '../lib/i18n';
import { evidence, submissions, uploadAttachment, type SubmissionDetail } from '../lib/api';

const LEVELS = ['NOT_MET', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

/**
 * Einreichungsart „von Lehrperson angefügt": die Lehrperson lädt im
 * Kompetenzraster (Modulanlass → Lernende:r) für eine lernende Person eine
 * Datei hoch und trägt Punkte/Level/Feedback ein. Es entsteht eine Einreichung
 * im Namen der lernenden Person (Status „eingereicht" bis bewertet, danach
 * „bewertet"). Wird aus dem StudentMatrixViewer geöffnet.
 */
export default function TeacherAttachGrader({
  evidenceId,
  enrollmentId,
  evidenceTitle,
  displayName,
  maxPoints,
  existingSubmissionId,
  onBack,
  onSaved,
}: {
  evidenceId: string;
  enrollmentId: string;
  evidenceTitle: string;
  displayName: string;
  maxPoints: number | null;
  existingSubmissionId: string | null;
  onBack: () => void;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [fileKey, setFileKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [points, setPoints] = useState('');
  const [level, setLevel] = useState('');
  const [feedback, setFeedback] = useState('');
  const [upBusy, setUpBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  // Bestehende Einreichung (falls vorhanden) zum Vorbefüllen laden.
  useEffect(() => {
    if (!existingSubmissionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const d: SubmissionDetail = await submissions.detail(existingSubmissionId);
        if (cancelled) return;
        setPoints(d.evaluation?.points ?? '');
        setLevel(d.evaluation?.achievedLevel ?? '');
        setFeedback(d.evaluation?.feedback ?? '');
        if (d.fileName) setFileName(d.fileName);
        if (d.fileUrl) setFileUrl(d.fileUrl);
      } catch {
        /* Vorbefüllen ist optional. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existingSubmissionId]);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    toast.error(err.body?.title ?? 'Aktion fehlgeschlagen.');
  }

  async function pickFile(file: File) {
    setUpBusy(true);
    try {
      const { key, name } = await uploadAttachment(file);
      setFileKey(key);
      setFileName(name);
      setFileUrl(null); // neue, noch nicht gespeicherte Datei
      toast.success(`„${name}" hochgeladen.`);
    } catch (e: unknown) {
      showError(e);
    } finally {
      setUpBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await evidence.teacherSubmission(evidenceId, {
        enrollmentId,
        fileKey: fileKey || undefined,
        fileName: fileName || undefined,
        points: points === '' ? undefined : Number(points),
        level: level || undefined,
        feedback: feedback || undefined,
      });
      toast.success(t('ta.savedAttach'));
      onSaved?.();
      onBack();
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  const max = maxPoints;
  const pct = max != null && points !== '' ? Math.round((Number(points) / max) * 100) : null;
  const hasFile = !!fileName;

  return (
    <>
      <div className="breadcrumb">
        <button className="linklike" onClick={onBack}>
          {t('cl.viewMatrix')}
        </button>{' '}
        / {displayName}
      </div>
      <div className="page-head">
        <div>
          <h1>{evidenceTitle}</h1>
          <p>
            {displayName} · 📎 {t('ta.heading')}
          </p>
        </div>
        <button className="btn" onClick={onBack}>
          ← {t('common.back')}
        </button>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{t('ta.attachedFile')}</h2>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {hasFile ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {fileUrl ? (
                <a className="btn sm" href={fileUrl} target="_blank" rel="noopener">
                  ⬇ {fileName}
                </a>
              ) : (
                <span className="kh-muted">📎 {fileName}</span>
              )}
            </div>
          ) : (
            <p className="kh-muted" style={{ margin: 0 }}>
              {t('ta.noFileYet')}
            </p>
          )}
          <label className="btn sm" style={{ cursor: 'pointer', alignSelf: 'flex-start' }}>
            {upBusy ? '…' : hasFile ? t('ta.replaceFile') : t('ta.uploadFile')}
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickFile(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{t('bw.grade')}</h2>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            disabled={busy || upBusy}
            onClick={() => {
              void save();
            }}
          >
            {busy ? '…' : t('ta.saveAttach')}
          </button>
        </div>
      </div>
    </>
  );
}
