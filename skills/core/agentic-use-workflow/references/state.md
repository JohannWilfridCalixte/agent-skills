# Work-item state

## Layout

```
{output}/{YYYYMMDD}-{slug}/
├── events.jsonl      # append-only audit log (source of truth)
├── state.json        # snapshot derived from the log
├── input.md
├── context.md        # cited, one section per context subagent
├── decisions.md      # grill answers, contract below
├── diagnosis.md      # agentic-debug findings
├── debug/            # agentic-debug harness files, loop scripts
├── spec.md
├── plan.md           # tasks consumed by agentic-implement and agentic-to-tickets
├── tickets/NN-slug.md  # local tracker, written by agentic-to-tickets
├── implementation.md
├── reviews/
│   ├── {n}-{reviewer}.md  # one per reviewer per review iteration n
│   ├── {n}-fix.md         # fix list fed to agentic-implement
│   └── pr-report.md       # PR mode local report
├── pr.md
└── audit/            # agentic-security-audit: run-N/ (security-audit output, default), issues/ (local tracker)

{output}/_archive/{YYYYMMDD}-{slug}/   # moved here by agentic-cleanup once merged, never deleted
```

`{output}` lives in the main checkout, never in a worktree. Work-item id (`work`) = folder name, e.g. `20261026-tenant-export`. Date = creation day, never changes.

Workflow and phase ids (`workflow` in `events.jsonl`, `phase` / `phases` in `state.json`) are the skill names without the `agentic-` prefix: `agentic-to-spec` logs as `to-spec`.

## decisions.md

Every grill answer, appended right after the user gives it, then logged as a `decision` event. IDs (`D1`, `D2`…) continue across every grill of the work item.

```markdown
## D3 · structural · tech
**Q:** Where are export files stored?
**A:** Object storage, 30-day expiry (recommended | alternative | deferred)
**Why:** Reuses the attachments bucket; DB rows would bloat backups.
**Supersedes:** D1 (optional)
```

- Heading: `## {id} · {tag} · {focus}`. `focus` ∈ `product`, `functional`, `tech`: the grill that asked.
- `tag` **structural**: changes the shape of the product or the implementation (scope, user-visible behaviour, data model, public contract, boundaries, dependencies, security, cost). Costly to reverse. The escalation gate reviews these.
- `tag` **minor**: cheap to change later (naming, copy, log levels, defaults).
- Answer origin: `recommended` (user took the recommendation), `alternative` (user picked another option), `deferred` (user deferred; recommendation taken with their yes).
- An answer that invalidates an earlier decision is a new entry with `**Supersedes:**`; the old entry stays.

## events.jsonl

One JSON object per line, appended, never edited. Exactly the fields and `type` values below; anything more goes in `data`, shaped per type.

```json
{"ts":"2026-10-26T13:40:00Z","work":"20261026-tenant-export","run":"a3f9","harness":"cursor","workflow":"implement","step":"implement","task":"T2","type":"started","model":"composer-2.5","effort":"medium","agent":"impl-T2","summary":"T2 started: DELETE /exports/:id with tenant guard","data":{"goal":"Delete an export, tenant-scoped","files":["src/exports/routes.ts","src/exports/service.ts"]}}
```

| Field | Required | Value |
|---|---|---|
| `ts` | yes | ISO 8601 UTC |
| `work` | yes | Work-item id |
| `run` | yes | 4 hex chars, new per workflow invocation |
| `harness` | yes | `claude`, `cursor` or `codex`: the harness writing the line |
| `workflow` | yes | `to-spec`, `to-plan`, `to-tickets`, `implement`, `review`, `babysit-pr`, `cleanup`, `grill-me`, `grill-product`, `grill-functional`, `grill-tech`, `implement-feature`, `change-feature`, `debug`, `pr-review`, `security-audit` |
| `step` | yes | Step key (`context.code`, `review.code-review`, …), interactive step (`capture`, `grill`, `gate`, `checks`), playbook step (`start`, `diagnose`, `audit`, `report`, `publish`, or the flow skill it runs: `to-spec`, `implement`, …), or `null` for the workflow itself |
| `type` | yes | `started`, `progress`, `completed`, `failed`, `decision`, `escalation`, `artifact`, `gate`, `note` |
| `task` | when scoped | Unit: plan task (`T2`), ticket (`03-delete-export` or tracker key), fix group (`fix-{n}.{k}`, e.g. `fix-2.1`); or PR round (`round-3`). Always set on a unit's subagent and `checks` lines |
| `iteration` | review loop | Review iteration `{n}` |
| `agent` | subagent events | Stable label of the subagent (`impl-T2`, `review.ub-mode-2`), same on all its lines |
| `model`, `effort` | when a model ran | Resolved model id and effort that actually ran; the requested ones when the harness doesn't report them |
| `summary` | yes | One line a human understands without context: what happened and to what |
| `ref` | no | Path + optional `#anchor`. Relative to the work-item folder; repo files (`docs/…`) relative to repo root |
| `data` | no | Object, shapes below |

`data` by type:

