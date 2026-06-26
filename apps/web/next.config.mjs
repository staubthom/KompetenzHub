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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: generatedTranspilePackages(),
  // Schlankes, eigenständiges Runtime-Bundle für das Docker-Image.
  output: 'standalone',

  // NEU IN NEXT.JS 15: Direkt auf der obersten Ebene platziert
  outputFileTracingRoot: join(__dirname, '../../'),

  experimental: {
    // Hier kommen nur noch echte experimentelle Features rein.
    // Da es leer ist, könntest du den gesamten Block auch löschen.
  },
};

export default nextConfig;
