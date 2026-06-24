import type { NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import type { SessionUser } from './session';

/**
 * FA-08: NextAuth.js-Konfiguration für Microsoft (Azure AD), Google und GitHub.
 *
 * Flow:
 *  1. Nutzer klickt auf einen OAuth-Provider → signIn() → OIDC-Redirect
 *  2. IdP leitet zurück → jwt-Callback tauscht das Profil gegen ein API-JWT ein
 *  3. NextAuth leitet zu /login/callback weiter → dort wird das Token in
 *     localStorage gespeichert und der Nutzer weitergeleitet.
 */

/** API-URL für server-seitige Aufrufe (NextAuth jwt-Callback läuft auf dem Server). */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const MICROSOFT_CLIENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const microsoftClientId = process.env.AUTH_MICROSOFT_CLIENT_ID?.trim();
const microsoftClientSecret = process.env.AUTH_MICROSOFT_CLIENT_SECRET?.trim();
const googleClientId = process.env.AUTH_GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.AUTH_GOOGLE_CLIENT_SECRET?.trim();
const githubClientId = process.env.AUTH_GITHUB_CLIENT_ID?.trim();
const githubClientSecret = process.env.AUTH_GITHUB_CLIENT_SECRET?.trim();

function hasConfiguredValue(value: string | undefined): boolean {
  const normalized = value?.trim();
  if (!normalized) return false;
  return !['noch-zu-setzen', 'noch-zu-setze', 'todo', 'changeme'].includes(
    normalized.toLowerCase(),
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Provider nur einbinden, wenn Credentials konfiguriert sind.
    // Leere clientId führt sonst zu einem Laufzeitfehler im OIDC-Client.
    ...(MICROSOFT_CLIENT_ID_RE.test(microsoftClientId ?? '') &&
    hasConfiguredValue(microsoftClientSecret)
      ? [
          AzureADProvider({
            clientId: microsoftClientId!,
            clientSecret: microsoftClientSecret!,
            tenantId: process.env.AUTH_MICROSOFT_TENANT_ID ?? 'common',
          }),
        ]
      : []),
    ...(hasConfiguredValue(googleClientId) && hasConfiguredValue(googleClientSecret)
      ? [
          GoogleProvider({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
          }),
        ]
      : []),
    ...(hasConfiguredValue(githubClientId) && hasConfiguredValue(githubClientSecret)
      ? [
          GitHubProvider({
            clientId: githubClientId!,
            clientSecret: githubClientSecret!,
          }),
        ]
      : []),
  ],

  callbacks: {
    /**
     * Beim ersten Sign-in (account ist gesetzt): Profil gegen API-JWT tauschen
     * und apiToken/apiUser im verschlüsselten NextAuth-JWT ablegen.
     */
    async jwt({ token, account, profile, user }) {
      if (account && profile) {
        const provider =
          account.provider === 'azure-ad'
            ? 'MICROSOFT'
            : account.provider === 'github'
              ? 'GITHUB'
              : 'GOOGLE';
        const email = profile.email ?? user?.email ?? '';
        const displayName = profile.name ?? user?.name ?? email;
        const avatarUrl = ((profile as Record<string, unknown>).picture ??
          (profile as Record<string, unknown>).avatar_url ??
          user?.image) as string | undefined;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const secret = process.env.AUTH_EXCHANGE_SECRET;
        if (secret) headers['x-auth-exchange'] = secret;

        try {
          const res = await fetch(`${API_BASE}/api/v1/auth/exchange`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              provider,
              externalId: profile.sub ?? account.providerAccountId,
              email,
              displayName,
              avatarUrl,
            }),
          });

          if (res.ok) {
            const result = (await res.json()) as { token: string; user: SessionUser };
            token.apiToken = result.token;
            token.apiUser = result.user;
          } else {
            // Exchange abgelehnt (z. B. Anbieter deaktiviert, Account gesperrt)
            token.exchangeError = await res.text();
          }
        } catch (err) {
          // Netzwerkfehler → Fehlermeldung auf der Callback-Seite
          token.exchangeError = err instanceof Error ? err.message : 'exchange-failed';
        }
      }
      return token;
    },

    /** apiToken und apiUser zur Session durchreichen, damit die Callback-Seite sie lesen kann. */
    async session({ session, token }) {
      const s = session as unknown as Record<string, unknown>;
      s.apiToken = token.apiToken;
      s.apiUser = token.apiUser;
      s.exchangeError = token.exchangeError;
      return session;
    },
  },

  /** Bei Fehler zurück zur eigenen Login-Seite (mit ?error=…). */
  pages: {
    signIn: '/login',
    error: '/login',
  },
};
