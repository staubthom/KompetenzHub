// Öffentliche API des Pakets @kompetenzhub/plugin-contracts.
export * from './manifest';
export * from './web-context';
export { manifestSchema, semanticErrors, KNOWN_WIDGET_SLOTS } from './schema';
export { validateManifest, type ManifestValidationResult } from './validate';
