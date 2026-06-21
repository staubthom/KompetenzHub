'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '../../components/AppShell';
import EvidenceSubmitPanel from '../../components/EvidenceSubmitPanel';
import { useToast } from '../../components/ToastProvider';
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

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};
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
function chipStatusLabel(status?: string): string {
  switch (status) {
    case 'GRADED':
      return 'Bewertet';
    case 'REJECTED':
      return 'Zurückgewiesen';
    case 'SUBMITTED':
      return 'Eingereicht';
    default:
      return 'Nachweis öffnen';
  }
}

export default function LernendeMatrixPage() {
  const toast = useToast();
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
      <div className="breadcrumb">Übersicht / Meine Matrix</div>
      <div className="page-head">
        <div>
          <h1>Meine Matrix</h1>
          <p>Deine Kompetenzbänder pro Modulanlass</p>
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
                    ? `Modul ${mod.number} · ${mod.title?.de ?? ''}`
                    : 'noch kein Modul zugeordnet'}
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
                ? `Modul ${matrix.module.number} · ${matrix.module.title?.de ?? ''}`
                : 'Kompetenzmatrix'}
            </h2>
          </div>
          {bands.length === 0 ? (
            <div className="empty">
              <span className="ic">▦</span>
              <p>Für dieses Modul wurde noch keine Matrix erfasst.</p>
            </div>
          ) : (
            <div className="tablewrap">
              <table className="smatrix">
                <thead>
                  <tr>
                    <th>Band</th>
                    {LEVELS.map((lvl) => (
                      <th key={lvl}>{LEVEL_LABEL[lvl]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bands.map((band) => (
                    <tr key={band.id}>
                      <td className="smatrix-band">
                        <div className="band-code">{band.code}</div>
                        {band.description?.de && (
                          <div className="band-desc">{band.description.de}</div>
                        )}
                      </td>
                      {LEVELS.map((lvl) => {
                        const field = band.fields.find((f: CompetenceField) => f.level === lvl);
                        const evidences = field?.evidences ?? [];
                        return (
                          <td key={lvl} className="smatrix-cell">
                            {field?.descriptor?.text?.de ? (
                              <>
                                <span className="field-code">{field.code}</span>
                                <span className="descriptor-text no-copy">
                                  {field.descriptor.text.de}
                                </span>
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
                                      title={`${chipStatusLabel(st)}: ${e.evidence.title?.de}`}
                                      onClick={() => {
                                        void openEvidenceDetail(e.evidence.id);
                                      }}
                                    >
                                      {chipIcon(st)} {e.evidence.title?.de}
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
          <h2>{hasClasses ? 'Weiterem Modulanlass beitreten' : 'Modulanlass beitreten'}</h2>
        </div>
        <div className="panel-body">
          <p className="kh-muted" style={{ marginTop: 0 }}>
            Gib den Beitrittscode deiner Lehrperson ein.
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
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button type="submit" className="btn primary" disabled={joining}>
              {joining ? 'Beitreten…' : 'Beitreten'}
            </button>
          </form>
        </div>
      </div>

      {!hasClasses && enrollments !== null && (
        <p className="kh-muted" style={{ textAlign: 'center' }}>
          Du bist noch keinem Modulanlass beigetreten. Sobald du beigetreten bist, erscheint hier
          deine Kompetenzmatrix.
        </p>
      )}

      {/* Nachweis einreichen (Modal) */}
      {openEvidence && (
        <div
          className="modal-overlay"
          onClick={() => {
            setOpenEvidence(null);
            void reloadMatrix();
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{openEvidence.title?.de}</h2>
              <button
                className="btn-icon"
                title="Schliessen"
                onClick={() => {
                  setOpenEvidence(null);
                  void reloadMatrix();
                }}
              >
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
