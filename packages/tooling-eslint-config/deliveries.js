import { restrictedSyntax } from '@w5s/eslint-config';

import { plugin } from './module-isolation.js';
import { restrictedImportPaths, serverRestrictedImportPaths } from './restricted-import-paths.js';

const NO_ESCAPE = {
  group: ['**/applications/**', '**/packages/**'],
  message: "Do not reach into another project's files by relative path; depend on its package entrypoint instead.",
};

/**
 * `applications/server`: modules under `src/modules/<name>/` never import each other (files, domain packages, contracts).
 */
export function serverBoundaries() {
  return [
    { plugins: { agentic: plugin } },
    {
      files: ['src/**/*.ts'],
      rules: { 'no-restricted-imports': ['error', { paths: serverRestrictedImportPaths, patterns: [NO_ESCAPE] }] },
    },
    {
      files: ['src/**/*.test.ts'],
      rules: { 'no-restricted-imports': ['error', { paths: serverRestrictedImportPaths, patterns: [NO_ESCAPE] }] },
    },
    {
      files: ['src/modules/**/*.ts'],
      rules: { 'agentic/module-isolation': 'error' },
    },
  ];
}

const SERVER_FUNCTIONS_MESSAGE =
  'The web app is a TanStack Start SPA without server functions (ADR 0005): Hono is the only backend. Call the API through the api client.';

/** `applications/web`: no TanStack Start server functions, no node-only packages. */
export function webBoundaries() {
  return [
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              ...restrictedImportPaths,
              {
                importNames: ['createServerFn', 'createServerOnlyFn', 'createMiddleware'],
                message: SERVER_FUNCTIONS_MESSAGE,
                name: '@tanstack/react-start',
              },
            ],
            patterns: [
              NO_ESCAPE,
              { group: ['@tanstack/react-start/server', '@tanstack/react-start/server/**'], message: SERVER_FUNCTIONS_MESSAGE },
              {
                group: ['@agentic/domain-*', '@agentic/adapter-*', 'node:*'],
                message: 'The web app talks to the server through @agentic/contract-http only.',
              },
            ],
          },
        ],
        'no-restricted-syntax': [
          'error',
          ...restrictedSyntax,
          { message: SERVER_FUNCTIONS_MESSAGE, selector: "CallExpression[callee.name='createServerFn']" },
        ],
      },
    },
  ];
}

/** `applications/web-e2e`: stay inside the project. */
export function e2eBoundaries() {
  return [
    {
      files: ['**/*.ts'],
      rules: { 'no-restricted-imports': ['error', { paths: restrictedImportPaths, patterns: [NO_ESCAPE] }] },
    },
  ];
}
