#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "vendor.json");
const lockPath = join(root, "vendor.lock.json");
const LICENSE_NAMES = ["LICENSE", "LICENSE.md", "LICENSE.txt"];
const MAX_BUFFER = 64 * 1024 * 1024;

const usage = `usage: node scripts/vendor-skills.mjs <command>
  check            exit 1 if upstream changed a locked entry (read-only)
  update [name...] re-vendor entries at upstream HEAD, refresh vendor.lock.json (default: all)
  verify           exit 1 if a vendored copy differs from its locked hash`;

async function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, "utf8"));
}

const readManifest = async () => (await readJson(manifestPath, { skills: [] })).skills;
const readLock = () => readJson(lockPath, { version: 1, skills: {} });
const keyOf = (entry) => entry.skill ?? entry.name;
const isFile = (entry) => "file" in entry;
const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function writeLock(skills) {
  const sorted = Object.fromEntries(Object.entries(skills).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(lockPath, JSON.stringify({ version: 1, skills: sorted }, null, 2) + "\n");
}

function groupBySource(entries) {
  const groups = new Map();
  for (const entry of entries) groups.set(entry.source, [...(groups.get(entry.source) ?? []), entry]);
  return groups;
}

function upstreamHead(source) {
  const out = execFileSync("git", ["ls-remote", `https://github.com/${source}`, "HEAD"], {
    encoding: "utf8",
    env: gitEnv,
  });
  const sha = out.split(/\s/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`cannot resolve HEAD of ${source}`);
  return sha;
}

async function withInstall(source, sha, skills, use) {
  const dir = await mkdtemp(join(tmpdir(), "vendor-skills-"));
  try {
    const skillFlags = skills.flatMap((skill) => ["--skill", skill]);
    try {
      execFileSync("npx", ["-y", "skills@1.7.4", "add", `${source}#${sha}`, ...skillFlags, "-a", "claude-code", "--copy", "-y"], {
        cwd: dir,
        stdio: ["ignore", "ignore", "inherit"],
      });
    } catch (error) {
      // npx skips unknown --skill names, and exits 1 when none exist upstream: callers report them as missing.
      if (typeof error.status !== "number") throw error;
    }
    const lock = await readJson(join(dir, "skills-lock.json"), { skills: {} });
    const missing = skills.filter((skill) => !lock.skills[skill]);
    return await use({ skillsDir: join(dir, ".claude", "skills"), lock: lock.skills, missing });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Returns null when the path does not exist at that commit.
async function fetchFile(source, sha, path) {
  const dir = await mkdtemp(join(tmpdir(), "vendor-file-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, env: gitEnv, stdio: ["ignore", "pipe", "inherit"], maxBuffer: MAX_BUFFER });
  try {
    git("init", "-q");
    git("fetch", "-q", "--depth", "1", `https://github.com/${source}`, sha);
    const [meta, treePath] = git("ls-tree", sha, "--", path).toString().trim().split("\t");
    const type = meta?.split(" ")[1];
    return type === "blob" && treePath === path ? git("show", `${sha}:${path}`) : null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function upstreamHashes(source, sha, entries) {
  const hashes = new Map();
  const skills = entries.filter((e) => !isFile(e)).map((e) => e.skill);
  if (skills.length) {
    await withInstall(source, sha, skills, async ({ lock }) => {
      for (const skill of skills) hashes.set(skill, lock[skill]?.computedHash);
    });
  }
  for (const { name, file } of entries.filter(isFile)) {
    const bytes = await fetchFile(source, sha, file);
    hashes.set(name, bytes && sha256(bytes));
  }
  return hashes;
}

async function listFiles(base, dir = base) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== ".git" && entry.name !== "node_modules") files.push(...(await listFiles(base, path)));
    else if (entry.isFile()) files.push(relative(base, path).split("\\").join("/"));
  }
  return files;
}

// Must mirror skills CLI computedHash: sha256 over files sorted by relative path, each as path then bytes.
async function hashDir(dir, excluded = []) {
  const files = (await listFiles(dir)).filter((file) => !excluded.includes(file));
  files.sort((a, b) => a.localeCompare(b));
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update(await readFile(join(dir, file)));
  }
  return hash.digest("hex");
}

async function hasLicense(dir) {
  return (await readdir(dir)).some((name) => /^licen[cs]e/i.test(name));
}

async function fetchLicense(source, sha, dest) {
  for (const name of LICENSE_NAMES) {
    const response = await fetch(`https://raw.githubusercontent.com/${source}/${sha}/${name}`);
    if (response.ok) return writeFile(join(dest, name), Buffer.from(await response.arrayBuffer()));
  }
  console.warn(`warning: no LICENSE found for ${source}`);
}

const short = (sha) => sha.slice(0, 7);

async function check() {
  const lock = (await readLock()).skills;
  let changed = 0;
  for (const [source, entries] of groupBySource(await readManifest())) {
    const head = upstreamHead(source);
    const stale = entries.filter((e) => lock[keyOf(e)]?.ref !== head);
    if (stale.length === 0) {
      console.log(`${source}: up to date (${short(head)})`);
      continue;
    }
    console.log(`${source}: HEAD ${short(head)}`);
    const upstream = await upstreamHashes(source, head, stale);
    for (const key of stale.map(keyOf)) {
      const locked = lock[key];
      let status = "unchanged";
      if (!locked) status = "not in vendor.lock.json, run update";
      else if (!upstream.get(key)) status = "missing upstream";
      else if (locked.computedHash !== upstream.get(key)) {
        status = `changed https://github.com/${source}/compare/${locked.ref}...${head}`;
      }
      console.log(`  ${key}: ${status}`);
      if (status !== "unchanged") changed++;
    }
  }
  if (changed) process.exitCode = 1;
}

async function vendorSkills(source, head, entries, lock) {
  await withInstall(source, head, entries.map((e) => e.skill), async ({ skillsDir, lock: upstream, missing }) => {
    if (missing.length) throw new Error(`missing upstream in ${source}: ${missing.join(", ")}`);
    for (const { skill, into } of entries) {
      const target = join(root, into, skill);
      await rm(target, { recursive: true, force: true });
      await mkdir(join(root, into), { recursive: true });
      await cp(join(skillsDir, skill), target, { recursive: true });
      if (!(await hasLicense(target))) await fetchLicense(source, head, target);
      lock[skill] = upstream[skill];
      console.log(`vendored ${source}/${skill}@${short(head)} -> ${into}/${skill}`);
    }
  });
}

// update wipes a file entry's `into`, so it must be a dedicated upstream/ folder under skills/.
function assertSafeInto({ name, into }, manifest) {
  const target = resolve(root, into);
  const insideSkills = target.startsWith(join(root, "skills") + sep);
  const shared = manifest.filter(isFile).filter((e) => resolve(root, e.into) === target).length > 1;
  if (!insideSkills || basename(target) !== "upstream" || shared) {
    throw new Error(`unsafe into for ${name}: ${into} (needs a unique skills/**/upstream folder)`);
  }
  return target;
}

async function vendorFile(source, head, entry, manifest, lock) {
  const { name, file, into } = entry;
  const target = assertSafeInto(entry, manifest);
  const bytes = await fetchFile(source, head, file);
  if (!bytes) throw new Error(`missing upstream in ${source}: ${file}`);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await writeFile(join(target, basename(file)), bytes);
  await fetchLicense(source, head, target);
  lock[name] = { source, ref: head, sourceType: "file", filePath: file, computedHash: sha256(bytes) };
  console.log(`vendored ${source}/${file}@${short(head)} -> ${into}/${basename(file)}`);
}

async function update(names) {
  const manifest = await readManifest();
  const unknown = names.filter((name) => !manifest.some((e) => keyOf(e) === name));
  if (unknown.length) throw new Error(`not in vendor.json: ${unknown.join(", ")}`);

  const selected = names.length ? manifest.filter((e) => names.includes(keyOf(e))) : manifest;
  const lock = (await readLock()).skills;
  for (const key of Object.keys(lock)) {
    if (!manifest.some((e) => keyOf(e) === key)) delete lock[key];
  }
  for (const [source, entries] of groupBySource(selected)) {
    const head = upstreamHead(source);
    const skillEntries = entries.filter((e) => !isFile(e));
    if (skillEntries.length) await vendorSkills(source, head, skillEntries, lock);
    for (const entry of entries.filter(isFile)) await vendorFile(source, head, entry, manifest, lock);
    await writeLock(lock);
  }
}

async function findFileProblem({ file, into }, locked) {
  const path = join(into, basename(file));
  if (!existsSync(join(root, path))) return `missing ${path}`;
  const allowed = [basename(file), ...LICENSE_NAMES];
  const extra = (await listFiles(join(root, into))).filter((f) => !allowed.includes(f));
  if (extra.length) return `unexpected files in ${into}: ${extra.join(", ")}`;
  return sha256(await readFile(join(root, path))) === locked.computedHash ? null : "hash mismatch";
}

async function findProblem(entry, locked) {
  if (!entry) return "not in vendor.json";
  if (!locked) return `not pinned, run update ${keyOf(entry)}`;
  if (isFile(entry)) return findFileProblem(entry, locked);
  const dir = join(root, entry.into, entry.skill);
  if (!existsSync(dir)) return `missing ${entry.into}/${entry.skill}`;
  // The script adds an upstream LICENSE the skill folder lacks, so a match without it also counts.
  const matches = (await hashDir(dir)) === locked.computedHash || (await hashDir(dir, LICENSE_NAMES)) === locked.computedHash;
  return matches ? null : "hash mismatch";
}

async function verify() {
  const manifest = await readManifest();
  const lock = (await readLock()).skills;
  const keys = new Set([...manifest.map(keyOf), ...Object.keys(lock)]);
  let failures = 0;
  for (const key of keys) {
    const problem = await findProblem(manifest.find((e) => keyOf(e) === key), lock[key]);
    console.log(problem ? `FAIL ${key}: ${problem}` : `ok ${key}`);
    if (problem) failures++;
  }
  if (failures) process.exitCode = 1;
}

const [command, ...args] = process.argv.slice(2);
const commands = { check, update: () => update(args), verify };
if (!commands[command]) {
  console.error(usage);
  process.exit(2);
}
try {
  await commands[command]();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}
