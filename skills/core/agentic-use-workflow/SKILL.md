---
name: agentic-use-workflow
description: "Runtime every agentic-* skill loads first. Use at the start of any agentic-* skill."
---

# Use Workflow

Runtime every agentic skill loads first. Contracts read by other skills or outside tooling live in `references/`; follow them exactly.

## Config

Read [references/config.md](references/config.md) before resolving any config value: lookup and merge, fields, defaults, profiles, step keys, limits. No config file found → built-in defaults; say so once and suggest the user run `/agentic-configure` (Codex: `$agentic-configure`).

Harness key is `cursor`, `claude` or `codex`, from your own runtime. Unsure → ask.

Profiles: resolve them per config.md and say once which run. Their `skills` are the codestyle skills for every step that writes or judges code. Units (tickets, else `plan.md` tasks) add their own `Skills`: a step working on given units loads the profile skills plus theirs; a step judging the whole change (reviewers) loads the union across units.

## Skills

Every skill named in a step, config or brief (agentic, vendored, codestyle, reviewers) is reached by its invocation:

- **Model-invoked** → `Call the Skill tool with "<name>"`, one skill per call.
- **User-invoked** (`disable-model-invocation: true`: the vendored `to-spec`, `to-tickets`, `implement`): the Skill tool can't reach it. The calling skill reads its co-located copy by relative path: "Read `../<name>/SKILL.md` and follow it". Subagents get the absolute path, resolved from the calling skill's base directory.
- **No Skill tool** (Codex, Cursor): "Call the Skill tool with X", "via the Skill tool", and the same request inside a vendored copy all mean: open `X/SKILL.md` (next to the asking skill, `../X/SKILL.md`, else among the installed skills) and follow it. Briefs then list each skill's absolute `SKILL.md` path and carry this rule as the delegation brief's `Skills:` line.

The Claude plugin namespaces skills as `agentic:<name>`; a bare name means either.

Vendored skills that expect setup (a tracker "already provided", a board, a merge gate) take it from the agentic brief: tracker, work-item paths, scope (report-only for reviewers). The brief is their setup; keep the user out of third-party setup skills.

## Step → model and effort

Every step has a key (`grill`, `implement`, `review.code-review`, …). Resolve `model` and `effort` each on its own per config.md Resolution; map capability classes (`frontier`, `code`, `fast`) to the closest model the harness offers.

- Interactive steps (capture, grill, gate) stay in the main session. Resolved value is a recommendation: warn once if the session runs something else, then go on.
- Non-interactive steps always run as subagents with the resolved `{model, effort}`; resolved `harness` ≠ own → that harness's CLI instead, per [references/delegation.md](references/delegation.md#cross-harness).

## Cheap routing

Keep the session model for work that needs it.

- **Simple tasks** (grep, read a file, diff, PR or log, list folders, rename or move, one-line edit, run a command and summarize) → `chore` subagent. Its brief: do exactly that; touching more than 2 files or needing a decision → stop and report.
- **Exploration** (any read-only search or analysis, `context.*` included) → subagent on the resolved `explore` model, even if that means bypassing the harness's built-in Explore agent.
- Keep in the session: talking to the user, decisions, planning, debugging, multi-file changes.

## Delegation

One subagent per step key and unit; parallel when independent (no shared writes, no ordering). Brief and harness controls for model and effort: [references/delegation.md](references/delegation.md). Read-only subagents return cited findings; you write them to the target file (e.g. the matching `context.md` section).

## Work item

`{output}/{YYYYMMDD}-{slug}/`, layout in [references/state.md](references/state.md).

- No slug → new work item: short kebab slug from the request, create the folder, write the raw request to `input.md`.
- Slug given → folder named `{slug}` or ending in `-{slug}`; resume per [references/state.md](references/state.md#resume). Several matches → ask.
- `{output}` always resolves in the main checkout (first entry of `git worktree list`), even from inside a worktree: one audit trail per work item.
- `agentic-cleanup` archives merged work items to `{output}/_archive/{work-item}/`. Never deleted; slug lookup skips them.
- Keep `{output}` in `.gitignore` unless `commitWork: true`.

## Workspace

Where the code is built, chosen once per work item by the first skill that writes to the repo (a playbook at its start, `agentic-implement`, or the promotion after a gate):

- **worktree** (default, recommended): new branch `feat/{slug}` (`fix/{slug}` for bugs) from the up-to-date default branch, at `{worktrees}/{slug}`. Install dependencies so the project checks run there. Ask before copying untracked local files (`.env`, …).
- **current**: the checked-out branch. On the default branch → warn, recommend a worktree or a new branch.
- **branch**: an existing branch, or a new one from the up-to-date default branch.

Branch or path already taken → ask. Before the first write, check `workspace.path` (for a new worktree, `{worktrees}`) is writable; not writable under Codex's sandbox (worktrees sit outside the repo) → ask the user to restart Codex with `--add-dir <path>` or add the path to `sandbox_workspace_write.writable_roots` in `~/.codex/config.toml`. Log the choice as a `decision` event; it becomes `workspace` in `state.json` (absolute `path`). From then on every repo write and code operation (implement, review, babysit-pr, knowledge promotion, their subagents) runs in `workspace.path`. A skill that doesn't ask (review, babysit-pr) and finds no workspace uses the current checkout, recorded as `current`. Recorded path gone → ask.

## Events and state

`events.jsonl` must let someone outside the session follow the work: who started what, on which model, which milestones it went through, how it ended. Milestones, not tool calls. Before your first event, read [references/state.md](references/state.md): the line contract, who logs what, how `state.json` derives from the log.

Step fails → `failed` event, tell the user; continue only on their answer.

## Escalation gate

Runs once a skill's grills are done: [references/escalation.md](references/escalation.md). Open escalations → [references/state.md](references/state.md#resume) Resume step 0.

## Disclosure guard

Before posting unfixed vulnerabilities anywhere but local files: [references/disclosure.md](references/disclosure.md).

## Playbooks

Playbook start and autonomous tail: [references/playbook.md](references/playbook.md).

## Communication mode

While a workflow runs, talk compressed: drop articles, filler, hedging. Fragments OK ("3 files changed. Tests green."). Technical terms, paths, APIs, type names exact.

Normal prose for security warnings, irreversible actions, and anything the user could misread. Code, docs, commits, PR text: always normal prose.
