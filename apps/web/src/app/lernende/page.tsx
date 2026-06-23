'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '../../components/AppShell';
import EvidenceSubmitPanel from '../../components/EvidenceSubmitPanel';
import { useToast } from '../../components/ToastProvider';
import { useI18n, localized } from '../../lib/i18n';
import {
  classes,
  matrix as matrixApi,
  evidence as evidenceApi,
  type MyEnrollment,
  type MatrixResponse,
  type Band,
  type CompetenceField,
  type StudentEvidence,
} from '../../lib/api';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

function chipIcon(status?: string): string {
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

export default function LernendeMatrixPage() {
  const toast = useToast();
  const { t, locale } = useI18n();
  const chipStatusLabel = (status?: string) => (status ? t(`chip.${status}`) : t('chip.OPEN'));
  const [enrollments, setEnrollments] = useState<MyEnrollment[] | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);

  // Beitritt
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const autoJoinDone = useRef(false);

  // Nachweis öffnen (Einreichen-Modal)
  const [openEvidence, setOpenEvidence] = useState<StudentEvidence | null>(null);

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
    void reloadMatrix();
  }, []);

  // Komplexes Modal: schliesst NICHT beim Klick daneben, aber via Escape.
  useEffect(() => {
    if (!openEvidence) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEvidence();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openEvidence, closeEvidence]);

  const loadEnrollments = useCallback(async () => {
    try {
      const mine = await classes.mine();
      setEnrollments(mine);
      // Erstes Modul automatisch wählen
      const firstWithModule = mine.find((e) => e.class.module);
      if (firstWithModule?.class.module && !selectedModuleId) {
        setSelectedModuleId(firstWithModule.class.module.id);
      }
    } catch {
      toast.error('Modulanlässe konnten nicht geladen werden.');
    }
  }, [selectedModuleId, toast]);

  useEffect(() => {
    void loadEnrollments();
  }, [loadEnrollments]);

  const join = useCallback(
    async (rawCode: string) => {
      const c = rawCode.trim().toUpperCase();
      if (!c) return;
      setJoining(true);
      try {
        const res = await classes.join(c);
        setCode('');
        toast.success(`Modulanlass „${res.class.name}" beigetreten.`);
        await loadEnrollments();
      } catch (e: unknown) {
        const err = e as { status?: number; body?: { title?: string } };
        toast.error(
          err.status === 410
            ? 'Dieser Beitrittscode ist abgelaufen.'
            : (err.body?.title ?? 'Beitritt fehlgeschlagen. Code prüfen.'),
        );
      } finally {
        setJoining(false);
      }
    },
    [loadEnrollments, toast],
  );

  // Auto-Join über Beitrittslink (?code=…)
  useEffect(() => {
    if (autoJoinDone.current) return;
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) {
      autoJoinDone.current = true;
      void join(c);
      window.history.replaceState({}, '', '/lernende');
    }
  }, [join]);

  async function reloadMatrix() {
    if (!selectedModuleId) return;
    try {
      setMatrix(await matrixApi.get(selectedModuleId));
    } catch {
      toast.error('Matrix konnte nicht geladen werden.');
    }
  }

  useEffect(() => {
    if (!selectedModuleId) {
      setMatrix(null);
      return;
    }
    void (async () => {
      try {
        setMatrix(await matrixApi.get(selectedModuleId));
      } catch {
        toast.error('Matrix konnte nicht geladen werden.');
      }
    })();
  }, [selectedModuleId, toast]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    void join(code);
  }

  const bands: Band[] = matrix?.matrix?.bands ?? [];
  const hasClasses = enrollments && enrollments.length > 0;

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('common.overview')} / {t('mx.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('mx.title')}</h1>
          <p>{t('mx.subtitle')}</p>
        </div>
      </div>

      {/* Klassenauswahl */}
      {hasClasses && (
        <div className="classgrid">
          {enrollments!.map((e) => {
            const mod = e.class.module;
            const isActive = mod && selectedModuleId === mod.id;
            return (
              <button
                key={e.enrollmentId}
                className={`classcard ${isActive ? 'active' : ''}`}
                onClick={() => mod && setSelectedModuleId(mod.id)}
                disabled={!mod}
              >
                <div className="classcard-head">
                  <strong>{e.class.name}</strong>
                </div>
                <div className="kh-muted" style={{ fontSize: 13 }}>
                  {mod
                    ? `${t('common.module')} ${mod.number} · ${localized(mod.title, locale)}`
                    : t('common.noModule')}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Matrix-Anzeige (read-only) */}
      {selectedModuleId && (
        <div className="panel">
          <div className="panel-head">
            <h2>
              {matrix?.module
                ? `${t('common.module')} ${matrix.module.number} · ${localized(matrix.module.title, locale)}`
                : t('nav.matrix')}
            </h2>
          </div>
          {bands.length === 0 ? (
            <div className="empty">
              <span className="ic">▦</span>
              <p>{t('mx.noMatrix')}</p>
            </div>
          ) : (
            <div className="tablewrap">
              <table className="smatrix">
                <thead>
                  <tr>
                    <th>{t('mx.band')}</th>
                    {LEVELS.map((lvl) => (
                      <th key={lvl}>{t(`level.${lvl}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bands.map((band) => (
                    <tr key={band.id}>
                      <td className="smatrix-band">
                        <div className="band-code">{band.code}</div>
                        {localized(band.description, locale) && (
                          <div className="band-desc">{localized(band.description, locale)}</div>
                        )}
                      </td>
                      {LEVELS.map((lvl) => {
                        const field = band.fields.find((f: CompetenceField) => f.level === lvl);
                        const evidences = field?.evidences ?? [];
                        const descText = localized(field?.descriptor?.text, locale);
                        return (
                          <td key={lvl} className="smatrix-cell">
                            {descText ? (
                              <>
                                <span className="field-code">{field!.code}</span>
                                <span className="descriptor-text no-copy">{descText}</span>
                              </>
                            ) : (
                              <span className="descriptor-empty">—</span>
                            )}
                            {evidences.length > 0 && (
                              <div
                                className="field-evidence"
                                style={{ borderTop: 'none', padding: '8px 0 0' }}
                              >
                                {evidences.map((e) => {
                                  const st = e.evidence.submissions?.[0]?.status;
                                  return (
                                    <button
                                      key={e.evidence.id}
                                      className={`evidence-chip evidence-chip-btn${st ? ` chip-${st.toLowerCase()}` : ''}`}
                                      title={`${chipStatusLabel(st)}: ${localized(e.evidence.title, locale)}`}
                                      onClick={() => {
                                        void openEvidenceDetail(e.evidence.id);
                                      }}
                                    >
                                      {chipIcon(st)} {localized(e.evidence.title, locale)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Klasse beitreten (FA-23) */}
      <div className="panel">
        <div className="panel-head">
          <h2>{hasClasses ? t('mx.joinMore') : t('mx.joinTitle')}</h2>
        </div>
        <div className="panel-body">
          <p className="kh-muted" style={{ marginTop: 0 }}>
            {t('mx.joinHint')}
          </p>
          <form
            className="join-form"
            onSubmit={(e) => {
              void handleJoin(e);
            }}
          >
            <input
              className="join-input"
              placeholder="z. B. A1B2C3"
              aria-label={t('mx.joinTitle')}
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button type="submit" className="btn primary" disabled={joining}>
              {joining ? t('mx.joining') : t('mx.join')}
            </button>
          </form>
        </div>
      </div>

      {!hasClasses && enrollments !== null && (
        <p className="kh-muted" style={{ textAlign: 'center' }}>
          {t('mx.notJoined')}
        </p>
      )}

      {/* Nachweis einreichen (Modal) */}
      {openEvidence && (
        <div className="modal-overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={localized(openEvidence.title, locale)}
          >
            <div className="modal-head">
              <h2>{localized(openEvidence.title, locale)}</h2>
              <button className="btn-icon" title={t('common.cancel')} onClick={closeEvidence}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <EvidenceSubmitPanel ev={openEvidence} onSubmitted={() => void reloadMatrix()} />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
