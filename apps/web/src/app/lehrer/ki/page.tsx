'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import ProfileNamePanel from '../../../components/ProfileNamePanel';
import NotificationPrefsPanel from '../../../components/NotificationPrefsPanel';
import { useToast } from '../../../components/ToastProvider';
import { useI18n } from '../../../lib/i18n';
import { ai, type AiConfig, type AiTestResult } from '../../../lib/api';

const PROVIDERS: { value: string; label: string; baseUrl?: string }[] = [
  { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { value: 'openai-compatible', label: 'OpenAI-kompatibel (eigener Endpoint)' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'local', label: 'Lokales Modell (on-prem)' },
];

export default function KiSettingsPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [provider, setProvider] = useState('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState(''); // leer = unverändert
  const [enabled, setEnabled] = useState(false);
  const [shareWithLearners, setShareWithLearners] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);

  const load = useCallback(async () => {
    try {
      const c = await ai.getConfig();
      setCfg(c);
      setProvider(c.provider);
      setBaseUrl(c.baseUrl);
      setModel(c.model);
      setEnabled(c.enabled);
      setShareWithLearners(c.shareWithLearners);
    } catch {
      toast.error('KI-Konfiguration konnte nicht geladen werden.');
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function onProviderChange(p: string) {
    setProvider(p);
    const preset = PROVIDERS.find((x) => x.value === p);
    if (preset?.baseUrl) setBaseUrl(preset.baseUrl);
  }

  // Eingaben für Speichern/Test: apiKey nur senden, wenn etwas eingegeben wurde.
  function currentInput() {
    return {
      provider,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      enabled,
      shareWithLearners,
      ...(apiKey ? { apiKey } : {}),
    };
  }

  async function save() {
    if (!baseUrl.trim()) {
      toast.error('Endpoint (baseUrl) ist erforderlich.');
      return;
    }
    if (!model.trim()) {
      toast.error('Modell ist erforderlich.');
      return;
    }
    setSaving(true);
    try {
      const c = await ai.saveConfig(currentInput());
      setCfg(c);
      setEnabled(c.enabled);
      setShareWithLearners(c.shareWithLearners);
      setApiKey('');
      toast.success('KI-Konfiguration gespeichert.');
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await ai.test(currentInput());
      setTestResult(res);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      toast.error(err.body?.title ?? 'Verbindungstest fehlgeschlagen.');
    } finally {
      setTesting(false);
    }
  }

  async function clearKey() {
    setSaving(true);
    try {
      const c = await ai.saveConfig({ apiKey: '' });
      setCfg(c);
      setApiKey('');
      toast.success('API-Key entfernt.');
    } catch {
      toast.error('API-Key konnte nicht entfernt werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('common.overview')} / {t('settings.title')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.teacherSubtitle')}</p>
        </div>
        {cfg && (
          <span className={`badge ${cfg.enabled && cfg.hasApiKey ? 'b-published' : 'b-archived'}`}>
            <span
              className="dot"
              style={{
                background: cfg.enabled && cfg.hasApiKey ? 'var(--st-graded)' : 'var(--fg-muted)',
              }}
            />
            {cfg.enabled && cfg.hasApiKey ? t('ki.active') : t('ki.inactive')}
          </span>
        )}
      </div>

      {/* Anzeigename (erscheint in der Kopfzeile) */}
      <ProfileNamePanel />

      {/* E-Mail-Benachrichtigungen (Tages-Digest, Opt-out) */}
      <NotificationPrefsPanel />

      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="panel-head">
          <h2>
            {t('ki.title')} · {t('ki.connection')}
          </h2>
        </div>
        <div className="form">
          <label>
            {t('ki.provider')}
            <select value={provider} onChange={(e) => onProviderChange(e.target.value)}>
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('ki.endpoint')}
            <input
              type="url"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>

          <label>
            {t('ki.model')}
            <input
              type="text"
              placeholder="z. B. gpt-4o-mini"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>

          <label>
            {t('ki.apiKey')}
            <input
              type="password"
              autoComplete="off"
              placeholder={cfg?.hasApiKey ? `•••• ${cfg.apiKeyMask ?? ''}` : t('ki.apiKey')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          {cfg?.hasApiKey && (
            <button
              type="button"
              className="btn sm"
              style={{ alignSelf: 'flex-start' }}
              disabled={saving}
              onClick={() => void clearKey()}
            >
              {t('ki.removeKey')}
            </button>
          )}

          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={enabled}
              style={{ width: 'auto' }}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            {t('ki.enable')}
          </label>

          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={shareWithLearners}
              style={{ width: 'auto' }}
              onChange={(e) => setShareWithLearners(e.target.checked)}
            />
            {t('ki.share')}
          </label>
          <p className="kh-muted" style={{ fontSize: 12, marginTop: -8 }}>
            {t('ki.hint')}
          </p>

          {testResult && (
            <div
              className={`sub-status ${testResult.ok ? 'sub-graded' : 'sub-rejected'}`}
              style={{ margin: 0 }}
            >
              <strong>
                {testResult.ok ? '✓ ' : '✕ '}
                {testResult.message}
              </strong>
              {testResult.ok && testResult.models && testResult.models.length > 0 && (
                <div className="sub-feedback">{testResult.models.join(', ')}</div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" disabled={testing} onClick={() => void test()}>
              {testing ? t('ki.testing') : t('ki.test')}
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
