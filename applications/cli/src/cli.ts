import type { ConfigDiffLine } from '@agentic/contract-http/config';

import type { ParsedArgs } from './args.js';
import type { Client, ClientIo } from './client.js';

import { resolve } from 'node:path';

import { z } from 'zod';

import {
  ConfigPreviewResponse,
  ConfigRestorePreviewResponse,
  ConfigRestoreResponse,
  ConfigSaveResponse,
  EffectiveConfigResponse,
  RawConfigResponse,
} from '@agentic/contract-http/config';
import { HistoryList } from '@agentic/contract-http/history';
import {
  HarnessesResponse,
  InstallAction,
  InstallHarness,
  InstallMethod,
  InstallPreviewResponse,
  InstallRunResponse,
  InstallScope,
  InstallStatusResponse,
  ModelsResponse,
} from '@agentic/contract-http/install';
import { Project, ProjectList } from '@agentic/contract-http/projects';
import { VendoringPreviewResponse, VendoringRunResponse, VendoringStatusResponse } from '@agentic/contract-http/vendoring';
import { WorkItemDetail, WorkItemDoc, WorkItemList } from '@agentic/contract-http/work-items';

import { lastOption, parseArgs } from './args.js';
import { CliFailure, connect, EXIT_FAILURE } from './client.js';

export interface CliIo extends ClientIo {
  readonly cwd: string;
  /** The bun executable that runs the server. */
  readonly runtime: string;
  /** Absolute path of `applications/server/src/main.ts`. */
  readonly serverEntry: string;
  /** Runs `command` with inherited stdio and forwarded signals; resolves to its exit code. */
  readonly spawn: (command: readonly string[]) => Promise<number>;
  readonly stderr: (text: string) => void;
  readonly stdout: (text: string) => void;
}

const EXIT_OK = 0;
const EXIT_NOT_CONFIRMED = 2;

const USAGE = `Usage: agentic <command> [--json] [--port <port>]

  serve [--port <port>] [--project <dir>]
  projects list | add <path> | remove <id>
  config effective | get [--scope global|project:<id> | --project <id>]
  config set (--file <edited.json> | --key <a.b.c> --value <x> ...) [--scope …] [--yes]
  models <harness>
  install harnesses | status [--scope global|project] [--project <id>]
  install preview | run <harness|method> <action> [--harness <h>] [--scope …] [--project <id>] [--yes]
  history list [--scope …] | restore <id> [--yes]
  work-items list <project> | show <project> <slug> | doc <project> <slug> <name>
  vendoring status | check | verify <project>
  vendoring update (--skill <name> ... | --all) <project> [--yes]
`;

interface Context {
  readonly args: ParsedArgs;
  readonly client: Client;
  readonly io: CliIo;
  readonly json: boolean;
}

const usage = (message: string) => new CliFailure(EXIT_FAILURE, `${message}\n\n${USAGE}`);

function positional(context: Context, index: number, name: string) {
  const value = context.args.positionals[index];
  if (value === undefined || value === '') throw usage(`Missing <${name}>.`);
  return value;
}

const segment = (value: string) => encodeURIComponent(value);

/** Parses `argv` (without the executable) and runs one command; never exits the process. */
export async function runCli(argv: readonly string[], io: CliIo) {
  try {
    if (argv[0] === 'serve') return await io.spawn([io.runtime, '--conditions', 'development', io.serverEntry, ...argv.slice(1)]);
    const parsed = parseArgs(argv);
    if (!parsed.ok) throw usage(parsed.error);
    const args = parsed.value;
    const command = args.positionals[0];
    if (command === undefined || command === 'help') {
      io.stdout(USAGE);
      return command === undefined ? EXIT_FAILURE : EXIT_OK;
    }
    const client = await connect(io, lastOption(args, 'port'));
    return await dispatch(command, { args, client, io, json: args.flags.has('json') });
  } catch (error) {
    if (!(error instanceof CliFailure)) throw error;
    io.stderr(`${error.message}\n`);
    return error.code;
  }
}

async function dispatch(command: string, context: Context) {
  switch (command) {
    case 'config': {
      return configCommand(context);
    }
    case 'history': {
      return historyCommand(context);
    }
    case 'install': {
      return installCommand(context);
    }
    case 'models': {
      return modelsCommand(context);
    }
    case 'projects': {
      return projectsCommand(context);
    }
    case 'vendoring': {
      return vendoringCommand(context);
    }
    case 'work-items': {
      return workItemsCommand(context);
    }
    default: {
      throw usage(`Unknown command "${command}".`);
    }
  }
}

