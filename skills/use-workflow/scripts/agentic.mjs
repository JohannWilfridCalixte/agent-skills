#!/usr/bin/env node
// Local contract checks and artifact helpers. No network, model calls, or Git mutations.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const text = v => typeof v === 'string' && v.trim().length > 0;
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const strings = v => Array.isArray(v) && v.every(text);
const unique = values => [...new Set(values)];
const readJSON = file => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`${file}: expected JSON (also the supported YAML 1.2 subset): ${error.message}`); }
};
const fail = errors => { if (errors.length) throw new Error(errors.join('\n')); };
const walk = dir => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.isFile() ? [path.join(dir, e.name)] : []);
const inside = (root, target) => { const p = path.relative(root, target); return p === '' || (!p.startsWith('..' + path.sep) && p !== '..' && !path.isAbsolute(p)); };

export function safeRelative(root, relative) {
  if (!text(relative) || path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative) || relative.includes('\\') || /[\x00-\x1f]/.test(relative)
    || relative.split('/').some(p => p === '..' || p === '') || relative === '.') throw new Error(`Invalid relative path: ${relative}`);
  const base = fs.realpathSync(root), resolved = path.resolve(base, relative);
  if (!inside(base, resolved)) throw new Error(`Path outside repository: ${relative}`);
  let existing = resolved;
  while (!fs.existsSync(existing)) { const parent = path.dirname(existing); if (parent === existing) break; existing = parent; }
  if (!inside(base, fs.realpathSync(existing))) throw new Error(`Symlink path escapes repository: ${relative}`);
  return resolved;
}

function globMatch(pattern, value) {
  // Deliberately small portable glob grammar: *, **, ?, no shell execution.
  if (/[{}[\]!]/.test(pattern)) throw new Error(`Unsupported glob syntax: ${pattern}`);
  if (!pattern.includes('/')) value = path.posix.basename(value);
  let result = '^';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      i++; if (pattern[i + 1] === '/') { result += '(?:.*/)?'; i++; } else result += '.*';
    } else if (ch === '*') result += '[^/]*';
    else if (ch === '?') result += '[^/]';
    else result += ch.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  }
  return new RegExp(result + '$').test(value);
}

