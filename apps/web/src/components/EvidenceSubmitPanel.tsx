'use client';

import { useState } from 'react';
import { evidence, type StudentEvidence } from '../lib/api';
import Celebration, { randomEffect } from './Celebration';

/**
 * Aufgabenstellung (Rich-Text) + Einreichung als Datei / Link / Text.
 * Wiederverwendbar auf der Nachweis-Seite und im Matrix-Modal.
 */
export default function EvidenceSubmitPanel({
  ev,
  onSubmitted,
}: {
  ev: StudentEvidence;
  onSubmitted?: () => void;
}) {
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [celebration, setCelebration] = useState<number | null>(null);
  const cfg = ev.config ?? {};

  function showError(e: unknown) {
    const err = e as { body?: { title?: string }; message?: string };
    setError(err.body?.title ?? err.message ?? 'Aktion fehlgeschlagen.');
  }

  function celebrate() {
    setJustSubmitted(true);
    setCelebration(randomEffect());
    onSubmitted?.();
  }

  async function uploadFile(file: File) {
    setError('');
    setStatus('Lade hoch…');
    try {
      const { uploadUrl, key } = await evidence.requestUpload(
        ev.id,
        file.name,
        file.type || 'application/octet-stream',
        file.size,
      );
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error('Upload zum Speicher fehlgeschlagen.');
      await evidence.confirmUpload(ev.id, key, file.name);
      setStatus(`✓ "${file.name}" eingereicht`);
      celebrate();
    } catch (e: unknown) {
      setStatus('');
      showError(e);
    }
  }

  async function submitLink() {
    setError('');
    try {
      await evidence.submitContent(ev.id, { link: link.trim() });
      setStatus('✓ Link eingereicht');
      setLink('');
      celebrate();
    } catch (e: unknown) {
      showError(e);
    }
  }

  async function submitText() {
    setError('');
    try {
      await evidence.submitContent(ev.id, { text: text.trim() });
      setStatus('✓ Text eingereicht');
      setText('');
      celebrate();
    } catch (e: unknown) {
      showError(e);
    }
  }

  const sub = ev.lastSubmission;
  const statusText: Record<string, string> = {
    SUBMITTED: 'Eingereicht – wartet auf Bewertung',
    GRADED: 'Bewertet',
    REJECTED: 'Zurückgewiesen – bitte überarbeiten',
    OPEN: 'Offen',
  };
  // Einreichen nur, wenn nichts Offenes existiert (oder zurückgewiesen) und nicht gerade eingereicht.
  const canSubmit = !justSubmitted && (!sub || sub.status === 'REJECTED');

  return (
    <>
      {error && <div className="error">{error}</div>}
      {status && <div className="join-success">{status}</div>}

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
        <div className="rte-content" dangerouslySetInnerHTML={{ __html: ev.instructions.de }} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
          {cfg.allowFile !== false && (
            <div>
              <div className="field-label">Datei hochladen</div>
              <label className="btn primary sm" style={{ cursor: 'pointer' }}>
                Datei wählen
                <input
                  type="file"
                  style={{ display: 'none' }}
                  accept={(cfg.allowedFileTypes ?? []).map((t) => `.${t}`).join(',')}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <span className="kh-muted" style={{ marginLeft: 10, fontSize: 12 }}>
                {(cfg.allowedFileTypes ?? []).length > 0 &&
                  `erlaubt: ${(cfg.allowedFileTypes ?? []).join(', ')}`}
                {cfg.maxFileSizeMb ? ` · max. ${cfg.maxFileSizeMb} MB` : ''}
              </span>
            </div>
          )}

          {cfg.allowLink !== false && (
            <div>
              <div className="field-label">Link einreichen</div>
              <div className="join-form">
                <input
                  className="link-input"
                  placeholder="https://…"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
                <button
                  className="btn primary"
                  disabled={!link.trim()}
                  onClick={() => {
                    void submitLink();
                  }}
                >
                  Link senden
                </button>
              </div>
            </div>
          )}

          {cfg.allowText !== false && (
            <div>
              <div className="field-label">Text einreichen</div>
              <textarea
                className="text-input"
                rows={4}
                placeholder="Deine Antwort …"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div style={{ marginTop: 8 }}>
                <button
                  className="btn primary"
                  disabled={!text.trim()}
                  onClick={() => {
                    void submitText();
                  }}
                >
                  Text senden
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {celebration !== null && (
        <Celebration effect={celebration} onDone={() => setCelebration(null)} />
      )}
    </>
  );
}
