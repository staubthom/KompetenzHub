'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { redeemImpersonation, setTenantOverride } from '../../../lib/api';
import { homePathForRole, saveImpersonationMarker } from '../../../lib/session';

/**
 * Einlöse-Seite für die Superadmin-Impersonation. Läuft auf der Ziel-Subdomain.
 * Der Handoff-Code kommt im URL-Fragment (`#code=…`) – dieses wird nicht an den
 * Server gesendet und landet nicht in Logs/Referer. Wir tauschen ihn sofort
 * gegen ein echtes ADMIN-Session-JWT, setzen den Banner-Marker und leiten weiter.
 */
function ImpersonateInner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // React StrictMode ruft Effekte doppelt auf – Einmal-Code darf nur 1× eingelöst werden.
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const code = params.get('code');
    const slug = params.get('slug') ?? '';
    const name = params.get('name') ?? '';
    const ret = params.get('ret') ?? '';

    // Fragment sofort aus der Adressleiste/History entfernen (Code nicht aufbewahren).
    window.history.replaceState(null, '', window.location.pathname);

    if (!code) {
      router.replace('/login?error=oauth');
      return;
    }

    // Ohne Subdomain (localhost) muss der Ziel-Tenant explizit gesetzt werden,
    // damit nachfolgende Requests X-Tenant-Slug korrekt senden.
    if (slug) setTenantOverride(slug);

    redeemImpersonation(code, slug)
      .then((result) => {
        if (ret) saveImpersonationMarker({ tenantName: name || slug, returnUrl: ret });
        router.replace(homePathForRole(result.user));
      })
      .catch((err: unknown) => {
        const e = err as { body?: { title?: string }; message?: string };
        setError(e.body?.title ?? e.message ?? 'Impersonation fehlgeschlagen.');
      });
  }, [router]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        padding: 24,
      }}
    >
      {error ? (
        <>
          <p style={{ color: 'var(--danger, #dc2626)' }}>{error}</p>
          <a className="btn" href="/platform">
            Zurück zur Plattform
          </a>
        </>
      ) : (
        <p>Wechsle in die Schul-Verwaltung…</p>
      )}
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense>
      <ImpersonateInner />
    </Suspense>
  );
}