export function resolveConfig(config, task) {
  if (!record(config) || !record(task)) throw new Error('Config and task must be objects');
  const root = task.root || process.cwd(), host = task.host || 'unknown';
  const namespace = config.namespace ?? 'agentic';
  if (!/^[a-z][a-z0-9-]{1,29}$/.test(namespace)) throw new Error('Invalid namespace');
  const configFields = ['namespace', 'version', 'lastUpdate', 'workflows', 'profiles', 'selectedProfiles', 'ides', 'specFolder', 'maxWorkers', 'issueClosePolicy'];
  for (const key of Object.keys(config)) if (!configFields.includes(key)) throw new Error(`Unsupported config field ${key}`);
  if (config.version !== undefined && (typeof config.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(config.version))) throw new Error('Invalid config version');
  if (config.lastUpdate !== undefined && (!text(config.lastUpdate) || !Number.isFinite(Date.parse(config.lastUpdate)))) throw new Error('Invalid config lastUpdate');
  if (config.workflows !== undefined && !strings(config.workflows)) throw new Error('workflows must be a string list');
  if (config.ides !== undefined && !record(config.ides)) throw new Error('ides must be an object');
  for (const [hostKey, settings] of Object.entries(config.ides ?? {})) {
    if (!['claude', 'codex', 'cursor'].includes(hostKey) || !record(settings)) throw new Error(`Invalid host config ${hostKey}`);
    for (const [key, value] of Object.entries(settings)) {
      if (!['outputFolder', 'highThinkingModelName', 'codeWritingModelName', 'qaModelName', 'explorationModelName', 'models'].includes(key)) throw new Error(`Unsupported host config field ${key}`);
      if (key !== 'models' && !text(value)) throw new Error(`Invalid host config ${key}`);
    }
    if (settings.models !== undefined && !record(settings.models)) throw new Error('models must be an object');
    for (const [roleKey, selection] of Object.entries(settings.models ?? {})) {
      if (!['high_thinking', 'code_writing', 'qa', 'exploration'].includes(roleKey) || !record(selection)) throw new Error(`Invalid model role ${roleKey}`);
      for (const [key, value] of Object.entries(selection)) if (!['model', 'effort'].includes(key) || (value !== null && !text(value))) throw new Error(`Invalid model/effort setting ${roleKey}.${key}`);
    }
  }
  for (const field of ['model', 'effort', 'default_model', 'default_effort']) if (task[field] !== undefined && task[field] !== null && !text(task[field])) throw new Error(`Invalid task ${field}`);
  for (const field of ['available_models', 'available_efforts', 'skills']) if (task[field] !== undefined && !strings(task[field])) throw new Error(`Invalid task ${field}`);
  const profiles = config.profiles ?? [], selected = config.selectedProfiles ?? [];
  if (!Array.isArray(profiles) || !strings(selected)) throw new Error('Invalid profiles/selectedProfiles');
  if (unique(profiles.map(p => p.name)).length !== profiles.length) throw new Error('Duplicate profile names');
  for (const p of profiles) {
    if (!text(p.name) || !strings(p.skills) || (p.detect !== undefined && !strings(p.detect))) throw new Error('Invalid profile shape');
    for (const g of p.detect ?? []) globMatch(g, '');
  }
  for (const n of selected) if (!profiles.some(p => p.name === n)) throw new Error(`Unknown selected profile: ${n}`);
  const paths = task.paths ?? []; if (!strings(paths)) throw new Error('Task paths must be a string list');
  for (const p of paths) safeRelative(root, p);
  const matched = unique([...selected, ...profiles.filter(p => (p.detect ?? []).some(g => paths.some(f => globMatch(g, f)))).map(p => p.name)]);
  const skills = [...matched.flatMap(n => profiles.find(p => p.name === n).skills), ...(task.skills ?? [])];
  if (paths.some(p => /\.[cm]?tsx?$/.test(p))) skills.push('agentic:skill:typescript-engineer');
  if (paths.some(p => /\.pyi?$/.test(p))) skills.push('agentic:skill:python-engineer');
  if (['implementation', 'test', 'debug', 'review-tests'].includes(task.kind)) skills.push('agentic:skill:code-testing');
  if (task.business_logic === true) skills.push('agentic:skill:clean-architecture');
  if (task.kind === 'instrumentation') skills.push('agentic:skill:write-instrumented-code');
  const ide = config.ides?.[host] ?? {}, role = task.role ?? 'high_thinking';
  const aliases = { high_thinking: 'highThinkingModelName', code_writing: 'codeWritingModelName', qa: 'qaModelName', exploration: 'explorationModelName' };
  if (!(role in aliases)) throw new Error(`Unknown model role: ${role}`);
  const setting = ide.models?.[role] ?? {};
  const highModel = ide.models?.high_thinking && Object.hasOwn(ide.models.high_thinking, 'model')
    ? ide.models.high_thinking.model : ide.highThinkingModelName;
  const configuredModel = Object.hasOwn(setting, 'model') ? setting.model : ide[aliases[role]] ?? (role === 'qa' ? highModel : undefined);
  let model = task.model ?? configuredModel ?? task.default_model ?? null;
  const configuredEffort = Object.hasOwn(setting, 'effort') ? setting.effort
    : role === 'qa' ? ide.models?.high_thinking?.effort : undefined;
  let effort = task.effort ?? configuredEffort ?? task.default_effort ?? null;
  const reasons = [];
  if (configuredModel == null && task.model == null) reasons.push('No model configured for this role; inherited host default');
  if (task.capabilities?.model_selection === false && model !== (task.default_model ?? null)) {
    reasons.push(`Host cannot select requested model ${model}; inherited host default`); model = task.default_model ?? null;
  } else if (model && task.available_models && !task.available_models.includes(model)) {
    reasons.push(`Requested model ${model} unavailable; inherited host default`); model = task.default_model ?? null;
  }
    if (task.capabilities?.effort_selection === false || (effort && task.available_efforts && !task.available_efforts.includes(effort))) {
    reasons.push(`Requested effort ${effort} unavailable; inherited host default`); effort = task.default_effort ?? null;
  }
  const output = ide.outputFolder ?? '_agentic_output', spec = config.specFolder ?? 'docs/specs';
  safeRelative(root, output); safeRelative(root, spec);
  if (config.maxWorkers !== undefined && (!Number.isInteger(config.maxWorkers) || config.maxWorkers < 1)) throw new Error('maxWorkers must be positive');
  if (config.issueClosePolicy !== undefined && !['merge', 'release', 'manual'].includes(config.issueClosePolicy)) throw new Error('Unknown issueClosePolicy');
  if (!strings(skills)) throw new Error('Skill identifiers must be strings');
  return { namespace, host, output_folder: output, spec_folder: spec, selected_profiles: matched,
    profile_provenance: matched.map(name => ({ name, reason: selected.includes(name) ? 'explicit' : 'detect',
      matches: (profiles.find(p => p.name === name).detect ?? []).flatMap(glob => paths.filter(p => globMatch(glob, p)).map(p => ({ glob, path: p }))) })),
    technical_skills_prompt: unique(skills), role, model, effort, fallback_reason: reasons.join('; ') || null,
    capabilities: task.capabilities ?? {}, max_workers: Math.min(config.maxWorkers ?? 3, task.capabilities?.max_workers ?? Infinity),
    issue_close_policy: config.issueClosePolicy ?? 'merge' };
}

