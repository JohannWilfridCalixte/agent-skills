# Merges

From a `pr-ready` note to an archived session: SKILL.md step 4.

## PR ready

`pr-ready` note → check its claims (SKILL.md step 4): PR open → `manager unit set <id> --state pr --pr <url>`; its `merge-yes` line → Ask.

Done when the unit is `pr`.

## Merge order

Deps first (a stacked chain from its base up), then units others `wait` on, then the rest by readiness. Each `merge-yes` line in that order.

## Ask

`mcp__ccd_pr__get_status` on the unit's session. **Reviewed** = review decision approved, or, for a playbook unit, its own review step reported clean in its `pr-ready` block.

- Checks pending → `SendMessage` the unit: wait for them in this turn (`gh pr checks <url> --watch`), then report `pr-ready` again.
- Checks failing, changes requested or merge conflicts (Conflicts) → `SendMessage` the unit what is missing.
- A human review only the owner can give → owner.
- Checks green and reviewed → head sha: `gh pr view <url> --json headRefOid -q .headRefOid`. One AskUserQuestion naming the PR url and that sha: merge and archive the session after cleanup / merge, keep the session / not yet. Every PR and every new head gets its own yes; the answer stands per SKILL.md step 4.

Done when the owner answered for that head, or the unit got its message and is `running` (SKILL.md Hand-off).

## Merge

On yes, read the head sha again: moved since the ask → Ask again. Same → `SendMessage` the owning unit quoting the owner's yes and the approved sha: merge at that sha, clean up, report. Playbook units merge with `agentic.ts merge`; others with `gh pr merge <url> --squash --match-head-commit <sha>`.

Done when the unit got the message and is `running` (SKILL.md Hand-off).

## Verify

A unit sent a merge reports `done` ([relay.md](relay.md) Done) → `gh pr view <url> --json state,headRefOid`. `MERGED` at the approved sha → `unit set --state merged`, then `manager status` and act on its `release` and `resume` lines (After merge). Merged at another sha → tell the owner at once. Still open → the claim fails: `SendMessage` the unit what is missing.

Done when the unit is `merged` and that status's `release` and `resume` lines are acted on, or the owner has the mismatch.

## After merge

From `manager status`:

- `hold <id>` → the unit keeps holding implementation; nothing to send.
- `release <id>` → message the waiting unit: dep merged, update from the fresh default branch, start implementation.
- `resume <id>` → message the paused unit: update onto the new base, resume.
- Stacked dependents → message each: retarget the PR onto the default branch, rebase.

Done when every released, resumed and stacked unit got its message and is `running`.

## Conflicts

The owning unit resolves them. Non-mechanical (a behaviour choice) → question to the owner ([relay.md](relay.md)).

Done when the unit reports the PR mergeable again, or the owner has the question.

## Teardown

Only after Verify is done (`merged`, then a `manager status`). Cleanup missing from the unit's note → `SendMessage` it to clean up; its next note → here. Merge yes included archive → `archive_session` (the app asks the owner to approve; a session mid-turn is not archived: retry next wake). Then `unit set <id> --summary …`; the unit stays `merged` (SKILL.md Kept states).

Done when the unit is `merged` with its summary.
