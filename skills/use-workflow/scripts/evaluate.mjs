#!/usr/bin/env node
// Prepare isolated prompt samples and summarize manually adjudicated results.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const conditions = ['no-library', 'original-library', 'migrated-library'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function prepare(library, cases, destination, condition, repeats = 5) {
  if (!conditions.includes(condition)) throw new Error('Unknown evaluation condition');
  if (!Number.isInteger(repeats) || repeats < 5) throw new Error('Use at least five fresh samples per case and condition');
  if (fs.existsSync(destination)) throw new Error('Destination already exists; samples must remain immutable');
  if (!Array.isArray(cases) || !cases.length) throw new Error('Cases must be a nonempty array');
  fs.mkdirSync(destination, { recursive: true });
  const manifests = [];
  for (const c of cases) {
    if (!/^[A-Za-z0-9_-]+$/.test(c.id) || typeof c.prompt !== 'string' || !Array.isArray(c.skills)) throw new Error('Invalid evaluation case');
    for (let repetition = 1; repetition <= repeats; repetition++) {
      const id = `${c.id}-${repetition}`, sample = path.join(destination, id); fs.mkdirSync(sample);
      const files = [];
      if (condition !== 'no-library') {
        // Copy the full bundle to keep supporting paths and dependencies intact.
        const source = path.join(library, 'skills');
        fs.cpSync(source, path.join(sample, 'library/skills'), { recursive: true, dereference: true });
        if (fs.existsSync(path.join(library, 'agents'))) fs.cpSync(path.join(library, 'agents'), path.join(sample, 'library/agents'), { recursive: true });
        for (const skill of c.skills) {
          const entry = path.join(sample, 'library/skills', skill, 'SKILL.md');
          if (fs.existsSync(entry)) files.push({ path: entry, sha256: digest(fs.readFileSync(entry)) });
        }
      }
      const loading = files.length ? `Read these skill entry points and their required supporting files before answering:\n${files.map(f => f.path).join('\n')}\n\n` : '';
      fs.writeFileSync(path.join(sample, 'prompt.txt'), `${loading}${c.prompt}\n\nReturn concrete actions, fields and evidence. Do not read the evaluation rubric or other samples. Do not execute external publication or modify source repositories.\n`);
      manifests.push({ sample_id: id, case_id: c.id, repetition, condition, prompt: path.join(sample, 'prompt.txt'), files });
    }
  }
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifests, null, 2) + '\n');
  return { samples: manifests.length, condition, repeats, manifest: path.join(destination, 'manifest.json') };
}

export function summarize(results) {
  const groups = new Map(), ids = new Set();
  const median = numbers => { const n = numbers.filter(x => typeof x === 'number').sort((a, b) => a - b); return n.length ? (n[Math.floor((n.length - 1) / 2)] + n[Math.ceil((n.length - 1) / 2)]) / 2 : null; };
  for (const r of results) {
    for (const field of ['sample_id', 'case_id', 'model', 'effort', 'host_overlay', 'transcript', 'reviewer']) if (typeof r[field] !== 'string' || !r[field]) throw new Error(`Result needs ${field}`);
    if (!conditions.includes(r.condition) || typeof r.pass !== 'boolean' || !Array.isArray(r.failed_criteria)) throw new Error('Result needs adjudicated outcome and condition');
    for (const field of ['elapsed_ms', 'input_tokens', 'output_tokens', 'tool_calls', 'clarifications']) if (r[field] !== null && r[field] !== undefined && (!Number.isFinite(r[field]) || r[field] < 0)) throw new Error(`Invalid measured ${field}`);
    const identity = `${r.model}|${r.effort}|${r.host_overlay}|${r.condition}|${r.sample_id}`;
    if (ids.has(identity)) throw new Error(`Duplicate result ${identity}`); ids.add(identity);
    const key = `${r.model}|${r.effort}|${r.host_overlay}|${r.condition}|${r.case_id}`;
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r);
  }
  return { groups: [...groups.values()].map(rows => ({ model: rows[0].model, effort: rows[0].effort,
    host_overlay: rows[0].host_overlay, condition: rows[0].condition, case_id: rows[0].case_id, samples: rows.length,
    passes: rows.filter(r => r.pass).length, at_least_five: rows.length >= 5,
    median_elapsed_ms: median(rows.map(r => r.elapsed_ms)), median_input_tokens: median(rows.map(r => r.input_tokens)),
    median_output_tokens: median(rows.map(r => r.output_tokens)), failed_criteria: [...new Set(rows.flatMap(r => r.failed_criteria))] })),
    limitations: 'Manual criterion adjudication is required. Separate host overlays and exact model/effort. Missing measurements stay unavailable. Five wording samples are not production reliability evidence.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, a, b, c, d, e] = process.argv.slice(2); let result;
    if (command === 'prepare') result = prepare(path.resolve(a), JSON.parse(fs.readFileSync(b)), path.resolve(c), d, e ? Number(e) : 5);
    else if (command === 'summarize') result = summarize(fs.readFileSync(a, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)));
    else { process.stdout.write('prepare <library-root> <cases.json> <new-output-dir> <no-library|original-library|migrated-library> [repeats>=5]\nsummarize <adjudicated-results.jsonl>\n'); process.exit(0); }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) { process.stderr.write(JSON.stringify({ error: error.message }) + '\n'); process.exitCode = 1; }
}
