import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

/**
 * SSRF-Schutz für benutzerkonfigurierte KI-Endpoints.
 *
 * Die `baseUrl` einer KI-Konfiguration kann von JEDER angemeldeten Person gesetzt
 * werden (inkl. Lernende). Ohne Prüfung könnte die zentrale API dazu gebracht
 * werden, Requests an interne Ziele zu stellen – Cloud-Metadaten
 * (169.254.169.254), den internen Objektspeicher oder andere Dienste im privaten
 * Netz. Deshalb wird der Host aufgelöst und gegen private/loopback/link-local/
 * reservierte Adressbereiche geprüft.
 *
 * On-Prem-Betrieb mit lokalem LLM (Provider „local", z. B. Ollama) braucht bewusst
 * Zugriff auf localhost/privates Netz – dafür kann der Schutz über
 * `AI_ALLOW_PRIVATE_ENDPOINTS=1` global deaktiviert werden (im gehosteten
 * Mehrmandantenbetrieb aus lassen).
 *
 * Hinweis: DNS-Rebinding (Auflösung ändert sich zwischen Prüfung und `fetch`) ist
 * hiermit nicht vollständig abgedeckt – das erforderte ein IP-Pinning der
 * Verbindung. Die gängigen SSRF-Vektoren (IP-Literale, localhost, Metadaten-Host)
 * werden aber zuverlässig blockiert.
 */

function allowPrivate(): boolean {
  const v = (process.env.AI_ALLOW_PRIVATE_ENDPOINTS ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Wandelt eine IPv4-Adresse in ihren 32-Bit-Wert (oder null). */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

/** Ob eine IPv4-Adresse nicht global routbar ist (privat/loopback/link-local/reserviert). */
function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparsebar → sicherheitshalber blocken
  const inRange = (base: string, maskBits: number): boolean => {
    const b = ipv4ToInt(base);
    if (b === null) return false;
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (n & mask) === (b & mask);
  };
  return (
    inRange('0.0.0.0', 8) || // „dieses" Netz
    inRange('10.0.0.0', 8) || // privat
    inRange('100.64.0.0', 10) || // CGNAT
    inRange('127.0.0.0', 8) || // loopback
    inRange('169.254.0.0', 16) || // link-local (Cloud-Metadaten)
    inRange('172.16.0.0', 12) || // privat
    inRange('192.0.0.0', 24) || // IETF-Protokollzuweisungen
    inRange('192.168.0.0', 16) || // privat
    inRange('198.18.0.0', 15) || // Benchmark
    inRange('224.0.0.0', 4) || // Multicast
    inRange('240.0.0.0', 4) // reserviert
  );
}

/** Ob eine IPv6-Adresse nicht global routbar ist (loopback/ULA/link-local/mapped). */
function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]; // evtl. Zone-Index abschneiden
  if (addr === '::1' || addr === '::') return true;
  // IPv4-mapped/-compatible (::ffff:a.b.c.d bzw. ::a.b.c.d) → eingebettete IPv4 prüfen.
  const mapped = addr.match(/(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  const firstHextet = addr.split(':')[0];
  const head = parseInt(firstHextet || '0', 16);
  if (Number.isNaN(head)) return true;
  if ((head & 0xfe00) === 0xfc00) return true; // fc00::/7 Unique Local
  if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 Link-Local
  return false;
}

function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIpv4(ip);
  if (kind === 6) return isPrivateIpv6(ip);
  return true; // kein gültiges IP-Literal → blocken
}

/**
 * Prüft, ob ein KI-Endpoint zu einem öffentlich routbaren Ziel auflöst.
 * Liefert `true`, wenn der Schutz per Env deaktiviert ist.
 */
export async function isPublicEndpoint(baseUrl: string): Promise<boolean> {
  if (allowPrivate()) return true;
  let host: string;
  let protocol: string;
  try {
    const u = new URL(baseUrl);
    host = u.hostname;
    protocol = u.protocol;
  } catch {
    return false;
  }
  if (protocol !== 'http:' && protocol !== 'https:') return false;

  // Klammern von IPv6-Literalen entfernen (URL.hostname liefert „[::1]").
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  if (isIP(bare)) return !isPrivateIp(bare);

  // Hostnamen wie „localhost" ohne DNS früh blocken.
  if (bare.toLowerCase() === 'localhost' || bare.toLowerCase().endsWith('.localhost')) {
    return false;
  }

  // Alle aufgelösten Adressen prüfen – blockt, sobald EINE privat ist.
  try {
    const results = await lookup(bare, { all: true });
    if (results.length === 0) return false;
    return results.every((r) => !isPrivateIp(r.address));
  } catch {
    return false; // nicht auflösbar → nicht erreichen lassen
  }
}

/** Wie {@link isPublicEndpoint}, wirft aber bei privatem/ungültigem Ziel (für saveConfig). */
export async function assertPublicEndpoint(baseUrl: string): Promise<void> {
  if (!(await isPublicEndpoint(baseUrl))) {
    throw new BadRequestException(
      'Der KI-Endpoint verweist auf eine nicht erlaubte (interne oder private) Adresse.',
    );
  }
}
