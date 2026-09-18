---
name: agentic:skill:delegate-work
description: Use when a task needs native subagents for bounded exploration, implementation, review, or fixes
---

# Delegate Work

Dispatch a bounded task with enough evidence to verify its result. The orchestrator resolves `agentic:skill:use-agentic` once; workers inherit that execution context. There is no persona lookup or persona boot stage.

Every dispatch has these fields:

| Field | Required content |
|---|---|
| `task_id`, goal, completion condition | Unique worker assignment and useful result. |
| `skills`, references | Operation skill and `technical_skills_prompt` names plus installed paths; direct task references below. |
| inputs, revision | Actual artifact/source paths, repository root, accepted plan revision and immutable code revision where applicable. |
| allowed writes | Explicit source-file scope and unique artifact path; empty source scope means repository read-only. |
| capabilities, model role | Actual native worker capability and resolved model/effort from execution context. |
| output, evidence | Required artifact/result, relevant checks, unresolved decisions, and constraints. |

Before task work, the worker loads operation/profile skills and their required references, then reads inputs. Shared files are passed by path, with complete nested rule retrieval. Missing paths are returned as errors. For TypeScript, load the entry point and all seven applicable rule files; a copied quick-reference table does not replace them. Use [dispatch.md](references/dispatch.md) for the concrete contract and result validation.

For source implementation/test/fix work, load [engineering-contract.md](references/engineering-contract.md). For context gathering/investigation, load [exploration.md](references/exploration.md). These are task acceptance rules, not identities. Review skills own their lenses; `review-loop` owns review outcomes and fix budgets.

Spawn independent scopes concurrently within configured and native capacity. Shared source writes, indexes, state, or Git operations require isolation or sequencing. The orchestrator owns canonical state, numbered knowledge allocation, integration, and commits. Workers return proposed knowledge captures.

Use supported native controls. If only a full-capability worker exists, constrain its task to allowed writes. A truly read-only worker returns the complete artifact for the orchestrator to save. No native subagents or transferable inputs means the affected delegated gate remains unmet; report the precise capability limit. Preserve already-authorized scope and continue useful independent work.
