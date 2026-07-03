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
  // der Browser die API relativ unter /api auf. Der Next-Server leitet /api dann
  // serverseitig an den internen API-Container weiter. Damit genuegt EIN
  // domain-agnostisches Image pro Umgebung – die API-URL wird nicht mehr ins Bundle
  // gebacken. Fuer die NAS-/Sandbox-Trennung reicht so pro Host eine eigene .env +
  // Tunnel-Config; das Image ist identisch.
  //
  // Zwei Topologien werden dadurch unterstuetzt:
  //   B1: Der Cloudflare-Tunnel routet host/api/* direkt auf den API-Container
  //       (dieser Rewrite bleibt ungenutzt – /api erreicht den Web-Server nie).
  //   B2: Der Tunnel routet ALLES auf den Web-Container; dieser Rewrite proxied
  //       /api intern an den API-Container (API muss dann nicht oeffentlich sein).
  //
  // Die Ziel-Adresse ist die interne Docker-Service-Adresse und in jeder Umgebung
  // gleich (`http://api:3001`), daher unkritisch, dass sie zur Build-Zeit feststeht.
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_URL !== '') return [];
    const target = process.env.API_INTERNAL_URL || 'http://api:3001';
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },

  experimental: {
    // Hier kommen nur noch echte experimentelle Features rein.
    // Da es leer ist, könntest du den gesamten Block auch löschen.
  },
};

export default nextConfig;