function print(context: Context, value: unknown, human: () => string) {
  context.io.stdout(context.json ? `${JSON.stringify(value, null, 2)}\n` : human());
  return EXIT_OK;
}

const lines = (items: readonly string[]) => items.map((item) => `${item}\n`).join('');

const DIFF_PREFIX = { added: '+ ', context: '  ', removed: '- ' } as const satisfies Record<ConfigDiffLine['kind'], string>;

const formatDiff = (diff: readonly ConfigDiffLine[]) => (diff.length === 0 ? 'No changes.\n' : lines(diff.map((line) => `${DIFF_PREFIX[line.kind]}${line.text}`)));

// projects

function configScope({ args }: Context) {
  const project = lastOption(args, 'project');
  if (project !== undefined) return `project:${project}`;
  return lastOption(args, 'scope') ?? 'global';
}

// config

async function projectsCommand(context: Context) {
  const { client } = context;
  const action = positional(context, 1, 'list|add|remove');
  switch (action) {
    case 'add': {
      const project = await client.post('/api/projects', Project, { path: resolve(context.io.cwd, positional(context, 2, 'path')) });
      return print(context, project, () => `Added ${project.id}  ${project.path}\n`);
    }
    case 'list': {
      const list = await client.get('/api/projects', ProjectList);
      return print(context, list, () => (list.projects.length === 0 ? 'No projects.\n' : lines(list.projects.map((project) => `${project.id}  ${project.path}`))));
    }
    case 'remove': {
      const id = positional(context, 2, 'id');
      await client.delete(`/api/projects/${segment(id)}`, z.undefined());
      return print(context, { removed: id }, () => `Removed ${id}\n`);
    }
    default: {
      throw usage(`Unknown projects action "${action}".`);
    }
  }
}

const scopeLabel = (scope: string) => (scope === 'global' ? 'global config' : `${scope} config`);

async function configCommand(context: Context) {
  const { client } = context;
  const action = positional(context, 1, 'effective|get|set');
  const scope = configScope(context);
  const path = `/api/config/${segment(scope)}`;
  switch (action) {
    case 'effective': {
      const effective = await client.get(`${path}/effective`, EffectiveConfigResponse);
      return print(context, effective, () => formatEffective(effective));
    }
    case 'get': {
      const raw = await client.get(path, RawConfigResponse);
      return print(context, raw, () => (raw.text ?? `No ${scopeLabel(scope)} file yet.\n`));
    }
    case 'set': {
      return configSet(context, scope);
    }
    default: {
      throw usage(`Unknown config action "${action}".`);
    }
  }
}

async function configSet(context: Context, scope: string) {
  const { client, io } = context;
  const edited = await editedConfig(context, scope);
  const preview = await client.post(`/api/config/${segment(scope)}/preview`, ConfigPreviewResponse, edited);
  if (!context.json) io.stdout(formatDiff(preview.diff));
  for (const warning of preview.warnings) io.stderr(`warning: ${warning.path}: ${warning.message}\n`);
  if (preview.issues.length > 0) {
    if (context.json) io.stdout(`${JSON.stringify(preview, null, 2)}\n`);
    throw new CliFailure(EXIT_FAILURE, `Invalid config, nothing written:\n${lines(preview.issues.map((issue) => `  ${issue.path}: ${issue.message}`)).trimEnd()}`);
  }
  if (!context.args.flags.has('yes')) {
    return print(context, preview, () => 'Nothing written. Re-run with --yes to save.\n');
  }
  const saved = await client.put(`/api/config/${segment(scope)}`, ConfigSaveResponse, edited);
  return print(context, saved, () => (saved.changed ? `Saved ${scopeLabel(scope)}.\n` : 'No change: the file already holds this config.\n'));
}

async function editedConfig(context: Context, scope: string) {
  const file = lastOption(context.args, 'file');
  if (file !== undefined) {
    let text = '';
    try {
      text = await context.io.readFile(resolve(context.io.cwd, file));
    } catch {
      throw new CliFailure(EXIT_FAILURE, `Cannot read ${file}.`);
    }
    const parsed = z.record(z.string(), z.unknown()).safeParse(parseValue(text));
    if (!parsed.success) throw new CliFailure(EXIT_FAILURE, `${file} must hold a JSON object.`);
    return parsed.data;
  }
  const keys = context.args.options.get('key') ?? [];
  const values = context.args.options.get('value') ?? [];
  if (keys.length === 0 || keys.length !== values.length) throw usage('config set needs --file <edited.json>, or --key/--value pairs.');
  const raw = await context.client.get(`/api/config/${segment(scope)}`, RawConfigResponse);
  const edited = structuredClone(raw.config);
  for (const [index, key] of keys.entries()) setPath(edited, key, parseValue(values[index] ?? ''));
  return edited;
}

