'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveSession, homePathForRole } from '../../../lib/session';
import type { SessionUser } from '../../../lib/session';

interface Props {
  apiToken: string | null;
  apiUser: SessionUser | null;
  exchangeError: string | null;
}

/**
 * Client-Teil der Callback-Seite.
 * Speichert das API-Token/User-Profil in localStorage und leitet weiter.
 */
export default function CallbackClient({ apiToken, apiUser, exchangeError }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (apiToken && apiUser) {
      saveSession(apiToken, apiUser);
      router.replace(homePathForRole(apiUser));
    } else {
      const msg = exchangeError ? `exchange&detail=${encodeURIComponent(exchangeError)}` : 'oauth';
      router.replace(`/login?error=${msg}`);
    }
  }, [apiToken, apiUser, exchangeError, router]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <p>Anmelden…</p>
    </div>
  );
}
