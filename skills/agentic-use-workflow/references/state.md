# Work-item state

## Layout

```
{output}/{YYYYMMDD}-{slug}/
├── events.jsonl      # append-only audit log (source of truth)
├── state.json        # snapshot, rewritten after every event, never holds info absent from the log
├── input.md
├── context.md        # cited, one section per context subagent
├── decisions.md      # grill Q/A, tagged structural | minor
├── spec.md           # full mode only
├── plan.md           # tasks consumed by agentic-implement and agentic-to-tickets
├── implementation.md
├── reviews/{iteration}-{lens}.md
└── pr.md

{output}/_archive/{YYYYMMDD}-{slug}/   # moved here by agentic-cleanup once merged, never deleted
```

`{output}` lives in the main checkout, never in a worktree. Work-item id (`work`) = folder name, e.g. `20261026-tenant-export`. Date = creation day, never changes.

Workflow and phase ids (`workflow` in `events.jsonl`, `phase` / `phases` in `state.json`) are the skill names without the `agentic-` prefix: `agentic-to-spec` logs as `to-spec`.

## events.jsonl

One JSON object per line, appended, never edited. Exactly these fields and types: never invent others (`step_start`, `step_end`, top-level `path`, …).

```json
{"ts":"2026-10-26T13:40:00Z","work":"20261026-tenant-export","run":"a3f9","workflow":"implement","step":"implement","task":"T2","type":"started","model":"composer-2.5","effort":"medium","agent":"impl-T2","summary":"T2 started: DELETE /exports/:id with tenant guard","data":{"goal":"Delete an export, tenant-scoped","files":["src/exports/routes.ts","src/exports/service.ts"]}}
```

| Field | Required | Value |
|---|---|---|
| `ts` | yes | ISO 8601 UTC |
| `work` | yes | Work-item id |
| `run` | yes | 4 hex chars, new per workflow invocation |
| `workflow` | yes | `to-spec`, `to-plan`, `to-tickets`, `implement`, `review`, `babysit-pr`, `cleanup`, `ship-feature` |
| `step` | yes | Step key (`context.code`, `review.fix`, …), interactive step (`capture`, `grill`, `gate`, `triage`, `checks`), or `null` for the workflow itself |
| `type` | yes | `started`, `progress`, `completed`, `failed`, `decision`, `escalation`, `artifact`, `gate`, `note` |
| `task` | when scoped | Plan task (`T2`), finding group (`fix-1`) or PR round (`round-3`) |
| `iteration` | review loop | Review iteration number |
| `agent` | subagent events | Stable label of the subagent (`impl-T2`, `review.security-2`), same on all its lines |
| `model`, `effort` | when a model ran | Model id and effort that actually ran. Never `inherit`: resolve it; if the harness doesn't report it, the requested id |
| `summary` | yes | One line a human understands without context: what happened and to what |
| `ref` | no | Path + optional `#anchor`. Relative to the work-item folder; repo files (`docs/…`) relative to repo root |
| `data` | no | Object, shapes below |

`data` by type:

| Type | `data` |
|---|---|
| `started` (subagent) | `{goal, files?}` |
| `started` (`step: null`) | optional `{title, mode}` |
| `progress` | optional `{files?, commit?, tests?}` |
| `completed` (subagent) | `{files?, commits?, tests?, counts?}` — `counts`: `{blocker, major, minor, nit}` for review lenses |
| `failed` | `{reason}`, plus `blocked: true` when the user must act (limit hit, red tree) |
| `decision` | `{id, question, answer, tag}` — `id` `D1`…, `tag` `structural` or `minor`. Triage: `{mode}`. Workspace: `{workspace: {kind, branch, base, path}}` |
| `gate` | `{decision, outcome}` — `outcome` `confirm`, `escalate`, `revisit`. Override: `{override: true, escalations: [ids]}` |
| `escalation` | `{id, status, ref}` — `status` `open` or `resolved` |
| `artifact` | `{name, path}`, optionally `{tickets: {parent, tasks}}` or `{pr: {url, round}}` |

### What to log

Enough to follow the work from outside without opening the session: every unit of work has a `started` and a `completed` / `failed`, and long ones show `progress` in between. Not tool calls.

| Who | Logs |
|---|---|
| Orchestrator | Workflow `started` / `completed`; each step `started` / `completed` (interactive ones too); each subagent dispatch (`started`, with goal and files) and return (`completed` with its result, or `failed`); every green gate (`step: checks`, pass or fail + what broke); every review iteration (counts per lens, fix groups); every PR round (what changed: CI status, new comments, fixes pushed); decisions, gates, escalations, artifacts |
| Writing subagent | `progress` at each milestone of its own work, e.g. implement: tests written (failing as expected) → implementation done → checks green → committed `abc123`. Review fix: finding understood → fixed → checks green → committed |

Subagents append only `progress` lines, with their `agent` label, as one shell append (`>> events.jsonl`) per line. Never rewrite the file, never write another type, never touch `state.json`. Read-only subagents don't write; the orchestrator logs their start and result.

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
  "mode": "full",
  "status": "in_progress",
  "phase": "to-plan",
  "phases": { "to-spec": "done", "to-plan": "in_progress" },
  "workspace": { "kind": "worktree", "branch": "feat/tenant-export", "base": "main", "path": "/home/me/dev/shop-worktrees/tenant-export" },
  "artifacts": { "spec": "spec.md", "plan": null },
  "escalations": [{ "id": "D4", "summary": "Exports stored 30 days", "status": "open", "ref": "docs/tech/adr/0007-export-retention.md" }],
  "tickets": { "parent": null, "tasks": {} },
  "pr": { "url": null, "round": 0 },
  "updated": "2026-10-26T13:52:00Z"
}
```

Derived from the log only:

| Field | From |
|---|---|
| `title`, `mode` | Latest `data.title` / `data.mode`. `mode` ∈ `light`, `full`, `null` (not triaged; `to-spec` implies `full`) |
| `phase` | Workflow of the latest workflow-level `started` |
| `phases` | Per workflow: `in_progress` on `started`, `done` on `completed`, `failed` on `failed` (`step: null`) |
| `workspace` | Latest `data.workspace`, else `null`. `kind` ∈ `worktree`, `current`, `branch`; `base` = branch it starts from and the PR targets; `path` absolute |
| `artifacts` | `data.name` → `data.path` |
| `escalations` | Latest status per `id` |
| `tickets`, `pr` | Merged from `artifact` data |
| `status` | `archived` once `cleanup` completes; else `awaiting_decision` if any escalation `open`; else `blocked` if latest `failed` has `data.blocked`; else `failed` if latest workflow-level event is `failed`; else `done` once `babysit-pr` or `ship-feature` completes; else `in_progress` |
| `updated` | `ts` of the last event |
