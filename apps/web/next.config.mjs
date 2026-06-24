import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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