'use client';

import { useState } from 'react';
import { evidence, uploadSubmissionFile, type StudentEvidence } from '../lib/api';
import Celebration, { randomEffect } from './Celebration';
import TrashIcon from './TrashIcon';
import { useToast } from './ToastProvider';

interface PendingFile {
  key: string;
  name: string;
  kind: 'file' | 'screenshot';
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
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [shotBusy, setShotBusy] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [celebration, setCelebration] = useState<number | null>(null);

  const cfg = ev.config ?? {};
  const sub = ev.lastSubmission;
  const canSubmit = !justSubmitted && (!sub || sub.status === 'REJECTED');

  const statusText: Record<string, string> = {
    SUBMITTED: 'Eingereicht – wartet auf Bewertung',
    GRADED: 'Bewertet',
    REJECTED: 'Zurückgewiesen – bitte überarbeiten',
    OPEN: 'Offen',
  };

  function showError(e: unknown) {
    const err = e as { body?: { title?: string }; message?: string };
    toast.error(err.body?.title ?? err.message ?? 'Aktion fehlgeschlagen.');
  }

  async function pickFile(file: File) {
    setBusy(true);
    try {
      const key = await uploadSubmissionFile(ev.id, file, file.name, 'file');
      setFiles((f) => [...f, { key, name: file.name, kind: 'file' }]);
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
      setFiles((f) => [...f, { key, name, kind: 'screenshot' }]);
      toast.success('Screenshot aufgenommen.');
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === 'NotAllowedError') return; // Nutzer hat abgebrochen
      showError(e);
    } finally {
      setShotBusy(false);
    }
  }

  function removeFile(key: string) {
    setFiles((f) => f.filter((x) => x.key !== key));
  }

  async function submitAll() {
    if (!text.trim() && !link.trim() && files.length === 0) {
      toast.error('Bitte zuerst Text, Link, Datei oder Screenshot hinzufügen.');
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
      setFiles([]);
      setJustSubmitted(true);
      setCelebration(randomEffect());
      toast.success('Erfolgreich eingereicht!');
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
              {ev.maxPoints ? ` / ${ev.maxPoints}` : ''} Punkte
              {sub.achievedLevel ? ` · ${sub.achievedLevel}` : ''}
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

      {ev.instructions?.de && (
        <div
          className="rte-content no-copy"
          onCopy={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          dangerouslySetInnerHTML={{ __html: ev.instructions.de }}
        />
      )}

      {/* Lehrer-Anhang zum Download */}
      {ev.attachmentUrl && (
        <p style={{ marginTop: 12 }}>
          <a className="btn sm" href={ev.attachmentUrl} target="_blank" rel="noopener">
            ⬇ {cfg.attachmentName ?? 'Anhang herunterladen'}
          </a>
        </p>
      )}

      {!canSubmit && (
        <p className="kh-muted" style={{ marginTop: 16 }}>
          {justSubmitted || sub?.status === 'SUBMITTED'
            ? '⏳ Bereits eingereicht – eine erneute Einreichung ist erst nach einer Rückweisung durch die Lehrperson möglich.'
            : sub?.status === 'GRADED'
              ? '✓ Dieser Nachweis wurde bereits bewertet.'
              : ''}
        </p>
      )}

      {canSubmit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {/* Hochgeladene Dateien/Screenshots (vor dem Einreichen löschbar) */}
          {files.length > 0 && (
            <ul className="hz-list" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
              {files.map((f) => (
                <li key={f.key} className="hz-item">
                  <span style={{ flex: 1 }}>
                    {f.kind === 'screenshot' ? '🖼' : '📄'} {f.name}
                  </span>
                  <button className="btn-icon" title="Entfernen" onClick={() => removeFile(f.key)}>
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cfg.allowFile !== false && (
              <label className="btn sm" style={{ cursor: 'pointer' }}>
                {busy ? '…' : '📄 Datei hinzufügen'}
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
                {shotBusy ? '…' : '🖼 Screenshot aufnehmen'}
              </button>
            )}
          </div>
          {cfg.allowFile !== false && (cfg.allowedFileTypes ?? []).length > 0 && (
            <span className="kh-muted" style={{ fontSize: 12, marginTop: -8 }}>
              erlaubt: {(cfg.allowedFileTypes ?? []).join(', ')}
              {cfg.maxFileSizeMb ? ` · max. ${cfg.maxFileSizeMb} MB` : ''}
            </span>
          )}

          {cfg.allowLink !== false && (
            <label className="fld">
              <span className="field-label">Link</span>
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
                Text{!cfg.allowPaste ? ' (Einfügen deaktiviert – bitte selbst schreiben)' : ''}
              </span>
              <textarea
                className="text-input"
                rows={5}
                placeholder="Deine Antwort …"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={(e) => {
                  if (!cfg.allowPaste) {
                    e.preventDefault();
                    toast.info('Einfügen ist für diesen Nachweis deaktiviert.');
                  }
                }}
                onDrop={(e) => {
                  if (!cfg.allowPaste) e.preventDefault();
                }}
              />
            </label>
          )}

          <div>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => {
                void submitAll();
              }}
            >
              {busy ? 'Wird eingereicht…' : '✓ Einreichen'}
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
