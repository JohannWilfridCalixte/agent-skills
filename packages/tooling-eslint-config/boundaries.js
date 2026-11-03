import { adapterRestrictedImportPaths, restrictedImportPaths } from './restricted-import-paths.js';

const SCOPE = '@agentic';
const SOURCE_FILES = ['src/**/*.{ts,tsx}'];
const TEST_FILES = ['src/**/*.test.{ts,tsx}'];

const escapeRegex = (value) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * Bare-specifier allowlist: relative imports are always allowed; listed packages may be imported by name or subpath.
 * Everything else (pg, kysely, hono, zod, node:*, adapters, contracts, apps, other domains) is rejected.
 *
 * @param {string[]} allow - package names.
 * @param {string} message
 */
function allowOnly(allow, message) {
  const alternation = allow.map((name) => `|${escapeRegex(name)}($|/)`).join('');
  return { message, regex: `^(?!\\.|/${alternation})` };
}

/** @param {string} slug */
function noEscape(slug) {
  return {
    group: ['../../**', '**/applications/**', '**/packages/**'],
    message: `${slug} must not reach outside its package via relative paths; depend on a package entrypoint instead.`,
  };
}

const NO_SERVICES = {
  group: ['**/services/**'],
  message: 'Dependencies point inward (services -> ports -> model): this layer must not import services.',
};

const NO_PORTS = {
  group: ['**/ports/**'],
  message: 'The model is the innermost layer and must not import ports.',
};

const restrict = (...patterns) => ['error', { paths: restrictedImportPaths, patterns }];
const restrictAdapter = (...patterns) => ['error', { paths: adapterRestrictedImportPaths, patterns }];

function pureBlocks({ allow, layered, slug }) {
  const production = allowOnly(
    allow,
    `${slug} is pure: import only relative modules${allow.length > 0 ? ` and ${allow.join(', ')}` : ''}. No pg, kysely, hono, zod, node:*, adapters, contracts or apps.`,
  );
  const test = allowOnly([...allow, 'vitest'], `${slug} tests may import only relative modules, ${[...allow, 'vitest'].join(', ')}.`);
  const escape = noEscape(slug);

  const blocks = [{ files: SOURCE_FILES, ignores: TEST_FILES, rules: { 'no-restricted-imports': restrict(production, escape) } }];
  if (layered) {
    blocks.push(
      {
        files: ['src/ports/**/*.ts'],
        ignores: TEST_FILES,
        rules: { 'no-restricted-imports': restrict(production, escape, NO_SERVICES) },
      },
      {
        files: ['src/model/**/*.ts'],
        ignores: TEST_FILES,
        rules: { 'no-restricted-imports': restrict(production, escape, NO_PORTS, NO_SERVICES) },
      },
    );
  }
  blocks.push({ files: TEST_FILES, rules: { 'no-restricted-imports': restrict(test, escape) } });
  return blocks;
}

/** `kernel-*`: pure, no dependencies at all. @param {string} slug */
export function kernelBoundaries(slug) {
  return pureBlocks({ allow: [], layered: false, slug });
}

/** `domain-shared`: pure, may only use `kernel-result`; inward layers. */
export function sharedDomainBoundaries() {
  return pureBlocks({ allow: [`${SCOPE}/kernel-result`], layered: true, slug: 'domain-shared' });
}

/**
 * `domain-<module>`: pure, may only use `kernel-result` and `domain-shared` (never another `domain-*`); inward layers.
 *
 * @param {string} slug
 */
export function domainBoundaries(slug) {
  return pureBlocks({ allow: [`${SCOPE}/kernel-result`, `${SCOPE}/domain-shared`], layered: true, slug });
}

const DECLARATIVE_ONLY_SYNTAX = [
  {
    message: 'contract-http is declarative: zod schemas and inferred types only, no functions (including refine/transform callbacks).',
    selector: ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)',
  },
  {
    message: 'contract-http is declarative: no classes.',
    selector: ':matches(ClassDeclaration, ClassExpression)',
  },
  {
    message: 'contract-http is declarative: no control flow.',
    selector:
      ':matches(IfStatement, ForStatement, ForInStatement, ForOfStatement, WhileStatement, DoWhileStatement, SwitchStatement, TryStatement, ThrowStatement)',
  },
  {
    message: 'contract-http exports named schemas and inferred types only, no default export.',
    selector: 'ExportDefaultDeclaration',
  },
];

/** `contract-*`: zod only, declarative. @param {string} slug */
export function contractBoundaries(slug) {
  const production = allowOnly(['zod'], `${slug} may import only relative modules and zod.`);
  const test = allowOnly(['zod', 'vitest'], `${slug} tests may import only relative modules, zod and vitest.`);
  const escape = noEscape(slug);
  return [
    {
      files: SOURCE_FILES,
      ignores: TEST_FILES,
      rules: {
        'no-restricted-imports': restrict(production, escape),
        'no-restricted-syntax': ['error', ...DECLARATIVE_ONLY_SYNTAX],
      },
    },
    { files: TEST_FILES, rules: { 'no-restricted-imports': restrict(test, escape) } },
  ];
}

const NO_DOMAIN_POLICY = {
  group: [`${SCOPE}/domain-*`, `!${SCOPE}/domain-shared`, `!${SCOPE}/domain-shared/**`, `${SCOPE}/contract-*`],
  message:
    'Adapters are shared infrastructure: they must not depend on module domain policy or wire contracts. Only kernel-result and domain-shared are allowed.',
};

/** `adapter-*` (and other infrastructure packages): runtime SDKs are fine, module domain policy is not. @param {string} slug */
export function adapterBoundaries(slug) {
  return [{ files: SOURCE_FILES, rules: { 'no-restricted-imports': restrictAdapter(NO_DOMAIN_POLICY, noEscape(slug)) } }];
}
