import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import CallbackClient from './CallbackClient';
import type { SessionUser } from '../../../lib/session';

/**
 * FA-08: OAuth-Callback-Seite (Server Component).
 *
 * NextAuth leitet nach erfolgreichem IdP-Login hierher um.
 * Wir lesen die NextAuth-Session server-seitig, übergeben apiToken + apiUser
 * an den Client-Teil der Seite, der sie im localStorage ablegt und weiterleitet.
 */
export default async function CallbackPage() {
  const session = await getServerSession(authOptions);
  const s = session as Record<string, unknown> | null;

  const apiToken = (s?.apiToken as string | undefined) ?? null;
  const apiUser = (s?.apiUser as SessionUser | undefined) ?? null;
  const exchangeError = (s?.exchangeError as string | undefined) ?? null;

  return (
    <CallbackClient apiToken={apiToken} apiUser={apiUser} exchangeError={exchangeError} />
  );
}