/** Streams the run's lines live (stdout lines to stdout, stderr lines to stderr) and resolves to its exit code. */
async function followRun(context: Context, runId: string) {
  const { io } = context;
  let exitCode: number | undefined;
  let status: string | undefined;
  for await (const event of context.client.events(runId)) {
    if (context.json) io.stdout(`${JSON.stringify(event)}\n`);
    switch (event.type) {
      case 'dropped': {
        if (!context.json) io.stderr(`Earlier output was dropped (${String(event.dropped)} lines); the run history keeps the output tail.\n`);
        break;
      }
      case 'exit': {
        exitCode = event.exitCode;
        break;
      }
      case 'status': {
        ({ status } = event);
        break;
      }
      case 'stderr': {
        if (!context.json) io.stderr(`${event.line}\n`);
        break;
      }
      case 'stdout': {
        if (!context.json) io.stdout(`${event.line}\n`);
        break;
      }
      default: {
        event satisfies never;
      }
    }
  }
  if (status === 'succeeded') return EXIT_OK;
  if (!context.json) io.stderr(`Run ${status ?? 'ended without a status'}${exitCode === undefined ? '' : ` (exit code ${String(exitCode)})`}.\n`);
  return exitCode !== undefined && exitCode !== 0 ? exitCode : EXIT_FAILURE;
}

function formatEffective({ config, scope, unknownKeys }: EffectiveConfigResponse) {
  const entries: string[] = [`# ${scopeLabel(scope)} (effective)`];
  const add = (key: string, field: { readonly origin: string; readonly value: unknown }) => {
    const value = typeof field.value === 'string' ? field.value : JSON.stringify(field.value);
    entries.push(`${key} = ${value} (${field.origin})`);
  };
  add('commitWork', config.commitWork);
  add('knowledge.root', config.knowledge.root);
  add('output', config.output);
  add('worktrees', config.worktrees);
  add('reviewers', config.reviewers);
  add('selectedProfiles', config.selectedProfiles);
  add('profiles', { origin: config.profiles.origin, value: config.profiles.value.map((profile) => profile.name) });
  for (const [key, field] of Object.entries(config.limits)) add(`limits.${key}`, field);
  for (const [harness, steps] of Object.entries(config.steps)) {
    for (const [step, settings] of Object.entries(steps)) {
      for (const [name, field] of Object.entries(settings)) if (field !== undefined) add(`steps.${harness}.${step}.${name}`, field);
    }
  }
  for (const unknown of unknownKeys) entries.push(`unknown key (${unknown.scope}): ${unknown.path}`);
  return lines(entries);
}

function formatItem(item: WorkItemList['items'][number]) {
  const state = item.state.readable ? [item.state.title, item.state.phase, item.state.status, item.state.updated].filter((part) => part !== null).join('  ') : `unreadable state (${item.state.reason})`;
  return `${item.slug}${item.archived ? ' [archived]' : ''}  ${state}`;
}

// models

async function historyCommand(context: Context) {
  const { client } = context;
  const action = positional(context, 1, 'list|restore');
  switch (action) {
    case 'list': {
      const query = new URLSearchParams({ scope: configScope(context) });
      const body = await client.get(`/api/history?${query.toString()}`, HistoryList);
      return print(context, body, () =>
        body.entries.length === 0
          ? 'No history.\n'
          : lines(body.entries.map((entry) => `${entry.id}  ${entry.createdAt}  ${entry.kind}${entry.exitCode === null ? '' : ` (exit ${String(entry.exitCode)})`}  ${entry.summary}`)),
      );
    }
    case 'restore': {
      const id = segment(positional(context, 2, 'id'));
      const preview = await client.post(`/api/config/restore/${id}/preview`, ConfigRestorePreviewResponse);
      if (!context.json) context.io.stdout(formatDiff(preview.diff));
      if (!context.args.flags.has('yes')) return print(context, preview, () => `Nothing written. Re-run with --yes to restore ${scopeLabel(preview.scope)}.\n`);
      const restored = await client.post(`/api/config/restore/${id}`, ConfigRestoreResponse);
      return print(context, restored, () => (restored.changed ? `Restored ${scopeLabel(restored.scope)}.\n` : 'No change: the file already holds this content.\n'));
    }
    default: {
      throw usage(`Unknown history action "${action}".`);
    }
  }
}

