import { dirname, resolve } from 'node:path';

const MODULE_DIRECTORY = /[/\\]src[/\\]modules[/\\]([^/\\]+)[/\\]/;
const MODULE_PACKAGE = /^@agentic\/(?:domain-([^/]+)|contract-http\/([^/]+))/;
const SHARED_PACKAGE_SEGMENTS = new Set(['platform', 'problem', 'shared']);

function importedModule(specifier, filename) {
  if (specifier.startsWith('.')) {
    return MODULE_DIRECTORY.exec(resolve(dirname(filename), specifier))?.[1];
  }
  const match = MODULE_PACKAGE.exec(specifier);
  const segment = match?.[1] ?? match?.[2];
  return segment === undefined || SHARED_PACKAGE_SEGMENTS.has(segment) ? undefined : segment;
}

/**
 * `applications/server/src/modules/<a>/**` must not import `modules/<b>/**`, `@agentic/domain-<b>` or
 * `@agentic/contract-http/<b>`. Cross-module needs go through shared ports wired in the composition root.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const moduleIsolation = {
  create(context) {
    const ownModule = MODULE_DIRECTORY.exec(context.filename)?.[1];
    if (ownModule === undefined) return {};

    const check = (node) => {
      const { source } = node;
      if (source?.type !== 'Literal' || typeof source.value !== 'string') return;

      const target = importedModule(source.value, context.filename);
      if (target !== undefined && target !== ownModule) {
        context.report({ data: { from: ownModule, to: target }, messageId: 'crossModule', node: source });
      }
    };

    return {
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      ImportDeclaration: check,
      ImportExpression: check,
    };
  },
  meta: {
    docs: { description: 'Server modules never import each other.' },
    messages: {
      crossModule:
        'Module "{{from}}" must not import module "{{to}}". Use a shared port from @agentic/domain-shared, wired in the composition root.',
    },
    schema: [],
    type: 'problem',
  },
};

export const plugin = {
  meta: { name: '@agentic/eslint-plugin' },
  rules: { 'module-isolation': moduleIsolation },
};
