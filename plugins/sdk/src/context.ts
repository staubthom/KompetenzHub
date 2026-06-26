// Der gescopte Laufzeit-Kontext, den ein Plugin-Server-Handler erhält.
// Siehe planung/Planung_Plugin.md §7.2. Ein Plugin sieht NIE PrismaClient/S3 direkt –
// nur diese vom Kern implementierten, hart gescopten Schnittstellen.

import type { PluginRole } from '@kompetenzhub/plugin-contracts';

/** Tenant-/Plugin-gescopter JSON-Dokumentspeicher (KV/Doc-Store, §8 Stufe 1). */
export interface DataStore {
  get<T = unknown>(collection: string, key: string): Promise<T | null>;
  list<T = unknown>(collection: string): Promise<Array<{ key: string; data: T }>>;
  put<T = unknown>(collection: string, key: string, data: T): Promise<void>;
  delete(collection: string, key: string): Promise<void>;
}

/** Zugriff auf die im Manifest deklarierten Secrets (entschlüsselt zur Laufzeit). */
export interface SecretStore {
  get(key: string): Promise<string | null>;
}

/** Dateispeicher, hart auf den Prefix plugins/<pluginId>/<tenantId>/ begrenzt. */
export interface ScopedStorage {
  presignUpload(fileName: string, contentType: string): Promise<{ uploadUrl: string; key: string }>;
  presignDownload(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

/** fetch-kompatible Funktion, begrenzt auf deklarierte outboundHosts. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PluginLogger {
  info(message: string, detail?: Record<string, unknown>): void;
  warn(message: string, detail?: Record<string, unknown>): void;
  error(message: string, detail?: Record<string, unknown>): void;
}

export interface ServerContext {
  pluginId: string;
  tenant: { id: string };
  user: { id: string; roles: PluginRole[]; locale: string };
  data: DataStore;
  secrets: SecretStore;
  storage: ScopedStorage;
  http: FetchLike;
  logger: PluginLogger;
  /** Schreibt ein fachliches Plugin-Ereignis in das zentrale Audit-Log. */
  audit(event: string, detail?: Record<string, unknown>): Promise<void>;
}
