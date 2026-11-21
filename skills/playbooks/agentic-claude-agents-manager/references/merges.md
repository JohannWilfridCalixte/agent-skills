# Merges

From a `pr-ready` note to an archived session: SKILL.md step 4.

## PR ready

`mcp__ccd_pr__get_status` on the unit's session. **Reviewed** = review decision approved, or, for a playbook unit, its own review step reported clean in its `pr-ready` block. CI green and reviewed → `manager unit set <id> --state pr --pr <url>`. CI red or review findings → `SendMessage` the unit what is missing; a human review only the owner can give → owner.

Done when the unit is `pr`, or it or the owner got what is missing.

## Merge order

Deps first (a stacked chain from its base up), then units others `wait` on, then the rest by readiness. Each `merge-yes` line in that order.

## Ask

Per PR, one AskUserQuestion naming the PR url and its head sha (`get_status`): merge and archive the session after cleanup / merge, keep the session / not yet. Every PR and every new head gets its own yes; the answer stands per SKILL.md step 4.

Done when the owner answered for that head.

## Merge

On yes, `get_status` first: head moved since the ask → Ask again. Same head → `SendMessage` the owning unit quoting the owner's yes and the approved sha. Playbook units merge with `agentic.ts merge` (it checks the head itself); others with `gh pr merge <n> --squash --match-head-commit <sha>`. `mcp__ccd_pr__get_status` shows it merged → `unit set --state merged`, then `manager status` and act on its `release` and `resume` lines (After merge).

Done when the unit is `merged` and that status's `release` and `resume` lines are acted on.

## After merge

From `manager status`:

- `hold <id>` → the unit keeps holding implementation; nothing to send.
- `release <id>` → message the waiting unit: dep merged, update from the fresh default branch, start implementation; `unit set --state running`.
- `resume <id>` → message the paused unit: update onto the new base, resume; `unit set --state running`.
- Stacked dependents → message each: retarget the PR onto the default branch, rebase.

Done when every released, resumed and stacked unit got its message.

## Conflicts

The owning unit resolves them. Non-mechanical (a behaviour choice) → question to the owner ([relay.md](relay.md)).

## Teardown

Only after Merge is done (`merged`, then a `manager status`). The unit reports its cleanup done. Merge yes included archive → `archive_session` (the app asks the owner to approve; a session mid-turn is not archived: retry next wake). Then `unit set --state done --summary …`.

Done when the unit is `done` with its summary.