export function validateLibrary(root) {
  const errors = [], warnings = [], skillRoot = path.join(root, 'skills');
  const dirs = fs.readdirSync(skillRoot, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
  const names = new Map(), dependencies = new Map();
  for (const dir of dirs) {
    const entry = path.join(skillRoot, dir, 'SKILL.md');
    if (!fs.existsSync(entry)) { errors.push(`${dir}: missing SKILL.md`); continue; }
    const body = fs.readFileSync(entry, 'utf8'), fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const name = fm?.[1].match(/^name:\s*(.+)$/m)?.[1], description = fm?.[1].match(/^description:\s*(.+)$/m)?.[1];
    if (!text(name) || !text(description) || description.length > 1024) errors.push(`${dir}: invalid name/description frontmatter`);
    if ([...names.values()].includes(name)) errors.push(`${dir}: duplicate skill name ${name}`);
    names.set(`skills/${dir}`, name);
    if (name && !/^[a-z][a-z0-9-]*$/.test(name)) warnings.push(`${dir}: namespaced legacy name retained; use the alias registry for strict hosts`);
    try {
      const manifest = readJSON(path.join(skillRoot, dir, 'agentic.json'));
      if (!Array.isArray(manifest.dependencies) || Object.keys(manifest).some(k => k !== 'dependencies')) errors.push(`${dir}: invalid manifest fields`);
      dependencies.set(`skills/${dir}`, manifest.dependencies ?? []);
    } catch (e) { errors.push(e.message); }
    for (const file of walk(path.join(skillRoot, dir)).filter(f => f.endsWith('.md'))) {
      const content = fs.readFileSync(file, 'utf8');
      if (/agentic:agent:|(?:\.\.\/)+agents\//.test(content)) errors.push(`${path.relative(root, file)}: persona runtime reference`);
      const prose = content.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
      for (const m of prose.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = m[1].split('#')[0];
        if (!target || /^(https?:|mailto:|#|\/)/.test(target) || /[{}<>]/.test(target) || /\bNNNN\b/.test(target)) continue;
        const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
        if (!fs.existsSync(resolved)) errors.push(`${path.relative(root, file)}: missing relative link ${target}`);
      }
      for (const m of prose.matchAll(/`((?:references|rules|steps)\/[\w./-]+\.(?:md|json|yaml))`/g)) {
        if (!fs.existsSync(path.join(skillRoot, dir, m[1]))) errors.push(`${path.relative(root, file)}: missing resource ${m[1]}`);
      }
    }
  }
  for (const [source, edges] of dependencies) for (const edge of edges) {
    if (!record(edge) || Object.keys(edge).some(k => !['name', 'type', 'path'].includes(k))) { errors.push(`${source}: invalid dependency fields`); continue; }
    if (edge.type !== 'skill') errors.push(`${source}: non-skill dependency ${edge.name}`);
    if (!names.has(edge.path)) errors.push(`${source}: missing dependency ${edge.path}`);
    else if (names.get(edge.path) !== edge.name) errors.push(`${source}: name mismatch ${edge.name} != ${names.get(edge.path)}`);
  }
  const visit = (node, chain = [], done = new Set()) => {
    if (chain.includes(node)) { errors.push(`Dependency cycle: ${[...chain, node].join(' -> ')}`); return; }
    if (done.has(node)) return; done.add(node);
    for (const e of dependencies.get(node) ?? []) visit(e.path, [...chain, node], done);
  };
  for (const p of names.keys()) visit(p);
  let protectedFiles = 0;
  const lockFile = path.join(root, 'tests/fixtures/protected-typescript.json');
  if (fs.existsSync(lockFile)) for (const [p, sha] of Object.entries(readJSON(lockFile))) {
    protectedFiles++; if (!fs.existsSync(path.join(root, p)) || hash(fs.readFileSync(path.join(root, p))) !== sha) errors.push(`Protected TypeScript changed: ${p}`);
  }
  if (fs.existsSync(path.join(root, 'agents'))) errors.push('Separate agents directory remains');
  const registryFile = path.join(root, 'skills/use-agentic/references/registry.json');
  if (fs.existsSync(registryFile)) {
    const registry = readJSON(registryFile);
    for (const entry of registry.skills ?? []) if (names.get(entry.path) !== entry.name) errors.push(`Registry mismatch: ${entry.path}`);
  }
  return { skills: dirs.length, protected_files: protectedFiles, errors: unique(errors), warnings: unique(warnings) };
}

export function planRevision(plan) {
  const { revision, ...semantic } = plan;
  return `sha256:${hash(canonical(semantic))}`;
}

export function validatePlan(plan, directory) {
  const errors = [];
  if (!record(plan)) return ['Plan must be an object'];
  if (plan.schema_version !== 1 || !text(plan.spec_id)) errors.push('Plan needs schema_version 1 and spec_id');
  if (!Array.isArray(plan.requirements) || !plan.requirements.length || !Array.isArray(plan.tickets) || !plan.tickets.length) return [...errors, 'Plan needs nonempty requirements and tickets'];
  const requirements = plan.requirements, tickets = plan.tickets, ids = tickets.map(t => t.id), requirementIds = requirements.map(r => r.id);
  if (unique(ids).length !== ids.length) errors.push('Duplicate ticket IDs');
  if (unique(requirementIds).length !== requirementIds.length) errors.push('Duplicate requirement IDs');
  for (const r of requirements) if (!/^AC-[A-Za-z0-9-]+$/.test(r.id) || !text(r.text) || !['active', 'deferred'].includes(r.status)) errors.push(`Invalid requirement ${r.id}`);
  for (const t of tickets) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(t.id) || !text(t.title) || !text(t.path)) errors.push(`Invalid ticket identity ${t.id}`);
    for (const f of ['blocked_by', 'requirements', 'files', 'acceptance']) if (!strings(t[f])) errors.push(`${t.id}: ${f} must be a string list`);
    if (!t.requirements?.length || !t.acceptance?.length || !t.files?.length) errors.push(`${t.id}: empty requirements, files or acceptance`);
    for (const dep of t.blocked_by ?? []) if (!ids.includes(dep)) errors.push(`${t.id}: unknown dependency ${dep}`);
    for (const r of t.requirements ?? []) if (!requirementIds.includes(r)) errors.push(`${t.id}: unknown requirement ${r}`);
    for (const f of t.files ?? []) if (path.isAbsolute(f) || f.split('/').includes('..') || /[*?]/.test(f)) errors.push(`${t.id}: owned files must be exact relative paths: ${f}`);
    if (t.status !== undefined) errors.push(`${t.id}: runtime status belongs in workflow state`);
  }
  const ancestors = id => {
    const seen = new Set(), active = new Set();
    const visit = n => { if (active.has(n)) { errors.push(`Ticket cycle at ${n}`); return; } if (seen.has(n)) return; active.add(n);
      for (const d of tickets.find(t => t.id === n)?.blocked_by ?? []) { visit(d); seen.add(d); } active.delete(n); };
    visit(id); return seen;
  };
  const predecessor = new Map(ids.map(id => [id, ancestors(id)]));
  for (let i = 0; i < tickets.length; i++) for (let j = i + 1; j < tickets.length; j++) {
    const a = tickets[i], b = tickets[j];
    if ((a.files ?? []).some(f => (b.files ?? []).some(g => path.posix.normalize(g) === path.posix.normalize(f)))
      && !predecessor.get(a.id)?.has(b.id) && !predecessor.get(b.id)?.has(a.id)) errors.push(`Unordered file overlap: ${a.id} and ${b.id}`);
  }
  for (const r of requirements.filter(r => r.status === 'active')) if (!tickets.some(t => t.requirements?.includes(r.id))) errors.push(`Unassigned requirement ${r.id}`);
  if (plan.revision !== planRevision(plan)) errors.push('Plan revision does not match content');
  if (directory) {
    for (const p of [plan.prd, plan.technical_plan, ...tickets.map(t => t.path)]) {
      try {
        const f = safeRelative(directory, p), artifact = plan.artifacts?.find(a => a.path === p);
        if (!fs.existsSync(f) || !fs.readFileSync(f, 'utf8').trim()) errors.push(`Missing or empty plan artifact ${p}`);
        else if (!artifact || artifact.sha256 !== hash(fs.readFileSync(f))) errors.push(`Artifact hash changed or missing: ${p}`);
      } catch (e) { errors.push(e.message); }
    }
  }
  return unique(errors);
}

export function sealPlan(file) {
  const plan = readJSON(file), directory = path.dirname(path.resolve(file));
  plan.artifacts = unique([plan.prd, plan.technical_plan, ...(plan.tickets ?? []).map(t => t.path)]).map(p => ({ path: p, sha256: hash(fs.readFileSync(safeRelative(directory, p))) }));
  plan.revision = planRevision(plan); fail(validatePlan(plan, directory));
  atomicWrite(file, plan); return { path: file, revision: plan.revision, approved: false };
}

export function validateAcceptance(plan, receipt) {
  const errors = [];
  if (!record(receipt) || receipt.schema_version !== 1 || receipt.spec_id !== plan.spec_id) return ['Invalid acceptance receipt identity'];
  if (receipt.revision !== plan.revision) errors.push('Acceptance receipt is for a stale plan revision');
  if (!text(receipt.accepted_at) || !Number.isFinite(Date.parse(receipt.accepted_at))) errors.push('Acceptance needs an observed accepted_at timestamp');
  if (!Array.isArray(receipt.gates)) return [...errors, 'Acceptance needs gate receipts'];
  const gates = receipt.gates.filter(g => g.kind === 'plan_acceptance' && g.status === 'approved'
    && g.revision === plan.revision && text(g.evidence) && strings(g.scope));
  for (const ticket of plan.tickets) if (!gates.some(g => g.scope.includes(ticket.id)
    || ticket.requirements.every(id => g.scope.includes(id)))) errors.push(`Ticket ${ticket.id} has no current, evidenced plan acceptance`);
  return unique(errors);
}

const runStatuses = ['pending', 'in_progress', 'awaiting_input', 'blocked', 'escalated', 'completed', 'failed', 'cancelled'];
const ticketStatuses = ['pending', 'ready', 'in_progress', 'reviewing', 'ready_to_integrate', 'integrated', 'committed', 'blocked'];
export function validateState(state) {
  const errors = [];
  if (!record(state)) return ['State must be an object'];
  if (state.schema_version !== 2) errors.push('State schema_version must be 2; migrate legacy state explicitly');
  if (!Number.isSafeInteger(state.state_version) || state.state_version < 0) errors.push('state_version must be a nonnegative integer');
  for (const f of ['workflow', 'run_id', 'topic', 'output_path', 'started_at', 'updated_at']) if (!text(state[f])) errors.push(`State needs ${f}`);
  for (const f of ['started_at', 'updated_at']) if (!Number.isFinite(Date.parse(state[f]))) errors.push(`Invalid timestamp ${f}`);
  if (!record(state.repo) || !['root', 'branch', 'base_sha', 'head_sha'].every(f => text(state.repo[f]))) errors.push('repo needs root, branch, base_sha and head_sha');
  if (state.plan !== null && (!record(state.plan) || !text(state.plan.path) || !text(state.plan.revision)
    || (state.plan.accepted_revision !== null && !text(state.plan.accepted_revision)))) errors.push('Invalid plan binding');
  if (!runStatuses.includes(state.status)) errors.push(`Invalid run status ${state.status}`);
  if (!strings(state.technical_skills_prompt)) errors.push('technical_skills_prompt must be a string list');
  if (!Number.isInteger(state.current_step) || state.current_step < 1) errors.push('current_step must be a positive integer');
  for (const f of ['steps_completed', 'gates', 'decisions', 'checks']) if (!Array.isArray(state[f])) errors.push(`${f} must be a list`);
  for (const f of ['tickets', 'artifacts', 'requirements', 'review_loops', 'execution_context']) if (!record(state[f])) errors.push(`${f} must be an object`);
  if (['steps_completed', 'gates', 'decisions', 'checks'].some(f => !Array.isArray(state[f]))
    || ['tickets', 'artifacts', 'requirements', 'review_loops', 'execution_context'].some(f => !record(state[f]))) return errors;
  const steps = [];
  for (const step of state.steps_completed) {
    if (!record(step) || !Number.isInteger(step.step) || step.step < 1 || !text(step.name) || !Number.isFinite(Date.parse(step.completed_at))) errors.push('Invalid completed step receipt');
    steps.push(step?.step);
  }
  if (unique(steps).length !== steps.length) errors.push('Duplicate completed step receipts');
  for (const [id, t] of Object.entries(state.tickets ?? {})) {
    if (!record(t)) { errors.push(`${id}: ticket state must be an object`); continue; }
    if (!ticketStatuses.includes(t.status)) errors.push(`${id}: invalid ticket status`);
    if (t.owner !== null && !text(t.owner)) errors.push(`${id}: owner must be null or string`);
    if (['in_progress', 'reviewing'].includes(t.status) && !text(t.owner)) errors.push(`${id}: active ticket needs owner`);
    if (t.status === 'committed' && !/^[a-f0-9]{40,64}$/.test(t.commit ?? '')) errors.push(`${id}: committed ticket needs commit SHA`);
    if (state.plan && t.plan_revision !== state.plan.revision) errors.push(`${id}: stale ticket plan revision`);
  }
  const checkIds = [];
  for (const c of state.checks ?? []) {
    if (!record(c)) { errors.push('Check must be an object'); continue; }
    if (!text(c.id) || !text(c.command) || !text(c.revision) || !['passed', 'failed', 'unavailable'].includes(c.status)) errors.push('Invalid check record');
    if (!text(c.output_path) || !strings(c.requirements) || (state.plan && !text(c.plan_revision))) errors.push(`${c.id}: check needs output, requirements and plan revision`);
    if (c.status === 'passed' && c.exit_code !== 0) errors.push(`${c.id}: passed check must have exit_code 0`);
    if (c.status === 'failed' && (!Number.isInteger(c.exit_code) || c.exit_code === 0)) errors.push(`${c.id}: failed check must have nonzero exit code`);
    checkIds.push(c.id);
  }
  if (unique(checkIds).length !== checkIds.length) errors.push('Duplicate check IDs');
  for (const gate of state.gates ?? []) {
    if (!record(gate)) { errors.push('Gate must be an object'); continue; }
    if (!text(gate.id) || !text(gate.kind) || !strings(gate.scope) || !['pending', 'approved', 'rejected', 'invalidated'].includes(gate.status)) errors.push('Invalid gate record');
    if (gate.status === 'approved' && (!text(gate.evidence) || !text(gate.revision))) errors.push(`${gate.id}: approval needs revision and evidence`);
  }
  for (const d of state.decisions ?? []) if (!text(d.id) || !text(d.decision) || !text(d.reason)) errors.push('Decision needs id, decision and reason');
  const candidate = state.execution_context.candidate_revision ?? state.repo?.head_sha;
  for (const [id, r] of Object.entries(state.requirements)) {
    if (!/^AC-[A-Za-z0-9-]+$/.test(id) || !record(r) || !['satisfied', 'unverified', 'changed', 'deferred'].includes(r.status) || !Array.isArray(r.evidence)) { errors.push(`Invalid requirement evidence ${id}`); continue; }
    if (r.status === 'satisfied' && !r.evidence.some(e => {
      const check = state.checks.find(c => c?.id === e?.check_id);
      return text(e?.criterion) && check?.status === 'passed' && check.exit_code === 0 && check.revision === e.revision
        && e.revision === candidate && check.plan_revision === state.plan?.revision && check.requirements?.includes(id);
    })) errors.push(`${id}: satisfied status needs current criterion-specific passing evidence`);
  }
  if (state.status === 'completed') {
    if (!text(state.completed_at)) errors.push('Completed run needs completed_at');
    if (Object.values(state.tickets ?? {}).some(t => !['committed', 'integrated'].includes(t.status))) errors.push('Completed run has unfinished tickets');
    if ((state.gates ?? []).some(g => g.status !== 'approved')) errors.push('Completed run has unresolved gates');
    if (Object.values(state.review_loops ?? {}).some(r => !['passed', 'reported'].includes(r.status))) errors.push('Completed run has incomplete review loops');
    if ((state.checks ?? []).some(c => c.required === true && c.status !== 'passed')) errors.push('Completed run has required failed/unavailable checks');
    if (state.checks.some(c => c.required === true && (c.revision !== candidate || (state.plan && c.plan_revision !== state.plan.revision)))) errors.push('Completed run has stale required checks');
    if (Object.values(state.requirements ?? {}).some(r => !['satisfied', 'deferred'].includes(r.status))) errors.push('Completed run has unverified requirements');
  }
  return unique(errors);
}

function atomicWrite(file, value) {
  const absolute = path.resolve(file), temporary = `${absolute}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  try { fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); fs.renameSync(temporary, absolute); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

export function saveState(file, state, { expected_version }) {
  fail(validateState(state));
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const lock = `${file}.lock`; let fd;
  try { fd = fs.openSync(lock, 'wx'); }
  catch (e) { if (e.code === 'EEXIST') throw new Error(`Concurrent state writer: ${lock}; inspect owner before removing stale lock`); throw e; }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    const old = fs.existsSync(file) ? readJSON(file) : null;
    if ((old?.state_version ?? null) !== expected_version) throw new Error('Stale state_version; reload and merge returned worker results');
    const transitions = {
      pending: ['pending', 'in_progress', 'cancelled'], in_progress: runStatuses.filter(s => s !== 'pending'),
      awaiting_input: ['awaiting_input', 'in_progress', 'cancelled'], blocked: ['blocked', 'in_progress', 'failed', 'cancelled'],
      escalated: ['escalated', 'in_progress', 'failed', 'cancelled'], completed: ['completed'], failed: ['failed'], cancelled: ['cancelled'],
    };
    if (old && !transitions[old.status]?.includes(state.status)) throw new Error(`Invalid transition ${old.status} -> ${state.status}; terminal runs require a new run`);
    if (old) for (const collection of ['checks', 'gates', 'review_loops']) {
      const previousHistory = old.history?.[collection] ?? [], nextHistory = state.history?.[collection] ?? [];
      if (!Array.isArray(nextHistory) || canonical(nextHistory.slice(0, previousHistory.length)) !== canonical(previousHistory)) {
        throw new Error(`Preserve append-only history.${collection}; archived evidence cannot be removed, reordered or rewritten`);
      }
      const entries = collection === 'review_loops' ? Object.entries(old[collection] ?? {}) : (old[collection] ?? []).map(r => [r.id, r]);
      for (const [id, previous] of entries) {
        if (collection === 'review_loops' && previous.status === 'in_progress') continue;
        if (collection === 'gates' && previous.status === 'pending') continue;
        const current = collection === 'review_loops' ? state[collection]?.[id] : state[collection]?.find(r => r.id === id);
        if (canonical(current) === canonical(previous)) continue;
        const archived = (state.history?.[collection] ?? []).some(entry => {
          const { archived_at, archival_reason, ...body } = entry;
          return text(archival_reason) && canonical(entry.record ?? body) === canonical(previous);
        });
        if (!archived) throw new Error(`Preserve replaced ${collection} evidence ${id} in history with archival_reason`);
      }
    }
    const next = { ...state, state_version: (old?.state_version ?? 0) + 1, updated_at: new Date().toISOString() };
    atomicWrite(file, next); return next;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

export function frontier(plan, state, capacity = 3) {
  fail(validatePlan(plan)); fail(validateState(state));
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Capacity must be a positive integer');
  if (state.plan?.accepted_revision !== plan.revision || state.plan?.revision !== plan.revision) throw new Error('Plan revision is not accepted');
  fail(validateAcceptance(plan, { schema_version: 1, spec_id: plan.spec_id, revision: state.plan.accepted_revision, accepted_at: state.updated_at, gates: state.gates }));
  const owned = Object.values(state.tickets).filter(t => t.owner !== null || ['in_progress', 'reviewing', 'ready_to_integrate'].includes(t.status)).length;
  const candidates = plan.tickets.filter(t => state.tickets[t.id]?.status === 'ready' && state.tickets[t.id]?.owner === null
    && t.blocked_by.every(id => ['committed', 'integrated'].includes(state.tickets[id]?.status))).map(t => t.id);
  const ready = candidates.slice(0, Math.max(0, capacity - owned));
  const unfinished = plan.tickets.filter(t => !['committed', 'integrated'].includes(state.tickets[t.id]?.status)).map(t => t.id);
  return { ready, active: owned, capacity, deadlocked: unfinished.length > 0 && owned === 0 && candidates.length === 0, unfinished };
}

export function coverage(plan, state) {
  fail(validatePlan(plan));
  const candidate = state.execution_context?.candidate_revision ?? state.repo?.head_sha;
  const requirements = plan.requirements.map(r => {
    const trace = state.requirements?.[r.id], evidence = trace?.evidence ?? [];
    const verified = evidence.filter(e => {
      const c = state.checks?.find(c => c.id === e.check_id);
      return text(e.criterion) && c?.status === 'passed' && c.exit_code === 0 && c.plan_revision === plan.revision
        && c.revision === e.revision && c.revision === candidate && c.requirements?.includes(r.id);
    });
    const status = r.status === 'deferred' ? 'deferred' : trace?.status === 'changed' ? 'changed'
      : trace?.status === 'satisfied' && verified.length ? 'satisfied' : 'unverified';
    return { id: r.id, text: r.text, status, tickets: plan.tickets.filter(t => t.requirements.includes(r.id)).map(t => t.id), evidence: verified };
  });
  return { spec_id: plan.spec_id, revision: plan.revision, requirements,
    counts: Object.fromEntries(['satisfied', 'unverified', 'changed', 'deferred'].map(s => [s, requirements.filter(r => r.status === s).length])) };
}

export function impact(oldPlan, newPlan) {
  fail(validatePlan(oldPlan)); fail(validatePlan(newPlan));
  const reqIds = unique([...oldPlan.requirements, ...newPlan.requirements].map(r => r.id));
  const changedRequirements = reqIds.filter(id => canonical(oldPlan.requirements.find(r => r.id === id)) !== canonical(newPlan.requirements.find(r => r.id === id)));
  const ticketIds = unique([...oldPlan.tickets, ...newPlan.tickets].map(t => t.id));
  const affected = new Set(ticketIds.filter(id => {
    const old = oldPlan.tickets.find(t => t.id === id), next = newPlan.tickets.find(t => t.id === id);
    return canonical(old) !== canonical(next) || [...(old?.requirements ?? []), ...(next?.requirements ?? [])].some(r => changedRequirements.includes(r));
  }));
  const artifactPaths = unique([...(oldPlan.artifacts ?? []), ...(newPlan.artifacts ?? [])].map(a => a.path));
  const changedArtifacts = artifactPaths.filter(p => oldPlan.artifacts?.find(a => a.path === p)?.sha256 !== newPlan.artifacts?.find(a => a.path === p)?.sha256);
  const unclassifiedArtifacts = [];
  for (const p of changedArtifacts) {
    const owners = [...oldPlan.tickets, ...newPlan.tickets].filter(t => t.path === p).map(t => t.id);
    if (owners.length) owners.forEach(id => affected.add(id)); else unclassifiedArtifacts.push(p);
  }
  // Decision changes or unclassified prose changes need human impact classification, not guessed safety.
  const decisionsChanged = canonical(oldPlan.decisions) !== canonical(newPlan.decisions);
  const proseOnly = !affected.size && oldPlan.revision !== newPlan.revision;
  if (decisionsChanged || proseOnly || unclassifiedArtifacts.length) for (const id of ticketIds) affected.add(id);
  let grew = true;
  while (grew) { grew = false; for (const t of [...oldPlan.tickets, ...newPlan.tickets]) if (!affected.has(t.id) && t.blocked_by.some(d => affected.has(d))) { affected.add(t.id); grew = true; } }
  return { old_revision: oldPlan.revision, new_revision: newPlan.revision, changed_requirements: changedRequirements,
    affected_tickets: ticketIds.filter(id => affected.has(id)), retained_tickets: newPlan.tickets.filter(t => !affected.has(t.id)).map(t => t.id),
    changed_artifacts: changedArtifacts, unclassified_artifacts: unclassifiedArtifacts,
    requires_approval: oldPlan.revision !== newPlan.revision, reason: decisionsChanged || proseOnly ? 'Decision/prose change requires explicit impact classification' : 'Requirement, ticket and dependency changes' };
}

export function telemetry(events) {
  const allowed = new Set(['schema_version', 'id', 'run_id', 'timestamp', 'type', 'model', 'effort', 'duration_ms', 'value', 'task_id', 'input_tokens', 'output_tokens', 'cached_tokens', 'status', 'resource', 'revision', 'configuration']);
  const byId = new Map();
  for (const e of events) {
    if (!record(e) || !text(e.id) || !text(e.run_id) || !text(e.timestamp) || !text(e.type)) throw new Error('Invalid telemetry event');
    for (const k of Object.keys(e)) if (!allowed.has(k)) throw new Error(`Unsupported telemetry field ${k}; no prompts or sensitive payloads`);
    for (const k of ['duration_ms', 'input_tokens', 'output_tokens', 'cached_tokens']) if (e[k] !== undefined && (!Number.isFinite(e[k]) || e[k] < 0)) throw new Error(`Invalid telemetry ${k}`);
    const key = `${e.run_id}:${e.id}`;
    if (byId.has(key) && canonical(byId.get(key)) !== canonical(e)) throw new Error(`Conflicting telemetry duplicate ${key}`);
    byId.set(key, e);
  }
  const values = [...byId.values()], counts = {};
  for (const e of values) counts[e.type] = (counts[e.type] ?? 0) + 1;
  const samples = values.map(e => e.duration_ms).filter(v => v !== undefined).sort((a, b) => a - b);
  const median = samples.length ? (samples[Math.floor((samples.length - 1) / 2)] + samples[Math.ceil((samples.length - 1) / 2)]) / 2 : null;
  const tokenEvents = values.filter(e => e.input_tokens !== undefined || e.output_tokens !== undefined);
  return { events: values.length, runs: unique(values.map(e => e.run_id)).length, counts,
    durations: { samples: samples.length, median_ms: median, min_ms: samples[0] ?? null, max_ms: samples.at(-1) ?? null },
    tokens: tokenEvents.length ? { input: tokenEvents.some(e => e.input_tokens !== undefined) ? tokenEvents.reduce((n, e) => n + (e.input_tokens ?? 0), 0) : null,
      output: tokenEvents.some(e => e.output_tokens !== undefined) ? tokenEvents.reduce((n, e) => n + (e.output_tokens ?? 0), 0) : null,
      observed_input_events: tokenEvents.filter(e => e.input_tokens !== undefined).length, observed_output_events: tokenEvents.filter(e => e.output_tokens !== undefined).length } : null,
    models: unique(values.map(e => e.model).filter(Boolean)), limitations: 'Missing observations are unavailable, never zero. Event durations are not end-to-end run duration; no unobserved quality or efficiency is inferred.' };
}

export function validateKnowledge(directory) {
  const errors = [], warnings = [], files = walk(directory).filter(p => p.endsWith('.md')), numbers = new Map();
  for (const file of files) {
    const relative = path.relative(directory, file), number = relative.match(/(?:^|\/)(adr|rfc)\/(\d{4})-/);
    if (number) { const key = `${number[1]}:${number[2]}`; if (numbers.has(key)) errors.push(`Duplicate knowledge number ${key}: ${relative}`); numbers.set(key, file); }
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0]; if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
      if (!fs.existsSync(path.resolve(path.dirname(file), target))) errors.push(`${relative}: broken knowledge link ${target}`);
    }
    if (number && !fs.existsSync(path.join(path.dirname(file), 'README.md'))) warnings.push(`${relative}: missing category index`);
    if (/\*\*Status:\*\*\s*Superseded\b/i.test(content) && !/\[[^\]]+\]\([^)]+\.md/.test(content)) errors.push(`${relative}: superseded record needs successor link`);
  }
  return { documents: files.length, errors: unique(errors), warnings: unique(warnings) };
}

export function checkResume(plan, state) {
  fail(validatePlan(plan));
  const root = state.repo?.root; if (!text(root)) throw new Error('Resume requires repository root');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const head = git(['rev-parse', 'HEAD']), branch = git(['branch', '--show-current']);
  const dirty = git(['status', '--porcelain']).length > 0;
  const tickets = plan.tickets.map(ticket => {
    const saved = state.tickets?.[ticket.id], reasons = []; let reachable = false;
    if (saved?.commit && /^[a-f0-9]{40,64}$/.test(saved.commit)) {
      try { git(['merge-base', '--is-ancestor', saved.commit, 'HEAD']); reachable = true; } catch { /* missing or not reachable */ }
    }
    if (!reachable) reasons.push('Recorded commit is absent or unreachable');
    if (state.repo.branch !== branch) reasons.push('Branch changed; reconcile repository identity');
    if (saved?.plan_revision !== plan.revision || state.plan?.accepted_revision !== plan.revision) reasons.push('Accepted plan revision changed');
    if (dirty) reasons.push('Working tree has unverified changes');
    const traces = coverage(plan, state).requirements.filter(r => ticket.requirements.includes(r.id));
    const currentEvidence = traces.every(r => r.status === 'satisfied' && r.evidence.some(e => e.revision === head));
    if (!currentEvidence) reasons.push('Expected effects require fresh acceptance evidence at current HEAD; reachability alone does not detect reverts');
    return { id: ticket.id, commit: saved?.commit ?? null, reachable, skippable: saved?.status === 'committed' && reasons.length === 0, reasons };
  });
  return { head, branch, dirty, tickets };
}

export function importPlan(source, destination) {
  if (!record(source) || !text(source.product) || !text(source.technical)) throw new Error('Import requires product and technical documents plus structured requirements/tickets');
  if (fs.existsSync(destination)) throw new Error('Import destination exists; refusing to overwrite');
  const parent = path.dirname(path.resolve(destination)); fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, '.agentic-import-'));
  try {
    fs.mkdirSync(path.join(staging, 'tickets'));
    const plan = { schema_version: 1, spec_id: source.spec_id, prd: 'prd.md', technical_plan: 'technical-plan.md', requirements: source.requirements,
      tickets: (source.tickets ?? []).map(t => ({ ...t, path: `tickets/${t.id}.md` })), decisions: source.decisions ?? [], artifacts: [] };
    plan.revision = planRevision(plan); fail(validatePlan(plan));
    fs.writeFileSync(path.join(staging, 'prd.md'), source.product + '\n'); fs.writeFileSync(path.join(staging, 'technical-plan.md'), source.technical + '\n');
    for (const t of plan.tickets) fs.writeFileSync(safeRelative(staging, t.path), `# ${t.id} · ${t.title}\n\nRequirements: ${t.requirements.join(', ')}\n\nBlocked by: ${t.blocked_by.join(', ') || 'none'}\n\n## Acceptance criteria\n\n${t.acceptance.map(a => `- [ ] ${a}`).join('\n')}\n\n## Files\n\n${t.files.map(f => `- ${f}`).join('\n')}\n`);
    atomicWrite(path.join(staging, 'plan.json'), plan); sealPlan(path.join(staging, 'plan.json'));
    fs.renameSync(staging, destination); return { path: path.join(destination, 'plan.json'), approval: 'required', next: 'structural and ticket quiz gates' };
  } finally { if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true }); }
}

