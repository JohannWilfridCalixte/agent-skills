#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

const harnesses = ['claude', 'cursor', 'codex'];
const workflows = [
  'to-spec', 'to-plan', 'to-tickets', 'implement', 'review', 'babysit-pr', 'cleanup', 'grill-me',
  'grill-product', 'grill-functional', 'grill-tech', 'implement-feature', 'change-feature', 'debug',
  'pr-review', 'security-audit',
];
const playbooks = ['implement-feature', 'change-feature', 'debug', 'pr-review', 'security-audit'];
const eventTypes = ['started', 'progress', 'completed', 'failed', 'decision', 'escalation', 'artifact', 'gate', 'note'];

class CliError extends Error {
  constructor(
    readonly exitCode: 1 | 2,
    message: string,
    readonly showUsage = true,
  ) {
    super(message);
  }
}

interface Context {
  readonly positionals: readonly string[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}

interface Command {
  readonly name: string;
  readonly usage: string;
  readonly arguments: number;
  readonly flags: readonly string[];
  readonly switches?: readonly string[];
  readonly lists?: readonly string[];
  readonly required: readonly string[];
  readonly run: (context: Context) => Promise<void>;
}

interface StoredEvent {
  readonly ts: string;
  readonly work: string;
  readonly run: string;
  readonly harness: string;
  readonly workflow: string;
  readonly step: string | null;
  readonly type: string;
  readonly task?: string;
  readonly iteration?: number;
  readonly agent?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly summary: string;
  readonly ref?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

interface WorkItem {
  readonly name: string;
  readonly dir: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const textOf = (value: unknown) => (typeof value === 'string' ? value : undefined);

const flagText = (context: Context, name: string) => textOf(context.values[name]);

const flagList = (context: Context, name: string): string[] => stringsOf(context.values[name]);

const writeOut = (text: string) => process.stdout.write(text);

const nowTimestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const readJsonFile = (path: string) => {
  if (!existsSync(path)) return undefined;

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return parsed;
  } catch {
    return undefined;
  }
};

const gitOutput = (cwd: string, args: readonly string[]) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });

  return result.status === 0 ? result.stdout : undefined;
};

const patchIdSince = (cwd: string, base: string | undefined) => {
  if (base === undefined) return undefined;
  const remoteBase = `origin/${base}`;
  const ref = gitOutput(cwd, ['rev-parse', '--verify', '--quiet', remoteBase]) === undefined ? base : remoteBase;
  const mergeBase = gitOutput(cwd, ['merge-base', ref, 'HEAD'])?.trim();
  if (mergeBase === undefined) return undefined;
  const result = spawnSync('sh', ['-c', 'git diff "$1" HEAD | git patch-id --verbatim', 'sh', mergeBase], { cwd, encoding: 'utf8' });

  return result.status === 0 ? result.stdout.split(' ')[0]?.trim() || undefined : undefined;
};

const linkedWorktrees = (cwd: string) => {
  const listing = gitOutput(cwd, ['worktree', 'list', '--porcelain']);
  const paths = (listing?.split('\n') ?? []).filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));

  return paths.slice(1);
};

const mainCheckout = (cwd: string) => {
  const listing = gitOutput(cwd, ['worktree', 'list', '--porcelain']);
  const firstEntry = listing?.split('\n').find((line) => line.startsWith('worktree '));

  return firstEntry ? firstEntry.slice('worktree '.length) : cwd;
};

const outputRoot = (context: Context) => {
  const override = context.env.AGENTIC_OUTPUT;
  if (override) return resolve(context.cwd, override);

  const main = mainCheckout(context.cwd);
  const config = readJsonFile(join(main, '.agentic.json'));
  const configured = isRecord(config) ? textOf(config.output) : undefined;

  return resolve(main, configured ?? '.agentic/work');
};

const managerFolder = '_manager';

const listItemNames = async (root: string) => {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== '_archive' && entry.name !== managerFolder && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
};

const realPathOrSelf = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

const workspaceMatchesCwd = (root: string, name: string, cwd: string) => {
  const state = readJsonFile(join(root, name, 'state.json'));
  const workspace = isRecord(state) ? state.workspace : undefined;
  const path = isRecord(workspace) ? textOf(workspace.path) : undefined;
  if (path === undefined) return false;

  const toplevel = gitOutput(cwd, ['rev-parse', '--show-toplevel'])?.trim();
  const here = [cwd, toplevel].filter((candidate) => candidate !== undefined).map(realPathOrSelf);

  return here.includes(realPathOrSelf(path));
};

const todayPrefix = () => nowTimestamp().slice(0, 10).replaceAll('-', '');

const resolveWorkItem = async (context: Context, options: { readonly allowCreate: boolean }): Promise<WorkItem> => {
  const root = outputRoot(context);
  const names = await listItemNames(root);
  const slug = flagText(context, 'work');

  if (slug !== undefined) {
    const matches = names.filter((name) => name === slug || name.endsWith(`-${slug}`));
    if (matches.length > 1) throw new CliError(2, `--work ${slug} matches several work items: ${matches.join(', ')}`);

    const [match] = matches;
    if (match !== undefined) return { name: match, dir: join(root, match) };
    if (!options.allowCreate) throw new CliError(2, `no work item matches --work ${slug}`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new CliError(1, `invalid --work slug "${slug}"`);

    const name = /^\d{8}-/.test(slug) ? slug : `${todayPrefix()}-${slug}`;

    return { name, dir: join(root, name) };
  }

  const matches = names.filter((name) => workspaceMatchesCwd(root, name, context.cwd));
  const [match] = matches;
  if (matches.length === 1 && match !== undefined) return { name: match, dir: join(root, match) };

  const reason = matches.length === 0 ? 'no work item has this workspace' : 'several work items have this workspace';
  const candidates = (matches.length === 0 ? names : matches).join(', ') || 'none';
  throw new CliError(1, `${reason}; pass --work <slug>. Candidates: ${candidates}`);
};

const parseStoredEvent = (line: string, lineNumber: number) => {
  const fail = (reason: string) => new CliError(1, `events.jsonl line ${lineNumber}: ${reason}`);
  let parsed: unknown;

  try {
    parsed = JSON.parse(line);
  } catch {
    throw fail('not valid JSON');
  }
  if (!isRecord(parsed)) throw fail('not a JSON object');

  const { ts, type, workflow, step, task, agent, model, effort, ref, iteration, data } = parsed;
  if (typeof ts !== 'string' || typeof type !== 'string' || typeof workflow !== 'string') {
    throw fail('ts, type and workflow must be strings');
  }

  const event: StoredEvent = {
    ts,
    work: textOf(parsed.work) ?? '',
    run: textOf(parsed.run) ?? '',
    harness: textOf(parsed.harness) ?? '',
    workflow,
    step: textOf(step) ?? null,
    type,
    task: textOf(task),
    iteration: typeof iteration === 'number' ? iteration : undefined,
    agent: textOf(agent),
    model: textOf(model),
    effort: textOf(effort),
    summary: textOf(parsed.summary) ?? '',
    ref: textOf(ref),
    data: isRecord(data) ? data : {},
  };

  return event;
};

const readEvents = async (item: WorkItem) => {
  const path = join(item.dir, 'events.jsonl');
  if (!existsSync(path)) return [];

  const lines = (await readFile(path, 'utf8')).split('\n');

  return lines
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim() !== '')
    .map(({ line, lineNumber }) => parseStoredEvent(line, lineNumber));
};

const isCleanup = (event: StoredEvent) =>
  event.workflow === 'cleanup' || event.step === 'cleanup' || event.data.skill === 'cleanup';

const isWorkflowLevel = (event: StoredEvent) => event.step === null;

interface EventInput {
  readonly ts?: string;
  readonly work?: string;
  readonly run?: string;
  readonly harness?: string;
  readonly workflow?: string;
  readonly step?: string;
  readonly type?: string;
  readonly task?: string;
  readonly iteration?: string;
  readonly agent?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly summary?: string;
  readonly ref?: string;
  readonly data?: Record<string, unknown>;
}

const isEnum = (list: readonly string[]) => (value: string) => list.includes(value);
const isNonEmpty = (value: string) => value !== '';
const isTimestamp = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value);
const isRunId = (value: string) => /^[0-9a-f]{4}$/.test(value);
const isPositiveInteger = (value: string) => /^[1-9]\d*$/.test(value);

const optionalField = <Key extends string>(key: Key, value: unknown) =>
  value === undefined ? {} : { [key]: value };

const validateEvent = (input: EventInput, inputErrors: readonly string[] = []) => {
  const errors = [...inputErrors];
  const checked = (field: string, value: string | undefined, valid: (value: string) => boolean, expected: string) => {
    if (value === undefined) {
      errors.push(`${field}: required`);
      return undefined;
    }
    if (valid(value)) return value;

    errors.push(`${field}: expected ${expected}, got "${value}"`);
    return undefined;
  };
  const checkedOptional = (field: string, value: string | undefined, valid: (value: string) => boolean, expected: string) =>
    value === undefined ? undefined : checked(field, value, valid, expected);

  const ts = checked('ts', input.ts, isTimestamp, 'ISO 8601 UTC');
  const work = checked('work', input.work, isNonEmpty, 'a work item id');
  const run = checked('run', input.run, isRunId, '4 hex chars');
  const harness = checked('harness', input.harness, isEnum(harnesses), harnesses.join('|'));
  const workflow = checked('workflow', input.workflow, isEnum(workflows), workflows.join('|'));
  const type = checked('type', input.type, isEnum(eventTypes), eventTypes.join('|'));
  const summary = checked('summary', input.summary, isNonEmpty, 'a non-empty line');
  const step = checkedOptional('step', input.step, isNonEmpty, 'a step key');
  const task = checkedOptional('task', input.task, isNonEmpty, 'a unit id');
  const agent = checkedOptional('agent', input.agent, isNonEmpty, 'an agent label');
  const model = checkedOptional('model', input.model, isNonEmpty, 'a model id');
  const effort = checkedOptional('effort', input.effort, isNonEmpty, 'an effort');
  const ref = checkedOptional('ref', input.ref, isNonEmpty, 'a path');
  const iteration = checkedOptional('iteration', input.iteration, isPositiveInteger, 'a positive integer');

  if (type === 'failed' && typeof input.data?.reason !== 'string') {
    errors.push('data.reason: required for failed events');
  }

  if (
    errors.length > 0 || ts === undefined || work === undefined || run === undefined || harness === undefined ||
    workflow === undefined || type === undefined || summary === undefined
  ) {
    return { errors };
  }

  const event = {
    ts,
    work,
    run,
    harness,
    workflow,
    step: step ?? null,
    ...optionalField('task', task),
    ...optionalField('iteration', iteration === undefined ? undefined : Number(iteration)),
    type,
    ...optionalField('model', model),
    ...optionalField('effort', effort),
    ...optionalField('agent', agent),
    summary,
    ...optionalField('ref', ref),
    ...optionalField('data', input.data),
  };

  return { event };
};

interface Appended {
  readonly item: WorkItem;
  readonly event: StoredEvent;
}

const appended: Appended[] = [];

const appendEvent = async (item: WorkItem, event: object) => {
  const line = JSON.stringify(event);
  appended.push({ item, event: parseStoredEvent(line, 0) });
  await mkdir(item.dir, { recursive: true });
  await appendFile(join(item.dir, 'events.jsonl'), `${line}\n`);

  return line;
};

const parseDataFlag = (raw: string | undefined) => {
  if (raw === undefined) return { errors: [] };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) return { errors: [], data: parsed };

    return { errors: ['data: expected a JSON object'] };
  } catch {
    return { errors: ['data: not valid JSON'] };
  }
};

const failValidation = (errors: readonly string[]) => new CliError(1, errors.map((error) => `invalid ${error}`).join('\n'));

const workflowStarts = (events: readonly StoredEvent[]) =>
  events.filter((event) => isWorkflowLevel(event) && event.type === 'started' && !isCleanup(event));

const isClosedRun = (events: readonly StoredEvent[], run: string) =>
  events.some((event) => isWorkflowLevel(event) && !isCleanup(event) && event.run === run && ['completed', 'failed'].includes(event.type));

const cleanupStarts = (events: readonly StoredEvent[]) =>
  events.filter((event) => isWorkflowLevel(event) && event.type === 'started' && isCleanup(event));

const isClosedCleanup = (events: readonly StoredEvent[], run: string) =>
  events.some((event) => isWorkflowLevel(event) && isCleanup(event) && event.run === run && ['completed', 'failed'].includes(event.type));

const latestRun = (starts: readonly StoredEvent[], isClosed: (run: string) => boolean) =>
  starts.findLast((event) => !isClosed(event.run)) ?? starts.at(-1);

const currentRun = (events: readonly StoredEvent[], workflow?: string): StoredEvent | undefined => {
  if (workflow === 'cleanup') {
    const cleanup = latestRun(cleanupStarts(events), (run) => isClosedCleanup(events, run));
    if (cleanup !== undefined) return cleanup;
  }

  const starts = workflowStarts(events).filter((event) => workflow === undefined || event.workflow === workflow);
  if (starts.length === 0 && workflow !== undefined) return currentRun(events);

  return latestRun(starts, (run) => isClosedRun(events, run));
};

const mintRun = (events: readonly StoredEvent[]) => {
  const used = new Set(events.map((event) => event.run));
  let run = randomBytes(2).toString('hex');
  while (used.has(run)) run = randomBytes(2).toString('hex');

  return run;
};

interface WorkState {
  readonly work: string;
  readonly title: string | null;
  readonly status: string;
  readonly phase: string | null;
  readonly phases: Record<string, string>;
  readonly workspace: Record<string, unknown> | null;
  readonly artifacts: Record<string, unknown>;
  readonly escalations: readonly { id: string; summary: string; status: string; ref: string | null }[];
  readonly tickets: { parent: unknown; tasks: Record<string, unknown> };
  readonly issues: { parent: unknown; children: Record<string, unknown> };
  readonly hub: number | null;
  readonly steps: Record<string, string>;
  readonly units: Record<string, string>;
  readonly choices: Record<string, unknown>;
  readonly unconfirmed: readonly string[];
  readonly pr: { url: unknown; round: unknown };
  readonly updated: string | null;
}

const workflowLevelStatus = { started: 'in_progress', completed: 'done', failed: 'failed' } as const;

const derivePhases = (events: readonly StoredEvent[]) => {
  const phases: Record<string, string> = {};
  for (const event of events) {
    if (!isWorkflowLevel(event) || isCleanup(event)) continue;
    if (event.type === 'started') phases[event.workflow] = workflowLevelStatus.started;
    if (event.type === 'completed') phases[event.workflow] = workflowLevelStatus.completed;
    if (event.type === 'failed') phases[event.workflow] = workflowLevelStatus.failed;
  }

  return phases;
};

const deriveSteps = (events: readonly StoredEvent[]) => {
  const passes = new Map<string, Record<string, string>>();
  for (const event of events) {
    if (!playbooks.includes(event.workflow) || isCleanup(event)) continue;

    const pass = passes.get(event.workflow) ?? {};
    passes.set(event.workflow, pass);
    if (isWorkflowLevel(event)) {
      if (event.type === 'completed') passes.set(event.workflow, {});
      continue;
    }
    if (event.type === 'started' || event.type === 'completed' || event.type === 'failed') {
      pass[event.step ?? ''] = workflowLevelStatus[event.type];
    }
  }

  return Object.assign({}, ...passes.values());
};

const isPrMerged = (event: StoredEvent) =>
  event.workflow === 'babysit-pr' && event.type === 'completed' && (event.step === 'merge' || isWorkflowLevel(event));

const deriveUnits = (events: readonly StoredEvent[]) => {
  const units: Record<string, string> = {};
  const awaitingMerge = new Set<string>();
  for (const event of events) {
    const choice = event.type === 'decision' ? event.data.choice : undefined;
    if (isRecord(choice) && typeof choice.key === 'string' && choice.key.startsWith('unit.') && choice.value === 'skip') {
      units[choice.key.slice('unit.'.length)] = 'skipped';
      continue;
    }
    // A merged PR passed CI, so its completed units are done even when no gate logged their checks.
    if (isPrMerged(event)) {
      for (const task of awaitingMerge) if (units[task] === 'in_progress') units[task] = 'done';
      awaitingMerge.clear();
    }
    if (event.task === undefined) continue;

    if (event.type === 'started' && event.step === 'implement') {
      units[event.task] = 'in_progress';
      awaitingMerge.delete(event.task);
    }
    if (event.type === 'completed' && event.step === 'implement') awaitingMerge.add(event.task);
    if (event.type === 'completed' && event.step === 'checks') units[event.task] = 'done';
    if (event.type === 'failed' && event.step === 'implement') {
      if (event.data.interrupted === true) delete units[event.task];
      else units[event.task] = 'failed';
    }
  }

  return units;
};

const deriveEscalations = (events: readonly StoredEvent[]) => {
  const byId = new Map<string, { id: string; summary: string; status: string; ref: string | null }>();
  for (const event of events) {
    if (event.type !== 'escalation' || typeof event.data.id !== 'string' || typeof event.data.status !== 'string') continue;

    byId.set(event.data.id, {
      id: event.data.id,
      summary: event.summary,
      status: event.data.status,
      ref: textOf(event.data.ref) ?? null,
    });
  }

  return [...byId.values()];
};

const openPlaybookRun = (events: readonly StoredEvent[]) =>
  workflowStarts(events).findLast((event) => playbooks.includes(event.workflow) && !isClosedRun(events, event.run));

const isStaleBlock = (events: readonly StoredEvent[], failedIndex: number) =>
  events.slice(failedIndex + 1).some((event) => isWorkflowLevel(event) && !isCleanup(event) && event.type === 'completed');

