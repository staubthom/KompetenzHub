// Öffentlicher Einstieg für die Manifest-Validierung. Wird sowohl vom Build-Codegen
// (Manifest kaputt → Build schlägt fehl, siehe §20) als auch von der Backend-Registry
// beim Boot genutzt.

import { manifestSchema, semanticErrors } from './schema';
import type { PluginManifest } from './manifest';

export interface ManifestValidationResult {
  ok: boolean;
  /** Nur gesetzt, wenn ok === true. */
  manifest?: PluginManifest;
  /** Menschenlesbare Fehler (Struktur + Semantik). Leer, wenn gültig. */
  errors: string[];
}

/**
 * Validiert ein (geparstes) Manifest-Objekt in zwei Stufen: zuerst Struktur/Typen
 * (zod), dann semantische Querbezüge (Namespaces, Capability-Deklaration).
 */
export function validateManifest(input: unknown): ManifestValidationResult {
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    return { ok: false, errors };
  }
  const manifest = parsed.data as PluginManifest;
  const errors = semanticErrors(manifest);
  return errors.length === 0 ? { ok: true, manifest, errors: [] } : { ok: false, errors };
}
