import type { Command, InvalidRunSpec, RunSpec } from '@agentic/domain-shared';

import { isCommandCli } from '@agentic/domain-shared';
import { err, ok } from '@agentic/kernel-result';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null;
const isStringArray = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isTimeout = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
const isOptional = (value: unknown, guard: (value: unknown) => boolean) => value === undefined || guard(value);

const isCommand = (value: unknown): value is Command =>
  isRecord(value) &&
  isCommandCli(value['cli']) &&
  isStringArray(value['args']) &&
  isOptional(value['cwd'], isNonEmptyString) &&
  isOptional(value['timeoutMs'], isTimeout) &&
  isOptional(value['correlationId'], isNonEmptyString);
const isCommandList = (value: unknown): value is readonly Command[] => Array.isArray(value) && value.every(isCommand);
const copyCommand = ({ args, cli, correlationId, cwd, timeoutMs }: Command): Command => ({
  args: [...args],
  cli,
  ...(correlationId === undefined ? {} : { correlationId }),
  ...(cwd === undefined ? {} : { cwd }),
  ...(timeoutMs === undefined ? {} : { timeoutMs }),
});

/** Runtime guard for the closed `RunSpec` (AC26): the types vanish at runtime, the rule must not. */
export function parseRunSpec(input: unknown) {
  if (!isRecord(input)) return err({ issues: ['spec must be an object'], type: 'invalid_run_spec' } satisfies InvalidRunSpec);
  const { args, cli, correlationId, cwd, next, scope, summary, timeoutMs } = input;
  const issues = [
    ...(isCommandCli(cli) ? [] : [`cli ${JSON.stringify(cli)} is not an allowed CLI`]),
    ...(isStringArray(args) ? [] : ['args must be an array of strings']),
    ...(cwd === undefined || isNonEmptyString(cwd) ? [] : ['cwd must be a non-empty string']),
    ...(next === undefined || isCommandList(next) ? [] : ['next must be a list of commands with an allowed cli']),
    ...(isNonEmptyString(scope) ? [] : ['scope must be a non-empty string']),
    ...(typeof summary === 'string' ? [] : ['summary must be a string']),
    ...(isOptional(timeoutMs, isTimeout) ? [] : ['timeoutMs must be a positive integer']),
    ...(isOptional(correlationId, isNonEmptyString) ? [] : ['correlationId must be a non-empty string']),
  ];
  if (issues.length > 0 || !isCommandCli(cli) || !isStringArray(args) || !isNonEmptyString(scope) || typeof summary !== 'string') {
    return err({ issues, type: 'invalid_run_spec' } satisfies InvalidRunSpec);
  }
  const spec: RunSpec = {
    args: [...args],
    cli,
    scope,
    summary,
    ...(isNonEmptyString(correlationId) ? { correlationId } : {}),
    ...(isNonEmptyString(cwd) ? { cwd } : {}),
    ...(isTimeout(timeoutMs) ? { timeoutMs } : {}),
    ...(isCommandList(next) ? { next: next.map(copyCommand) } : {}),
  };
  return ok(spec);
}
