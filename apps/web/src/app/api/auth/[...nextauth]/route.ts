import NextAuth from 'next-auth';
import { authOptions } from '../../../../lib/auth';

/**
 * NextAuth.js App-Router-Handler.
 * Bedient alle /api/auth/* Routen (sign-in, callback, session, csrf, …).
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
