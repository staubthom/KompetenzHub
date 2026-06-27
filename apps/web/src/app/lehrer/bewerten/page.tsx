'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import SubmissionGrader from '../../../components/SubmissionGrader';
import { useToast } from '../../../components/ToastProvider';
import { useI18n, localized } from '../../../lib/i18n';
import { submissions, classes, type SubmissionListItem, type ClassSummary } from '../../../lib/api';

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: 'b-draft',
  GRADED: 'b-published',
  REJECTED: 'b-archived',
};

/** Wurde nach Ablauf der Frist eingereicht? */
function isLate(submittedAt: string | null, dueAt: string | null): boolean {
  if (!submittedAt || !dueAt) return false;
  return new Date(submittedAt) > new Date(dueAt);
}

export default function BewertenPage() {
  const { t, locale } = useI18n();
  const [list, setList] = useState<SubmissionListItem[] | null>(null);
  const [classList, setClassList] = useState<ClassSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [classFilter, setClassFilter] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const toast = useToast();

  async function loadList() {
    try {
      setList(
        await submissions.list({
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(classFilter ? { classId: classFilter } : {}),
        }),
      );
    } catch {
      toast.error('Einreichungen konnten nicht geladen werden.');
    }
  }
  useEffect(() => {
    void loadList();
  }, [statusFilter, classFilter]);

  useEffect(() => {
    void (async () => {
      try {
        setClassList(await classes.list());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  if (activeId) {
    return (
      <AppShell>
        <SubmissionGrader
          id={activeId}
          onBack={() => {
            setActiveId(null);
            void loadList();
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('common.overview')} / {t('bw.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('bw.title')}</h1>
          <p>{t('bw.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {classList.length > 0 && (
            <select
              className="inline-select"
              style={{ minWidth: 180 }}
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">{t('bw.allClasses')}</option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="seg" role="group" aria-label="Status">
            {['SUBMITTED', 'GRADED', 'REJECTED'].map((s) => (
              <button key={s} aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {t(`status.${s}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        {!list ? (
          <div className="loading">{t('bw.loading')}</div>
        ) : list.length === 0 ? (
          <div className="empty">
            <span className="ic">✓</span>
            <p>
              {t('bw.emptyStatus')} „{t(`status.${statusFilter}`)}".
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('bw.colLearner')}</th>
                <th>{t('bw.colEvidence')}</th>
                <th>{t('bw.colClass')}</th>
                <th>{t('bw.colSubmitted')}</th>
                <th>{t('common.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{s.enrollment.displayName}</td>
                  <td>{localized(s.evidence.title, locale)}</td>
                  <td className="kh-muted">{s.enrollment.class?.name ?? '—'}</td>
                  <td
                    className={isLate(s.submittedAt, s.evidence.dueAt) ? 'late-cell' : 'kh-muted'}
                  >
                    {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '—'}
                    {isLate(s.submittedAt, s.evidence.dueAt) && (
                      <span className="late-tag"> · {t('bw.late')}</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[s.status] ?? 'b-archived'}`}>
                      {t(`status.${s.status}`)}
                    </span>
                  </td>
                  <td>
                    <button className="btn sm" onClick={() => setActiveId(s.id)}>
                      {t('common.open')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
