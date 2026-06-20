'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { evidence, type StudentEvidence } from '../../../lib/api';

export default function NachweisePage() {
  const [list, setList] = useState<StudentEvidence[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Record<string, string>>({});

  async function load() {
    try {
      setList(await evidence.studentList('FILE_UPLOAD'));
    } catch (e: unknown) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function handleUpload(ev: StudentEvidence, file: File) {
    setError('');
    setStatus((s) => ({ ...s, [ev.id]: 'Lade hoch…' }));
    try {
      // 1. presigned URL anfordern (Backend validiert Typ & Grösse)
      const { uploadUrl, key } = await evidence.requestUpload(
        ev.id,
        file.name,
        file.type || 'application/octet-stream',
        file.size,
      );
      // 2. Datei direkt an S3/MinIO laden (nicht über die API)
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error('Upload zum Speicher fehlgeschlagen.');
      // 3. Upload bestätigen → Einreichung anlegen
      await evidence.confirmUpload(ev.id, key, file.name);
      setStatus((s) => ({ ...s, [ev.id]: `✓ "${file.name}" eingereicht` }));
    } catch (e: unknown) {
      const err = e as { body?: { title?: string }; message?: string };
      setStatus((s) => ({ ...s, [ev.id]: '' }));
      setError(err.body?.title ?? err.message ?? 'Upload fehlgeschlagen.');
    }
  }

  return (
    <AppShell>
      <div className="breadcrumb">Meine Matrix / Meine Nachweise</div>
      <div className="page-head">
        <div>
          <h1>Meine Nachweise</h1>
          <p>Datei-Nachweise hochladen und einreichen</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="panel">
        {!list ? (
          <div className="loading">Lade Nachweise…</div>
        ) : list.length === 0 ? (
          <div className="empty">
            <span className="ic">📄</span>
            <p>Aktuell sind keine Upload-Nachweise verfügbar.</p>
          </div>
        ) : (
          <div className="evidence-list">
            {list.map((ev) => {
              const types = ev.config.allowedFileTypes ?? [];
              return (
                <div key={ev.id} className="evidence-item">
                  <div>
                    <strong>{ev.title?.de}</strong>
                    <div className="evidence-meta">
                      {types.length > 0 && `erlaubt: ${types.join(', ')}`}
                      {ev.config.maxFileSizeMb ? ` · max. ${ev.config.maxFileSizeMb} MB` : ''}
                      {ev.dueAt && (
                        <>
                          {' '}
                          ·{' '}
                          {ev.isOverdue ? (
                            <span className="overdue">überfällig</span>
                          ) : (
                            `fällig ${new Date(ev.dueAt).toLocaleDateString('de-CH')}`
                          )}
                        </>
                      )}
                    </div>
                    {status[ev.id] && (
                      <div className="evidence-meta" style={{ color: 'var(--st-graded)' }}>
                        {status[ev.id]}
                      </div>
                    )}
                  </div>
                  <label className="btn primary sm" style={{ cursor: 'pointer' }}>
                    Datei wählen
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      accept={types.map((t) => `.${t}`).join(',')}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUpload(ev, f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
