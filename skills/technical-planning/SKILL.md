---
name: agentic:workflow:technical-planning
description: Use when a feature, specification, issue, or accepted external plan needs architecture decisions, acceptance criteria, or an implementable ticket breakdown.
---

# Technical Planning

Turn accepted product intent into a durable specification and verifiable tickets. Required skills: `use-agentic`, `use-workflow`, `delegate-work`, `use-knowledge`. Initialize the run before saving input. Accept a file, issue reference/URL, inline description, or existing conversation input; ask only when input is missing. Preserve source provenance and redact sensitive values in `input.md`.

Keep these five phases, loading the current step and its relevant recovery contracts progressively:

| Phase | Instructions | Gate |
|---|---|---|
| 1 | [Gather context](steps/step-01-gather-context.md) | Evidence and developer correction point |
| 2 | [Grill requirements](steps/step-02-grill.md) | Structural questions resolved |
| 3 | [Generate](steps/step-03-generate.md) | Valid PRD, plan and ticket graph |
| 4 | [Quiz](steps/step-04-quiz-gate.md) | Developer approves exact revision |
| 5 | [Handoff](steps/step-05-handoff.md) | Durable artifacts and reviewable delivery |

The parent owns run state, decisions, gates and publication. Native workers explore code and may generate documents; they return results and write only assigned artifacts. Resolve profile skills and model roles once through `use-agentic`. Retrieve relevant accepted knowledge before decisions and reconcile it at handoff through `use-knowledge`.

Structural decisions remain the developer's. Reuse explicit answers and authorizations already given for unchanged scope; an elapsed timeout is not approval. Preserve generation choice, quiz and optional publication. An [accepted-plan import](references/import-plan.md) creates a draft in the same contract and enters the same remaining gates; prose alone never bypasses validation or approval.

Use the resolved spec_folder from use-agentic (default docs/specs). Accepted artifacts live under `{execution_context.spec_folder}/<spec-id>/`; transient evidence lives in the run directory. Shared `use-workflow` plan/state contracts and helper validate graphs, sealed artifact hashes, requirement coverage and approval revisions. Begin with phase 1.
