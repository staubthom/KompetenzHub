'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { useToast } from '../../../components/ToastProvider';
import { useI18n, LOCALES, LOCALE_LABEL, type Locale } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../../lib/session';
import { admin, type MailTemplate } from '../../../lib/api';

const TYPES = ['INVITE', 'INVITE_REMINDER', 'DIGEST', 'WEEKLY_REPORT', 'SECURITY_ALERT'] as const;
type TemplateType = (typeof TYPES)[number];

export default function AdminMailTemplatesPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();

  const [items, setItems] = useState<MailTemplate[]>([]);
  const [type, setType] = useState<TemplateType>('INVITE');
  const [editLocale, setEditLocale] = useState<Locale>('de');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u && !isAdmin(u)) router.replace(homePathForRole(u));
  }, [router]);

  const load = useCallback(async () => {
    try {
      setItems(await admin.mailTemplates());
    } catch {
      toast.error(t('common.actionFailed'));
    }
  }, [toast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = useMemo(
    () => items.find((i) => i.type === type && i.locale === editLocale),
    [items, type, editLocale],
  );

  // Editor mit der aktuellen (effektiven) Vorlage füllen, wenn Typ/Sprache wechselt.
  useEffect(() => {
    if (current) {
      setSubject(current.subject);
      setBody(current.body);
    }
  }, [current]);

  async function save() {
    setSaving(true);
    try {
      await admin.updateMailTemplate(type, editLocale, { subject, body });
      toast.success(t('settings.saved'));
      await load();
    } catch {
      toast.error(t('common.actionFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      await admin.resetMailTemplate(type, editLocale);
      toast.success(t('mail.resetDone'));
      await load();
    } catch {
      toast.error(t('common.actionFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(fn: () => Promise<{ mails: number }>, key: string) {
    setBusy(key);
    try {
      const res = await fn();
      toast.success(t('mail.sent').replace('{n}', String(res.mails)));
    } catch {
      toast.error(t('common.actionFailed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('admin.title')} / {t('mail.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('mail.title')}</h1>
          <p>{t('mail.subtitle')}</p>
        </div>
      </div>

      {/* Manuelle Auslösung der geplanten Läufe */}
      <div className="panel" style={{ maxWidth: 760 }}>
        <div className="panel-head">
          <h2>{t('mail.actions')}</h2>
        </div>
        <div className="panel-body">
          <p className="kh-muted" style={{ marginTop: 0 }}>
            {t('mail.actionsHint')}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              disabled={busy !== null}
              onClick={() => void runAction(admin.runDigest, 'digest')}
            >
              {busy === 'digest' ? '…' : t('mail.runDigest')}
            </button>
            <button
              className="btn"
              disabled={busy !== null}
              onClick={() => void runAction(admin.runWeeklyReport, 'weekly')}
            >
              {busy === 'weekly' ? '…' : t('mail.runWeekly')}
            </button>
            <button
              className="btn"
              disabled={busy !== null}
              onClick={() => void runAction(admin.runInviteReminders, 'reminders')}
            >
              {busy === 'reminders' ? '…' : t('mail.runReminders')}
            </button>
          </div>
        </div>
      </div>

      {/* Vorlagen-Editor */}
      <div className="panel" style={{ maxWidth: 760 }}>
        <div className="panel-head">
          <h2>{t('mail.templates')}</h2>
        </div>
        <div className="form">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: 220 }}>
              {t('mail.templates')}
              <select value={type} onChange={(e) => setType(e.target.value as TemplateType)}>
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`mail.type.${ty}`)}
                    {items.some((i) => i.type === ty && i.customized)
                      ? ` · ${t('mail.customizedBadge')}`
                      : ''}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 160 }}>
              {t('common.language')}
              <select value={editLocale} onChange={(e) => setEditLocale(e.target.value as Locale)}>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {LOCALE_LABEL[l]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {current && current.placeholders.length > 0 && (
            <p className="kh-muted" style={{ fontSize: 12 }}>
              {t('mail.placeholders')}: {current.placeholders.map((p) => `{{${p}}}`).join('  ')}
            </p>
          )}

          <label>
            {t('mail.subjectLabel')}
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label>
            {t('mail.bodyLabel')}
            <textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ fontFamily: 'inherit' }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="btn"
              disabled={saving || !current?.customized}
              onClick={() => void reset()}
            >
              {t('mail.reset')}
            </button>
            <button className="btn primary" disabled={saving} onClick={() => void save()}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
