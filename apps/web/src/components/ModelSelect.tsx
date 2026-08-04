'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';

/** Sentinel-Wert der Option „anderes Modell" – kollidiert mit keiner Modell-ID. */
const MANUAL = '__manual__';

/**
 * Modell-Auswahl für die KI-Einstellungen.
 *
 * Nach einem erfolgreichen Verbindungstest liefert der Endpoint seine Modell-Liste;
 * dann steht hier ein Dropdown statt eines Freitextfelds. Solange keine Liste
 * vorliegt – oder wenn das gewünschte Modell nicht gelistet ist (z. B. Azure-
 * Deployments) – bleibt die manuelle Eingabe möglich.
 */
export default function ModelSelect({
  value,
  models,
  onChange,
}: {
  value: string;
  models: string[];
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const [manual, setManual] = useState(false);

  const known = models.includes(value);
  // Ein bereits gespeichertes, aber nicht gelistetes Modell darf nicht still
  // verschwinden – dann direkt in die manuelle Eingabe wechseln.
  useEffect(() => {
    if (models.length > 0 && value && !models.includes(value)) setManual(true);
  }, [models, value]);

  if (models.length === 0 || manual) {
    return (
      <>
        <input
          type="text"
          placeholder="z. B. gpt-4o-mini"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="kh-muted" style={{ fontSize: 11, fontWeight: 400 }}>
          {models.length === 0 ? (
            t('ki.modelTestFirst')
          ) : (
            <button type="button" className="linklike" onClick={() => setManual(false)}>
              {t('ki.modelBackToList')}
            </button>
          )}
        </span>
      </>
    );
  }

  return (
    <>
      <select
        value={known ? value : ''}
        onChange={(e) => {
          if (e.target.value === MANUAL) {
            setManual(true);
            return;
          }
          onChange(e.target.value);
        }}
      >
        {!known && <option value="">{t('ki.modelChoose')}</option>}
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value={MANUAL}>{t('ki.modelManual')}</option>
      </select>
      <span className="kh-muted" style={{ fontSize: 11, fontWeight: 400 }}>
        {t('ki.modelCount', { count: String(models.length) })}
      </span>
    </>
  );
}
