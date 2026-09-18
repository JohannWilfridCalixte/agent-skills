# Step 2: Process Tickets

## Frontier and ownership

Validate the graph before scheduling. Promote pending tickets to ready only when their current scope is approved and all known predecessors are verified integrated/committed. Run `frontier <plan.json> <state.yaml> <capacity>`; dispatch only ready, unowned tickets at the accepted revision whose predecessors are complete, whose write scopes/resources do not conflict, and for which a worker slot remains. Running/reviewing/ready-to-integrate lanes keep their reservation; recomputation never spawns a duplicate owner. Capacity one with 01 running means no dispatch of independent 02 until the slot is released. An empty frontier with active lanes waits for results; with unfinished work and no active lane, report the concrete blocked dependency/deadlock instead of spinning.

Parent assigns a unique owner and changes status to in_progress before dispatch. Per-lane task: implement accepted ticket paths, load selected skills and engineering contract, preserve scope, write behavior tests alongside, run scoped tests (not the full suite), return changed-path list/patch/snapshot identity and `implementation-log-{id}.md` using [the template](../references/implementation-log.md). Failed lanes return evidence; the parent releases ownership only after preserving recoverable work and records blocked/retry decisions.

New shared-file/resource needs stop the affected lanes, preserve snapshots and update dependencies/ownership through the plan-change path. Out-of-scope discoveries become proposed `follow-ups.md` entries; they are never silently implemented.

## Ticket review

Freeze the lane's result and invoke `review-loop` with `mode: repair`, `max_rounds: 2`, code/tests/security lenses, literal `scope_id: ticket/<id>/<plan-revision>`, its immutable repo/base/head/snapshot/diff target and exact repair write scope. Parent stores results under `review_loops[scope_id]`. Status reviewing → ready_to_integrate only on `passed`; blocked/max_reached never satisfies the gate. On exhaustion present existing choices (bounded further repair, authorized draft PR, or stop) with concrete findings; a larger budget requires an explicit new decision.

## Serialized integration and full-suite gate

One parent integration gate at a time; other isolated lanes may keep working.

1. Verify the lane patch contains only assigned ticket paths/hunks and excludes initial user changes. Apply it to the latest owned integration base. If the base changed, rebase/reapply without overwriting others; resolve conflicts through a worker. A changed candidate invalidates earlier review/check evidence: create its exact immutable snapshot and repeat the necessary review/scoped checks, within an explicitly recorded budget.
2. Run the **full test suite** on that exact isolated candidate. Record command, exit code, output and code/plan revision with `required: true` for this gate's current receipt. Archive superseded candidate checks under history with reasons; keep current failures active. Validate criterion-specific evidence with `coverage`; a green command alone does not mark every AC satisfied.
3. If green and reviews/criteria pass, stage only the exact owned ticket paths/hunks in the clean integration index, inspect the staged diff, and verify it equals the tested snapshot. Default: one conventional commit, title type/scope from ticket; body includes ticket ID/title and fulfilled AC IDs. Record commit SHA, integrated/committed transition and clear owner. Never `git add .` or commit pre-existing user changes. In `commit_mode: none`, apply the verified owned change set without staging/committing, preserve the user's index, record snapshot evidence and status integrated with commit null.
4. If red, attribute the failure using baseline/candidate evidence. Candidate regression → one bounded scoped fix round, review changed candidate and re-run the gate. Still red → pause with evidence. Unrelated/environmental failure → record blocked verification and proposed follow-up; do not charge it as a ticket-code fix or silently expand scope. Completion still requires the full-suite gate; no unapproved exemption or false green.
5. Issues stay open after local integration/commit; finalization follows the configured merge/release/manual lifecycle. Recompute eligibility from saved state.

### Shared-tree fallback

If worktrees are unavailable, freeze **all** source writers and acknowledge the freeze before gate work. Capture immutable per-owner diffs, the baseline and the exact ticket candidate in an isolated snapshot directory; exclude other lanes' unfinished patches and all user-owned changes. Review, full-suite test and stage/apply that same candidate. Reconcile the live tree/index against the snapshot before any commit, then release writers. If an isolated, attributable snapshot cannot be produced safely, return blocked; serial commits alone are not isolation.

Parent saves each check, decision, gate and status via the shared state contract, with observed telemetry. All tickets verified integrated/committed and no active workers → load step 3.
