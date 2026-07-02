import NextAuth from 'next-auth';
import { authOptions } from '../../../../lib/auth';

/**
 * Multi-Tenant: Ist eine Schul-Basisdomain konfiguriert, muss NextAuth den Origin
 * pro Request aus dem (vom Reverse-Proxy gesetzten) X-Forwarded-Host ableiten –
 * statt aus einem festen NEXTAUTH_URL. Sonst wird ein Login von schule-b.<domain>
 * mit dem redirect_uri von schule-a gestartet und landet nach dem OAuth-Rücksprung
 * fälschlich auf schule-a. `AUTH_TRUST_HOST` schaltet in NextAuth genau diese
 * Host-Ableitung frei (siehe detectOrigin). Nur aktivieren, wenn Multi-Tenant läuft
 * (dann steht ein vertrauenswürdiger Proxy davor, der X-Forwarded-Host setzt).
 */
if (
  (process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN?.trim() || process.env.TENANT_BASE_DOMAIN?.trim()) &&
  !process.env.AUTH_TRUST_HOST
) {
  process.env.AUTH_TRUST_HOST = 'true';
}

/**
 * NextAuth.js App-Router-Handler.
 * Bedient alle /api/auth/* Routen (sign-in, callback, session, csrf, …).
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
