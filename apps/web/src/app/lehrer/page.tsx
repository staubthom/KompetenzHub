'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import PluginSlot from '../../components/PluginSlot';
import { useToast } from '../../components/ToastProvider';
import { useI18n, localized } from '../../lib/i18n';
import { classes, dashboard, type ClassSummary, type ClassProgress } from '../../lib/api';

const LEVEL_SHORT: Record<string, string> = {
  BEGINNER: 'B',
  INTERMEDIATE: 'I',
  ADVANCED: 'A',
};

export default function LehrerDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { t, locale } = useI18n();
  const [list, setList] = useState<ClassSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ClassProgress | null>(null);

  const loadList = useCallback(async () => {
    try {
      const cs = await classes.list();
      setList(cs);
      if (cs.length > 0 && !selectedId) setSelectedId(cs[0].id);
    } catch {
      toast.error('Modulanlässe konnten nicht geladen werden.');
    }
  }, [selectedId, toast]);

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
        toast.error(err.body?.title ?? 'Fortschritt konnte nicht geladen werden.');
      }
    })();
  }, [selectedId, toast]);

  const fields =
    progress?.bands.flatMap((b) => b.fields.map((f) => ({ ...f, band: b.code }))) ?? [];

  /** Heatmap als CSV exportieren: erreichte Punkte je Aufgabe und Lernende:r. */
  function exportCsv() {
    if (!progress) return;
    const sep = ';';
    const esc = (v: string | number) => {
      const s = String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const evs = progress.evidences;
    const header = [
      t('dash.colLearner'),
      ...evs.map((e) => {
        const title = localized(e.title, locale) || '—';
        return e.maxPoints != null ? `${title} (max. ${e.maxPoints})` : title;
      }),
      `${t('dash.csvEarned')} (max. ${progress.maxPoints})`,
    ];
    const rows = progress.students.map((st) => [
      st.displayName,
      ...evs.map((e) => {
        const p = st.evidencePoints[e.id];
        return p == null ? '' : p;
      }),
      st.earnedPoints,
    ]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(sep)).join('\r\n');
    // BOM für korrekte Umlaut-Darstellung in Excel
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const modNr = progress.module ? `-modul-${progress.module.number}` : '';
    a.download = `heatmap-${progress.class.name}${modNr}.csv`.replace(/[^\w.-]+/g, '_');
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('dash.csvDone'));
  }

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('common.overview')} / {t('dash.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('dash.title')}</h1>
          <p>{t('dash.subtitle')}</p>
        </div>
        <Link href="/modules" className="btn primary">
          {t('dash.newModuleMatrix')}
        </Link>
      </div>

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
        <div className="loading">{t('common.loading')}</div>
      ) : list.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">▦</span>
            <p>
              {t('dash.emptyNoClasses')} <Link href="/lehrer/klassen">{t('nav.klassen')}</Link>
            </p>
          </div>
        </div>
      ) : !progress ? (
        <div className="loading">{t('dash.loadingProgress')}</div>
      ) : (
        <>
          {/* Kennzahlen-Karten (FA-91) */}
          <div className="cards">
            <div className="card">
              <div className="k">{t('dash.kpiLearners')}</div>
              <div className="v">{progress.studentCount}</div>
              <div className="d">
                {progress.module
                  ? `${t('common.module')} ${progress.module.number}`
                  : t('common.noModule')}
              </div>
            </div>
            <Link
              className="card"
              href="/lehrer/bewerten"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="k">{t('dash.kpiToGrade')}</div>
              <div className="v" style={{ color: 'var(--st-submitted)' }}>
                {progress.toGrade}
              </div>
              <div className="d">{t('dash.kpiToGradeHint')}</div>
            </Link>
            <div className="card">
              <div className="k">{t('dash.kpiGraded')}</div>
              <div className="v" style={{ color: 'var(--st-graded)' }}>
                {progress.graded}
              </div>
              <div className="d">{t('dash.kpiGradedHint')}</div>
            </div>
            <div className="card">
              <div className="k">{t('dash.kpiAvg')}</div>
              <div className="v">{progress.avgProgress}%</div>
              <div className="d">{t('dash.kpiAvgHint')}</div>
            </div>
            {/* Dashboard-Widgets aktiver Plugins (§10.3) */}
            <PluginSlot name="teacher.dashboard" />
          </div>

          {/* Fortschritts-Heatmap (FA-90) */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('dash.heatmap')}</h2>
              {progress.studentCount > 0 && fields.length > 0 && (
                <button className="btn sm" onClick={exportCsv}>
                  ⬇ {t('dash.csvExport')}
                </button>
              )}
            </div>
            <div className="legend">
              <span>
                <span className="dotc" style={{ background: 'var(--st-open-bg)' }} />{' '}
                {t('status.OPEN')}
              </span>
              <span>
                <span className="dotc" style={{ background: 'var(--st-submitted-bg)' }} />{' '}
                {t('status.SUBMITTED')}
              </span>
              <span>
                <span className="dotc" style={{ background: 'var(--st-graded-bg)' }} />{' '}
                {t('status.GRADED')}
              </span>
              <span>
                <span className="dotc" style={{ background: 'var(--st-rejected-bg)' }} />{' '}
                {t('status.REJECTED')}
              </span>
            </div>

            {progress.studentCount === 0 ? (
              <div className="empty">
                <p>{t('dash.noLearners')}</p>
              </div>
            ) : fields.length === 0 ? (
              <div className="empty">
                <p>{t('dash.noFields')}</p>
              </div>
            ) : (
              <div className="tablewrap">
                <table className="heatmap">
                  <thead>
                    <tr>
                      <th className="hm-name">{t('dash.colLearner')}</th>
                      {fields.map((f) => (
                        <th key={f.id} title={`${f.band} · ${f.level}`}>
                          {f.band}
                          {LEVEL_SHORT[f.level]}
                        </th>
                      ))}
                      <th>{t('dash.colProgress')}</th>
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
                          const cellLabel = `${f.band}${LEVEL_SHORT[f.level]} · ${t(`status.${status}`)}`;
                          return (
                            <td key={f.id} className="hm-cell-td">
                              {clickable ? (
                                <button
                                  type="button"
                                  className={`hm-cell hm-${status.toLowerCase()} hm-click`}
                                  title={cellLabel}
                                  aria-label={cellLabel}
                                  onClick={() => router.push('/lehrer/bewerten')}
                                >
                                  {label}
                                </button>
                              ) : (
                                <span
                                  className={`hm-cell hm-${status.toLowerCase()}`}
                                  title={cellLabel}
                                  aria-label={cellLabel}
                                >
                                  {label}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          <div className="hm-progress">
                            <div className="hm-progress-bar" style={{ width: `${st.progress}%` }} />
                          </div>
                          <span className="kh-muted" style={{ fontSize: 12 }}>
                            {st.progress}%
                            {progress.maxPoints > 0 && (
                              <span className="hm-points">
                                {' '}
                                · {st.earnedPoints} / {progress.maxPoints} {t('common.points')}
                              </span>
                            )}
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
