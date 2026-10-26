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
├── plan.md           # tasks consumed by implement and to-tickets
├── implementation.md
├── reviews/{iteration}-{lens}.md
└── pr.md
```

Work-item id (`work`) = folder name, e.g. `20261026-tenant-export`. Date = creation day, never changes.

## events.jsonl

One JSON object per line, appended, never edited.

```json
{"ts":"2026-10-26T13:40:00Z","work":"20261026-tenant-export","run":"a3f9","workflow":"to-spec","step":"context.code","type":"completed","model":"composer-2.5","effort":"medium","summary":"Mapped export module and tenant guard","ref":"context.md#code"}
```

| Field | Required | Value |
|---|---|---|
| `ts` | yes | ISO 8601 UTC |
| `work` | yes | Work-item id |
| `run` | yes | 4 hex chars, new per workflow invocation |
| `workflow` | yes | `to-spec`, `to-plan`, `to-tickets`, `implement`, `review`, `babysit-pr`, `ship-feature` |
| `step` | yes | Step key (`context.code`, `review.fix`, …), interactive step (`capture`, `grill`, `gate`, `triage`), or `null` for the workflow itself |
| `type` | yes | `started`, `completed`, `failed`, `decision`, `escalation`, `artifact`, `gate`, `note` |
| `model`, `effort` | when a model ran | Actually used, not requested |
| `summary` | yes | One line |
| `ref` | no | Path + optional `#anchor`. Relative to the work-item folder; repo files (`docs/…`) relative to repo root |
| `data` | no | Object, shapes below |

`data` by type:

| Type | `data` |
|---|---|
| `decision` | `{id, question, answer, tag}` — `id` `D1`…, `tag` `structural` or `minor`. Triage: `{mode}` |
| `gate` | `{decision, outcome}` — `outcome` `confirm`, `escalate`, `revisit`. Override: `{override: true, escalations: [ids]}` |
| `escalation` | `{id, status, ref}` — `status` `open` or `resolved` |
| `artifact` | `{name, path}`, optionally `{tickets: {parent, tasks}}` or `{pr: {url, round}}` |
| `started` (`step: null`) | optional `{title, mode}` |
| `failed` | optional `{blocked: true}` when the user must act (limit hit, red tree) |

## state.json

```json
{
  "work": "20261026-tenant-export",
  "title": "Tenant data export",
  "mode": "full",
  "status": "in_progress",
  "phase": "to-plan",
  "phases": { "to-spec": "done", "to-plan": "in_progress" },
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
| `artifacts` | `data.name` → `data.path` |
| `escalations` | Latest status per `id` |
| `tickets`, `pr` | Merged from `artifact` data |
| `status` | `awaiting_decision` if any escalation `open`; else `blocked` if latest `failed` has `data.blocked`; else `failed` if latest workflow-level event is `failed`; else `done` once `babysit-pr` or `ship-feature` completes; else `in_progress` |
| `updated` | `ts` of the last event |
