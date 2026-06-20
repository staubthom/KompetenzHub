'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import EvidenceSubmitPanel from '../../components/EvidenceSubmitPanel';
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

export default function LernendeMatrixPage() {
  const [enrollments, setEnrollments] = useState<MyEnrollment[] | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);
  const [error, setError] = useState('');

  // Beitritt
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Nachweis öffnen (Einreichen-Modal)
  const [openEvidence, setOpenEvidence] = useState<StudentEvidence | null>(null);

  async function openEvidenceDetail(evidenceId: string) {
    try {
      setOpenEvidence(await evidenceApi.studentGet(evidenceId));
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      setError(err.body?.title ?? 'Nachweis konnte nicht geladen werden.');
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
    } catch (e: unknown) {
      setError(String(e));
    }
  }, [selectedModuleId]);

  useEffect(() => {
    void loadEnrollments();
  }, [loadEnrollments]);

  useEffect(() => {
    if (!selectedModuleId) {
      setMatrix(null);
      return;
    }
    void (async () => {
      try {
        setMatrix(await matrixApi.get(selectedModuleId));
      } catch (e: unknown) {
        setError(String(e));
      }
    })();
  }, [selectedModuleId]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    setError('');
    try {
      await classes.join(code.trim());
      setCode('');
      await loadEnrollments();
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

      {error && <div className="error">{error}</div>}

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
            <div className="matrix">
              <div className="matrix-header">
                <div>Band</div>
                {LEVELS.map((lvl) => (
                  <div key={lvl}>{LEVEL_LABEL[lvl]}</div>
                ))}
              </div>
              {bands.map((band) => (
                <div
                  key={band.id}
                  className="matrix-row"
                  style={{ gridTemplateColumns: '180px 1fr 1fr 1fr' }}
                >
                  <div className="band-col">
                    <div className="band-code">{band.code}</div>
                    {band.description?.de && <div className="band-desc">{band.description.de}</div>}
                  </div>
                  {LEVELS.map((lvl) => {
                    const field = band.fields.find((f: CompetenceField) => f.level === lvl);
                    const evidences = field?.evidences ?? [];
                    return (
                      <div key={lvl} className="level-col" style={{ padding: 12 }}>
                        {field?.descriptor?.text?.de ? (
                          <>
                            <span className="field-code">{field.code}</span>
                            <span className="descriptor-text">{field.descriptor.text.de}</span>
                          </>
                        ) : (
                          <span className="descriptor-empty">—</span>
                        )}
                        {evidences.length > 0 && (
                          <div
                            className="field-evidence"
                            style={{ borderTop: 'none', padding: '8px 0 0' }}
                          >
                            {evidences.map((e) => (
                              <button
                                key={e.evidence.id}
                                className="evidence-chip evidence-chip-btn"
                                title={`Nachweis öffnen: ${e.evidence.title?.de}`}
                                onClick={() => {
                                  void openEvidenceDetail(e.evidence.id);
                                }}
                              >
                                📎 {e.evidence.title?.de}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
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
        <div className="modal-overlay" onClick={() => setOpenEvidence(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{openEvidence.title?.de}</h2>
              <button className="btn-icon" title="Schliessen" onClick={() => setOpenEvidence(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <EvidenceSubmitPanel ev={openEvidence} />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
