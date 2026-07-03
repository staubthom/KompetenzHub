import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Plugin-Web-Beiträge (TSX/JSON) aus dem Monorepo werden von Next transpiliert. Die
// Liste wird AUTOMATISCH aus den Plugin-Manifesten generiert (predev/prebuild →
// scripts/generate-plugin-registry.mjs) – hier ist nichts pro Plugin zu pflegen.
function generatedTranspilePackages() {
  try {
    const path = join(__dirname, 'src/plugins/transpile-packages.generated.json');
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
}

// Versions-/Build-Info fürs Browser-Bundle. Die Version stammt aus der
// package.json; Commit und Build-Zeit werden beim Docker-Build als
// NEXT_PUBLIC_GIT_SHA/NEXT_PUBLIC_BUILD_TIME (bzw. GIT_SHA/BUILD_TIME) gesetzt.
// Lokal (npm run dev) genügt die package.json-Version.
const pkgVersion = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')).version;
const buildEnv = {
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || pkgVersion,
  NEXT_PUBLIC_GIT_SHA: process.env.NEXT_PUBLIC_GIT_SHA || process.env.GIT_SHA || '',
  NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME || process.env.BUILD_TIME || '',
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: buildEnv,
  transpilePackages: generatedTranspilePackages(),
  // Schlankes, eigenständiges Runtime-Bundle für das Docker-Image.
  output: 'standalone',

  // NEU IN NEXT.JS 15: Direkt auf der obersten Ebene platziert
  outputFileTracingRoot: join(__dirname, '../../'),

  // Same-Origin-Modus: Wurde das Bundle mit LEEREM NEXT_PUBLIC_API_URL gebaut, ruft
  // der Browser die NestJS-API relativ unter /api/v1 auf. Der Next-Server leitet
  // NUR diesen Prefix serverseitig an den internen API-Container weiter. Damit
  // genuegt EIN domain-agnostisches Image pro Umgebung – die API-URL wird nicht mehr
  // ins Bundle gebacken. Fuer die NAS-/Sandbox-Trennung reicht so pro Host eine
  // eigene .env + Tunnel-Config; das Image ist identisch.
  //
  // WICHTIG: Nur /api/v1 umleiten, NICHT das ganze /api. NextAuth bedient
  // /api/auth/* auf DIESEM Next-Server (Google/Logto-Login: signin, callback,
  // error, session). Ein breiter /api-Rewrite wuerde diese Routen an die NestJS-API
  // verschleppen -> OAuth bricht mit "Cannot GET /api/auth/error" (404 im
  // Problem-JSON der API). Der Dev-Login (/api/v1/auth/dev-login) laeuft korrekt
  // ueber die API und ist daher nie betroffen.
  //
  // Zwei Topologien werden unterstuetzt:
  //   B1: Der Cloudflare-Tunnel routet host/api/v1/* direkt auf den API-Container
  //       (dieser Rewrite bleibt ungenutzt – /api/v1 erreicht den Web-Server nie).
  //   B2: Der Tunnel routet ALLES auf den Web-Container; dieser Rewrite proxied
  //       /api/v1 intern an den API-Container (API muss dann nicht oeffentlich sein).
  //
  // Die Ziel-Adresse ist die interne Docker-Service-Adresse und in jeder Umgebung
  // gleich (`http://api:3001`), daher unkritisch, dass sie zur Build-Zeit feststeht.
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_URL !== '') return [];
    const target = process.env.API_INTERNAL_URL || 'http://api:3001';
    return [{ source: '/api/v1/:path*', destination: `${target}/api/v1/:path*` }];
  },

  experimental: {
    // Hier kommen nur noch echte experimentelle Features rein.
    // Da es leer ist, könntest du den gesamten Block auch löschen.
  },
};

export default nextConfig;
