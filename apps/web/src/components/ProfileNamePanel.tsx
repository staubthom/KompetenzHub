'use client';

import { useEffect, useState } from 'react';
import { updatePreferences } from '../lib/api';
import { getUser } from '../lib/session';
import { useToast } from './ToastProvider';
import { useI18n } from '../lib/i18n';

/**
 * Selbstverwaltung des Anzeigenamens (der in der Kopfzeile unter u-info erscheint).
 * Für alle Rollen identisch nutzbar. Aktualisiert die Session und meldet die Änderung
 * der App-Shell (Event), damit der Name in der Kopfzeile sofort umschaltet.
 */
export default function ProfileNamePanel() {
  const toast = useToast();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [initial, setInitial] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = getUser();
    setName(u?.displayName ?? '');
    setInitial(u?.displayName ?? '');
  }, []);

  async function save() {
    const value = name.trim();
    if (!value || value === initial) return;
    setSaving(true);
    try {
      await updatePreferences({ displayName: value });
      setInitial(value);
      // App-Shell informieren → Kopfzeile (u-info) aktualisiert sich sofort.
      window.dispatchEvent(new Event('kh:user-updated'));
      toast.success(t('settings.saved'));
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? t('common.actionFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <div className="panel-head">
        <h2>{t('settings.profile')}</h2>
      </div>
      <div className="form">
        <label>
          {t('settings.nameLabel')}
          <input
            type="text"
            value={name}
            maxLength={120}
            placeholder={t('settings.nameLabel')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
          />
        </label>
        <p className="kh-muted" style={{ fontSize: 12, marginTop: -8 }}>
          {t('settings.nameHint')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn primary"
            disabled={saving || !name.trim() || name.trim() === initial}
            onClick={() => void save()}
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
