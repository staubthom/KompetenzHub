'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import EvidenceSubmitPanel from '../../../components/EvidenceSubmitPanel';
import { useToast } from '../../../components/ToastProvider';
import {
  classes,
  learningPaths,
  evidence as evidenceApi,
  type ActiveLearningPath,
  type MyEnrollment,
  type StudentEvidence,
} from '../../../lib/api';

const STATUS_META: Record<string, { label: string; badge: string; node: string }> = {
  GRADED: { label: 'abgeschlossen', badge: 'b-published', node: '✓' },
  SUBMITTED: { label: 'eingereicht', badge: 'b-draft', node: '⏳' },
  REJECTED: { label: 'überarbeiten', badge: 'b-rejected', node: '↩' },
  OPEN: { label: 'offen', badge: 'b-archived', node: '•' },
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
      <div className="breadcrumb">Übersicht / Mein Lernpfad</div>
      <div className="page-head">
        <div>
          <h1>Mein Lernpfad</h1>
          <p>Empfohlene Reihenfolge · auf deinen Fortschritt abgestimmt</p>
        </div>
        <div className="seg" role="group" aria-label="Ansicht">
          <Link className="btn" href="/lernende">
            Matrix
          </Link>
          <button aria-pressed="true" className="btn primary">
            Lernpfad
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
          Du bist noch keinem Modulanlass mit Modul beigetreten.
        </p>
      ) : !data ? (
        <div className="loading">Lade…</div>
      ) : !path ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">➔</span>
            <p>
              Für dieses Modul wurde noch kein Lernpfad festgelegt. Nutze deine Matrix wie gewohnt.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="cards">
            <div className="card">
              <div className="k">Nächster Schritt</div>
              <div className="v" style={{ fontSize: 18 }}>
                {next ? next.code : 'alles erledigt 🎉'}
              </div>
              <div className="d">{next ? STATUS_META[next.status].label : '—'}</div>
            </div>
            <div className="card">
              <div className="k">Abgeschlossen</div>
              <div className="v" style={{ color: 'var(--st-graded)' }}>
                {path.doneCount} / {path.total}
              </div>
              <div className="d">Kompetenzen</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{path.name}</h2>
            </div>
            <div className="path">
              {path.steps.map((s, i) => {
                const meta = STATUS_META[s.status];
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
                        {s.code} — {s.descriptor?.de ?? s.level}
                      </div>
                      <div className="meta">
                        {s.isNext ? 'Dein nächster Schritt · ' : ''}
                        {meta.label}
                      </div>
                      <div className="card-mini" style={{ flexWrap: 'wrap' }}>
                        <span className={`badge ${meta.badge}`}>{meta.label}</span>
                        {s.evidences.length === 0 ? (
                          <span className="kh-muted" style={{ fontSize: 13 }}>
                            Noch kein Nachweis hinterlegt.
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {s.evidences.map((ev) => (
                              <button
                                key={ev.id}
                                className={`evidence-chip evidence-chip-btn chip-${ev.status.toLowerCase()}`}
                                title={`${STATUS_META[ev.status].label}: ${ev.title?.de ?? ''}`}
                                onClick={() => void openEvidenceDetail(ev.id)}
                              >
                                {chipIcon(ev.status)} {ev.title?.de}
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
              <h2>{openEvidence.title?.de}</h2>
              <button className="btn-icon" title="Schliessen" onClick={closeEvidence}>
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
