'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import EvidenceSubmitPanel from '../../../components/EvidenceSubmitPanel';
import { useToast } from '../../../components/ToastProvider';
import { useI18n, localized } from '../../../lib/i18n';
import {
  classes,
  learningPaths,
  evidence as evidenceApi,
  type ActiveLearningPath,
  type MyEnrollment,
  type StudentEvidence,
} from '../../../lib/api';

const STATUS_BADGE: Record<string, string> = {
  GRADED: 'b-published',
  SUBMITTED: 'b-draft',
  REJECTED: 'b-rejected',
  OPEN: 'b-archived',
};

function chipIcon(status: string): string {
  switch (status) {
    case 'GRADED':
      return '✅';
    case 'REJECTED':
      return '↩';
    case 'SUBMITTED':
      return '⏳';
    default:
      return '📎';
  }
}

export default function LernpfadPage() {
  const toast = useToast();
  const { t, locale } = useI18n();
  const [enrollments, setEnrollments] = useState<MyEnrollment[] | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [data, setData] = useState<ActiveLearningPath | null>(null);
  const [openEvidence, setOpenEvidence] = useState<StudentEvidence | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const mine = await classes.mine();
        setEnrollments(mine);
        const first = mine.find((e) => e.class.module);
        if (first?.class.module) setModuleId(first.class.module.id);
      } catch {
        toast.error('Modulanlässe konnten nicht geladen werden.');
      }
    })();
  }, [toast]);

  const loadPath = useCallback(
    async (mId: string) => {
      try {
        setData(await learningPaths.activeForModule(mId));
      } catch {
        toast.error('Lernpfad konnte nicht geladen werden.');
      }
    },
    [toast],
  );

  useEffect(() => {
    if (moduleId) void loadPath(moduleId);
  }, [moduleId, loadPath]);

  async function openEvidenceDetail(evidenceId: string) {
    try {
      setOpenEvidence(await evidenceApi.studentGet(evidenceId));
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? 'Nachweis konnte nicht geladen werden.');
    }
  }

  const closeEvidence = useCallback(() => {
    setOpenEvidence(null);
    if (moduleId) void loadPath(moduleId);
  }, [moduleId, loadPath]);

  useEffect(() => {
    if (!openEvidence) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEvidence();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openEvidence, closeEvidence]);

  const path = data?.path ?? null;
  const next = path?.steps.find((s) => s.isNext) ?? null;
  const hasModules = enrollments && enrollments.some((e) => e.class.module);

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('common.overview')} / {t('path.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('path.title')}</h1>
          <p>{t('path.subtitle')}</p>
        </div>
        <div className="seg" role="group" aria-label="Ansicht">
          <Link className="btn" href="/lernende">
            {t('path.viewMatrix')}
          </Link>
          <button aria-pressed="true" className="btn primary">
            {t('path.viewPath')}
          </button>
        </div>
      </div>

      {/* Modulauswahl bei mehreren */}
      {enrollments && enrollments.filter((e) => e.class.module).length > 1 && (
        <div
          className="seg"
          role="group"
          aria-label="Modul"
          style={{ marginBottom: 16, flexWrap: 'wrap' }}
        >
          {enrollments
            .filter((e) => e.class.module)
            .map((e) => (
              <button
                key={e.enrollmentId}
                aria-pressed={moduleId === e.class.module!.id}
                onClick={() => setModuleId(e.class.module!.id)}
              >
                {e.class.name}
              </button>
            ))}
        </div>
      )}

      {!hasModules && enrollments !== null ? (
        <p className="kh-muted" style={{ textAlign: 'center' }}>
          {t('path.noModule')}
        </p>
      ) : !data ? (
        <div className="loading">{t('common.loading')}</div>
      ) : !path ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">➔</span>
            <p>{t('path.none')}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="cards">
            <div className="card">
              <div className="k">{t('path.next')}</div>
              <div className="v" style={{ fontSize: 18 }}>
                {next ? next.code : t('path.allDone')}
              </div>
              <div className="d">{next ? t(`pathstatus.${next.status}`) : '—'}</div>
            </div>
            <div className="card">
              <div className="k">{t('path.done')}</div>
              <div className="v" style={{ color: 'var(--st-graded)' }}>
                {path.doneCount} / {path.total}
              </div>
              <div className="d">{t('path.competences')}</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{path.name}</h2>
            </div>
            <div className="path">
              {path.steps.map((s, i) => {
                const cls = s.status === 'GRADED' ? 'done' : s.isNext ? 'current' : '';
                const last = i === path.steps.length - 1;
                return (
                  <div key={s.id} className={`step ${cls}`}>
                    <div className="line">
                      <div className="node">{s.status === 'GRADED' ? '✓' : i + 1}</div>
                      {!last && <div className="connector" />}
                    </div>
                    <div className="body">
                      <div className="ti">
                        {s.code} — {localized(s.descriptor, locale) || t(`level.${s.level}`)}
                      </div>
                      <div className="meta">
                        {s.isNext ? t('path.yourNext') : ''}
                        {t(`pathstatus.${s.status}`)}
                      </div>
                      <div className="card-mini" style={{ flexWrap: 'wrap' }}>
                        <span className={`badge ${STATUS_BADGE[s.status]}`}>
                          {t(`pathstatus.${s.status}`)}
                        </span>
                        {s.evidences.length === 0 ? (
                          <span className="kh-muted" style={{ fontSize: 13 }}>
                            {t('path.noEvidence')}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {s.evidences.map((ev) => (
                              <button
                                key={ev.id}
                                className={`evidence-chip evidence-chip-btn chip-${ev.status.toLowerCase()}`}
                                title={`${t(`pathstatus.${ev.status}`)}: ${localized(ev.title, locale)}`}
                                onClick={() => void openEvidenceDetail(ev.id)}
                              >
                                {chipIcon(ev.status)} {localized(ev.title, locale)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Nachweis einreichen (Modal) – direkt aus dem Lernpfad */}
      {openEvidence && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-head">
              <h2>{localized(openEvidence.title, locale)}</h2>
              <button className="btn-icon" title={t('common.cancel')} onClick={closeEvidence}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <EvidenceSubmitPanel
                ev={openEvidence}
                onSubmitted={() => moduleId && void loadPath(moduleId)}
              />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
