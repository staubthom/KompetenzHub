'use client';

import { use, useEffect, useState } from 'react';
import AppShell from '../../../../components/AppShell';
import { useI18n } from '../../../../lib/i18n';
import { getUser } from '../../../../lib/session';
import { pluginsApi } from '../../../../lib/api';
import { pluginWebRegistry } from '../../../../plugins/registry';
import { buildPluginWebContext } from '../../../../plugins/context';

/**
 * Generische Mount-Route für Plugin-Seiten (§10.3): /plugins/<id>/<route>.
 * Rendert die im Web-Registry registrierte Komponente, sofern das Plugin für den
 * User aktiv ist. Server entscheidet *ob*, das Registry weiss *wie* gerendert wird.
 */
export default function PluginPage({
  params,
}: {
  params: Promise<{ pluginId: string; rest?: string[] }>;
}) {
  const { pluginId, rest } = use(params);
  const route = `/${(rest ?? []).join('/')}`.replace(/\/$/, '') || '/';
  const { locale, t } = useI18n();
  const [status, setStatus] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    let cancelled = false;
    void pluginsApi
      .contributions()
      .then((r) => {
        if (cancelled) return;
        const plugin = r.plugins.find((p) => p.pluginId === pluginId);
        const allowed = !!plugin && plugin.pages.some((pg) => pg.route === route);
        setStatus(allowed ? 'ok' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setStatus('denied');
      });
    return () => {
      cancelled = true;
    };
  }, [pluginId, route]);

  const Component = pluginWebRegistry[pluginId]?.pages[route];
  const user = getUser();

  return (
    <AppShell>
      <div className="breadcrumb">
        {t('nav.extensions')} / {pluginId}
      </div>
      {!Component ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">🧩</span>
            <p>{t('plugins.pageNotFound')}</p>
          </div>
        </div>
      ) : status === 'loading' ? (
        <div className="loading">{t('common.loading')}</div>
      ) : status === 'denied' || !user ? (
        <div className="panel">
          <div className="empty">
            <span className="ic">🔒</span>
            <p>{t('plugins.notAvailable')}</p>
          </div>
        </div>
      ) : (
        <Component ctx={buildPluginWebContext(pluginId, user, locale)} />
      )}
    </AppShell>
  );
}