const deriveStatus = (events: readonly StoredEvent[], escalations: WorkState['escalations']) => {
  const archived = events.some((event) => isCleanup(event) && event.type === 'completed' && (isWorkflowLevel(event) || event.step === 'cleanup'));
  if (archived) return 'archived';
  if (escalations.some((escalation) => escalation.status === 'open')) return 'awaiting_decision';

  const latestFailedIndex = events.findLastIndex((event) => event.type === 'failed');
  if (events[latestFailedIndex]?.data.blocked === true && !isStaleBlock(events, latestFailedIndex)) return 'blocked';

  const latest = events.findLast((event) => isWorkflowLevel(event) && !isCleanup(event));
  if (latest?.type === 'failed') return 'failed';
  const finishes = latest?.workflow === 'babysit-pr' || playbooks.includes(latest?.workflow ?? '');
  if (latest?.type === 'completed' && finishes && openPlaybookRun(events) === undefined) return 'done';

  return 'in_progress';
};

const recordField = (source: Record<string, unknown>, key: string) => {
  const value = source[key];

  return isRecord(value) ? value : {};
};

const deriveUnconfirmed = (events: readonly StoredEvent[]) => {
  const unconfirmed = new Set<string>();
  for (const { type, data } of events) {
    if (type === 'decision' && data.unconfirmed === true && typeof data.id === 'string') unconfirmed.add(data.id);
    if (type !== 'gate') continue;
    if (typeof data.decision === 'string') unconfirmed.delete(data.decision);
    if (Array.isArray(data.decisions)) for (const id of data.decisions) unconfirmed.delete(String(id));
  }

  return [...unconfirmed];
};

const deriveState = (work: string, events: readonly StoredEvent[]) => {
  const phases = derivePhases(events);
  const escalations = deriveEscalations(events);
  const artifacts: Record<string, unknown> = {};
  const choices: Record<string, unknown> = {};
  const tickets: WorkState['tickets'] = { parent: null, tasks: {} };
  const issues: WorkState['issues'] = { parent: null, children: {} };
  const pr: WorkState['pr'] = { url: null, round: 0 };
  let title: string | null = null;
  let workspace: Record<string, unknown> | null = null;
  let hub: number | null = null;

  for (const event of events) {
    const { data } = event;
    title = textOf(data.title) ?? title;
    if (isRecord(data.workspace)) workspace = data.workspace;

    const choice = data.choice;
    const decided = isRecord(choice) ? choice : data.kind === 'choice' ? data : null;
    if (decided && typeof decided.key === 'string') {
      choices[decided.key] = decided.value;
      if (decided.key === 'hub' && typeof decided.value === 'number') hub = decided.value;
    }

    if (event.type !== 'artifact') continue;
    if (typeof data.name === 'string') artifacts[data.name] = data.path;
    if (typeof data.hub === 'number') hub = data.hub;

    const ticketData = recordField(data, 'tickets');
    tickets.parent = ticketData.parent ?? tickets.parent;
    Object.assign(tickets.tasks, recordField(ticketData, 'tasks'));
    const issueData = recordField(data, 'issues');
    issues.parent = issueData.parent ?? issues.parent;
    Object.assign(issues.children, recordField(issueData, 'children'));
    const prData = recordField(data, 'pr');
    pr.url = prData.url ?? pr.url;
    pr.round = prData.round ?? pr.round;
  }

  const latestStarted = events.findLast((event) => isWorkflowLevel(event) && event.type === 'started' && !isCleanup(event));

  const state: WorkState = {
    work,
    title,
    status: deriveStatus(events, escalations),
    phase: latestStarted?.workflow ?? null,
    phases,
    workspace,
    artifacts,
    escalations,
    tickets,
    issues,
    hub,
    steps: deriveSteps(events),
    units: deriveUnits(events),
    choices,
    unconfirmed: deriveUnconfirmed(events),
    pr,
    updated: events.at(-1)?.ts ?? null,
  };

  return state;
};

