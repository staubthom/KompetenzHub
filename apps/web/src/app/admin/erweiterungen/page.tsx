'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import TrashIcon from '../../../components/TrashIcon';
import { useToast } from '../../../components/ToastProvider';
import { useI18n } from '../../../lib/i18n';
import { getUser, isAdmin, homePathForRole } from '../../../lib/session';
import { adminPlugins, type AdminPluginItem } from '../../../lib/api';

export default function AdminPluginsPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [list, setList] = useState<AdminPluginItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [configFor, setConfigFor] = useState<string | null>(null);
  const [configText, setConfigText] = useState('');

  const load = useCallback(async () => {
    try {
      setList(await adminPlugins.list());
    } catch {
      toast.error(t('admin.loadFailed'));
    }
  }, [toast, t]);

  useEffect(() => {
    const u = getUser();
    if (u && !isAdmin(u)) {
      router.replace(homePathForRole(u));
      return;
    }
    void load();
  }, [router, load]);

  function showError(err: unknown) {
    const e = err as { body?: { title?: string } };
    toast.error(e.body?.title ?? 'Aktion fehlgeschlagen.');
  }

  async function run(id: string, action: () => Promise<unknown>, successMsg: string) {
    setBusy(id);
    try {
      await action();
      toast.success(successMsg);
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  }

  function openConfig(p: AdminPluginItem) {
    setConfigFor(p.pluginId);
    setConfigText(JSON.stringify(p.config ?? {}, null, 2));
  }

  async function saveConfig(id: string) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configText || '{}');
    } catch {
      toast.error(t('plugins.invalidJson'));
      return;
    }
    await run(id, () => adminPlugins.configure(id, parsed), t('plugins.configuredMsg'));
    setConfigFor(null);
  }

  async function uninstall(p: AdminPluginItem) {
    if (!confirm(t('plugins.confirmUninstall'))) return;
    await run(p.pluginId, () => adminPlugins.uninstall(p.pluginId), t('plugins.uninstalledMsg'));
  }

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('admin.title')} / {t('admin.pluginsTitle')}
      </div>
      <div className="page-head">
        <div>
          <h1>{t('admin.pluginsTitle')}</h1>
          <p>{t('admin.pluginsSubtitle')}</p>
        </div>
      </div>

      {!list ? (
        <div className="loading">{t('common.loading')}</div>
      ) : list.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">🧩</span>
            <p>{t('plugins.none')}</p>
          </div>
        </div>
      ) : (
        list.map((p) => (
          <div className="panel" key={p.pluginId}>
            <div className="panel-head">
              <h2>
                {p.displayName}{' '}
                <span className="kh-muted" style={{ fontWeight: 400, fontSize: 13 }}>
                  · {p.pluginId} · v{p.installedVersion}
                </span>
              </h2>
              <span className={`badge ${p.enabled ? 'b-published' : 'b-archived'}`}>
                {p.enabled ? t('plugins.enabled') : t('plugins.disabled')}
              </span>
            </div>
            <div
              className="panel-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {p.installStatus !== 'INSTALLED' && (
                <div className="sub-status sub-rejected" style={{ margin: 0 }}>
                  {t('plugins.installStatus')}: {p.installStatus}
                </div>
              )}

              {p.capabilities.length > 0 && (
                <div>
                  <div className="kh-muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    {t('plugins.capabilities')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {p.capabilities.map((c) => (
                      <span key={c} className="goal-chip">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {configFor === p.pluginId && (
                <label className="fld">
                  <span className="field-label">{t('plugins.config')}</span>
                  <textarea
                    className="text-input"
                    rows={6}
                    value={configText}
                    spellCheck={false}
                    onChange={(e) => setConfigText(e.target.value)}
                    style={{ fontFamily: 'monospace' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      className="btn primary sm"
                      disabled={busy === p.pluginId}
                      onClick={() => void saveConfig(p.pluginId)}
                    >
                      {t('common.save')}
                    </button>
                    <button className="btn sm" onClick={() => setConfigFor(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </label>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {p.enabled ? (
                  <button
                    className="btn sm"
                    disabled={busy === p.pluginId}
                    onClick={() =>
                      void run(
                        p.pluginId,
                        () => adminPlugins.disable(p.pluginId),
                        t('plugins.disabledMsg'),
                      )
                    }
                  >
                    {t('plugins.disable')}
                  </button>
                ) : (
                  <button
                    className="btn primary sm"
                    disabled={busy === p.pluginId || p.installStatus !== 'INSTALLED'}
                    onClick={() =>
                      void run(
                        p.pluginId,
                        () => adminPlugins.enable(p.pluginId),
                        t('plugins.enabledMsg'),
                      )
                    }
                  >
                    {t('plugins.enable')}
                  </button>
                )}

                <button
                  className="btn sm"
                  onClick={() => (configFor === p.pluginId ? setConfigFor(null) : openConfig(p))}
                >
                  {t('plugins.configure')}
                </button>

                <button
                  className="btn sm danger"
                  disabled={busy === p.pluginId || p.enabled}
                  title={p.enabled ? t('plugins.uninstallHint') : undefined}
                  onClick={() => void uninstall(p)}
                >
                  <TrashIcon /> {t('plugins.uninstall')}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </AppShell>
  );
}
