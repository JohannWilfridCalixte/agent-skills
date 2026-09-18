# Canonical workflow state

## Representation and ownership

`workflow-state.yaml` contains a JSON object (valid YAML 1.2), `schema_version: 2`, and integer `state_version`. This removes YAML parser/tool differences while retaining the established filename. `technical_skills_prompt` is always `string[]`; skill instructions belong in files, not embedded block-scalar prompts.

One orchestrator is the canonical writer. Workers write only assigned artifacts and return proposed changes/results. Nested review keys isolate logical state but do not authorize concurrent writes to the state file. The orchestrator accepts a result only after checking its task ID, scope, input revision, output paths, and required evidence.

Use `node <helper> save-state <path> <next.json> <expected_version|null>`. Pass `null` for creation and the previously read version for updates. The helper validates, checks the expected version under an exclusive lock, writes a temporary sibling file, then atomically renames it. A version mismatch means reread the latest state and apply the still-relevant result once; do not overwrite the newer state or blindly replay an old whole-file snapshot. Lock contention is a retryable conflict, not evidence that another writer may be ignored. Do not remove a lock whose owner may still be active. A crashed writer requires verifying that ownership has ended before recovery.

Start from the [template](workflow-state.yaml), replacing example identity/timestamps with observed values. The unsaved template starts at 0; creation persists version 1 and successful updates increment it. Run `validate-state <file>` for read-only validation. Helpers validate contracts; they do not execute phases, approve gates, or establish test success on their own.

## Required field contracts

| Field | Shape and meaning |
|---|---|
| `workflow`, `run_id`, `topic`, `output_path` | Workflow ID (or `custom`), stable run ID/topic, run directory. |
| `started_at`, `updated_at`, `completed_at` | UTC ISO timestamps; completion is null until run ends. |
| `status`, `current_step`, `steps_completed` | Status below; numeric current step; array of `{step,name,completed_at,output?}`. Complete a step only once. |
| `technical_skills_prompt`, `execution_context` | Skill identifier array and effective config/model/capability/provenance object. |
| `repo` | `{root,branch,base_sha,head_sha}` for the actual checkout. Update head after verified integration/commit. |
| `plan` | Null, or `{path,revision,accepted_revision}`. Accepted revision reflects an approval receipt, not a new file timestamp. |
| `tickets` | ID → `{status,owner,plan_revision,commit}`; owner and commit may be null. Runtime source of truth. |
| `gates` | Array of `{id,kind,status,revision,scope,evidence}`; scope is an array of ticket/requirement/operation IDs. |
| `decisions` | Array of `{id,step,decision,reason}`; stable IDs allow plan/docs to reference one decision body. |
| `artifacts` | Named paths for produced artifacts; related evidence records identify their revision and purpose. |
| `checks` | Array of `{id,command,status,revision,plan_revision,exit_code,output_path,requirements}`. |
| `requirements` | AC-ID → `{status,evidence:[{check_id,criterion,revision}]}`. |
| `review_loops`, `prs`, `knowledge`, `telemetry` | Objects owned by their respective contracts and merged only by the orchestrator. |

Additional workflow fields may describe hypotheses or graph execution, but cannot redefine these fields. Keep all references resolvable. A check may set `required: true` to enforce a final gate. For an unavailable check, use `status: unavailable` and `exit_code: null`; preserve the reason in its output artifact. Passed/failed checks contain the actual command, exit status, captured output, exact candidate revision, and requirement IDs they assess. An explicit `execution_context.commit_mode: none` permits final ticket status `integrated` with `commit: null` and verified immutable snapshot evidence; it does not remove review or test gates.

`gates`, `checks`, and `review_loops` contain current acceptance prerequisites. Before replacing superseded, invalidated, or failed receipts during recovery, append their complete original records to `history: {gates: [], checks: [], review_loops: []}` with original IDs, revisions, and an archival reason. For keyed loops preserve the original key too. History is append-only and never used to claim current acceptance. Archive replaced records before removing them from active collections; never clear a failure without retaining its evidence. Debug's expected failing regression receipt is historical and `required: false`; its final passing regression and full-suite receipts are current and `required: true`.

## Status transitions

