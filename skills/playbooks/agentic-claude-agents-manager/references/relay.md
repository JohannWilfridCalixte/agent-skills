# Relay

Unit notes and the owner's answers: SKILL.md step 4.

## Read a note

Status line first: `Unit <id>: <status>`. Note cut at 400 chars → the full final message via `list_events` (page back with `before_uuid` past trailing task-notification lines). No status line → act on the content, then `SendMessage` the unit its relay block (`manager brief <id>`, from `## Relay protocol` on).

## Question

Per numbered question: `manager question open <unit> --text … --option …`, recommended option first → `Q<n>`. Then `manager unit set <id> --state waiting`.

Auto-answer test, per question: an `R<n>` rule covers it, a `preset:<key>` of the unit answers it, or another unit's answered `Q<n>` is the identical question. Passes → `manager question answer Q<n> --answer … --by manager --basis …` plus its chat line (SKILL.md Authority). Anything else → owner.

Owner: AskUserQuestion, questions of several units batched (≤ 4 per call), unit id in each question, recommended option first. A unit announcing a coming decision → ask the owner then, before its formal question: it saves a stalled turn.

Done when every question is answered or put to the owner.

## Answer

Owner's answer → `manager question answer Q<n> --answer … --by user`; a general rule in it → also `manager rule add`. Every answer, manager's or owner's: `SendMessage` to the unit's `local_…` id, one line `Q<n>: <answer>` per question, the owner's words quoted for approvals. Then `unit set --state running`.

Done when the unit got every answer and `manager status` shows it `running`.

## Blocked

Unblock from the ledger (an answer, a merged dep, a sidequest), else ask the owner. `blocked` on a `wait` dep (holding before code) → leave it until its `release` line.

## Done

Verify the claims: commits on its branch, tests, cited files exist. Holds → `manager unit set <id> --state done --summary …`. Failed beyond recovery → owner, then `--state failed`. Unit with a merged PR → [merges.md](merges.md) Teardown.

## Permission prompt

Nothing wakes the manager. Heartbeat sees no progress and the last event is a tool call awaiting approval → tell the owner at once, with the session link `[title](#local_…)`.

## Attended units

The owner talks in the unit. The manager watches (heartbeat, PRs, merges) and relays nothing.
