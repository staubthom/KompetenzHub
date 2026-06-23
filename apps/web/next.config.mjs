import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Schlankes, eigenständiges Runtime-Bundle für das Docker-Image.
  output: 'standalone',
  // Im Monorepo: Datei-Tracing ab der Repo-Wurzel, damit das standalone-Bundle
  // konsistent unter apps/web/ liegt.
  experimental: { outputFileTracingRoot: join(__dirname, '../../') },
};

export default nextConfig;