| Type | `data` |
|---|---|
| `started` (subagent) | `{goal, files?}` |
| `started` (`step: null`) | optional `{title}` |
| `progress` | optional `{files?, commit?, tests?}` |
| `completed` (subagent) | `{files?, commits?, tests?, counts?}` — `counts`: `{blocker, major, minor, nit}` for reviewers |
| `failed` | `{reason}`, plus `blocked: true` when the user must act (limit hit, red tree), or `interrupted: true` when a resume closes work cut off with its session |
| `decision` | `{id, question, answer, tag, focus}`, as in decisions.md. Workspace: `{workspace: {kind, branch, base, path}}`. Choice (any non-grill answer): `{choice: {key, value}}`. Undotted key = up-front answer, reused on resume (`tickets`, `tracker`, `branch`). Dotted key = one occurrence (a unit, a round, a thread, a pass), read only by the skill that asked (`interrupted.{run}.{unit}`, `unit.{task}`, `review.{n}`, `review.output`, `needs-user.{id}`, `pr.{round}.{thread}`, `pr.{round}.conflict`, `disclosure.{destination}`, `seam.{run}`, `profile.run-{N}`, `destination.run-{N}`) |
| `gate` | Per decision: `{decision, outcome}` — `outcome` `confirm`, `escalate`, `revisit`. Gate passed: `{passed: true, decisions: [ids]}` (ids reviewed, empty when none). Override: `{override: true, escalations: [ids]}` |
| `escalation` | `{id, status, ref}` — `id` the decision (`D4`), `status` `open` or `resolved`, `ref` its ADR or RFC |
| `artifact` | `{name, path}` for a file, and/or one merged shape: `{tickets: {parent, tasks}}`, `{issues: {parent, children}}` (agentic-security-audit; never units), `{pr: {url, round}}` (agentic-babysit-pr, alone) |

### What to log

Enough to follow the work from outside without opening the session: every unit of work has a `started` and a `completed` / `failed`, and long ones show `progress` in between. Not tool calls.

| Who | Logs |
|---|---|
| Orchestrator | New 4-hex `run` per skill invocation. Workflow `started` / `completed`; each step `started` / `completed` (interactive ones and playbook steps too); each subagent dispatch (`started`, with goal and files, before spawning it) and return (`completed` with its result, or `failed`, as soon as it returns); every green gate (`step: checks`, `task` = the unit, one line per unit of a parallel batch; pass or fail + what broke); every review iteration (counts per reviewer, fix groups); every PR round (what changed: CI status, new comments, fixes pushed); decisions, gates, escalations, artifacts |
| Writing subagent | `progress` at each milestone of its own work, e.g. implement: tests written (failing as expected) → implementation done → checks green → committed `abc123`. Fix-list unit: finding understood → fixed (or disputed) → checks green → committed |

Subagents append only `progress` lines, with their `agent` label, as one shell append (`>> events.jsonl`) per line; `state.json` and every other event type are the orchestrator's. Read-only subagents write nothing; the orchestrator logs their start and result.

A task, read from the log:

```jsonl
{"ts":"…T14:02:10Z","workflow":"implement","step":"implement","task":"T2","type":"started","agent":"impl-T2","model":"composer-2.5","effort":"medium","summary":"T2 started: DELETE /exports/:id with tenant guard", …}
{"ts":"…T14:04:55Z","workflow":"implement","step":"implement","task":"T2","type":"progress","agent":"impl-T2","summary":"3 tests written, failing as expected (404, cross-tenant 403, happy path)", …}
{"ts":"…T14:09:30Z","workflow":"implement","step":"implement","task":"T2","type":"progress","agent":"impl-T2","summary":"Route and service implemented, tests green", …}
{"ts":"…T14:10:02Z","workflow":"implement","step":"implement","task":"T2","type":"progress","agent":"impl-T2","summary":"Committed f14b28c feat(exports): delete export", …}
{"ts":"…T14:10:20Z","workflow":"implement","step":"implement","task":"T2","type":"completed","agent":"impl-T2","model":"composer-2.5","effort":"medium","summary":"T2 done: 2 files, 3 tests, commit f14b28c", …}
{"ts":"…T14:11:40Z","workflow":"implement","step":"checks","task":"T2","type":"completed","summary":"Green gate after T2: build, lint, typecheck, 214 tests pass", …}
```

`state.json` ignores `progress` lines.

## state.json

```json
{
  "work": "20261026-tenant-export",
  "title": "Tenant data export",
  "status": "in_progress",
  "phase": "to-plan",
  "phases": { "to-spec": "done", "to-plan": "in_progress" },
  "workspace": { "kind": "worktree", "branch": "feat/tenant-export", "base": "main", "path": "/home/me/dev/shop-worktrees/tenant-export" },
  "artifacts": { "spec": "spec.md", "plan": null },
  "escalations": [{ "id": "D4", "summary": "Exports stored 30 days", "status": "open", "ref": "docs/tech/adr/0007-export-retention.md" }],
  "tickets": { "parent": null, "tasks": {} },
  "issues": { "parent": null, "children": {} },
  "steps": {},
  "units": { "T1": "done", "T2": "in_progress" },
  "choices": { "tickets": "no" },
  "pr": { "url": null, "round": 0 },
  "updated": "2026-10-26T13:52:00Z"
}
```

