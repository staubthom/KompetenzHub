import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Build-/Versionsinfo der API. Wird beim Docker-Build als Umgebungsvariablen
 * eingebacken (siehe apps/api/Dockerfile + docker-compose*.yaml):
 *  - APP_VERSION: aus der package.json (z. B. "0.1.0")
 *  - GIT_SHA:     kurzer Commit-Hash des Builds (z. B. "abc1234")
 *  - BUILD_TIME:  ISO-Zeitstempel des Builds
 *
 * Fallback-Kette für die Version: explizites `APP_VERSION` → das von npm beim
 * `npm run dev` gesetzte `npm_package_version` → direktes Lesen der package.json
 * (funktioniert auch im Container, `../../package.json` relativ zu dist/common/).
 * So ist die Anzeige nie leer, ohne dass die Version doppelt gepflegt werden muss.
 */
function versionFromPackageJson(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const APP_VERSION =
  process.env.APP_VERSION || process.env.npm_package_version || versionFromPackageJson();
export const GIT_SHA = process.env.GIT_SHA || 'dev';
export const BUILD_TIME = process.env.BUILD_TIME || '';
