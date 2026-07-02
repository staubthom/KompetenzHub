'use client';

import { useEffect, useState } from 'react';
import { storage } from '../lib/api';
import { useI18n } from '../lib/i18n';

/** Bytes menschenlesbar (KB/MB/GB/TB). */
function formatBytes(n: number | null): string {
  if (n == null) return '–';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

/**
 * Eigener Speicherverbrauch der Lehrperson als Panel mit Balkendiagramm
 * (Verbrauch / persönliche Quota). Lädt die Daten selbst. `compact` blendet den
 * Erklärtext aus (für kompakte Platzierung, z. B. im Dashboard).
 */
export default function StorageUsagePanel({
  compact = false,
  maxWidth = 640,
}: {
  compact?: boolean;
  maxWidth?: number;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<{ bytes: number; quotaBytes: number | null } | null>(null);

  useEffect(() => {
    // Fehler nicht fatal: Panel bleibt dann im Ladezustand bzw. leer.
    void storage
      .myUsage()
      .then(setData)
      .catch(() => {});
  }, []);

  const bytes = data?.bytes ?? 0;
  const quota = data?.quotaBytes ?? null;
  const pct = quota != null && quota > 0 ? Math.min(100, Math.round((bytes / quota) * 100)) : null;
  const over = quota != null && bytes > quota;
  const barColor = over ? '#dc2626' : pct != null && pct >= 85 ? '#f59e0b' : '#2563eb';

  return (
    <div className="panel" style={{ maxWidth }}>
      <div className="panel-head">
        <h2>{t('storage.myUsage')}</h2>
        <span className="kh-muted">
          {quota != null
            ? `${formatBytes(bytes)} / ${formatBytes(quota)}`
            : formatBytes(data ? bytes : null)}
          {pct != null ? ` · ${pct}%` : ''}
        </span>
      </div>
      <div className="panel-body">
        {quota != null ? (
          <div
            style={{
              height: 10,
              background: 'var(--kh-border, #e5e7eb)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
            role="progressbar"
            aria-valuenow={pct ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              style={{
                height: '100%',
                width: `${pct ?? 0}%`,
                borderRadius: 6,
                background: barColor,
                transition: 'width .3s ease',
              }}
            />
          </div>
        ) : (
          <p className="kh-muted" style={{ margin: 0, fontSize: 13 }}>
            {t('storage.noLimit')}
          </p>
        )}
        {!compact && (
          <p className="kh-muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
            {t('storage.myUsageHint')}
          </p>
        )}
      </div>
    </div>
  );
}
