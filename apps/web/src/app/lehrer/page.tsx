'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { classes, dashboard, type ClassSummary, type ClassProgress } from '../../lib/api';

const LEVEL_SHORT: Record<string, string> = {
  BEGINNER: 'B',
  INTERMEDIATE: 'I',
  ADVANCED: 'A',
};

export default function LehrerDashboardPage() {
  const router = useRouter();
  const [list, setList] = useState<ClassSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ClassProgress | null>(null);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    try {
      const cs = await classes.list();
      setList(cs);
      if (cs.length > 0 && !selectedId) setSelectedId(cs[0].id);
    } catch (e: unknown) {
      setError(String(e));
    }
  }, [selectedId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setProgress(null);
      return;
    }
    void (async () => {
      try {
        setProgress(await dashboard.progress(selectedId));
      } catch (e: unknown) {
        const err = e as { body?: { title?: string } };
        setError(err.body?.title ?? String(e));
      }
    })();
  }, [selectedId]);

  const fields =
    progress?.bands.flatMap((b) => b.fields.map((f) => ({ ...f, band: b.code }))) ?? [];

  return (
    <AppShell>
      <div className="breadcrumb">Übersicht / Dashboard</div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Fortschritt deiner Modulanlässe auf einen Blick</p>
        </div>
        <Link href="/modules" className="btn primary">
          + Modul &amp; Matrix
        </Link>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Modulanlass-Auswahl */}
      {list && list.length > 1 && (
        <div
          className="seg"
          role="group"
          aria-label="Modulanlass"
          style={{ marginBottom: 16, flexWrap: 'wrap' }}
        >
          {list.map((c) => (
            <button
              key={c.id}
              aria-pressed={selectedId === c.id}
              onClick={() => setSelectedId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {!list ? (
        <div className="loading">Lade…</div>
      ) : list.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">▦</span>
            <p>
              Noch keine Modulanlässe. Lege unter <Link href="/lehrer/klassen">Modulanlässe</Link>{' '}
              einen an.
            </p>
          </div>
        </div>
      ) : !progress ? (
        <div className="loading">Lade Fortschritt…</div>
      ) : (
        <>
          {/* Kennzahlen-Karten (FA-91) */}
          <div className="cards">
            <div className="card">
              <div className="k">Lernende</div>
              <div className="v">{progress.studentCount}</div>
              <div className="d">
                {progress.module ? `Modul ${progress.module.number}` : 'kein Modul'}
              </div>
            </div>
            <Link
              className="card"
              href="/lehrer/bewerten"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="k">Zu bewerten</div>
              <div className="v" style={{ color: 'var(--st-submitted)' }}>
                {progress.toGrade}
              </div>
              <div className="d">offene Einreichungen →</div>
            </Link>
            <div className="card">
              <div className="k">Bewertet</div>
              <div className="v" style={{ color: 'var(--st-graded)' }}>
                {progress.graded}
              </div>
              <div className="d">Nachweise total</div>
            </div>
            <div className="card">
              <div className="k">Ø Fortschritt</div>
              <div className="v">{progress.avgProgress}%</div>
              <div className="d">bewertete Felder</div>
            </div>
          </div>

          {/* Fortschritts-Heatmap (FA-90) */}
          <div className="panel">
            <div className="panel-head">
              <h2>Fortschritts-Heatmap</h2>
            </div>
            <div className="legend">
              <span>
                <span className="dotc" style={{ background: 'var(--st-open-bg)' }} /> Offen
              </span>
              <span>
                <span className="dotc" style={{ background: 'var(--st-submitted-bg)' }} />{' '}
                Eingereicht
              </span>
              <span>
                <span className="dotc" style={{ background: 'var(--st-graded-bg)' }} /> Bewertet
              </span>
              <span>
                <span className="dotc" style={{ background: 'var(--st-rejected-bg)' }} />{' '}
                Zurückgewiesen
              </span>
            </div>

            {progress.studentCount === 0 ? (
              <div className="empty">
                <p>Noch keine Lernenden in diesem Modulanlass.</p>
              </div>
            ) : fields.length === 0 ? (
              <div className="empty">
                <p>Für das zugeordnete Modul gibt es noch keine Kompetenzfelder.</p>
              </div>
            ) : (
              <div className="tablewrap">
                <table className="heatmap">
                  <thead>
                    <tr>
                      <th className="hm-name">Lernende:r</th>
                      {fields.map((f) => (
                        <th key={f.id} title={`${f.band} · ${f.level}`}>
                          {f.band}
                          {LEVEL_SHORT[f.level]}
                        </th>
                      ))}
                      <th>Fortschritt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.students.map((st) => (
                      <tr key={st.enrollmentId}>
                        <td className="hm-name">{st.displayName}</td>
                        {fields.map((f) => {
                          const cell = st.cells[f.id];
                          const status = cell?.status ?? 'OPEN';
                          const label =
                            status === 'GRADED'
                              ? cell?.points != null && cell?.maxPoints
                                ? `${Math.round((cell.points / cell.maxPoints) * 100)}`
                                : '✓'
                              : status === 'REJECTED'
                                ? '!'
                                : '·';
                          const clickable = f.evidenceCount > 0 && status !== 'OPEN';
                          return (
                            <td key={f.id} className="hm-cell-td">
                              <span
                                className={`hm-cell hm-${status.toLowerCase()}${clickable ? ' hm-click' : ''}`}
                                title={`${f.band}${LEVEL_SHORT[f.level]} · ${status}`}
                                onClick={() => clickable && router.push('/lehrer/bewerten')}
                              >
                                {label}
                              </span>
                            </td>
                          );
                        })}
                        <td>
                          <div className="hm-progress">
                            <div className="hm-progress-bar" style={{ width: `${st.progress}%` }} />
                          </div>
                          <span className="kh-muted" style={{ fontSize: 12 }}>
                            {st.progress}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
