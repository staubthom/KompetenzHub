'use client';

import { useCallback, useEffect, useState } from 'react';
import SubmissionGrader from './SubmissionGrader';
import { useToast } from './ToastProvider';
import { useI18n, localized } from '../lib/i18n';
import {
  matrix as matrixApi,
  type MatrixResponse,
  type Band,
  type CompetenceField,
} from '../lib/api';
import { usePluginTabs } from '../plugins/usePluginTabs';

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

/**
 * Lehrer-Drilldown: zeigt die Matrix einer lernenden Person (Modulanlässe →
 * Mitglieder-Zeile). Über die Nachweis-Chips gelangt die Lehrperson direkt in die
 * Bewertung/Nachbewertung der jeweiligen Einreichung. Nachbewertungen werden
 * serverseitig in der Historie festgehalten.
 */
export default function StudentMatrixViewer({
  enrollmentId,
  moduleId,
  displayName,
  onClose,
}: {
  enrollmentId: string;
  moduleId: string;
  displayName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const { t, locale } = useI18n();
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('matrix');

  // Plugin-Tabs (z. B. "Notizen") für diese lernende Person.
  const pluginTabs = usePluginTabs('teacher.studentMatrix.tabs', {
    enrollmentId,
    moduleId,
    displayName,
  });
  const activePluginTab = pluginTabs.find((tb) => tb.id === activeTab);

  const chipStatusLabel = (status?: string) => (status ? t(`chip.${status}`) : t('chip.OPEN'));

  const reload = useCallback(async () => {
    try {
      setMatrix(await matrixApi.get(moduleId, enrollmentId));
    } catch {
      toast.error('Matrix konnte nicht geladen werden.');
    }
  }, [moduleId, enrollmentId, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Escape schliesst die Matrix-Ansicht (nicht aber den Bewertungs-Drilldown).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !gradingSubId) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, gradingSubId]);

  const bands: Band[] = matrix?.matrix?.bands ?? [];

  return (
    <div className="modal-overlay">
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label={`${t('cl.viewMatrix')} – ${displayName}`}
      >
        <div className="modal-head">
          <h2>
            {gradingSubId ? t('bw.grade') : t('cl.viewMatrix')} · {displayName}
            {matrix?.module ? ` · ${t('common.module')} ${matrix.module.number}` : ''}
          </h2>
          <button className="btn-icon" title={t('common.close')} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {/* Tab-Leiste: Kern-Tab "Matrix" + zusätzliche Plugin-Tabs (Tab-Slot) */}
          {pluginTabs.length > 0 && !gradingSubId && (
            <div
              className="seg"
              role="group"
              aria-label={t('cl.viewMatrix')}
              style={{ marginBottom: 14 }}
            >
              <button aria-pressed={activeTab === 'matrix'} onClick={() => setActiveTab('matrix')}>
                ▦ {t('cl.viewMatrix')}
              </button>
              {pluginTabs.map((tb) => (
                <button
                  key={tb.id}
                  aria-pressed={activeTab === tb.id}
                  onClick={() => {
                    setGradingSubId(null);
                    setActiveTab(tb.id);
                  }}
                >
                  {tb.icon ? `${tb.icon} ` : ''}
                  {tb.label}
                </button>
              ))}
            </div>
          )}

          {activePluginTab && !gradingSubId ? (
            activePluginTab.render()
          ) : gradingSubId ? (
            <SubmissionGrader
              id={gradingSubId}
              backLabel={t('cl.viewMatrix')}
              onBack={() => {
                setGradingSubId(null);
                void reload();
              }}
              onSaved={() => void reload()}
            />
          ) : !matrix ? (
            <div className="loading">{t('common.loading')}</div>
          ) : bands.length === 0 ? (
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
                                <span className="descriptor-text">{descText}</span>
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
                                  const sub = e.evidence.submissions?.[0];
                                  const st = sub?.status;
                                  return (
                                    <button
                                      key={e.evidence.id}
                                      className={`evidence-chip evidence-chip-btn${st ? ` chip-${st.toLowerCase()}` : ''}`}
                                      title={
                                        sub
                                          ? `${chipStatusLabel(st)} · ${t('cl.openGrading')}`
                                          : t('cl.notSubmittedYet')
                                      }
                                      onClick={() => {
                                        if (sub) setGradingSubId(sub.id);
                                        else toast.info(t('cl.notSubmittedYet'));
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
      </div>
    </div>
  );
}