// install

async function installCommand(context: Context) {
  const { client } = context;
  const action = positional(context, 1, 'harnesses|status|preview|run');
  switch (action) {
    case 'harnesses': {
      const body = await client.get('/api/install/harnesses', HarnessesResponse);
      return print(context, body, () =>
        lines(body.harnesses.map((entry) => `${entry.harness}  ${entry.present ? 'present' : 'absent'}  ${entry.cli.found ? `cli ${entry.cli.version}` : 'cli not found'}  ${entry.reason}`)),
      );
    }
    case 'preview': {
      const preview = await client.post('/api/install/preview', InstallPreviewResponse, installTarget(context));
      return print(context, preview, () => lines(preview.commands.map((command) => command.display)));
    }
    case 'run': {
      const target = installTarget(context);
      const preview = await client.post('/api/install/preview', InstallPreviewResponse, target);
      if (!context.args.flags.has('yes')) return notConfirmed(context, preview, preview.commands.map((command) => command.display));
      const run = await client.post('/api/install/runs', InstallRunResponse, { ...target, confirm: true });
      return followRun(context, run.id);
    }
    case 'status': {
      const { projectId, scope } = installScope(context);
      const query = new URLSearchParams({ scope, ...(projectId === undefined ? {} : { projectId }) });
      const body = await client.get(`/api/install/status?${query.toString()}`, InstallStatusResponse);
      return print(context, body, () =>
        lines(
          body.statuses.map((entry) =>
            [entry.harness, entry.method, entry.scope, entry.state, entry.version, entry.updateAvailable === true ? 'update available' : undefined, entry.available ? undefined : `unavailable: ${entry.reason ?? ''}`]
              .filter((part) => part !== undefined)
              .join('  '),
          ),
        ),
      );
    }
    default: {
      throw usage(`Unknown install action "${action}".`);
    }
  }
}

function installScope(context: Context) {
  const projectId = lastOption(context.args, 'project');
  const scope = InstallScope.safeParse(lastOption(context.args, 'scope') ?? (projectId === undefined ? 'global' : 'project'));
  if (!scope.success) throw usage(`--scope must be one of ${InstallScope.options.join(', ')}.`);
  return { projectId, scope: scope.data };
}

function installTarget(context: Context) {
  const target = positional(context, 2, 'harness|method');
  const action = InstallAction.safeParse(positional(context, 3, 'action'));
  if (!action.success) throw usage(`<action> must be one of ${InstallAction.options.join(', ')}.`);
  const harnessTarget = InstallHarness.safeParse(target);
  const methodTarget = InstallMethod.safeParse(target);
  const harnessOption = lastOption(context.args, 'harness');
  let method: InstallMethod;
  let harness: string | undefined;
  if (harnessTarget.success) {
    harness = harnessTarget.data;
    method = harness === 'cursor' ? 'clone' : 'plugin';
  } else if (methodTarget.success) {
    method = methodTarget.data;
    harness = harnessOption;
  } else {
    throw usage(`<harness|method> must be one of ${[...InstallHarness.options, ...InstallMethod.options].join(', ')}.`);
  }
  const { projectId, scope } = installScope(context);
  return { action: action.data, method, scope, ...(harness === undefined ? {} : { harness }), ...(projectId === undefined ? {} : { projectId }) };
}

async function modelsCommand(context: Context) {
  const harness = InstallHarness.safeParse(positional(context, 1, 'harness'));
  if (!harness.success) throw usage(`<harness> must be one of ${InstallHarness.options.join(', ')}.`);
  const models = await context.client.get(`/api/models?harness=${harness.data}`, ModelsResponse);
  return print(context, models, () => (models.available ? lines(models.ids) : `Models unavailable: ${models.reason}\n`));
}

function notConfirmed(context: Context, preview: unknown, commands: readonly string[]) {
  print(context, preview, () => `${lines(commands)}Nothing ran. Re-run with --yes to run ${commands.length === 1 ? 'this command' : 'these commands'}.\n`);
  return EXIT_NOT_CONFIRMED;
}

// history

