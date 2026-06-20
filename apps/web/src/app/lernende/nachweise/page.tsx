'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
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
        <NachweisDetail
          ev={active}
          onBack={() => {
            setActive(null);
            void load();
          }}
        />
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

function NachweisDetail({ ev, onBack }: { ev: StudentEvidence; onBack: () => void }) {
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const cfg = ev.config ?? {};

  function showError(e: unknown) {
    const err = e as { body?: { title?: string }; message?: string };
    setError(err.body?.title ?? err.message ?? 'Aktion fehlgeschlagen.');
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
    } catch (e: unknown) {
      showError(e);
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <button className="linklike" onClick={onBack}>
          Meine Nachweise
        </button>{' '}
        / {ev.title?.de}
      </div>
      <div className="page-head">
        <div>
          <h1>{ev.title?.de}</h1>
          {ev.dueAt && (
            <p>
              {ev.isOverdue ? (
                <span className="overdue">überfällig</span>
              ) : (
                `fällig ${new Date(ev.dueAt).toLocaleString('de-CH')}`
              )}
            </p>
          )}
        </div>
        <button className="btn" onClick={onBack}>
          ← Zurück
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {status && <div className="join-success">{status}</div>}

      {/* Aufgabenstellung (Rich-Text) */}
      {ev.instructions?.de && (
        <div className="panel">
          <div className="panel-head">
            <h2>Aufgabenstellung</h2>
          </div>
          <div
            className="panel-body rte-content"
            dangerouslySetInnerHTML={{ __html: ev.instructions.de }}
          />
        </div>
      )}

      {/* Einreichen */}
      <div className="panel">
        <div className="panel-head">
          <h2>Beleg einreichen</h2>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
      </div>
    </>
  );
}
