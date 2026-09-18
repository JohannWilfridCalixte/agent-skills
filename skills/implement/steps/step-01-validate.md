# Step 1: Validate

Read the accepted spec directory, provenance and prior run state if resuming. Resolve the helper from the installed `use-workflow` skill's `scripts/agentic.mjs`, not an assumed source checkout. Invoke `validate-plan <plan.json>` and `validate-state <workflow-state.yaml>`; verify all sealed artifact hashes and approval scope/revision. Validation covers unique IDs, nonempty acceptance, known dependencies/requirements, cycles, safe paths and ordered overlapping ownership. Any missing/invalid required input triggers the entry hard gate. Do not fabricate approvals.

Load durable `acceptance.json` and run `validate-acceptance <plan.json> <acceptance.json>`. It must contain real structural/ticket approval evidence for the current sealed revision and complete scope. A fresh checkout can use that receipt without the original ignored run state. Genuine explicit approval supplied in the current session can satisfy the same gates; record and persist it as a durable receipt rather than fabricating a prior one. Only then set plan.accepted_revision. Missing/mismatched approval returns to the planning acceptance gate, not code work.

Resolve the execution context once through `use-agentic`, using ticket paths and explicit profile/model choices; pass its skill list to every worker. Retrieve relevant accepted knowledge through `use-knowledge`. Import repository-qualified issue-publication records with the resolved merge/release/manual issue closure policy.

## Repository and branch gate

Parent records repository root, branch, base/head SHA and an inventory of pre-existing tracked/untracked/index changes. Preserve those changes and their ownership. Suggest a feature branch using user/host convention, offer reuse of an existing non-main branch, and confirm once. An existing explicit branch choice satisfies the gate. Record commit mode (`per_ticket` by default, `none` for no-commit), delivery authorization and isolation capability. No source work begins before branch/scope confirmation.

Prefer an independent working tree for each lane and an exclusively owned integration tree. Parent creates/manages these; workers never mutate Git. If unavailable, use the freeze-and-snapshot fallback in step 2. Never stash, reset or stage unrelated user changes to create a clean baseline. If required user edits overlap the candidate, resolve ownership before proceeding.

## Verified resume

Run `resume-check <plan.json> <state.yaml>` and inspect its evidence requirements. The helper does not execute tests or prove acceptance. Before skipping a ticket, verify repository/branch identity, current accepted plan revision, recorded commit reachability (for committed work), and current expected effects using revision-bound checks/criteria. Reachability alone fails for reverted commits. Integrated no-commit work needs its saved snapshot/effects present and verified; no SHA is invented.

Reconcile interrupted states explicitly: inspect a claimed owner's actual activity, preserve their diff/result, and resume that lane or release a confirmed stale owner. After a crash between commit and state save, identify the exact ticket commit and verify its effect before recording it; never replay by label. If identity/effect/evidence is stale, return affected tickets to verification/work and invalidate their requirement evidence plus dependent tickets/gates.

For a changed plan, preserve old/new sealed manifests, run `impact`, and record affected and retained ticket IDs. Invalidate affected approvals/checks, show the concrete changed scope and obtain required approval. Archive superseded receipts in `history.gates`, `history.checks` and `history.review_loops` with their reason/candidate before replacing active records with the current pending gates and checks. Current failures stay active; archival must never hide an unmet prerequisite. Rebind retained approvals/evidence explicitly with reasons; do not re-ask unchanged structural decisions. Affected dependants cannot run on stale completion evidence.

Parent initializes/reconciles `tickets[id]` with status, owner, plan_revision and commit. Ready requires current approved scope and satisfied predecessors; runtime Markdown labels are only derived views. Save state, then load step 2.
