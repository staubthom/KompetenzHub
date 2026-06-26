'use client';

import { useEffect, useState } from 'react';
import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';

/**
 * Beispiel-Seite des Plugins. Demonstriert den gescopten Datenzugriff über
 * ctx.apiFetch('/ping') und die Plugin-Übersetzungen über ctx.t().
 */
export default function ExamplePage({ ctx }: { ctx: PluginWebContext }) {
  const [pong, setPong] = useState<string>('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    ctx
      .apiFetch<{ pong: boolean; at: string }>('/ping')
      .then((r) => setPong(r.at))
      .catch(() => setFailed(true));
  }, [ctx]);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{ctx.t('plugin.example.title', 'Beispiel-Plugin')}</h2>
      </div>
      <div className="panel-body">
        <p>{ctx.t('plugin.example.hello', 'Hallo aus dem Plugin!')}</p>
        <p className="kh-muted">
          {ctx.t('plugin.example.ping', 'Server-Antwort')}: {failed ? '—' : pong || '…'}
        </p>
      </div>
    </div>
  );
}