const writeState = async (item: WorkItem) => {
  const state = deriveState(item.name, await readEvents(item));
  await mkdir(item.dir, { recursive: true });
  await writeFile(join(item.dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);

  return state;
};

const warnInLinkedWorktree = (cwd: string) => {
  const toplevel = gitOutput(cwd, ['rev-parse', '--show-toplevel'])?.trim();
  if (toplevel === undefined || realPathOrSelf(toplevel) === realPathOrSelf(mainCheckout(cwd))) return;

  process.stderr.write('warning: linked worktree; log work-item files with `put <path>` (stdin), not by writing them here\n');
};

const guardedStarts = ['implement', 'review', 'babysit-pr'];

const warnOpenPlaybook = (item: WorkItem, events: readonly StoredEvent[], workflow: string | undefined) => {
  const playbook = openPlaybookRun(events);
  if (playbook === undefined || !guardedStarts.includes(workflow ?? '')) return;

  process.stderr.write(`warning: playbook run ${playbook.run} is open; continue with /agentic-${playbook.workflow} ${item.name}\n`);
};

const startCommand: Command = {
  name: 'start',
  usage: 'start <workflow> --harness claude|cursor|codex [--title <text>] [--work <slug>]',
  arguments: 1,
  flags: ['harness', 'title', 'summary'],
  required: ['harness'],
  async run(context) {
    const item = await resolveWorkItem(context, { allowCreate: true });
    const events = await readEvents(item);
    const [workflow] = context.positionals;
    const title = flagText(context, 'title');

    const result = validateEvent({
      ts: nowTimestamp(),
      work: item.name,
      run: mintRun(events),
      harness: flagText(context, 'harness'),
      workflow,
      type: 'started',
      summary: flagText(context, 'summary') ?? `${workflow} started`,
      data: { ...(title === undefined ? {} : { title }), cwd: realPathOrSelf(context.cwd) },
    });
    if (result.event === undefined) throw failValidation(result.errors);

    await appendEvent(item, result.event);
    await writeState(item);
    warnInLinkedWorktree(context.cwd);
    warnOpenPlaybook(item, events, workflow);
    writeOut(`run ${result.event.run}\n`);
  },
};

const putFiles = new Set(['spec.md', 'plan.md', 'context.md', 'implementation.md', 'pr.md']);
const putFolders = ['briefs/', 'reports/', 'reviews/', 'tickets/'];

const isPutAllowed = (path: string) => {
  const segments = path.split('/');
  if (isAbsolute(path) || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return false;

  return putFiles.has(path) || putFolders.some((folder) => path.startsWith(folder));
};

const reviewCounts = (report: string) => {
  const header = report.split('\n', 1)[0] ?? '';
  const count = (severity: string) => Number(new RegExp(`\\b${severity}s?\\s*[:=]?\\s*(\\d+)`).exec(header)?.[1] ?? Number.NaN);
  const counts = { blocker: count('blocker'), major: count('major'), minor: count('minor'), nit: count('nit') };

  return Object.values(counts).some(Number.isNaN) ? undefined : counts;
};

const putCommand: Command = {
  name: 'put',
  usage: 'put <relative path> [--work <slug>]   (content on stdin)',
  arguments: 1,
  flags: [],
  required: [],
  async run(context) {
    const [path] = context.positionals;
    if (path === undefined || !isPutAllowed(path)) {
      throw new CliError(1, `put: "${path}" is not an allowlisted work-item path (${[...putFiles, ...putFolders.map((folder) => `${folder}**`)].join(', ')})`, false);
    }

    const item = await resolveWorkItem(context, { allowCreate: false });
    const events = await readEvents(item);
    const run = currentRun(events);
    const content = await Bun.stdin.text();
    if (content === '') throw new CliError(2, 'put: no content on stdin');

    const base = {
      ts: nowTimestamp(),
      work: item.name,
      run: run?.run,
      harness: run?.harness,
      workflow: run?.workflow,
    };
    const artifact = validateEvent({ ...base, type: 'artifact', summary: `put ${path}`, data: { name: path.replace(/\.md$/, ''), path } });
    if (artifact.event === undefined) throw failValidation(artifact.errors);

    const target = join(item.dir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    await appendEvent(item, artifact.event);

    const review = /^reviews\/(\d+)-(.+)\.md$/.exec(path);
    const counts = reviewCounts(content);
    if (review !== null && review[2] !== 'fix' && counts !== undefined) {
      const completed = validateEvent({
        ...base,
        type: 'completed',
        step: `review.${review[2]}`,
        iteration: review[1],
        summary: `${review[2]} review ${review[1]} reported`,
        data: { counts },
      });
      if (completed.event === undefined) throw failValidation(completed.errors);
      await appendEvent(item, completed.event);
    }

    await writeState(item);
    writeOut(`put ${path}\n`);
  },
};

const gateRedLines = 8;

const gateTasks = (context: Context) => {
  const tasks = (flagText(context, 'task') ?? '').split(',').map((task) => task.trim()).filter(Boolean);
  const baseline = context.values.baseline === true;
  if (baseline === (tasks.length > 0)) throw new CliError(2, 'gate: pass exactly one of --task T1,T2 or --baseline');

  return baseline ? [undefined] : tasks;
};

const gateVerifyCommand = (checkout: string) => {
  const config = readJsonFile(join(checkout, '.agentic.json'));
  const verify = isRecord(config) ? textOf(config.verify) : undefined;
  if (verify === undefined || verify === '') throw new CliError(1, `gate: no "verify" command in ${join(checkout, '.agentic.json')}`, false);

  return verify;
};

const gateCheckout = (cwd: string) => {
  const checkout = gitOutput(cwd, ['rev-parse', '--show-toplevel'])?.trim();
  const sha = gitOutput(cwd, ['rev-parse', 'HEAD'])?.trim();
  if (checkout === undefined || sha === undefined) throw new CliError(1, 'gate: not inside a git checkout with a commit', false);
  if ((gitOutput(checkout, ['status', '--porcelain']) ?? '').trim() !== '') {
    throw new CliError(1, 'gate: dirty tree; commit or stash first so the log matches HEAD', false);
  }

  return { checkout, sha };
};

const hasGateLog = (event: StoredEvent) => typeof event.data.log === 'string' && existsSync(event.data.log);

const greenGateFor = (events: readonly StoredEvent[], sha: string) =>
  events.findLast((event) => event.step === 'checks' && event.type === 'completed' && event.data.sha === sha && hasGateLog(event));

const runVerify = async (verify: string, checkout: string, logPath: string) => {
  const result = spawnSync('sh', ['-c', `(${verify}\n) 2>&1`], { cwd: checkout, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  await mkdir(dirname(logPath), { recursive: true });
  await writeFile(logPath, result.stdout);

  return { passed: result.status === 0, exitCode: result.status, output: result.stdout };
};

const gateCommand: Command = {
  name: 'gate',
  usage: 'gate --task <T1,T2> | --baseline [--work <slug>]   (runs .agentic.json verify at HEAD; blocks, background it)',
  arguments: 0,
  flags: ['task'],
  switches: ['baseline'],
  required: [],
  async run(context) {
    const tasks = gateTasks(context);
    const item = await resolveWorkItem(context, { allowCreate: false });
    const { checkout, sha } = gateCheckout(context.cwd);
    const verify = gateVerifyCommand(checkout);
    const events = await readEvents(item);
    const logPath = join(item.dir, 'gates', `${sha}.log`);

    const reusedGate = greenGateFor(events, sha);
    const outcome = reusedGate === undefined ? await runVerify(verify, checkout, logPath) : { passed: true, exitCode: 0, output: '' };

    const run = currentRun(events);
    for (const task of tasks) {
      const result = validateEvent({
        ts: nowTimestamp(),
        work: item.name,
        run: run?.run,
        harness: run?.harness,
        workflow: 'implement',
        step: 'checks',
        type: outcome.passed ? 'completed' : 'failed',
        task,
        summary: `verify ${outcome.passed ? 'green' : 'red'} at ${sha.slice(0, 7)}${task === undefined ? ' (baseline)' : ` for ${task}`}`,
        data: {
          sha,
          log: reusedGate === undefined ? logPath : reusedGate.data.log,
          ...(reusedGate === undefined ? {} : { reused: reusedGate.ts }),
          ...(task === undefined ? { baseline: true } : {}),
          ...(outcome.passed ? {} : { reason: `verify exited ${outcome.exitCode}` }),
        },
      });
      if (result.event === undefined) throw failValidation(result.errors);
      await appendEvent(item, result.event);
    }
    await writeState(item);

    if (!outcome.passed) {
      const tail = outcome.output.trimEnd().split('\n').slice(-gateRedLines);
      writeOut(`${[`gate red: verify exited ${outcome.exitCode}`, ...tail, `log: ${logPath}`].join('\n')}\n`);
      throw new CliError(1, 'gate red', false);
    }
    writeOut(`gate green at ${sha.slice(0, 7)}\n`);
  },
};

const reviewLifecycle = ['started', 'completed', 'failed'];

const isReviewLifecycle = (event: StoredEvent) =>
  reviewLifecycle.includes(event.type) && ((event.step === null && event.workflow === 'review') || event.step === 'review');

const lastIterationBlocking = (events: readonly StoredEvent[], run: string) => {
  const reports = events.filter((event) => event.run === run && event.step?.startsWith('review.') && isRecord(event.data.counts));
  const lastIteration = Math.max(0, ...reports.map((event) => event.iteration ?? 0));

  return reports
    .filter((event) => (event.iteration ?? 0) === lastIteration)
    .reduce((total, event) => {
      const counts = recordField(event.data, 'counts');
      return total + Number(counts.blocker ?? 0) + Number(counts.major ?? 0);
    }, 0);
};

const latestCompletedReview = (events: readonly StoredEvent[]) => {
  const latest = events.filter((event) => event.data?.recordedAt === undefined).findLast(isReviewLifecycle);

  return latest !== undefined && latest.type === 'completed' && lastIterationBlocking(events, latest.run) === 0 ? latest : undefined;
};

interface ReviewVerdict {
  readonly clean: boolean;
  readonly reason: string;
}

const reviewVerdict = (events: readonly StoredEvent[], head: string, cwd: string, base: string | undefined): ReviewVerdict => {
  const notClean = { clean: false, reason: `review not clean for head ${head}` };
  const review = latestCompletedReview(events);
  if (review === undefined) return notClean;
  if (review.data.head === head) return { clean: true, reason: '' };

  const reviewedPatch = textOf(review.data.patchId);
  if (reviewedPatch === undefined) return notClean;
  if (gitOutput(cwd, ['rev-parse', 'HEAD'])?.trim() !== head) return { clean: false, reason: 'checkout not at PR head' };

  return patchIdSince(cwd, base) === reviewedPatch ? { clean: true, reason: '' } : notClean;
};

interface PrCheck {
  readonly name: string;
  readonly green: boolean;
  readonly workflowName: string;
  readonly detailsUrl: string;
}

const greenConclusions = ['SUCCESS', 'NEUTRAL', 'SKIPPED'];

const toPrCheck = (check: unknown): PrCheck => {
  const entry = isRecord(check) ? check : {};
  const outcome = textOf(entry.conclusion) || textOf(entry.state) || '';

  return {
    name: textOf(entry.name) ?? textOf(entry.context) ?? 'check',
    green: greenConclusions.includes(outcome),
    workflowName: textOf(entry.workflowName) ?? '',
    detailsUrl: textOf(entry.detailsUrl) ?? '',
  };
};

const ciMarkerHolds = (cwd: string, head: string) => {
  const commonDir = gitOutput(cwd, ['rev-parse', '--git-common-dir'])?.trim();
  if (commonDir === undefined) return false;

  const marker = join(resolve(cwd, commonDir), 'agentic', 'ci-pass', head);

  return existsSync(marker) && readFileSync(marker, 'utf8').trim() === head;
};

const ghJson = async (gh: Gh, args: readonly string[]): Promise<Record<string, unknown>> => {
  const parsed: unknown = JSON.parse(await gh.call(args));

  return isRecord(parsed) ? parsed : {};
};

interface ActionsRun {
  readonly id: string;
  readonly name: string;
}

const actionsOnHead = async (gh: Gh, head: string) => {
  const runs = (await ghJson(gh, ['api', `repos/{owner}/{repo}/actions/runs?head_sha=${head}`])).workflow_runs;
  const unstarted: ActionsRun[] = [];

  for (const run of Array.isArray(runs) ? runs : []) {
    const entry = isRecord(run) ? run : {};
    const id = String(entry.id);
    const jobs = (await ghJson(gh, ['api', `repos/{owner}/{repo}/actions/runs/${id}/jobs`])).jobs;
    const started = (Array.isArray(jobs) ? jobs : []).some((job) => isRecord(job) && Array.isArray(job.steps) && job.steps.length > 0);
    if (started) return { started: true, unstarted: [] };
    unstarted.push({ id, name: textOf(entry.name) ?? '' });
  }

  return { started: false, unstarted };
};

const belongsToRun = (check: PrCheck, run: ActionsRun) =>
  (check.workflowName !== '' && check.workflowName === run.name) || check.detailsUrl.includes(`/actions/runs/${run.id}`);

const notGreenNames = (checks: readonly PrCheck[]) => checks.filter((check) => !check.green).map((check) => check.name);

const ciProof = (actions: { readonly started: boolean; readonly unstarted: readonly ActionsRun[] }, checks: readonly PrCheck[], cwd: string, head: string) => {
  if (actions.started) {
    const notGreen = notGreenNames(checks);

    return notGreen.length === 0 ? 'github-checks' : `checks not green: ${notGreen.join(', ')}`;
  }
  if (!ciMarkerHolds(cwd, head)) return `no CI proof for head ${head}`;

  const notGreen = notGreenNames(checks.filter((check) => !actions.unstarted.some((run) => belongsToRun(check, run))));

  return notGreen.length === 0 ? 'local-ci' : `checks not green: ${notGreen.join(', ')}`;
};

const mergeRefusal = (review: ReviewVerdict, view: Record<string, unknown>) => {
  if (!review.clean) return review.reason;
  if (view.mergeable === 'CONFLICTING') return 'conflict';
  if (view.mergeable !== 'MERGEABLE') return `not mergeable: ${textOf(view.mergeable) ?? 'unknown'}`;

  return undefined;
};

const mergeCommand: Command = {
  name: 'merge',
  usage: 'merge [--work <slug>]   (squash-merges the PR when review is clean, no conflict, CI proof for head; else exit 1)',
  arguments: 0,
  flags: [],
  required: [],
  async run(context) {
    const item = await resolveWorkItem(context, { allowCreate: false });
    const events = await readEvents(item);
    const state = deriveState(item.name, events);
    const prNumber = /\/pull\/(\d+)/.exec(textOf(state.pr.url) ?? '')?.[1];
    if (prNumber === undefined) throw new CliError(1, 'merge: no pr url in state', false);

    const gh = createGh(context.env);
    const parsed: unknown = JSON.parse(await gh.call(['pr', 'view', prNumber, '--json', 'mergeable,headRefOid,statusCheckRollup']));
    const view = isRecord(parsed) ? parsed : {};
    const head = textOf(view.headRefOid) ?? '';

    const review = reviewVerdict(events, head, context.cwd, textOf(state.workspace?.base));
    const refusal = mergeRefusal(review, view);
    if (refusal !== undefined) throw new CliError(1, `merge: ${refusal}`, false);

    const checks = (Array.isArray(view.statusCheckRollup) ? view.statusCheckRollup : []).map(toPrCheck);
    const proof = ciProof(await actionsOnHead(gh, head), checks, context.cwd, head);
    if (proof !== 'github-checks' && proof !== 'local-ci') throw new CliError(1, `merge: ${proof}`, false);

    await gh.call(['pr', 'merge', prNumber, '--squash', '--match-head-commit', head]);

    const run = currentRun(events) ?? events.findLast(isReviewLifecycle);
    const result = validateEvent({
      ts: nowTimestamp(),
      work: item.name,
      run: run?.run,
      harness: run?.harness,
      workflow: 'babysit-pr',
      step: 'merge',
      type: 'completed',
      summary: `merged PR ${prNumber} at ${head.slice(0, 7)} (${proof})`,
      data: { pr: Number(prNumber), head, proof },
    });
    if (result.event === undefined) throw failValidation(result.errors);
    await appendEvent(item, result.event);
    await writeState(item);
    writeOut(`merged PR ${prNumber} at ${head.slice(0, 7)} (${proof})\n`);
  },
};

const eventCommand: Command = {
  name: 'event',
  usage:
    'event --type <type> --summary <text> [--step k] [--task t] [--iteration n] [--agent a] [--model m] [--effort e] [--ref r] [--data <json>] [--run hex] [--harness h] [--workflow w] [--ts iso] [--work <slug>]',
  arguments: 0,
  flags: ['type', 'step', 'task', 'iteration', 'agent', 'model', 'effort', 'summary', 'ref', 'data', 'run', 'harness', 'workflow', 'ts'],
  required: ['type'],
  async run(context) {
    const item = await resolveWorkItem(context, { allowCreate: false });
    const events = await readEvents(item);
    const run = currentRun(events, flagText(context, 'workflow'));
    const mintsRun = flagText(context, 'type') === 'started' && flagText(context, 'step') === undefined;
    const dataFlag = parseDataFlag(flagText(context, 'data'));
    const step = flagText(context, 'step');
    const backdated = flagText(context, 'ts') !== undefined;
    const completesReview =
      flagText(context, 'type') === 'completed' && (step === 'review' || (step === undefined && (flagText(context, 'workflow') ?? run?.workflow) === 'review'));
    const closesReview = completesReview && !backdated;
    const reviewedHead = closesReview ? gitOutput(context.cwd, ['rev-parse', 'HEAD'])?.trim() : undefined;
    const reviewedPatch = closesReview ? patchIdSince(context.cwd, textOf(deriveState(item.name, events).workspace?.base)) : undefined;
    if (closesReview && reviewedPatch === undefined) {
      await appendEvent(item, {
        ts: nowTimestamp(),
        work: item.name,
        run: run?.run ?? null,
        harness: run?.harness ?? 'claude',
        workflow: run?.workflow ?? 'review',
        step,
        type: 'note',
        summary: 'review closed without patch-id (not computable): a rebase will need a re-review',
        data: {},
      });
    }
    const { head: _head, patchId: _patchId, ...dataWithoutHead } = dataFlag.data ?? {};
    const stamped = { ...dataFlag.data, head: reviewedHead, ...(reviewedPatch === undefined ? {} : { patchId: reviewedPatch }) };
    const data = reviewedHead !== undefined ? stamped : completesReview && backdated ? { ...dataWithoutHead, recordedAt: nowTimestamp() } : dataFlag.data;

    const result = validateEvent(
      {
        ts: flagText(context, 'ts') ?? nowTimestamp(),
        work: item.name,
        run: flagText(context, 'run') ?? (mintsRun ? mintRun(events) : run?.run),
        harness: flagText(context, 'harness') ?? (run ?? currentRun(events))?.harness,
        workflow: flagText(context, 'workflow') ?? run?.workflow,
        step: flagText(context, 'step'),
        type: flagText(context, 'type'),
        task: flagText(context, 'task'),
        iteration: flagText(context, 'iteration'),
        agent: flagText(context, 'agent'),
        model: flagText(context, 'model'),
        effort: flagText(context, 'effort'),
        summary: flagText(context, 'summary'),
        ref: flagText(context, 'ref'),
        data: mintsRun ? { cwd: realPathOrSelf(context.cwd), ...data } : data,
      },
      dataFlag.errors,
    );
    if (result.event === undefined) throw failValidation(result.errors);

    const line = await appendEvent(item, result.event);
    await writeState(item);
    writeOut(`${line}\n`);
  },
};

const stateCommand: Command = {
  name: 'state',
  usage: 'state [--work <slug>]',
  arguments: 0,
  flags: [],
  required: [],
  async run(context) {
    const item = await resolveWorkItem(context, { allowCreate: false });
    const state = await writeState(item);
    writeOut(`${JSON.stringify(state, null, 2)}\n`);
  },
};

const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /\b(?:sk|pk)-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:password|passwd|token|secret|api[_-]?key)\s*[=:]\s*\S+/gi,
  /[A-Za-z0-9+_=]{32,}/g,
];

const redact = (text: string) => secretPatterns.reduce((result, pattern) => result.replace(pattern, '[redacted]'), text);

const maxLineLength = 160;

const resumeLine = (text: string) => {
  const line = redact(text.replace(/(\S)\s+/g, '$1 ').trimEnd());

  return line.length > maxLineLength ? `${line.slice(0, maxLineLength - 1)}…` : line;
};

const planUnitIds = (item: WorkItem) => {
  const path = join(item.dir, 'plan.md');
  if (!existsSync(path)) return [];

  return [...readFileSync(path, 'utf8').matchAll(/^### (T\d+)\b/gm)].map((match) => match[1] ?? '');
};

const pendingUnits = (item: WorkItem, state: WorkState) => {
  const ids = [...new Set([...planUnitIds(item), ...Object.keys(state.tickets.tasks)])];

  return ids.filter((id) => state.units[id] !== 'done' && state.units[id] !== 'skipped');
};

const openSteps = (events: readonly StoredEvent[]) => {
  const open = new Map<string, StoredEvent>();
  for (const event of events) {
    if (event.step === null) continue;

    const key = `${event.workflow}|${event.step}|${event.task ?? ''}`;
    if (event.type === 'started') open.set(key, event);
    if (event.type === 'completed' || event.type === 'failed') open.delete(key);
  }

  return [...open.values()];
};

const openStep = (events: readonly StoredEvent[]) => openSteps(events).at(-1);

const hasOpenGrill = (events: readonly StoredEvent[]) => openSteps(events).some(({ step }) => step?.startsWith('grill'));

const describeStep = (event: StoredEvent | undefined) => {
  if (event === undefined) return 'none';

  const unit = [event.task, event.agent === undefined ? undefined : `(${event.agent})`].filter(Boolean).join(' ');

  return [event.step, unit, `started: ${event.summary}`].filter(Boolean).join(' ');
};

const nextTicket = (state: WorkState) => {
  const next = Object.entries(state.tickets.tasks).find(([task]) => state.units[task] !== 'done' && state.units[task] !== 'skipped');

  return next === undefined ? '' : `, next ticket ${String(next[1])} (${next[0]})`;
};

const nextCommand = (item: WorkItem, state: WorkState, pending: readonly string[], playbook: StoredEvent | undefined) => {
  const skill = (name: string) => `/agentic-${name} ${item.name}`;
  const resumeSkill = skill(state.phase === null || state.phase === 'implement' ? 'implement' : state.phase);
  const openEscalation = state.escalations.find((escalation) => escalation.status === 'open');

  if (state.status === 'archived') return 'none (archived)';
  if (openEscalation !== undefined) {
    const ref = openEscalation.ref === null ? '' : ` (ref ${openEscalation.ref})`;

    return `resolve escalation ${openEscalation.id}${ref}, then ${resumeSkill}`;
  }
  if (state.status === 'done') return skill('cleanup');
  if (state.status === 'failed' || state.status === 'blocked') return `fix the cause, then ${resumeSkill}`;
  if (playbook !== undefined) return `${skill(playbook.workflow)}${nextTicket(state)}`;
  if (pending.length > 0) return skill('implement');
  if (Object.keys(state.units).length > 0 && state.phases.review === undefined) return skill('review');

  return resumeSkill;
};

const unitWorktree = (event: StoredEvent) => {
  const { worktree } = event.data;
  const path = isRecord(worktree) ? textOf(worktree.path) : undefined;
  const branch = isRecord(worktree) ? textOf(worktree.branch) : undefined;

  return path === undefined || branch === undefined ? undefined : { path, branch };
};

const branchExists = (cwd: string, branch: string) => gitOutput(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) !== undefined;

const mergeBackBlocks = (events: readonly StoredEvent[], cwd: string) => {
  const run = currentRun(events)?.run;
  const inRun = events.filter((event) => event.run === run);
  const pending = inRun.flatMap((event, index) => {
    const worktree = event.type === 'started' ? unitWorktree(event) : undefined;
    const merged = inRun
      .slice(index + 1)
      .some((later) => later.step === 'checks' && later.type === 'completed' && later.task === event.task);

    return worktree === undefined || merged || !branchExists(cwd, worktree.branch) ? [] : [worktree];
  });
  if (pending.length === 0) return ['merge-back: none'];

  return [
    'merge-back:',
    ...pending.flatMap(({ path, branch }) => [`  git merge --no-ff ${branch}`, `  git worktree remove ${path}`, `  git branch -d ${branch}`]),
  ];
};

const resumeText = (item: WorkItem, events: readonly StoredEvent[], cwd: string) => {
  const state = deriveState(item.name, events);
  const pending = pendingUnits(item, state);
  const open = state.escalations.filter((escalation) => escalation.status === 'open');
  const escalations = open.length === 0 ? 'none' : `${open.length} open: ${open.map(({ id, summary }) => `${id} ${summary}`).join('; ')}`;

  const lines = [
    `work: ${item.name}`,
    `status: ${state.status}`,
    `phase: ${state.phase ?? 'none'}`,
    `step: ${describeStep(openStep(events))}`,
    `escalations: ${escalations}`,
    `pending: ${pending.join(', ') || 'none'}`,
    ...events.slice(-3).map((event) => `event: ${event.ts} ${event.type} ${[event.step, event.task].filter(Boolean).join('/')} ${event.summary}`),
    ...mergeBackBlocks(events, cwd),
    `next: ${nextCommand(item, state, pending, openPlaybookRun(events))}`,
  ];

  return lines.map(resumeLine).join('\n');
};

const cardText = (item: WorkItem, events: readonly StoredEvent[]) => {
  const state = deriveState(item.name, events);
  const next = nextCommand(item, state, pendingUnits(item, state), openPlaybookRun(events));

  return [
    `call: ${next}`,
    'log only through the helper (`step` before every spawn, `gate` for checks, `put` for files)',
    'pass model and effort exactly as printed',
    'survey note (hub set) and baseline gate before implement',
    `unconfirmed: ${state.unconfirmed.join(', ') || 'none'}`,
  ].join('\n');
};

const resumeCommand: Command = {
  name: 'resume',
  usage: 'resume [--work <slug>]',
  arguments: 0,
  flags: [],
  required: [],
  async run(context) {
    const item = await resolveWorkItem(context, { allowCreate: false });
    writeOut(`${resumeText(item, await readEvents(item), context.cwd)}\n`);
  },
};

const decisionTags = ['structural', 'minor'];
const decisionFocuses = ['product', 'functional', 'tech'];
const maxSummaryQuestion = 80;

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

const decisionIds = (markdown: string) => [...markdown.matchAll(/^## D(\d+)\b/gm)].map((match) => Number(match[1]));

const decideCommand: Command = {
  name: 'decide',
  usage:
    'decide --tag structural|minor --focus product|functional|tech --q <question> --a <answer> --why <why> [--origin <text>] [--supersedes Dn] [--step k] [--work <slug>]',
  arguments: 0,
  flags: ['tag', 'focus', 'q', 'a', 'why', 'origin', 'supersedes', 'step'],
  required: [],
  async run(context) {
    const item = await resolveWorkItem(context, { allowCreate: false });
    const events = await readEvents(item);
    const run = currentRun(events);
    const decisionsPath = join(item.dir, 'decisions.md');
    const existing = existsSync(decisionsPath) ? await readFile(decisionsPath, 'utf8') : undefined;
    const ids = decisionIds(existing ?? '');
    const id = `D${Math.max(0, ...ids) + 1}`;

    const errors: string[] = [];
    const required = (name: string, valid: (value: string) => boolean, expected: string) => {
      const value = flagText(context, name);
      if (value === undefined) errors.push(`${name}: required`);
      else if (!valid(value)) errors.push(`${name}: expected ${expected}, got "${value}"`);

      return value === undefined ? '' : oneLine(value);
    };
    const tag = required('tag', isEnum(decisionTags), decisionTags.join('|'));
    const focus = required('focus', isEnum(decisionFocuses), decisionFocuses.join('|'));
    const question = required('q', isNonEmpty, 'a question');
    const answer = required('a', isNonEmpty, 'an answer');
    const why = required('why', isNonEmpty, 'a reason');

    const origin = flagText(context, 'origin');
    const supersedes = flagText(context, 'supersedes');
    if (supersedes !== undefined && !ids.includes(Number(/^D([1-9]\d*)$/.exec(supersedes)?.[1]))) {
      errors.push(`supersedes: expected an existing decision id like D3, got "${supersedes}"`);
    }

    const openGrill = openStep(events);
    const step = flagText(context, 'step') ?? (openGrill?.workflow.startsWith('grill-') ? openGrill.step ?? undefined : undefined);
    const result = validateEvent(
      {
        ts: nowTimestamp(),
        work: item.name,
        run: run?.run,
        harness: run?.harness,
        workflow: run?.workflow,
        step,
        type: 'decision',
        summary: `${id}: ${question.slice(0, maxSummaryQuestion)}`,
        data: {
          id,
          question,
          answer,
          tag,
          focus,
          ...optionalField('supersedes', supersedes),
          ...(tag === 'structural' && !step?.startsWith('grill') && !hasOpenGrill(events) ? { unconfirmed: true } : {}),
        },
      },
      errors,
    );
    if (result.event === undefined) throw failValidation(result.errors);

    const entry = [
      `## ${id} · ${tag} · ${focus}`,
      `**Q:** ${question}`,
      `**A:** ${answer}${origin === undefined ? '' : ` (origin: ${oneLine(origin)})`}`,
      `**Why:** ${why}`,
      ...(supersedes === undefined ? [] : [`**Supersedes:** ${supersedes}`]),
    ].join('\n');
    const separator = existing === undefined ? '# Decisions\n\n' : existing.endsWith('\n') ? '\n' : '\n\n';

    await mkdir(item.dir, { recursive: true });
    await appendFile(decisionsPath, `${separator}${entry}\n`);
    await appendEvent(item, result.event);
    await writeState(item);
    writeOut(`${id}\n`);
  },
};

const stepKeyShape = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/;
const readOnlySteps = ['explore', 'context', 'review', 'audit'];
const oneMillionModel = /\[1m\]|-1m\b/i;

type Tier = 'frontier' | 'code' | 'fast';

interface Builtin {
  readonly tier: Tier;
  readonly effort: string;
  readonly routing?: 'explore' | 'chore';
}

const codeMedium: Builtin = { tier: 'code', effort: 'medium' };
const codeHigh: Builtin = { tier: 'code', effort: 'high' };
const frontierHigh: Builtin = { tier: 'frontier', effort: 'high' };

const exampleProjectReviewerSteps: Readonly<Record<string, Builtin>> = {
  'review.review-access-tenant-isolation': frontierHigh,
};

const builtinSteps: Readonly<Record<string, Builtin>> = {
  implement: codeMedium,
  explore: { ...codeMedium, routing: 'explore' },
  tickets: codeMedium,
  write: codeMedium,
  plan: frontierHigh,
  review: codeMedium,
  'review.code-review': frontierHigh,
  'review.claude-security-review': frontierHigh,
  'review.pr-security-review': frontierHigh,
  'review.super-review': frontierHigh,
  'review.agentic-review-secrets': frontierHigh,
  'review.agentic-review-access-control': frontierHigh,
  ...exampleProjectReviewerSteps,
  audit: frontierHigh,
  grill: frontierHigh,
  unit: frontierHigh,
  'unit.sidequest': codeHigh,
  chore: { tier: 'fast', effort: 'low', routing: 'chore' },
};

const claudeModels: Readonly<Record<Tier, string>> = { frontier: 'opus', code: 'sonnet', fast: 'haiku' };
const routingModels: Readonly<Record<string, Readonly<Record<'explore' | 'chore', string>>>> = {
  cursor: { explore: 'grok-4.7-medium', chore: 'gpt-5.6-luna' },
  codex: { explore: 'gpt-6.1-sol', chore: 'gpt-6-luna' },
};

const parentKey = (key: string) => {
  const [first = key] = key.split('.');

  return first === 'context' ? 'explore' : first;
};

const builtinFor = (key: string) =>
  builtinSteps[key] ?? (key.startsWith('context.') ? builtinSteps.explore : builtinSteps[parentKey(key)]);

const builtinModel = (harness: string, builtin: Builtin) => {
  if (harness === 'claude') return claudeModels[builtin.tier];

  return (builtin.routing && routingModels[harness]?.[builtin.routing]) || builtin.tier;
};

interface StepConfig {
  readonly steps: Record<string, Record<string, Record<string, unknown>>>;
  readonly profiles: readonly Record<string, unknown>[];
  readonly selectedProfiles: readonly string[];
}

const objectsOf = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);
const stringsOf = (value: unknown) => (Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : []);

const mergedSteps = (user: Record<string, unknown>, project: Record<string, unknown>) => {
  const merged: StepConfig['steps'] = {};
  for (const source of [user, project]) {
    for (const [harness, keys] of Object.entries(recordField(source, 'steps'))) {
      for (const [key, tier] of Object.entries(isRecord(keys) ? keys : {})) {
        merged[harness] = { ...merged[harness], [key]: { ...merged[harness]?.[key], ...(isRecord(tier) ? tier : {}) } };
      }
    }
  }

  return merged;
};

const loadStepConfig = (context: Context, root: string): StepConfig => {
  const home = context.env.HOME;
  const userFile = home === undefined ? undefined : readJsonFile(join(home, '.agentic', 'config.json'));
  const user = isRecord(userFile) ? userFile : {};
  const projectFile = readJsonFile(join(root, '.agentic.json'));
  const project = isRecord(projectFile) ? projectFile : {};

  return {
    steps: mergedSteps(user, project),
    profiles: objectsOf(project.profiles ?? user.profiles),
    selectedProfiles: stringsOf(project.selectedProfiles ?? user.selectedProfiles),
  };
};

const builtinProfiles = [
  { name: 'typescript', detect: ['tsconfig.json'], skills: ['agentic-typescript-engineer', 'agentic-code-testing'] },
  {
    name: 'python',
    detect: ['pyproject.toml', 'setup.py', 'requirements.txt'],
    skills: ['agentic-python-engineer', 'agentic-code-testing'],
  },
];

const profileSkills = (config: StepConfig, root: string) => {
  const byName = new Map<string, Record<string, unknown>>();
  for (const profile of [...builtinProfiles, ...config.profiles]) byName.set(textOf(profile.name) ?? '', profile);

  const profiles = [...byName.values()];
  const selected =
    config.selectedProfiles.length > 0
      ? profiles.filter((profile) => config.selectedProfiles.includes(textOf(profile.name) ?? ''))
      : profiles.filter((profile) => stringsOf(profile.detect).some((file) => existsSync(join(root, file))));

  return selected.flatMap((profile) => stringsOf(profile.skills));
};

const resolveTier = (config: StepConfig, harness: string, key: string) => {
  const own = config.steps[harness]?.[key];
  const parent = config.steps[harness]?.[parentKey(key)];
  const builtin = builtinFor(key);
  if (!own && !parent && !builtin) {
    const validKeys = [...new Set([...Object.keys(builtinSteps), ...Object.keys(config.steps[harness] ?? {})])].sort();
    throw new CliError(1, `unknown step key "${key}": valid keys ${validKeys.join(', ')}`);
  }
  const model = textOf(own?.model) ?? textOf(parent?.model) ?? (builtin && builtinModel(harness, builtin)) ?? 'default';
  const effort = textOf(own?.effort) ?? textOf(parent?.effort) ?? builtin?.effort ?? 'default';
  if (oneMillionModel.test(model)) throw new CliError(1, `model "${model}": 1M is an orchestrator session setting, not a step model`);

  return { model, effort };
};

const claudeAlias = (harness: string, model: string) =>
  harness === 'claude' ? (/^claude-(opus|sonnet|haiku)-/.exec(model)?.[1] ?? model) : model;

const spawnHint = (harness: string, model: string, effort: string) => {
  if (harness === 'cursor') return `Task model=${model}[effort=${effort}]`;
  if (harness === 'codex') return `spawn subagent model=${model} reasoning_effort=${effort}`;

  return `Agent model=${model} effort=${effort}`;
};

const briefTemplate = () => {
  const text = readFileSync(join(import.meta.dir, '..', 'references', 'brief-template.md'), 'utf8');
  const block = /^```\n([\s\S]*?)^```$/m.exec(text)?.[1];
  if (block === undefined) throw new CliError(1, 'references/brief-template.md: no fenced block');

  return block;
};

const fillBrief = (template: string, values: Readonly<Record<string, string>>, readOnly: boolean) => {
  const body = readOnly ? template.replace(/^Progress:[\s\S]*?(?=^events\.jsonl:)/m, 'Progress: read-only\n') : template;

  return body.replace(/(?<!\{)\{([a-z]+)\}(?!\})/g, (placeholder, name: string) => values[name] ?? placeholder);
};

const defaultWorktrees = '../{repo}-worktrees';

const unitWorktreeFor = (context: Context, root: string, itemName: string, unit: string, workspace: { path?: string; branch?: string }) => {
  if (workspace.path === undefined || workspace.branch === undefined) {
    throw new CliError(1, '--unit needs state.json workspace path and branch');
  }

  const home = context.env.HOME;
  const userFile = home === undefined ? undefined : readJsonFile(join(home, '.agentic', 'config.json'));
  const projectFile = readJsonFile(join(root, '.agentic.json'));
  const configured = [projectFile, userFile].map((file) => (isRecord(file) ? textOf(file.worktrees) : undefined)).find(Boolean);
  const base = resolve(root, (configured ?? defaultWorktrees).replaceAll('{repo}', basename(root)));
  const branch = `${workspace.branch}--${unit}`;
  const path = join(base, `${itemName}-${unit}`);

  return { path, branch, command: `git worktree add -b ${branch} ${path} ${workspace.branch}` };
};

const hasInOpenRun = (events: readonly StoredEvent[], matches: (event: StoredEvent) => boolean) => {
  const openRuns = new Set(workflowStarts(events).filter((start) => !isClosedRun(events, start.run)).map((start) => start.run));
  const sinceLastMerge = events.slice(events.findLastIndex(isPrMerged) + 1);

  return sinceLastMerge.some((event) => matches(event) && openRuns.has(event.run));
};

const requireImplementPreconditions = (item: WorkItem, events: readonly StoredEvent[], unit: string | undefined) => {
  if (unit?.startsWith('fix-')) return;
  const { hub } = deriveState(item.name, events);
  if (hub !== null && !hasInOpenRun(events, (event) => event.step === 'survey' && event.type === 'note')) {
    throw new CliError(1, "step implement: no survey logged in this run; run the project's survey of open work, then `event --type note --step survey`");
  }
  const greenBaseline = (event: StoredEvent) =>
    event.step === 'checks' && event.type === 'completed' && event.data.baseline === true && hasGateLog(event);
  if (!hasInOpenRun(events, greenBaseline)) {
    throw new CliError(1, 'step implement: no green baseline in this run; run `gate --baseline` first');
  }
};

const stepCommand: Command = {
  name: 'step',
  usage: 'step <key> [--task t] [--unit id] [--agent label] [--skills a,b] [--harness claude|cursor|codex] [--work <slug>]',
  arguments: 1,
  flags: ['task', 'unit', 'agent', 'skills', 'harness'],
  required: [],
  async run(context) {
    const [key = ''] = context.positionals;
    if (!stepKeyShape.test(key)) throw new CliError(1, `invalid step key "${key}": expected ${stepKeyShape.source}`);

    const item = await resolveWorkItem(context, { allowCreate: false });
    const events = await readEvents(item);
    const run = currentRun(events);
    const harness = flagText(context, 'harness') ?? run?.harness ?? 'claude';
    if (!harnesses.includes(harness)) throw new CliError(1, `invalid harness "${harness}": expected ${harnesses.join('|')}`);

    const root = mainCheckout(context.cwd);
    const config = loadStepConfig(context, root);
    const { model, effort } = resolveTier(config, harness, key);
    const spawnModel = claudeAlias(harness, model);
    const unit = flagText(context, 'unit');
    if (key === 'implement') requireImplementPreconditions(item, events, unit);
    const task = flagText(context, 'task') ?? unit;
    const agent = flagText(context, 'agent') ?? (key === 'implement' ? `impl-${task ?? key}` : `${key}-1`);
    const extraSkills = (flagText(context, 'skills') ?? '').split(',').map((skill) => skill.trim()).filter(Boolean);
    const skills = [...new Set([...profileSkills(config, root), ...extraSkills])];
    const state = readJsonFile(join(item.dir, 'state.json'));
    const recorded = isRecord(state) && isRecord(state.workspace) ? state.workspace : {};
    const workspace = textOf(recorded.path);
    const unitTree =
      unit === undefined ? undefined : unitWorktreeFor(context, root, item.name, unit, { path: workspace, branch: textOf(recorded.branch) });

    const result = validateEvent({
      ts: nowTimestamp(),
      work: item.name,
      run: run?.run,
      harness,
      workflow: run?.workflow,
      step: key,
      type: 'started',
      task,
      agent,
      model,
      effort,
      summary: `step ${key} brief for ${agent}`,
      data: { skills, ...(unitTree && { worktree: { path: unitTree.path, branch: unitTree.branch } }) },
    });
    if (result.event === undefined) throw failValidation(result.errors);

    const brief = fillBrief(
      briefTemplate(),
      {
        key,
        step: key,
        item: item.dir,
        work: item.name,
        run: result.event.run,
        harness,
        workflow: result.event.workflow,
        task: task ?? '',
        agent,
        model: spawnModel,
        effort,
        skills: skills.join(', '),
        workspace: unitTree?.path ?? workspace ?? gitOutput(context.cwd, ['rev-parse', '--show-toplevel'])?.trim() ?? context.cwd,
      },
      readOnlySteps.includes(key.split('.')[0] ?? ''),
    );

    await appendEvent(item, result.event);
    await writeState(item);
    const worktreeLine = unitTree ? `worktree: ${unitTree.command}\n` : '';
    writeOut(`${brief}${worktreeLine}next: ${spawnHint(harness, spawnModel, effort)}\n`);
  },
};

type GateKind = 'alwaysOn' | 'conditional' | 'onDemand';

interface GateEntry {
  readonly name: string;
  readonly kind: GateKind;
  readonly changed: readonly string[];
  readonly added: readonly string[];
}

interface Gates {
  readonly entries: readonly GateEntry[];
  readonly fallback: boolean;
  readonly security?: { readonly reviewers?: readonly string[]; readonly paths?: readonly string[] };
}

const securityReviewerKeywords = ['security', 'access', 'tenant'];
const defaultSecurityPaths = ['**/auth/**', '**/tenant/**', '**/tenants/**', '**/rls/**', '**/policies/**'];
const docPath = /(^|\/)(docs?|documentation)\/|\.(md|mdx|rst|adoc|txt)$/;
const fallbackReason = 'fallback: no review-gates.json';

const gateEntries = (config: Record<string, unknown>, kind: GateKind) =>
  objectsOf(config[kind]).flatMap((entry): GateEntry[] => {
    const name = textOf(entry.skill);
    if (name === undefined) return [];
    const triggers = isRecord(entry.triggers) ? entry.triggers : {};

    return [{ name, kind, changed: stringsOf(triggers.changed), added: stringsOf(triggers.added) }];
  });

const loadGates = (root: string): Gates => {
  const gates = readJsonFile(join(root, '.agentic', 'review-gates.json'));
  if (isRecord(gates)) {
    const security = isRecord(gates.security)
      ? { reviewers: stringsOf(gates.security.reviewers), paths: stringsOf(gates.security.paths) }
      : undefined;

    return {
      entries: (['alwaysOn', 'conditional', 'onDemand'] as const).flatMap((kind) => gateEntries(gates, kind)),
      fallback: false,
      security,
    };
  }

  const project = readJsonFile(join(root, '.agentic.json'));
  if (!isRecord(project) || !Array.isArray(project.reviewers)) {
    throw new CliError(1, 'no .agentic/review-gates.json and no reviewers in .agentic.json');
  }

  return { entries: stringsOf(project.reviewers).map((name) => ({ name, kind: 'alwaysOn', changed: [], added: [] })), fallback: true };
};

const firstGlobMatch = (patterns: readonly string[], paths: readonly string[]) =>
  paths.find((path) => patterns.some((pattern) => new Bun.Glob(pattern).match(path)));

const diffPaths = (root: string, base: string, filter: readonly string[] = []) => {
  const output = gitOutput(root, ['diff', '--name-only', ...filter, base]);
  if (output === undefined) throw new CliError(1, `git diff failed against base "${base}" in ${root}`);

  return output.split('\n').filter(Boolean);
};

const securityReviewerNames = (gates: Gates) =>
  gates.security?.reviewers ??
  gates.entries
    .filter((entry) => entry.kind === 'alwaysOn' && securityReviewerKeywords.some((keyword) => entry.name.includes(keyword)))
    .map((entry) => entry.name);

const firstLine = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n')[0] ?? '' : '');

const workspaceRoot = async (context: Context) => {
  const item = await resolveWorkItem(context, { allowCreate: false }).catch(() => undefined);
  const state = item === undefined ? undefined : readJsonFile(join(item.dir, 'state.json'));
  const recorded = isRecord(state) && isRecord(state.workspace) ? textOf(state.workspace.path) : undefined;

  return recorded ?? gitOutput(context.cwd, ['rev-parse', '--show-toplevel'])?.trim() ?? context.cwd;
};

const logEligibleReviewers = async (item: WorkItem, reviewers: readonly string[], reason: string | undefined, widen: boolean) => {
  const run = currentRun(await readEvents(item));
  const result = validateEvent({
    ts: nowTimestamp(),
    work: item.name,
    run: run?.run,
    harness: run?.harness,
    workflow: run?.workflow,
    step: 'review',
    type: 'note',
    summary: widen ? `review eligible --all: ${reason}` : 'review eligible',
    data: reason === undefined ? { reviewers } : { reason, reviewers },
  });
  if (result.event === undefined) throw failValidation(result.errors);
  await appendEvent(item, result.event);
  await writeState(item);
};

const reviewEligibleCommand: Command = {
  name: 'review eligible',
  usage: 'review eligible --base <ref> [--iteration n] [--all --reason <text>] [--only a,b] [--work <slug>]',
  arguments: 0,
  flags: ['base', 'iteration', 'reason', 'only'],
  switches: ['all'],
  required: ['base'],
  async run(context) {
    const base = flagText(context, 'base') ?? '';
    const widen = context.values.all === true;
    const reason = flagText(context, 'reason');
    if (widen && reason === undefined) throw new CliError(2, '--all requires --reason');

    const iterationText = flagText(context, 'iteration');
    if (iterationText !== undefined && !isPositiveInteger(iterationText)) {
      throw new CliError(2, `--iteration expects a positive integer, got "${iterationText}"`);
    }
    const iteration = Number(iterationText ?? 1);

    const root = await workspaceRoot(context);
    const gates = loadGates(root);
    const only = (flagText(context, 'only') ?? '').split(',').map((name) => name.trim()).filter(Boolean);
    const unknown = only.filter((name) => !gates.entries.some((entry) => entry.name === name));
    if (unknown.length > 0) throw new CliError(1, `unknown reviewer in --only: ${unknown.join(', ')}`);

    const picked = new Map<string, string>();
    const pick = (name: string, why: string) => {
      if (!picked.has(name)) picked.set(name, why);
    };

    if (widen) {
      for (const entry of gates.entries) pick(entry.name, `widened: ${reason}`);
    } else if (iteration > 1) {
      const item = await resolveWorkItem(context, { allowCreate: false });
      const previous = `reviews/${iteration - 1}-`;
      for (const entry of gates.entries) {
        if (firstLine(join(item.dir, `${previous}${entry.name}.md`)).startsWith('verdict: changes-requested')) {
          pick(entry.name, `changes-requested in ${previous}${entry.name}.md`);
        }
      }
      const configuredPaths = gates.security?.paths;
      const securityChanged =
        configuredPaths === undefined
          ? firstGlobMatch(defaultSecurityPaths, diffPaths(root, base).filter((path) => !docPath.test(path)))
          : firstGlobMatch(configuredPaths, diffPaths(root, base));
      if (securityChanged !== undefined) {
        for (const name of securityReviewerNames(gates)) pick(name, 'security: auth/tenant paths changed');
      }
    } else {
      const changedPaths = diffPaths(root, base);
      const addedPaths = diffPaths(root, base, ['--diff-filter=A']);
      for (const entry of gates.entries) {
        if (gates.fallback) pick(entry.name, fallbackReason);
        else if (entry.kind === 'alwaysOn') pick(entry.name, 'alwaysOn');
        else if (entry.kind === 'conditional') {
          const changed = firstGlobMatch(entry.changed, changedPaths);
          const added = firstGlobMatch(entry.added, addedPaths);
          if (changed !== undefined) pick(entry.name, `changed: ${changed}`);
          else if (added !== undefined) pick(entry.name, `added: ${added}`);
        }
      }
    }
    for (const name of only) pick(name, 'onDemand: --only');

    const reviewers = gates.entries
      .filter((entry, index, all) => picked.has(entry.name) && all.findIndex((other) => other.name === entry.name) === index)
      .map((entry) => ({ name: entry.name, reason: picked.get(entry.name) }));

    const item = await resolveWorkItem(context, { allowCreate: false }).catch(() => undefined);
    if (item !== undefined) await logEligibleReviewers(item, reviewers.map((reviewer) => reviewer.name), reason, widen);
    writeOut(`${JSON.stringify({ reviewers })}\n`);
  },
};

const denyListPatterns = [
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /(sk|rk|pk)_(live|test)_[A-Za-z0-9]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/g,
];

const commentCharLimit = 60_000;
const retriesAfterFirstAttempt = 3;
const networkErrorPattern = /ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|timeout|connection|network|could not resolve|dial tcp/i;
const mirroredFiles = ['spec.md', 'plan.md', 'decisions.md', 'implementation.md', 'state.json'];

interface Gh {
  readonly call: (args: readonly string[]) => Promise<string>;
}

const ghBinary = (env: Context['env']) => env.AGENTIC_GH || 'gh';

const ghAvailable = (env: Context['env']) => Bun.which(ghBinary(env)) !== null;

const createGh = (env: Context['env']): Gh => {
  const binary = ghBinary(env);
  const baseDelay = Number(env.AGENTIC_RETRY_MS ?? 1000);

  const call = async (args: readonly string[]) => {
    for (let attempt = 0; ; attempt++) {
      const result = spawnSync(binary, [...args], { encoding: 'utf8' });
      if (result.status === 0) return result.stdout;

      const stderr = (result.stderr || String(result.error ?? '')).trim();
      if (attempt >= retriesAfterFirstAttempt || !networkErrorPattern.test(stderr)) {
        throw new CliError(1, `gh ${args.join(' ')} failed: ${stderr}`);
      }
      await Bun.sleep(baseDelay * 2 ** attempt);
    }
  };

  return { call };
};

interface Mirror {
  readonly label: string;
  readonly marker: (part: number) => string;
  readonly head: string;
  readonly fence: string | undefined;
  readonly lines: readonly string[];
}

const redactDenied = (line: string) =>
  denyListPatterns.reduce((redacted, pattern) => redacted.replace(pattern, (match) => `${match.slice(0, 4)}…`), line);

const findDenied = (mirrors: readonly Mirror[]) => {
  for (const mirror of mirrors) {
    const index = mirror.lines.findIndex((line) => denyListPatterns.some((pattern) => new RegExp(pattern).test(line)));
    const line = mirror.lines[index];
    if (line !== undefined) return `deny-list: ${mirror.label}:${index + 1}: ${redactDenied(line)}`;
  }

  return undefined;
};

const renderParts = (mirror: Mirror) => {
  const fenceOpen = mirror.fence === undefined ? '' : `\`\`\`${mirror.fence}\n`;
  const fenceClose = mirror.fence === undefined ? '' : '```';
  const overhead = mirror.marker(999).length + mirror.head.length + fenceOpen.length + fenceClose.length + 2;
  const budget = commentCharLimit - overhead;

  const chunks: string[] = [];
  let current = '';
  for (const line of mirror.lines.map((text) => `${text}\n`)) {
    if (current !== '' && current.length + line.length > budget) {
      chunks.push(current);
      current = '';
    }
    current += line;
  }
  chunks.push(current);

  return chunks.map((chunk, index) => {
    const part = index + 1;
    const head = part === 1 ? mirror.head : '';

    return { marker: mirror.marker(part), body: `${mirror.marker(part)}\n${head}${fenceOpen}${chunk}${fenceClose}` };
  });
};

const fileMirror = async (item: WorkItem, file: string): Promise<Mirror> => {
  const text = await readFile(join(item.dir, file), 'utf8');
  const lines = text.replace(/\n$/, '').split('\n');

  return {
    label: file,
    marker: (part) => `<!-- agentic:file ${file}${part > 1 ? ` part ${part}` : ''} -->`,
    head: '',
    fence: file === 'state.json' ? 'json' : undefined,
    lines,
  };
};

const runMirror = async (item: WorkItem, context: Context, login: string): Promise<Mirror> => {
  const path = join(item.dir, 'events.jsonl');
  const rawLines = existsSync(path) ? (await readFile(path, 'utf8')).split('\n') : [];
  const entries = rawLines.flatMap((line, index) =>
    line.trim() === '' ? [] : [{ line, event: parseStoredEvent(line, index + 1) }],
  );
  const run = flagText(context, 'run') ?? currentRun(entries.map((entry) => entry.event))?.run;
  const own = entries.filter((entry) => entry.event.run === run);
  const first = own[0]?.event;
  if (run === undefined || first === undefined) throw new CliError(1, `no events for run ${run ?? '(none)'}`);

  const model = flagText(context, 'model') ?? own.find((entry) => entry.event.model !== undefined)?.event.model ?? 'unknown';

  return {
    label: `run ${run}`,
    marker: (part) => `<!-- agentic:run ${run}${part > 1 ? ` part ${part}` : ''} -->`,
    head: `${first.workflow} · ${first.harness} · ${model} · @${login}\n`,
    fence: 'jsonl',
    lines: own.map((entry) => entry.line),
  };
};

const upsertComment = async (gh: Gh, commentsPath: string, marker: string, body: string, repo: string) => {
  const existing = (
    await gh.call(['api', commentsPath, '--paginate', '--jq', `.[] | select(.body | startswith("${marker}")) | .id`])
  )
    .split('\n')
    .find((line) => line.trim() !== '');
  const bodyPath = join(tmpdir(), `agentic-hub-${randomBytes(4).toString('hex')}.md`);
  await writeFile(bodyPath, body);

  try {
    const target =
      existing === undefined
        ? ['api', '-X', 'POST', commentsPath]
        : ['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${existing.trim()}`];
    await gh.call([...target, '-F', `body=@${bodyPath}`]);
  } finally {
    await rm(bodyPath, { force: true });
  }

  return existing === undefined ? 'created' : 'updated';
};

const syncHub = async (item: WorkItem, context: Context, quiet = false) => {
  const { hub } = await writeState(item);
  if (hub === null) {
    if (!quiet) writeOut('skipped: no hub (log a choice decision with key hub or an artifact event with data.hub)\n');

    return;
  }
  if (!ghAvailable(context.env)) {
    if (!quiet) writeOut('skipped: gh not found (hub sync is GitHub-only)\n');

    return;
  }

  const gh = createGh(context.env);
  const repo = (await gh.call(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'])).trim();
  const login = (await gh.call(['api', 'user', '-q', '.login'])).trim();

  const present = mirroredFiles.filter((file) => existsSync(join(item.dir, file)));
  const mirrors = [...(await Promise.all(present.map((file) => fileMirror(item, file)))), await runMirror(item, context, login)];
  const denied = findDenied(mirrors);
  if (denied !== undefined) throw new CliError(1, denied);

  const commentsPath = `repos/${repo}/issues/${hub}/comments`;
  for (const part of mirrors.flatMap(renderParts)) {
    const action = await upsertComment(gh, commentsPath, part.marker, part.body, repo);
    if (!quiet) writeOut(`${action} ${part.marker} (${part.body.length} chars)\n`);
  }
};

const hubSyncCommand: Command = {
  name: 'hub sync',
  usage: 'hub sync [--run <id>] [--model <name>] [--work <slug>]',
  arguments: 0,
  flags: ['run', 'model'],
  required: [],
  async run(context) {
    await syncHub(await resolveWorkItem(context, { allowCreate: false }), context);
  },
};

const milestoneTypes = ['completed', 'failed', 'artifact', 'gate', 'escalation', 'decision'];
const isMilestone = (event: StoredEvent) => milestoneTypes.includes(event.type) || (isWorkflowLevel(event) && event.type === 'started');
const isFinalMilestone = (event: StoredEvent) => isWorkflowLevel(event) && (event.type === 'completed' || event.type === 'failed');

const hubSyncFailedMessage = 'hub sync failed: retry `hub sync`, then tell the user';

const logHubSyncFailure = async (item: WorkItem, last: StoredEvent, reason: string) => {
  const result = validateEvent({
    ts: nowTimestamp(),
    work: item.name,
    run: last.run,
    harness: last.harness,
    workflow: last.workflow,
    step: 'hub',
    type: 'note',
    summary: 'hub sync failed',
    data: { reason },
  });
  if (result.event === undefined) throw failValidation(result.errors);
  await appendEvent(item, result.event);
};

const syncHubAfterMilestones = async (context: Context) => {
  const milestones = appended.filter(({ event }) => isMilestone(event));
  appended.length = 0;
  const last = milestones.at(-1);
  if (last === undefined) return;

  const { item } = last;
  try {
    await syncHub(item, { ...context, values: {}, positionals: [] }, true);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await logHubSyncFailure(item, last.event, reason);
    appended.length = 0;
    if (milestones.some(({ event }) => isFinalMilestone(event))) throw new CliError(1, hubSyncFailedMessage, false);
  }
};

const strayPattern = /\.(run|tmp)$/;

const workflowGap = (events: readonly StoredEvent[]) => {
  const latest = events.findLast((event) => isWorkflowLevel(event) && !isCleanup(event));
  if (latest === undefined) return ['workflow not completed: no workflow-level event'];

  return latest.type === 'completed'
    ? []
    : [`workflow not completed: latest workflow-level event is ${latest.type} (${latest.workflow})`];
};

const prGaps = async (state: WorkState, gh: Gh) => {
  if (typeof state.pr.url !== 'string') return ['no pr url logged'];

  try {
    const view: unknown = JSON.parse(await gh.call(['pr', 'view', state.pr.url, '--json', 'state,mergedAt']));
    const prState = isRecord(view) ? textOf(view.state) : undefined;

    return prState === 'MERGED' ? [] : [`pr not merged: ${prState ?? 'unknown'}`];
  } catch (err) {
    return [err instanceof Error ? err.message : String(err)];
  }
};

const branchGaps = (state: WorkState, root: string) => {
  const branch = textOf(state.workspace?.branch);
  if (branch === undefined) return ['no workspace branch logged'];

  const found = gitOutput(root, ['branch', '--list', branch])?.trim() ?? '';

  return found === '' ? [] : [`branch still exists: ${branch}`];
};

const worktreeGaps = (state: WorkState, root: string) => {
  const path = textOf(state.workspace?.path);
  if (path === undefined) return ['no workspace path logged'];

  const listed = (gitOutput(root, ['worktree', 'list', '--porcelain']) ?? '')
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => realPathOrSelf(line.slice('worktree '.length)));

  return listed.includes(realPathOrSelf(path)) || existsSync(path) ? [`worktree still present: ${path}`] : [];
};

const strayGaps = async (item: WorkItem) => {
  const entries = await readdir(item.dir, { recursive: true });

  return entries
    .filter((entry) => strayPattern.test(entry))
    .sort()
    .map((entry) => `stray file: ${entry}`);
};

const outsideArtifactGaps = (item: WorkItem, events: readonly StoredEvent[]) =>
  events
    .filter((event) => event.type === 'artifact')
    .map((event) => textOf(event.data.path))
    .filter((path): path is string => path !== undefined && !isInside(resolve(item.dir, path), item.dir))
    .map((path) => `artifact outside the work item: ${path}`);

const cleanupCheckCommand: Command = {
  name: 'cleanup check',
  usage: 'cleanup check [--work <slug>]',
  arguments: 0,
  flags: [],
  required: [],
  async run(context) {
    const item = await resolveWorkItem(context, { allowCreate: false });
    const events = await readEvents(item);
    const state = deriveState(item.name, events);
    const root = mainCheckout(context.cwd);

    const checkPr = ghAvailable(context.env);
    if (!checkPr) writeOut('skipped: PR state check, gh not found (GitHub-only)\n');

    const gaps = [
      ...workflowGap(events),
      ...(checkPr ? await prGaps(state, createGh(context.env)) : []),
      ...branchGaps(state, root),
      ...worktreeGaps(state, root),
      ...(await strayGaps(item)),
      ...outsideArtifactGaps(item, events),
    ];
    if (gaps.length === 0) {
      writeOut('ready: all cleanup preconditions hold\n');

      return;
    }

    writeOut(gaps.map((gap) => `missing: ${gap}\n`).join(''));
    throw new CliError(1, `cleanup not ready: ${gaps.length} gap(s)`);
  },
};

interface HookAdapter {
  readonly prompt: (payload: Record<string, unknown>) => string | undefined;
  readonly deny: (message: string) => void;
}

const toolInputPrompt = (payload: Record<string, unknown>) => textOf(recordField(payload, 'tool_input').prompt);

const codexToolInputPrompt = (payload: Record<string, unknown>) =>
  toolInputPrompt(payload) ?? textOf(recordField(payload, 'tool_input').message);

const spawnToolNames: Readonly<Record<string, readonly string[]>> = {
  claude: ['Agent', 'mcp__ccd_session__start_session'],
  codex: ['Agent', 'spawn_agent'],
  cursor: ['Agent'],
};

const hookCwd = (context: Context, payload: Record<string, unknown>) => {
  const roots = payload.workspace_roots;
  const firstRoot = Array.isArray(roots) ? textOf(roots[0]) : undefined;

  return textOf(payload.cwd) ?? firstRoot ?? context.cwd;
};

const denyPreToolUse = (message: string) => {
  const output = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: message } };
  writeOut(`${JSON.stringify(output)}\n`);
  throw new CliError(2, message, false);
};

const hookAdapters: Readonly<Record<string, HookAdapter>> = {
  claude: { prompt: (payload) => toolInputPrompt(payload) ?? textOf(payload.prompt), deny: denyPreToolUse },
  codex: { prompt: (payload) => codexToolInputPrompt(payload) ?? textOf(payload.prompt), deny: denyPreToolUse },
  cursor: {
    prompt: (payload) => textOf(payload.task) ?? textOf(payload.prompt) ?? toolInputPrompt(payload),
    deny: (message) => writeOut(`${JSON.stringify({ permission: 'deny', user_message: message })}\n`),
  },
};

const readHookPayload = async () => {
  try {
    const parsed: unknown = JSON.parse(await Bun.stdin.text());

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const isOpenRun = (events: readonly StoredEvent[]) =>
  workflowStarts(events).some((event) => !isClosedRun(events, event.run));

const safeEvents = async (item: WorkItem) => {
  try {
    return await readEvents(item);
  } catch {
    return [];
  }
};

const isInside = (path: string, root: string) => {
  const from = relative(root, path);

  return from === '' || (from !== '..' && !from.startsWith(`..${sep}`) && !isAbsolute(from));
};

const recordedCwds = (events: readonly StoredEvent[]) =>
  workflowStarts(events)
    .filter((event) => !isClosedRun(events, event.run))
    .map((event) => textOf(event.data?.cwd))
    .filter((cwd) => cwd !== undefined);

const specificity = (here: string, main: string, linked: readonly string[], path: string | undefined, events: readonly StoredEvent[]) => {
  if (path === undefined && here === main) return main.length;

  const roots = [path, ...recordedCwds(events)].filter((root) => root !== undefined).map(realPathOrSelf);
  const matching = roots.filter((root) => isInside(here, root) && (root !== main || !linked.some((worktree) => isInside(here, worktree))));

  return matching.length === 0 ? undefined : Math.max(...matching.map((root) => root.length));
};

const latestStarted = (events: readonly StoredEvent[]) => workflowStarts(events).at(-1)?.ts ?? '';

const isArchivedPath = (path: string) => path.split(/[\\/]/).includes('_archive');

const namedItemDir = (root: string, workItem: string | undefined) => {
  if (workItem === undefined || !existsSync(workItem) || isArchivedPath(workItem)) return undefined;

  return resolve(dirname(workItem)) === resolve(root) ? resolve(workItem) : undefined;
};

const findHookItem = async (context: Context, cwd: string, workItem?: string) => {
  if (flagText(context, 'work') !== undefined) return resolveWorkItem(context, { allowCreate: false });

  const root = outputRoot(context);
  const here = realPathOrSelf(cwd);
  const main = realPathOrSelf(mainCheckout(context.cwd));
  const linked = linkedWorktrees(context.cwd).map(realPathOrSelf);
  const candidates = [];

  for (const name of await listItemNames(root)) {
    const item = { name, dir: join(root, name) };
    const events = await safeEvents(item);
    if (!isOpenRun(events)) continue;

    const rank = specificity(here, main, linked, textOf(deriveState(name, events).workspace?.path), events);
    if (rank !== undefined) candidates.push({ item, rank, started: latestStarted(events) });
  }

  const named = namedItemDir(root, workItem);
  candidates.sort(
    (first, second) =>
      Number(second.item.dir === named) - Number(first.item.dir === named) ||
      second.rank - first.rank ||
      second.started.localeCompare(first.started),
  );

  return candidates.at(0)?.item;
};

const briefLine = (brief: string, label: string) => new RegExp(`^[ \\t]*${label}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(brief)?.[1];


const checkBrief = (brief: string, events: readonly StoredEvent[]) => {
  const missing: string[] = [];
  const step = briefLine(brief, 'Step');
  const workItem = briefLine(brief, 'Work item');
  const agent = briefLine(brief, 'Agent')?.split('·')[0]?.trim();

  if (!step) missing.push('Step:');
  if (!workItem) missing.push('Work item:');
  else if (!existsSync(workItem) || isArchivedPath(workItem)) missing.push('Work item: existing non-archived path');
  if (briefLine(brief, 'Skills') === undefined) missing.push('Skills:');
  if (briefLine(brief, 'Progress') === undefined && !/read-only/.test(brief)) missing.push('Progress:');
  if (!agent) missing.push('Agent:');
  else if (!events.some((event) => event.type === 'started' && event.agent === agent)) {
    missing.push(`started event for ${agent}`);
  }

  return { missing, step, agent, workItem };
};

const skillList = (text: string | undefined) => (text ?? '').split(',').map((skill) => skill.trim()).filter(Boolean);

const sameSet = (left: readonly string[], right: readonly string[]) =>
  new Set(left).size === new Set(right).size && left.every((entry) => right.includes(entry));

const startedFor = (events: readonly StoredEvent[], agent: string | undefined) =>
  events.filter((event) => event.type === 'started' && event.agent === agent).at(-1);

const expectedSpawn = (started: StoredEvent) => ({
  model: started.model === undefined ? undefined : claudeAlias('claude', started.model),
  effort: started.effort,
  skills: Array.isArray(started.data.skills) ? stringsOf(started.data.skills) : undefined,
});

const checkClaudeSpawn = (payload: Record<string, unknown>, brief: string, started: StoredEvent | undefined) => {
  const issues: string[] = [];
  const loadSkills = briefLine(brief, 'Load skills');
  if (loadSkills === undefined) issues.push('Load skills: (inline line, not a pointer to a brief file)');
  if (started === undefined) return { issues, expected: '' };

  const toolInput = recordField(payload, 'tool_input');
  const { model, effort, skills } = expectedSpawn(started);
  const gotModel = textOf(toolInput.model);
  const gotEffort = textOf(toolInput.effort);
  if (model !== undefined && (gotModel === undefined ? undefined : claudeAlias('claude', gotModel)) !== model) {
    issues.push(`model ${model} (got ${gotModel ?? 'none'})`);
  }
  if (effort !== undefined && gotEffort !== effort) issues.push(`effort ${effort} (got ${gotEffort ?? 'none'})`);
  if (loadSkills !== undefined && skills !== undefined && !sameSet(skillList(loadSkills), skills)) {
    issues.push(`Load skills: ${skills.join(', ')} (got ${loadSkills})`);
  }

  const parts = [model && `model ${model}`, effort && `effort ${effort}`, skills && `Load skills: ${skills.join(', ')}`];

  return { issues, expected: `\nexpected: ${parts.filter(Boolean).join(', ')}` };
};

const expectedTier = (context: Context, harness: string, step: string | undefined) => {
  if (step === undefined || !stepKeyShape.test(step)) return '';

  try {
    const root = mainCheckout(context.cwd);
    const { model, effort } = resolveTier(loadStepConfig(context, root), harness, step);

    return `\nexpected: model ${model}, effort ${effort}`;
  } catch {
    return '';
  }
};

const reviewerOf = (step: string | undefined) => (step?.startsWith('review.') ? step.slice('review.'.length) : undefined);

const checkReviewerListed = (step: string | undefined, events: readonly StoredEvent[]) => {
  const reviewer = reviewerOf(step);
  if (reviewer === undefined) return [];

  const run = currentRun(events)?.run;
  const list = events.findLast((event) => event.type === 'note' && event.step === 'review' && event.run === run && Array.isArray(event.data.reviewers));
  if (list === undefined) return ['a logged reviewer list (run review eligible first)'];

  const reviewers = stringsOf(list.data.reviewers);

  return reviewers.includes(reviewer) ? [] : [`${reviewer} in the latest review eligible list (${reviewers.join(', ')}); widen with review eligible --only ${reviewer}`];
};

const traceBlocked = async (workItem: string | undefined, entry: { harness: string; fallbackWorkflow: string; missing: readonly string[]; agent?: string }) => {
  if (!workItem || !existsSync(workItem) || isArchivedPath(workItem)) return;

  const item = { name: basename(workItem), dir: workItem };
  const run = currentRun(await safeEvents(item));
  await appendEvent(item, {
    ts: nowTimestamp(),
    work: item.name,
    run: run?.run ?? null,
    harness: entry.harness,
    workflow: run?.workflow ?? entry.fallbackWorkflow,
    step: 'hook',
    type: 'note',
    summary: `spawn blocked: missing ${entry.missing.join(', ')}`,
    data: { agent: entry.agent ?? null },
  });
};

const managerSpawnIssues = (state: ManagerState | undefined, id: string, payload: Record<string, unknown>, brief: string) => {
  if (state === undefined) return { issues: ['no readable manager ledger'], expected: '' };

  const unit = state.units[id];
  if (unit === undefined) return { issues: [`unit "${id}" is not in the ledger`], expected: '' };

  const toolInput = recordField(payload, 'tool_input');
  const gotModel = textOf(toolInput.model);
  const gotEffort = textOf(toolInput.effort);
  const issues: string[] = [];
  if (!/^[ \t]*Work item:[ \t]*none\b/m.test(brief)) issues.push('Work item: none');
  if (!brief.includes(relayProtocol(id, unit.attended))) issues.push('the relay protocol block, verbatim');
  if (claudeAlias('claude', unit.model) !== (gotModel === undefined ? undefined : claudeAlias('claude', gotModel))) {
    issues.push(`model ${claudeAlias('claude', unit.model)} (got ${gotModel ?? 'none'})`);
  }
  if (unit.effort !== gotEffort) issues.push(`effort ${unit.effort} (got ${gotEffort ?? 'none'})`);

  return { issues, expected: ` (model ${claudeAlias('claude', unit.model)}, effort ${unit.effort})` };
};

const managerBriefCommand = (id: string) => `bun ${join(import.meta.dir, 'agentic.ts')} manager brief ${id}`;

const checkManagerSpawn = (context: Context, adapter: HookAdapter, payload: Record<string, unknown>, tool: string | undefined, brief: string) => {
  const id = briefLine(brief, 'Manager unit');
  if (id === 'none') return;

  const state = hookManagerState(context);
  if (id === undefined) {
    if (state === undefined || tool !== 'mcp__ccd_session__start_session' || !isManagerCwd(state, hookCwd(context, payload))) return;

    adapter.deny(
      [
        'spawn blocked: a session started from the manager needs a `Manager unit: <id>` line, or `Manager unit: none` for a session outside the ledger',
        `fix: run \`${managerBriefCommand('<id>')}\` and paste its prompt, or add \`Manager unit: none\``,
      ].join('\n'),
    );

    return;
  }

  const { issues, expected } = managerSpawnIssues(state, id, payload, brief);
  if (issues.length === 0) return;

  adapter.deny(
    [
      `spawn blocked, manager unit ${id}: ${issues.join(', ')}`,
      `fix: run \`${managerBriefCommand(id)}\` and paste its prompt, with the printed model and effort${expected}`,
    ].join('\n'),
  );
};

const hookSpawnCommand: Command = {
  name: 'hook spawn',
  usage: 'hook spawn [--harness claude|cursor|codex] [--work <slug>]   (reads the harness hook payload on stdin)',
  arguments: 0,
  flags: ['harness'],
  required: [],
  async run(context) {
    const harness = flagText(context, 'harness') ?? 'claude';
    const adapter = hookAdapters[harness];
    if (adapter === undefined) throw new CliError(2, `invalid harness "${harness}": expected ${harnesses.join('|')}`);

    const payload = await readHookPayload();
    if (payload === undefined) return;

    const tool = textOf(payload.tool_name);
    if (tool !== undefined && !spawnToolNames[harness]?.includes(tool)) return;

    const brief = adapter.prompt(payload);
    if (harness === 'claude') checkManagerSpawn(context, adapter, payload, tool, brief ?? '');

    const item = await findHookItem(context, hookCwd(context, payload), brief === undefined ? undefined : briefLine(brief, 'Work item'));
    if (item === undefined || brief === undefined || /^[ \t]*Work item:[ \t]*none\b/m.test(brief)) return;

    const events = await safeEvents(item);
    const checked = checkBrief(brief, events);
    const { step, agent, workItem } = checked;
    const spawn = harness === 'claude' ? checkClaudeSpawn(payload, brief, startedFor(events, agent)) : { issues: [], expected: '' };
    const missing = [...checked.missing, ...spawn.issues, ...checkReviewerListed(step, events)];
    if (missing.length === 0) return;

    await traceBlocked(workItem, { harness, fallbackWorkflow: currentRun(events)?.workflow ?? 'implement', missing, agent });

    const fix = `bun ${join(import.meta.dir, 'agentic.ts')} step ${step || '<step>'} --unit <task> --agent ${agent || '<label>'} --work ${item.name}`;
    const message = [
      `spawn blocked, brief is missing: ${missing.join(', ')} (Progress: may be replaced by the word read-only)`,
      `fix: run \`${fix}\` and paste its output as the prompt, with the printed model and effort${spawn.expected || expectedTier(context, harness, step)}`,
    ].join('\n');

    adapter.deny(message);
  },
};

const transcriptLines = (text: string) =>
  text.split('\n').flatMap((line) => {
    try {
      const parsed: unknown = JSON.parse(line);

      return isRecord(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });

const firstPrompt = (entries: readonly Record<string, unknown>[]) => {
  const content = entries.find((entry) => entry.type === 'user')?.message;
  const body = isRecord(content) ? content.content : undefined;
  if (typeof body === 'string') return body;

  return Array.isArray(body) ? body.map((block) => (isRecord(block) ? textOf(block.text) : undefined) ?? '').join('\n') : undefined;
};

const toolUses = (entries: readonly Record<string, unknown>[]) =>
  entries
    .flatMap((entry) => {
      const content = recordField(entry, 'message').content;

      return Array.isArray(content) ? content : [];
    })
    .filter((block) => isRecord(block) && block.type === 'tool_use')
    .map((block) => ({ name: textOf(block.name), input: recordField(block, 'input') }));

const loadedSkill = (skill: string, uses: ReturnType<typeof toolUses>) =>
  uses.some(
    (use) =>
      (use.name === 'Skill' && textOf(use.input.skill) === skill) ||
      (use.name === 'Read' && (textOf(use.input.file_path) ?? '').endsWith(`${skill}/SKILL.md`)),
  );

const hookSubagentStopCommand: Command = {
  name: 'hook subagent-stop',
  usage: 'hook subagent-stop [--harness claude] [--work <slug>]   (reads the SubagentStop payload on stdin; blocks once when an expected skill was not loaded)',
  arguments: 0,
  flags: ['harness'],
  required: [],
  async run(context) {
    try {
      const payload = await readHookPayload();
      if (payload === undefined) return;

      const item = await findHookItem(context, hookCwd(context, payload));
      if (item === undefined) return;

      const events = await safeEvents(item);
      const run = currentRun(events);
      const note = (summary: string, data: Record<string, unknown>) =>
        appendEvent(item, { ts: nowTimestamp(), work: item.name, run: run?.run ?? null, harness: 'claude', workflow: run?.workflow ?? 'implement', step: 'hook', type: 'note', summary, data });

      const transcriptPath = textOf(payload.agent_transcript_path);
      if (transcriptPath === undefined) return await note('subagent-stop: no transcript path in payload', {});

      const entries = transcriptLines(await Bun.file(transcriptPath).text());
      const agent = briefLine(firstPrompt(entries) ?? '', 'Agent')?.split('·')[0]?.trim();
      const started = startedFor(events, agent);
      if (agent === undefined || started === undefined) return;

      const uses = toolUses(entries);
      const missing = (expectedSpawn(started).skills ?? []).filter((skill) => !loadedSkill(skill, uses));
      if (missing.length === 0) return;

      if (payload.stop_hook_active === true) return await note(`subagent-stop: ${agent} still missing skills ${missing.join(', ')}`, { agent, missing });

      writeOut(`${JSON.stringify({ decision: 'block', reason: `Load the skills missing from your work before stopping: ${missing.join(', ')}. Call the Skill tool for each, then finish.` })}\n`);
    } catch {
      return;
    }
  },
};

type CompactAdapter = (payload: Record<string, unknown>, text: string) => string | undefined;

const sessionStartOnCompact: CompactAdapter = (payload, text) => {
  const event = textOf(payload.hook_event_name) ?? 'SessionStart';
  if (event !== 'SessionStart' || textOf(payload.source) !== 'compact') return undefined;

  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } });
};

const compactAdapters: Readonly<Record<string, CompactAdapter>> = {
  claude: sessionStartOnCompact,
  codex: sessionStartOnCompact,
  cursor: (payload, text) => {
    const event = textOf(payload.hook_event_name) ?? 'sessionStart';
    if (event.toLowerCase() !== 'sessionstart') return undefined;

    return JSON.stringify({ additional_context: text });
  },
};

const hookCompactCommand: Command = {
  name: 'hook compact',
  usage: 'hook compact [--harness claude|cursor|codex] [--work <slug>]   (reads the harness hook payload on stdin)',
  arguments: 0,
  flags: ['harness'],
  required: [],
  async run(context) {
    const harness = flagText(context, 'harness') ?? 'claude';
    const adapter = compactAdapters[harness];
    if (adapter === undefined) throw new CliError(2, `invalid harness "${harness}": expected ${harnesses.join('|')}`);

    const payload = await readHookPayload();
    if (payload === undefined) return;

    const cwd = hookCwd(context, payload);
    const item = await findHookItem(context, cwd);
    const events = item === undefined ? [] : await safeEvents(item);
    const workText = item === undefined ? undefined : `${resumeText(item, events, cwd)}\n${cardText(item, events)}`;
    const text = [managerCompactText(context, cwd), workText].filter((part) => part !== undefined).join('\n\n');
    if (text === '') return;

    const output = adapter(payload, text);
    if (output === undefined) return;

    if (item !== undefined) {
      const run = currentRun(events);
      await appendEvent(item, {
        ts: nowTimestamp(),
        work: item.name,
        run: run?.run ?? null,
        harness,
        workflow: run?.workflow ?? 'implement',
        step: 'hook',
        type: 'note',
        summary: 'compact: resume injected',
        data: { hook: 'compact' },
      });
    }
    writeOut(`${output}\n`);
  },
};

const unitStates = ['queued', 'running', 'waiting', 'paused', 'pr', 'merged', 'done', 'failed'];
const activeStates = ['running', 'waiting', 'pr'];
const liveUnitStates = [...activeStates, 'paused'];
const closedStates = ['merged', 'done', 'failed'];
const unitKinds = ['playbook', 'free', 'sidequest', 'adopted'];
const depModes = ['wait', 'stacked'];
const backlogStates = ['open', 'started', 'dropped'];
const answerers = ['user', 'manager'];
const unitIdShape = /^[a-z0-9][a-z0-9-]*$/;
const settableUnitKeys = ['state', 'session', 'path', 'branch', 'pr', 'model', 'effort', 'attended', 'pausedBy', 'summary'];

interface ManagerEvent {
  readonly ts: string;
  readonly type: string;
  readonly [field: string]: unknown;
}

interface ManagerUnit {
  title: string;
  kind: string;
  playbook: string | null;
  input: string | null;
  model: string;
  effort: string;
  deps: string[];
  depMode: string | null;
  presets: Record<string, string>;
  for: string | null;
  state: string;
  session: string | null;
  path: string | null;
  branch: string | null;
  pr: string | null;
  attended: boolean;
  pausedBy: string | null;
  summary: string | null;
  marker: string | null;
  misses: number;
}

interface ManagerQuestion {
  unit: string;
  text: string;
  options: string[];
  answer?: string;
  by?: string;
  basis?: string;
  answeredAt?: number;
}

interface ManagerBacklogEntry {
  title: string;
  from: string[];
  context: string | null;
  ticket: string | null;
  state: string;
  lastOffered: number;
  raised: number;
}

interface ManagerState {
  cwd: string | null;
  units: Record<string, ManagerUnit>;
  order: string[];
  questions: Record<string, ManagerQuestion>;
  rules: Record<string, string>;
  backlog: Record<string, ManagerBacklogEntry>;
  usage: number | null;
  released: string[];
  lastStatus: number;
  lastFinished: number;
  updated: string | null;
}

interface ManagerLimits {
  readonly parallel: number;
  readonly heartbeat: number;
  readonly usage: number;
}

interface ManagerPaths {
  readonly dir: string;
  readonly events: string;
  readonly state: string;
  readonly decisions: string;
}

const managerPaths = (context: Context): ManagerPaths => {
  const dir = join(outputRoot(context), managerFolder);

  return { dir, events: join(dir, 'events.jsonl'), state: join(dir, 'state.json'), decisions: join(dir, 'decisions.md') };
};

const dictionary = <T>(): Record<string, T> => Object.create(null);

const stringRecord = (value: unknown): Record<string, string> =>
  Object.assign(
    dictionary<string>(),
    Object.fromEntries(Object.entries(isRecord(value) ? value : {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
  );

const blankUnit = (): ManagerUnit => ({
  title: '', kind: 'free', playbook: null, input: null, model: 'default', effort: 'default', deps: [], depMode: null, presets: dictionary(),
  for: null, state: 'queued', session: null, path: null, branch: null, pr: null, attended: false, pausedBy: null, summary: null,
  marker: null, misses: 0,
});

const applyUnitChanges = (unit: ManagerUnit, event: ManagerEvent) =>
  Object.assign(unit, Object.fromEntries(settableUnitKeys.filter((key) => key in event).map((key) => [key, event[key]])));

const rungOf = (misses: number) => (['ok', 'nudge', 'stop-resume'][misses] ?? 'ask');

const applyManagerEvent = (state: ManagerState, event: ManagerEvent, index: number) => {
  const id = textOf(event.id) ?? '';
  const unit = state.units[id];

  if (event.type === 'start') state.cwd = textOf(event.cwd) ?? state.cwd;

  if (event.type === 'unit-add') {
    state.units[id] = {
      ...blankUnit(),
      title: textOf(event.title) ?? '',
      kind: textOf(event.kind) ?? 'free',
      playbook: textOf(event.playbook) ?? null,
      input: textOf(event.input) ?? null,
      deps: stringsOf(event.deps),
      depMode: textOf(event.depMode) ?? null,
      presets: stringRecord(event.presets),
      for: textOf(event.for) ?? null,
    };
    applyUnitChanges(state.units[id], event);
    if (!state.order.includes(id)) state.order.push(id);
  }

  if (event.type === 'unit-set' && unit !== undefined) {
    const before = unit.state;
    applyUnitChanges(unit, event);
    if (before !== unit.state && (unit.state === 'done' || unit.state === 'merged')) state.lastFinished = index;
  }

  if (event.type === 'question-open') {
    state.questions[id] = { unit: textOf(event.unit) ?? '', text: textOf(event.text) ?? '', options: stringsOf(event.options) };
  }

  const question = state.questions[id];
  if (event.type === 'question-answer' && question !== undefined) {
    Object.assign(question, { answer: textOf(event.answer), by: textOf(event.by), basis: textOf(event.basis), answeredAt: index });
  }

  if (event.type === 'rule-add') state.rules[id] = textOf(event.text) ?? '';

  if (event.type === 'backlog-add') {
    state.backlog[id] = {
      title: textOf(event.title) ?? '',
      from: stringsOf([event.from]),
      context: textOf(event.context) ?? null,
      ticket: textOf(event.ticket) ?? null,
      state: 'open',
      lastOffered: index,
      raised: index,
    };
  }

  const entry = state.backlog[id];
  if (event.type === 'backlog-set' && entry !== undefined) {
    entry.state = textOf(event.state) ?? entry.state;
    entry.ticket = textOf(event.ticket) ?? entry.ticket;
    const raiser = textOf(event.from);
    if (raiser !== undefined) {
      entry.from.push(raiser);
      entry.raised = index;
    }
  }

  if (event.type === 'beat') {
    for (const [seenId, raw] of Object.entries(isRecord(event.seen) ? event.seen : {})) {
      const seen = state.units[seenId];
      const marker = textOf(raw);
      if (seen === undefined || marker === undefined) continue;

      seen.misses = seen.state === 'running' && seen.marker === marker ? seen.misses + 1 : 0;
      seen.marker = marker;
    }
    if (typeof event.usage === 'number') state.usage = event.usage;
  }

  if (event.type === 'status') {
    state.lastStatus = index;
    state.released.push(...stringsOf(event.released));
    for (const offered of stringsOf(event.offered)) {
      const offeredEntry = state.backlog[offered];
      if (offeredEntry !== undefined) offeredEntry.lastOffered = index;
    }
  }
};

const deriveManager = (events: readonly ManagerEvent[]) => {
  const state: ManagerState = {
    cwd: null, units: dictionary(), order: [], questions: dictionary(), rules: dictionary(), backlog: dictionary(), usage: null, released: [], lastStatus: -1, lastFinished: -1, updated: null,
  };
  events.forEach((event, index) => {
    applyManagerEvent(state, event, index);
    state.updated = event.ts;
  });

  return state;
};

const parseManagerLine = (line: string): ManagerEvent | undefined => {
  try {
    const parsed: unknown = JSON.parse(line);

    return isRecord(parsed) && typeof parsed.ts === 'string' && typeof parsed.type === 'string' ? { ...parsed, ts: parsed.ts, type: parsed.type } : undefined;
  } catch {
    return undefined;
  }
};

const readManagerEvents = (paths: ManagerPaths, lenient: boolean) =>
  readFileSync(paths.events, 'utf8')
    .split('\n')
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim() !== '')
    .flatMap(({ line, lineNumber }) => {
      const event = parseManagerLine(line);
      if (event !== undefined) return [event];
      if (lenient) return [];

      throw new CliError(1, `_manager/events.jsonl line ${lineNumber}: expected a JSON object with ts and type`, false);
    });

const loadManagerState = (paths: ManagerPaths) => (existsSync(paths.events) ? deriveManager(readManagerEvents(paths, false)) : undefined);

const hookManagerState = (context: Context) => {
  try {
    const paths = managerPaths(context);

    return existsSync(paths.events) ? deriveManager(readManagerEvents(paths, true)) : undefined;
  } catch {
    return undefined;
  }
};

const isManagerCwd = (state: ManagerState, cwd: string) => state.cwd !== null && realPathOrSelf(state.cwd) === realPathOrSelf(cwd);

const unitPathMatches = (state: ManagerState, here: string) => {
  const linked = linkedWorktrees(here).map(realPathOrSelf);

  return Object.entries(state.units).flatMap(([id, unit]) => {
    const path = unit.path === null ? undefined : realPathOrSelf(unit.path);
    if (path === undefined || !liveUnitStates.includes(unit.state) || !isInside(here, path)) return [];

    const nestedWorktree = linked.some((worktree) => worktree !== path && isInside(worktree, path) && isInside(here, worktree));

    return nestedWorktree ? [] : [{ id, unit, path }];
  });
};

const unitBranchMatches = (state: ManagerState, here: string) => {
  const branch = gitOutput(here, ['branch', '--show-current'])?.trim();
  if (branch === undefined || branch === '') return [];

  const leaf = branch.split('/').at(-1) ?? branch;

  return Object.entries(state.units).flatMap(([id, unit]) => {
    const named = new RegExp(`^${id}(-[0-9a-f]+)?$`).test(leaf) || unit.branch === branch || unit.branch === leaf;
    const reachable = unit.state === 'queued' || liveUnitStates.includes(unit.state);

    return !unit.attended && reachable && named ? [{ id, unit, path: here }] : [];
  });
};

const unitAt = (state: ManagerState, cwd: string) => {
  const here = realPathOrSelf(cwd);
  const byPath = unitPathMatches(state, here);
  const matches = byPath.length > 0 ? byPath : unitBranchMatches(state, here);

  return matches.sort((left, right) => right.path.length - left.path.length || right.id.length - left.id.length)[0];
};

const refuseFromUnit = (state: ManagerState, cwd: string) => {
  if (isManagerCwd(state, cwd)) return;

  const match = unitAt(state, cwd);
  if (match !== undefined && !isManagerCwd(state, match.path)) {
    throw new CliError(1, `manager commands run from the manager session only (cwd is inside unit ${match.id})`, false);
  }
};

const requireManager = (context: Context) => {
  const paths = managerPaths(context);
  const state = loadManagerState(paths);
  if (state === undefined) throw new CliError(1, 'no manager ledger: run manager start', false);

  refuseFromUnit(state, context.cwd);

  return { paths, state };
};

const recordManagerEvent = async (paths: ManagerPaths, event: Omit<ManagerEvent, 'ts'>) => {
  await mkdir(paths.dir, { recursive: true });
  await appendFile(paths.events, `${JSON.stringify({ ts: nowTimestamp(), ...event })}\n`);
  const state = deriveManager(readManagerEvents(paths, false));
  await writeFile(paths.state, `${JSON.stringify(state, null, 2)}\n`);

  return state;
};

const limitDefaults: Readonly<Record<string, number>> = { 'manager.parallel': 4, 'manager.heartbeat': 15, 'manager.usage': 80 };

const loadLimits = (context: Context, root: string): ManagerLimits => {
  const home = context.env.HOME;
  const files = [home === undefined ? undefined : join(home, '.agentic', 'config.json'), join(root, '.agentic.json')];
  const limits = { ...limitDefaults };
  for (const file of files) {
    const config = file === undefined ? undefined : readJsonFile(file);
    for (const [key, value] of Object.entries(recordField(isRecord(config) ? config : {}, 'limits'))) {
      if (typeof value === 'number') limits[key] = value;
    }
  }

  return { parallel: limits['manager.parallel'] ?? 4, heartbeat: limits['manager.heartbeat'] ?? 15, usage: limits['manager.usage'] ?? 80 };
};

const managerLimits = (context: Context) => loadLimits(context, mainCheckout(context.cwd));

const relayProtocol = (id: string, attended: boolean) =>
  [
    '## Relay protocol',
    'Start the final message of every turn with one status line, then its block:',
    '',
    attended
      ? `- \`Unit ${id}: question\` — unused: the owner answers you in this session directly.`
      : `- \`Unit ${id}: question\` — numbered questions, each with options, your recommended one first. Use it wherever a skill asks the user or calls a question tool, then end your turn. The answer arrives as a message from the manager.`,
    `- \`Unit ${id}: sidequest\` — a project-global problem outside your scope: what, where, whether it blocks you, your workaround if you continue. Report it; its fix belongs to another unit.`,
    `- \`Unit ${id}: pr-ready\` — PR url, checks and review state.`,
    `- \`Unit ${id}: blocked\` — what stopped you, what you need.`,
    `- \`Unit ${id}: done\` — what changed, commits or PR, anything unverified.`,
    '',
    "Merge a PR only after a manager message relays the owner's yes for that PR.",
  ].join('\n');

const briefTask = (unit: ManagerUnit) => {
  const invocation = unit.kind === 'playbook' && unit.playbook !== null ? `/agentic-${unit.playbook} ${unit.input ?? ''}`.trim() : undefined;
  const task = invocation ?? unit.input ?? unit.title;

  return ['## Task', task, ...(unit.for === null ? [] : [`Raised by unit ${unit.for}.`])].join('\n');
};

const briefDependencies = (state: ManagerState, unit: ManagerUnit) =>
  unit.deps
    .map((dep) => {
      const mode = unit.depMode ?? 'wait';
      const advice =
        mode === 'wait'
          ? `Hold implementation until the manager relays that ${dep} merged: stop before writing code and report \`blocked\`.`
          : `Your branch starts from ${state.units[dep]?.branch}; retarget your PR after ${dep} merges.`;

      return `Depends on ${dep} (${mode}). ${advice}`;
    })
    .join('\n');

const stackedBranch = (state: ManagerState, id: string, unit: ManagerUnit) => {
  if (unit.depMode !== 'stacked') return undefined;

  for (const dep of unit.deps) {
    if (state.units[dep]?.branch == null) throw new CliError(1, `unit ${id}: stacked dep ${dep} has no branch recorded`, false);
  }

  return state.units[unit.deps[0] ?? '']?.branch ?? undefined;
};

const renderBrief = (state: ManagerState, id: string) => {
  const unit = state.units[id];
  if (unit === undefined) throw new CliError(1, `unknown unit "${id}"`, false);

  const source = stackedBranch(state, id, unit);
  const presets = Object.entries(unit.presets).map(([key, value]) => `- ${key}: ${value}`);
  const siblings = orderedUnits(state)
    .filter(([other, sibling]) => other !== id && !closedStates.includes(sibling.state))
    .map(([other, sibling]) => `- ${other} (${sibling.state}): ${sibling.title}`);
  const sections = [
    `Manager unit: ${id}\nWork item: none`,
    `You are work unit ${id} of an agents-manager session: ${unit.title}. The owner talks only to the manager; the manager relays.`,
    briefTask(unit),
    presets.length === 0 ? '' : ['Already decided by the owner; use these as answers and ask only what is still open:', ...presets].join('\n'),
    briefDependencies(state, unit),
    siblings.length === 0 ? '' : ['Other units in this repo; their areas are theirs:', ...siblings].join('\n'),
    relayProtocol(id, unit.attended),
  ];
  const startLine = `start_session: model=${unit.model} effort=${unit.effort} use_worktree=true branch_name=${id}${source === undefined ? '' : ` source_branch=${source}`}`;

  return { startLine, prompt: sections.filter((section) => section !== '').join('\n\n') };
};

const orderedUnits = (state: ManagerState) =>
  state.order.flatMap((id): [string, ManagerUnit][] => {
    const unit = state.units[id];

    return unit === undefined ? [] : [[id, unit]];
  });

const activeCount = (state: ManagerState) => Object.values(state.units).filter((unit) => activeStates.includes(unit.state)).length;

const stackedDepsReady = (state: ManagerState, unit: ManagerUnit) =>
  unit.depMode !== 'stacked' || unit.deps.every((dep) => state.units[dep]?.branch != null && state.units[dep]?.state !== 'queued');

const startableUnits = (state: ManagerState, parallel: number) => {
  const started: string[] = [];
  for (const [id, unit] of orderedUnits(state)) {
    if (unit.state !== 'queued' || !stackedDepsReady(state, unit)) continue;
    if (activeCount(state) + started.length >= parallel) break;
    started.push(id);
  }

  return started;
};

const activeWaiters = (state: ManagerState) =>
  orderedUnits(state).filter(([, unit]) => activeStates.includes(unit.state) && unit.depMode === 'wait' && unit.deps.length > 0);

const allMerged = (state: ManagerState, deps: readonly string[]) => deps.every((dep) => state.units[dep]?.state === 'merged');

const openQuestionOf = (state: ManagerState, unitId: string) =>
  Object.entries(state.questions).find(([, question]) => question.unit === unitId && question.answer === undefined)?.[0];

const statusTable = (state: ManagerState) => {
  const rows = orderedUnits(state).map(([id, unit]) =>
    [
      id, unit.state, unit.kind, `${unit.model}/${unit.effort}`, [unit.branch, unit.pr].filter(Boolean).join(' ') || '-',
      unit.attended ? 'yes' : 'no', openQuestionOf(state, id) ?? '-',
    ].join(' | '),
  );

  return ['unit | state | kind | model/effort | branch/PR | attended | question', ...rows];
};

const statusReport = (state: ManagerState, limits: ManagerLimits) => {
  const released = activeWaiters(state)
    .filter(([id, unit]) => allMerged(state, unit.deps) && !state.released.includes(id))
    .map(([id]) => id);
  const offered = Object.entries(state.backlog)
    .filter(([, entry]) => entry.state === 'open' && (state.lastFinished > entry.lastOffered || entry.raised > entry.lastOffered))
    .map(([id]) => id);
  const units = orderedUnits(state);
  const attention = [
    ...Object.entries(state.questions)
      .filter(([, question]) => question.answer === undefined)
      .map(([id, question]) => `question ${id} ${question.unit}: ${question.text}`),
    ...units.filter(([, unit]) => unit.state === 'running' && unit.misses >= 1).map(([id, unit]) => `stale ${id}: ${rungOf(unit.misses)}`),
    ...units.filter(([, unit]) => unit.state === 'pr').map(([id, unit]) => `merge-yes ${id}: ${unit.pr}`),
    ...startableUnits(state, limits.parallel).map((id) => `start ${id}`),
    ...activeWaiters(state)
      .filter(([, unit]) => !allMerged(state, unit.deps))
      .flatMap(([id, unit]) => unit.deps.filter((dep) => state.units[dep]?.state !== 'merged').map((dep) => `hold ${id}: implementation waits for ${dep}`)),
    ...released.map((id) => `release ${id}: ${state.units[id]?.deps.join(', ')} merged, update onto the new base`),
    ...units
      .filter(([, unit]) => unit.state === 'paused' && unit.pausedBy !== null && state.units[unit.pausedBy]?.state === 'merged')
      .map(([id, unit]) => `resume ${id}: ${unit.pausedBy} merged`),
    ...(state.usage !== null && state.usage >= limits.usage ? [`usage ${state.usage}%: ask owner before starting queued units`] : []),
    ...offered.map((id) => `re-offer ${id}: ${state.backlog[id]?.title}`),
    ...Object.entries(state.questions)
      .filter(([, question]) => question.by === 'manager' && (question.answeredAt ?? -1) > state.lastStatus)
      .map(([id, question]) => `answered ${id} ${question.unit} by manager: ${question.answer} (basis ${question.basis})`),
  ];
  const attentionText = attention.length === 0 ? 'attention: none' : ['attention:', ...attention.map((line) => `- ${line}`)].join('\n');

  return { text: `${[...statusTable(state), attentionText].join('\n')}\n`, released, offered };
};

const renderStatus = (state: ManagerState, limits: ManagerLimits) => statusReport(state, limits).text;

const nonEmptyFlag = (context: Context, name: string) => {
  const value = flagText(context, name)?.trim();
  if (value === undefined || value === '') throw new CliError(1, `--${name} must not be empty`, false);

  return value;
};

const enumFlag = (context: Context, name: string, allowed: readonly string[]) => {
  const value = flagText(context, name);
  if (value !== undefined && !allowed.includes(value)) throw new CliError(1, `invalid --${name} "${value}": expected ${allowed.join('|')}`, false);

  return value;
};

const existingUnit = (state: ManagerState, id: string) => {
  const unit = state.units[id];
  if (unit === undefined) throw new CliError(1, `unknown unit "${id}"`, false);

  return unit;
};

const nextId = (prefix: string, existing: Record<string, unknown>) => `${prefix}${Object.keys(existing).length + 1}`;

const managerStartCommand: Command = {
  name: 'manager start',
  usage: 'manager start   (creates or opens {output}/_manager/, records the cwd, prints heartbeat and status)',
  arguments: 0,
  flags: [],
  required: [],
  async run(context) {
    const paths = managerPaths(context);
    const cwd = realPathOrSelf(context.cwd);
    let state = loadManagerState(paths);
    if (state !== undefined) refuseFromUnit(state, context.cwd);
    if (state === undefined) {
      await mkdir(paths.dir, { recursive: true });
      await writeFile(paths.decisions, '# Manager decisions\n');
    }
    if (state?.cwd !== cwd) state = await recordManagerEvent(paths, { type: 'start', cwd });

    writeOut(`heartbeat: ${managerLimits(context).heartbeat}m\n${renderStatus(state, managerLimits(context))}`);
  },
};

const parsePresets = (raw: readonly string[]) =>
  Object.fromEntries(
    raw.map((preset) => {
      const separator = preset.indexOf('=');
      if (separator < 1) throw new CliError(1, `invalid --preset "${preset}": expected key=value`, false);

      return [preset.slice(0, separator), preset.slice(separator + 1)];
    }),
  );

const playbookFlag = (context: Context, kind: string) => {
  const raw = flagText(context, 'playbook');
  if (kind !== 'playbook') {
    if (raw !== undefined) throw new CliError(1, '--playbook only goes with --kind playbook', false);

    return undefined;
  }

  const playbook = raw?.replace(/^agentic-/, '');
  if (playbook === undefined || !playbooks.includes(playbook)) {
    throw new CliError(1, `--kind playbook needs --playbook ${playbooks.join('|')}`, false);
  }

  return playbook;
};

const unitStepKey = (kind: string, playbook: string | undefined) => {
  if (kind === 'sidequest') return 'unit.sidequest';

  return playbook === undefined ? 'unit' : `unit.${playbook}`;
};

const unitAddCommand: Command = {
  name: 'manager unit add',
  usage:
    'manager unit add <id> --title t --kind playbook|free|sidequest|adopted [--playbook p] [--input t] [--model m] [--effort e] [--deps a,b --dep-mode wait|stacked] [--preset k=v]... [--for unit]',
  arguments: 1,
  flags: ['title', 'kind', 'playbook', 'input', 'model', 'effort', 'deps', 'dep-mode', 'for'],
  lists: ['preset'],
  required: ['title', 'kind'],
  async run(context) {
    const [id = ''] = context.positionals;
    const { paths, state } = requireManager(context);
    if (!unitIdShape.test(id)) throw new CliError(1, `invalid unit id "${id}": expected ${unitIdShape.source}`, false);
    if (id === 'none') throw new CliError(1, 'unit id "none" is reserved', false);
    if (state.units[id] !== undefined) throw new CliError(1, `unit "${id}" already exists`, false);

    const title = nonEmptyFlag(context, 'title');
    const kind = enumFlag(context, 'kind', unitKinds) ?? '';
    const playbook = playbookFlag(context, kind);
    const deps = (flagText(context, 'deps') ?? '').split(',').map((dep) => dep.trim()).filter(Boolean);
    for (const dep of deps) existingUnit(state, dep);

    const depMode = enumFlag(context, 'dep-mode', depModes);
    if (deps.length > 0 && depMode === undefined) throw new CliError(1, '--deps needs --dep-mode wait|stacked', false);

    const raiser = flagText(context, 'for');
    if (raiser !== undefined) existingUnit(state, raiser);

    const presets = parsePresets(flagList(context, 'preset'));
    const resolved = resolveTier(loadStepConfig(context, mainCheckout(context.cwd)), 'claude', unitStepKey(kind, playbook));
    const model = flagText(context, 'model') ?? resolved.model;
    const effort = flagText(context, 'effort') ?? resolved.effort;

    await recordManagerEvent(paths, {
      type: 'unit-add', id, title, kind, playbook, input: flagText(context, 'input'), model, effort, deps, depMode: deps.length > 0 ? depMode : undefined,
      presets, for: raiser,
    });
    writeOut(`unit ${id} queued model ${model} effort ${effort}\n`);
  },
};

const unitSetCommand: Command = {
  name: 'manager unit set',
  usage:
    'manager unit set <id> [--state queued|running|waiting|paused|pr|merged|done|failed] [--session s] [--path dir] [--branch b] [--pr url] [--model m] [--effort e] [--attended true|false] [--paused-by unit] [--summary t]',
  arguments: 1,
  flags: ['state', 'session', 'path', 'branch', 'pr', 'model', 'effort', 'attended', 'paused-by', 'summary'],
  required: [],
  async run(context) {
    const [id = ''] = context.positionals;
    const { paths, state } = requireManager(context);
    existingUnit(state, id);

    const path = flagText(context, 'path');
    const pausedBy = flagText(context, 'paused-by');
    if (pausedBy !== undefined) existingUnit(state, pausedBy);

    const attended = enumFlag(context, 'attended', ['true', 'false']);
    const changes: Record<string, unknown> = {
      state: enumFlag(context, 'state', unitStates),
      session: flagText(context, 'session'),
      path: path === undefined ? undefined : realPathOrSelf(resolve(context.cwd, path)),
      branch: flagText(context, 'branch'),
      pr: flagText(context, 'pr'),
      model: flagText(context, 'model'),
      effort: flagText(context, 'effort'),
      attended: attended === undefined ? undefined : attended === 'true',
      pausedBy,
      summary: flagText(context, 'summary'),
    };
    const given = Object.entries(changes).filter(([, value]) => value !== undefined);
    if (given.length === 0) throw new CliError(2, 'manager unit set needs at least one field flag');

    await recordManagerEvent(paths, { type: 'unit-set', id, ...Object.fromEntries(given) });
    writeOut(`unit ${id} updated: ${given.map(([key]) => key).join(', ')}\n`);
  },
};

const briefCommand: Command = {
  name: 'manager brief',
  usage: 'manager brief <id>   (prints the start_session parameters line and the exact prompt)',
  arguments: 1,
  flags: [],
  required: [],
  async run(context) {
    const [id = ''] = context.positionals;
    const { state } = requireManager(context);
    const { startLine, prompt } = renderBrief(state, id);

    writeOut(`${startLine}\n--- prompt ---\n${prompt}\n`);
  },
};

const questionOpenCommand: Command = {
  name: 'manager question open',
  usage: 'manager question open <unit> --text t [--option o]...',
  arguments: 1,
  flags: ['text'],
  lists: ['option'],
  required: ['text'],
  async run(context) {
    const [unit = ''] = context.positionals;
    const { paths, state } = requireManager(context);
    existingUnit(state, unit);

    const id = nextId('Q', state.questions);
    await recordManagerEvent(paths, { type: 'question-open', id, unit, text: nonEmptyFlag(context, 'text'), options: flagList(context, 'option') });
    writeOut(`${id}\n`);
  },
};

const basisHolds = (state: ManagerState, question: ManagerQuestion, basis: string) => {
  if (/^R\d+$/.test(basis)) return state.rules[basis] !== undefined;
  if (/^Q\d+$/.test(basis)) return state.questions[basis]?.answer !== undefined;
  if (basis.startsWith('preset:')) return state.units[question.unit]?.presets[basis.slice('preset:'.length)] !== undefined;

  return false;
};

const decisionEntry = (id: string, question: ManagerQuestion, answer: string, by: string, basis: string | undefined) =>
  `\n## ${id} · ${question.unit} · ${by}\n**Q:** ${question.text}\n**A:** ${answer}\n**Basis:** ${basis ?? 'owner'}\n`;

const questionAnswerCommand: Command = {
  name: 'manager question answer',
  usage: 'manager question answer <Qn> --answer a --by user|manager [--basis R<n>|Q<n>|preset:<key>]   (basis required for manager)',
  arguments: 1,
  flags: ['answer', 'by', 'basis'],
  required: ['answer', 'by'],
  async run(context) {
    const [id = ''] = context.positionals;
    const { paths, state } = requireManager(context);
    const question = state.questions[id];
    if (question === undefined) throw new CliError(1, `unknown question "${id}"`, false);
    if (question.answer !== undefined) throw new CliError(1, `${id} is already answered`, false);

    const answer = nonEmptyFlag(context, 'answer');
    const by = enumFlag(context, 'by', answerers) ?? '';
    const basis = flagText(context, 'basis');
    if (by === 'manager' && (basis === undefined || !basisHolds(state, question, basis))) {
      throw new CliError(1, `a manager answer needs --basis: an existing R<n>, an answered Q<n>, or preset:<key> of unit ${question.unit}`, false);
    }

    await recordManagerEvent(paths, { type: 'question-answer', id, answer, by, basis });
    if (!existsSync(paths.decisions)) await writeFile(paths.decisions, '# Manager decisions\n');
    await appendFile(paths.decisions, decisionEntry(id, question, answer, by, basis));
    writeOut(`${id} answered by ${by}\n`);
  },
};

const ruleAddCommand: Command = {
  name: 'manager rule add',
  usage: 'manager rule add <text>   (standing owner rule, usable as auto-answer basis)',
  arguments: 1,
  flags: [],
  required: [],
  async run(context) {
    const [text = ''] = context.positionals;
    const { paths, state } = requireManager(context);
    if (text.trim() === '') throw new CliError(1, 'rule text must not be empty', false);

    const id = nextId('R', state.rules);
    await recordManagerEvent(paths, { type: 'rule-add', id, text });
    writeOut(`${id}\n`);
  },
};

const backlogAddCommand: Command = {
  name: 'manager backlog add',
  usage: 'manager backlog add --title t --from unit [--context c] [--ticket url]',
  arguments: 0,
  flags: ['title', 'from', 'context', 'ticket'],
  required: ['title', 'from'],
  async run(context) {
    const { paths, state } = requireManager(context);
    const title = nonEmptyFlag(context, 'title');
    const from = nonEmptyFlag(context, 'from');
    existingUnit(state, from);

    const id = nextId('B', state.backlog);
    await recordManagerEvent(paths, { type: 'backlog-add', id, title, from, context: flagText(context, 'context'), ticket: flagText(context, 'ticket') });
    writeOut(`${id}\n`);
  },
};

const backlogSetCommand: Command = {
  name: 'manager backlog set',
  usage: 'manager backlog set <Bn> [--state open|started|dropped] [--ticket url] [--from unit]',
  arguments: 1,
  flags: ['state', 'ticket', 'from'],
  required: [],
  async run(context) {
    const [id = ''] = context.positionals;
    const { paths, state } = requireManager(context);
    if (state.backlog[id] === undefined) throw new CliError(1, `unknown backlog entry "${id}"`, false);

    const from = flagText(context, 'from');
    if (from !== undefined) existingUnit(state, from);

    const changes = { state: enumFlag(context, 'state', backlogStates), ticket: flagText(context, 'ticket'), from };
    if (Object.values(changes).every((value) => value === undefined)) throw new CliError(2, 'manager backlog set needs --state, --ticket or --from');

    await recordManagerEvent(paths, { type: 'backlog-set', id, ...changes });
    writeOut(`${id} updated\n`);
  },
};

const parseSeen = (state: ManagerState, raw: readonly string[]) =>
  Object.fromEntries(
    raw.map((entry) => {
      const separator = entry.indexOf('=');
      const marker = entry.slice(separator + 1);
      if (separator < 1 || marker === '') throw new CliError(1, `invalid --seen "${entry}": expected <unit>=<marker>`, false);
      existingUnit(state, entry.slice(0, separator));

      return [entry.slice(0, separator), marker];
    }),
  );

const parseUsage = (context: Context) => {
  const raw = flagText(context, 'usage');
  if (raw === undefined) return undefined;

  const usage = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(usage) || usage < 0 || usage > 100) throw new CliError(1, `invalid --usage "${raw}": expected 0-100`, false);

  return usage;
};

const beatCommand: Command = {
  name: 'manager beat',
  usage: 'manager beat [--seen <unit>=<marker>]... [--usage pct]   (per unit: ok | nudge | stop-resume | ask)',
  arguments: 0,
  flags: ['usage'],
  lists: ['seen'],
  required: [],
  async run(context) {
    const { paths, state } = requireManager(context);
    const seen = parseSeen(state, flagList(context, 'seen'));
    const usage = parseUsage(context);

    const next = await recordManagerEvent(paths, { type: 'beat', seen, usage });
    const seenLines = Object.keys(seen).map((id) => {
      const unit = existingUnit(next, id);

      return unit.state === 'running' ? `${id} ${rungOf(unit.misses)} (misses ${unit.misses})` : `${id} idle ${unit.state}`;
    });
    const unseenLines = orderedUnits(next)
      .filter(([id, unit]) => unit.state === 'running' && !Object.hasOwn(seen, id))
      .map(([id]) => `${id} unseen`);
    const { usage: limit } = managerLimits(context);
    const usageLines =
      usage !== undefined && usage >= limit
        ? [`usage ${usage}% >= ${limit}%: ask owner before starting queued units (continue / pause queue / downgrade models)`]
        : [];

    writeOut(`${[...seenLines, ...unseenLines, ...usageLines].join('\n')}\n`);
  },
};

const statusManagerCommand: Command = {
  name: 'manager status',
  usage: 'manager status   (unit table and attention list; records a status event)',
  arguments: 0,
  flags: [],
  required: [],
  async run(context) {
    const { paths, state } = requireManager(context);
    const { text, released, offered } = statusReport(state, managerLimits(context));

    await recordManagerEvent(paths, { type: 'status', released, offered });
    writeOut(text);
  },
};

const managerCompactText = (context: Context, cwd: string) => {
  const state = hookManagerState(context);
  if (state === undefined) return undefined;
  if (isManagerCwd(state, cwd)) return renderStatus(state, managerLimits(context));

  const match = unitAt(state, cwd);

  return match === undefined || match.unit.attended ? undefined : relayProtocol(match.id, false);
};

const hookAskCommand: Command = {
  name: 'hook ask',
  usage: 'hook ask [--harness claude]   (reads the harness hook payload on stdin)',
  arguments: 0,
  flags: ['harness'],
  required: [],
  async run(context) {
    const harness = flagText(context, 'harness') ?? 'claude';
    const adapter = hookAdapters[harness];
    if (adapter === undefined) throw new CliError(2, `invalid harness "${harness}": expected ${harnesses.join('|')}`);

    const payload = await readHookPayload();
    const tool = payload === undefined ? undefined : textOf(payload.tool_name);
    if (payload === undefined || (tool !== undefined && tool !== 'AskUserQuestion')) return;

    const state = hookManagerState(context);
    const cwd = hookCwd(context, payload);
    if (state === undefined || isManagerCwd(state, cwd)) return;

    const match = unitAt(state, cwd);
    if (match === undefined || match.unit.attended || isManagerCwd(state, match.path)) return;

    adapter.deny(
      `relayed unit ${match.id}: end your turn with the question block (\`Unit ${match.id}: question\`, numbered questions with options, recommended first); the manager relays it to the owner.`,
    );
  },
};

const commands: readonly Command[] = [
  startCommand,
  putCommand,
  gateCommand,
  mergeCommand,
  eventCommand,
  stateCommand,
  resumeCommand,
  decideCommand,
  stepCommand,
  reviewEligibleCommand,
  hubSyncCommand,
  cleanupCheckCommand,
  hookSpawnCommand,
  hookCompactCommand,
  hookAskCommand,
  hookSubagentStopCommand,
  managerStartCommand,
  unitAddCommand,
  unitSetCommand,
  briefCommand,
  questionOpenCommand,
  questionAnswerCommand,
  ruleAddCommand,
  backlogAddCommand,
  backlogSetCommand,
  beatCommand,
  statusManagerCommand,
];

const usageText = () =>
  [
    'usage: bun agentic.ts <command> [flags]',
    '',
    'commands:',
    ...commands.map((command) => `  ${command.usage}`),
    '',
    'global flag: --work <slug>   env: AGENTIC_OUTPUT (work item root override), AGENTIC_GH (gh binary), AGENTIC_RETRY_MS (retry base delay)',
    'exit codes: 0 ok, 1 validation/runtime failure, 2 usage error',
    '',
  ].join('\n');

const findCommand = (argv: readonly string[]) =>
  commands
    .filter((command) => command.name.split(' ').every((word, index) => argv[index] === word))
    .sort((left, right) => right.name.length - left.name.length)[0];

const parseCommandArgs = (command: Command, args: readonly string[]) => {
  const flagNames = [...command.flags, 'work'];

  try {
    return parseArgs({
      args: [...args],
      allowPositionals: true,
      strict: true,
      options: {
        ...Object.fromEntries(flagNames.map((flag) => [flag, { type: 'string' as const }])),
        ...Object.fromEntries((command.switches ?? []).map((flag) => [flag, { type: 'boolean' as const }])),
        ...Object.fromEntries((command.lists ?? []).map((flag) => [flag, { type: 'string' as const, multiple: true }])),
      },
    });
  } catch (err) {
    throw new CliError(2, err instanceof Error ? err.message : String(err));
  }
};

const dispatch = async (argv: readonly string[]) => {
  const command = findCommand(argv);
  if (command === undefined) throw new CliError(2, argv.length === 0 ? 'no command given' : `unknown command "${argv[0]}"`);

  const { values, positionals } = parseCommandArgs(command, argv.slice(command.name.split(' ').length));
  if (positionals.length !== command.arguments) {
    throw new CliError(2, `${command.name} expects ${command.arguments} argument(s), got ${positionals.length}`);
  }
  for (const flag of command.required) {
    if (values[flag] === undefined) throw new CliError(2, `missing required flag --${flag}`);
  }

  const context = { positionals, values, cwd: process.cwd(), env: process.env };
  const failure = await command.run(context).then(() => undefined, (err: unknown) => ({ err }));
  if (command.name !== 'hub sync') await syncHubAfterMilestones(context);
  if (failure !== undefined) throw failure.err;
};

const main = async (argv: readonly string[]) => {
  try {
    await dispatch(argv);

    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const exitCode = err instanceof CliError ? err.exitCode : 1;
    process.stderr.write(`${message}\n`);
    if (exitCode === 2 && (!(err instanceof CliError) || err.showUsage)) process.stderr.write(`\n${usageText()}`);

    return exitCode;
  }
};

process.exitCode = await main(process.argv.slice(2));