Rewritten by the orchestrator after every event it logs, derived from the log only; on disagreement the log wins.

| Field | From |
|---|---|
| `title` | Latest `data.title` |
| `phase` | Workflow of the latest workflow-level `started` |
| `phases` | Per workflow: `in_progress` on `started`, `done` on `completed`, `failed` on `failed` (`step: null`) |
| `workspace` | Latest `data.workspace`, else `null`. `kind` ∈ `worktree`, `current`, `branch`; `base` = branch it starts from and the PR targets; `path` absolute |
| `artifacts` | `data.name` → `data.path` |
| `escalations` | Latest status per `id` |
| `tickets`, `issues`, `pr` | Merged from `artifact` data |
| `steps` | Per playbook step (events whose `workflow` is a playbook, `step` not null) of the current pass, i.e. after that playbook's latest workflow-level `completed`: `in_progress` on `started`, `done` on `completed`, `failed` on `failed`. Cleanup events (`workflow` or `step` = `cleanup`) never open a pass: ignored here |
| `units` | Latest status per `task` of `implement` events: plan tasks, tickets, fix groups. `in_progress` on the subagent `started`; `done` on a green gate (`step: checks`, `completed`) naming it; `failed` on a `failed` with `step: implement` (subagent failed, or stopped after `limits.implement.retries`); `skipped` on a `choice` `unit.{task}` = `skip`; pending again on an `interrupted` `failed`. Red gates don't change it. Absent → pending |
| `choices` | Latest `value` per `data.choice.key` |
| `status` | `archived` once `cleanup` completes; else `awaiting_decision` if any escalation `open`; else `blocked` if latest `failed` has `data.blocked`; else from the latest workflow-level event (`step: null`, cleanup events excluded), so a new pass after `completed` reads as not done: `failed` → `failed`; `completed` of `babysit-pr` or a playbook (`implement-feature`, `change-feature`, `debug`, `pr-review`, `security-audit`) → `done`; anything else → `in_progress` |
| `updated` | `ts` of the last event |

## Resume

Any agentic skill given a slug resumes its work item, from any harness: `/agentic-<skill> <slug>` (Claude Code, Cursor) or `$agentic-<skill> <slug>` (Codex). Same machine only: `{output}` is gitignored in the main checkout and `workspace.path` is absolute.

Before logging the new run's `started`, in order:

0. **Open escalations**: every escalation `open` in `state.json`, except those an open run (your caller's, same session) already overrode. Per escalation, show its decision and `ref`, then ask the user:
   - **decided** → take their answer. Call the Skill tool with "agentic-use-knowledge" (write mode) in the recorded `workspace.path` (gone → step 2 first): ADR `Proposed` → `Accepted`, its Decision rewritten when the answer differs (plus a `decisions.md` entry superseding the escalated one); RFC → `Decided → ADR-NNNN` with its ADR. Commit (`docs: …`). Log `escalation` `{id, status: "resolved", ref}`.
   - **override** → continue with it open. Log `gate` `{override: true, escalations: [ids]}`.
   - **stop** → end the skill here.

   Done when every listed escalation is resolved or overridden, or the skill stopped.
1. **Other sessions**: open run = workflow-level `started` with no `completed` / `failed` for its `run`. Only the entry skill (the one the user invoked) checks: every open run then belongs to another session (a playbook and its nested skills can leave several). Skills it calls skip this check: the open runs they see are their callers, same session. Open runs → list them (workflow, `run`, harness, last event time) in one question: are those sessions stopped? Yes → per open run, log `failed` with its `run` and `workflow`, `step: null`, `data: {reason: "session stopped, confirmed by user", interrupted: true}`. No → stop. Done when no run is open.
2. **Workspace**: reuse the recorded `workspace`; path gone or not writable → agentic-use-workflow Workspace. Done when `workspace.path` is writable, or none is recorded yet.
3. **Answers**: reuse `workspace` and undotted `choices`; ask only what is missing. Dotted keys answer one occurrence: never reused here. Done when no answered up-front question is asked again.
4. **Unfinished fix list**: latest `reviews/{n}-fix.md` has findings without a `status` → its owner (agentic-review, agentic-babysit-pr) passes it to agentic-implement before anything else. Done when every finding has a status.
5. **Steps**: a playbook skips every step `done` in `steps` (`start` included, so its questions aren't asked again; `to-spec` isn't re-run) and every step its `choices` rule out, then continues at the first remaining one. `start` is done once its choices and `workspace` are recorded. Done when that step runs; a flow skill resumes its own work (agentic-implement recovers interrupted units first).

An abrupt stop (usage limit, crash) loses at most the in-flight units, since each subagent is logged before it spawns and as soon as it returns. Give the entry skill's resume command (the playbook's, under a playbook) once when a playbook turns autonomous, and again whenever a skill stops before its end.
