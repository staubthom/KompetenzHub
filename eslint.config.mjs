import { defineConfig, globalIgnores } from 'eslint/config';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import nextPlugin from '@next/eslint-plugin-next';
import { fixupPluginRules } from '@eslint/compat';

export default defineConfig([
  // 1. Globale Ordner ignorieren
  globalIgnores([
    'node_modules/**',
    '**/node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '**/.next/**',
    '**/*.config.js',
    '**/mockups/**',
    // Generierte Test-Artefakte (Playwright) – nie linten.
    '**/playwright-report/**',
    '**/test-results/**',
    // Generierte Plugin-Registry (aus den Manifesten, siehe scripts/generate-plugin-registry.mjs)
    'apps/web/src/plugins/registry.generated.ts',
  ]),

  // 2. BASIS-KONFIGURATION (Gilt für das GESAMTE Projekt: API & Web)
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // 3. NEXT.JS-KONFIGURATION (Gilt EXKLUSIV nur für das Frontend)
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    plugins: {
      '@next/next': fixupPluginRules(nextPlugin),

      // HACK: Wir definieren ein leeres jsx-a11y Plugin im Speicher,
      // damit ESLint beim Suchen nach 'jsx-a11y/no-autofocus' nicht abstürzt.
      'jsx-a11y': {
        rules: {
          'no-autofocus': {
            create() {
              return {};
            },
          },
        },
      },

      // HACK (analog): react-hooks ist nicht als Plugin installiert, aber Komponenten
      // nutzen `// eslint-disable-next-line react-hooks/exhaustive-deps`. Ohne Definition
      // bricht ESLint mit „rule not found" ab. Leere Stubs registrieren die Regelnamen.
      'react-hooks': {
        rules: {
          'exhaustive-deps': { create: () => ({}) },
          'rules-of-hooks': { create: () => ({}) },
        },
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Teilt Next.js mit, wo die Seiten wirklich liegen
      '@next/next/no-html-link-for-pages': ['error', 'apps/web/src/app'],

      // Jetzt existiert die Definition im Speicher und dieses 'off' greift!
      'jsx-a11y/no-autofocus': 'off',
    },
  },
]);
