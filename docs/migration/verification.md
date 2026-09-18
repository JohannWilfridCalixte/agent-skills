# Migration verification

Recorded on 12 September 2026 against the uncommitted migration. Starting repository revision: `a15b9b6b0e5e024588669d0cd8ba27944ad989c7`. At that checkpoint, no commit, push, pull request or publication had been performed. Temporary Git repositories used by contract fixtures have their own test commits.

On 18 September 2026, before the owner-authorized commit, push and pull request, the contract suite passed again (28/28), library validation reported zero errors and all eleven protected TypeScript hashes matched. `git diff --check` also passed. The earlier compiler/runtime and behavioral evidence below was not rerun or reclassified as a new model benchmark.

## Results

| Check | Observed result | Scope |
|---|---|---|
| Node contract and regression suite | 28 passed, 0 failed | Config resolution, safe paths, graph scheduling, state/version/history, durable plans/acceptance, requirement evidence, change impact, telemetry, evaluation preparation, knowledge links, reverted-commit resumption, worktree isolation |
| Library validation | 18 packages; no errors; 11 protected TypeScript hashes match | Manifests, dependency names/cycles, reference paths, registry and protected package |
| Compatibility notices | 18 expected legacy-name warnings | Qualified names retained; strict-host alias adaptation remains an installer responsibility |
| Python examples | Four extracted current Markdown examples pass runtime and strict mypy checks; negative fixtures fail for their intended reasons | Python 3.13.3, mypy 1.16.1; Ruff 0.12.2 import check on the harness |
| Architecture examples | Strict compilation and runtime assertions pass | TypeScript 5.9.3; money, state transitions, application errors/retries/cancellation, outbox delivery and adapter error translation |
| Instrumentation example | Strict compilation and runtime assertions pass | TypeScript 5.9.3; required metadata, redaction, span cleanup, cancellation, concurrent tenant isolation, telemetry failure isolation |
| Independent runtime recheck | All six bounded repair checks pass; no unresolved findings | Original seven findings plus archive-retention follow-up resolved |
| Independent workflow recheck | All three findings resolved | Configured spec path, issue-closing policy, and PR identity including both base and head |
| Fresh wording probes | 5/5 migrated-library and 5/5 no-library responses satisfy the scenario criteria | One combined report-only/deadline/reverted-ticket scenario; stated actions only |

The TypeScript engineer package is unchanged in full: entry point, manifest, rules and examples. Architecture and instrumentation examples live in their own packages.

## Prompt size

Whitespace-delimited word counts against the audit snapshot: the nine engine/workflow entry points decrease from 4,312 to 2,681 words (38%). All seventeen existing entry points together increase from 7,724 to 7,919 words (3%), reflecting migrated review criteria and added engineering safeguards. The new `ask-codebase` entry adds 350 words. These are entry-file counts only: supporting contracts, examples and tools are excluded. They measure neither model tokens nor the context loaded by a real workflow. The simplification is fewer instruction owners and persona reads, with progressive loading; an overall token reduction is not claimed.

## What the checks establish

Three separate source baselines were captured before editing the engine, workflows and engineering instructions. Each edited skill then received an application/reference check. Actual Python baseline failures were reproduced before correcting the examples. Independent reviewers found additional runtime and workflow gaps; the runtime reproductions became regression tests. The archive-retention follow-up was observed failing before its fix and passing afterward.

The state helper now preserves both replaced evidence and already archived history. Current completion requires current candidate evidence. Plan impact includes Markdown content changes alongside manifest changes. PR report identity includes base and head, so a changed base cannot overwrite or reuse a prior review result. Configured spec directories and merge/release/manual issue policies propagate through the workflow.

Local raw records are retained under `.agentic/output/2026-09-11-skills-migration/`: `engine-results.md`, `workflow-results.md`, `engineering-results.md`, `runtime-crossreview.md`, `workflow-crossreview.md`, `behavior-probes.json`, and `behavior-results.jsonl`. This ignored directory is local evidence; this document keeps the durable result and limitations.

## Limits and owner testing

Both wording-probe conditions passed. They therefore demonstrate no observed regression on that narrow case, not an improvement over the no-library control. Fresh native worker contexts retained the Codex instruction overlay; condition order was not randomized, grading was by the root agent, and exact executed model/effort and token/time measurements were unavailable. There was no repeated original-library arm or Fable execution.

The deterministic helpers validate recorded data and selected filesystem/Git facts. They cannot prove that a model inspected every file, that an approval quote is truthful, or that a green test establishes a product requirement without actual criterion-specific inspection. Prompt gates still require the orchestrator to do that work.

The example fixtures validate selected complete examples, not every schematic excerpt, production database atomicity, provider idempotency, or real telemetry SDK exports. The external `agentic-cli` and all native host installations were not end-to-end tested.

Before relying on model-routing or efficiency changes, run the supplied [evaluation campaign](../../tests/evals/README.md) on both target models. The most useful live cases are a one-ticket feature, concurrent expand–contract work, debug with an initially invalid regression, a PR batch whose target changes, and a fresh-checkout durable plan handoff. Quality, token use and latency parity remain unmeasured. These are adoption checks for the owner's review, not claims of completed live testing.
