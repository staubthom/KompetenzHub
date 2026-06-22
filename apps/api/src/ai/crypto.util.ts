import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Symmetrische Verschlüsselung für sensible Konfigurationswerte (z. B. KI-API-Keys).
 * AES-256-GCM mit zufälligem IV; Ausgabeformat: base64(iv).base64(tag).base64(ciphertext).
 *
 * Der Schlüssel stammt aus AI_CONFIG_ENC_KEY (beliebig lange Passphrase, via SHA-256
 * auf 32 Byte normalisiert). In Produktion MUSS ein starker, geheimer Wert gesetzt sein.
 */
const ALGO = 'aes-256-gcm';

function key(): Buffer {
  const secret = process.env.AI_CONFIG_ENC_KEY ?? 'dev-insecure-ai-config-key-change-me';
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Ungültiges Secret-Format');
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Maskierte Anzeige eines Keys, z. B. „sk-…last4" – nie der ganze Wert. */
export function maskSecret(plain: string): string {
  if (!plain) return '';
  const last4 = plain.slice(-4);
  return `••••${last4}`;
}
