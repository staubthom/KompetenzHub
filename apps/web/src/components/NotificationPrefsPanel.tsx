'use client';

import { useEffect, useState } from 'react';
import { updatePreferences } from '../lib/api';
import { getUser } from '../lib/session';
import { useToast } from './ToastProvider';
import { useI18n } from '../lib/i18n';

/**
 * Opt-out für den täglichen E-Mail-Digest (Abgaben/Bewertungen). Für alle
 * Rollen identisch nutzbar. Speichert die Einstellung am Konto (überlebt Logout).
 */
export default function NotificationPrefsPanel() {
  const toast = useToast();
  const { t } = useI18n();
  // Default true: Neue Konten erhalten den Digest, solange nicht abgewählt.
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = getUser();
    setEnabled(u?.notifyDigest ?? true);
  }, []);

  async function toggle(next: boolean) {
    const prev = enabled;
    setEnabled(next); // optimistisch
    setSaving(true);
    try {
      await updatePreferences({ notifyDigest: next });
      toast.success(t('settings.saved'));
    } catch (e: unknown) {
      setEnabled(prev); // zurückrollen
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? t('common.actionFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <div className="panel-head">
        <h2>{t('settings.notifications')}</h2>
      </div>
      <div className="form">
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            style={{ width: 'auto' }}
            onChange={(e) => void toggle(e.target.checked)}
          />
          {t('settings.digestLabel')}
        </label>
        <p className="kh-muted" style={{ fontSize: 12, marginTop: -8 }}>
          {t('settings.digestHint')}
        </p>
      </div>
    </div>
  );
}
