---
name: agentic-security-audit
description: Audit the codebase for vulnerabilities, then log confirmed findings as one parent issue with a child each, locally or in a tracker. No fixes.
disable-model-invocation: true
argument-hint: "[<paths> | <slug>]"
---

# Security Audit

Playbook. Audits the repo in passes; the code stays as it is. Each pass is one security-audit run `run-{N}`. The logged parent is the spec input for the fix effort.

## 1. Start

Call the Skill tool with "agentic-use-workflow" (no Skill tool → open its SKILL.md and follow it).

- Slug given, pass in flight → resume per agentic-use-workflow `references/state.md` Resume, then reuse this pass's `*.run-{N}` choices yourself.
- Slug given, `status` `done` → offer a new pass: yes → this step again, prior pass's answers as defaults.
- Log `started` with workflow `security-audit`, then each step's `started` / `completed` as it runs: step = `start`, `audit`, `report`, `publish`.

`N`: the in-flight pass's (its `output.run-{N}` key), else the next integer above every `run-*` folder in `{work}/audit/` and every logged `output.run-*` key. In one exchange, ask what this pass hasn't answered, prior pass's answer (or the default) recommended:

- **scope**: whole repo (default), or the paths given or named;
- **profile**: `quick`, `standard` (default) or `deep`, as security-audit defines them; propose one from the repo's size and stakes;
- **output**: security-audit's output dir. Default `{output}/{work}/audit/run-{N}/`, spelled out as the real path; inside the repo, so the user must confirm it explicitly. Any other new dir outside the repo also works;
- **destination**: where to log the findings: **local**, a **tracker** (inferred and confirmed as in agentic-to-tickets step 2: GitHub `owner/repo`, Jira, Linear), or **other** (the user names it).

Log each as a `choice` decision, per pass: keys `scope.run-{N}`, `profile.run-{N}`, `output.run-{N}` (absolute path), `destination.run-{N}` (`local`, `github:owner/repo`, `jira:KEY`, `linear:TEAM` or `other:<name>`).

Output inside the repo → `git check-ignore -q <that path>/` from the repo root. Not ignored → offer adding `{output}/` (with `commitWork: true`, that path itself) to the main checkout's `.git/info/exclude`: local, never committed; declined → ask for a dir outside the repo.

Each new pass (not a resumed one): record the workspace as `current` (the branch and path checked out now) without asking, as a `decision` event: the audit reads the repo and never writes to its working tree. First pass only: spawn `context.docs` (agentic-use-workflow Delegation), read-only, loading `agentic-use-knowledge` (read mode), security focus: principles, ADRs and glossary terms on trust boundaries, tenancy, auth, data handling. Write its findings to `context.md`.

Done when this pass's four choices and `workspace` are logged, the output dir passes the ignore check, and `context.md` exists; log step `start` `completed`.

## 2. Audit

Resume with `audit` `in_progress` → `run-metadata.json` in the output dir not terminal: ask continue or discard. Continue → security-audit resumes that run from its files. Discard → delete the output dir and start it again empty. Log the answer as `choice` `audit.run-{N}`.

Call the Skill tool with "security-audit" in full audit mode, with this brief in place of its own setup questions:

- **Target**: `workspace.path`. **Output directory**: `output.run-{N}`, explicitly selected by the user; ignore status verified when inside the target.
- **Profile** and **scope paths**: `profile.run-{N}`, `scope.run-{N}`.
- **Prior runs**: every earlier `output.run-*` whose `run-metadata.json` reached a terminal state (`run_status` `complete` or `incomplete`). Others are never prior runs.
- **Reconnaissance**: also reads `context.md` for the project's own security rules.
- **Agents**: every agent it launches runs on the resolved `audit` model and effort; log each dispatch and return per agentic-use-workflow Events and state, `agent` = its agent id.

Done when the run reaches one of security-audit's two terminal states. Log `REPORT.md` and `findings.json` as `artifact` events, names `audit-report.run-{N}` and `audit-findings.run-{N}`.

## 3. Report (interactive)

Summarise from `REPORT.md` and `findings.json`:

- counts by verdict (`confirmed`, `needs_validation`, `rejected`) and confirmed counts by severity;
- the top confirmed findings: severity, title, `file:line`;
- the coverage statement; a `quick`, scoped or `incomplete` run is partial coverage, say so.

Answer the user's questions from the run's files, then ask: publish to `destination.run-{N}`, or stop here. Log the answer as `choice` `report.run-{N}`, value `publish` or `stop`. Stop → step 5.

Done when the answer is logged.

## 4. Publish

Destination other than local → agentic-use-workflow Disclosure guard first. Not cleared → offer local instead; no → step 5.

Write the parent and its children from this run's `findings.json` per [references/issues.md](references/issues.md): item format, linking per destination, re-run updates.

Done when every confirmed finding has a child linked to the parent and every logged child this run settled has its `obsolete.{fingerprint}` answer applied; log an `artifact` event, name `issues`, with `issues: {parent, children}` (children = fingerprint → ref), the `issues` shape rather than `tickets`: these are spec input, not units.

## 5. Done

Log `completed` for `security-audit`. Report the parent ref (or the `REPORT.md` path when not published), child count and open `needs_validation` count. Published → the fix path: `/agentic-change-feature <parent ref | path to issues/index.md>` (`$agentic-change-feature` in Codex), full mode with tickets. agentic-to-spec captures the parent with its children; agentic-to-tickets maps its slices onto those children.

Done when `completed` is logged and the reply holds the parent ref or `REPORT.md` path, the child count, the open `needs_validation` count and, when published, the fix-path command.
