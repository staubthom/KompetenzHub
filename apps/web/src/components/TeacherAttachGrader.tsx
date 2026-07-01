'use client';

import { useEffect, useState } from 'react';
import { useToast } from './ToastProvider';
import { useI18n } from '../lib/i18n';
import TrashIcon from './TrashIcon';
import { evidence, submissions, uploadAttachment, type SubmissionDetail } from '../lib/api';

const LEVELS = ['NOT_MET', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

interface AttachFile {
  key: string;
  name: string;
  /** Presigned-Download-URL bereits gespeicherter Dateien. */
  url?: string;
  /** Lokale Vorschau-URL (Object-URL) neu hochgeladener Bilder. */
  previewUrl?: string;
}

function isImage(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

/**
 * Einreichungsart „von Lehrperson angefügt": die Lehrperson lädt im
 * Kompetenzraster (Modulanlass → Lernende:r) für eine lernende Person eine oder
 * mehrere Dateien hoch (auch per Drag & Drop) und trägt Punkte/Level/Feedback
 * ein. Es entsteht eine Einreichung im Namen der lernenden Person (Status
 * „eingereicht" bis bewertet, danach „bewertet"). Wird aus dem
 * StudentMatrixViewer geöffnet.
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
  const [files, setFiles] = useState<AttachFile[]>([]);
  const [points, setPoints] = useState('');
  const [level, setLevel] = useState('');
  const [feedback, setFeedback] = useState('');
  const [upBusy, setUpBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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
        // Keys aus content.files, Download-URLs aus files (gleiche Reihenfolge).
        const keyed = d.content?.files ?? [];
        const urls = d.files ?? [];
        const existing: AttachFile[] = keyed.map((f, i) => ({
          key: f.key,
          name: f.name,
          url: urls[i]?.url,
        }));
        // Fallback: Einzeldatei aus fileKey/fileName, falls content.files leer ist.
        if (existing.length === 0 && d.fileKey) {
          existing.push({
            key: d.fileKey,
            name: d.fileName ?? 'Datei',
            url: d.fileUrl ?? undefined,
          });
        }
        setFiles(existing);
      } catch {
        /* Vorbefüllen ist optional. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existingSubmissionId]);

  // Lokale Vorschau-URLs beim Unmount freigeben.
  useEffect(() => {
    return () => {
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    };
  }, []);

  function showError(e: unknown) {
    const err = e as { body?: { title?: string } };
    toast.error(err.body?.title ?? t('common.actionFailed'));
  }

  async function addFiles(fileList: File[]) {
    if (fileList.length === 0) return;
    setUpBusy(true);
    try {
      for (const file of fileList) {
        const { key, name } = await uploadAttachment(file);
        const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
        setFiles((prev) => [...prev, { key, name, previewUrl }]);
      }
      toast.success(
        fileList.length === 1
          ? t('toast.fileUploaded', { name: fileList[0].name })
          : t('toast.filesUploaded', { count: fileList.length }),
      );
    } catch (e: unknown) {
      showError(e);
    } finally {
      setUpBusy(false);
    }
  }

  function removeFile(key: string) {
    setFiles((prev) => {
      const target = prev.find((f) => f.key === key);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.key !== key);
    });
  }

  async function save() {
    setBusy(true);
    try {
      await evidence.teacherSubmission(evidenceId, {
        enrollmentId,
        files: files.map((f) => ({ key: f.key, name: f.name })),
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
          {/* Datei-Ansicht: Bilder als Vorschau, andere als Download-Link. */}
          {files.length > 0 ? (
            <ul
              className="hz-list"
              style={{ border: '1px solid var(--border)', borderRadius: 8, margin: 0 }}
            >
              {files.map((f) => {
                const viewUrl = f.previewUrl ?? f.url;
                return (
                  <li key={f.key} className="hz-item" style={{ alignItems: 'center', gap: 10 }}>
                    {isImage(f.name) && viewUrl ? (
                      <a href={viewUrl} target="_blank" rel="noopener" title={f.name}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- presigned/Blob-URL, kein next/image */}
                        <img
                          src={viewUrl}
                          alt={f.name}
                          style={{
                            width: 64,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            display: 'block',
                          }}
                        />
                      </a>
                    ) : (
                      <span aria-hidden>📄</span>
                    )}
                    <span style={{ flex: 1, wordBreak: 'break-all' }}>{f.name}</span>
                    {viewUrl && (
                      <a className="btn sm" href={viewUrl} target="_blank" rel="noopener">
                        {t('sub.view')}
                      </a>
                    )}
                    <button
                      className="btn-icon"
                      title={t('common.delete')}
                      onClick={() => removeFile(f.key)}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="kh-muted" style={{ margin: 0 }}>
              {t('ta.noFileYet')}
            </p>
          )}

          {/* Drag-&-Drop-Zone + Mehrfach-Auswahl. */}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = Array.from(e.dataTransfer.files);
              if (dropped.length) void addFiles(dropped);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '18px 14px',
              border: `2px dashed ${dragOver ? 'var(--primary, #2563eb)' : 'var(--border)'}`,
              borderRadius: 8,
              background: dragOver ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 22 }} aria-hidden>
              ⬆
            </span>
            <strong>{upBusy ? '…' : t('ta.dropFiles')}</strong>
            <span className="kh-muted" style={{ fontSize: 12 }}>
              {t('ta.dropHint')}
            </span>
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                if (picked.length) void addFiles(picked);
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
