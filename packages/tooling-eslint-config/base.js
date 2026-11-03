import { defineConfig } from '@w5s/eslint-config';

import { restrictedImportPaths } from './restricted-import-paths.js';

/**
 * Applied through `plugins.ts.rules` so the upstream `test` preset's loose rules still win on test files.
 * Return types are inferred by convention (ADR 0004): no explicit return type rule is enabled.
 */
const STRICTER_TS_RULES = {
  'ts/array-type': ['error', { default: 'array' }],
  'ts/ban-ts-comment': ['error', { minimumDescriptionLength: 10 }],
  'ts/consistent-type-assertions': ['error', { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }],
  'ts/consistent-type-exports': 'error',
  'ts/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports', prefer: 'type-imports' }],
  'ts/dot-notation': 'error',
  'ts/explicit-function-return-type': 'off',
  'ts/explicit-module-boundary-types': 'off',
  'ts/no-confusing-void-expression': 'error',
  'ts/no-deprecated': 'error',
  'ts/no-empty-function': ['error', { allow: ['arrowFunctions', 'functions', 'methods'] }],
  'ts/no-explicit-any': 'error',
  'ts/no-meaningless-void-operator': 'error',
  'ts/no-misused-promises': ['error', { checksVoidReturn: true }],
  'ts/no-misused-spread': 'error',
  'ts/no-mixed-enums': 'error',
  'ts/no-namespace': 'error',
  'ts/no-shadow': 'off',
  'ts/no-unnecessary-boolean-literal-compare': 'error',
  'ts/no-unnecessary-condition': 'error',
  'ts/no-unnecessary-template-expression': 'error',
  'ts/no-unnecessary-type-arguments': 'error',
  'ts/no-unnecessary-type-conversion': 'error',
  'ts/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'ts/no-use-before-define': 'off',
  'ts/prefer-find': 'error',
  'ts/prefer-includes': 'error',
  'ts/prefer-nullish-coalescing': 'error',
  'ts/prefer-optional-chain': 'error',
  'ts/prefer-readonly': 'error',
  'ts/prefer-string-starts-ends-with': 'error',
  'ts/require-await': 'error',
  'ts/restrict-template-expressions': ['error', { allowNever: true }],
  'ts/return-await': ['error', 'error-handling-correctness-only'],
  'ts/switch-exhaustiveness-check': ['error', { requireDefaultForNonUnion: true }],
  'ts/use-unknown-in-catch-callback-variable': 'error',
};

/** Type imports first, then values; each as builtin > external > internal > relative. */
const IMPORT_ORDER = [
  'error',
  {
    groups: [
      'type-builtin',
      'type-external',
      'type-internal',
      ['type-parent', 'type-sibling', 'type-index'],
      'value-builtin',
      'value-external',
      'value-internal',
      ['value-parent', 'value-sibling', 'value-index'],
      'ts-equals-import',
      'side-effect',
      'unknown',
    ],
    internalPattern: ['^@agentic/.+', '^@/.+', '^#.+'],
    type: 'natural',
  },
];

/**
 * Shared base preset: the @w5s baseline (type-aware `ts`, perfectionist sorting, stylistic, node, Vitest,
 * jsonc, yml, markdown) plus the repo's stricter TypeScript rules and `no-console`.
 *
 * @param {string} tsconfigRootDir - consuming workspace root (typically `import.meta.dirname`).
 */
export async function createBase(tsconfigRootDir) {
  return defineConfig({
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.turbo/**'],
    overrides: [
      {
        files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
        ignores: ['**/*.md/**'],
        rules: {
          'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
          'no-console': 'error',
        },
      },
    ],
    plugins: {
      e18e: false,
      es: { restrictedImportPaths },
      jsdoc: false,
      jsx: false,
      perfectionist: {
        rules: { 'perfectionist/sort-imports': IMPORT_ORDER },
      },
      react: false,
      test: {
        rules: {
          'test/no-conditional-expect': 'off',
        },
      },
      ts: {
        parserOptions: { tsconfigRootDir },
        rules: STRICTER_TS_RULES,
      },
      unicorn: false,
    },
  });
}