| Status | Meaning and permitted next action |
|---|---|
| `pending` | Initialized but not started; may enter `in_progress` or `cancelled`. |
| `in_progress` | Work is active; may advance phases or enter any outcome below once its predicate holds. |
| `awaiting_input` | A required unresolved user decision; resume `in_progress` after the decision is recorded, or cancel. |
| `blocked` | A concrete prerequisite/tool/access problem prevents progress; resume after evidence it is resolved, or fail/cancel. |
| `escalated` | Workflow limit or technical contradiction requires human direction; halt affected work and retain evidence. Resume only after direction changes the execution conditions, or fail/cancel. |
| `completed` | All prescribed work and gates passed; set `completed_at`. |
| `failed` | Work could not finish; preserve error/evidence, set `completed_at`, report it. |
| `cancelled` | User cancelled the run; preserve completed work and set `completed_at`. |

`completed`, `failed`, and `cancelled` are terminal for that run. Further work starts a linked run; prior evidence remains available. Paused statuses keep `completed_at: null`. A failed step is recorded immediately. If its workflow defines recovery, enter that documented recovery before any later step; otherwise mark failed and report. Never silently advance through failure.

Ticket statuses are `pending → ready → in_progress → reviewing → ready_to_integrate → integrated → committed`. `blocked` is available with a recorded reason; recovery returns to the last valid phase. A rejected review returns to `in_progress`; changed inputs invalidate later statuses/evidence. An owner exists only while a worker owns that scope. The orchestrator alone marks integration/commit after the relevant gate. Markdown status labels are derived views, never proof of completion.

## Checkpoints and gates

Every step completion appends its receipt and advances `current_step` to the next defined step. At the last step, keep its number and set final status only after final checks. Each artifact/check/decision/gate is saved when produced; waiting for the end risks losing evidence.

Gate `status` is `pending`, `approved`, `rejected`, or `invalidated`. `kind` describes the actual gate (for example structural decisions, ticket quiz, branch, remote publication). Bind approval to the exact accepted plan/content revision and scope, and store the user's instruction/response or verified check artifact as `evidence`. An authorized earlier instruction can satisfy the same gate; quote or link it once. Initialization receipts are not gates. User authorization to write locally is not automatically authorization to message third parties.

When a plan/scope changes, run `impact` against old and new plans; compare affected requirements, tickets, and dependency descendants. Mark affected gate receipts invalidated. Preserve unaffected authorizations and results by recording why they remain applicable; any approval required for the new sealed revision uses a concrete changed-scope summary. Time passing, worker completion, or tool success cannot approve a user gate.

## Concurrent results and failure example

Workers A and B return separate review artifacts at the same time the parent is finalizing. Both outputs are queued for the orchestrator; neither edits canonical state. Apply A's `review_loops` result at version N, save N+1, reread, apply B, save N+2. Evaluate completion against both results and all other gates, then save the final outcome. A stale proposal with expected N is rejected instead of losing B's result.

If debug exhausts three hypotheses, preserve `debug.hypothesis_loop.iteration: 3`, `debug.hypothesis_loop.status: escalated`, and `artifacts.escalation`; top-level `status: escalated` is valid. Halt; do not report completed just because other worker loops passed.

## Resume and evidence

Before skipping work, load state and accepted durable plan; run `validate-state`, `validate-plan`, and `resume-check`. Verify repository root/branch, plan revision, recorded commit reachability, and current expected effects. A reachable commit may have been reverted; a green historical check may cover another tree. Changed/unverified effects return the affected ticket and requirements to verification/work, not a blind skip. Preserve reusable unaffected evidence with explicit provenance.

Use an immutable commit/tree/patch identity for the code under review. Store an uncommitted candidate identity in `execution_context.candidate_revision`; otherwise the current candidate is `repo.head_sha`. Check/evidence `revision` fields must match that exact candidate, and `plan_revision` identifies accepted intent. The full-suite integration receipt sets `required: true`. Evidence at another head remains historical/unverified until revalidated or explicitly carried forward with current-revision evidence. The workflow's integration contract controls staging and freezing writers; a revision label without an immutable snapshot is insufficient.

### Enforced receipt retention

When replacing a settled check, gate, or review result, append `{ "record": <original complete record>, "archival_reason": "why superseded", "archived_at": "observed UTC timestamp" }` to the matching `history` array before saving. Review history also retains its original `scope_id`. `save-state` rejects removal/replacement without preserved evidence and rejects deletion, rewriting, or reordering of previously saved history. Keep current unmet obligations active; archiving is for superseded candidates or explicitly replaced scope, never a way to hide a failing current gate. Historical failed checks remain evidence even after a later candidate passes.
