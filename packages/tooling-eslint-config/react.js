import tanstackQuery from '@tanstack/eslint-plugin-query';
import tanstackRouter from '@tanstack/eslint-plugin-router';
import { jsx, react } from '@w5s/eslint-config';
import reactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';

const rulesOf = (configs) => Object.assign({}, ...configs.map((config) => config.rules ?? {}));

/**
 * React preset for `applications/web`: @eslint-react (via @w5s), jsx-a11y, react-hooks, TanStack Query/Router and
 * testing-library on test files. @eslint-react replaces eslint-plugin-react, which does not support ESLint 10.
 */
export async function createReact() {
  return [
    ...(await react()),
    ...(await jsx({ jsxA11y: true })),
    {
      files: ['**/*.{ts,tsx}'],
      plugins: {
        '@tanstack/query': tanstackQuery,
        '@tanstack/router': tanstackRouter,
        'react-hooks': reactHooks,
      },
      rules: {
        ...reactHooks.configs['recommended-latest'].rules,
        ...rulesOf(tanstackQuery.configs['flat/recommended']),
        ...rulesOf(tanstackRouter.configs['flat/recommended']),
      },
    },
    {
      files: ['**/*.test.{ts,tsx}'],
      plugins: { 'testing-library': testingLibrary },
      rules: {
        ...testingLibrary.configs['flat/react'].rules,
        'testing-library/no-container': 'off',
      },
    },
  ];
}