/** A `--value` that parses as JSON is used as such (`true`, `3`, `["a"]`, `"quoted"`); anything else is a plain string. */
function parseValue(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

// work items

const SCALAR_KEYS = new Set(['commitWork', 'knowledge', 'limits', 'output', 'profiles', 'reviewers', 'selectedProfiles', 'steps', 'worktrees']);
const STEP_FIELDS = new Set(['effort', 'harness', 'model']);
const KEY_FORMS =
  'Valid --key forms: output, commitWork, worktrees, profiles, selectedProfiles, reviewers, knowledge, knowledge.root, steps, limits, limits.<limitKey>, steps.<harness>.<stepKey>.<harness|model|effort>. Use --file for other edits.';

/** Maps a dotted `--key` onto the config file shape: flat dotted `limits` keys, dotted step keys, nested `knowledge.root`. */
function configPath(key: string): readonly string[] {
  const parts = key.split('.');
  const [top, ...rest] = parts;
  const bad = () => usage(`Invalid --key "${key}". ${KEY_FORMS}`);
  if (top === undefined || parts.includes('') || !SCALAR_KEYS.has(top)) throw bad();
  if (rest.length === 0) return [top];
  if (top === 'knowledge' && rest.length === 1 && rest[0] === 'root') return parts;
  if (top === 'limits') return [top, rest.join('.')];
  if (top === 'steps' && rest.length >= 3) {
    const field = rest.at(-1) ?? '';
    if (STEP_FIELDS.has(field)) return [top, rest[0] ?? '', rest.slice(1, -1).join('.'), field];
  }
  throw bad();
}

function setPath(target: Record<string, unknown>, key: string, value: unknown) {
  const path = configPath(key);
  if (path[0] === 'limits' && path.length === 2 && typeof value !== 'number') throw usage(`--key ${key} needs a numeric --value.`);
  let node = target;
  for (const segment of path.slice(0, -1)) {
    const child = node[segment];
    const next = typeof child === 'object' && child !== null && !Array.isArray(child) ? { ...(child as Record<string, unknown>) } : {};
    node[segment] = next;
    node = next;
  }
  node[path.at(-1) ?? ''] = value;
}

async function vendoringCommand(context: Context) {
  const { client } = context;
  const action = positional(context, 1, 'status|check|verify|update');
  const base = `/api/vendoring/${segment(positional(context, 2, 'project'))}`;
  switch (action) {
    case 'check':
    case 'verify': {
      const run = await client.post(`${base}/runs`, VendoringRunResponse, { action, confirm: true });
      return followRun(context, run.id);
    }
    case 'status': {
      const status = await client.get(`${base}/status`, VendoringStatusResponse);
      return print(context, status, () => (status.available ? lines(status.skills.map((skill) => `${skill.name}  ${skill.source}  ${skill.ref ?? 'not pinned'}`)) : 'No vendor.json in this project.\n'));
    }
    case 'update': {
      const skills = context.args.options.get('skill') ?? [];
      const all = context.args.flags.has('all');
      if (all === (skills.length > 0)) throw usage('vendoring update needs --skill <name> (repeatable) or --all.');
      const body = { action, ...(all ? { all: true } : { skills }) };
      const preview = await client.post(`${base}/preview`, VendoringPreviewResponse, body);
      if (!context.args.flags.has('yes')) return notConfirmed(context, preview, [preview.command.display]);
      const run = await client.post(`${base}/runs`, VendoringRunResponse, { ...body, confirm: true });
      return followRun(context, run.id);
    }
    default: {
      throw usage(`Unknown vendoring action "${action}".`);
    }
  }
}

// vendoring

async function workItemsCommand(context: Context) {
  const { client } = context;
  const action = positional(context, 1, 'list|show|doc');
  const base = `/api/projects/${segment(positional(context, 2, 'project'))}/work-items`;
  switch (action) {
    case 'doc': {
      const doc = await client.get(`${base}/${segment(positional(context, 3, 'slug'))}/docs/${segment(positional(context, 4, 'name'))}`, WorkItemDoc);
      return print(context, doc, () => `${doc.text}${doc.truncated ? '\n[truncated at 1 MB]\n' : ''}`);
    }
    case 'list': {
      const list = await client.get(base, WorkItemList);
      return print(context, list, () => (list.items.length === 0 ? 'No work items.\n' : lines(list.items.map((item) => formatItem(item)))));
    }
    case 'show': {
      const detail = await client.get(`${base}/${segment(positional(context, 3, 'slug'))}`, WorkItemDetail);
      return print(context, detail, () => `${formatItem(detail)}\ndocs:\n${lines(detail.docs.map((doc) => `  ${doc}`))}events: ${String(detail.timeline.events.length)}\n`);
    }
    default: {
      throw usage(`Unknown work-items action "${action}".`);
    }
  }
}
