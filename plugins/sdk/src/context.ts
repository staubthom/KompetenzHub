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

/** Beziehung der aufrufenden Lehrperson zu einem Modulanlass (für ACL-Entscheide). */
export type TeacherRelation = 'owner' | 'coTeacher' | 'admin' | 'none';

/** Ein Modul, das die aufrufende Lehrperson unterrichtet (Kern-Lesefassade). */
export interface CoreModuleRef {
  moduleId: string;
  number: string;
  /** i18n-Titel {de,fr,it,en}. */
  title: Record<string, string>;
}

/** Eine lernende Person im Kontext eines Modulanlasses (Kern-Lesefassade). */
export interface ClassMemberRef {
  enrollmentId: string;
  classId: string;
  moduleId: string | null;
  displayName: string;
  /** Status des Modulanlasses ("ACTIVE" | "ARCHIVED"). */
  classStatus: string;
  /** Beziehung der aufrufenden Person; `none` = kein Zugriff. */
  teacherRelation: TeacherRelation;
  /** true, wenn die aufrufende Person die Klasse besitzt/co-leitet oder Admin ist. */
  teacherHasAccess: boolean;
}

/**
 * Schreibgeschützte, hart abgesicherte Lesefassade auf Kern-Stammdaten (§ Hooks).
 * Damit kann ein Plugin kontextbezogene Berechtigungen prüfen, OHNE die Kern-DB zu
 * kennen. Jede Methode setzt die Berechtigungen der aufrufenden Person (Tenant +
 * Besitz/Co-Leitung) selbst durch; Lernende erhalten nie fremde Datensätze.
 */
export interface CoreContext {
  /** Auflösung einer Einschreibung (Zeilen-ID) inkl. Zugriffsbeziehung. null = unbekannt/kein Zugriff. */
  getClassMember(enrollmentId: string): Promise<ClassMemberRef | null>;
  /** Mitglieder eines Moduls aus Klassen, auf die die aufrufende Person Zugriff hat. */
  listModuleMembers(moduleId: string): Promise<ClassMemberRef[]>;
  /** Module, die die aufrufende Lehrperson unterrichtet (besitzt/co-leitet); Admin: alle. */
  listMyModules(): Promise<CoreModuleRef[]>;
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
  /** Vom Schuladmin gesetzte, tenant-spezifische Plugin-Konfiguration (read-only). */
  config: Record<string, unknown>;
  /** Schreibgeschützte Lesefassade auf Kern-Stammdaten für kontextbezogene ACLs. */
  core: CoreContext;
}
