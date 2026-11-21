# Merges

From a `pr-ready` note to an archived session: SKILL.md step 4.

## PR ready

`mcp__ccd_pr__get_status` on the unit's session. CI green and reviewed → `manager unit set <id> --state pr --pr <url>`. Else `SendMessage` the unit what is missing.

## Merge order

Deps first (a stacked chain from its base up), then units others `wait` on, then the rest by readiness. Each `merge-yes` line in that order.

## Ask

Per PR, one AskUserQuestion: merge and archive the session after cleanup / merge, keep the session / not yet. Every PR gets its own yes.

## Merge

On yes, `SendMessage` the owning unit, quoting the owner's yes. Playbook units merge with `agentic.ts merge`; others squash with head match (`gh pr merge <n> --squash --match-head-commit <sha>`). `mcp__ccd_pr__get_status` shows it merged → `unit set --state merged`.

Done when `manager status` shows the unit `merged`.

## After merge

From `manager status`:

- `hold <id>` → the unit keeps holding implementation; nothing to send.
- `release <id>` → message the waiting unit: dep merged, update from the fresh default branch, start implementation.
- `resume <id>` → message the paused unit: update onto the new base, resume; `unit set --state running`.
- Stacked dependents → message each: retarget the PR onto the default branch, rebase.

## Conflicts

The owning unit resolves them. Non-mechanical (a behaviour choice) → question to the owner ([relay.md](relay.md)).

## Teardown

The unit reports its cleanup done. Merge yes included archive → `archive_session` (the app asks the owner to approve; a session mid-turn is not archived: retry next wake). Then `unit set --state done --summary …`.

Done when the unit is `done` with its summary.
