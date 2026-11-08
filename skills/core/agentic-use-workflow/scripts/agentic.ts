#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
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

const listItemNames = async (root: string) => {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== '_archive' && !entry.name.startsWith('.'))
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

const appendEvent = async (item: WorkItem, event: object) => {
  const line = JSON.stringify(event);
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

const currentRun = (events: readonly StoredEvent[]) =>
  events.findLast((event) => isWorkflowLevel(event) && event.type === 'started' && !isCleanup(event));

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

const deriveUnits = (events: readonly StoredEvent[]) => {
  const units: Record<string, string> = {};
  for (const event of events) {
    const choice = event.type === 'decision' ? event.data.choice : undefined;
    if (isRecord(choice) && typeof choice.key === 'string' && choice.key.startsWith('unit.') && choice.value === 'skip') {
      units[choice.key.slice('unit.'.length)] = 'skipped';
      continue;
    }
    if (event.workflow !== 'implement' || event.task === undefined) continue;

    if (event.type === 'started' && event.step === 'implement') units[event.task] = 'in_progress';
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

const deriveStatus = (events: readonly StoredEvent[], escalations: WorkState['escalations']) => {
  const archived = events.some((event) => isCleanup(event) && event.type === 'completed' && (isWorkflowLevel(event) || event.step === 'cleanup'));
  if (archived) return 'archived';
  if (escalations.some((escalation) => escalation.status === 'open')) return 'awaiting_decision';

  const latestFailed = events.findLast((event) => event.type === 'failed');
  if (latestFailed?.data.blocked === true) return 'blocked';

  const latest = events.findLast((event) => isWorkflowLevel(event) && !isCleanup(event));
  if (latest?.type === 'failed') return 'failed';
  if (latest?.type === 'completed' && (latest.workflow === 'babysit-pr' || playbooks.includes(latest.workflow))) return 'done';

  return 'in_progress';
};

const recordField = (source: Record<string, unknown>, key: string) => {
  const value = source[key];

  return isRecord(value) ? value : {};
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
      data: title === undefined ? undefined : { title },
    });
    if (result.event === undefined) throw failValidation(result.errors);

    await appendEvent(item, result.event);
    await writeState(item);
    writeOut(`run ${result.event.run}\n`);
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
    const run = currentRun(await readEvents(item));
    const dataFlag = parseDataFlag(flagText(context, 'data'));

    const result = validateEvent(
      {
        ts: flagText(context, 'ts') ?? nowTimestamp(),
        work: item.name,
        run: flagText(context, 'run') ?? run?.run,
        harness: flagText(context, 'harness') ?? run?.harness,
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
        data: dataFlag.data,
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

const openStep = (events: readonly StoredEvent[]) => {
  const open = new Map<string, StoredEvent>();
  for (const event of events) {
    if (event.step === null) continue;

    const key = `${event.workflow}|${event.step}|${event.task ?? ''}`;
    if (event.type === 'started') open.set(key, event);
    if (event.type === 'completed' || event.type === 'failed') open.delete(key);
  }

  return [...open.values()].at(-1);
};

const describeStep = (event: StoredEvent | undefined) => {
  if (event === undefined) return 'none';

  const unit = [event.task, event.agent === undefined ? undefined : `(${event.agent})`].filter(Boolean).join(' ');

  return [event.step, unit, `started: ${event.summary}`].filter(Boolean).join(' ');
};

const nextCommand = (item: WorkItem, state: WorkState, pending: readonly string[]) => {
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

const mergeBackBlocks = (events: readonly StoredEvent[]) => {
  const run = currentRun(events)?.run;
  const inRun = events.filter((event) => event.run === run);
  const pending = inRun.flatMap((event, index) => {
    const worktree = event.type === 'started' ? unitWorktree(event) : undefined;
    const merged = inRun
      .slice(index + 1)
      .some((later) => later.step === 'checks' && later.type === 'completed' && later.task === event.task);

    return worktree === undefined || merged ? [] : [worktree];
  });
  if (pending.length === 0) return ['merge-back: none'];

  return [
    'merge-back:',
    ...pending.flatMap(({ path, branch }) => [`  git merge --no-ff ${branch}`, `  git worktree remove ${path}`, `  git branch -d ${branch}`]),
  ];
};

const resumeText = (item: WorkItem, events: readonly StoredEvent[]) => {
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
    ...mergeBackBlocks(events),
    `next: ${nextCommand(item, state, pending)}`,
  ];

  return lines.map(resumeLine).join('\n');
};

const resumeCommand: Command = {
  name: 'resume',
  usage: 'resume [--work <slug>]',
  arguments: 0,
  flags: [],
  required: [],
  async run(context) {
    const item = await resolveWorkItem(context, { allowCreate: false });
    writeOut(`${resumeText(item, await readEvents(item))}\n`);
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
    const result = validateEvent(
      {
        ts: nowTimestamp(),
        work: item.name,
        run: run?.run,
        harness: run?.harness,
        workflow: run?.workflow,
        step: flagText(context, 'step') ?? (openGrill?.workflow.startsWith('grill-') ? openGrill.step ?? undefined : undefined),
        type: 'decision',
        summary: `${id}: ${question.slice(0, maxSummaryQuestion)}`,
        data: { id, question, answer, tag, focus, ...optionalField('supersedes', supersedes) },
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
const frontierHigh: Builtin = { tier: 'frontier', effort: 'high' };

const exampleProjectReviewerSteps: Readonly<Record<string, Builtin>> = {
  'review.review-access-tenant-isolation': frontierHigh,
};

const builtinSteps: Readonly<Record<string, Builtin>> = {
  implement: codeMedium,
  explore: { ...codeMedium, routing: 'explore' },
  tickets: codeMedium,
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
  const model = textOf(own?.model) ?? textOf(parent?.model) ?? (builtin && builtinModel(harness, builtin)) ?? 'default';
  const effort = textOf(own?.effort) ?? textOf(parent?.effort) ?? builtin?.effort ?? 'default';
  if (oneMillionModel.test(model)) throw new CliError(1, `model "${model}": 1M is an orchestrator session setting, not a step model`);

  return { model, effort };
};

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
  const branch = `${workspace.branch}/${unit}`;
  const path = join(base, `${itemName}-${unit}`);

  return { path, branch, command: `git worktree add -b ${branch} ${path} ${workspace.branch}` };
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
    const run = currentRun(await readEvents(item));
    const harness = flagText(context, 'harness') ?? run?.harness ?? 'claude';
    if (!harnesses.includes(harness)) throw new CliError(1, `invalid harness "${harness}": expected ${harnesses.join('|')}`);

    const root = mainCheckout(context.cwd);
    const config = loadStepConfig(context, root);
    const { model, effort } = resolveTier(config, harness, key);
    const unit = flagText(context, 'unit');
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
      ...(unitTree && { data: { worktree: { path: unitTree.path, branch: unitTree.branch } } }),
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
        model,
        effort,
        skills: skills.join(', '),
        workspace: unitTree?.path ?? workspace ?? gitOutput(context.cwd, ['rev-parse', '--show-toplevel'])?.trim() ?? context.cwd,
      },
      readOnlySteps.includes(key.split('.')[0] ?? ''),
    );

    await appendEvent(item, result.event);
    await writeState(item);
    const worktreeLine = unitTree ? `worktree: ${unitTree.command}\n` : '';
    writeOut(`${brief}${worktreeLine}next: ${spawnHint(harness, model, effort)}\n`);
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
      const securityChanged = firstGlobMatch(gates.security?.paths ?? defaultSecurityPaths, diffPaths(root, base));
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

    if (widen) {
      const item = await resolveWorkItem(context, { allowCreate: false });
      const run = currentRun(await readEvents(item));
      const result = validateEvent({
        ts: nowTimestamp(),
        work: item.name,
        run: run?.run,
        harness: run?.harness,
        workflow: run?.workflow,
        step: 'review',
        type: 'note',
        summary: `review eligible --all: ${reason}`,
        data: { reason },
      });
      if (result.event === undefined) throw failValidation(result.errors);
      await appendEvent(item, result.event);
      await writeState(item);
    }

    const reviewers = gates.entries
      .filter((entry, index, all) => picked.has(entry.name) && all.findIndex((other) => other.name === entry.name) === index)
      .map((entry) => ({ name: entry.name, reason: picked.get(entry.name) }));
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

const hubSyncCommand: Command = {
  name: 'hub sync',
  usage: 'hub sync [--run <id>] [--model <name>] [--work <slug>]',
  arguments: 0,
  flags: ['run', 'model'],
  required: [],
  async run(context) {
    const item = await resolveWorkItem(context, { allowCreate: false });
    const { hub } = await writeState(item);
    if (hub === null) {
      writeOut('skipped: no hub (log a choice decision with key hub or an artifact event with data.hub)\n');

      return;
    }
    if (!ghAvailable(context.env)) {
      writeOut('skipped: gh not found (hub sync is GitHub-only)\n');

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
      writeOut(`${action} ${part.marker} (${part.body.length} chars)\n`);
    }
  },
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
  claude: ['Agent'],
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

const isOpenRun = (events: readonly StoredEvent[]) => {
  const started = events.findLastIndex((event) => isWorkflowLevel(event) && event.type === 'started' && !isCleanup(event));
  if (started < 0) return false;

  const run = events[started]?.run;

  return !events
    .slice(started + 1)
    .some((event) => isWorkflowLevel(event) && !isCleanup(event) && event.run === run && ['completed', 'failed'].includes(event.type));
};

const safeEvents = async (item: WorkItem) => {
  try {
    return await readEvents(item);
  } catch {
    return [];
  }
};

const findHookItem = async (context: Context, cwd: string) => {
  if (flagText(context, 'work') !== undefined) return resolveWorkItem(context, { allowCreate: false });

  const root = outputRoot(context);
  const here = realPathOrSelf(cwd);
  const main = realPathOrSelf(mainCheckout(context.cwd));

  for (const name of await listItemNames(root)) {
    const item = { name, dir: join(root, name) };
    const events = await safeEvents(item);
    if (!isOpenRun(events)) continue;

    const path = textOf(deriveState(name, events).workspace?.path);
    if (realPathOrSelf(path ?? main) === here) return item;
  }

  return undefined;
};

const briefLine = (brief: string, label: string) => new RegExp(`^[ \\t]*${label}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(brief)?.[1];

const isArchivedPath = (path: string) => path.split(/[\\/]/).includes('_archive');

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

    const item = await findHookItem(context, hookCwd(context, payload));
    const brief = adapter.prompt(payload);
    if (item === undefined || brief === undefined || /^[ \t]*Work item:[ \t]*none\b/m.test(brief)) return;

    const events = await safeEvents(item);
    const { missing, step, agent, workItem } = checkBrief(brief, events);
    if (missing.length === 0) return;

    await traceBlocked(workItem, { harness, fallbackWorkflow: currentRun(events)?.workflow ?? 'implement', missing, agent });

    const fix = `bun ${join(import.meta.dir, 'agentic.ts')} step ${step || '<step>'} --unit <task> --agent ${agent || '<label>'} --work ${item.name}`;
    const message = [
      `spawn blocked, brief is missing: ${missing.join(', ')} (Progress: may be replaced by the word read-only)`,
      `fix: run \`${fix}\` and paste its output as the prompt${expectedTier(context, harness, step)}`,
    ].join('\n');

    adapter.deny(message);
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

    const item = await findHookItem(context, hookCwd(context, payload));
    if (item === undefined) return;

    const output = adapter(payload, resumeText(item, await safeEvents(item)));
    if (output !== undefined) writeOut(`${output}\n`);
  },
};

const commands: readonly Command[] = [
  startCommand,
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

  await command.run({ positionals, values, cwd: process.cwd(), env: process.env });
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