const help = `Agentic contract tools (Node.js 22+)\n\nRead-only:\n  validate-library [repo-root]\n  resolve-config <config.json> <task.json>\n  validate-state <workflow-state.yaml>\n  validate-plan <plan.json>\n  validate-acceptance <plan.json> <acceptance.json>\n  frontier <plan.json> <workflow-state.yaml> [capacity]\n  coverage <plan.json> <workflow-state.yaml>\n  impact <old-plan.json> <new-plan.json>\n  telemetry <events.jsonl>\n  validate-knowledge <docs-root>\n  resume-check <plan.json> <workflow-state.yaml>\n\nExplicit writes:\n  seal-plan <plan.json>\n  import-plan <source.json> <new-directory>\n  save-state <workflow-state.yaml> <next.json> <expected-version|null>\n\nAll output is JSON; invalid contracts exit nonzero. State uses JSON syntax, a YAML1.2 subset.\nThese helpers never approve gates, run checks, modify Git, send messages, or select a model.\n`;

export function main(args = process.argv.slice(2)) {
  const [command, a, b, c] = args;
  if (!command || ['--help', '-h', 'help'].includes(command)) { process.stdout.write(help); return; }
  let result;
  switch (command) {
    case 'validate-library': result = validateLibrary(path.resolve(a ?? process.cwd())); break;
    case 'resolve-config': result = resolveConfig(readJSON(a), readJSON(b)); break;
    case 'validate-state': result = { errors: validateState(readJSON(a)) }; break;
    case 'validate-plan': result = { errors: validatePlan(readJSON(a), path.dirname(path.resolve(a))) }; break;
    case 'validate-acceptance': result = { errors: validateAcceptance(readJSON(a), readJSON(b)) }; break;
    case 'frontier': result = frontier(readJSON(a), readJSON(b), c === undefined ? 3 : Number(c)); break;
    case 'coverage': result = coverage(readJSON(a), readJSON(b)); break;
    case 'impact': result = impact(readJSON(a), readJSON(b)); break;
    case 'telemetry': result = telemetry(fs.readFileSync(a, 'utf8').split('\n').filter(s => s.trim()).map(s => JSON.parse(s))); break;
    case 'validate-knowledge': result = validateKnowledge(path.resolve(a)); break;
    case 'resume-check': result = checkResume(readJSON(a), readJSON(b)); break;
    case 'seal-plan': result = sealPlan(path.resolve(a)); break;
    case 'import-plan': result = importPlan(readJSON(a), path.resolve(b)); break;
    case 'save-state': result = saveState(path.resolve(a), readJSON(b), { expected_version: c === 'null' ? null : Number(c) }); break;
    default: throw new Error(`Unknown command: ${command}; use --help`);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.errors?.length) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(JSON.stringify({ error: error.message }) + '\n'); process.exitCode = 1; }
}
