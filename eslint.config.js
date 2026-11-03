import { createBase } from '@agentic/tooling-eslint-config/base';

export default [
  {
    ignores: [
      'applications/**',
      'packages/**',
      'scripts/**',
      'skills/**',
      'docs/**',
      'tests/**',
      '.agentic/**',
      '.agents/**',
      '.claude-plugin/**',
      '.codex-plugin/**',
      '.cursor-plugin/**',
      '.cursor/**',
      '.local/**',
      '.tmp/**',
      '.turbo/**',
      'node_modules/**',
      'bun.lock',
      'README.md',
      'vendor*.json',
    ],
  },
  ...(await createBase(import.meta.dirname)),
];
