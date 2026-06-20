'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { classes } from '../../lib/api';

export default function LernendeMatrixPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState<{ name: string } | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    setError('');
    try {
      const res = await classes.join(code.trim());
      setJoined({ name: res.class.name });
      setCode('');
    } catch (e: unknown) {
      const err = e as { status?: number; body?: { title?: string } };
      setError(
        err.status === 410
          ? 'Dieser Beitrittscode ist abgelaufen.'
          : (err.body?.title ?? 'Beitritt fehlgeschlagen. Code prüfen.'),
      );
    } finally {
      setJoining(false);
    }
  }

  return (
    <AppShell>
      <div className="breadcrumb">Übersicht / Meine Matrix</div>
      <div className="page-head">
        <div>
          <h1>Meine Matrix</h1>
          <p>Dein Kompetenzraster mit Status &amp; Fortschritt</p>
        </div>
      </div>

      {/* Klasse beitreten (FA-23) */}
      <div className="panel">
        <div className="panel-head">
          <h2>Klasse beitreten</h2>
        </div>
        <div className="panel-body">
          {joined ? (
            <div className="join-success">
              ✓ Du bist der Klasse <strong>{joined.name}</strong> beigetreten.
              <button className="btn sm" style={{ marginLeft: 12 }} onClick={() => setJoined(null)}>
                Weiteren Code eingeben
              </button>
            </div>
          ) : (
            <>
              <p className="kh-muted" style={{ marginTop: 0 }}>
                Gib den Beitrittscode deiner Lehrperson ein, um einer Klasse beizutreten.
              </p>
              {error && <div className="error">{error}</div>}
              <form
                className="join-form"
                onSubmit={(e) => {
                  void handleJoin(e);
                }}
              >
                <input
                  className="join-input"
                  placeholder="z. B. A1B2C3"
                  value={code}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <button type="submit" className="btn primary" disabled={joining}>
                  {joining ? 'Beitreten…' : 'Beitreten'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Kompetenzbänder</h2>
        </div>
        <div className="empty">
          <span className="ic">▦</span>
          <p>
            Sobald du einer Klasse beigetreten bist, erscheint hier deine
            <br />
            persönliche Kompetenzmatrix mit Punkten und Status.
          </p>
          <p style={{ marginTop: '1rem' }}>
            Die Matrix-Ansicht mit Nachweisen folgt in Sprint 4 (FA-30..40).
          </p>
        </div>
      </div>
    </AppShell>
  );
}
