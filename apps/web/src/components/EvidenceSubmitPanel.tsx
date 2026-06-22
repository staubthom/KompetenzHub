'use client';

import { useEffect, useState } from 'react';
import { evidence, expertTalk, uploadSubmissionFile, type StudentEvidence } from '../lib/api';
import Celebration, { randomEffect } from './Celebration';
import ExpertTalkChat from './ExpertTalkChat';
import TrashIcon from './TrashIcon';
import { useToast } from './ToastProvider';
import { useI18n, localized } from '../lib/i18n';

interface PendingFile {
  key: string;
  name: string;
  kind: 'file' | 'screenshot';
  previewUrl?: string; // lokale Vorschau (Object-URL) für Bilder/Screenshots
}

/**
 * Aufgabenstellung (Rich-Text) + zentrale Einreichung als Datei / Link / Text /
 * Screenshot. Alle vorhandenen Teile werden mit EINEM Button eingereicht.
 */
export default function EvidenceSubmitPanel({
  ev,
  onSubmitted,
}: {
  ev: StudentEvidence;
  onSubmitted?: () => void;
}) {
  const toast = useToast();
  const { t, locale } = useI18n();
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [shotBusy, setShotBusy] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [celebration, setCelebration] = useState<number | null>(null);
  const [talkAvailable, setTalkAvailable] = useState<boolean | null>(null);
  const [showTalk, setShowTalk] = useState(false);

  const cfg = ev.config ?? {};
  const sub = ev.lastSubmission;
  const canSubmit = !justSubmitted && (!sub || sub.status === 'REJECTED');

  // Bei Einreichungsart „Fachgespräch/Präsentation": prüfen, ob KI im Mandanten aktiv ist.
  useEffect(() => {
    if (!cfg.allowExpertTalk) return;
    let cancelled = false;
    void (async () => {
      try {
        const { available } = await expertTalk.available();
        if (!cancelled) setTalkAvailable(available);
      } catch {
        if (!cancelled) setTalkAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg.allowExpertTalk]);

  const statusText: Record<string, string> = {
    SUBMITTED: t('sub.statusSubmitted'),
    GRADED: t('sub.statusGraded'),
    REJECTED: t('sub.statusRejected'),
    OPEN: t('sub.statusOpen'),
  };

  function showError(e: unknown) {
    const err = e as { body?: { title?: string }; message?: string };
    toast.error(err.body?.title ?? err.message ?? 'Aktion fehlgeschlagen.');
  }

  async function pickFile(file: File) {
    setBusy(true);
    try {
      const key = await uploadSubmissionFile(ev.id, file, file.name, 'file');
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      setFiles((f) => [...f, { key, name: file.name, kind: 'file', previewUrl }]);
      toast.success(`„${file.name}" hochgeladen.`);
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  async function captureScreenshot() {
    setShotBusy(true);
    try {
      const md = navigator.mediaDevices as MediaDevices & {
        getDisplayMedia?: (c: { video: boolean }) => Promise<MediaStream>;
      };
      if (!md?.getDisplayMedia) {
        toast.error('Screenshot wird von diesem Browser nicht unterstützt.');
        return;
      }
      const stream = await md.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      // Kurz warten, bis ein Frame vorliegt
      await new Promise((r) => setTimeout(r, 250));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Screenshot konnte nicht erstellt werden.');
      const name = `screenshot-${Date.now()}.png`;
      const key = await uploadSubmissionFile(ev.id, blob, name, 'screenshot');
      const previewUrl = URL.createObjectURL(blob);
      setFiles((f) => [...f, { key, name, kind: 'screenshot', previewUrl }]);
      toast.success('Screenshot aufgenommen – du kannst ihn vor der Abgabe ansehen.');
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === 'NotAllowedError') return; // Nutzer hat abgebrochen
      showError(e);
    } finally {
      setShotBusy(false);
    }
  }

  function removeFile(key: string) {
    setFiles((f) => {
      const target = f.find((x) => x.key === key);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return f.filter((x) => x.key !== key);
    });
  }

  async function submitAll() {
    // Bei reinem Fachgespräch/Präsentation ist keine Datei/Link/Text nötig.
    if (!text.trim() && !link.trim() && files.length === 0 && !cfg.allowExpertTalk) {
      toast.error(t('sub.needContent'));
      return;
    }
    setBusy(true);
    try {
      await evidence.submit(ev.id, {
        text: text.trim() || undefined,
        link: link.trim() || undefined,
        files,
      });
      setText('');
      setLink('');
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
      setFiles([]);
      setJustSubmitted(true);
      setCelebration(randomEffect());
      toast.success(t('sub.success'));
      onSubmitted?.();
    } catch (e: unknown) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Status der letzten Einreichung (FA-53) */}
      {sub && (
        <div className={`sub-status sub-${sub.status.toLowerCase()}`}>
          <strong>{statusText[sub.status] ?? sub.status}</strong>
          {sub.status === 'GRADED' && sub.points != null && (
            <span>
              {' '}
              · {sub.points}
              {ev.maxPoints ? ` / ${ev.maxPoints}` : ''} {t('common.points')}
              {sub.achievedLevel ? ` · ${t(`level.${sub.achievedLevel}`)}` : ''}
            </span>
          )}
          {sub.status === 'GRADED' && sub.feedback && (
            <div className="sub-feedback">💬 {sub.feedback}</div>
          )}
          {sub.status === 'REJECTED' && sub.rejectionReason && (
            <div className="sub-feedback">↩ {sub.rejectionReason}</div>
          )}
        </div>
      )}

      {localized(ev.instructions, locale) && (
        <div
          className="rte-content no-copy"
          onCopy={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          dangerouslySetInnerHTML={{ __html: localized(ev.instructions, locale) }}
        />
      )}

      {/* Lehrer-Anhang zum Download */}
      {ev.attachmentUrl && (
        <p style={{ marginTop: 12 }}>
          <a className="btn sm" href={ev.attachmentUrl} target="_blank" rel="noopener">
            ⬇ {cfg.attachmentName ?? t('sub.downloadAttachment')}
          </a>
        </p>
      )}

      {/* Fachgespräch / Präsentation: KI-Übung direkt im Abgabe-Dialog (FA-80) */}
      {cfg.allowExpertTalk && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <strong>🗣 {t('sub.expertTalkTitle')}</strong>
          {talkAvailable === false ? (
            <p className="kh-muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
              {t('sub.aiUnavailable')}
            </p>
          ) : !showTalk ? (
            <div style={{ marginTop: 6 }}>
              <p className="kh-muted" style={{ fontSize: 13, margin: '0 0 8px' }}>
                {t('sub.practiceHint')}
              </p>
              <button
                className="btn sm"
                disabled={talkAvailable === null}
                onClick={() => setShowTalk(true)}
              >
                {talkAvailable === null ? '…' : t('sub.practiceWithAi')}
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <ExpertTalkChat
                topic={localized(ev.title, locale) || t('sub.expertTalkTitle')}
                context={localized(ev.instructions, locale)}
              />
            </div>
          )}
        </div>
      )}

      {!canSubmit && (
        <p className="kh-muted" style={{ marginTop: 16 }}>
          {justSubmitted || sub?.status === 'SUBMITTED'
            ? t('sub.alreadySubmitted')
            : sub?.status === 'GRADED'
              ? t('sub.alreadyGraded')
              : ''}
        </p>
      )}

      {canSubmit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {/* Hochgeladene Dateien/Screenshots (vor dem Einreichen löschbar) */}
          {files.length > 0 && (
            <ul className="hz-list" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
              {files.map((f) => (
                <li key={f.key} className="hz-item" style={{ alignItems: 'center' }}>
                  {f.previewUrl ? (
                    <a
                      href={f.previewUrl}
                      target="_blank"
                      rel="noopener"
                      title={t('sub.previewOpen')}
                    >
                      <img
                        src={f.previewUrl}
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
                    <span>📄</span>
                  )}
                  <span style={{ flex: 1 }}>
                    {f.kind === 'screenshot' ? '🖼 ' : ''}
                    {f.name}
                  </span>
                  {f.previewUrl && (
                    <a className="btn sm" href={f.previewUrl} target="_blank" rel="noopener">
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
              ))}
            </ul>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cfg.allowFile !== false && (
              <label className="btn sm" style={{ cursor: 'pointer' }}>
                {busy ? '…' : t('sub.addFile')}
                <input
                  type="file"
                  style={{ display: 'none' }}
                  accept={(cfg.allowedFileTypes ?? []).map((t) => `.${t}`).join(',')}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void pickFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            {cfg.allowScreenshot && (
              <button
                className="btn sm"
                disabled={shotBusy}
                onClick={() => {
                  void captureScreenshot();
                }}
              >
                {shotBusy ? '…' : t('sub.screenshot')}
              </button>
            )}
          </div>
          {cfg.allowFile !== false && (cfg.allowedFileTypes ?? []).length > 0 && (
            <span className="kh-muted" style={{ fontSize: 12, marginTop: -8 }}>
              {t('sub.allowed')}: {(cfg.allowedFileTypes ?? []).join(', ')}
              {cfg.maxFileSizeMb ? ` · max. ${cfg.maxFileSizeMb} MB` : ''}
            </span>
          )}

          {cfg.allowLink !== false && (
            <label className="fld">
              <span className="field-label">{t('sub.link')}</span>
              <input
                className="link-input"
                placeholder="https://…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </label>
          )}

          {cfg.allowText !== false && (
            <label className="fld">
              <span className="field-label">
                {!cfg.allowPaste ? t('sub.textNoPaste') : t('sub.text')}
              </span>
              <textarea
                className="text-input"
                rows={5}
                placeholder={t('sub.answerPlaceholder')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={(e) => {
                  if (!cfg.allowPaste) {
                    e.preventDefault();
                    toast.info(t('sub.textNoPaste'));
                  }
                }}
                onDrop={(e) => {
                  if (!cfg.allowPaste) e.preventDefault();
                }}
              />
            </label>
          )}

          {cfg.allowExpertTalk &&
            cfg.allowFile === false &&
            cfg.allowLink === false &&
            cfg.allowText === false &&
            !cfg.allowScreenshot && (
              <p className="kh-muted" style={{ fontSize: 13, margin: 0 }}>
                {t('sub.expertTalkNoFile')}
              </p>
            )}

          <div>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => {
                void submitAll();
              }}
            >
              {busy ? t('sub.submitting') : t('sub.submit')}
            </button>
          </div>
        </div>
      )}

      {celebration !== null && (
        <Celebration effect={celebration} onDone={() => setCelebration(null)} />
      )}
    </>
  );
}
